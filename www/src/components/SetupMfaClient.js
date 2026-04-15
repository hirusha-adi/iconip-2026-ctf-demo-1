'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { CheckCircle2, Copy, Download, LogIn, MessageSquare, RefreshCw, ShieldOff } from 'lucide-react';
import { toast } from 'react-toastify';

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

function buildBackupCodesText(codes) {
  return [
    'ICONIP 2026 - Backup Codes',
    `Generated at: ${new Date().toISOString()}`,
    '',
    ...codes,
    '',
    'Each backup code can be used once.',
    'Store these securely.',
  ].join('\n');
}

function triggerDownload(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

export default function SetupMfaClient() {
  const { isLoaded, user } = useUser();

  const [totpResource, setTotpResource] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);

  const [initializing, setInitializing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [verifiedNow, setVerifiedNow] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user || user.totpEnabled || totpResource || initializing) {
      return;
    }

    setInitializing(true);
    setError('');

    user
      .createTOTP()
      .then((totp) => {
        setTotpResource(totp);
      })
      .catch((setupError) => {
        setError(getErrorMessage(setupError, 'Failed to initialize authenticator setup'));
      })
      .finally(() => {
        setInitializing(false);
      });
  }, [initializing, isLoaded, totpResource, user]);

  async function handleVerifyTotp(event) {
    event.preventDefault();

    if (!user || !totpCode.trim()) {
      return;
    }

    setVerifying(true);
    setError('');

    try {
      await user.verifyTOTP({ code: totpCode.trim() });
      await user.reload();

      const backupCodeResource = await user.createBackupCode();
      const codes = Array.isArray(backupCodeResource?.codes) ? backupCodeResource.codes : [];

      if (!codes.length) {
        throw new Error('MFA was enabled, but backup codes were not returned');
      }

      setBackupCodes(codes);
      setVerifiedNow(true);
      setTotpCode('');
      toast.success('Authenticator verified. Backup codes generated.');
    } catch (verifyError) {
      setError(getErrorMessage(verifyError, 'Verification failed. Please try again with a fresh code.'));
    } finally {
      setVerifying(false);
    }
  }

  async function generateBackupCodes() {
    if (!user || busy) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const backupCodeResource = await user.createBackupCode();
      const codes = Array.isArray(backupCodeResource?.codes) ? backupCodeResource.codes : [];

      if (!codes.length) {
        throw new Error('No backup codes were returned');
      }

      setBackupCodes(codes);
      toast.success('Backup codes generated');
    } catch (backupError) {
      setError(getErrorMessage(backupError, 'Failed to generate backup codes'));
    } finally {
      setBusy(false);
    }
  }

  async function handleStartOver() {
    if (!user || busy) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await user.disableTOTP();
      await user.reload();

      setTotpResource(null);
      setTotpCode('');
      setBackupCodes([]);
      setVerifiedNow(false);
      toast.success('Authenticator MFA disabled. Start setup again below.');
    } catch (disableError) {
      setError(getErrorMessage(disableError, 'Failed to disable authenticator MFA'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyBackupCodes() {
    if (!backupCodes.length) {
      return;
    }

    try {
      await navigator.clipboard.writeText(buildBackupCodesText(backupCodes));
      toast.success('Backup codes copied');
    } catch {
      toast.error('Failed to copy backup codes');
    }
  }

  function handleDownloadBackupCodes() {
    if (!backupCodes.length) {
      return;
    }

    triggerDownload('iconip-2026-backup-codes.txt', buildBackupCodesText(backupCodes));
    toast.success('Backup codes downloaded');
  }

  if (!isLoaded) {
    return (
      <div className="cyber-card cyber-terminal w-full p-6">
        <p className="cyber-kicker">Multi-factor Authentication</p>
        <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Set up authenticator app</h1>
        <p className="cyber-muted mt-2 text-sm">Loading account state...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="cyber-card cyber-terminal w-full p-6">
        <p className="cyber-kicker">Multi-factor Authentication</p>
        <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Sign in required</h1>
        <p className="cyber-muted mt-2 text-sm">Please sign in before configuring MFA.</p>
        <Link className="cyber-btn cyber-btn-solid mt-5" href="/login">
          <LogIn size={16} />
          Go to login
        </Link>
      </div>
    );
  }

  if (user.totpEnabled && !verifiedNow && !backupCodes.length) {
    return (
      <div className="cyber-card cyber-terminal w-full p-6">
        <p className="cyber-kicker">Authenticator MFA</p>
        <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Authenticator is already enabled</h1>
        <p className="cyber-muted mt-2 text-sm">
          You can regenerate backup codes, or disable authenticator MFA and start over from the beginning.
        </p>

        {error ? <p className="cyber-note cyber-note-error mt-4">{error}</p> : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="cyber-btn cyber-btn-secondary" onClick={generateBackupCodes} disabled={busy}>
            <RefreshCw size={16} />
            {busy ? 'Working...' : 'Generate backup codes'}
          </button>
          <button type="button" className="cyber-btn cyber-btn-danger" onClick={handleStartOver} disabled={busy}>
            <ShieldOff size={16} />
            {busy ? 'Working...' : 'Disable and start over'}
          </button>
          <Link className="cyber-btn cyber-btn-solid" href="/chat">
            <MessageSquare size={16} />
            Continue to chat
          </Link>
        </div>
      </div>
    );
  }

  if (backupCodes.length) {
    return (
      <div className="cyber-card cyber-terminal w-full p-6">
        <p className="cyber-kicker">Backup Codes</p>
        <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Save these now</h1>
        <p className="cyber-muted mt-2 text-sm">
          If your authenticator app is unavailable, you can use these backup codes to sign in.
        </p>

        <div className="cyber-note mt-4">
          <ul className="space-y-1 text-sm">
            {backupCodes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="cyber-btn cyber-btn-secondary" onClick={handleDownloadBackupCodes}>
            <Download size={16} />
            Download codes
          </button>
          <button type="button" className="cyber-btn cyber-btn-outline" onClick={handleCopyBackupCodes}>
            <Copy size={16} />
            Copy codes
          </button>
          <button type="button" className="cyber-btn cyber-btn-outline" onClick={generateBackupCodes} disabled={busy}>
            <RefreshCw size={16} />
            {busy ? 'Working...' : 'Regenerate codes'}
          </button>
          <button type="button" className="cyber-btn cyber-btn-danger" onClick={handleStartOver} disabled={busy}>
            <ShieldOff size={16} />
            {busy ? 'Working...' : 'Disable and start over'}
          </button>
          <Link className="cyber-btn cyber-btn-solid" href="/chat">
            <MessageSquare size={16} />
            Continue to chat
          </Link>
        </div>
      </div>
    );
  }

  if (initializing || !totpResource) {
    return (
      <div className="cyber-card cyber-terminal w-full p-6">
        <p className="cyber-kicker">Multi-factor Authentication</p>
        <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Set up authenticator app</h1>
        <p className="cyber-muted mt-2 text-sm">Preparing QR and manual setup key...</p>
        {error ? <p className="cyber-note cyber-note-error mt-4">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="cyber-card cyber-terminal w-full p-6">
      <p className="cyber-kicker">Step 1</p>
      <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Set up authenticator app</h1>
      <p className="cyber-muted mt-2 text-sm">
        Scan the QR code (or enter the setup key manually), then enter a 6-digit code from your authenticator app.
      </p>

      {totpResource.uri ? (
        <div className="mt-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(totpResource.uri)}`}
            alt="Authenticator app QR code"
            className="h-[220px] w-[220px] rounded-xl border border-[rgba(61,72,82,0.15)]"
          />
        </div>
      ) : null}

      {totpResource.secret ? (
        <div className="cyber-note mt-4">
          <p className="text-xs font-semibold">Manual setup key</p>
          <p className="mt-1 break-all text-sm">
            <code>{totpResource.secret}</code>
          </p>
        </div>
      ) : null}

      {error ? <p className="cyber-note cyber-note-error mt-4">{error}</p> : null}

      <form className="mt-4 space-y-4" onSubmit={handleVerifyTotp}>
        <label className="cyber-label" htmlFor="totpCode">
          Authenticator code
          <div className="cyber-input-wrap">
            <input
              id="totpCode"
              type="text"
              className="cyber-input"
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </div>
        </label>

        <button type="submit" className="cyber-btn cyber-btn-solid w-full" disabled={verifying || !totpCode.trim()}>
          <CheckCircle2 size={16} />
          {verifying ? 'Verifying...' : 'Verify and continue'}
        </button>
      </form>
    </div>
  );
}
