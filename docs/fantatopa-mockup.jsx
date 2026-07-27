import { useState } from 'react';
import { Trophy, ChevronDown, Share2, ChevronRight, ArrowLeftRight, Medal } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// ---- Dati reali dagli screenshot condivisi ----

const classifica = [
  { pos: 1, team: 'Monster', g: 37, v: 21, n: 7, p: 9, gf: 64, gs: 49, dr: 15, pt: 70, ptTot: 2702.5 },
  { pos: 2, team: 'Prozalpi S.F.', g: 37, v: 16, n: 12, p: 9, gf: 52, gs: 37, dr: 15, pt: 60, ptTot: 2628, mine: true },
  { pos: 3, team: 'Fantamerda', g: 37, v: 17, n: 8, p: 12, gf: 64, gs: 55, dr: 9, pt: 59, ptTot: 2702 },
  { pos: 4, team: 'Real Cocu 2003 Fc', g: 37, v: 16, n: 6, p: 15, gf: 55, gs: 52, dr: 3, pt: 54, ptTot: 2654 },
  { pos: 5, team: 'Los Cientoquattros Hertha Rallo', g: 37, v: 14, n: 12, p: 11, gf: 45, gs: 44, dr: 1, pt: 54, ptTot: 2572.5 },
  { pos: 6, team: 'Biancoceleste Athletic Club', g: 37, v: 13, n: 8, p: 16, gf: 46, gs: 52, dr: -6, pt: 47, ptTot: 2582.5 },
  { pos: 7, team: 'Associazione Sportiva via Roma', g: 37, v: 12, n: 10, p: 15, gf: 55, gs: 50, dr: 5, pt: 46, ptTot: 2640.5 },
  { pos: 8, team: 'Unione Sportiva Neritina', g: 37, v: 9, n: 15, p: 13, gf: 47, gs: 52, dr: -5, pt: 42, ptTot: 2602 },
  { pos: 9, team: 'MR EKO - C&W F.C.', g: 37, v: 9, n: 12, p: 16, gf: 37, gs: 51, dr: -14, pt: 39, ptTot: 2540.5 },
  { pos: 10, team: 'Carloparola Fc', g: 37, v: 9, n: 8, p: 20, gf: 33, gs: 56, dr: -23, pt: 35, ptTot: 2512.5 },
];

const roleColor = {
  por: 'bg-amber-400', dc: 'bg-emerald-600', dd: 'bg-emerald-600', ds: 'bg-emerald-600', b: 'bg-emerald-600',
  m: 'bg-sky-500', c: 'bg-sky-500', e: 'bg-sky-500',
  w: 'bg-rose-500', t: 'bg-rose-500', a: 'bg-rose-500',
};

