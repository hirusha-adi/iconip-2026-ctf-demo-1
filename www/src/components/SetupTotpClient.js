'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { toast } from 'react-toastify';

function formatCodes(codes) {
  if (!Array.isArray(codes)) {
    return '';
  }

  return codes.join('\n');
}

export default function SetupTotpClient({ verifiedMessage = '' }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();

  const [totpSecret, setTotpSecret] = useState('');
  const [totpUri, setTotpUri] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasVerifiedCode, setHasVerifiedCode] = useState(false);
  const [error, setError] = useState('');

  const backupCodesText = useMemo(() => formatCodes(backupCodes), [backupCodes]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      return;
    }

    if (user.totpEnabled) {
      setHasVerifiedCode(true);
      return;
    }

    let cancelled = false;

    async function prepareTotp() {
      setIsPreparing(true);
      setError('');

      try {
        const resource = await user.createTOTP();
        if (cancelled) {
          return;
        }

        setTotpSecret(resource?.secret || '');
        setTotpUri(resource?.uri || '');
      } catch (prepareError) {
        if (cancelled) {
          return;
        }

        setError(prepareError?.errors?.[0]?.longMessage || prepareError?.message || 'Failed to prepare TOTP setup');
      } finally {
        if (!cancelled) {
          setIsPreparing(false);
        }
      }
    }

    prepareTotp();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, user]);

  async function handleVerifyCode(event) {
    event.preventDefault();

    if (!user || !verificationCode.trim()) {
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const resource = await user.verifyTOTP({ code: verificationCode.trim() });
      await user.reload();

      if (!resource?.verified && !user.totpEnabled) {
        setError('Verification did not complete. Please try again.');
        return;
      }

      setHasVerifiedCode(true);
      setVerificationCode('');

      if (Array.isArray(resource?.backupCodes) && resource.backupCodes.length > 0) {
        setBackupCodes(resource.backupCodes);
      } else {
        const backupResource = await user.createBackupCode();
        setBackupCodes(backupResource?.codes || []);
      }

      toast.success('Authenticator app is now enabled');
    } catch (verifyError) {
      setError(verifyError?.errors?.[0]?.longMessage || verifyError?.message || 'Invalid verification code');
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleRegenerateBackupCodes() {
    if (!user) {
      return;
    }

    try {
      const backupResource = await user.createBackupCode();
      setBackupCodes(backupResource?.codes || []);
      toast.success('Generated new backup codes');
    } catch (codesError) {
      toast.error(codesError?.errors?.[0]?.longMessage || codesError?.message || 'Failed to generate backup codes');
    }
  }

  if (!isLoaded) {
    return <p className="text-sm text-zinc-500">Loading...</p>;
  }

  if (!isSignedIn || !user) {
    return (
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Set up 2FA</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {verifiedMessage || 'Your email is verified. Sign in first, then complete TOTP setup.'}
        </p>
        <Link
          className="mt-4 inline-block rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          href="/login?next=/setup-totp"
        >
          Go to login
        </Link>
      </div>
    );
  }

  if (user.totpEnabled && hasVerifiedCode) {
    return (
      <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">2FA setup complete</h1>
        {verifiedMessage ? <p className="mt-2 text-sm text-green-700">{verifiedMessage}</p> : null}
        <p className="mt-2 text-sm text-zinc-600">You can now continue using the app.</p>

        {backupCodes.length ? (
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-700">Backup codes (store safely)</p>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-700">{backupCodesText}</pre>
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            onClick={handleRegenerateBackupCodes}
          >
            Re-generate backup codes
          </button>
          <button
            type="button"
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
            onClick={() => router.push('/chat')}
          >
            Continue to chat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-zinc-900">Set up Authenticator App (TOTP)</h1>
      {verifiedMessage ? <p className="mt-2 text-sm text-green-700">{verifiedMessage}</p> : null}
      <p className="mt-2 text-sm text-zinc-600">
        Scan the `otpauth://` URI with your authenticator app or manually enter the secret, then verify one code.
      </p>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-4 space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
        <div>
          <p className="text-xs font-medium text-zinc-500">Secret</p>
          <p className="break-all font-mono">{totpSecret || (isPreparing ? 'Generating...' : '-')}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-zinc-500">URI</p>
          <p className="break-all font-mono text-xs">{totpUri || (isPreparing ? 'Generating...' : '-')}</p>
        </div>
      </div>

      <form className="mt-4" onSubmit={handleVerifyCode}>
        <label className="block text-sm text-zinc-700" htmlFor="verificationCode">
          Verification code
          <input
            id="verificationCode"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
            value={verificationCode}
            onChange={(event) => setVerificationCode(event.target.value)}
            placeholder="123456"
            required
          />
        </label>

        <button
          type="submit"
          className="mt-3 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPreparing || isVerifying || !verificationCode.trim()}
        >
          {isVerifying ? 'Verifying...' : 'Verify and enable TOTP'}
        </button>
      </form>
    </div>
  );
}
