// apps/web/components/rose/TeamSwitcher.tsx
//
// A differenza di CompetitionSwitcher, questo vive dentro la pagina Rose
// (non nel layout condiviso): la squadra attiva arriva da searchParams già
// disponibile nella pagina, quindi resta un Server Component — non serve
// useSearchParams()/'use client'.
import Link from 'next/link';
import type { TeamOption } from '../../lib/queries/rose';

type TeamSwitcherProps = {
  teams: TeamOption[];
  activeTeamSlug: string;
};

export function TeamSwitcher({ teams, activeTeamSlug }: TeamSwitcherProps) {
  if (teams.length <= 1) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-4">
      {teams.map((team) => {
        const active = team.slug === activeTeamSlug;

        return (
          <Link
            key={team.id}
            href={`?squadra=${team.slug}`}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
              active ? 'bg-brand-600 text-white' : 'bg-white text-brand-700 border border-stone-200'
            }`}
          >
            {team.name}
          </Link>
        );
      })}
    </div>
  );
}
