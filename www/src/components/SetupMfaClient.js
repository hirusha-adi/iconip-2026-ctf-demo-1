'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TaskSetupMFA, useSession, useUser } from '@clerk/nextjs';
import { toast } from 'react-toastify';

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
  const { isLoaded: isSessionLoaded, session } = useSession();
  const { isLoaded: isUserLoaded, user } = useUser();
  const searchParams = useSearchParams();
  const justCompletedTask = searchParams.get('mfa') === 'configured';

  const [backupCodes, setBackupCodes] = useState([]);
  const [busy, setBusy] = useState(false);

  const canGenerateBackupCodes = useMemo(() => {
    if (!isUserLoaded || !user) {
      return false;
    }

    return Boolean(user.totpEnabled);
  }, [isUserLoaded, user]);

  const shouldPromptBackupCodes = useMemo(() => {
    if (!isUserLoaded || !user) {
      return false;
    }

    if (!user.totpEnabled) {
      return false;
    }

    if (backupCodes.length > 0) {
      return true;
    }

    if (justCompletedTask) {
      return true;
    }

    return !user.backupCodeEnabled;
  }, [backupCodes.length, isUserLoaded, justCompletedTask, user]);

  async function handleGenerateBackupCodes() {
    if (!user || busy) {
      return;
    }

    setBusy(true);
    try {
      const backupCodeResource = await user.createBackupCode();
      const codes = Array.isArray(backupCodeResource?.codes) ? backupCodeResource.codes : [];

      if (!codes.length) {
        throw new Error('No backup codes were returned');
      }

      setBackupCodes(codes);
      toast.success('Backup codes generated. Save them now.');
    } catch (error) {
      toast.error(error?.message || 'Failed to generate backup codes');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyCodes() {
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

  function handleDownloadCodes() {
    if (!backupCodes.length) {
      return;
    }

    triggerDownload('iconip-2026-backup-codes.txt', buildBackupCodesText(backupCodes));
    toast.success('Backup codes downloaded');
  }

  if (!isSessionLoaded || !isUserLoaded) {
    return (
      <div className="cyber-card cyber-terminal w-full p-6">
        <p className="cyber-kicker">Session Tasks</p>
        <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Set Up MFA</h1>
        <p className="cyber-muted mt-2 text-sm">Loading task status...</p>
      </div>
    );
  }

  if (session?.currentTask?.key === 'setup-mfa') {
    return (
      <div className="space-y-4">
        <div className="cyber-card cyber-terminal w-full p-6">
          <p className="cyber-kicker">Step 1</p>
          <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Set up authenticator app</h1>
          <p className="cyber-muted mt-2 text-sm">
            Complete authenticator setup first. Right after that, we will prompt you to download backup codes for
            account recovery.
          </p>
        </div>
        <TaskSetupMFA redirectUrlComplete="/setup-mfa?mfa=configured" />
      </div>
    );
  }

  if (shouldPromptBackupCodes) {
    return (
      <div className="cyber-card cyber-terminal w-full p-6">
        <p className="cyber-kicker">Step 2</p>
        <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Save backup codes</h1>
        <p className="cyber-muted mt-2 text-sm">
          Backup codes let you sign in when your authenticator app is unavailable. Generate and store them in a secure
          place.
        </p>

        {!backupCodes.length ? (
          <button
            type="button"
            className="cyber-btn cyber-btn-solid mt-5"
            onClick={handleGenerateBackupCodes}
            disabled={!canGenerateBackupCodes || busy}
          >
            {busy ? 'Generating...' : 'Generate backup codes'}
          </button>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="cyber-note">
              <p className="mb-2 text-xs font-semibold">Backup codes (one-time use each):</p>
              <ul className="space-y-1 text-sm">
                {backupCodes.map((code) => (
                  <li key={code}>
                    <code>{code}</code>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="cyber-btn cyber-btn-secondary" onClick={handleDownloadCodes}>
                Download codes
              </button>
              <button type="button" className="cyber-btn cyber-btn-outline" onClick={handleCopyCodes}>
                Copy codes
              </button>
              <button type="button" className="cyber-btn cyber-btn-solid" onClick={() => (window.location.href = '/chat')}>
                Continue to chat
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cyber-card cyber-terminal w-full p-6">
      <p className="cyber-kicker">Session Tasks</p>
      <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">MFA setup complete</h1>
      <p className="cyber-muted mt-2 text-sm">
        Authenticator MFA is active. You can use backup codes during sign-in if the authenticator app is not
        accessible.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link className="cyber-btn cyber-btn-solid" href="/chat">
          Go to chat
        </Link>
        <button type="button" className="cyber-btn cyber-btn-outline" onClick={handleGenerateBackupCodes} disabled={busy}>
          {busy ? 'Generating...' : 'Regenerate backup codes'}
        </button>
      </div>
    </div>
  );
}
