'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LogIn, Mail } from 'lucide-react';

const GENERIC_MESSAGE = 'If an account exists for this email, check your inbox for a password reset link.';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error || 'Failed to send reset link');
        return;
      }

      setMessage(payload.message || GENERIC_MESSAGE);
    } catch {
      setMessage(GENERIC_MESSAGE);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="cyber-card cyber-terminal w-full p-6">
      <p className="cyber-kicker">Password Recovery</p>
      <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Forgot Password</h1>
      <p className="cyber-muted mt-1 text-sm">Enter your email and we&apos;ll send a reset link.</p>

      {error ? <p className="cyber-note cyber-note-error mt-4">{error}</p> : null}
      {message ? <p className="cyber-note cyber-note-success mt-4">{message}</p> : null}

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
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

        <button type="submit" className="cyber-btn cyber-btn-solid w-full" disabled={submitting}>
          <Mail size={16} />
          {submitting ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="cyber-muted mt-4 text-sm">
        Remembered your password?{' '}
        <Link className="cyber-link" href="/login">
          <LogIn size={14} className="mr-1 inline" />
          Back to login
        </Link>
      </p>
    </div>
  );
}
