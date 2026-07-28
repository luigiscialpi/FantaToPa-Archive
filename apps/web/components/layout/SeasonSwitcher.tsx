// apps/web/components/layout/SeasonSwitcher.tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { SeasonOption } from '../../lib/queries/seasons';

type SeasonSwitcherProps = {
  seasons: SeasonOption[];
  activeSeasonSlug: string;
};

export function SeasonSwitcher({ seasons, activeSeasonSlug }: SeasonSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();

  if (seasons.length <= 1) {
    return null;
  }

  function handleChange(nextSlug: string) {
    router.push(pathname.replace(`/stagioni/${activeSeasonSlug}`, `/stagioni/${nextSlug}`));
  }

  return (
    <select
      value={activeSeasonSlug}
      onChange={(event) => handleChange(event.target.value)}
      aria-label="Stagione"
      className="shrink-0 rounded-md bg-white text-brand-700 text-xs font-semibold px-2 py-1"
    >
      {seasons.map((season) => (
        <option key={season.id} value={season.slug}>
          {season.label}
        </option>
      ))}
    </select>
  );
}
