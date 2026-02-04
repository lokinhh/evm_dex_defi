# ChainDex subgraph (The Graph)

Index on-chain DEX activity for dashboards and analytics.

## Entities

- `Factory` — global pair count
- `Pair` — reserves, token0/token1
- `Swap` — amountIn, amountOut, sender
- `Liquidity` — mint/burn events
- `FarmDeposit` — stake/unstake/harvest

## Deploy

```bash
cd subgraph
npm install
graph codegen && graph build
graph deploy --studio chaindex-sepolia
```

Map contract ABIs from `../artifacts/contracts` after `npm run compile`.

## Status

Schema stub — deploy after testnet contracts are verified. See `docs/PRODUCTION.md` for monitoring setup.
