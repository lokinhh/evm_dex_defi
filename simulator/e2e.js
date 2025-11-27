const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

async function main() {
  const [deployer, trader] = await ethers.getSigners();
  const WETH = await ethers.getContractFactory('WETH9');
  const weth = await WETH.deploy();
  const Factory = await ethers.getContractFactory('DexFactory');
  const factory = await Factory.deploy(deployer.address);
  const Router = await ethers.getContractFactory('DexRouter');
  const router = await Router.deploy(await factory.getAddress(), await weth.getAddress());
  const Mock = await ethers.getContractFactory('MockERC20');
  const tokenA = await Mock.deploy('TKA', 'TKA', 18);
  const tokenB = await Mock.deploy('TKB', 'TKB', 18);
  const CDX = await ethers.getContractFactory('CDXToken');
  const cdx = await CDX.deploy(ethers.parseEther('1000000'), deployer.address);

  await tokenA.mint(deployer.address, ethers.parseEther('1000'));
  await tokenB.mint(deployer.address, ethers.parseEther('1000'));
  await tokenA.mint(trader.address, ethers.parseEther('100'));

  const start = (await time.latest()) + 5;
  const farm = await (await ethers.getContractFactory('RewardFarm')).deploy(
    await cdx.getAddress(),
    ethers.parseEther('1'),
    start,
    start + 86400,
  );
  await cdx.transfer(await farm.getAddress(), ethers.parseEther('50000'));

  const a = await tokenA.getAddress();
  const b = await tokenB.getAddress();
  await tokenA.approve(await router.getAddress(), ethers.parseEther('500'));
  await tokenB.approve(await router.getAddress(), ethers.parseEther('500'));
  await router.addLiquidity(a, b, ethers.parseEther('200'), ethers.parseEther('200'), 0, 0, deployer.address, (await time.latest()) + 600);

  const pair = await factory.getPair(a, b);
  await farm.addPool(pair, 100);

  const amountIn = ethers.parseEther('1');
  await tokenA.connect(trader).approve(await router.getAddress(), amountIn);
  const amounts = await router.getAmountsOut(amountIn, [a, b]);
  const minOut = (amounts[1] * 995n) / 1000n;
  const tx = await router.connect(trader).swapExactTokensForTokens(
    amountIn,
    minOut,
    [a, b],
    trader.address,
    (await time.latest()) + 600,
  );
  await tx.wait();

  console.log(JSON.stringify({
    ok: true,
    flow: 'deploy → liquidity → swap → stake-ready',
    pair,
    swapTx: tx.hash,
    traderOutMin: minOut.toString(),
  }));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err) }));
  process.exit(1);
});
