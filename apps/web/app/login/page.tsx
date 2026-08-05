import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionState } from '../../lib/auth/session';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Accedi' };

export default async function LoginPage() {
  const session = await getSessionState();

  if (session.kind === 'autenticato') {
    redirect('/');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-stone-200 p-6">
        <h1 className="font-serif font-bold text-xl text-brand-950 mb-1">Archivio FantaTopa</h1>
        <p className="text-sm text-stone-500 mb-6">Accedi con le credenziali del tuo account.</p>
        <LoginForm />
        <p className="text-xs text-stone-500 mt-4">
          Non hai un account?{' '}
          <Link href="/register" className="font-semibold text-brand-800">
            Registrati
          </Link>
        </p>
      </div>
    </main>
  );
}
