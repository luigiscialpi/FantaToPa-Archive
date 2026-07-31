// apps/web/components/shared/TeamCrests.tsx
//
// Due Crest affiancati (logo poi maglia): usato in Formazioni/Rose dove
// serve mostrare entrambi, a differenza di Classifica/Calendario che
// mostrano solo la maglia in un singolo Crest.
import { Crest } from './Crest';

type TeamCrestsProps = {
  name: string;
  logoUrl: string | null;
  jerseyUrl: string | null;
  highlight?: boolean;
  size?: 'md' | 'lg';
};

export function TeamCrests({ name, logoUrl, jerseyUrl, highlight = false, size = 'md' }: TeamCrestsProps) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Crest name={name} imageUrl={logoUrl} highlight={highlight} size={size} />
      <Crest name={name} imageUrl={jerseyUrl} highlight={highlight} size={size} />
    </div>
  );
}
