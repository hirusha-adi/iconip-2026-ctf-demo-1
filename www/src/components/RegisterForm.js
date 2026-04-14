'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'react-toastify';

async function parseResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export default function RegisterForm() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState('');

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await parseResponse(
        await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(form),
        }),
      );

      setRegistered(true);
      toast.success('Verification email sent');
    } catch (submitError) {
      setError(submitError.message || 'Failed to register');
    } finally {
      setSubmitting(false);
    }
  }

  if (registered) {
    return (
      <div className="cyber-card cyber-terminal w-full p-6">
        <p className="cyber-kicker">Registration Complete</p>
        <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Check your inbox</h1>
        <p className="cyber-muted mt-2 text-sm">
          We sent a verification email. Click the link in the email to finish verification, then log in.
        </p>
        <Link className="cyber-link mt-5 inline-block text-sm" href="/login">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="cyber-card cyber-terminal w-full p-6">
      <p className="cyber-kicker">Create Account</p>
      <h1 className="cyber-title mt-3 text-2xl font-bold text-foreground">Register</h1>
      <p className="cyber-muted mt-1 text-sm">Create your account to access the CTF chat.</p>

      {error ? <p className="cyber-note cyber-note-error mt-4">{error}</p> : null}

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <label className="cyber-label" htmlFor="firstName">
          First name
          <div className="cyber-input-wrap">
            <input
              id="firstName"
              className="cyber-input"
              value={form.firstName}
              onChange={(event) => updateField('firstName', event.target.value)}
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
              value={form.lastName}
              onChange={(event) => updateField('lastName', event.target.value)}
              required
            />
          </div>
        </label>

        <label className="cyber-label" htmlFor="email">
          Email
          <div className="cyber-input-wrap">
            <input
              id="email"
              type="email"
              className="cyber-input"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
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
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              required
            />
          </div>
        </label>

        <label className="cyber-label" htmlFor="confirmPassword">
          Confirm password
          <div className="cyber-input-wrap">
            <input
              id="confirmPassword"
              type="password"
              className="cyber-input"
              value={form.confirmPassword}
              onChange={(event) => updateField('confirmPassword', event.target.value)}
              required
            />
          </div>
        </label>

        <button
          type="submit"
          className="cyber-btn cyber-btn-solid w-full"
          disabled={submitting}
        >
          {submitting ? 'Registering...' : 'Register'}
        </button>
      </form>

      <p className="cyber-muted mt-4 text-sm">
        Already have an account? <Link className="cyber-link" href="/login">Login</Link>
      </p>
    </div>
  );
}
