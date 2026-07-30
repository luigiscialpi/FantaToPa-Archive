// apps/web/components/home/StatCard.tsx
//
// Guscio condiviso dalle tessere di Home (pannello squadra + vetrina
// generale): stesso trattamento visivo per ~9 statistiche diverse invece di
// ripetere le stesse classi Tailwind in ogni componente.
import Link from 'next/link';
import type { ReactNode } from 'react';

type StatCardProps = {
  label: string;
  href?: string;
  children: ReactNode;
};

export function StatCard({ label, href, children }: StatCardProps) {
  const className = `block h-full rounded-xl border border-stone-200 bg-white p-4${
    href ? ' hover:border-brand-400 transition-colors' : ''
  }`;
  const content = (
    <>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">{label}</div>
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
