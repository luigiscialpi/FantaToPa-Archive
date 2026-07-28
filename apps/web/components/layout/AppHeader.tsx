// apps/web/components/layout/AppHeader.tsx
import { signOut } from '../../lib/auth/actions';
import type { SessionProfile } from '../../lib/auth/session';

export function AppHeader({ profile }: { profile: SessionProfile }) {
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.email || 'Membro';

  return (
    <header className="bg-brand-600 text-stone-50 px-4 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="font-serif font-bold tracking-tight text-base truncate">Archivio FantaTopa</div>
        <div className="text-xs text-brand-100 truncate">{displayName}</div>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="text-xs font-semibold uppercase tracking-wide text-brand-100 hover:text-white px-2 py-1"
        >
          Esci
        </button>
      </form>
    </header>
  );
}
