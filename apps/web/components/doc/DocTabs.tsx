// apps/web/components/doc/DocTabs.tsx
//
// Tab tra i due documenti di lega (Storia/Costituzione) — non sotto
// stagioni/[season]/**, quindi niente logica di preservazione di
// ?competizione= come in PageTabs: solo usePathname(), nessun bisogno di
// useSearchParams()/Suspense.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { kind: 'storia', label: 'Storia' },
  { kind: 'costituzione', label: 'Costituzione' },
];

export function DocTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-4 sm:gap-6 overflow-x-auto overflow-y-hidden scrollbar-none min-w-0 flex-1">
      {TABS.map((tab) => {
        const href = `/doc/${tab.kind}`;
        const active = pathname === href;

        return (
          <Link
            key={tab.kind}
            href={href}
            className={`inline-flex items-center gap-1.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              active
                ? 'border-brand-600 text-brand-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
