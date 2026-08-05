// apps/web/components/formazioni/PlayerRow.tsx
import type { LineupPlayerRow, PlayerBonus } from '../../lib/queries/formazioni';
import { addPlayerBonusAction, removePlayerBonusAction, updateLineupPlayerAction } from '../../lib/admin/formazioni-actions';

// Spritesheet ufficiale fantacalcio.it (self-hosted in public/icons, non
// linkato dal CDN esterno per non dipendere dalla sua disponibilità): 32
// celle da 32px in fila, la maggior parte inutilizzate/di eventi che non
// modelliamo (subentrato, uscito, VAR, infortunio, sostituzioni...).
// Indici verificati visivamente ritagliando ogni cella (vedi sessione).
const SPRITE_URL = '/icons/bonus-spritesheet.webp';
const SPRITE_CELL_PX = 32;
const SPRITE_COLUMNS = 32;

const SPRITE_ICON_INDEX: Record<string, number> = {
  gol_fatto: 0,
  assist: 1,
  assist_soft: 1,
  assist_gold: 1,
  assist_fermo: 1,
  ammonizione: 2,
  espulsione: 3,
  rigore_segnato: 4,
  rigore_sbagliato: 5,
  rigore_parato: 6,
  autogol: 7,
  gol_subito: 8,
  subentrato: 9,
  uscito: 10,
  portiere_imbattuto: 13,
};

// player_of_the_match non ha una cella corrispondente nello spritesheet
// (quelle rimanenti sono eventi non modellati: subentrato/uscito/VAR/
// infortunio/sostituzioni) — resta un'emoji di fallback.
const FALLBACK_ICON: Record<string, string> = {
  player_of_the_match: '⭐',
};

function SpriteIcon({ index, size, label }: { index: number; size: number; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${SPRITE_URL})`,
        backgroundSize: `${SPRITE_COLUMNS * size}px ${size}px`,
        backgroundPosition: `-${index * size}px 0`,
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}

function BonusBadges({ bonuses, editable }: { bonuses: PlayerBonus[]; editable: boolean }) {
  if (bonuses.length === 0 && !editable) return null;
  return (
    <span className="flex items-center gap-1 shrink-0 flex-wrap">
      {bonuses.map((bonus, index) => {
        const spriteIndex = SPRITE_ICON_INDEX[bonus.code];
        const icon =
          spriteIndex !== undefined ? (
            <SpriteIcon index={spriteIndex} size={SPRITE_CELL_PX / 2} label={bonus.label} />
          ) : (
            <span className="text-sm" title={bonus.label}>
              {FALLBACK_ICON[bonus.code] ?? '•'}
            </span>
          );

        if (!editable) {
          return <span key={`${bonus.code}-${index}`}>{icon}</span>;
        }

        return (
          <form key={bonus.id} action={removePlayerBonusAction.bind(null, bonus.id)} className="flex items-center">
            {icon}
            <button type="submit" title={`Rimuovi ${bonus.label}`} className="text-[10px] text-red-600 leading-none ml-0.5">
              ✕
            </button>
          </form>
        );
      })}
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

export function PlayerRow({
  player,
  editMode = false,
  bonusKinds = [],
  bonusMatchdayId,
}: {
  player: LineupPlayerRow;
  editMode?: boolean;
  bonusKinds?: { code: string; label: string }[];
  bonusMatchdayId?: string;
}) {
  // Come nel file sorgente: chi non conta per il totale squadra è scritto
  // in un colore più leggero (l'intera riga, non solo il fantavoto) — non
  // ha senso enfatizzare con verde/rosso uno scarto che non viene comunque
  // sommato al punteggio.
  const muted = !player.countsForTotal;
  const nameColor = muted ? 'text-stone-300' : 'text-stone-700';
  const votoColor = muted ? 'text-stone-300' : 'text-stone-400';
  const fantavotoColor = muted ? 'text-stone-300' : fantavotoClasses(player.voto, player.fantavoto);

  if (editMode && bonusMatchdayId) {
    return (
      <div className="py-2 space-y-1.5" title={muted ? 'Non conta per il totale squadra' : undefined}>
        <div className="flex items-center gap-2">
          <span className={`text-sm truncate flex-1 min-w-0 ${nameColor}`}>{player.playerName}</span>
          <BonusBadges bonuses={player.bonuses} editable />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={updateLineupPlayerAction.bind(null, player.lineupPlayerId)} className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.5"
              name="voto"
              defaultValue={player.voto ?? ''}
              placeholder="Voto"
              className="w-14 rounded border border-stone-300 text-xs px-1.5 py-1"
            />
            <input
              type="number"
              step="0.5"
              name="fantavoto"
              defaultValue={player.fantavoto ?? ''}
              placeholder="Fvoto"
              className="w-14 rounded border border-stone-300 text-xs px-1.5 py-1"
            />
            <label className="flex items-center gap-1 text-[11px] text-stone-500">
              <input type="checkbox" name="countsForTotal" defaultChecked={player.countsForTotal} />
              Conta
            </label>
            <button type="submit" className="rounded bg-brand-400 text-brand-950 text-xs font-semibold px-2 py-1">
              Salva
            </button>
          </form>
          <form
            action={addPlayerBonusAction.bind(null, bonusMatchdayId, player.playerId)}
            className="flex items-center gap-1.5"
          >
            <select name="kindCode" className="rounded border border-stone-300 text-xs px-1.5 py-1" defaultValue="">
              <option value="" disabled>
                + bonus/malus
              </option>
              {bonusKinds.map((kind) => (
                <option key={kind.code} value={kind.code}>
                  {kind.label}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded bg-stone-200 text-stone-700 text-xs font-semibold px-2 py-1">
              Aggiungi
            </button>
          </form>
        </div>
      </div>
    );
  }

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
        {/* I bonus/malus sono eventi reali del giocatore, non del conteggio
            di squadra: mostrarli anche quando la riga non conta per il
            totale (es. panchinaro andato comunque in campo nella Serie A
            reale) — solo lo stile della riga resta smorzato. */}
        <BonusBadges bonuses={player.bonuses} editable={false} />
        <span className={`text-xs w-6 text-right tabular-nums shrink-0 ${votoColor}`}>{player.voto ?? '–'}</span>
        <span className={`text-xs w-8 text-right tabular-nums shrink-0 ${fantavotoColor}`}>
          {player.fantavoto ?? '–'}
        </span>
      </div>
    </div>
  );
}
