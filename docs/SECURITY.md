# Security

## Architecture controls

| Control | Implementation |
|---|---|
| Reentrancy | `ReentrancyGuard` on Router, Pair, Farm |
| Slippage | `amountOutMin` on all swaps; UI default 50 bps |
| Deadline | `ensure(deadline)` on Router mutations |
| LP lock | `MINIMUM_LIQUIDITY` sent to `0xdead` on first mint |
| Reward emissions | Pre-funded CDX pool — **no mint on harvest** |
| Admin changes | `Ownable2Step` + **48h Timelock** on farm ownership |
| Emergency | `Pausable` on RewardFarm deposits/harvest |

## Audit status

| Item | Status |
|---|---|
| Internal test suite | 11+ tests (unit + production) |
| External audit | **Not yet performed** — required before mainnet |
| Formal verification | Not performed |
| Bug bounty | Not configured |

## Known limitations

- Uniswap V2-style AMM — no concentrated liquidity
- No flash-loan protection beyond constant-product invariant
- No fee-on-transfer / rebasing token support
- Router does not support multihop price oracle / TWAP consumer
- Mock ERC20 demo tokens on testnet — replace with audited tokens for mainnet

## Recommendations before mainnet

1. Engage audit firm (Trail of Bits, OpenZeppelin, Cyfrin, etc.)
2. Multisig (Gnosis Safe) as Timelock proposer/executor
3. Cap per-tx swap size or integrate oracle TWAP for large trades
4. Run Slither + Mythril in CI
5. Set up monitoring and incident runbook (`docs/PRODUCTION.md`)

## Responsible disclosure

Report vulnerabilities to the repository owner via private channel. Do not disclose publicly until patched.
