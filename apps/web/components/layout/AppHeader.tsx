// apps/web/components/layout/AppHeader.tsx
import Link from 'next/link';
import { signOut } from '../../lib/auth/actions';
import type { SessionProfile } from '../../lib/auth/session';

// inline-flex items-center su entrambi per perfetto allineamento verticale
const navItemClassName =
  'inline-flex items-center text-xs font-medium tracking-wide text-brand-100 hover:text-white hover:bg-brand-600/60 px-2.5 py-1 rounded-md transition-colors';

export function AppHeader({ profile }: { profile: SessionProfile }) {
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Membro';

  return (
    <header className="bg-brand-700 text-stone-50 px-4 py-3 flex items-center justify-between gap-3 border-b border-brand-800/40">
      <div className="min-w-0">
        <Link href="/" className="block font-serif font-bold tracking-tight text-base sm:text-lg truncate hover:text-stone-100 transition-colors">
          Archivio FantaTopa
        </Link>
        <div className="text-xs text-brand-200/90 truncate flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          <span>{displayName}</span>
        </div>
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
