import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppHeader } from '../../components/layout/AppHeader';
import { canReadLeagueData, getSessionState } from '../../lib/auth/session';
import { signOut } from '../../lib/auth/actions';
import { createClient } from '../../lib/supabase/server';
import { getSeasons } from '../../lib/queries/seasons';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await getSessionState();

  if (session.kind === 'anonimo') {
    redirect('/login');
  }

  const { profile } = session;

  if (!canReadLeagueData(profile)) {
    const message =
      profile.status === 'rejected'
        ? 'La tua richiesta di accesso non è stata approvata. Contatta un amministratore della lega.'
        : 'La tua richiesta di accesso è in attesa di approvazione da parte di un amministratore.';

    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
        <div className="w-full max-w-sm bg-white rounded-xl border border-stone-200 p-6 text-center space-y-4">
          <h1 className="font-serif font-bold text-lg text-brand-950">Archivio FantaTopa</h1>
          <p className="text-sm text-stone-600">{message}</p>
          <form action={signOut}>
            <button type="submit" className="text-xs font-semibold uppercase tracking-wide text-brand-800">
              Esci
            </button>
          </form>
        </div>
      </main>
    );
  }

  const supabase = await createClient();
  const seasons = await getSeasons(supabase);

  return (
    <div className="min-h-screen bg-stone-200 bg-skin-desktop lg:py-6">
      <div className="max-w-5xl mx-auto bg-stone-100 min-h-screen lg:min-h-[calc(100vh-3rem)] lg:rounded-xl lg:shadow-xl border-stone-300 lg:border">
        <AppHeader profile={profile} seasons={seasons} />
        {children}
      </div>
    </div>
  );
}
