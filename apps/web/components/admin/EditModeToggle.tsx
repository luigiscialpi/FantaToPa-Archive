// apps/web/components/admin/EditModeToggle.tsx
//
// Toggle "modalità modifica" via query param (?modifica=1), stesso
// approccio già usato in giro per stato risolto lato server (competizione/
// giornata/partita) invece di stato client isolato: il link è condivisibile
// e sopravvive a un refresh. Il chiamante decide SE mostrarlo (solo admin).
'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function EditModeToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (active) {
      params.delete('modifica');
    } else {
      params.set('modifica', '1');
    }
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-busy={isPending}
      className={`rounded-lg text-sm font-semibold px-3 py-1.5 shrink-0 disabled:opacity-70 disabled:cursor-wait ${
        active ? 'bg-red-700 text-white' : 'bg-brand-400 text-brand-950'
      }`}
    >
      {active ? 'Esci da modifica' : 'Modifica'}
    </button>
  );
}
