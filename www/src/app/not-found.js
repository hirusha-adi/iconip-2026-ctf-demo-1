import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-4xl font-bold text-zinc-900">404</h1>
      <p className="mt-2 text-sm text-zinc-600">This page does not exist.</p>
      <Link className="mt-5 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700" href="/">
        Back home
      </Link>
    </main>
  );
}
