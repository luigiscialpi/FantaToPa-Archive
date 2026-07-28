'use client';

import { useActionState } from 'react';
import { signIn, type LoginFormState } from '../../lib/auth/actions';

const initialState: LoginFormState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700"
        />
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-emerald-900 text-stone-50 font-semibold text-sm py-2.5 disabled:opacity-60"
      >
        {pending ? 'Accesso in corso…' : 'Accedi'}
      </button>
    </form>
  );
}
