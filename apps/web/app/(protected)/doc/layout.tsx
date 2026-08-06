// apps/web/app/(protected)/doc/layout.tsx
//
// Route top-level "Doc" (Storia/Costituzione, richiesta esplicita
// 2026-08-06): non scoped a una stagione, quindi fuori da stagioni/
// [season]/**, stesso principio già in AGENTS.md per Albo d'Oro/Statistiche.
import type { ReactNode } from 'react';
import { DocTabs } from '../../../components/doc/DocTabs';

export default function DocLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="bg-white border-b border-stone-200/90 px-4 flex items-center gap-3">
        <DocTabs />
      </div>
      {children}
    </div>
  );
}
