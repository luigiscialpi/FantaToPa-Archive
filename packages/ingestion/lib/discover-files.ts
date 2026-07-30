// packages/ingestion/lib/discover-files.ts
//
// Discovery per prefisso+estensione invece di nomi file esatti: il dataset
// (5 stagioni legacy + 2025-26) usa nomi file diversi stagione per stagione
// per lo stesso contenuto (es. suffisso classifica coppa girone: "GIRONE-A"
// 2020-21/2021-22/2024-25, "GIR.-A" 2022-23/2025-26, "GRUPPO-A" 2023-24).
// Filtrare SEMPRE anche per estensione, non solo per prefisso testuale: le
// cartelle contengono spesso screenshot/jpg con lo stesso prefisso del vero
// xlsx (es. "Classifica.jpg" accanto a "Classifica_CAMPIONATO...xlsx").
import { readdir } from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Trova, in `folder`, l'unico file .xlsx il cui nome (case-insensitive)
 * inizia per `prefix` e, se fornito, contiene anche `mustInclude`.
 * `mustInclude` serve a disambiguare quando più file con lo stesso prefisso
 * convivono nella stessa cartella (es. calendario Girone A/B/Fase Finale
 * tutti in "Coppa Lelle/" per le stagioni 2020-21/2021-22).
 * Torna `undefined` se la cartella non esiste o non contiene un file simile
 * (dato mancante alla fonte, non un errore — vedi i placeholder "File non
 * disponibile." di alcune stagioni).
 */
export async function findXlsxByPrefix(
  folder: string,
  prefix: string,
  mustInclude?: string,
): Promise<string | undefined> {
  let entries: string[];
  try {
    entries = await readdir(folder);
  } catch {
    return undefined;
  }

  const match = entries.find((name) => {
    const lower = name.toLowerCase();
    if (!lower.startsWith(prefix.toLowerCase()) || !lower.endsWith('.xlsx')) return false;
    if (mustInclude && !lower.includes(mustInclude.toLowerCase())) return false;
    return true;
  });

  return match ? path.join(folder, match) : undefined;
}

/**
 * Tutti i file .xlsx in `folder` il cui nome inizia per `prefix`, ordinati
 * numericamente (per "Formazioni_fantatopa_2_giornata" prima di "_10_").
 * Lista vuota se la cartella non esiste o non contiene match (stagioni
 * senza formazioni Coppa, es. 2020-21/2021-22: non è un errore).
 */
export async function listXlsxByPrefix(folder: string, prefix: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(folder);
  } catch {
    return [];
  }

  return entries
    .filter((name) => {
      const lower = name.toLowerCase();
      return lower.startsWith(prefix.toLowerCase()) && lower.endsWith('.xlsx');
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => path.join(folder, name));
}
