// apps/web/components/layout/AppHeader.tsx
import Link from 'next/link';
import { signOut } from '../../lib/auth/actions';
import type { SessionProfile } from '../../lib/auth/session';

// inline-flex items-center su entrambi: un <button> (dentro <form>, che è
// anch'esso flex) e un <a> di Link altrimenti si allineano su baseline
// diverse nella riga flex del genitore — visibile come "Esci" più in basso
// di "Admin" nonostante classi identiche.
const navItemClassName =
  'inline-flex items-center text-xs font-semibold uppercase tracking-wide text-brand-100 hover:text-white px-2 py-1';

export function AppHeader({ profile }: { profile: SessionProfile }) {
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Membro';

  return (
    <header className="bg-brand-600 text-stone-50 px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <Link href="/" className="block font-serif font-bold tracking-tight text-base truncate hover:text-stone-100">
          Archivio FantaTopa
        </Link>
        <div className="text-xs text-brand-100 truncate">{displayName}</div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {profile.role === 'admin' && (
          <Link href="/admin/registrazioni" className={navItemClassName}>
            Admin
          </Link>
        )}
        <form action={signOut} className="flex">
          <button type="submit" className={navItemClassName}>
            Esci
          </button>
        </form>
      </div>
    </header>
  );
}
