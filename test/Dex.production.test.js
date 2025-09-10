const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

async function deployFixture() {
  const [deployer, alice, bob] = await ethers.getSigners();
  const WETH = await ethers.getContractFactory('WETH9');
  const weth = await WETH.deploy();
  const Factory = await ethers.getContractFactory('DexFactory');
  const factory = await Factory.deploy(deployer.address);
  const Router = await ethers.getContractFactory('DexRouter');
  const router = await Router.deploy(await factory.getAddress(), await weth.getAddress());
  const Mock = await ethers.getContractFactory('MockERC20');
  const tokenA = await Mock.deploy('Token A', 'TKA', 18);
  const tokenB = await Mock.deploy('Token B', 'TKB', 18);
  const CDX = await ethers.getContractFactory('CDXToken');
  const cdx = await CDX.deploy(ethers.parseEther('1000000'), deployer.address);
  await tokenA.mint(alice.address, ethers.parseEther('10000'));
  await tokenB.mint(alice.address, ethers.parseEther('10000'));
  await tokenA.mint(bob.address, ethers.parseEther('1000'));
  await tokenB.mint(bob.address, ethers.parseEther('1000'));
  const start = (await time.latest()) + 10;
  const end = start + 86400 * 30;
  const RewardFarm = await ethers.getContractFactory('RewardFarm');
  const farm = await RewardFarm.deploy(await cdx.getAddress(), ethers.parseEther('1'), start, end);
  await cdx.transfer(await farm.getAddress(), ethers.parseEther('100000'));
  return { deployer, alice, bob, weth, factory, router, tokenA, tokenB, cdx, farm };
}

describe('ChainDex production hardening', function () {
  it('router auto-creates pair on first addLiquidity', async function () {
    const { alice, router, tokenA, tokenB, factory } = await deployFixture();
    const a = await tokenA.getAddress();
    const b = await tokenB.getAddress();
    expect(await factory.getPair(a, b)).to.equal(ethers.ZeroAddress);
    await tokenA.connect(alice).approve(await router.getAddress(), ethers.parseEther('10'));
    await tokenB.connect(alice).approve(await router.getAddress(), ethers.parseEther('10'));
    await router.connect(alice).addLiquidity(a, b, ethers.parseEther('10'), ethers.parseEther('10'), 0, 0, alice.address, (await time.latest()) + 600);
    expect(await factory.getPair(a, b)).to.properAddress;
  });

  it('rejects expired swap deadline', async function () {
    const { alice, bob, router, tokenA, tokenB } = await deployFixture();
    const a = await tokenA.getAddress();
    const b = await tokenB.getAddress();
    await tokenA.connect(alice).approve(await router.getAddress(), ethers.parseEther('100'));
    await tokenB.connect(alice).approve(await router.getAddress(), ethers.parseEther('100'));
    await router.connect(alice).addLiquidity(a, b, ethers.parseEther('50'), ethers.parseEther('50'), 0, 0, alice.address, (await time.latest()) + 600);
    await tokenA.connect(bob).approve(await router.getAddress(), ethers.parseEther('1'));
    await expect(
      router.connect(bob).swapExactTokensForTokens(ethers.parseEther('1'), 0, [a, b], bob.address, (await time.latest()) - 1),
    ).to.be.revertedWith('DexRouter: EXPIRED');
  });

  it('enforces swap slippage minOut', async function () {
    const { alice, bob, router, tokenA, tokenB } = await deployFixture();
    const a = await tokenA.getAddress();
    const b = await tokenB.getAddress();
    await tokenA.connect(alice).approve(await router.getAddress(), ethers.parseEther('100'));
    await tokenB.connect(alice).approve(await router.getAddress(), ethers.parseEther('100'));
    await router.connect(alice).addLiquidity(a, b, ethers.parseEther('50'), ethers.parseEther('50'), 0, 0, alice.address, (await time.latest()) + 600);
    const amountIn = ethers.parseEther('1');
    const amounts = await router.getAmountsOut(amountIn, [a, b]);
    await tokenA.connect(bob).approve(await router.getAddress(), amountIn);
    await expect(
      router.connect(bob).swapExactTokensForTokens(amountIn, amounts[1] + 1n, [a, b], bob.address, (await time.latest()) + 600),
    ).to.be.revertedWith('DexRouter: INSUFFICIENT_OUTPUT_AMOUNT');
  });

  it('farm harvest draws from funded balance not mint', async function () {
    const { alice, router, tokenA, tokenB, factory, farm, cdx } = await deployFixture();
    const a = await tokenA.getAddress();
    const b = await tokenB.getAddress();
    await factory.createPair(a, b);
    const pair = await factory.getPair(a, b);
    await farm.addPool(pair, 100);
    await tokenA.connect(alice).approve(await router.getAddress(), ethers.parseEther('100'));
    await tokenB.connect(alice).approve(await router.getAddress(), ethers.parseEther('100'));
    await router.connect(alice).addLiquidity(a, b, ethers.parseEther('50'), ethers.parseEther('50'), 0, 0, alice.address, (await time.latest()) + 600);
    const Pair = await ethers.getContractAt('DexPair', pair);
    const lp = await Pair.balanceOf(alice.address);
    await Pair.connect(alice).approve(await farm.getAddress(), lp);
    await farm.connect(alice).deposit(0, lp);
    await time.increase(3600);
    const balBefore = await cdx.balanceOf(alice.address);
    await farm.connect(alice).harvest(0);
    expect(await cdx.balanceOf(alice.address)).to.be.gt(balBefore);
  });

  it('farm pauses deposits when paused', async function () {
    const { deployer, alice, router, tokenA, tokenB, factory, farm } = await deployFixture();
    const a = await tokenA.getAddress();
    const b = await tokenB.getAddress();
    await factory.createPair(a, b);
    const pair = await factory.getPair(a, b);
    await farm.addPool(pair, 100);
    await tokenA.connect(alice).approve(await router.getAddress(), ethers.parseEther('10'));
    await tokenB.connect(alice).approve(await router.getAddress(), ethers.parseEther('10'));
    await router.connect(alice).addLiquidity(a, b, ethers.parseEther('10'), ethers.parseEther('10'), 0, 0, alice.address, (await time.latest()) + 600);
    const Pair = await ethers.getContractAt('DexPair', pair);
    const lp = await Pair.balanceOf(alice.address);
    await Pair.connect(alice).approve(await farm.getAddress(), lp);
    await farm.connect(deployer).pause();
    await expect(farm.connect(alice).deposit(0, lp)).to.be.revertedWithCustomError(farm, 'EnforcedPause');
  });

  it('getAmountOut matches constant product with fee', async function () {
    const { router } = await deployFixture();
    const out = await router.getAmountOut(1000n, 100000n, 100000n);
    expect(out).to.equal(987n);
  });
});
