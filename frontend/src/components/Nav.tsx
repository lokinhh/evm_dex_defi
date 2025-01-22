import Link from 'next/link';
import { ConnectWallet } from './ConnectWallet';

const links = [
  { href: '/', label: 'Home' },
  { href: '/swap', label: 'Swap' },
  { href: '/pools', label: 'Pools' },
  { href: '/stake', label: 'Stake' },
];

export function Nav() {
  return (
    <header className="border-b border-white/10 bg-black/20 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold tracking-tight text-cyan-300">ChainDex</span>
          <nav className="hidden gap-4 sm:flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-white/80 hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <ConnectWallet />
      </div>
    </header>
  );
}
