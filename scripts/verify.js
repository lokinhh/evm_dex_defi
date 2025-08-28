const fs = require('fs');
const path = require('path');
const hre = require('hardhat');

async function verifyAddress(name, address, constructorArguments = []) {
  try {
    await hre.run('verify:verify', { address, constructorArguments });
    console.log(`Verified ${name}: ${address}`);
  } catch (err) {
    const msg = String(err.message || err);
    if (msg.includes('Already Verified')) {
      console.log(`Already verified ${name}`);
      return;
    }
    console.warn(`Verify failed for ${name}:`, msg);
  }
}

async function main() {
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const file = path.join(__dirname, '..', 'deployments', `${chainId}.json`);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing deployment file: ${file}`);
  }
  const deployment = JSON.parse(fs.readFileSync(file, 'utf8'));
  const c = deployment.contracts;

  await verifyAddress('WETH9', c.WETH, []);
  await verifyAddress('DexFactory', c.DexFactory, [deployment.deployer]);
  await verifyAddress('DexRouter', c.DexRouter, [c.DexFactory, c.WETH]);
  await verifyAddress('MockERC20 TokenA', c.TokenA, ['ChainDex Token A', 'CDA', 18]);
  await verifyAddress('MockERC20 TokenB', c.TokenB, ['ChainDex Token B', 'CDB', 18]);
  if (c.CDXToken) {
    await verifyAddress('CDXToken', c.CDXToken, [
      deployment.config?.maxSupply || ethers.parseEther('10000000').toString(),
      deployment.deployer,
    ]);
  }
  if (c.RewardFarm && deployment.config) {
    await verifyAddress('RewardFarm', c.RewardFarm, [
      c.CDXToken,
      deployment.config.emissionPerSecond,
      deployment.config.startTime,
      deployment.config.endTime,
    ]);
  }
  if (c.Timelock && deployment.timelockDelaySec) {
    await verifyAddress('TimelockController', c.Timelock, [
      deployment.timelockDelaySec,
      [deployment.deployer],
      [deployment.deployer],
      deployment.deployer,
    ]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
