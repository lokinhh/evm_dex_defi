'use client';

import { WalletProvider } from '@/lib/wallet';
import { Nav } from '@/components/Nav';
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <Nav />
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
