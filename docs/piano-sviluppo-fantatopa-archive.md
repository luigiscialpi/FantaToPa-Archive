# Piano di Sviluppo — Archivio Storico FantaTopa

> Working title. Sito che raccoglie e presenta tutte le edizioni storiche della lega fantacalcio, a partire dai dati in `Fantacalcio.zip` (stagioni 2020-21, 2021-22, 2022-23, 2023-24, 2024-25, 2025-26) più le edizioni ancora più vecchie salvate come siti interi scaricati, per cui l'approccio si deciderà più avanti.
>
> **Aggiornamento**: la 2022-23 — indicata più sotto come "confermata mancante" nella stesura originale di questo piano — è stata in realtà recuperata separatamente ed è oggi una sesta stagione importabile come le altre, con alcune lacune reali proprie (niente `Rose_fantatopa.xlsx`, dati Coppa gironi/Fase Finale incompleti) ma non un buco totale. Vedi sezione 8 per il quadro aggiornato delle lacune dati per stagione.
>
> **Aggiornamento (stagione 2018-19)**: le "edizioni ancora più vecchie salvate come siti interi scaricati" hanno ora un primo caso reale — un mirror statico del vecchio sito "Leghe Fantagazzetta", importato con un adapter dedicato (non OCR: i dati sono già in HTML/JS embedded, non immagini). Vedi sezione 7.2 per il meccanismo e le lacune specifiche di questa fonte.

## Indice

