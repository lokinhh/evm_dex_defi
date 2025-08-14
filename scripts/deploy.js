const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

const TIMELOCK_DELAY = 48 * 60 * 60; // 48 hours
const REWARD_FUND = ethers.parseEther('5000000');
const EMISSION_PER_SEC = ethers.parseEther('0.5');
const EMISSION_DURATION_SEC = 365 * 24 * 60 * 60;

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log('Deploying ChainDex with:', deployer.address);
  console.log('Network:', network.name, chainId);

  const WETH = await ethers.getContractFactory('WETH9');
  const weth = await WETH.deploy();
  await weth.waitForDeployment();

  const Factory = await ethers.getContractFactory('DexFactory');
  const factory = await Factory.deploy(deployer.address);
  await factory.waitForDeployment();

  const Router = await ethers.getContractFactory('DexRouter');
  const router = await Router.deploy(await factory.getAddress(), await weth.getAddress());
  await router.waitForDeployment();

  const Mock = await ethers.getContractFactory('MockERC20');
  const tokenA = await Mock.deploy('ChainDex Token A', 'CDA', 18);
  const tokenB = await Mock.deploy('ChainDex Token B', 'CDB', 18);
  await tokenA.waitForDeployment();
  await tokenB.waitForDeployment();

  const CDX = await ethers.getContractFactory('CDXToken');
  const maxSupply = ethers.parseEther('10000000');
  const cdx = await CDX.deploy(maxSupply, deployer.address);
  await cdx.waitForDeployment();

  await factory.createPair(await tokenA.getAddress(), await tokenB.getAddress());
  const pair = await factory.getPair(await tokenA.getAddress(), await tokenB.getAddress());

  const now = Math.floor(Date.now() / 1000);
  const startTime = now + 60;
  const endTime = startTime + EMISSION_DURATION_SEC;

  const RewardFarm = await ethers.getContractFactory('RewardFarm');
  const farm = await RewardFarm.deploy(
    await cdx.getAddress(),
    EMISSION_PER_SEC,
    startTime,
    endTime,
  );
  await farm.waitForDeployment();
  await farm.addPool(pair, 100);

  const Timelock = await ethers.getContractFactory('DexTimelock');
  const timelock = await Timelock.deploy(
    TIMELOCK_DELAY,
    [deployer.address],
    [deployer.address],
    deployer.address,
  );
  await timelock.waitForDeployment();

  await cdx.transfer(await farm.getAddress(), REWARD_FUND);
  await farm.transferOwnership(await timelock.getAddress());

  const deployment = {
    chainId,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    timelockDelaySec: TIMELOCK_DELAY,
    contracts: {
      WETH: await weth.getAddress(),
      DexFactory: await factory.getAddress(),
      DexRouter: await router.getAddress(),
      TokenA: await tokenA.getAddress(),
      TokenB: await tokenB.getAddress(),
      CDXToken: await cdx.getAddress(),
      Pair: pair,
      RewardFarm: await farm.getAddress(),
      Timelock: await timelock.getAddress(),
    },
    config: {
      maxSupply: maxSupply.toString(),
      defaultSlippageBps: 50,
      rewardFund: REWARD_FUND.toString(),
      emissionPerSecond: EMISSION_PER_SEC.toString(),
      startTime,
      endTime,
    },
  };

  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${chainId}.json`);
  fs.writeFileSync(file, JSON.stringify(deployment, null, 2));

  const frontendFile = path.join(__dirname, '..', 'frontend', 'public', 'deployment.json');
  fs.mkdirSync(path.dirname(frontendFile), { recursive: true });
  fs.writeFileSync(frontendFile, JSON.stringify(deployment, null, 2));

  console.log('Saved deployment to', file);
  console.log(JSON.stringify(deployment.contracts, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
