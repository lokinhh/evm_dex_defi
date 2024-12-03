const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  const WETH = await ethers.getContractFactory('WETH9');
  const weth = await WETH.deploy();
  const Factory = await ethers.getContractFactory('DexFactory');
  const factory = await Factory.deploy(deployer.address);
  const Router = await ethers.getContractFactory('DexRouter');
  const router = await Router.deploy(await factory.getAddress(), await weth.getAddress());
  const Mock = await ethers.getContractFactory('MockERC20');
  const tokenA = await Mock.deploy('Token A', 'TKA', 18);
  const tokenB = await Mock.deploy('Token B', 'TKB', 18);
  const outDir = path.join(__dirname, '..', 'deployments');
  fs.mkdirSync(outDir, { recursive: true });
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  fs.writeFileSync(
    path.join(outDir, `${chainId}.json`),
    JSON.stringify({ contracts: { WETH: await weth.getAddress(), DexFactory: await factory.getAddress() } }, null, 2),
  );
  console.log('Deployed', deployer.address);
}

main().catch((e) => { console.error(e); process.exit(1); });
