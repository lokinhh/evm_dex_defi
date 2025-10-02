export function applySlippage(amountOut: bigint, slippageBps: number): bigint {
  const bps = BigInt(Math.max(0, Math.min(slippageBps, 5000)));
  return (amountOut * (10000n - bps)) / 10000n;
}

export function calcPriceImpactBps(amountIn: bigint, amountOut: bigint, spotOut: bigint): number {
  if (spotOut === 0n) return 0;
  const impact = Number(((spotOut - amountOut) * 10000n) / spotOut);
  return Math.max(0, impact);
}

export function deadlineTimestamp(minutes = 20): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + minutes * 60);
}
