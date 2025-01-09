export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="card">
        <p className="text-sm uppercase tracking-widest text-cyan-300">EVM DEX + DeFi</p>
        <h1 className="mt-2 text-4xl font-bold">ChainDex</h1>
        <p className="mt-4 max-w-2xl text-white/70">
          Decentralized exchange with automated market maker liquidity pools, swap routing, and LP
          token staking rewards. Deployed for Ethereum (Sepolia) and BNB Smart Chain (testnet).
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-indigo-500/20 px-3 py-1">Solidity 0.8.24</span>
          <span className="rounded-full bg-indigo-500/20 px-3 py-1">Uniswap V2-style AMM</span>
          <span className="rounded-full bg-indigo-500/20 px-3 py-1">0.3% swap fee</span>
          <span className="rounded-full bg-indigo-500/20 px-3 py-1">LP Reward Farm</span>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: 'Swap', desc: 'Trade tokens through liquidity pools with slippage protection.' },
          { title: 'Liquidity', desc: 'Add/remove liquidity and receive LP tokens representing your share.' },
          { title: 'Stake', desc: 'Stake LP tokens in the reward farm to earn CDX governance rewards.' },
        ].map((item) => (
          <article key={item.title} className="card">
            <h2 className="text-xl font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-white/65">{item.desc}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