const match1 = {
  score: '4 - 1',
  home: {
    team: 'Associazione Sportiva via Roma', formation: '3-4-2-1', formationNote: null, dFactor: 1, totale: 84.5,
    titolari: [
      { name: 'Milinkovic-Savic', role: 'por', v: null, fv: null },
      { name: 'Ahanor', role: 'dc', v: 5.5, fv: 5 },
      { name: 'Diego Carlos', role: 'dc', v: null, fv: null },
      { name: 'Scalvini', role: 'dc', v: 6, fv: 6 },
      { name: 'Palestra', role: 'dd', v: 6.5, fv: 6.5 },
      { name: 'Da Cunha', role: 'm', v: 8, fv: 14 },
      { name: 'Konè M.', role: 'c', v: 6, fv: 6 },
      { name: 'Rodriguez Je.', role: 'e', v: 7.5, fv: 11 },
      { name: 'Esposito Se.', role: 'a', v: 6.5, fv: 6.5 },
      { name: 'Pulisic', role: 'w', v: 5, fv: 5 },
      { name: 'Douvikas', role: 'a', v: 7, fv: 10 },
    ],
    panchina: [
      { name: 'Pinamonti', role: 'a', v: 5.5, fv: 5.5 },
      { name: 'Giovane', role: 'a', v: null, fv: null },
      { name: 'Thorstvedt', role: 'm', v: 5.5, fv: 5 },
      { name: 'Basic', role: 'm', v: 6, fv: 6 },
      { name: 'Fofana Y.', role: 'dd', v: 5, fv: 5 },
      { name: 'El Aynaoui', role: 'c', v: 6, fv: 6 },
      { name: 'Obrador', role: 'dc', v: 6.5, fv: 7.5 },
      { name: 'Djimsiti', role: 'dc', v: 6, fv: 6 },
      { name: 'Kabasele', role: 'dc', v: 4.5, fv: 3.5 },
      { name: 'Zappa', role: 'dd', v: 6.5, fv: 6.5 },
      { name: 'Meret', role: 'por', v: 6.5, fv: 7.5 },
      { name: 'Contini', role: 'por', v: 'sv', fv: null },
    ],
  },
  away: {
    team: 'MR EKO - C&W F.C.', formation: '4-3-3', formationNote: '4-4-2', dFactor: 1, totale: 66,
    titolari: [
      { name: 'Bijlow', role: 'por', v: null, fv: null },
      { name: 'Valeri', role: 'dd', v: 6.5, fv: 6.5 },
      { name: 'Marcandalli', role: 'dc', v: 5.5, fv: 5.5 },
      { name: 'Lucumì', role: 'dc', v: 6, fv: 6 },
      { name: 'Smolcic I.', role: 'dc', v: 6.5, fv: 6.5 },
      { name: 'Cataldi', role: 'm', v: null, fv: null },
      { name: 'Ramadani', role: 'c', v: 6, fv: 5.5 },
      { name: 'Gandelman', role: 'c', v: 6, fv: 6 },
      { name: 'Luis Henrique', role: 'w', v: 6, fv: 6 },
      { name: 'Raspadori', role: 'a', v: 6, fv: 6 },
      { name: 'Strefezza', role: 'w', v: null, fv: null },
    ],
    panchina: [
      { name: 'Paz N.', role: 'dd', v: null, fv: null },
      { name: 'Maldini', role: 'dd', v: 6, fv: 6 },
      { name: 'Barbieri', role: 'dd', v: 'sv', fv: null },
      { name: 'Zemura', role: 'dd', v: 5.5, fv: 5.5 },
      { name: 'Ehizibue', role: 'dd', v: 5.5, fv: 5.5 },
      { name: 'Marin M.', role: 'm', v: null, fv: null },
      { name: 'Zerbin', role: 'w', v: 5.5, fv: 5.5 },
      { name: 'Vandeputte', role: 'c', v: 5.5, fv: 5 },
      { name: 'Kilicsoy', role: 'a', v: null, fv: null },
      { name: 'Durosinmi', role: 'a', v: null, fv: null },
      { name: 'Leali', role: 'por', v: 6.5, fv: 5.5 },
      { name: 'Muric', role: 'por', v: null, fv: null },
    ],
  },
};

const match2 = {
  score: '2 - 2',
  home: { team: 'Monster', formation: '4-3-3', dFactor: 0, totale: 71,
    titolari: [
      { name: 'Sommer', role: 'por', v: 6, fv: 6 },
      { name: 'Bastoni', role: 'dc', v: 6.5, fv: 6.5 },
      { name: 'Bremer', role: 'dc', v: 6, fv: 6 },
      { name: 'Dimarco', role: 'dd', v: 7, fv: 9 },
    ], panchina: [] },
  away: { team: 'Fantamerda', formation: '3-5-2', dFactor: 0, totale: 71,
    titolari: [
      { name: 'Musso', role: 'por', v: 6, fv: 6 },
      { name: 'Kalulu', role: 'dc', v: 6, fv: 6 },
      { name: 'Bellanova', role: 'dd', v: 6.5, fv: 8 },
      { name: 'Bonny', role: 'a', v: 6.5, fv: 6.5 },
    ], panchina: [] },
};

