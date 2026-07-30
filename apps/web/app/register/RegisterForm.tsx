'use client';

import { useActionState } from 'react';
import { signUp, type RegisterFormState } from '../../lib/auth/actions';
import type { AvailableTeam } from '../../lib/queries/registration';

const initialState: RegisterFormState = { error: null, success: false };

const inputClassName =
  'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-700';
const labelClassName = 'block text-sm font-medium text-stone-700 mb-1';

export function RegisterForm({ teams }: { teams: AvailableTeam[] }) {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  if (state.success) {
    return (
      <p className="text-sm text-stone-600">
        Richiesta inviata. Se richiesto, controlla la tua email per confermare l&apos;account: una volta confermato,
        un amministratore dovrà approvare il tuo accesso prima che tu possa vedere l&apos;archivio.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="firstName" className={labelClassName}>
            Nome
          </label>
          <input id="firstName" name="firstName" type="text" required autoComplete="given-name" className={inputClassName} />
        </div>
        <div>
          <label htmlFor="lastName" className={labelClassName}>
            Cognome
          </label>
          <input id="lastName" name="lastName" type="text" required autoComplete="family-name" className={inputClassName} />
        </div>
      </div>
      <div>
        <label htmlFor="email" className={labelClassName}>
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputClassName} />
      </div>
      <div>
        <label htmlFor="password" className={labelClassName}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="confirmPassword" className={labelClassName}>
          Conferma password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClassName}
        />
      </div>
      <div>
        <label htmlFor="requestedTeamId" className={labelClassName}>
          Squadra (opzionale)
        </label>
        <select id="requestedTeamId" name="requestedTeamId" defaultValue="" className={inputClassName}>
          <option value="">Nessuna squadra</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </div>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-400 text-brand-950 font-semibold text-sm py-2.5 disabled:opacity-60"
      >
        {pending ? 'Invio in corso…' : 'Registrati'}
      </button>
    </form>
  );
}
