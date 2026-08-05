import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionState } from '../../lib/auth/session';
import { createClient } from '../../lib/supabase/server';
import { getTeamsAvailableForRegistration } from '../../lib/queries/registration';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = { title: 'Registrati' };

export default async function RegisterPage() {
  const session = await getSessionState();

  if (session.kind === 'autenticato') {
    redirect('/');
  }

  const supabase = await createClient();
  const teams = await getTeamsAvailableForRegistration(supabase);

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-100 px-4 py-8">
      <div className="w-full max-w-sm bg-white rounded-xl border border-stone-200 p-6">
        <h1 className="font-serif font-bold text-xl text-brand-950 mb-1">Archivio FantaTopa</h1>
        <p className="text-sm text-stone-500 mb-6">Richiedi l&apos;accesso all&apos;archivio storico della lega.</p>
        <RegisterForm teams={teams} />
        <p className="text-xs text-stone-500 mt-4">
          Hai già un account?{' '}
          <Link href="/login" className="font-semibold text-brand-800">
            Accedi
          </Link>
        </p>
      </div>
    </main>
  );
}
