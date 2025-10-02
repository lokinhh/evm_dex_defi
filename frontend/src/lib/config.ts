export type DeploymentContracts = {
  DexRouter: string;
  TokenA: string;
  TokenB: string;
  RewardFarm: string;
  Pair: string;
  CDXToken?: string;
  DexFactory?: string;
  WETH?: string;
  Timelock?: string;
};

export type DeploymentFile = {
  chainId: number;
  contracts: DeploymentContracts;
  config?: { defaultSlippageBps?: number };
};

let cached: DeploymentFile | null = null;

export async function loadDeployment(): Promise<DeploymentFile | null> {
  if (cached) return cached;
  if (typeof window === 'undefined') return null;

  const envRouter = process.env.NEXT_PUBLIC_DEX_ROUTER;
  if (envRouter) {
    cached = {
      chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337),
      contracts: {
        DexRouter: envRouter,
        TokenA: process.env.NEXT_PUBLIC_TOKEN_A || '',
        TokenB: process.env.NEXT_PUBLIC_TOKEN_B || '',
        Pair: process.env.NEXT_PUBLIC_PAIR || '',
        RewardFarm: process.env.NEXT_PUBLIC_REWARD_FARM || '',
        CDXToken: process.env.NEXT_PUBLIC_CDX_TOKEN,
      },
      config: { defaultSlippageBps: Number(process.env.NEXT_PUBLIC_SLIPPAGE_BPS || 50) },
    };
    return cached;
  }

  try {
    const res = await fetch('/deployment.json', { cache: 'no-store' });
    if (!res.ok) return null;
    cached = (await res.json()) as DeploymentFile;
    return cached;
  } catch {
    return null;
  }
}

export function getDefaultSlippageBps(deployment: DeploymentFile | null): number {
  return deployment?.config?.defaultSlippageBps ?? 50;
}