// Albo d'Oro: SOLO la 2025/26 usa dati reali (Monster/Prozalpi/Fantamerda dalla
// classifica, sezione 6). Le altre annate sono illustrative — stessi nomi
// squadra reali, piazzamenti inventati — per mostrare come si comporta la
// lista su più anni. Vincitore Coppa: non l'abbiamo tra i dati condivisi
// finora, quindi illustrativo anche per il 2025/26.
const alboDOro = [
  { stagione: '2025/26', primo: 'Monster', secondo: 'Prozalpi S.F.', terzo: 'Fantamerda', coppa: 'Biancoceleste Athletic Club' },
  { stagione: '2024/25', primo: 'Prozalpi S.F.', secondo: 'Monster', terzo: 'Real Cocu 2003 Fc', coppa: 'Fantamerda' },
  { stagione: '2023/24', primo: 'Fantamerda', secondo: 'Biancoceleste Athletic Club', terzo: 'Monster', coppa: 'Prozalpi S.F.' },
  { stagione: '2022/23', mancante: true },
  { stagione: '2021/22', primo: 'Monster', secondo: 'Real Cocu 2003 Fc', terzo: 'Prozalpi S.F.', coppa: 'Los Cientoquattros Hertha Rallo' },
  { stagione: '2020/21', primo: 'Prozalpi S.F.', secondo: 'Fantamerda', terzo: 'Monster', coppa: 'Monster' },
];

// Statistiche: "Punti" sono cumulativi validi (incrementi 3/1/0) e terminano
// ai punti reali di fine stagione (sezione classifica). "Fantapunti" per
// giornata sono illustrativi al 100% — non abbiamo lo storico giornata per
// giornata tra i dati condivisi finora.
const statsTeams = {
  'Monster': {
    puntiCumulativi: [3,6,9,12,12,12,13,16,17,17,20,20,20,23,26,26,26,27,30,31,34,35,36,39,42,42,42,45,48,51,54,57,60,63,64,67,70],
    fantapuntiGiornata: [68.5,73,72.5,72,72.5,69,69,70.5,73.5,68.5,66,62,66,68,63,68.5,74,75,76,71.5,65.5,66,61.5,58.5,56.5,52,53,53.5,58.5,59.5,62,62.5,64.5,64.5,62,68,73.5],
  },
  'Prozalpi S.F.': {
    puntiCumulativi: [1,2,2,5,8,9,12,13,14,15,18,21,24,24,24,27,30,33,34,34,37,37,40,41,42,45,45,45,46,46,47,50,53,54,57,57,60],
    fantapuntiGiornata: [71.5,69,66,64,59.5,63,62.5,66.5,65.5,71,74.5,68.5,65,70,69.5,74.5,73,68,69.5,72.5,69.5,64.5,63,68.5,71.5,67,64,60,56,60,57,58.5,59,56,59.5,56.5,59],
  },
  'Fantamerda': {
    puntiCumulativi: [3,6,9,10,13,13,16,19,22,25,26,26,26,26,26,27,30,30,33,34,34,34,35,38,39,42,45,48,48,48,49,52,52,52,55,58,59],
    fantapuntiGiornata: [65.5,62.5,60.5,66.5,70,67.5,72,68.5,67,71,72.5,67.5,73,69.5,66.5,70,68,65.5,61,57,59,57,59,58,58.5,64,64.5,65.5,69.5,66,62.5,67.5,71,68,64.5,67.5,72.5],
  },
  'Real Cocu 2003 Fc': {
    puntiCumulativi: [3,6,6,9,12,12,12,12,13,14,14,15,15,16,17,20,21,24,27,30,30,30,33,33,33,36,39,39,42,42,45,48,51,51,51,54,54],
    fantapuntiGiornata: [72,76,76.5,75,70,64.5,70,67,69.5,66.5,70,71,68.5,65,67.5,63,60.5,61.5,66,67.5,65,70,66.5,61,59,59.5,55,52.5,52.5,54.5,51.5,51.5,57,63.5,65.5,67.5,68.5],
  },
};
const teamColors = { 'Monster': 'stone', 'Prozalpi S.F.': 'amber', 'Fantamerda': 'amber', 'Real Cocu 2003 Fc': 'sky' };

