'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useSignIn } from '@clerk/nextjs';
import { ArrowLeft, KeyRound, LogIn, Mail, MailCheck, Shield, UserPlus } from 'lucide-react';
import { toast } from 'react-toastify';

const SECOND_FACTOR_METHOD = {
  TOTP: 'totp',
  BACKUP_CODE: 'backup_code',
  EMAIL_CODE: 'email_code',
};

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

function buildSecondFactorAvailability(factors) {
  const strategies = (factors || []).map((factor) => factor.strategy);
  return {
    [SECOND_FACTOR_METHOD.TOTP]: strategies.includes(SECOND_FACTOR_METHOD.TOTP),
    [SECOND_FACTOR_METHOD.BACKUP_CODE]: strategies.includes(SECOND_FACTOR_METHOD.BACKUP_CODE),
    [SECOND_FACTOR_METHOD.EMAIL_CODE]: strategies.includes(SECOND_FACTOR_METHOD.EMAIL_CODE),
  };
}

function getDefaultSecondFactorMethod(availability) {
  if (availability[SECOND_FACTOR_METHOD.TOTP]) {
    return SECOND_FACTOR_METHOD.TOTP;
  }

  if (availability[SECOND_FACTOR_METHOD.EMAIL_CODE]) {
    return SECOND_FACTOR_METHOD.EMAIL_CODE;
  }

  if (availability[SECOND_FACTOR_METHOD.BACKUP_CODE]) {
    return SECOND_FACTOR_METHOD.BACKUP_CODE;
  }

  return null;
}

function getSecondFactorPrompt(method) {
  if (method === SECOND_FACTOR_METHOD.BACKUP_CODE) {
    return 'Enter one of your backup codes.';
  }

  if (method === SECOND_FACTOR_METHOD.TOTP) {
    return 'Enter the code from your authenticator application.';
  }

  if (method === SECOND_FACTOR_METHOD.EMAIL_CODE) {
    return 'Enter the verification code sent to your email.';
  }

  return 'Enter your second-factor code.';
}

