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
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Check your inbox</h1>
        <p className="mt-2 text-sm text-zinc-600">
          We sent a verification email. Click the link in the email to finish verification, then log in.
        </p>
        <Link className="mt-4 inline-block text-sm font-medium text-green-700 hover:underline" href="/login">
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-zinc-900">Register</h1>
      <p className="mt-1 text-sm text-zinc-600">Create your account to access the CTF chat.</p>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm text-zinc-700" htmlFor="firstName">
          First name
          <input
            id="firstName"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
            value={form.firstName}
            onChange={(event) => updateField('firstName', event.target.value)}
            required
          />
        </label>

        <label className="block text-sm text-zinc-700" htmlFor="lastName">
          Last name
          <input
            id="lastName"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
            value={form.lastName}
            onChange={(event) => updateField('lastName', event.target.value)}
            required
          />
        </label>

        <label className="block text-sm text-zinc-700" htmlFor="email">
          Email
          <input
            id="email"
            type="email"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
            required
          />
        </label>

        <label className="block text-sm text-zinc-700" htmlFor="password">
          Password
          <input
            id="password"
            type="password"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
            required
          />
        </label>

        <label className="block text-sm text-zinc-700" htmlFor="confirmPassword">
          Confirm password
          <input
            id="confirmPassword"
            type="password"
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none ring-green-500 focus:ring"
            value={form.confirmPassword}
            onChange={(event) => updateField('confirmPassword', event.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? 'Registering...' : 'Register'}
        </button>
      </form>

      <p className="mt-4 text-sm text-zinc-600">
        Already have an account? <Link className="text-green-700 hover:underline" href="/login">Login</Link>
      </p>
    </div>
  );
}
