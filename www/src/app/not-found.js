import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center">
      <div className="cyber-shell-narrow">
        <section className="cyber-card cyber-terminal p-8 text-center">
          <p className="cyber-kicker">Signal Lost</p>
          <h1 className="cyber-title cyber-title-glitch mt-3 text-5xl font-black">404</h1>
          <p className="cyber-muted mt-3 text-sm">This page does not exist.</p>
          <Link className="cyber-btn cyber-btn-solid mt-6" href="/">
            Back home
          </Link>
        </section>
      </div>
    </main>
  );
}
