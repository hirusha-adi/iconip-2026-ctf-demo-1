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
        await finishLogin();
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
    <div className="cyber-card cyber-terminal w-full p-6">
      <p className="cyber-kicker">User Authentication</p>
      <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Login</h1>
      <p className="cyber-muted mt-1 text-sm">Sign in to continue to chat.</p>

      {verifiedMessage ? <p className="cyber-note cyber-note-success mt-4">{verifiedMessage}</p> : null}
      {error ? <p className="cyber-note cyber-note-error mt-4">{error}</p> : null}

      {stage === 'password' ? (
        <form className="mt-4 space-y-4" onSubmit={handlePasswordSubmit}>
          <label className="cyber-label" htmlFor="email">
            Email
            <div className="cyber-input-wrap">
              <input
                id="email"
                type="email"
                className="cyber-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </label>

          <label className="cyber-label" htmlFor="password">
            Password
            <div className="cyber-input-wrap">
              <input
                id="password"
                type="password"
                className="cyber-input"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
          </label>

          <div className="flex justify-end">
            <Link className="cyber-link text-xs" href="/forgot-password">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="cyber-btn cyber-btn-solid w-full"
            disabled={isBusy}
          >
            {isBusy ? 'Signing in...' : 'Login'}
          </button>
        </form>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={handleSecondFactorSubmit}>
          <p className="cyber-note cyber-note-info">Email verification code is required.</p>
          {secondFactorInfo ? <p className="cyber-muted text-xs">{secondFactorInfo}</p> : null}

          <label className="cyber-label" htmlFor="secondFactorCode">
            Code
            <div className="cyber-input-wrap">
              <input
                id="secondFactorCode"
                type="text"
                className="cyber-input"
                value={secondFactorCode}
                onChange={(event) => setSecondFactorCode(event.target.value)}
                required
              />
            </div>
          </label>

          <button
            type="button"
            className="cyber-link text-xs"
            onClick={resendSecondFactorEmailCode}
          >
            Resend verification code
          </button>

          <button
            type="submit"
            className="cyber-btn cyber-btn-solid w-full"
            disabled={isBusy || !secondFactorCode.trim()}
          >
            {isBusy ? 'Verifying...' : 'Verify code'}
          </button>

          <button
            type="button"
            className="cyber-btn cyber-btn-outline w-full"
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
          className="cyber-link mt-3 text-sm"
          onClick={handleResendVerification}
        >
          Resend verification email
        </button>
      ) : null}

      <p className="cyber-muted mt-4 text-sm">
        Need an account?{' '}
        <Link className="cyber-link" href="/register">
          Register
        </Link>
      </p>
    </div>
  );
}
