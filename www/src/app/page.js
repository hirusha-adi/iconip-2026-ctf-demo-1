import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect('/chat');
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-zinc-900 sm:text-7xl">ICOPNIC 2026: CTF</h1>
      <p className="mt-6 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
        ICONIP 2026 is an international conference on neural information processing. This site is a minimal CTF
        demo platform for participant interaction and administration.
      </p>
      <a
        className="mt-3 text-sm text-green-700 hover:underline"
        href="https://www.iconip2026.org/"
        target="_blank"
        rel="noreferrer"
      >
        Learn more about ICONIP 2026
      </a>

      <div className="mt-8 flex gap-3">
        <Link className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700" href="/login">
          Login
        </Link>
        <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100" href="/register">
          Register
        </Link>
      </div>
    </main>
  );
}
