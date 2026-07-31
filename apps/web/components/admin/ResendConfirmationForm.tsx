'use client';

import { useActionState } from 'react';
import { resendConfirmationEmail, type ResendConfirmationState } from '../../lib/admin/actions';

const initialState: ResendConfirmationState = { error: null, success: false };

export function ResendConfirmationForm() {
  const [state, formAction, pending] = useActionState(resendConfirmationEmail, initialState);

  return (
    <form action={formAction} className="bg-white rounded-lg border border-stone-200 p-4 space-y-2">
      <label htmlFor="resend-email" className="block text-sm font-medium text-stone-700">
        Reinvia email di conferma
      </label>
      <div className="flex gap-2">
        <input
          id="resend-email"
          name="email"
          type="email"
          required
          placeholder="email@esempio.it"
          className="flex-1 min-w-0 rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-brand-400 text-brand-950 text-sm font-semibold px-3 py-2 disabled:opacity-60"
        >
          {pending ? 'Invio…' : 'Reinvia'}
        </button>
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.success && <p className="text-sm text-green-700">Email di conferma reinviata.</p>}
    </form>
  );
}
