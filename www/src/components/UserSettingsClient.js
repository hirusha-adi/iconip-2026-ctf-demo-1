'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { toast } from 'react-toastify';

export default function UserSettingsClient({ initialFirstName = '', initialLastName = '', initialEmail = '' }) {
  const { isLoaded, isSignedIn, user } = useUser();

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  if (!isLoaded) {
    return <p className="cyber-muted text-sm">Loading...</p>;
  }

  if (!isSignedIn || !user) {
    return (
      <div className="cyber-card cyber-terminal w-full max-w-md p-6">
        <p className="cyber-kicker">User Settings</p>
        <h1 className="cyber-title mt-2 text-2xl font-semibold text-foreground">User Settings</h1>
        <p className="cyber-muted mt-2 text-sm">Please sign in to manage your account.</p>
        <Link className="cyber-link mt-4 inline-block text-sm" href="/login?next=/user">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl space-y-4">
      <section className="cyber-card p-6">
        <p className="cyber-kicker">Profile Console</p>
        <h1 className="cyber-title mt-2 text-2xl font-semibold text-foreground">User Settings</h1>
        <p className="cyber-muted mt-1 text-sm">Manage your profile and password.</p>
      </section>

      <section className="cyber-card p-6">
        <h2 className="cyber-title text-lg font-semibold text-foreground">Profile</h2>
        <p className="cyber-muted mt-1 text-xs">Email: {user.primaryEmailAddress?.emailAddress || initialEmail}</p>

        <form className="mt-4 space-y-3" onSubmit={handleUpdateName}>
          <label className="cyber-label" htmlFor="firstName">
            First name
            <div className="cyber-input-wrap">
              <input
                id="firstName"
                className="cyber-input"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
            </div>
          </label>

          <label className="cyber-label" htmlFor="lastName">
            Last name
            <div className="cyber-input-wrap">
              <input
                id="lastName"
                className="cyber-input"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
              />
            </div>
          </label>

          <button
            type="submit"
            className="cyber-btn cyber-btn-solid"
            disabled={busy === 'name'}
          >
            {busy === 'name' ? 'Saving...' : 'Save name'}
          </button>
        </form>
      </section>

      <section className="cyber-card p-6">
        <h2 className="cyber-title text-lg font-semibold text-foreground">Change Password</h2>

        <form className="mt-4 space-y-3" onSubmit={handleChangePassword}>
          <label className="cyber-label" htmlFor="currentPassword">
            Current password
            <div className="cyber-input-wrap">
              <input
                id="currentPassword"
                type="password"
                className="cyber-input"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
          </label>

          <label className="cyber-label" htmlFor="newPassword">
            New password
            <div className="cyber-input-wrap">
              <input
                id="newPassword"
                type="password"
                className="cyber-input"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </div>
          </label>

          <label className="cyber-label" htmlFor="confirmPassword">
            Confirm new password
            <div className="cyber-input-wrap">
              <input
                id="confirmPassword"
                type="password"
                className="cyber-input"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>
          </label>

          <button
            type="submit"
            className="cyber-btn cyber-btn-solid"
            disabled={busy === 'password'}
          >
            {busy === 'password' ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </section>

      <section className="cyber-card p-6">
        <h2 className="cyber-title text-lg font-semibold text-foreground">Email MFA</h2>
        <p className="cyber-muted mt-1 text-sm">
          Login requires email verification code as second factor based on your Clerk instance settings.
        </p>
      </section>
    </div>
  );
}
