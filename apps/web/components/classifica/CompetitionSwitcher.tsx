// apps/web/components/classifica/CompetitionSwitcher.tsx
import Link from 'next/link';
import type { CompetitionOption } from '../../lib/queries/classifica';

type CompetitionSwitcherProps = {
  seasonSlug: string;
  competitions: CompetitionOption[];
  activeCompetitionSlug: string;
};

export function CompetitionSwitcher({ seasonSlug, competitions, activeCompetitionSlug }: CompetitionSwitcherProps) {
  if (competitions.length <= 1) {
    return null;
  }

  return (
    <nav className="flex gap-2 overflow-x-auto px-4 py-2 bg-emerald-900">
      {competitions.map((competition) => {
        const active = competition.slug === activeCompetitionSlug;

        return (
          <Link
            key={competition.id}
            href={`/stagioni/${seasonSlug}/classifica?competizione=${competition.slug}`}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
              active ? 'bg-amber-400 text-emerald-950' : 'bg-emerald-800 text-emerald-100'
            }`}
          >
            {competition.name}
          </Link>
        );
      })}
    </nav>
  );
}
