'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useSignIn } from '@clerk/nextjs';
import { toast } from 'react-toastify';

const MFA_EMAIL_CODE = 'email_code';

function isClerkTestEmail(value) {
  if (!value) {
    return false;
  }

  return value.toLowerCase().includes('+clerk_test@');
}

function getErrorMessage(error, fallback) {
  if (!error) {
    return fallback;
  }

  if (error.longMessage) {
    return error.longMessage;
  }

  if (error.message) {
    return error.message;
  }

  if (Array.isArray(error.errors) && error.errors.length) {
    return error.errors[0]?.longMessage || error.errors[0]?.message || fallback;
  }

  return fallback;
}

function supportsEmailSecondFactor(factors) {
  return (factors || []).some((factor) => factor.strategy === MFA_EMAIL_CODE);
}

export default function LoginForm({ initialMessage = '', nextPath = '' }) {
  const router = useRouter();
  const { signIn, fetchStatus } = useSignIn();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialMessage);
  const [canResend, setCanResend] = useState(false);

  const [stage, setStage] = useState('password');
  const [secondFactorCode, setSecondFactorCode] = useState('');
  const [secondFactorInfo, setSecondFactorInfo] = useState('');

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

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend verification email');
      }

      toast.success('Verification email sent');
      setCanResend(false);
    } catch (resendError) {
      toast.error(resendError.message || 'Failed to resend verification email');
    }
  }

  async function finishLogin() {
    if (!signIn) {
      return;
    }

    const destination = nextPath || '/chat';

    const { error: finalizeError } = await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl(destination);
        if (url.startsWith('http')) {
          window.location.href = url;
          return;
        }

        router.push(url);
      },
    });

    if (finalizeError) {
      setError(getErrorMessage(finalizeError, 'Failed to finalize sign in'));
      return;
    }

    await fetch('/api/auth/login-audit', {
      method: 'POST',
    });
  }

  async function sendSecondFactorCode() {
    if (!signIn) {
      return;
    }

    const { error: sendError } = await signIn.mfa.sendEmailCode();
    if (sendError) {
      throw new Error(getErrorMessage(sendError, 'Failed to send second-factor code'));
    }

    if (isClerkTestEmail(email)) {
      console.log('[dev][login][mfa] Clerk test email OTP code: 424242');
    } else {
      console.log('[dev][login][mfa] OTP email sent. Clerk does not expose the real OTP code to app code.');
    }

    setSecondFactorInfo('We sent a verification code to your email. Enter it below.');
  }

  async function moveToSecondFactorState() {
    if (!signIn) {
      return;
    }

    const factors = signIn.supportedSecondFactors || [];

    if (!supportsEmailSecondFactor(factors)) {
      setError('Email second-factor is required, but this account does not have email MFA available.');
      return;
    }

    setStage('second-factor');
    setSecondFactorCode('');
    setSecondFactorInfo('');

    await sendSecondFactorCode();
  }

  async function handlePasswordSubmit(event) {
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
        setError(getErrorMessage(signInError, 'Invalid credentials'));
        return;
      }

      if (signIn.status === 'needs_second_factor') {
        await moveToSecondFactorState();
        return;
      }

      if (signIn.status === 'complete') {
        setError('Email MFA is required. Enable email second-factor in Clerk to complete login.');
        return;
      }

      setError('Login could not be completed. Please try again.');
    } catch (submitError) {
      setError(submitError.message || 'Failed to sign in');
    }
  }

  async function handleSecondFactorSubmit(event) {
    event.preventDefault();
    setError('');

    if (!signIn || !secondFactorCode.trim()) {
      return;
    }

    try {
      const response = await signIn.mfa.verifyEmailCode({ code: secondFactorCode.trim() });
      if (response.error) {
        setError(getErrorMessage(response.error, 'Second-factor verification failed'));
        return;
      }

      if (signIn.status === 'complete') {
        await finishLogin();
        return;
      }

      setError('Second-factor verification did not complete. Please try again.');
    } catch (submitError) {
      setError(submitError.message || 'Failed to verify second factor');
    }
  }

  async function resendSecondFactorEmailCode() {
    setError('');
    try {
      await sendSecondFactorCode();
      toast.success('Verification code sent');
    } catch (sendError) {
      setError(sendError.message || 'Failed to resend verification code');
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-zinc-900">Login</h1>
      <p className="mt-1 text-sm text-zinc-600">Sign in to continue to chat.</p>

      {verifiedMessage ? <p className="mt-4 text-sm text-green-700">{verifiedMessage}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {stage === 'password' ? (
        <form className="mt-4 space-y-4" onSubmit={handlePasswordSubmit}>
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
      ) : (
        <form className="mt-4 space-y-4" onSubmit={handleSecondFactorSubmit}>
          <p className="text-sm text-zinc-600">Email verification code is required.</p>
          {secondFactorInfo ? <p className="text-xs text-zinc-500">{secondFactorInfo}</p> : null}

          <label className="block text-sm text-zinc-700" htmlFor="secondFactorCode">
            Code
            <input
              id="secondFactorCode"
              type="text"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
              value={secondFactorCode}
              onChange={(event) => setSecondFactorCode(event.target.value)}
              required
            />
          </label>

          <button
            type="button"
            className="text-xs font-medium text-green-700 hover:text-green-800"
            onClick={resendSecondFactorEmailCode}
          >
            Resend verification code
          </button>

          <button
            type="submit"
            className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isBusy || !secondFactorCode.trim()}
          >
            {isBusy ? 'Verifying...' : 'Verify code'}
          </button>

          <button
            type="button"
            className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
            onClick={async () => {
              if (signIn) {
                await signIn.reset();
              }

              setStage('password');
              setSecondFactorCode('');
              setSecondFactorInfo('');
            }}
          >
            Back to password
          </button>
        </form>
      )}

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
        Need an account?{' '}
        <Link className="text-green-700 hover:underline" href="/register">
          Register
        </Link>
      </p>
    </div>
  );
}
