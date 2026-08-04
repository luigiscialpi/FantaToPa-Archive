// packages/ingestion/scripts/fetch-bonus-fantacalcio-it.ts
//
// Scarica e mette in cache su disco le pagine pubbliche
// https://www.fantacalcio.it/voti-fantacalcio-serie-a/{stagione}/{giornata}
// (Fase 7, vedi docs/bonus-storici-fantacalcio-it.md) — un file per
// giornata in docs/html-fantacalcio-it/{stagione}/. Le pagine grezze sono
// la fonte di verità su disco (stessa filosofia di docs/html/ per il
// 2025-26): se il file esiste già non viene riscaricato, così questo
// script è idempotente e ripetibile senza pesare sul sito sorgente.
//
// Uso: tsx packages/ingestion/scripts/fetch-bonus-fantacalcio-it.ts <stagione> [numGiornate]
//   es. tsx packages/ingestion/scripts/fetch-bonus-fantacalcio-it.ts 2024-25 38
// Nessuna rete Supabase qui, solo fetch HTTP verso fantacalcio.it — non
// serve dotenv-cli/env Supabase per questo script.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_MATCHDAYS = 38;
// Ritardo conservativo fra una richiesta e l'altra, per non martellare il
// sito sorgente (nessun rate limit noto documentato, meglio essere prudenti).
const DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheDir(seasonSlug: string): string {
  return fileURLToPath(new URL(`../../../docs/html-fantacalcio-it/${seasonSlug}`, import.meta.url));
}

function cacheFile(seasonSlug: string, matchday: number): string {
  return path.join(cacheDir(seasonSlug), `${String(matchday).padStart(2, '0')}.html`);
}

async function fetchGiornata(seasonSlug: string, matchday: number): Promise<string> {
  const url = `https://www.fantacalcio.it/voti-fantacalcio-serie-a/${seasonSlug}/${matchday}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} per ${url}`);
  return res.text();
}

async function main(): Promise<void> {
  const seasonSlug = process.argv[2];
  const numMatchdays = Number(process.argv[3] ?? DEFAULT_MATCHDAYS);
  if (!seasonSlug) {
    throw new Error('Uso: tsx fetch-bonus-fantacalcio-it.ts <stagione, es. 2024-25> [numGiornate]');
  }

  const dir = cacheDir(seasonSlug);
  await mkdir(dir, { recursive: true });

  for (let matchday = 1; matchday <= numMatchdays; matchday++) {
    const file = cacheFile(seasonSlug, matchday);
    if (existsSync(file)) {
      const cached = await readFile(file, 'utf-8');
      console.log(`  giornata ${matchday}: già in cache (${cached.length} byte), salto il fetch`);
      continue;
    }
    const html = await fetchGiornata(seasonSlug, matchday);
    await writeFile(file, html, 'utf-8');
    console.log(`  giornata ${matchday}: scaricata e salvata (${html.length} byte)`);
    await sleep(DELAY_MS);
  }

  console.log(`\nFetch completato per ${seasonSlug}: ${numMatchdays} giornate in ${dir}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    console.error('Fetch bonus fantacalcio.it fallito:', err);
    process.exit(1);
  });
}
