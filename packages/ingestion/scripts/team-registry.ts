// packages/ingestion/scripts/team-registry.ts
//
// `teams` è un'identità persistente nel tempo (vedi commento nella migration
// iniziale): una squadra che cambia nome da una stagione all'altra è la
// STESSA riga `teams`, con i nomi storici salvati come alias — stesso
// meccanismo già usato per i giocatori. Senza questo registro, un rename
// (es. "Hertha Rallo" -> "Los Cientoquattros Hertha Rallo") creerebbe due
// righe `teams` distinte e spezzerebbe la storia della squadra (rilevante
// per pagine cross-stagione come l'Albo d'Oro).
//
// I dati reali (nomi/manager di QUESTA lega privata) non vivono più in
// questo file sorgente: andrebbero committati in un codice potenzialmente
// distribuibile ad altre leghe. Vivono in team-registry.local.json
// (gitignored, accanto a questo file) — copiare team-registry.example.json
// la prima volta e compilarlo con i dati reali. Questo file resta solo il
// loader + la validazione Zod, seguendo lo stesso schema-per-concern usato
// in packages/ingestion/schema/imports.ts.
//
// Il registro viene seminato nel database UNA TANTUM con
// seed-team-registry.ts (non ad ogni import-season.ts): dopo il seed, teams/
// team_aliases nel database sono la fonte di verità, questo file JSON serve
// solo a (ri)popolarli quando cambiano.
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const TeamIdentitySchema = z.object({
  /** Nome canonico attuale: quello che finisce in teams.canonical_name. */
  canonicalName: z.string().min(1),
  /** Nomi con cui la stessa squadra/manager è comparsa in stagioni precedenti. */
  aliases: z.array(z.string()).default([]),
});
export type TeamIdentity = z.infer<typeof TeamIdentitySchema>;

const TeamRegistrySchema = z.array(TeamIdentitySchema);

const REGISTRY_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'team-registry.local.json');

export async function loadTeamRegistry(): Promise<TeamIdentity[]> {
  let raw: string;
  try {
    raw = await readFile(REGISTRY_PATH, 'utf-8');
  } catch {
    throw new Error(
      `Registro squadre non trovato (${REGISTRY_PATH}). Copia team-registry.example.json in ` +
        'team-registry.local.json nella stessa cartella e compilalo con nomi/alias reali.',
    );
  }
  return TeamRegistrySchema.parse(JSON.parse(raw));
}
