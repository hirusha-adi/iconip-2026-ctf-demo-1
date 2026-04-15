'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { ArrowRight, BookOpen, ChevronDown, Compass, Gift, Home, Trophy } from 'lucide-react';

function getNavClass(activeKey, key, inactiveClass) {
  return activeKey === key ? 'cyber-btn cyber-btn-solid' : `cyber-btn ${inactiveClass}`;
}

function groupedButtonClass(active, keys) {
  return keys.includes(active)
    ? 'cyber-btn cyber-btn-solid'
    : 'cyber-btn cyber-btn-secondary';
}

export default function PublicHeader({ active = '' }) {
  const exploreRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (exploreRef.current?.open && !exploreRef.current.contains(event.target)) {
        exploreRef.current.open = false;
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  return (
    <header className="cyber-page-header">
      <div>
        <p className="cyber-page-subtitle">Welcome</p>
        <p className="cyber-page-title !text-[1.1rem]">ICONIP2026 CTF</p>
        <p className="cyber-kicker mt-1">CTF Demo Portal</p>
      </div>

      <nav className="cyber-page-actions" aria-label="Primary navigation">
        <Link className={getNavClass(active, 'home', 'cyber-btn-outline')} href="/">
          <Home size={16} />
          Home
        </Link>

        <details ref={exploreRef} className="group relative">
          <summary
            className={`${groupedButtonClass(active, ['leaderboards', 'guide', 'prizes'])} list-none [&::-webkit-details-marker]:hidden`}
          >
            <Compass size={16} />
            Explore
            <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-[rgba(21,40,82,0.2)] bg-[var(--surface-elevated)] p-1 shadow-[0_12px_22px_rgba(20,40,82,0.14)]">
            <Link className={`cyber-btn w-full justify-start ${active === 'leaderboards' ? 'cyber-btn-solid' : 'cyber-btn-outline'}`} href="/leaderboards">
              <Trophy size={15} />
              Leaderboards
            </Link>
            <Link className={`cyber-btn mt-1 w-full justify-start ${active === 'guide' ? 'cyber-btn-solid' : 'cyber-btn-outline'}`} href="/guide">
              <BookOpen size={15} />
              Guide
            </Link>
            <Link className={`cyber-btn mt-1 w-full justify-start ${active === 'prizes' ? 'cyber-btn-solid' : 'cyber-btn-outline'}`} href="/prizes">
              <Gift size={15} />
              Prizes
            </Link>
          </div>
        </details>

        <Link className="cyber-btn cyber-btn-chat" href="/login?next=/chat">
          Begin
          <ArrowRight size={16} />
        </Link>
      </nav>
    </header>
  );
}
