// apps/web/components/shared/Crest.tsx
//
// Mostra l'immagine reale (logo o maglia) quando team_seasons la fornisce
// (vedi migrazione team_seasons_branding_credits.sql + step seedBranding in
// import-season.ts); altrimenti iniziali su sfondo
// colorato come fallback — la maggior parte delle squadre non ha ancora
// un'immagine caricata, non è un caso d'errore.
// object-contain (non cover): le maglie sono più larghe che alte dentro un
// canvas quadrato, un crop circolare "cover" taglierebbe le maniche.
type CrestProps = {
  name: string;
  imageUrl?: string | null;
  highlight?: boolean;
  size?: 'md' | 'lg';
};

const SIZE_CLASSNAMES = {
  md: 'w-9 h-9 text-xs',
  lg: 'w-14 h-14 text-base',
};

export function Crest({ name, imageUrl, highlight = false, size = 'md' }: CrestProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className={`shrink-0 rounded-full bg-white object-contain ring-2 ${SIZE_CLASSNAMES[size]} ${
          highlight ? 'ring-amber-200' : 'ring-brand-400'
        }`}
      />
    );
  }

  const initials =
    name
      .split(' ')
      .filter((word) => word.length > 2 || /^[A-Z]/.test(word))
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || name.slice(0, 2).toUpperCase();

  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center font-bold font-serif ring-2 ${SIZE_CLASSNAMES[size]} ${
        highlight ? 'bg-amber-400 text-brand-950 ring-amber-200' : 'bg-brand-200 text-brand-800 ring-brand-400'
      }`}
    >
      {initials}
    </div>
  );
}
