const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

describe('ChainDex AMM', function () {
  let factory, router, weth, tokenA, tokenB, rewardToken, farm;
  let owner, alice, bob;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();

    const WETH = await ethers.getContractFactory('WETH9');
    weth = await WETH.deploy();

    const Factory = await ethers.getContractFactory('DexFactory');
    factory = await Factory.deploy(owner.address);

    const Router = await ethers.getContractFactory('DexRouter');
    router = await Router.deploy(await factory.getAddress(), await weth.getAddress());

    const Mock = await ethers.getContractFactory('MockERC20');
    tokenA = await Mock.deploy('Token A', 'TKA', 18);
    tokenB = await Mock.deploy('Token B', 'TKB', 18);

    const CDX = await ethers.getContractFactory('CDXToken');
    rewardToken = await CDX.deploy(ethers.parseEther('1000000'), owner.address);

    await tokenA.mint(alice.address, ethers.parseEther('10000'));
    await tokenB.mint(alice.address, ethers.parseEther('10000'));
    await tokenA.mint(bob.address, ethers.parseEther('1000'));
    await tokenB.mint(bob.address, ethers.parseEther('1000'));

    await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
    const pairAddress = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());

    const start = (await time.latest()) + 10;
    const end = start + 86400 * 365;
    const RewardFarm = await ethers.getContractFactory('RewardFarm');
    farm = await RewardFarm.deploy(
      await rewardToken.getAddress(),
      ethers.parseEther('1'),
      start,
      end,
    );
    await farm.addPool(pairAddress, 100);
    await rewardToken.transfer(await farm.getAddress(), ethers.parseEther('100000'));
  });

  async function addInitialLiquidity(signer, amountA, amountB) {
    const tokenAAddr = await tokenA.getAddress();
    const tokenBAddr = await tokenB.getAddress();
    await tokenA.connect(signer).approve(await router.getAddress(), amountA);
    await tokenB.connect(signer).approve(await router.getAddress(), amountB);
    await router.connect(signer).addLiquidity(
      tokenAAddr,
      tokenBAddr,
      amountA,
      amountB,
      0,
      0,
      signer.address,
      (await time.latest()) + 600,
    );
  }

  it('creates pair and adds liquidity', async function () {
    await addInitialLiquidity(alice, ethers.parseEther('100'), ethers.parseEther('200'));
    const pairAddress = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
    const Pair = await ethers.getContractAt('DexPair', pairAddress);
    const [r0, r1] = await Pair.getReserves();
    expect(r0).to.equal(ethers.parseEther('100'));
    expect(r1).to.equal(ethers.parseEther('200'));
    expect(await Pair.balanceOf(alice.address)).to.be.gt(0);
  });

  it('swaps tokenA for tokenB with 0.3% fee', async function () {
    await addInitialLiquidity(alice, ethers.parseEther('100'), ethers.parseEther('100'));
    const amountIn = ethers.parseEther('1');
    await tokenA.connect(bob).approve(await router.getAddress(), amountIn);
    const path = [await tokenA.getAddress(), await tokenB.getAddress()];
    const amountsOut = await router.getAmountsOut(amountIn, path);
    const balanceBefore = await tokenB.balanceOf(bob.address);
    await router.connect(bob).swapExactTokensForTokens(
      amountIn,
      0,
      path,
      bob.address,
      (await time.latest()) + 600,
    );
    const balanceAfter = await tokenB.balanceOf(bob.address);
    expect(balanceAfter - balanceBefore).to.equal(amountsOut[1]);
    expect(amountsOut[1]).to.be.lt(ethers.parseEther('1'));
  });

  it('removes liquidity', async function () {
    await addInitialLiquidity(alice, ethers.parseEther('50'), ethers.parseEther('50'));
    const pairAddress = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
    const Pair = await ethers.getContractAt('DexPair', pairAddress);
    const lpBalance = await Pair.balanceOf(alice.address);
    await Pair.connect(alice).approve(await router.getAddress(), lpBalance);
    await router.connect(alice).removeLiquidity(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      lpBalance,
      0,
      0,
      alice.address,
      (await time.latest()) + 600,
    );
    expect(await Pair.balanceOf(alice.address)).to.equal(0);
  });

  it('stakes LP tokens and harvests rewards', async function () {
    await addInitialLiquidity(alice, ethers.parseEther('100'), ethers.parseEther('100'));
    const pairAddress = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());
    const Pair = await ethers.getContractAt('DexPair', pairAddress);
    const lp = await Pair.balanceOf(alice.address);
    await Pair.connect(alice).approve(await farm.getAddress(), lp);
    await farm.connect(alice).deposit(0, lp);
    await time.increase(3600);
    const pending = await farm.pendingReward(0, alice.address);
    expect(pending).to.be.gt(0);
    await farm.connect(alice).harvest(0);
    expect(await rewardToken.balanceOf(alice.address)).to.be.gt(0);
  });

  it('wraps and swaps ETH for tokens', async function () {
    await factory.createPair(await weth.getAddress(), await tokenA.getAddress());
    const wethAddr = await weth.getAddress();
    const tokenAAddr = await tokenA.getAddress();
    await weth.connect(alice).deposit({ value: ethers.parseEther('20') });
    await weth.connect(alice).approve(await router.getAddress(), ethers.parseEther('20'));
    await tokenA.connect(alice).approve(await router.getAddress(), ethers.parseEther('100'));
    await router.connect(alice).addLiquidity(
      wethAddr,
      tokenAAddr,
      ethers.parseEther('10'),
      ethers.parseEther('10'),
      0,
      0,
      alice.address,
      (await time.latest()) + 600,
    );

    const path = [wethAddr, tokenAAddr];
    const amounts = await router.getAmountsOut(ethers.parseEther('0.1'), path);
    await router.connect(bob).swapExactETHForTokens(
      0,
      path,
      bob.address,
      (await time.latest()) + 600,
      { value: ethers.parseEther('0.1') },
    );
    expect(await tokenA.balanceOf(bob.address)).to.be.gte(amounts[1]);
  });
});
