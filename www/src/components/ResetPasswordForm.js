'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ResetPasswordForm({ token = '' }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!token) {
      setError('Reset link is invalid or missing.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || 'Failed to reset password');
        return;
      }

      setSuccess(true);
    } catch (submitError) {
      setError(submitError.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="cyber-card cyber-terminal w-full p-6">
        <p className="cyber-kicker">Reset Password</p>
        <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Invalid Link</h1>
        <p className="cyber-note cyber-note-error mt-4">
          Reset link is invalid or missing. Please request a new password reset email.
        </p>
        <Link className="cyber-btn cyber-btn-outline mt-4" href="/forgot-password">
          Request New Link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="cyber-card cyber-terminal w-full p-6">
        <p className="cyber-kicker">Reset Password</p>
        <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Password Updated</h1>
        <p className="cyber-note cyber-note-success mt-4">
          Your password has been reset. You can now log in with your new password.
        </p>
        <Link className="cyber-btn cyber-btn-solid mt-4" href="/login">
          Go To Login
        </Link>
      </div>
    );
  }

  return (
    <div className="cyber-card cyber-terminal w-full p-6">
      <p className="cyber-kicker">Reset Password</p>
      <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Choose A New Password</h1>
      <p className="cyber-muted mt-1 text-sm">Enter your new password twice to confirm.</p>

      {error ? <p className="cyber-note cyber-note-error mt-4">{error}</p> : null}

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <label className="cyber-label" htmlFor="password">
          New Password
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

        <label className="cyber-label" htmlFor="confirmPassword">
          Confirm New Password
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

        <button type="submit" className="cyber-btn cyber-btn-solid w-full" disabled={submitting}>
          {submitting ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>

      <p className="cyber-muted mt-4 text-sm">
        Back to <Link className="cyber-link" href="/login">Login</Link>
      </p>
    </div>
  );
}
