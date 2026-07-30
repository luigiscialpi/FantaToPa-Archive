// packages/ingestion/scripts/season-configs.ts
//
// Config per-stagione: sostituisce le costanti fisse di
// pilot-import-2025-26.ts (ora import-season.ts). La STRUTTURA delle
// cartelle (quali sottocartelle esistono, come si chiamano) varia stagione
// per stagione in modo non prevedibile ("Coppa Lelle" vs "Coppa", "Girone"
// vs "Gruppo", "Fase Finale" vs "Fase finale") — per questo resta esplicita
// qui invece di provare a indovinarla; i NOMI FILE dentro ogni cartella
// invece sono scoperti per prefisso+estensione (vedi lib/discover-files.ts),
// perché quelli sì cambiano in modo scomodo (suffissi diversi) senza un
// pattern legato alla struttura.
//
// Vedi memoria repo `legacy-seasons-compat.md` per la verifica dettagliata
// di ogni riga di questa tabella (fatta leggendo le cartelle reali, non a
// occhio sui nomi).
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

export type Ruleset = 'classico' | 'mantra';

export interface CoppaGroupFiles {
  /** Cartella con Classifica_*.xlsx e Formazioni_*.xlsx del girone/gruppo. */
  folder: string;
}

export interface CoppaFaseFinaleFiles {
  /** Cartella con Calendario_*.xlsx (e Formazioni_*.xlsx, quando presenti). */
  folder: string;
}

export interface SeasonBrandingFolders {
  /** Cartella con le immagini logo squadra (nome file ≈ nome squadra). */
  loghi: string;
  /** Cartella con le immagini maglia squadra (nome file ≈ nome squadra). */
  maglie: string;
}

export interface SeasonConfig {
  slug: string;
  label: string;
  startsOn: string;
  endsOn: string;
  ruleset: Ruleset;
  /** Cartella root della stagione (radice dello zip estratto in docs/). */
  root: string;
  /** undefined = rosa d'asta assente per questa stagione (2022-23: nessun Rose_*.xlsx nello zip). */
  rosterFolder: string | undefined;
  /** undefined = nessuna cartella "Loghi & Maglie" raccolta per questa stagione. */
  brandingFolder: SeasonBrandingFolders | undefined;
  campionato: {
    /** Cartella con Classifica_*.xlsx e Calendario_*.xlsx del campionato. */
    folder: string;
    /** Cartella con Formazioni_*.xlsx del campionato. */
    lineupsFolder: string;
  };
  coppa?: {
    gironeA?: CoppaGroupFiles;
    gironeB?: CoppaGroupFiles;
    faseFinale?: CoppaFaseFinaleFiles;
    /** Nuovo dal 2024-25: spareggio salvezza/qualificazione, solo formazioni (1 giornata). */
    spareggio?: { folder: string };
  };
}

const DOCS_ROOT = fileURLToPath(new URL('../../../docs', import.meta.url));

function seasonRoot(folderName: string): string {
  return path.join(DOCS_ROOT, folderName);
}

const ROOT_2020_21 = seasonRoot('Fantacalcio 2020-2021');
const ROOT_2021_22 = seasonRoot('Fantacalcio 2021-2022');
const ROOT_2022_23 = seasonRoot('Fantacalcio 2022-2023');
const ROOT_2023_24 = seasonRoot('Fantacalcio 2023-2024');
const ROOT_2024_25 = seasonRoot('Fantacalcio 2024-2025');
const ROOT_2025_26 = seasonRoot('Fantacalcio 2025-2026');