1. [Executive summary](#1-executive-summary)
2. [Audit dei dati sorgente](#2-audit-dei-dati-sorgente)
3. [Principio guida per la scalabilità](#3-principio-guida-per-la-scalabilità)
4. [Stack tecnico](#4-stack-tecnico)
5. [Struttura del repository](#5-struttura-del-repository)
6. [Modello dati](#6-modello-dati)
7. [Pipeline di ingestion](#7-pipeline-di-ingestion)
8. [Dati legacy e OCR](#8-dati-legacy-e-ocr)
9. [Autenticazione e ruoli](#9-autenticazione-e-ruoli)
10. [Presentazione dei dati (frontend/UX)](#10-presentazione-dei-dati-frontendux)
11. [Roadmap a fasi](#11-roadmap-a-fasi)
12. [Domande aperte](#12-domande-aperte)
13. [Prossimo passo pratico](#13-prossimo-passo-pratico)
14. [Checklist pre-avvio e convenzioni di sviluppo](#14-checklist-pre-avvio-e-convenzioni-di-sviluppo)

---

## 1. Executive summary

Obiettivo: sito Next.js/React (mobile-friendly), backend Supabase (Postgres + Auth + Storage), deploy Netlify, che mostra classifiche, calendari, rose, formazioni e statistiche di tutte le edizioni della lega, con login utenti normali/admin.

Rispetto alla prima bozza, questa versione è pensata esplicitamente attorno a un vincolo che hai posto tu: **aggiungere una stagione o una funzionalità non deve rompere nulla di esistente.** La sezione 3 spiega come questo si traduce in scelte tecniche concrete, non solo in buone intenzioni.

> **Nota di revisione (v2)**: sezioni 6, 7 e 10 sono state riviste con un passaggio esplicito da senior architect (principi SOLID applicati allo schema e alla pipeline di ingestion) e da UI/UX designer (gerarchia dell'informazione, non solo "responsive"). Alcune scelte del v1 erano deboli, non solo migliorabili — vedi in particolare il cambio su `competitions`/`import_batches` e sulla sezione 10.

## 2. Audit dei dati sorgente

Aperti tutti i file dello zip. Riepilogo:

| Elemento | Formato | Note |
|---|---|---|
| Rose (`Rose_fantatopa.xlsx`) | xlsx, squadre affiancate a coppie di colonne | `Ruolo, Calciatore, Squadra, Costo` |
| Calendario | xlsx, giornate affiancate | risultati e punteggi per giornata |
| Classifica | xlsx tabellare pulita | `Pos, Squadra, G, V, N, P, Gf, Gs, Dr, Pt, Pt. Totali` |
| Formazioni per giornata | xlsx, un foglio per giornata, blocchi verticali per partita | intestazione con nomi+risultato, modulo, titolari, riga `Panchina`, riserve |
| Coppa | sotto-cartelle `Gruppo A/B`, `Fase Finale`, in alcuni anni `Spareggio`, in altri chiamata "Coppa Lelle" | stessa struttura di Campionato ma annidata |
| Quotazioni asta | xlsx | valori giocatori pre-stagione |
| Loghi/Maglie | png, nome file ≈ nome squadra | **incoerente tra stagioni** |
| Regolamento | pdf, nome/versione diversi ogni anno | |
| Coppa gironi 2020-21/2021-22 (calendario) | **solo .jpg** (screenshot), non xlsx | unico dato di quelle 2 stagioni realmente non recuperabile senza OCR — il resto (Classifica/Calendario Campionato, Rose, Formazioni) è xlsx pulito, verificato lanciando gli adapter reali, non solo a occhio |

Due problemi concreti già visibili, non ipotetici:

- **Nomi squadra incoerenti**: `Prozalpi S.F.` (logo 2024-25) vs `Pro Zalpi S.F.` (logo 2025-26) vs `Prozalpi S.F. ` con spazio finale (classifica). Se matchi per stringa esatta, ti ritrovi due squadre diverse nel DB che sono la stessa.
- **Formato competizione non fisso**: "Coppa Lelle" (2021-22) diventa "Coppa" (anni dopo); la fase a gironi ha "Spareggio" in un anno e "Gruppo A/B" + "Fase Finale" in altri. Qualsiasi hardcoding di nomi/enum si romperà alla prima variazione.

Questi due punti guidano buona parte delle scelte nella sezione 6.

## 3. Principio guida per la scalabilità

Prima di tutto, una correzione di prospettiva: il tuo dataset è e resterà **piccolo**. Anche con 15 stagioni, 12 squadre, 30 giocatori a rosa, stiamo parlando di poche migliaia di righe totali — molto lontano dai 500MB del piano free Supabase. Quindi "scalabile" qui **non significa "gestire volumi grandi"**, significa **"posso estendere senza rompere ciò che già funziona"**. È una distinzione importante perché cambia dove vale la pena investire tempo: non serve caching aggressivo, sharding o Elasticsearch; serve disciplina su schema, import e query.

Concretamente, cinque regole strutturali:

1. **Migrazioni versionate come unica fonte di verità — lo Studio va bene per esplorare, mai per lasciare uno stato non catturato.** Ogni modifica di schema finisce come file SQL in `supabase/migrations/`, committato in git — anche quando nasce da un click nel Dashboard: in quel caso `supabase db pull` la trasforma subito in una migration file, prima di continuare a lavorare. Zero drift tra ambienti, storico di ogni cambiamento, rollback possibile. Dettagli sul workflow pull/push in sezione 4.
2. **Uno schema intermedio canonico tra "sorgente dati" e "database".** Ogni fonte (xlsx, immagine OCR, sito storico) produce lo *stesso* oggetto JSON validato (con Zod), e un unico loader scrive quell'oggetto su Supabase. Aggiungere una nuova fonte = scrivere un nuovo adapter, zero modifiche al loader o allo schema DB. Dettagli in sezione 7.
3. **Import idempotenti con chiavi naturali.** Mai `insert` cieco: sempre `upsert` su chiavi tipo `(season_id, team_id, player_id)`. Puoi rilanciare un import 10 volte dopo aver corretto un bug nel parser senza generare duplicati.
4. **Query centralizzate in un layer tipizzato.** Le pagine non scrivono query Supabase ad-hoc sparse ovunque; chiamano funzioni tipizzate in `lib/queries/*`. Se lo schema cambia, aggiusti N funzioni in un posto solo invece di cercare in tutte le pagine. I tipi TS si rigenerano da Supabase (`supabase gen types`) e qualsiasi incompatibilità diventa un errore di compilazione, non un bug a runtime scoperto dall'utente.
5. **Stagione chiusa = dato immutabile, non necessariamente pagina statica.** Correzione rispetto alla versione precedente: dato che l'archivio ora è riservato ai membri approvati (sezione 9), una pagina pre-renderizzata in build è per definizione uguale per chiunque la richieda — un export statico servito da CDN aggirerebbe proprio la barriera d'accesso che vogliamo. Le pagine restano quindi a rendering server-side per-richiesta, con la sessione dell'utente autenticato che passa alle query Supabase e la RLS che fa davvero da barriera, non solo un redirect a monte. Non è una perdita: il vantaggio della generazione statica non era "ci serve per reggere il carico" (il dataset resta piccolo, sezione 3 originale), era "risparmiamo letture sul piano free" — a questi volumi (una ventina di utenti) anche il rendering dinamico resta ben dentro i limiti gratuiti. L'isolamento "una stagione nuova non tocca le vecchie" resta comunque vero: è una proprietà del modello dati (sezione 6), non del meccanismo di rendering, quindi non si perde nulla del principio originale.

## 4. Stack tecnico

- **Frontend**: Next.js (App Router) + React + TypeScript, Tailwind. Deploy su Netlify.
- **Backend**: Supabase — Postgres, Auth, Storage (loghi/maglie).
- **Free tier Supabase (verificato, luglio 2026)**: 500MB database, 1GB storage, 50.000 MAU, richieste API illimitate, **2 progetti attivi**, pausa automatica dopo 7 giorni di inattività.
  - Usa i 2 progetti gratuiti come **prod + staging/dev**: testi le migrazioni su staging prima di applicarle in prod.
  - Per evitare la pausa: un GitHub Action schedulato ogni 3-4 giorni che fa una query leggera (es. `select count(*) from seasons`). Cinque righe di YAML, nessun servizio terzo necessario.
- **Workflow CLI — pull e push, non solo push**:
  ```bash
  supabase login
  supabase link --project-ref <ref-staging>   # il locale resta collegato a staging di default

  supabase migration new nome_modifica        # nuovo file in supabase/migrations/
  supabase db reset                           # riapplica tutto in locale, pulito
  supabase db push                            # applica le migration non ancora applicate a staging

  supabase db pull                            # cattura lo stato remoto (es. dopo un click nel Dashboard)
                                               # in una nuova migration file — committala e riparti da lì
  supabase migration list                     # verifica deriva locale/remoto in qualsiasi momento
  ```
  Per **prod**: il collegamento locale resta puntato su staging; prod riceve `db push` **solo da CI** (GitHub Action al merge su `main`, con `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD`/`SUPABASE_PROJECT_ID` di prod come secrets GitHub) — mai a mano dal tuo laptop. Così hai pull e push disponibili per lavorare comodamente, ma un solo punto controllato che tocca prod.
- **Ingestion**: script Node/TS separati dal sito, eseguiti da CLI locale (non da API route Netlify — non è logica da esporre pubblicamente né da far girare on-demand).

## 5. Struttura del repository

Monorepo semplice, npm workspaces — niente Nx/Turborepo, sarebbe over-engineering per un solo sviluppatore su un dataset piccolo.

```
fantatopa-archive/
├── apps/
│   └── web/                       # Next.js (Netlify)
│       ├── app/
│       │   ├── stagioni/[slug]/
│       │   ├── giocatori/[slug]/
│       │   ├── squadre/[slug]/
│       │   └── admin/
│       ├── lib/
│       │   ├── supabase/          # client + tipi generati
│       │   └── queries/           # repository layer tipizzato
│       └── components/
├── packages/
│   ├── ingestion/                 # CLI Node/TS
│   │   ├── adapters/
│   │   │   ├── xlsx/
│   │   │   ├── ocr/
│   │   │   └── html-legacy/       # per le vecchie edizioni-sito, in futuro
│   │   ├── schema/                # Zod: forma canonica intermedia
│   │   └── loader/                # upsert verso Supabase
│   └── shared-types/               # tipi condivisi tra ingestion e web
├── supabase/
│   ├── migrations/                 # SQL versionato, fonte di verità dello schema
│   ├── functions/
│   │   └── notify-admin-registration/   # Edge Function, invio email via Resend
│   └── seed/
└── .github/workflows/
    ├── ci.yml                      # typecheck, lint, test parser
    └── supabase-keepalive.yml
```

## 6. Modello dati

Bozza DDL (Postgres). Non è definitiva al 100%, ma incorpora già le due lezioni della sezione 2 (alias per i nomi squadra, competizioni senza formato hardcoded) più una revisione orientata a Open/Closed: i campi dove la sezione 2 mostra variabilità *già osservata* diventano lookup table estendibili via `insert`, non `check` da migrare.

```sql
-- Stagioni
create table seasons (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,          -- '2025-26'
  label text not null,                -- 'Stagione 2025/2026'
  starts_on date,
  ends_on date,
  rules jsonb not null default '{}',  -- parametri regolamento (bonus/malus, modificatori difesa...)
  created_at timestamptz not null default now()
);

-- Squadre: identità persistente nel tempo
create table teams (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  slug text unique not null
);

-- Alias per matchare varianti ("Prozalpi S.F." / "Pro Zalpi S.F." / con spazi)
create table team_aliases (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  alias_normalized text unique not null   -- lowercase, trim, senza punteggiatura
);

-- Dati che cambiano ogni stagione: logo, maglia, manager
create table team_seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id),
  season_id uuid not null references seasons(id),
  manager_name text,
  logo_url text,
  jersey_url text,
  unique (team_id, season_id)
);

-- Lookup estendibili: un nuovo tipo/formato di competizione è un insert,
-- non una migrazione. Giustificato perché la sezione 2 mostra variabilità
-- GIA' osservata (Coppa Lelle -> Coppa, Spareggio -> Gironi), non ipotetica.
-- (Ho valutato anche un'unica tabella "taxonomies" generica con colonna
-- categoria per tutti i lookup del sistema: consolida meno tabelle ma rende
-- le FK più deboli/artificiali per un guadagno minimo a questa scala — non
-- ne vale la pena con 3-5 valori per tabella.)
create table competition_kinds (
  code text primary key,              -- 'campionato','coppa_girone','coppa_fase_finale','coppa_spareggio'
  label text not null
);

create table competition_formats (
  code text primary key,              -- 'girone_unico','gironi','eliminazione_diretta'
  label text not null
);

-- Competizioni: gerarchia auto-referenziata, kind/format estendibili senza migrazione
create table competitions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id),
  parent_competition_id uuid references competitions(id),
  name text not null,                 -- es. "Coppa Lelle Girone A" — il nome libero può variare
  kind_code text not null references competition_kinds(code),
  format_code text not null references competition_formats(code),
  slug text not null,
  unique (season_id, slug)
);

-- Ruoli come lookup, non hardcoded nel codice applicativo
create table roles (
  code text primary key,              -- 'Por','Dc','Ds','Dd','B','E','M','C','W','T','A','Pc'
  label text not null,
  ruleset text not null default 'mantra'
);

create table players (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  slug text unique not null
);

create table player_aliases (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  alias_normalized text unique not null
);

-- Un giocatore può cambiare ruolo idoneo da una stagione all'altra
create table player_roles (
  player_id uuid not null references players(id),
  season_id uuid not null references seasons(id),
  role_code text not null references roles(code),
  primary key (player_id, season_id, role_code)
);

create table rosters (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id),
  team_id uuid not null references teams(id),
  player_id uuid not null references players(id),
  real_team text,
  cost numeric,
  unique (season_id, team_id, player_id)
);

create table matchdays (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),
  number int not null,
  label text,
  unique (competition_id, number)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  matchday_id uuid not null references matchdays(id),
  home_team_id uuid not null references teams(id),
  away_team_id uuid not null references teams(id),
  home_score numeric,                 -- fantavoto squadra quella giornata
  away_score numeric,
  home_result_points int,             -- 3/1/0 (verificato dai dati reali: V*3+N*1 = pt finale)
  away_result_points int,
  unique (matchday_id, home_team_id, away_team_id)
);
-- Questa tabella basta da sola per la pagina Statistiche (confronto due
-- squadre): "Punti" è la somma cumulativa di home/away_result_points
-- giornata per giornata; "Fantapunti" è home/away_score preso così com'è,
-- SENZA somma. Nessuna tabella nuova — è un caso in cui il modello dati
-- pensato per Formazioni/Calendario regge bene una richiesta arrivata dopo.

> **Aggiornamento (bug gironi Coppa dispari)**: `away_team_id` qui sopra è
> disegnato `not null`, ma alcuni gironi di Coppa hanno un numero dispari di
> squadre (5): una squadra resta senza avversario quella giornata ("solo"),
> sempre normalizzata nello slot home dagli adapter. Il piano originale non
> prevedeva questo caso — è emerso lanciando il parser sui file xlsx reali,
> non nei dati di test — e il primo adapter scartava silenziosamente quella
> riga, azzerando una squadra su 5 in Formazioni/Calendario per quei gironi.
> Fix (migrazione `20260801000000_matches_away_team_optional.sql`):
> `away_team_id` reso nullable + indice unique parziale
> `matches_solo_home_team_unique on matches(matchday_id, home_team_id) where
> away_team_id is null` (l'unique originale su tre colonne non basta a
> prevenire duplicati quando `away_team_id` è null, perché NULL non è mai
> uguale a NULL in un vincolo unique standard).

create table lineups (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id),
  team_id uuid not null references teams(id),
  formation text,                     -- '3412'
  unique (match_id, team_id)
);

create table lineup_players (
  id uuid primary key default gen_random_uuid(),
  lineup_id uuid not null references lineups(id) on delete cascade,
  player_id uuid not null references players(id),
  slot text not null check (slot in ('titolare','panchina')),
  position_order int,
  -- SOLO voto e fantavoto, per scelta dettata dalla fonte: gli xlsx delle
  -- formazioni riportano il voto base e il fantavoto finale ma non il
  -- dettaglio bonus/malus (gol, assist, cartellini, modificatori) — es.
  -- "M;C / Calhanoglu / 7.5 / 13.5" non dice perché lo scarto è +6. Non è
  -- un campo dimenticato: un'eventuale tabella eventi-partita andrebbe
  -- popolata da un'altra fonte che al momento non abbiamo, quindi non la
  -- modelliamo finché non esiste un dato reale da cui derivarla. Per le
  -- edizioni più vecchie (fase 5/6) non è ancora chiaro se questo dettaglio
  -- ci sia o no — da verificare quando affrontiamo quei file.
  voto numeric,
  fantavoto numeric
  -- nota: dal file di esempio non è chiaro se il "ruolo" mostrato per giocatore
  -- sia il ruolo schierato quel giorno o l'insieme dei ruoli idonei (es. "Dd;Dc").
  -- Da chiarire nell'adapter xlsx (fase 1) prima di aggiungere qui una FK a roles.
);

-- Classifica: SEMPRE lo snapshot importato, unica fonte di verità in questa
-- tabella. Il ricalcolo dalle partite (dove i dati lo permettono) è un
-- controllo di qualità che gira in fase di import/CI e segnala discrepanze
-- all'admin — non viene scritto qui come riga concorrente. Avere due "fonti
-- di verità" nella stessa tabella (il v1 lo faceva col campo `source`) crea
-- solo l'ambiguità "di quale riga mi fido".
create table standings (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references competitions(id),
  team_id uuid not null references teams(id),
  position int,
  played int, won int, drawn int, lost int,
  goals_for int, goals_against int, goal_diff int,
  points int,
  total_fantapoints numeric,
  unique (competition_id, team_id)
);

create table market_values (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id),
  player_id uuid not null references players(id),
  role_code text references roles(code),
  real_team text,
  initial_quote numeric,
  current_quote numeric
);

-- Anche qui lookup table: nuove fonti sono già in roadmap (OCR, html-legacy),
-- non ipotetiche — stesso ragionamento di competition_kinds/formats sopra.
create table import_source_types (
  code text primary key,              -- 'xlsx','ocr_image','html_legacy','manual'
  label text not null
);

-- Ogni import tracciato: idempotenza, audit, possibilità di rifiutare una bozza
create table import_batches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references seasons(id),
  source_type_code text not null references import_source_types(code),
  source_file text not null,
  file_hash text not null,
  -- 'status' resta check, non lookup: è una macchina a stati intenzionalmente
  -- chiusa (draft/confirmed/rejected), aggiungere uno stato è una decisione
  -- di processo che merita comunque una migrazione pensata, non un insert
  status text not null default 'draft' check (status in ('draft','confirmed','rejected')),
  imported_by uuid,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

-- Auth: ruoli utente. team_id abilita la homepage personalizzata (sezione 10):
-- assegnato SOLO dall'admin (pannello già previsto in fase 3), mai self-service —
-- coerente con "utenti normali consultano e basta", zero scritture da parte loro.
-- Singola squadra per utente in v1: seguire più squadre è un'estensione additiva
-- (tabella ponte), non una riscrittura, se servisse in futuro.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','admin')),
  -- 'status' è ORA la vera barriera d'accesso (sezione 9), non solo un dettaglio
  -- della registrazione: solo 'approved' (o role admin) legge i dati di lega.
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  team_id uuid references teams(id),  -- popolato solo all'approvazione, non prima
  first_name text,
  last_name text
);

-- Riga profiles creata SUBITO alla registrazione (status pending), non solo
-- all'approvazione: serve per poter controllare lo stato via RLS fin da subito.
-- Pattern standard Supabase: trigger su auth.users che legge i metadata passati
-- a supabase.auth.signUp({ options: { data: { first_name, last_name, requested_team_id } } }).
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name');

  insert into public.registration_requests (auth_user_id, first_name, last_name, requested_team_id)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    nullif(new.raw_user_meta_data->>'requested_team_id','')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Richieste di registrazione: STESSO pattern draft/confirmed di import_batches
-- (sezione 7), applicato alle persone invece che ai dati di lega. Riga creata
-- dal trigger sopra, mai da un insert diretto del client — resta come record
-- immutabile della domanda originale (audit), mentre 'profiles.status' è la
-- proiezione confermata che conta davvero per l'accesso.
create table registration_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  -- NULLABLE per costruzione, trovato testando lo schema per davvero (Fase 0):
  -- il trigger handle_new_user scrive qui SEMPRE, anche se auth.users arriva
  -- senza metadata nome/cognome (percorso di signup diverso dal form, utente
  -- creato a mano da Studio...). Con NOT NULL, quel caso fa fallire l'INTERA
  -- transazione di signup, non solo la scrittura del profilo — verificato con
  -- un test reale contro Postgres, non solo dedotto. La richiesta di nome/
  -- cognome resta comunque: si applica lato form (validazione client) e come
  -- condizione per l'approvazione admin, non come vincolo che rompe l'iscrizione.
  first_name text,
  last_name text,
  requested_team_id uuid references teams(id),  -- null se non rivendica nessuna squadra
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Funzioni helper per la RLS. TUTTE plpgsql (non sql): una funzione sql
-- security definer può venire "inlined" dal query planner di Postgres,
-- che perde il contesto security definer e fa tornare la ricorsione — un
-- problema reale e documentato (non ipotetico), quindi la convenzione qui
-- è: ogni funzione usata dentro una policy RLS è plpgsql, senza eccezioni.
create or replace function is_admin()
returns boolean language plpgsql security definer stable set search_path = public
as $$
begin
  return exists (select 1 from profiles where id = auth.uid() and role = 'admin');
end;
$$;

create or replace function can_read_league_data()
returns boolean language plpgsql security definer stable set search_path = public
as $$
begin
  return exists (select 1 from profiles where id = auth.uid() and (role = 'admin' or status = 'approved'));
end;
$$;

-- Eccezione mirata: chi si sta registrando non è ancora autenticato come
-- membro, ma il form deve comunque mostrare quali squadre sono ancora
-- libere. Invece di aprire l'intera tabella teams in lettura pubblica,
-- una funzione stretta che espone SOLO nome+id delle squadre libere,
-- chiamabile anche da anon — nessun altro dato di lega passa da qui.
create or replace function teams_available_for_registration()
returns table(id uuid, canonical_name text)
language plpgsql stable security definer set search_path = public
as $$
begin
  return query
    select t.id, t.canonical_name from teams t
    where not exists (select 1 from profiles p where p.team_id = t.id);
end;
$$;
grant execute on function teams_available_for_registration() to anon, authenticated;

-- Approvazione come UNICA funzione atomica, non più scritture separate dal
-- client: valida che la squadra richiesta non sia già assegnata, scrive su
-- profiles (incluso lo status, che è la vera barriera d'accesso ora) e
-- chiude la richiesta nella stessa transazione.
create or replace function approve_registration(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req registration_requests%rowtype;
begin
  if not is_admin() then
    raise exception 'Solo admin può approvare';
  end if;

  select * into req from registration_requests where id = request_id and status = 'pending';
  if not found then
    raise exception 'Richiesta non trovata o già gestita';
  end if;

  if req.requested_team_id is not null
     and exists (select 1 from profiles where team_id = req.requested_team_id) then
    raise exception 'Squadra già assegnata a un altro profilo';
  end if;

  update profiles
    set status = 'approved', team_id = req.requested_team_id
    where id = req.auth_user_id;

  update registration_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = request_id;
end;
$$;
```

**Criterio usato per lookup table vs `check`**: non tutto merita una tabella a parte, sarebbe indirection gratuita. La regola: lookup table solo dove la sezione 2 mostra variabilità *già osservata* (tipo/formato competizione, tipo sorgente import). Dove il dominio è chiuso e stabile (`profiles.role`, `lineup_players.slot`, `import_batches.status`) il `check` resta — trasformarlo in tabella sarebbe complessità senza beneficio reale. Lo stesso principio, applicato in entrambe le direzioni, è quello che rende il sistema estendibile senza diventare inutilmente elaborato.

**Dependency Inversion tra loader e Supabase**: il loader non deve dipendere direttamente dal client Supabase, ma da un'interfaccia. Questo permette di testare la logica di upsert e risoluzione-alias con un'implementazione finta in memoria, senza rete né DB reale — molto più veloce di un test end-to-end e gira ovunque in CI:

```ts
// packages/ingestion/loader/season-repository.ts
export interface SeasonRepository {
  upsertTeam(team: TeamImport): Promise<string>;      // ritorna team_id
  upsertRoster(entries: RosterEntryImport[]): Promise<void>;
  upsertStandings(rows: StandingRowImport[]): Promise<void>;
  // ...
}

export class SupabaseSeasonRepository implements SeasonRepository { /* implementazione reale */ }
export class InMemorySeasonRepository implements SeasonRepository { /* per i test, zero rete */ }
```

Lo stesso principio vale al contrario, lato frontend: le funzioni in `lib/queries/*` devono ritornare **tipi di dominio** (`Standing`, `RosterEntry`...) mappati esplicitamente dalle righe Supabase, non il tipo grezzo generato (`Database['public']['Tables']['standings']['Row']`). Ritornare il tipo grezzo sembra comodo oggi, ma incolla ogni componente alla forma esatta delle tabelle: un rename di colonna o uno split di tabella si insegue in ogni pagina invece che in un unico punto di mapping.

## 7. Pipeline di ingestion

Il cuore della "non voglio bug quando aggiungo roba" sta qui. Ogni fonte (xlsx pulito, immagine OCR, futuro sito storico) passa da un **adapter** che produce sempre la stessa forma intermedia, validata con Zod.

**Correzione rispetto al v1**: avevo un unico `SeasonImport` con teams/rosters/standings/matches/lineups tutti insieme. Sbagliato — i tuoi file sorgente sono *già* separati (`Rose_x.xlsx`, `Classifica_x.xlsx`, `Calendario_x.xlsx` sono file diversi), quindi lo schema di ingestion deve rispecchiare quel confine, non inventarne uno artificiale. Uno schema per concern:

```ts
// packages/ingestion/schema/imports.ts
import { z } from 'zod';

export const TeamImport = z.object({
  name: z.string(),                 // nome grezzo, verrà risolto via alias
  logoPath: z.string().optional(),
  jerseyPath: z.string().optional(),
});

export const RosterImport = z.object({
  seasonSlug: z.string(),
  entries: z.array(z.object({
    teamName: z.string(),
    playerName: z.string(),
    roles: z.array(z.string()),     // ['B','Ds','E']
    realTeam: z.string().optional(),
    cost: z.number().optional(),
  })),
});

export const StandingsImport = z.object({
  seasonSlug: z.string(),
  competitionSlug: z.string(),
  rows: z.array(z.object({
    teamName: z.string(),
    position: z.number(),
    played: z.number(), won: z.number(), drawn: z.number(), lost: z.number(),
    goalsFor: z.number(), goalsAgainst: z.number(),
    points: z.number(),
    totalFantapoints: z.number(),
  })),
});

// CalendarImport, LineupImport: stessa logica, un file sorgente = uno schema
```

E un contratto comune per gli adapter (Liskov: ogni adapter concreto deve essere intercambiabile senza che chi lo usa sappia quale sia):

```ts
// packages/ingestion/adapters/types.ts
export interface SourceAdapter<TImport> {
  canHandle(input: unknown): boolean;
  parse(input: unknown): Promise<TImport>;
}

// XlsxStandingsAdapter, OcrStandingsAdapter, HtmlLegacyStandingsAdapter
// implementano tutte SourceAdapter<StandingsImport> e sono intercambiabili
// ovunque il loader si aspetti quel tipo — è questo che rende l'OCR e i
// futuri siti storici un'aggiunta, non una modifica
```

Il **loader** dipende solo da questi tipi (via `SeasonRepository`, sezione 6), non sa se un `StandingsImport` è arrivato da un xlsx o da un OCR. Questo è ciò che rende il sistema estendibile: una nuova stagione con lo stesso formato xlsx = zero codice nuovo; una fonte completamente diversa (sito storico) = un adapter nuovo, loader e DB intatti.

Flusso operativo per ogni import:

1. Adapter legge la fonte → produce l'import tipizzato corrispondente (`RosterImport`, `StandingsImport`...) → viene validato da Zod (fallisce rumorosamente se qualcosa non torna, invece di scrivere dati sporchi).
2. Risoluzione alias: nomi squadra/giocatore non riconosciuti vengono segnalati per conferma manuale (non creati automaticamente come nuova entità — evita duplicati silenziosi tipo "Prozalpi" vs "Pro Zalpi").
3. Si crea un `import_batches` in stato `draft`.
4. Anteprima (via script CLI o pannello admin) prima della conferma.
5. Alla conferma, il `SeasonRepository` fa `upsert` su chiavi naturali → stato `confirmed`.

**Un'insidia specifica della risoluzione alias giocatori, scoperta sui dati reali** (`seedPlayersFromLineups`, stagioni ruleset classico 2020-21/2021-22/2022-23): quando il nome in arrivo dalle Formazioni è "nudo" (senza l'iniziale finale che il file usa per distinguere omonimi, es. "Ordonez C.") e in rosa esiste un solo candidato con lo stesso nome base ma QUALIFICATO da un'iniziale, fondere automaticamente su quel candidato è un errore: l'iniziale sul candidato esistente è proprio il segnale che a suo tempo serviva a distinguerlo da un omonimo, quindi il nome nudo può benissimo essere quell'omonimo, non una variante dello stesso giocatore. Ha causato 2 bug reali di dati in produzione (stagione 2021-22: "Milinkovic-Savic" nudo, centrocampista Lazio, fuso su "Milinkovic-Savic V.", portiere Torino; "Bastoni" nudo, Inter, fuso su "Bastoni S.", Spezia) — il secondo scoperto solo con un controllo di integrità su tutto il DB (cerca giocatori con più ruoli o più squadre nella stessa stagione classico, dove per definizione ne serve esattamente una), non dal caso segnalato, perché condivideva lo stesso ruolo (`D`) tra i due giocatori: un solo segnale di ambiguità non basta, va incrociato con almeno un secondo controllo indipendente. Ora trattato come ambiguo (stesso percorso di più candidati): richiede conferma manuale via `player-alias-overrides.json`, mai un default diverso da `null`.

**Due livelli di test, non uno solo**:
- *Regressione sui parser*: per ogni stagione già importata correttamente, un test in CI rilancia l'adapter sul file reale e verifica conteggi noti ("Rose 2025-26 → esattamente N giocatori, M squadre"). Se domani tocchi il parser xlsx per un caso nuovo, questi test ti dicono subito se hai rotto una stagione precedente — verificare il comportamento reale, non solo che compili.
- *Unit test sul loader*: usando `InMemorySeasonRepository` (sezione 6) invece di un Supabase reale — veloce, zero rete, copre la logica di upsert/alias/idempotenza senza dover tenere su un ambiente di staging solo per questo.

Altri due accorgimenti operativi, minori ma concreti:
- **Migrazioni e RLS testate in locale**: la CLI Supabase fa girare uno stack locale (Docker) per applicare migrazioni e verificare le policy RLS prima di toccare staging o prod — nessun costo di rete, nessun rischio di testare su dati veri.
- **Scoping ambienti su Netlify**: i deploy preview non devono mai puntare per sbaglio al progetto Supabase di prod — variabili d'ambiente distinte per contesto (`production` vs `deploy-preview`) da subito, non è un dettaglio da sistemare dopo.

Un'ultima cosa che vale la pena rendere esplicita come principio: **i file grezzi originali (xlsx, immagini, in futuro gli HTML) restano l'unica fonte di verità definitiva**, conservati per sempre in Storage e collegati a ogni `import_batches`. Il database è una proiezione ricostruibile da quei file, non il contrario — se tra due anni lo schema canonico deve cambiare forma, puoi ri-eseguire gli adapter sui sorgenti archiviati invece di dover recuperare dati che esistono solo nel DB.

### 7.1 Bonus/malus granulari per giornata (Campionato 2025-26 e 2017-18, con derivazione Coppa solo per il 2025-26)

Per la stagione 2025-26 esiste una fonte aggiuntiva rispetto alle xlsx: 37 pagine HTML
("Voti" di leghe.fantacalcio.it, `docs/html/001.html`...`037.html`, una per giornata di
Campionato) che riportano bonus/malus reali per giocatore (gol fatto/subito, assist,
ammonizione, espulsione, autogol, rigori, portiere imbattuto, player of the match).
`lineup_players` resta invariata (niente colonne bonus lì, vedi `AGENTS.md`): questi dati
vivono in tabelle dedicate, introdotte con la migrazione `20260731090000`:

- `bonus_kinds` (code/label) — 14 tipi, elenco chiuso (13 dalla fonte 2025-26 + `assist_fermo`
  aggiunto con la migrazione `20260802120000` per la fonte 2017-18, vedi sotto).
- `player_matchday_bonuses` (`matchday_id, player_id, kind_code, position_order`) —
  chiave `(matchday_id, player_id)`, **non** `lineup_player_id`: un evento reale di
  Serie A non va duplicato se più squadre fantacalcio schierano lo stesso giocatore la
  stessa giornata. Nessun campo "punti": il fantavoto già corretto arriva dall'xlsx,
  questi bonus sono solo per la visualizzazione.
- `matchday_bonus_sources` (`matchday_id primary key, source_matchday_id`) — mappa una
  giornata di Coppa alla giornata di Campionato "gemella" (stesso turno reale di Serie
  A). Una giornata senza riga qui semplicemente non mostra bonus, nessun errore. La
  derivazione dei bonus di Coppa è quindi un JOIN a query-time, zero import aggiuntivo.

**Ingestion**: `HtmlVotiBonusAdapter` (`packages/ingestion/adapters/html-voti/bonus.ts`,
regex-based come `html-legacy/`, nessuna libreria di parsing HTML nel repo) produce un
`BonusImport` per giornata; `SeasonRepository.upsertMatchdayBonuses` fa upsert
idempotente (delete+insert per giornata). Script di orchestrazione:
`packages/ingestion/scripts/import-bonus-2025-26.ts`, uno per tutti i 37 file.

**Mappatura Coppa 2025-26 confermata dall'utente** (popolata una tantum in
`matchday_bonus_sources`, non da uno script ripetibile): Girone A/B giornate 1-5 →
Campionato giornate 5,8,11,14,17 (stesse per entrambi i gironi); Fase Finale giornate
1-5 → Campionato giornate 22,25,28,31,33.

**Frontend**: `apps/web/lib/queries/formazioni.ts` risolve, per la giornata richiesta, la
giornata "sorgente" bonus via `matchday_bonus_sources` (o usa la giornata stessa se non
mappata) e allega un array `bonuses: {code, label}[]` a ogni `LineupPlayerRow`;
`PlayerRow.tsx` li mostra come piccole icone con tooltip (mappa `code -> emoji`, elenco
chiuso di 14 voci, niente libreria icone).

**Campionato 2017-18 — stessa architettura, fonte diversa**: i 38 file
`docs/Fantacalcio 2017-2018/Campionato/formazioni-N.html` (stesso file già usato per
importare le formazioni, vedi sezione 7.2) contengono anche icone bonus/malus per
giocatore (`<span class="ico"><img alt="...">`), mai estratte finché non aggiunto
`FlatHtmlBonusAdapter` (`packages/ingestion/adapters/html-legacy/bonus.ts`): riusa
`PLAYER_ROW_PATTERN`/`readMatchdayNumber` esportati da `lineup.ts` (stessa regex già
testata, nessuna duplicazione), estrae le icone con una regex secondaria su `match[0]`.
9 dei 10 tipi osservati mappano su `bonus_kinds` già esistenti; il decimo
("assist da fermo", assist da calcio piazzato) è il nuovo `assist_fermo`. Script di
orchestrazione: `packages/ingestion/scripts/import-bonus-2017-18.ts`. **Nessuna
derivazione Coppa** per questa stagione: la Coppa 2017-18 non ha formazioni per
giocatore in questa fonte (solo classifiche/snapshot), quindi `matchday_bonus_sources`
resta senza righe per le sue competizioni.

### 7.2 Fonte HTML legacy (stagione 2018-19, mirror Fantagazzetta)

Prima stagione con fonte diversa da xlsx: non un'immagine da OCRizzare (sezione 8), ma un
mirror statico del vecchio sito "Leghe Fantagazzetta" — un sito scaricato, il caso già
previsto in fondo alla sezione 8. Tre meccanismi di embedding dati nella stessa fonte,
utile controllarli in quest'ordine quando si valuta se una pagina è recuperabile:

1. **Blob in variabili JS globali** (`__.dp('base64')` → decode base64 → JSON, oppure un
   oggetto letterale già JSON-valido da estrarre con un balanced-brace scanner che rispetta
   stringhe ed escape, non un `indexOf` naive della prima `}`) — usato per classifica,
   calendario, rose e i metadati di branding (`packages/ingestion/adapters/html-legacy/decode.ts`).
2. **HTML letterale server-renderizzato** (tabelle e commenti reali dentro `home.html`) —
   recuperabile solo quando il markup è HTML/valori letterali, non quando è sintassi
   Handlebars `{{...}}` mai eseguita in un mirror statico: la presenza di `{{#each}}`/`{{var}}`
   non popolati è il segnale affidabile che quella sezione non è recuperabile.
3. **Template Handlebars lato client** — mai popolati in un mirror statico: le formazioni di
   questa stagione sono per questo motivo irrecuperabili, gap accettato con l'utente (banner
   `DataGapNotice` in Calendario/Formazioni, stesso pattern delle lacune di altre stagioni).

**Lezione generale sul recupero da un mirror legacy**: non assumere che due cartelle-
competizione con lo stesso nome file (`home.html` ovunque) siano ugualmente vuote solo
perché una lo è — ogni pagina può avere sezioni server-renderizzate diverse. Un marcatore
esplicito nella fonte (qui, `<!-- TIPO COMPETIZIONE: N -->`) va sempre controllato prima di
assumere la semantica di una competizione dal solo nome cartella: in questa stagione i
gironi di Coppa sono un formato a punteggio cumulato, non a scontri diretti, coerente col
layout `'reduced'` già usato sopra per le classifiche gironi xlsx.

Adapter nuovi (`packages/ingestion/adapters/html-legacy/{standings,calendar,roster}.ts`)
seguono lo stesso contratto `SourceAdapter<T>` degli adapter xlsx — lo stesso principio di
sostituibilità (Liskov, visto sopra) vale anche per una fonte completamente diversa. Script
di orchestrazione one-off (`import-season-2018-19.ts`, non generalizzato: un'unica stagione
con questa fonte), che riusa `ensureSeason`/`ensureLookups`/`ensureCompetitions` e le
funzioni di branding esportate da `import-season.ts` invece di duplicarle.

**Pattern riusabile per qualunque futuro script di orchestrazione**: uno script CLI il cui
blocco top-level deve girare solo quando invocato direttamente, mai quando un altro script
ne importa le funzioni esportate — guardia `if (import.meta.url ===
pathToFileURL(process.argv[1] ?? '').href)` attorno al blocco CLI. Necessaria perché
`import-season.ts` esporta funzioni riusate da `import-season-2018-19.ts`: senza la
guardia, importarle da un altro entry-point rieseguiva comunque il suo blocco CLI, leggendo
gli argv del chiamante.

Risultato: 4 competizioni (campionato, coppa-girone-a, coppa-girone-b, coppa-fase-finale),
classifiche e calendario campionato completi, dati Coppa parziali dove la fonte stessa è
uno snapshot a metà stagione (importati così come sono, senza inventare una classifica
finale fittizia), branding completo (10/10 loghi e maglie). Nessuna formazione (gap noto).
Identità squadra cross-stagione risolta con lo stesso principio "chiedi, non indovinare"
già visto per gli alias giocatore (sopra): dove il nome 2018-19 non trovava un alias
esistente nel registro squadre, la corrispondenza è stata confermata dall'utente invece di
dedotta.

## 8. Dati legacy e OCR

> **Aggiornamento (fase di import reale)**: lanciando gli adapter xlsx reali su tutti i file di 2020-21/2021-22 (non solo guardando i nomi file), è emerso che Classifica/Calendario Campionato, Rose e Formazioni sono xlsx puliti, già coperti dagli adapter esistenti — nessun OCR necessario per quella parte. L'unico dato realmente solo-immagine è il calendario dei gironi di Coppa di quelle 2 stagioni (pochi file, non 10-15): un gap stretto, trattato come lacuna dati accettata e segnalata esplicitamente in UI (stesso pattern delle lacune di 2022-23), non un motivo per costruire la pipeline OCR sotto. La ricerca che segue resta comunque un riferimento valido per le edizioni pre-2020 ("siti interi scaricati", sezione 12), quando/se verranno recuperate.
>
> **Aggiornamento (stagione 2018-19)**: le edizioni pre-2020 di cui sopra hanno ora un primo caso reale e completato — non serviva OCR (i dati sono embedded in HTML/JS, non immagini) ma un adapter dedicato con un proprio meccanismo di decodifica. Vedi sezione 7.2 per i dettagli; questa sezione resta il riferimento per un eventuale futuro caso davvero basato su immagini/screenshot.

Le immagini da gestire (2020-21, 2021-22) sono circa 10-15 file: screenshot puliti presi direttamente dal sito fantacalcio.it, non foto di carta — tabelle con bordi netti, font digitale. È un caso relativamente facile per l'OCR strutturato.

| Libreria | Approccio | Setup | Adatta al nostro caso? |
|---|---|---|---|
| **[img2table](https://github.com/xavctn/img2table)** | OpenCV per rilevare la struttura tabella + OCR pluggabile (Tesseract, PaddleOCR, EasyOCR, docTR, Google Vision...) | `pip install img2table`, gira su CPU, nessun training | **Sì, prima scelta.** Pensata esattamente per tabelle con bordi come screenshot da sito web; output diretto in DataFrame o xlsx |
| **[Table Transformer / TATR](https://github.com/microsoft/table-transformer)** (Microsoft) | Deep learning (object detection) per la struttura, serve un OCR a parte per il testo | Richiede PyTorch, pensato per dataset eterogenei di grandi dimensioni | Overkill per 15 immagini pulite; sviluppo recente rallentato. Da tenere in tasca solo se img2table fallisce su un layout specifico |
| **PaddleOCR / PP-Structure** | Suite OCR + riconoscimento tabelle end-to-end | Setup più pesante (framework Paddle) | Alternativa se serve più precisione su tabelle senza bordi, non il nostro caso qui |
| **Vision LLM one-shot** (Gemini/Claude, immagine → JSON) | Un prompt con schema JSON per immagine | Zero pipeline da mantenere | Per questo volume (15 immagini pulite), probabilmente il miglior rapporto sforzo/risultato — nessuna infrastruttura da mantenere per un batch così piccolo |

**Raccomandazione**: parti con `img2table` + Tesseract (`lang="ita"`) per l'estrazione automatica — è un adapter come gli altri, produce lo stesso `StandingsImport`/`CalendarImport` di sezione 7 (implementa `SourceAdapter<StandingsImport>`). Dato il volume basso, ha senso anche far girare in parallelo un secondo tentativo via vision LLM sulle stesse immagini e far segnalare all'admin le righe dove i due risultati divergono, come controllo di qualità aggiuntivo praticamente gratis. In ogni caso, qualunque sia il metodo, l'output passa dalla stessa validazione Zod e dallo stesso step di conferma manuale prima di finire nel DB — l'architettura non cambia in base a come arriva il dato.

Per i siti interi scaricati (edizioni pre-2020): li affronteremo quando li recuperi, ma il modello dati e il pattern adapter sono già pronti ad accoglierli — sarà un nuovo `html-legacy` adapter, nient'altro da toccare.

## 9. Autenticazione e ruoli

Supabase Auth (email/password o magic link). `profiles.role`/`status` (sezione 6) + Row Level Security:

- **Archivio riservato ai membri approvati**: ogni tabella di dati lega (stagioni, classifiche, formazioni, rose, ecc.) ha una policy `select using (can_read_league_data())` — nessuna eccezione di lettura pubblica. Chi non è loggato o è ancora `pending` non vede l'archivio, solo la schermata di login/richiesta in revisione.
- Scrittura (import, conferma, modifiche) solo per `admin`, via `is_admin()`. Gli utenti normali consultano e basta, zero scritture sui dati di lega.
- Conseguenza architetturale diretta: **niente più generazione statica in build per le pagine di stagione** (sezione 3, punto 5, rivisto) — il rendering deve passare dalla sessione dell'utente per far valere la RLS.
- Unica eccezione, deliberata e stretta: `teams_available_for_registration()` (sezione 6) è leggibile anche da anonimi, perché il form di registrazione deve mostrare le squadre libere a chi non si è ancora registrato. Espone solo nome+id squadra, nient'altro dell'archivio.

**Policy vere, testate in Fase 0 contro un Postgres reale** (prima erano solo descritte a parole — vedi sezione 14 per come sono state verificate):

```sql
-- Ripetuto uguale per ogni tabella di dati lega (seasons, teams, team_aliases,
-- team_seasons, competition_kinds, competition_formats, competitions, roles,
-- players, player_aliases, player_roles, rosters, matchdays, matches, lineups,
-- lineup_players, standings, market_values, import_source_types) — esplicito
-- e ripetitivo apposta: per la sicurezza l'auditabilità conta più della
-- brevità (skill ponytail, "not lazy about... security").
alter table seasons enable row level security;
create policy "seasons_select_members" on seasons for select using (can_read_league_data());
create policy "seasons_write_admin" on seasons for all using (is_admin()) with check (is_admin());
-- ...stesse due policy per le altre 18 tabelle elencate sopra...

-- import_batches: solo admin, è audit interno dell'import, non contenuto
-- da mostrare ai membri normali.
alter table import_batches enable row level security;
create policy "import_batches_admin_only" on import_batches for all using (is_admin()) with check (is_admin());

-- profiles: ognuno legge la propria riga, admin legge tutte. Nessuna policy
-- di insert/update/delete per utenti normali: quelle scritture passano solo
-- dal trigger handle_new_user e da approve_registration, entrambe security
-- definer (bypassano RLS di proposito, dall'interno) — verificato che un
-- admin stesso non può scrivere qui bypassando la funzione: è voluto.
alter table profiles enable row level security;
create policy "profiles_select_own_or_admin" on profiles for select using (id = auth.uid() or is_admin());

-- registration_requests: ognuno legge la propria richiesta, admin legge tutte.
alter table registration_requests enable row level security;
create policy "registration_requests_select_own_or_admin" on registration_requests for select using (auth_user_id = auth.uid() or is_admin());
```

**Nota su Supabase vs Postgres puro**, emersa testando in locale: Supabase concede automaticamente a `anon`/`authenticated` i permessi base (`usage`/`select`/`insert`/`update`/`delete`) sullo schema `public` in ogni nuovo progetto — la RLS filtra le *righe* dentro quel permesso, non lo sostituisce. La migrazione qui sopra non include quei `grant`: su Supabase esistono già. Servono solo se si testa lo schema contro un Postgres locale non-Supabase, come fatto in Fase 0.

**Flusso di registrazione**, con lo stesso spirito draft/confirmed usato per i dati (sezione 6, `registration_requests`):

1. L'utente si registra (email/password via Supabase Auth, con nome/cognome/squadra passati come metadata in `options.data`) e nello stesso form indica **nome, cognome** e, opzionalmente, **quale squadra era sua** — dropdown popolato da `teams_available_for_registration()` (sezione 6, leggibile anche da anonimi), con un'opzione "nessuna squadra". La lista si accorcia mano a mano che le richieste vengono approvate, esattamente come chiesto.
2. Il trigger `handle_new_user` (sezione 6) crea sia `profiles` (status `pending`) sia `registration_requests` nello stesso passaggio — il client non inserisce mai direttamente in `registration_requests`, evita di dover esporre una policy di insert dedicata. Un **Database Webhook** su `insert` in `registration_requests` (Supabase supporta definirlo via SQL in migrazione, non solo da Dashboard — coerente col principio "tutto versionato"; la sintassi esatta del trigger la prendo dalla doc Supabase al momento dell'implementazione, per non rischiare di sbagliare un parametro a memoria) chiama una **Edge Function** che invia l'email di notifica.
3. La Edge Function usa l'API di **Resend** (piano gratuito, il volume di un torneo tra amici ci sta comodamente) per inviare all'admin nome, cognome, squadra richiesta e un link al pannello admin — non un link "approva con un click" nell'email stessa, perché un'azione che scrive dati dovrebbe sempre passare da una sessione autenticata, non da un link potenzialmente inoltrabile.
4. Dal pannello admin (fase 3), approvazione/rifiuto chiama la funzione **`approve_registration`** (sezione 6): un'unica transazione che verifica che la squadra non sia nel frattempo già stata assegnata, scrive su `profiles`, chiude la richiesta. Se due persone rivendicano la stessa squadra, decide l'admin in fase di revisione — con questi volumi non serve un sistema di prenotazione/lock.
5. Se la squadra rivendicata non esiste ancora nel DB (es. faceva parte della stagione 2022-23 mancante), l'utente si registra comunque con "nessuna squadra" e l'admin potrà associarla a mano più avanti — l'associazione squadra-profilo resta modificabile dall'admin anche dopo l'approvazione iniziale, non è un'operazione a senso unico.

```ts
// supabase/functions/notify-admin-registration/index.ts
// Chiamata dal Database Webhook su insert in registration_requests
import { Resend } from 'npm:resend';

const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);
const ADMIN_EMAILS = ['tuo@indirizzo.it'];

Deno.serve(async (req) => {
  const { record } = await req.json();               // la riga appena inserita
  const teamLabel = record.requested_team_id
    ? await fetchTeamName(record.requested_team_id)    // query di supporto su teams
    : 'nessuna squadra';

  await resend.emails.send({
    from: 'registrazioni@tuodominio.it',
    to: ADMIN_EMAILS,
    subject: `Nuova richiesta: ${record.first_name} ${record.last_name}`,
    html: `<p>${record.first_name} ${record.last_name} ha richiesto la registrazione,
           rivendicando <b>${teamLabel}</b>.</p>
           <p><a href="https://tuosito.it/admin/registrazioni">Rivedi ed approva</a></p>`,
  });
  return new Response('ok');
});
```

Tutte le policy RLS (comprese quelle su `profiles` e `registration_requests` — lettura solo della propria riga o da admin, nessuna policy di update/insert diretta per gli utenti normali: tutto passa dal trigger e dalle funzioni security definer di sezione 6) vanno anch'esse in `supabase/migrations/`, mai create a mano da dashboard — stesso principio della sezione 3.

## 10. Presentazione dei dati (frontend/UX)

La v1 di questa sezione era una lista di pagine, non un progetto di interazione — "su mobile diventa una card" non è un progetto, è un rimando. Revisione da UI/UX:

**Mappa delle pagine** (consolidata da tutta la discussione, aggiornata dopo la scelta "riservato"):

*Non autenticato*: Login/Registrazione (nome, cognome, squadra opzionale — è di fatto anche la landing page, non c'è altro da vedere finché non sei approvato) · stato "richiesta in revisione".
*Membro approvato*: **Home** (pannello squadra personale, vetrina generale, galleria stagioni — dettagliata più sotto) · Classifica · Calendario/Risultati · Formazioni · **Statistiche** (confronto punti/fantapunti tra due squadre, scoperta nel mockup) · Rosa squadra · Profilo squadra (storico) · Profilo giocatore (storico) · Albo d'oro · Ricerca · Il mio profilo (stato, squadra associata, sola lettura).
*Admin*: Pannello import (upload→anteprima→conferma) · Gestione registrazioni (approva/rifiuta).
Trasversale a tutte le pagine da membro: selettore stagione/competizione persistente in header (nav, non una pagina a sé). **Albo d'oro fa eccezione**: a differenza di Classifica/Formazioni/Statistiche (scoperte per una singola stagione/competizione selezionata), mostra TUTTE le annate insieme in un'unica lista scorrevole — coerente con cosa è davvero un albo d'oro (un registro storico), non con lo schema "seleziona prima l'anno". Podio Campionato (1° al centro più alto, 2° a sinistra, 3° a destra) più vincitore Coppa per ogni stagione; le stagioni senza dato (2022-23) mostrano lo stato vuoto esplicito invece di essere saltate in silenzio.

Rispetto alla mappa precedente: non esiste più una versione "pubblica" della Home o delle altre pagine di consultazione — prima di essere approvato, un visitatore vede solo login/registrazione. Questo semplifica un po' il frontend (niente doppia versione loggato/sloggato delle pagine di consultazione) mentre sposta la complessità sul backend (RLS, sezione 9).

**Navigazione**: con 6+ stagioni e più competizioni ciascuna, un selettore-stagione solo in home costringe a tornare indietro ogni volta che cambi vista. Serve un **selettore stagione/competizione persistente in header** (stile cambio-branch), così passi da Classifica a Formazioni della stessa stagione senza perdere contesto.

**Classifica su mobile — gerarchia esplicita, non solo "diventa card"**: la classifica ha 11 colonne (`Pos, Squadra, G, V, N, P, Gf, Gs, Dr, Pt, Pt. Totali`). Gerarchia proposta — **primario a colpo d'occhio**: posizione, squadra, logo, punti; **secondario dietro un tap**: V/N/P/Gf/Gs/Dr. Senza questa distinzione esplicita, la "card" finisce per essere solo una tabella compressa, ugualmente illeggibile.

**Formazioni — il campo grafico è un rischio su mobile, non solo un vezzo**: un campo orizzontale con 11+ nomi su schermo stretto o rimpicciolisce fino a illeggibile o forza zoom/scroll orizzontale. Meglio **orientamento verticale (ritratto)** — lo standard delle app fantasy sport su mobile per questo motivo esatto — con **lista testuale come default** e il campo grafico come "vedi campo" opzionale, non il contrario.

**Loghi: sono contenuto, non il linguaggio visivo del sito**. Ho controllato i file reali, non è un'assunzione: la maggioranza è 512×512 (probabile generatore-stemmi di fantacalcio.it), ma almeno uno (Biancoceleste Athletic Club, 2023-24) è 200×200, e negli anni si aggiungeranno probabilmente altre immagini caricate a mano con qualità non uniforme. Costruire l'identità visiva del sito *a partire dai* loghi è rischioso; meglio un design system pulito e neutro con un **contenitore fisso per ogni logo** (sfondo coerente, padding costante, crop uniforme) che assorbe la disomogeneità invece di esporla.

**Direzione visiva**: da decidere in una sessione dedicata quando arriviamo al frontend (userò la skill di design interna per questo), ma vale la pena orientarla fin da ora invece di rischiare un dashboard-template generico. Il materiale più caratteristico qui non è "fantacalcio" in astratto — è la cultura calcistica italiana: tabelloni da stadio, album di figurine, grafica da diretta sportiva. È lì che vale cercare un'identità distintiva, non nei default che qualunque generatore produce (crema+serif, nero+accento neon, giornale a filetti sottili) — nessuno dei tre ha a che fare col soggetto.

**Stati vuoti come momenti di design, non buchi silenziosi**: una stagione con dati legacy parziali (es. solo classifica finale, niente formazioni) deve dirlo esplicitamente ("formazioni non disponibili per questa stagione"), non mostrare una sezione vuota che sembra un bug. Stesso principio per la **registrazione**: dopo l'invio, l'utente deve vedere chiaramente "richiesta in revisione", non un silenzio che sembra un errore — e il form può mostrare quante squadre restano da rivendicare (es. "7 su 12 ancora libere"), che è anche un piccolo elemento di racconto coerente con la direzione della home page personalizzata.

**Stati di caricamento — stessa logica degli stati vuoti**: ogni route di stagione ha un `loading.tsx` con skeleton animato che ricalca la struttura della pagina reale (tabella classifica, gruppi giornata, match cards...). Il layout di stagione (navbar + tab) resta visibile durante il caricamento, lo skeleton sostituisce solo il contenuto — l'utente vede feedback in <50ms al click invece di un'attesa muta. Lato query: `createClient` e le query cross-dominio (`getSeasons`, `getCompetitions`) sono wrappate in `cache()` di React per evitare duplicazioni tra layout e page nella stessa render request; le query indipendenti (es. teams + branding) sono parallelizzate con `Promise.all`.

**Accessibilità come base**: contrasto colore per eventuali codifiche-colore-squadra, alt text sui loghi, focus da tastiera nel pannello admin. Con Tailwind e HTML semantico è quasi gratis se lo pensi da subito, costa caro se lo rincorri dopo.

**Homepage personalizzata per utente/squadra — risolve anche la domanda che avevo lasciato aperta** (archivio-consultazione vs esperienza da esplorare: ora è chiaramente la seconda). È anche, letteralmente, la pagina che oggi manca: la route `/` si limita a un `redirect` alla classifica dell'ultima stagione, nessun contenuto proprio — corretto come placeholder in Fase 2, ma è il momento di sostituirlo.

**Gerarchia della pagina, dall'alto verso il basso** — è la prima schermata dopo il login, deve orientare prima di elencare: (1) pannello squadra personale, solo se l'utente ha una squadra assegnata; (2) vetrina generale, visibile a chiunque sia approvato, squadra o no; (3) galleria stagioni, l'ingresso verso l'archivio vero e proprio.

**1. Pannello squadra personale** — meccanismo: `profiles.team_id` (sezione 6), assegnato dall'admin, non self-service. Da loggato con squadra assegnata, la home aggiunge questo pannello sopra al resto; senza squadra assegnata si salta direttamente al punto 2 — niente sezione vuota "nessuna squadra", è proprio assente. Proposta di statistiche, in ordine di priorità (tutte query di aggregazione sullo schema già definito, nessuna nuova complessità architetturale):

1. **Andamento storico** — grafico a linee del piazzamento per stagione partecipata. Con una sola stagione importata è un punto solo: sotto le 3 stagioni il componente mostra invece una card "stagione corrente" (posizione, punti, distacco dalla prima) e diventa grafico da solo appena i dati bastano a renderlo leggibile — stesso principio degli stati vuoti scritto sopra, non un placeholder silenzioso.
2. **Bacheca** — conteggio titoli vinti nel tempo (posizione 1 in `standings`), Campionato e Coppa separati (es. "Campionati: 1 · Coppe: 0") invece di un unico numero che nasconde quale competizione.
3. **Testa a testa** — record V/N/P contro ciascun avversario storico, da `matches`.
4. **Record personali** — miglior/peggior punteggio fantavoto di sempre, con giornata e avversario.
5. **Giocatore chiave** — con storico multi-stagione sufficiente, chi è rimasto in rosa più stagioni consecutive per quella squadra (da `rosters`); nella stagione singola attuale la stessa card mostra il giocatore più schierato di questa stagione (da `lineup_players`) — stesso slot, metrica che matura quando i dati lo permettono, non una voce che nel frattempo resta vuota o finta.

**2. Vetrina generale** — non richiede una squadra assegnata, quindi visibile anche a un membro approvato senza rivendicazione (es. chi segue la lega da spettatore). Digest verso le pagine dedicate, non una loro duplicazione:
- **Ultimi risultati** — mini-riepilogo dell'ultima giornata giocata, con link a Calendario.
- **Classifica in breve** — prime 3 posizioni, più la riga della squadra dell'utente evidenziata se fuori dal podio; link a Classifica completa.
- **Record della lega** — punteggio fantavoto più alto mai registrato in una giornata e vittoria con il margine più ampio, entrambi da `matches`, calcolati su tutte le squadre.
- **Squadra più titolata** — teaser (nome squadra + conteggio) che rimanda ad Albo d'oro, non lo sostituisce — la home non deve diventare una copia parziale di una pagina che esiste già.

**3. Galleria stagioni** — l'ingresso per navigare le annate a partire dalla home, distinto dal selettore persistente in header (sopra): quello serve a restare sulla stessa vista cambiando stagione da dentro una pagina già aperta, questo serve a scoprire quali stagioni esistono partendo da zero contesto. Una card per riga di `seasons` (stesso ordine di `getSeasons`), con etichetta, badge "in corso" per la stagione senza `ends_on`, click verso la classifica di quella stagione. Con una sola stagione (2025-26) la galleria è una card sola — non è uno stato transitorio da rimandare, è lo stato in cui deve reggere bene fin da subito: se ne aggiunge una ogni stagione che chiude.

Nota architetturale: come per le altre statistiche di questa sezione, tutto quanto sopra si calcola da tabelle già esistenti (`standings`, `matches`, `lineup_players`, `rosters`, `team_seasons`, `seasons`) — nessuna tabella nuova, solo query di aggregazione nuove e indipendenti tra loro (`apps/web/lib/queries/home.ts`), parallelizzabili con `Promise.all` come già in uso altrove in questa sezione. Il pannello squadra (punto 1) e la vetrina generale (punto 2) sono sezioni della stessa pagina, non due home diverse — quando `team_id` è nullo sparisce solo la prima, il resto resta identico. Questa è la proposta di layout definita, non 2-3 varianti tra cui scegliere: se qualcosa non convince (ordine delle sezioni, quali record di lega mostrare) conviene discuterlo puntualmente piuttosto che riaprire il foglio bianco.

**Cose che restano invariate dal v1, confermate**: rosa/profilo giocatore trasversale, profilo storico squadra, albo d'oro, ricerca full-text nativa Postgres (niente Algolia, sarebbe over-engineering per questi volumi), generazione statica per stagioni chiuse — vedi sezione 3, punto 5.

## 11. Roadmap a fasi

**Fase 0 — Fondamenta anti-fragili** *(nuova, prioritaria — completata)*
Repo scaffold (npm workspaces), progetto Supabase + prima migrazione con lo schema completo, generazione tipi TS automatica, CI base (typecheck, lint, keepalive). Incluso: il tuo profilo va creato/promosso ad `admin` con `status='approved'` direttamente via migrazione/seed, non passando dal flusso di registrazione — altrimenti non potresti vedere nulla nemmeno tu durante lo sviluppo, dato l'archivio riservato (sezione 9).

**Fase 1 — Ingestion stagioni moderne (2023-24 → 2025-26)** *(completata)*
Adapter xlsx (Rose, Classifica, Calendario, Formazioni, Coppa), schema Zod, loader idempotente, risoluzione alias squadre/giocatori, import pilota sulla 2025-26.

**Estensione — Ingestion generalizzata a tutte le 6 stagioni** *(in corso)*
Il pilota è stato generalizzato (`import-season.ts`/`check-season.ts`/`season-configs.ts`/`team-registry.ts`, non più `pilot-import-2025-26.ts` hardcoded) e validato su tutte e 6 le stagioni (2020-21 → 2025-26, inclusa la 2022-23 recuperata — sezione 1). Copre anche il caricamento loghi/maglie (`seedBranding`, dove la stagione ha la cartella `Loghi & Maglie/`). Import reale su Supabase staging in corso stagione per stagione: 2025-26, 2024-25, 2023-24, 2022-23 e 2021-22 completate e verificate (quest'ultima anche corretta successivamente per due fusioni giocatore errate, vedi nota di ingestion sotto); resta solo 2020-21.

**Fase 2 — Frontend core** *(completata)*
Pagine Classifica/Calendario/Rose/Formazioni per stagione, rendering server-side con sessione utente (niente più generazione statica, sezione 3 punto 5), repository layer tipizzato, responsive mobile. Tutte e quattro online. Formazioni mostra la lista testuale (titolari/panchina, voto/fantavoto) per giornata, non il campo grafico — resta l'opzione "vedi campo" descritta in sezione 10 se servirà in futuro, non è bloccante. Aggiunto rispetto alla formulazione iniziale: il selettore stagione/competizione persistente in header previsto in sezione 10 è ora un layout condiviso (`stagioni/[season]/layout.tsx`) sopra tutte le pagine di stagione, con tab di navigazione tra Classifica/Calendario/Rose/Formazioni; il selettore competizione si nasconde da sé sulle pagine (come Rose) la cui tabella non ha una dimensione competizione.

**Fase 3 — Auth + pannello admin**
Supabase Auth, ruoli, RLS, upload → anteprima → conferma import. Registrazione utenti (nome/cognome/squadra rivendicata), Edge Function + Resend per la notifica email admin, schermata admin per approvare/rifiutare le richieste.

**Fase 4 — Feature trasversali**
**Home personalizzata** (pannello squadra + vetrina generale + galleria stagioni, sezione 10 — priorità alta: è il primo schermo dopo il login e oggi la route `/` si limita a un redirect alla classifica). Profilo giocatore multi-stagione, profilo squadra storico, ricerca. **Albo d'oro** (podio Campionato + vincitore Coppa per ogni annata, layout già in mockup) e **Statistiche** (confronto punti/fantapunti tra due squadre, sezione 6 — nessuna tabella nuova, si calcola da `matches`) hanno già un mockup funzionante: restano da collegare ai dati reali e aggiungere le competizioni diverse dal Campionato.

**Fase 5 — Dati legacy (immagini 2020-21/2021-22)** *(ridimensionata — vedi sezione 8)*
Si ipotizzava un adapter OCR completo (img2table + eventuale cross-check vision LLM). Verificato invece che quasi tutti i dati di quelle 2 stagioni sono xlsx puliti, già coperti dalla Fase 1 generalizzata; resta solo il calendario dei gironi di Coppa come gap immagine-soltanto, trattato come lacuna dati accettata (stesso pattern di 2022-23) finché non risulterà davvero necessario recuperarlo.

**Estensione — Stagione 2018-19 da mirror HTML legacy** *(completata, vedi sezione 7.2)*
Prima stagione precedente al 2020-21 recuperata: fonte diversa (sito scaricato, non xlsx né immagini), adapter `html-legacy` dedicato. Importata e verificata: 4 competizioni, classifiche/calendario campionato completi, Coppa parziale dove la fonte stessa è uno snapshot a metà stagione, branding completo, nessuna formazione (gap di fonte, non di importazione).

**Fase 6 — Siti storici scaricati (edizioni pre-2020)**
Adapter `html-legacy` quando i file sono disponibili, stesso schema canonico, nessuna modifica al resto del sistema.

## 12. Domande aperte

- Le edizioni "siti interi scaricati": che formato hanno esattamente (HTML statico, screenshot, altro)? Definisce l'adapter della fase 6 — per ora resta "poi vediamo", nessuna azione richiesta ora.
- Per la direzione visiva: preferisci che ti proponga 2-3 direzioni concrete da cui partire quando arriviamo al frontend, o hai già un'idea/riferimento in testa?

**Risolte in questa revisione**: stagione 2022-23 confermata mancante (sezione 1 — **superato**: recuperata separatamente in seguito, vedi nota di aggiornamento in sezione 1); utenti normali solo in consultazione, zero scritture (sezione 9); loghi/maglie senza ottimizzazione in fase di import; home page personalizzata per utente/squadra con statistiche (sezione 10); workflow Supabase pull+push (sezione 4); flusso di registrazione con validazione admin (sezione 9).

## 13. Prossimo passo pratico

Se il piano ti torna, il prossimo step concreto è la Fase 0: scaffold del repo + prima migrazione Supabase con lo schema di sezione 6 + script di generazione tipi. Fammi sapere se vuoi che parta da lì.

## 14. Checklist pre-avvio e convenzioni di sviluppo

Rilettura completa del piano con una domanda sola: cosa manca per iniziare senza sorprese. Più le due convenzioni esplicite che hai chiesto (modularità, TypeScript) e una ricerca sulle pratiche correnti di sviluppo assistito da AI — non solo principi generali, cose verificate ora.

### Cosa manca davvero

**Blocca un avvio sicuro, da risolvere prima della Fase 0:**
- **Backup Supabase**: il piano free **non ha backup automatici né point-in-time recovery** — confermato dalla documentazione ufficiale, che raccomanda esplicitamente `supabase db dump` via CLI più backup off-site per i progetti free. Per un archivio storico con dati non recuperabili da altrove, non è opzionale: **GitHub Action schedulata** (settimanale basta, a questi volumi) che fa `supabase db dump`, comprime, e carica su uno storage separato dal progetto stesso. Va in Fase 0, non rimandata.
- **TypeScript**: non l'avevi mai detto esplicitamente in questa conversazione — l'ho assunto dal resto del tuo lavoro. Lo confermo/fisso ora esplicitamente: sì, TypeScript, `strict: true` da subito (dettagli sotto).
- **Variabili d'ambiente**: mai elencate. Servono almeno `SUPABASE_URL`, `SUPABASE_ANON_KEY` (client pubblico), `SUPABASE_SERVICE_ROLE_KEY` (solo script di ingestion, mai nel client/nel browser), `RESEND_API_KEY` (Edge Function) — duplicate per staging/prod, scoping corretto su Netlify (preview ≠ prod, sezione 4).
- **Framework di test**: mai scelto. Consiglio **Vitest** — sintassi Jest-like, integrazione naturale con Vite/Next, veloce — sia per la regressione dei parser che per gli unit test del loader (sezione 7).

**Da decidere in Fase 0, non bloccante ma da non rimandare:**
- Libreria di parsing xlsx per gli script di ingestion (diversa dall'artifact React, che ha SheetJS a disposizione): **`xlsx` (SheetJS)** o **`exceljs`** — si sceglie in base a come si comportano sui file reali, ma va nominata esplicitamente in Fase 0.
- ESLint + Prettier, con `@typescript-eslint/no-explicit-any` a `error` (dettagli sotto).
- `tailwind.config` con token dal nome semantico ("pitch-950", non "emerald-950") invece di classi sparse come nel mockup — un cambio palette futuro diventa una modifica in un punto solo.
- Versione Node fissata (`.nvmrc` + `engines` in `package.json`) — evita differenze locale/CI.

**Assunzioni da rendere esplicite, non gap ma cose da confermare:**
- Sto assumendo un archivio di stagioni **chiuse**, non un tracker live per una stagione in corso — se in futuro vuoi seguire una stagione mentre si gioca, cambia la cadenza di importazione, se ne parla quando succede.
- Nota minore: il piano free Supabase ha anche un tetto di banda in uscita (~5GB/mese), oltre il quale le richieste falliscono. Con questi volumi di traffico è molto improbabile arrivarci, ma vale la pena saperlo.

### Modularità e dimensione dei file

Non era scritto da nessuna parte prima d'ora — hai ragione a chiederlo esplicitamente. Regole concrete, non un principio vago:

- **Un componente, un file**; il nome del file combacia col nome del componente esportato.
- **Soglia software, non hardware**: un file oltre le ~200-250 righe è un segnale da controllare in revisione — quasi sempre vuol dire che sta facendo più di una cosa — non un limite imposto meccanicamente in CI (i limiti rigidi si aggirano e spostano il problema, non lo risolvono).
- **Cartella per dominio, non per tipo**: `components/classifica/`, `components/formazioni/`, `components/albo-doro/` — stesso principio già in uso lato ingestion (`adapters/xlsx/`, `adapters/ocr/`).
- **Esempio concreto sotto gli occhi**: il mockup che hai ora è un file da ~560 righe con 19 componenti dentro — perfetto per un mockup (gli artifact sono a file singolo per come è fatto l'ambiente in cui li genero), esattamente quello che NON vogliamo nella repo vera. In Fase 2, ognuno di quei componenti (`Crest`, `PlayerRow`, `MatchCard`, `Podium`, `StatisticheView`...) diventa un file a sé.

### TypeScript: niente `any`, e i tipi corretti da dove vengono davvero

- `tsconfig.json` con `"strict": true` da subito — la singola impostazione con più leva (attiva insieme `noImplicitAny`, `strictNullChecks` e il resto).
- ESLint: `@typescript-eslint/no-explicit-any` a `error`, non `warn` — altrimenti resta un'intenzione, non una regola verificata.
- I tipi corretti non si indovinano, si derivano da due fonti già nel piano: gli schema Zod (sezione 7) via `z.infer<typeof RosterImport>` — stesso tipo sia per validare che per programmare, zero duplicazione — e `supabase gen types typescript` (sezione 3) per le righe del database.
- Quando un tipo è genuinamente sconosciuto (es. una cella xlsx prima di validarla), il sostituto disciplinato di `any` è **`unknown`**: obbliga a verificare/restringere prima di usarlo, mentre `any` disattiva il controllo — sono opposti, non sinonimi, anche se spesso confusi tra loro.

### Linee guida di sviluppo — anche con AI, da fonti verificate ora

- **AGENTS.md come standard 2026**: convenzione ormai consolidata (ha soppiantato il precedente frammentato CLAUDE.md/.cursorrules/copilot-instructions.md) per dare a Claude Code, Cursor, Copilot ecc. il contesto su architettura, convenzioni e pattern non ovvi di un progetto — farlo da subito in Fase 0 evita di doverlo ricostruire dopo su una base di codice già cresciuta. La parte più utile non è "come si scrive TypeScript" (l'AI lo sa già), sono i pattern *non ovvi di questo progetto*: perché `standings` non si ricalcola mai, perché `lineup_players` non ha bonus/malus, perché i lookup table esistono solo dove c'è variabilità osservata.
- **Già preparati** (ricerca su Copilot/Claude Code/Antigravity, luglio 2026): `AGENTS.md` come file canonico — letto nativamente sia da Claude Code sia da Antigravity, confermato dalla documentazione di entrambi; `.github/copilot-instructions.md` breve, rimanda ad `AGENTS.md` invece di duplicarlo; `CLAUDE.md` come redirect minimo per sicurezza; skill di progetto `fantatopa-dev` in `.agents/skills/` (stesso path neutro letto sia da Claude Code sia da Antigravity) che fa da router verso le sezioni del piano invece di caricarle tutte; skill `ponytail` (filosofia "lazy senior dev": riuso prima di scrivere codice nuovo, fix sulla causa comune non sul sintomo, niente astrazioni non richieste — con nota esplicita che questo non vale per `SeasonRepository`/adapter/lookup table, già decisi altrove nel piano). Cinque file in tutto: quattro caricati solo su innesco (i due skill più i redirect Copilot/Claude), `AGENTS.md` invece sempre in contesto e per questo tenuto corto — è la risposta concreta al risparmio di token. Pronti da mettere nella repo alla Fase 0.
- **Specification-Driven Development**: scrivere la specifica prima del codice, tenerla accanto al codice, far produrre all'agente un piano di implementazione dalla specifica prima di toccare i file — è esattamente il percorso seguito in questa conversazione (piano → revisione → mockup → correzioni), non un giro burocratico in più: è il pattern che le fonti più recenti raccomandano esplicitamente.
- **Verifica, non fiducia cieca**: il codice generato da un agente va trattato come una PR di un collega junior — si leggono i diff, si fanno girare i test, si controllano i casi limite — non si accetta come corretto solo perché compila. Vale ancora di più qui: il dataset è piccolo ma i dati sono unici e non recuperabili altrove, da cui il punto sul backup in cima a questa sezione.
