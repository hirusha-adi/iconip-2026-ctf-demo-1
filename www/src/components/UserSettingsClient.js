'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { toast } from 'react-toastify';

function formatCodes(codes) {
  if (!Array.isArray(codes)) {
    return '';
  }

  return codes.join('\n');
}

export default function UserSettingsClient({ initialFirstName = '', initialLastName = '', initialEmail = '' }) {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useUser();

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [busy, setBusy] = useState('');

  async function syncProfile(profile) {
    await fetch('/api/user/sync-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profile),
    });
  }

  async function handleUpdateName(event) {
    event.preventDefault();

    if (!user) {
      return;
    }

    setBusy('name');

    try {
      const updatedUser = await user.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      await syncProfile({
        firstName: updatedUser.firstName || '',
        lastName: updatedUser.lastName || '',
        email: updatedUser.primaryEmailAddress?.emailAddress || initialEmail,
      });

      toast.success('Name updated');
    } catch (error) {
      toast.error(error?.errors?.[0]?.longMessage || error?.message || 'Failed to update name');
    } finally {
      setBusy('');
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();

    if (!user) {
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setBusy('password');

    try {
      await user.updatePassword({
        currentPassword,
        newPassword,
        signOutOfOtherSessions: false,
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated');
    } catch (error) {
      toast.error(error?.errors?.[0]?.longMessage || error?.message || 'Failed to update password');
    } finally {
      setBusy('');
    }
  }

  async function handleRegenerateBackupCodes() {
    if (!user) {
      return;
    }

    setBusy('backup');

    try {
      const resource = await user.createBackupCode();
      setBackupCodes(resource?.codes || []);
      toast.success('Generated new backup codes');
    } catch (error) {
      toast.error(error?.errors?.[0]?.longMessage || error?.message || 'Failed to generate backup codes');
    } finally {
      setBusy('');
    }
  }

  async function handleResetTotp() {
    if (!user) {
      return;
    }

    setBusy('reset-totp');

    try {
      await user.disableTOTP();
      await user.reload();
      toast.success('TOTP reset. Please configure again.');
      router.push('/setup-totp');
    } catch (error) {
      toast.error(error?.errors?.[0]?.longMessage || error?.message || 'Failed to reset TOTP');
    } finally {
      setBusy('');
    }
  }

  if (!isLoaded) {
    return <p className="text-sm text-zinc-500">Loading...</p>;
  }

  if (!isSignedIn || !user) {
    return (
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">User Settings</h1>
        <p className="mt-2 text-sm text-zinc-600">Please sign in to manage your account.</p>
        <Link className="mt-4 inline-block text-sm font-medium text-green-700 hover:underline" href="/login?next=/user">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl space-y-4">
      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">User Settings</h1>
        <p className="mt-1 text-sm text-zinc-600">Manage your profile, password, and MFA.</p>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Profile</h2>
        <p className="mt-1 text-xs text-zinc-500">Email: {user.primaryEmailAddress?.emailAddress || initialEmail}</p>

        <form className="mt-4 space-y-3" onSubmit={handleUpdateName}>
          <label className="block text-sm text-zinc-700" htmlFor="firstName">
            First name
            <input
              id="firstName"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm text-zinc-700" htmlFor="lastName">
            Last name
            <input
              id="lastName"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy === 'name'}
          >
            {busy === 'name' ? 'Saving...' : 'Save name'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Change Password</h2>

        <form className="mt-4 space-y-3" onSubmit={handleChangePassword}>
          <label className="block text-sm text-zinc-700" htmlFor="currentPassword">
            Current password
            <input
              id="currentPassword"
              type="password"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm text-zinc-700" htmlFor="newPassword">
            New password
            <input
              id="newPassword"
              type="password"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm text-zinc-700" htmlFor="confirmPassword">
            Confirm new password
            <input
              id="confirmPassword"
              type="password"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy === 'password'}
          >
            {busy === 'password' ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Two-Factor Authentication</h2>
        <p className="mt-1 text-sm text-zinc-600">TOTP status: {user.totpEnabled ? 'Enabled' : 'Disabled'}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {!user.totpEnabled ? (
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
              onClick={() => router.push('/setup-totp')}
            >
              Set up TOTP
            </button>
          ) : (
            <button
              type="button"
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              onClick={handleResetTotp}
              disabled={busy === 'reset-totp'}
            >
              {busy === 'reset-totp' ? 'Resetting...' : 'Reset TOTP'}
            </button>
          )}

          <button
            type="button"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
            onClick={handleRegenerateBackupCodes}
            disabled={busy === 'backup' || !user.totpEnabled}
          >
            {busy === 'backup' ? 'Generating...' : 'Re-download backup keys'}
          </button>
        </div>

        {backupCodes.length ? (
          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs font-medium text-zinc-700">Backup codes</p>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-zinc-700">{formatCodes(backupCodes)}</pre>
          </div>
        ) : null}
      </section>
    </div>
  );
}
