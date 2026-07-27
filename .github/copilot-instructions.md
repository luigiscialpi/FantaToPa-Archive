# Copilot — istruzioni repository

Le convenzioni complete (architettura, pattern non ovvi, sicurezza) vivono in
[`AGENTS.md`](../AGENTS.md) nella root — leggi quello prima di proporre modifiche. Qui
solo le note operative specifiche di Copilot.

## Build, test, validazione

- `npm install` alla root (workspace npm)
- `npm run typecheck` — deve passare senza errori, niente `any` impliciti
- `npm run lint` — ESLint, `@typescript-eslint/no-explicit-any` è `error`, non `warn`
- `npm run test` — Vitest; per l'ingestion (`packages/ingestion`) include sia i test di
  regressione dei parser sia gli unit test del loader (con `InMemorySeasonRepository`,
  senza rete)

Prima di aprire una PR: tutti e tre devono passare. Se una modifica tocca
`supabase/migrations/`, verificare anche con `supabase db reset` in locale.

## Cosa evitare

- Non modificare `supabase/migrations/*.sql` già applicate: crearne una nuova.
- Non aggiungere campi a `lineup_players` per bonus/malus (gol, assist, cartellini): la
  fonte dati non li fornisce — vedi `AGENTS.md`.
- Non scrivere query Supabase dentro i componenti React: passare dal repository layer in
  `apps/web/lib/queries/`.
