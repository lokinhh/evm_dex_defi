'use client';

import { useEffect, useState } from 'react';
import { Contract, formatEther, parseEther } from 'ethers';
import { loadDeployment } from '@/lib/config';
import { useWallet } from '@/lib/wallet';
import { ERC20_ABI, FARM_ABI } from '@/lib/contracts';

export default function StakePage() {
  const { address, signer } = useWallet();
  const [deployment, setDeployment] = useState<Awaited<ReturnType<typeof loadDeployment>>>(null);
  const [pending, setPending] = useState('0');

  useEffect(() => {
    loadDeployment().then(setDeployment);
  }, []);

  useEffect(() => {
    async function load() {
      if (!deployment?.contracts.RewardFarm || !address || !signer) return;
      const farm = new Contract(deployment.contracts.RewardFarm, FARM_ABI, signer);
      const value = await farm.pendingReward(0, address);
      setPending(formatEther(value));
    }
    load();
  }, [deployment, address, signer]);

  async function stake() {
    if (!deployment || !signer) return;
    const amount = parseEther('0.1');
    const pair = new Contract(deployment.contracts.Pair, ERC20_ABI, signer);
    const farm = new Contract(deployment.contracts.RewardFarm, FARM_ABI, signer);
    await (await pair.approve(deployment.contracts.RewardFarm, amount)).wait();
    await (await farm.deposit(0, amount)).wait();
  }

  async function harvest() {
    if (!deployment || !signer) return;
    const farm = new Contract(deployment.contracts.RewardFarm, FARM_ABI, signer);
    await (await farm.harvest(0)).wait();
  }

  return (
    <div className="card mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">LP Staking</h1>
      <p className="mt-1 text-sm text-white/60">Rewards paid from pre-funded CDX pool (no mint).</p>
      <p className="mt-6 text-sm">Pending: {pending} CDX</p>
      <div className="mt-6 flex gap-3">
        <button className="btn" disabled={!address || !deployment} onClick={stake} type="button">
          Stake 0.1 LP
        </button>
        <button className="btn" disabled={!address || !deployment} onClick={harvest} type="button">
          Harvest
        </button>
      </div>
    </div>
  );
}
