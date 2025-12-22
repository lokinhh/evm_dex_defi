# Production deployment

## Pre-flight checklist

- [ ] `DEPLOYER_PRIVATE_KEY` in secure vault (never commit)
- [ ] `ETHERSCAN_API_KEY` + `BSCSCAN_API_KEY` for verification
- [ ] `ETH_RPC_URL` / `BSC_RPC_URL` — paid RPC (Alchemy, Infura, QuickNode)
- [ ] Multisig addresses for Timelock proposer/executor (replace deployer EOA)
- [ ] Fund deployer wallet with gas on target network
- [ ] Run full test suite: `npm test && npm run e2e`
- [ ] Third-party audit completed (see `docs/SECURITY.md`)

## Deploy

```bash
cp .env.example .env
# fill DEPLOYER_PRIVATE_KEY, RPC URLs, API keys

npm ci && npm test
npx hardhat run scripts/deploy.js --network sepolia
npx hardhat run scripts/verify.js --network sepolia
```

Repeat for `bscTestnet` if dual-chain.

## Post-deploy

1. Transfer Timelock proposer/executor roles to multisig
2. Renounce deployer admin on factory `feeToSetter` if applicable
3. Seed liquidity via `scripts/seed-liquidity.js` (optional)
4. Publish `frontend/public/deployment.json` or set `NEXT_PUBLIC_*` env vars
5. Deploy frontend (Vercel / IPFS)

## Frontend env (production)

```env
NEXT_PUBLIC_CHAIN_ID=11155111
NEXT_PUBLIC_DEX_ROUTER=0x...
NEXT_PUBLIC_TOKEN_A=0x...
NEXT_PUBLIC_TOKEN_B=0x...
NEXT_PUBLIC_PAIR=0x...
NEXT_PUBLIC_REWARD_FARM=0x...
NEXT_PUBLIC_CDX_TOKEN=0x...
NEXT_PUBLIC_SLIPPAGE_BPS=50
```

## E2E flows (verified)

| Flow | Coverage |
|---|---|
| Deploy all contracts + Timelock | `scripts/deploy.js` |
| Add liquidity (auto-create pair) | `test/Dex.production.test.js` |
| Swap with slippage + deadline | tests + frontend |
| LP stake + harvest (funded rewards) | tests |
| ETH → token swap | `test/Dex.test.js` |
| Full pipeline | `npm run e2e` |

## Monitoring

- **Tenderly** — alert on Router/Farm transactions
- **Defender** — optional autotasks for anomaly pause
- **Subgraph** — index `PairCreated`, `Swap`, `Deposit` events (schema in `subgraph/`)

## Incident response

1. `pause()` on RewardFarm via Timelock (48h delay unless emergency multisig)
2. Communicate on status page
3. Post-mortem + patch + re-audit before unpause

## Networks

| Network | Chain ID | Use |
|---|---|---|
| Sepolia | 11155111 | Ethereum testnet |
| BSC Testnet | 97 | BNB testnet |
| Mainnet | — | **Audit + multisig required** |
