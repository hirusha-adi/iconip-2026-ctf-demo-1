import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/chat');
  }

  return (
    <main className="flex flex-1 items-center">
      <div className="cyber-shell">
        <section className="cyber-card cyber-terminal p-8 sm:p-10">
          <p className="cyber-kicker">Unauthorized Access Portal</p>
          <h1 className="cyber-title cyber-title-glitch mt-3 text-4xl font-black leading-tight sm:text-6xl">
            Iconip 2026 CTF
          </h1>
          <p className="cyber-muted cyber-blink mt-4 max-w-3xl text-sm leading-7 sm:text-base">
            ICONIP 2026 is an international conference on neural information processing. This interface is a secure
            participant demo node for challenge communication and admin control.
          </p>
          <a className="cyber-link mt-5 inline-block text-sm" href="https://www.iconip2026.org/" target="_blank" rel="noreferrer">
            Learn more about ICONIP 2026
          </a>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="cyber-btn cyber-btn-solid" href="/login">
              Login
            </Link>
            <Link className="cyber-btn cyber-btn-secondary" href="/register">
              Register
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
