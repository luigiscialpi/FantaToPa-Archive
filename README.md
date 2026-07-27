# Archivio Storico FantaTopa

Piano di sviluppo completo: [`piano-sviluppo-fantatopa-archive.md`](./piano-sviluppo-fantatopa-archive.md).
Convenzioni per lo sviluppo (anche assistito da AI): [`AGENTS.md`](./AGENTS.md).

## Cosa è già pronto in questo scaffold

- Schema dati completo + Row Level Security — **testato per davvero** contro un
  Postgres locale in Fase 0 (non solo scritto e assunto corretto): tutte le
  tabelle, i trigger, le funzioni di sicurezza, e un bug reale già trovato e
  corretto (`registration_requests.first_name`/`last_name` nullable — vedi il
  commento nella migrazione per il perché).
- `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` e le skill di
  progetto (`fantatopa-dev`, `ponytail`) in `.agents/skills/`.
- Workspace npm (`apps/`, `packages/`), TypeScript `strict: true`, ESLint con
  `@typescript-eslint/no-explicit-any` a `error`.
- Workflow GitHub Actions: CI (typecheck/lint/test), keepalive Supabase ogni 3
  giorni, backup settimanale (piano free Supabase non ha backup automatici —
  sezione 14 del piano).

## Cosa devi fare tu (non posso farlo da qui: serve il tuo account, io non ho
accesso di rete a supabase.com né alle tue credenziali)

1. **Crea due progetti Supabase** (piano free): uno per `staging`, uno per
   `prod` — sezione 4 del piano.
2. **Collega il repo**:
   ```bash
   npm install -g supabase
   supabase login
   supabase link --project-ref <ref-staging>
   ```
3. **Applica la migrazione** (già scritta e testata):
   ```bash
   supabase db push
   ```
4. **Copia `.env.example` in `.env.local`** e riempi le chiavi (Supabase
   Dashboard → Project Settings → API).
5. **Registrati normalmente dal sito una volta che gira**, poi segui
   `supabase/seed/00_admin.sql` per promuoverti ad admin — è un passo manuale
   apposta, il tuo id utente non esiste finché non ti registri.
6. **Secrets GitHub** (Settings → Secrets → Actions), per i workflow già
   pronti: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (keepalive),
   `SUPABASE_DB_URL` (backup), più quelli di prod quando aggiungi il workflow
   di deploy migrazioni (non ancora scritto — sezione 4 del piano: prod riceve
   push solo da CI, mai a mano).
7. **Netlify**: collega il repo, scoping delle env var per contesto (preview ≠
   prod — sezione 14).

## Cosa NON c'è ancora in questo scaffold

Il resto della Fase 0/1 (adapter di ingestion, generazione tipi TS da Supabase,
prime pagine Next.js) — costruiamoli uno alla volta da qui, non tutti insieme:
più facile da rivedere, coerente con come abbiamo lavorato finora su questo
piano.
