'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useSignIn } from '@clerk/nextjs';
import { toast } from 'react-toastify';

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export default function LoginForm({ initialMessage = '' }) {
  const router = useRouter();
  const { signIn, fetchStatus } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialMessage);
  const [canResend, setCanResend] = useState(false);

  const isBusy = fetchStatus === 'fetching';

  const verifiedMessage = useMemo(() => {
    if (initialMessage) {
      return initialMessage;
    }

    return '';
  }, [initialMessage]);

  async function handleResendVerification() {
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      await parseResponse(response);
      toast.success('Verification email sent');
      setCanResend(false);
    } catch (resendError) {
      toast.error(resendError.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setCanResend(false);

    try {
      if (!signIn) {
        setError('Authentication is still initializing. Please try again.');
        return;
      }

      const precheckResponse = await fetch('/api/auth/prelogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!precheckResponse.ok) {
        const payload = await precheckResponse.json().catch(() => ({}));
        setError(payload.message || payload.error || 'Login blocked');

        if (payload.reason === 'unverified') {
          setCanResend(true);
        }

        return;
      }

      const { error: signInError } = await signIn.password({
        emailAddress: email,
        password,
      });

      if (signInError) {
        setError(signInError.longMessage || signInError.message || 'Invalid credentials');
        return;
      }

      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) {
              setError('Additional verification is required before continuing.');
              return;
            }

            const url = decorateUrl('/chat');
            if (url.startsWith('http')) {
              window.location.href = url;
              return;
            }

            router.push(url);
          },
        });

        await fetch('/api/auth/login-audit', {
          method: 'POST',
        });

        return;
      }

      setError('Login could not be completed. Please try again.');
    } catch (submitError) {
      setError(submitError.message || 'Failed to sign in');
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-zinc-900">Login</h1>
      <p className="mt-1 text-sm text-zinc-600">Sign in to continue to chat.</p>

      {verifiedMessage ? <p className="mt-4 text-sm text-green-700">{verifiedMessage}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm text-zinc-700" htmlFor="email">
          Email
          <input
            id="email"
            type="email"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block text-sm text-zinc-700" htmlFor="password">
          Password
          <input
            id="password"
            type="password"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
        >
          {isBusy ? 'Signing in...' : 'Login'}
        </button>
      </form>

      {canResend ? (
        <button
          type="button"
          className="mt-3 text-sm font-medium text-green-700 hover:text-green-800"
          onClick={handleResendVerification}
        >
          Resend verification email
        </button>
      ) : null}

      <p className="mt-4 text-sm text-zinc-600">
        Need an account? <Link className="text-green-700 hover:underline" href="/register">Register</Link>
      </p>
    </div>
  );
}
