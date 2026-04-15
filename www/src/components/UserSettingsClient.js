'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { LogIn, Save, Shield, UserRound } from 'lucide-react';
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
      <div className="w-full max-w-4xl">
        <h1 className="cyber-title text-2xl font-semibold text-foreground">User Settings</h1>
        <p className="cyber-muted mt-1 text-sm">Please sign in to manage your account.</p>
        <p className="mt-4">
          <Link className="cyber-link text-sm" href="/login?next=/user">
            <LogIn size={14} className="mr-1 inline" />
            Go to login
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1fr)]">
        <aside className="pt-1">
          <p className="cyber-kicker">Account</p>
          <h1 className="cyber-title mt-2 text-3xl font-semibold text-foreground">User Settings</h1>
          <p className="cyber-muted mt-3 text-sm">Manage profile details, password, and security methods.</p>
          <p className="cyber-muted mt-2 text-sm">Changes are applied to your current account immediately.</p>
        </aside>

        <section className="border-l border-[rgba(61,72,82,0.22)] pl-6 sm:pl-8">
          <div className="space-y-12">
            <section className="pb-8 border-b border-[rgba(61,72,82,0.12)]">
              <h2 className="cyber-title text-lg font-semibold text-foreground">Profile</h2>
              <p className="cyber-muted mt-1 text-xs">Email: {user.primaryEmailAddress?.emailAddress || initialEmail}</p>

              <form className="mt-4 grid grid-cols-1 gap-3" onSubmit={handleUpdateName}>
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

                <div>
                  <button type="submit" className="cyber-btn cyber-btn-solid" disabled={busy === 'name'}>
                    <UserRound size={16} />
                    {busy === 'name' ? 'Saving...' : 'Save name'}
                  </button>
                </div>
              </form>
            </section>

            <section className="pb-8 border-b border-[rgba(61,72,82,0.12)]">
              <h2 className="cyber-title text-lg font-semibold text-foreground">Change Password</h2>

              <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleChangePassword}>
                <label className="cyber-label sm:col-span-2" htmlFor="currentPassword">
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

                <div className="sm:col-span-2">
                  <button type="submit" className="cyber-btn cyber-btn-solid" disabled={busy === 'password'}>
                    <Save size={16} />
                    {busy === 'password' ? 'Updating...' : 'Update password'}
                  </button>
                </div>
              </form>
            </section>

            <section>
              <h2 className="cyber-title text-lg font-semibold text-foreground">MFA</h2>
              <p className="cyber-muted mt-2 text-sm">
                This account uses authenticator application and backup codes for second-factor verification.
              </p>
              <Link className="cyber-link mt-4 inline-block text-sm" href="/setup-mfa">
                <Shield size={14} className="mr-1 inline" />
                Manage MFA setup
              </Link>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}