function getSecondFactorMethodIcon(method) {
  if (method === SECOND_FACTOR_METHOD.TOTP) {
    return <Shield size={14} />;
  }

  if (method === SECOND_FACTOR_METHOD.BACKUP_CODE) {
    return <KeyRound size={14} />;
  }

  return <Mail size={14} />;
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
  const [availableSecondFactors, setAvailableSecondFactors] = useState({
    [SECOND_FACTOR_METHOD.TOTP]: false,
    [SECOND_FACTOR_METHOD.BACKUP_CODE]: false,
    [SECOND_FACTOR_METHOD.EMAIL_CODE]: false,
  });
  const [secondFactorMethod, setSecondFactorMethod] = useState(SECOND_FACTOR_METHOD.TOTP);

  const isBusy = fetchStatus === 'fetching';
  const secondFactorOptions = useMemo(
    () =>
      [
        {
          key: SECOND_FACTOR_METHOD.TOTP,
          label: 'authenticator app',
          enabled: availableSecondFactors[SECOND_FACTOR_METHOD.TOTP],
        },
        {
          key: SECOND_FACTOR_METHOD.BACKUP_CODE,
          label: 'backup code',
          enabled: availableSecondFactors[SECOND_FACTOR_METHOD.BACKUP_CODE],
        },
        {
          key: SECOND_FACTOR_METHOD.EMAIL_CODE,
          label: 'email code',
          enabled: availableSecondFactors[SECOND_FACTOR_METHOD.EMAIL_CODE],
        },
      ].filter((option) => option.enabled),
    [availableSecondFactors],
  );

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
    const taskRoutes = {
      'setup-mfa': '/setup-mfa',
    };

    const { error: finalizeError } = await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        const taskDestination = session?.currentTask ? taskRoutes[session.currentTask.key] : null;
        const fallbackDestination = destination === '/setup-mfa' ? '/chat' : destination;
        const navigationTarget = taskDestination || fallbackDestination;

        const url = decorateUrl(navigationTarget);
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

  async function sendSecondFactorChallenge(method) {
    if (!signIn) {
      return;
    }

    if (method === SECOND_FACTOR_METHOD.EMAIL_CODE) {
      const response = await signIn.mfa.sendEmailCode();
      if (response.error) {
        throw new Error(getErrorMessage(response.error, 'Failed to send email code'));
      }

      setSecondFactorInfo('We sent a verification code to your email.');
      return;
    }

    setSecondFactorInfo(getSecondFactorPrompt(method));
  }

  async function moveToSecondFactorState() {
    if (!signIn) {
      return;
    }

    const availability = buildSecondFactorAvailability(signIn.supportedSecondFactors || []);
    const defaultMethod = getDefaultSecondFactorMethod(availability);

    if (!defaultMethod) {
      setError('No supported second-factor strategy is available for this account.');
      return;
    }

    setAvailableSecondFactors(availability);
    setSecondFactorMethod(defaultMethod);
    setSecondFactorCode('');
    setStage('second-factor');
    setSecondFactorInfo('');

    await sendSecondFactorChallenge(defaultMethod);
  }

  async function handleSecondFactorMethodChange(nextMethod) {
    if (!availableSecondFactors[nextMethod]) {
      return;
    }

    setError('');
    setSecondFactorMethod(nextMethod);
    setSecondFactorCode('');

    try {
      await sendSecondFactorChallenge(nextMethod);
      if (nextMethod === SECOND_FACTOR_METHOD.EMAIL_CODE) {
        toast.success('Verification code sent');
      }
    } catch (methodError) {
      setError(methodError.message || 'Failed to prepare second-factor verification');
    }
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

      if (signIn.status === 'needs_client_trust') {
        setError('Additional client trust verification is required. Complete the verification challenge and try again.');
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
      let response = null;
      const code = secondFactorCode.trim();

      if (secondFactorMethod === SECOND_FACTOR_METHOD.BACKUP_CODE) {
        response = await signIn.mfa.verifyBackupCode({ code });
      } else if (secondFactorMethod === SECOND_FACTOR_METHOD.TOTP) {
        response = await signIn.mfa.verifyTOTP({ code });
      } else if (secondFactorMethod === SECOND_FACTOR_METHOD.EMAIL_CODE) {
        response = await signIn.mfa.verifyEmailCode({ code });
      }

      if (response?.error) {
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

  async function resetToPasswordStage() {
    if (signIn) {
      await signIn.reset();
    }

    setStage('password');
    setSecondFactorCode('');
    setSecondFactorInfo('');
    setAvailableSecondFactors({
      [SECOND_FACTOR_METHOD.TOTP]: false,
      [SECOND_FACTOR_METHOD.BACKUP_CODE]: false,
      [SECOND_FACTOR_METHOD.EMAIL_CODE]: false,
    });
    setSecondFactorMethod(SECOND_FACTOR_METHOD.TOTP);
  }

  return (
    <section className="w-full px-1 sm:px-0">
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
            <LogIn size={16} />
            {isBusy ? 'Signing in...' : 'Login'}
          </button>
        </form>
      ) : (
        <form className="mt-5 space-y-5" onSubmit={handleSecondFactorSubmit}>
          <div className="space-y-2">
            <h2 className="cyber-title text-xl font-semibold text-foreground">Second factor verification</h2>
            <p className="cyber-muted text-sm">
              Second-factor verification is required.{' '}
              {secondFactorInfo ? (
                <>
                  {secondFactorInfo}{' '}
                </>
              ) : null}
              Default is <strong>Authenticator app</strong>. If needed, switch to <strong>Email code</strong> or
              <strong> Backup code</strong>.
            </p>
          </div>

          <div className="space-y-3">
            <div
              className="grid overflow-hidden rounded-2xl border border-[rgba(21,40,82,0.26)] shadow-[5px_5px_10px_rgb(163,177,198,0.35),-5px_-5px_10px_rgba(255,255,255,0.4)]"
              style={{ gridTemplateColumns: `repeat(${Math.max(secondFactorOptions.length, 1)}, minmax(0, 1fr))` }}
            >
              {secondFactorOptions.map((option, index) => (
                <button
                  key={option.key}
                  type="button"
                  className={`min-h-[48px] px-3 text-center text-base font-semibold capitalize transition-colors duration-300 ${index > 0 ? 'border-l border-[rgba(21,40,82,0.24)]' : ''} ${secondFactorMethod === option.key ? 'bg-[rgba(42,76,138,0.18)] text-[#152852]' : 'bg-transparent text-[rgba(61,72,82,0.92)] hover:bg-[rgba(42,76,138,0.08)]'}`}
                  onClick={() => handleSecondFactorMethodChange(option.key)}
                >
                  <span className="mr-2 inline-flex align-middle">{getSecondFactorMethodIcon(option.key)}</span>
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="cyber-label" htmlFor="secondFactorCode">
            <span className="sr-only">Verification code</span>
            <div className="cyber-input-wrap">
              <input
                id="secondFactorCode"
                type="text"
                className="cyber-input"
                value={secondFactorCode}
                onChange={(event) => setSecondFactorCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </div>
          </label>

          <div className="flex items-stretch gap-2">
            <button
              type="submit"
              className="cyber-btn cyber-btn-solid w-full flex-1"
              disabled={isBusy || !secondFactorCode.trim()}
            >
              <KeyRound size={16} />
              {isBusy ? 'Verifying...' : 'Verify code'}
            </button>

            <button
              type="button"
              className="cyber-btn cyber-btn-outline !h-[44px] !min-h-0 !w-[64px] !px-0 text-2xl leading-none"
              onClick={resetToPasswordStage}
              aria-label="Back to password"
              title="Back to password"
            >
              <ArrowLeft size={18} />
            </button>
          </div>
        </form>
      )}

      {canResend ? (
        <button
          type="button"
          className="cyber-link mt-3 text-sm"
          onClick={handleResendVerification}
        >
          <MailCheck size={14} className="mr-1 inline" />
          Resend verification email
        </button>
      ) : null}

      <p className="cyber-muted mt-4 text-sm">
        Need an account?{' '}
        <Link className="cyber-link" href="/register">
          <UserPlus size={14} className="mr-1 inline" />
          Register
        </Link>
      </p>
    </section>
  );
}
