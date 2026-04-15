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
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="cyber-kicker">Conference Portal</p>
              <h1 className="cyber-title cyber-title-glitch mt-3 text-4xl font-black leading-tight sm:text-6xl">
                ICONIP 2026
              </h1>
              <p className="cyber-muted cyber-blink mt-4 max-w-3xl text-sm leading-7 sm:text-base">
                ICONIP 2026 is an international conference focused on neural information processing, machine learning,
                and intelligent systems. It brings together researchers, engineers, and students to share new methods,
                applied research, and practical advances across AI, data science, and computational neuroscience.
              </p>
              <a
                className="cyber-link mt-5 inline-block text-sm"
                href="https://www.iconip2026.org/"
                target="_blank"
                rel="noreferrer"
              >
                Visit the official ICONIP 2026 website
              </a>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="cyber-btn cyber-btn-solid" href="/login">
                  Login
                </Link>
                <Link className="cyber-btn cyber-btn-secondary" href="/register">
                  Register
                </Link>
              </div>
            </div>

            <div className="mx-auto w-full max-w-md lg:max-w-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://www.iconip2026.org/assets/images/ICONIP2026_Menu.svg"
                alt="ICONIP 2026 official logo"
                className="h-auto w-full object-contain drop-shadow-[0_16px_28px_rgba(21,40,82,0.16)]"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
