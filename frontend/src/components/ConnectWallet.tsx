'use client';

import { useWallet } from '@/lib/wallet';

export function ConnectWallet() {
  const { address, connect, disconnect } = useWallet();

  if (address) {
    return (
      <button className="btn" onClick={disconnect} type="button">
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>
    );
  }

  return (
    <button className="btn" onClick={() => connect().catch(console.error)} type="button">
      Connect Wallet
    </button>
  );
}
