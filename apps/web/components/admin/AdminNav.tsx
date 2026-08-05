// apps/web/components/admin/AdminNav.tsx
//
// Tab tra le sotto-pagine di /admin (Registrazioni, Utenti, Stagioni) —
// stesso pattern visivo di GlobalNav (components/layout/), sezione separata
// perché vive solo dentro l'area admin, non su ogni pagina protetta.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin/registrazioni', label: 'Registrazioni' },
  { href: '/admin/utenti', label: 'Utenti' },
  { href: '/admin/stagioni', label: 'Stagioni' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-4 border-b border-stone-200 mb-4">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`py-2 text-sm font-semibold border-b-2 -mb-px ${
              active ? 'border-brand-500 text-brand-950' : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
