import Link from 'next/link';
import { House } from 'lucide-react';

import PublicHeader from '@/components/PublicHeader';

export default function Custom404Page() {
  return (
    <main className="flex flex-1">
      <div className="cyber-page-shell">
        <PublicHeader />

        <section className="cyber-page-content max-w-2xl">
          <section className="cyber-card cyber-terminal p-8 text-center">
            <p className="cyber-kicker">Signal Lost</p>
            <h1 className="cyber-title cyber-title-glitch mt-3 text-5xl font-black">404</h1>
            <p className="cyber-muted mt-3 text-sm">This page does not exist.</p>
            <Link className="cyber-btn cyber-btn-solid mt-6" href="/">
              <House size={16} />
              Back home
            </Link>
          </section>
        </section>
      </div>
    </main>
  );
}
