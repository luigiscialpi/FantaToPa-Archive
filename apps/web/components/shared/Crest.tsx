// apps/web/components/shared/Crest.tsx
//
// ponytail: placeholder visivo (iniziali su sfondo colorato, stessa euristica
// di docs/fantatopa-mockup.jsx) finché non esiste un campo logo reale per
// team_seasons — non c'è ancora una fonte da cui importare uno stemma vero.
type CrestProps = {
  name: string;
  highlight?: boolean;
};

export function Crest({ name, highlight = false }: CrestProps) {
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
      className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold font-serif ring-2 ${
        highlight ? 'bg-amber-400 text-emerald-950 ring-amber-200' : 'bg-emerald-800 text-amber-200 ring-emerald-700'
      }`}
    >
      {initials}
    </div>
  );
}
