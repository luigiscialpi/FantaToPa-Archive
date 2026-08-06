// apps/web/components/layout/AccountActions.tsx
//
// Condiviso dal dropdown account desktop (AppHeader) e dall'hamburger
// mobile (MobileMenu): stessi due link (Admin/Esci), `onAdminClick` opzionale
// per far richiudere il menu chiamante alla navigazione — solo su "Admin",
// non su "Esci" (il form di sign-out reindirizza l'intera pagina, richiudere
// il menu prima non cambia nulla di percepibile).
import Link from 'next/link';
import { signOut } from '../../lib/auth/actions';
import type { SessionProfile } from '../../lib/auth/session';
import { SubmitButton } from '../shared/SubmitButton';

export function AccountActions({
  profile,
  itemClassName,
  onAdminClick,
}: {
  profile: SessionProfile;
  itemClassName: string;
  onAdminClick?: () => void;
}) {
  return (
    <>
      {profile.role === 'admin' && (
        <Link href="/admin/registrazioni" className={itemClassName} onClick={onAdminClick}>
          Admin
        </Link>
      )}
      <form action={signOut} className="contents">
        <SubmitButton pendingLabel="Esco…" className={`${itemClassName} disabled:opacity-60`}>
          Esci
        </SubmitButton>
      </form>
    </>
  );
}
