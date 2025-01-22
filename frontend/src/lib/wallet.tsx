'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { BrowserProvider, JsonRpcSigner } from 'ethers';

type WalletContextValue = {
  address: string | null;
  signer: JsonRpcSigner | null;
  connect: () => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);

  const connect = useCallback(async () => {
    if (!window.ethereum) throw new Error('Install MetaMask');
    const provider = new BrowserProvider(window.ethereum);
    await provider.send('eth_requestAccounts', []);
    const nextSigner = await provider.getSigner();
    setSigner(nextSigner);
    setAddress(await nextSigner.getAddress());
  }, []);

  const disconnect = useCallback(() => {
    setSigner(null);
    setAddress(null);
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.on?.('accountsChanged', (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts.length) disconnect();
      else setAddress(accounts[0]);
    });
  }, [disconnect]);

  const value = useMemo(() => ({ address, signer, connect, disconnect }), [address, signer, connect, disconnect]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}