// Etichette pulite, non i nomi grezzi dei file excel: derivano da kind_code/
// format_code (sezione 6), stabili anche quando il nome visualizzato cambia
// nel tempo (es. "Coppa Lelle" -> "Coppa").
const competizioniOptions = ['Campionato', 'Coppa — Fase Finale', 'Coppa — Girone A', 'Coppa — Girone B'];

// ---- Sotto-componenti ----

function Crest({ name, mine }) {
  const initials = name.split(' ').filter(w => w.length > 2 || /^[A-Z]/.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || name.slice(0, 2).toUpperCase();
  return (
    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold font-serif ${mine ? 'bg-amber-400 text-emerald-950' : 'bg-emerald-800 text-amber-200'} ring-2 ${mine ? 'ring-amber-200' : 'ring-emerald-700'}`}>
      {initials}
    </div>
  );
}

function IdentityBar() {
  return (
    <div className="bg-emerald-950 text-stone-50 px-4 py-3 flex items-center gap-3">
      <Crest name="Prozalpi S.F." mine />
      <div className="min-w-0">
        <div className="font-serif font-bold tracking-tight text-base truncate">Prozalpi S.F.</div>
        <div className="text-xs text-emerald-300 truncate">Luigi Scialpi</div>
      </div>
    </div>
  );
}

function CompetitionBar({ tab, setTab }) {
  const tabs = ['Classifica', 'Formazioni', 'Calendario', 'Statistiche'];
  return (
    <div className="bg-emerald-900 text-stone-50">
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
        <div>
          <div className="font-serif font-bold uppercase tracking-wide text-sm leading-tight">Campionato FantaTopa</div>
          <div className="text-xs text-emerald-300">2025/2026 · Stagione conclusa</div>
        </div>
        <ChevronDown size={16} className="text-emerald-300 mt-1 shrink-0" />
      </div>
      <div className="flex px-2 gap-1 border-t border-emerald-800">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-t-md ${
              tab === t ? 'bg-stone-50 text-emerald-950' : 'text-emerald-200 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function WinnerBanner() {
  return (
    <div className="mx-4 mt-4 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 flex items-center gap-3">
      <Trophy size={20} className="text-amber-600 shrink-0" />
      <div className="text-sm text-stone-800">
        <span className="font-semibold">Vincitore:</span> <span className="font-serif font-bold">Monster</span>
      </div>
    </div>
  );
}

function GiornataSlider() {
  return (
    <div className="mx-4 mt-4 rounded-xl bg-white border border-stone-200 px-4 py-3">
      <div className="text-xs text-stone-500 mb-2">Andamento della classifica in un intervallo di giornate</div>
      <div className="relative h-1.5 rounded-full bg-stone-200 mb-2">
        <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-emerald-700" />
        <div className="absolute -top-1 left-0 w-3.5 h-3.5 rounded-full bg-emerald-900 ring-2 ring-white shadow" />
        <div className="absolute -top-1 right-0 w-3.5 h-3.5 rounded-full bg-emerald-900 ring-2 ring-white shadow" />
      </div>
      <div className="flex justify-between text-xs text-stone-500">
        <span>da: <strong className="text-stone-800">1ª giornata</strong></span>
        <span>a: <strong className="text-stone-800">37ª giornata</strong></span>
      </div>
    </div>
  );
}

function ClassificaRow({ row }) {
  const medal = row.pos <= 3
    ? ['bg-amber-100 text-amber-800 ring-amber-500', 'bg-stone-200 text-stone-700 ring-stone-400', 'bg-orange-100 text-orange-900 ring-orange-700'][row.pos - 1]
    : null;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${row.mine ? 'bg-amber-50/60' : ''}`}>
      <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-serif font-bold text-sm tabular-nums ${medal ? `${medal} ring-2` : 'text-stone-400'}`}>
        {row.pos}
      </div>
      <Crest name={row.team} mine={row.mine} />
      <div className="min-w-0 flex-1">
        <div className={`text-sm truncate ${row.mine ? 'font-bold text-emerald-950' : 'font-semibold text-stone-800'}`}>{row.team}</div>
        <div className="text-xs text-stone-400 tabular-nums truncate">
          {row.g}g · {row.v}v {row.n}n {row.p}p · {row.gf}-{row.gs} ({row.dr > 0 ? '+' : ''}{row.dr})
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-serif font-bold text-lg text-emerald-800 tabular-nums">{row.pt}</div>
        <div className="text-[11px] text-stone-400 tabular-nums">{row.ptTot}</div>
      </div>
    </div>
  );
}

function PlayerRow({ p }) {
  const played = p.v !== null && p.v !== 'sv';
  const delta = played && typeof p.v === 'number' && typeof p.fv === 'number' ? p.fv - p.v : null;
  // Non sappiamo SE sia un gol, un assist o un'ammonizione — l'excel non riporta
  // il dettaglio bonus/malus, solo voto e fantavoto (vedi sezione 6). Segnaliamo
  // solo l'entità dello scarto, senza inventare un evento specifico.
  const notable = delta !== null && Math.abs(delta) >= 2;
  const fvColor = !played ? 'text-stone-300' : notable ? (delta > 0 ? 'text-emerald-700' : 'text-red-700') : 'text-stone-600';
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className={`w-2 h-2 rounded-full shrink-0 ${roleColor[p.role] || 'bg-stone-300'}`} />
      <span className="text-sm text-stone-700 truncate flex-1">{p.name}</span>
      <span className="text-xs text-stone-400 w-6 text-right tabular-nums shrink-0">{p.v === null ? '–' : p.v}</span>
      <span className={`text-xs w-7 text-right tabular-nums shrink-0 ${notable ? 'font-bold' : 'font-medium'} ${fvColor}`}>{p.fv ?? '–'}</span>
    </div>
  );
}

function LineupColumn({ side }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-6 h-0.5 bg-amber-600" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Titolari</span>
      </div>
      <div className="divide-y divide-stone-100">
        {side.titolari.map((p, i) => <PlayerRow key={i} p={p} />)}
      </div>
      {side.panchina.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 mt-3 mb-1.5">
            <span className="w-6 h-0.5 bg-stone-300" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Panchina</span>
          </div>
          <div className="divide-y divide-stone-100">
            {side.panchina.map((p, i) => <PlayerRow key={i} p={p} />)}
          </div>
        </>
      )}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-200">
        <span className="text-xs text-stone-400">D-Factor {side.dFactor}</span>
        <div className="rounded-lg bg-emerald-900 text-amber-300 font-serif font-bold text-lg px-3 py-1 tabular-nums">
          {side.totale}
        </div>
      </div>
    </div>
  );
}

function MatchCard({ m, expanded, onToggle, collapsible }) {
  return (
    <div className="mx-4 mt-4 rounded-xl bg-white border border-stone-200 overflow-hidden">
      <button
        onClick={collapsible ? onToggle : undefined}
        className={`w-full bg-emerald-950 text-stone-50 px-4 py-3 flex items-center gap-3 ${collapsible ? 'cursor-pointer' : ''}`}
      >
        <Crest name={m.home.team} />
        <div className="flex-1 min-w-0 text-left">
          <div className="text-xs font-medium truncate">{m.home.team}</div>
        </div>
        <div className="font-serif font-bold text-lg text-amber-300 tabular-nums shrink-0 px-2">{m.score}</div>
        <div className="flex-1 min-w-0 text-right">
          <div className="text-xs font-medium truncate">{m.away.team}</div>
        </div>
        <Crest name={m.away.team} />
        {collapsible && <ChevronRight size={16} className={`shrink-0 text-emerald-300 transition-transform ${expanded ? 'rotate-90' : ''}`} />}
      </button>

      {(!collapsible || expanded) && (
        <div className="px-4 py-3">
          <div className="flex justify-between text-xs text-stone-400 mb-3">
            <span>{m.home.formation}{m.home.formationNote && <span className="text-stone-300"> (dopo i cambi {m.home.formationNote})</span>}</span>
            <span>{m.away.formation}{m.away.formationNote && <span className="text-stone-300"> (dopo i cambi {m.away.formationNote})</span>}</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            <LineupColumn side={m.home} />
            <div className="hidden sm:block w-px bg-stone-200" />
            <LineupColumn side={m.away} />
          </div>
        </div>
      )}
    </div>
  );
}

function PodiumBlock({ pos, team, height }) {
  const style = {
    1: { bar: 'bg-amber-400', ring: 'ring-amber-500', text: 'text-amber-900' },
    2: { bar: 'bg-stone-300', ring: 'ring-stone-400', text: 'text-stone-700' },
    3: { bar: 'bg-orange-300', ring: 'ring-orange-600', text: 'text-orange-900' },
  }[pos];
  return (
    <div className="flex flex-col items-center flex-1 min-w-0">
      <Crest name={team} />
      <div className="text-xs font-semibold text-stone-700 text-center truncate w-full mt-1 mb-2 px-1">{team}</div>
      <div className={`w-full rounded-t-lg ${style.bar} ring-2 ${style.ring} flex items-start justify-center pt-1`} style={{ height }}>
        <span className={`font-serif font-bold text-xl ${style.text}`}>{pos}</span>
      </div>
    </div>
  );
}

function Podium({ primo, secondo, terzo }) {
  return (
    <div className="flex items-end gap-2 px-2">
      <PodiumBlock pos={2} team={secondo} height="72px" />
      <PodiumBlock pos={1} team={primo} height="104px" />
      <PodiumBlock pos={3} team={terzo} height="52px" />
    </div>
  );
}

function CoppaWinner({ team }) {
  return (
    <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-2">
      <Trophy size={16} className="text-emerald-700 shrink-0" />
      <span className="text-xs text-stone-600">Vincitore Coppa: <span className="font-semibold text-emerald-900">{team}</span></span>
    </div>
  );
}

function AlboDOroView() {
  return (
    <div className="mx-4 mt-4 space-y-6 pb-4">
      {alboDOro.map(s => (
        <div key={s.stagione} className="rounded-xl bg-white border border-stone-200 p-4">
          <div className="flex items-center gap-1.5 mb-4">
            <Medal size={15} className="text-amber-600" />
            <span className="font-serif font-bold text-emerald-950">{s.stagione}</span>
          </div>
          {s.mancante ? (
            <div className="text-xs text-stone-400 italic py-3 text-center">Dati non disponibili per questa stagione</div>
          ) : (
            <>
              <Podium primo={s.primo} secondo={s.secondo} terzo={s.terzo} />
              <CoppaWinner team={s.coppa} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function TeamPicker({ value, onChange, colorKey }) {
  const dotColor = { amber: 'bg-amber-500', sky: 'bg-sky-600', stone: 'bg-stone-500' }[colorKey] || 'bg-stone-400';
  return (
    <div className="flex-1 flex items-center gap-2 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 min-w-0">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} />
      <select
        className="flex-1 min-w-0 text-xs font-semibold text-stone-800 bg-transparent focus:outline-none truncate"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        {Object.keys(statsTeams).map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}

function StatisticheView() {
  const [team1, setTeam1] = useState('Prozalpi S.F.');
  const [team2, setTeam2] = useState('Real Cocu 2003 Fc');
  const [competizione, setCompetizione] = useState('Campionato');
  const [statType, setStatType] = useState('punti');

  const swap = () => { const t = team1; setTeam1(team2); setTeam2(t); };

  const key = statType === 'punti' ? 'puntiCumulativi' : 'fantapuntiGiornata';
  const data = statsTeams[team1][key].map((_, i) => ({
    giornata: i + 1,
    team1: statsTeams[team1][key][i],
    team2: statsTeams[team2][key][i],
  }));

  return (
    <div className="mx-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <TeamPicker value={team1} onChange={setTeam1} colorKey="amber" />
        <button onClick={swap} className="shrink-0 p-1.5 text-stone-400 hover:text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 rounded-md">
          <ArrowLeftRight size={15} />
        </button>
        <TeamPicker value={team2} onChange={setTeam2} colorKey="sky" />
      </div>
      <div className="flex gap-2 mb-4">
        <select
          className="flex-1 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          value={competizione}
          onChange={e => setCompetizione(e.target.value)}
        >
          {competizioniOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="flex-1 text-xs font-medium text-stone-700 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700"
          value={statType}
          onChange={e => setStatType(e.target.value)}
        >
          <option value="punti">Punti (classifica)</option>
          <option value="fantapunti">Fantapunti (di giornata)</option>
        </select>
      </div>

      {competizione !== 'Campionato' && (
        <div className="text-xs text-stone-400 italic mb-2">Dati non ancora disponibili per questa competizione in questo mockup — mostro comunque il Campionato.</div>
      )}

      <div className="rounded-xl bg-white border border-stone-200 p-3">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" />
              <XAxis dataKey="giornata" tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#78716c' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e7e5e4' }} />
              <Line type="monotone" dataKey="team1" stroke="#d97706" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="team2" stroke="#0284c7" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-1">
          <span className="flex items-center gap-1.5 text-xs text-stone-500"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />{team1}</span>
          <span className="flex items-center gap-1.5 text-xs text-stone-500"><span className="w-2.5 h-2.5 rounded-full bg-sky-600" />{team2}</span>
        </div>
      </div>
    </div>
  );
}

function ClassificaView() {
  return (
    <>
      <WinnerBanner />
      <GiornataSlider />
      <div className="mx-4 mt-4 rounded-xl bg-white border border-stone-200 divide-y divide-stone-100 overflow-hidden">
        {classifica.map(row => <ClassificaRow key={row.team} row={row} />)}
      </div>
    </>
  );
}

function FormazioniView() {
  const [expanded, setExpanded] = useState(null);
  return (
    <>
      <div className="mx-4 mt-4 flex items-center justify-between">
        <select className="text-sm font-semibold text-emerald-900 bg-white border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700" defaultValue="37">
          {[37, 36, 35].map(n => <option key={n} value={n}>{n}ª giornata</option>)}
        </select>
        <button className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-emerald-800 px-2 py-1.5">
          <Share2 size={14} /> Condividi
        </button>
      </div>
      <MatchCard m={match1} expanded />
      <MatchCard m={match2} expanded={expanded === 1} onToggle={() => setExpanded(expanded === 1 ? null : 1)} collapsible />
      <div className="mx-4 mt-4 text-center text-xs text-stone-400 pb-2">+ le altre partite della giornata, stesso formato</div>
    </>
  );
}

function TopNav({ view, setView }) {
  const items = [
    { key: 'archivio', label: 'Archivio stagioni' },
    { key: 'albo', label: "Albo d'Oro" },
  ];
  return (
    <div className="bg-emerald-950 px-4 pt-2 flex gap-4 border-b border-emerald-900">
      {items.map(it => (
        <button
          key={it.key}
          onClick={() => setView(it.key)}
          className={`text-xs font-semibold uppercase tracking-wide pb-2 border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
            view === it.key ? 'text-amber-300 border-amber-400' : 'text-emerald-400 border-transparent hover:text-emerald-200'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export default function FantaTopaMockup() {
  const [view, setView] = useState('archivio');
  const [tab, setTab] = useState('Classifica');
  return (
    <div className="min-h-screen bg-stone-100 font-sans pb-8">
      <IdentityBar />
      <TopNav view={view} setView={setView} />
      {view === 'albo' ? (
        <AlboDOroView />
      ) : (
        <>
          <CompetitionBar tab={tab} setTab={setTab} />
          {tab === 'Classifica' && <ClassificaView />}
          {tab === 'Formazioni' && <FormazioniView />}
          {tab === 'Statistiche' && <StatisticheView />}
          {tab === 'Calendario' && (
            <div className="mx-4 mt-8 text-center text-sm text-stone-400">
              Calendario — stesso linguaggio visivo, arriva nel prossimo giro.
            </div>
          )}
        </>
      )}
    </div>
  );
}