export const SEASON_CONFIGS: SeasonConfig[] = [
  {
    slug: '2020-21',
    label: 'Stagione 2020/2021',
    startsOn: '2020-08-01',
    endsOn: '2021-06-30',
    ruleset: 'classico',
    root: ROOT_2020_21,
    rosterFolder: ROOT_2020_21,
    brandingFolder: undefined,
    campionato: {
      folder: ROOT_2020_21, // niente sottocartella "Campionato/" per questa stagione
      lineupsFolder: path.join(ROOT_2020_21, 'Formazioni di giornata'),
    },
    coppa: {
      // Girone A/B e Fase Finale condividono la STESSA cartella flat (niente
      // formazioni Coppa per questa stagione, verificato — 0 file Formazioni_*.xlsx).
      gironeA: { folder: path.join(ROOT_2020_21, 'Coppa Lelle') },
      gironeB: { folder: path.join(ROOT_2020_21, 'Coppa Lelle') },
      faseFinale: { folder: path.join(ROOT_2020_21, 'Coppa Lelle') },
    },
  },
  {
    slug: '2021-22',
    label: 'Stagione 2021/2022',
    startsOn: '2021-08-01',
    endsOn: '2022-06-30',
    ruleset: 'classico',
    root: ROOT_2021_22,
    rosterFolder: ROOT_2021_22,
    brandingFolder: undefined,
    campionato: {
      folder: ROOT_2021_22,
      lineupsFolder: path.join(ROOT_2021_22, 'Formazioni di giornata'),
    },
    coppa: {
      // Stessa struttura flat del 2020-21. Calendario Girone A/B qui è solo
      // .jpg (non recuperabile via adapter): niente calendario girone da
      // importare comunque (import-season non lo fa per nessuna stagione).
      gironeA: { folder: path.join(ROOT_2021_22, 'Coppa Lelle') },
      gironeB: { folder: path.join(ROOT_2021_22, 'Coppa Lelle') },
      faseFinale: { folder: path.join(ROOT_2021_22, 'Coppa Lelle') },
    },
  },
  {
    slug: '2022-23',
    label: 'Stagione 2022/2023',
    startsOn: '2022-08-01',
    endsOn: '2023-06-30',
    ruleset: 'classico',
    root: ROOT_2022_23,
    // Nessun Rose_fantatopa.xlsx nello zip per questa stagione — verificato,
    // non è in nessuna sottocartella. Squadre seminate dalla classifica.
    rosterFolder: undefined,
    // Nessuna cartella "Loghi & Maglie" per questa stagione — verificato.
    brandingFolder: undefined,
    campionato: {
      folder: path.join(ROOT_2022_23, 'Campionato'),
      lineupsFolder: path.join(ROOT_2022_23, 'Campionato', 'Formazioni'),
    },
    coppa: {
      gironeA: { folder: path.join(ROOT_2022_23, 'Coppa Lelle', 'Girone A') },
      gironeB: { folder: path.join(ROOT_2022_23, 'Coppa Lelle', 'Girone B') },
      faseFinale: { folder: path.join(ROOT_2022_23, 'Coppa Lelle', 'Fase Finale') },
    },
  },
  {
    slug: '2023-24',
    label: 'Stagione 2023/2024',
    startsOn: '2023-08-01',
    endsOn: '2024-06-30',
    ruleset: 'mantra', // Mantra ma senza il ruolo B (Terzino) — nessuna azione richiesta, il ruolo semplicemente non compare nei dati
    root: ROOT_2023_24,
    rosterFolder: ROOT_2023_24,
    brandingFolder: {
      loghi: path.join(ROOT_2023_24, 'Loghi & Maglie', 'Loghi'),
      maglie: path.join(ROOT_2023_24, 'Loghi & Maglie', 'Maglie'),
    },
    campionato: {
      folder: path.join(ROOT_2023_24, 'Campionato'),
      lineupsFolder: path.join(ROOT_2023_24, 'Campionato', 'Formazioni'),
    },
    coppa: {
      gironeA: { folder: path.join(ROOT_2023_24, 'Coppa', 'Gruppo A') },
      gironeB: { folder: path.join(ROOT_2023_24, 'Coppa', 'Gruppo B') },
      faseFinale: { folder: path.join(ROOT_2023_24, 'Coppa', 'Fase finale') }, // "finale" minuscola
    },
  },
  {
    slug: '2024-25',
    label: 'Stagione 2024/2025',
    startsOn: '2024-08-01',
    endsOn: '2025-06-30',
    ruleset: 'mantra',
    root: ROOT_2024_25,
    rosterFolder: ROOT_2024_25,
    brandingFolder: {
      loghi: path.join(ROOT_2024_25, 'Loghi & Maglie', 'Loghi'),
      maglie: path.join(ROOT_2024_25, 'Loghi & Maglie', 'Maglie'),
    },
    campionato: {
      folder: path.join(ROOT_2024_25, 'Campionato'),
      lineupsFolder: path.join(ROOT_2024_25, 'Campionato', 'Formazioni'),
    },
    coppa: {
      gironeA: { folder: path.join(ROOT_2024_25, 'Coppa', 'Gruppo A') },
      gironeB: { folder: path.join(ROOT_2024_25, 'Coppa', 'Gruppo B') },
      faseFinale: { folder: path.join(ROOT_2024_25, 'Coppa', 'Fase Finale') },
      // Nuovo: solo formazioni (1 giornata), niente classifica/calendario.
      spareggio: { folder: path.join(ROOT_2024_25, 'Coppa', 'Spareggio') },
    },
  },
  {
    slug: '2025-26',
    label: 'Stagione 2025/2026',
    startsOn: '2025-08-01',
    endsOn: '2026-06-30',
    ruleset: 'mantra',
    root: ROOT_2025_26,
    rosterFolder: ROOT_2025_26,
    brandingFolder: {
      loghi: path.join(ROOT_2025_26, 'Loghi & Maglie', 'Loghi'),
      maglie: path.join(ROOT_2025_26, 'Loghi & Maglie', 'Maglie'),
    },
    campionato: {
      folder: path.join(ROOT_2025_26, 'Campionato'),
      lineupsFolder: path.join(ROOT_2025_26, 'Campionato', 'Formazioni'),
    },
    coppa: {
      gironeA: { folder: path.join(ROOT_2025_26, 'Coppa', 'Gruppo A') },
      gironeB: { folder: path.join(ROOT_2025_26, 'Coppa', 'Gruppo B') },
      faseFinale: { folder: path.join(ROOT_2025_26, 'Coppa', 'Fase Finale') },
    },
  },
];

export function getSeasonConfig(slug: string): SeasonConfig {
  const config = SEASON_CONFIGS.find((s) => s.slug === slug);
  if (!config) {
    throw new Error(
      `Stagione "${slug}" non configurata. Stagioni disponibili: ${SEASON_CONFIGS.map((s) => s.slug).join(', ')}`,
    );
  }
  return config;
}
