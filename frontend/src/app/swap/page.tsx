'use client';

import { useEffect, useState } from 'react';
import { Contract, formatEther, parseEther } from 'ethers';
import { loadDeployment, getDefaultSlippageBps } from '@/lib/config';
import { applySlippage, deadlineTimestamp } from '@/lib/swap';
import { useWallet } from '@/lib/wallet';
import { ERC20_ABI, ROUTER_ABI } from '@/lib/contracts';

export default function SwapPage() {
  const { address, signer } = useWallet();
  const [deployment, setDeployment] = useState<Awaited<ReturnType<typeof loadDeployment>>>(null);
  const [amountIn, setAmountIn] = useState('1');
  const [slippageBps, setSlippageBps] = useState(50);
  const [quoteOut, setQuoteOut] = useState('—');
  const [minOut, setMinOut] = useState('—');
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadDeployment().then((d) => {
      setDeployment(d);
      if (d) setSlippageBps(getDefaultSlippageBps(d));
    });
  }, []);

  useEffect(() => {
    async function quote() {
      if (!deployment?.contracts.DexRouter || !signer) return;
      try {
        const router = new Contract(deployment.contracts.DexRouter, ROUTER_ABI, signer);
        const path = [deployment.contracts.TokenA, deployment.contracts.TokenB];
        const amounts = await router.getAmountsOut(parseEther(amountIn || '0'), path);
        const out = amounts[1] as bigint;
        setQuoteOut(formatEther(out));
        setMinOut(formatEther(applySlippage(out, slippageBps)));
      } catch {
        setQuoteOut('—');
        setMinOut('—');
      }
    }
    quote();
  }, [amountIn, slippageBps, deployment, signer]);

  async function handleSwap() {
    if (!deployment || !signer || !address) return;
    try {
      setStatus('Submitting transaction…');
      const router = new Contract(deployment.contracts.DexRouter, ROUTER_ABI, signer);
      const tokenA = new Contract(deployment.contracts.TokenA, ERC20_ABI, signer);
      const amountInWei = parseEther(amountIn);
      const path = [deployment.contracts.TokenA, deployment.contracts.TokenB];
      const amounts = await router.getAmountsOut(amountInWei, path);
      const min = applySlippage(amounts[1] as bigint, slippageBps);
      await (await tokenA.approve(deployment.contracts.DexRouter, amountInWei)).wait();
      const tx = await router.swapExactTokensForTokens(
        amountInWei,
        min,
        path,
        address,
        deadlineTimestamp(),
      );
      await tx.wait();
      setStatus('Swap confirmed on-chain');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Swap failed');
    }
  }

  return (
    <div className="card mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Swap</h1>
      <p className="mt-1 text-sm text-white/60">Token A → Token B with slippage protection</p>
      {!deployment && (
        <p className="mt-4 text-sm text-amber-300">Load /deployment.json or set NEXT_PUBLIC_DEX_ROUTER in env.</p>
      )}
      <label className="mt-6 block text-sm">Amount In (TKA)</label>
      <input className="input mt-2" value={amountIn} onChange={(e) => setAmountIn(e.target.value)} />
      <label className="mt-4 block text-sm">Slippage tolerance (bps)</label>
      <input className="input mt-2" type="number" value={slippageBps} onChange={(e) => setSlippageBps(Number(e.target.value))} />
      <p className="mt-4 text-sm text-white/70">Estimated out: {quoteOut} TKB</p>
      <p className="text-sm text-white/50">Min received: {minOut} TKB</p>
      <button className="btn mt-6 w-full" disabled={!address || !deployment} onClick={handleSwap} type="button">
        Swap
      </button>
      {status && <p className="mt-3 text-sm text-cyan-300">{status}</p>}
    </div>
  );
}
