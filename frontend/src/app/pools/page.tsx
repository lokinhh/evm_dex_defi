'use client';

import { useEffect, useState } from 'react';
import { Contract, parseEther } from 'ethers';
import { loadDeployment } from '@/lib/config';
import { deadlineTimestamp } from '@/lib/swap';
import { useWallet } from '@/lib/wallet';
import { ERC20_ABI, ROUTER_ABI } from '@/lib/contracts';

export default function PoolsPage() {
  const { address, signer } = useWallet();
  const [deployment, setDeployment] = useState<Awaited<ReturnType<typeof loadDeployment>>>(null);
  const [amountA, setAmountA] = useState('10');
  const [amountB, setAmountB] = useState('10');
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadDeployment().then(setDeployment);
  }, []);

  async function addLiquidity() {
    if (!deployment || !signer || !address) return;
    try {
      const router = new Contract(deployment.contracts.DexRouter, ROUTER_ABI, signer);
      const tokenA = new Contract(deployment.contracts.TokenA, ERC20_ABI, signer);
      const tokenB = new Contract(deployment.contracts.TokenB, ERC20_ABI, signer);
      const a = parseEther(amountA);
      const b = parseEther(amountB);
      const minA = (a * 995n) / 1000n;
      const minB = (b * 995n) / 1000n;
      await (await tokenA.approve(deployment.contracts.DexRouter, a)).wait();
      await (await tokenB.approve(deployment.contracts.DexRouter, b)).wait();
      const tx = await router.addLiquidity(
        deployment.contracts.TokenA,
        deployment.contracts.TokenB,
        a,
        b,
        minA,
        minB,
        address,
        deadlineTimestamp(),
      );
      await tx.wait();
      setStatus('Liquidity added — LP tokens minted');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="card mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">Liquidity Pools</h1>
      <p className="mt-1 text-sm text-white/60">Router auto-creates the pair on first deposit.</p>
      <label className="mt-6 block text-sm">Token A amount</label>
      <input className="input mt-2" value={amountA} onChange={(e) => setAmountA(e.target.value)} />
      <label className="mt-4 block text-sm">Token B amount</label>
      <input className="input mt-2" value={amountB} onChange={(e) => setAmountB(e.target.value)} />
      <button className="btn mt-6 w-full" disabled={!address || !deployment} onClick={addLiquidity} type="button">
        Add Liquidity
      </button>
      {status && <p className="mt-3 text-sm text-cyan-300">{status}</p>}
    </div>
  );
}
