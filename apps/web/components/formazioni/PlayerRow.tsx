// apps/web/components/formazioni/PlayerRow.tsx
import type { LineupPlayerRow, PlayerBonus } from '../../lib/queries/formazioni';

// Emoji come scorciatoia visiva compatta (niente libreria icone per 13
// codici fissi): elenco chiuso, coerente con bonus_kinds della migrazione.
const BONUS_ICON: Record<string, string> = {
  gol_fatto: '⚽',
  gol_subito: '🥅',
  assist: '🅰️',
  assist_soft: '🅰️',
  assist_gold: '🅰️',
  ammonizione: '🟨',
  espulsione: '🟥',
  autogol: '🙃',
  rigore_segnato: '⚽',
  rigore_sbagliato: '❌',
  rigore_parato: '🧤',
  portiere_imbattuto: '🛡️',
  player_of_the_match: '⭐',
};

function BonusBadges({ bonuses }: { bonuses: PlayerBonus[] }) {
  if (bonuses.length === 0) return null;
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      {bonuses.map((bonus, index) => (
        <span key={`${bonus.code}-${index}`} className="text-xs" title={bonus.label}>
          {BONUS_ICON[bonus.code] ?? '•'}
        </span>
      ))}
    </span>
  );
}

// Evidenzia lo scarto voto→fantavoto solo se marcato (soglia ±2, come nel
// mockup di riferimento): bonus/malus reali del fantacalcio, non un
// giudizio nostro — semantico (verde/rosso), non colore di brand.
function fantavotoClasses(voto: number | null, fantavoto: number | null): string {
  if (voto === null || fantavoto === null) return 'text-stone-300';
  const delta = fantavoto - voto;
  if (delta >= 2) return 'text-emerald-700 font-bold';
  if (delta <= -2) return 'text-red-700 font-bold';
  return 'text-stone-600 font-medium';
}

export function PlayerRow({ player }: { player: LineupPlayerRow }) {
  // Come nel file sorgente: chi non conta per il totale squadra è scritto
  // in un colore più leggero (l'intera riga, non solo il fantavoto) — non
  // ha senso enfatizzare con verde/rosso uno scarto che non viene comunque
  // sommato al punteggio.
  const muted = !player.countsForTotal;
  const nameColor = muted ? 'text-stone-300' : 'text-stone-700';
  const votoColor = muted ? 'text-stone-300' : 'text-stone-400';
  const fantavotoColor = muted ? 'text-stone-300' : fantavotoClasses(player.voto, player.fantavoto);

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 py-1.5"
      title={muted ? 'Non conta per il totale squadra' : undefined}
    >
      {/* Nome a piena larghezza su mobile: forza voto/fantavoto ad andare a
          capo sotto, ma restano sulla stessa "riga visuale" del giocatore
          (nessun gap verticale) e allineati a destra. Da sm in su torna la
          singola riga: il wrapper voti diventa `contents` (nessun box suo)
          e i due span si comportano come diretti figli del flex. */}
      <span className={`text-sm truncate w-full sm:w-auto sm:min-w-0 sm:flex-1 ${nameColor}`}>
        {player.playerName}
      </span>
      <div className="flex items-center gap-2 ml-auto sm:contents">
        {!muted && <BonusBadges bonuses={player.bonuses} />}
        <span className={`text-xs w-6 text-right tabular-nums shrink-0 ${votoColor}`}>{player.voto ?? '–'}</span>
        <span className={`text-xs w-8 text-right tabular-nums shrink-0 ${fantavotoColor}`}>
          {player.fantavoto ?? '–'}
        </span>
      </div>
    </div>
  );
}
