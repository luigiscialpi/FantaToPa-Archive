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
  first_name text,  -- nullable per lo stesso motivo di registration_requests sopra
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
  -- nullable per costruzione, non svista: il trigger handle_new_user scrive qui
  -- SEMPRE, anche se auth.users arriva senza metadata nome/cognome (es. un
  -- percorso di signup diverso dal form, o un utente creato a mano da Studio).
  -- Un NOT NULL qui farebbe fallire l'intera transazione di signup, non solo
  -- la scrittura del profilo. La richiesta di nome/cognome resta comunque:
  -- si applica lato form (validazione client) e come condizione per
  -- l'approvazione admin, non come vincolo che può rompere l'iscrizione.
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
-- ============================================================
-- Row Level Security
-- ============================================================

-- Tabelle di dati lega: lettura membri approvati (o admin), scrittura solo
-- admin. Esplicite una per una anche se ripetitive: per la sicurezza la
-- leggibilita/auditabilita conta piu della brevita (vedi skill ponytail,
-- 'not lazy about... security').
alter table seasons enable row level security;
create policy "seasons_select_members" on seasons for select using (can_read_league_data());
create policy "seasons_write_admin" on seasons for all using (is_admin()) with check (is_admin());

alter table teams enable row level security;
create policy "teams_select_members" on teams for select using (can_read_league_data());
create policy "teams_write_admin" on teams for all using (is_admin()) with check (is_admin());

alter table team_aliases enable row level security;
create policy "team_aliases_select_members" on team_aliases for select using (can_read_league_data());
create policy "team_aliases_write_admin" on team_aliases for all using (is_admin()) with check (is_admin());

alter table team_seasons enable row level security;
create policy "team_seasons_select_members" on team_seasons for select using (can_read_league_data());
create policy "team_seasons_write_admin" on team_seasons for all using (is_admin()) with check (is_admin());

alter table competition_kinds enable row level security;
create policy "competition_kinds_select_members" on competition_kinds for select using (can_read_league_data());
create policy "competition_kinds_write_admin" on competition_kinds for all using (is_admin()) with check (is_admin());

alter table competition_formats enable row level security;
create policy "competition_formats_select_members" on competition_formats for select using (can_read_league_data());
create policy "competition_formats_write_admin" on competition_formats for all using (is_admin()) with check (is_admin());

alter table competitions enable row level security;
create policy "competitions_select_members" on competitions for select using (can_read_league_data());
create policy "competitions_write_admin" on competitions for all using (is_admin()) with check (is_admin());

alter table roles enable row level security;
create policy "roles_select_members" on roles for select using (can_read_league_data());
create policy "roles_write_admin" on roles for all using (is_admin()) with check (is_admin());

alter table players enable row level security;
create policy "players_select_members" on players for select using (can_read_league_data());
create policy "players_write_admin" on players for all using (is_admin()) with check (is_admin());

alter table player_aliases enable row level security;
create policy "player_aliases_select_members" on player_aliases for select using (can_read_league_data());
create policy "player_aliases_write_admin" on player_aliases for all using (is_admin()) with check (is_admin());

alter table player_roles enable row level security;
create policy "player_roles_select_members" on player_roles for select using (can_read_league_data());
create policy "player_roles_write_admin" on player_roles for all using (is_admin()) with check (is_admin());

alter table rosters enable row level security;
create policy "rosters_select_members" on rosters for select using (can_read_league_data());
create policy "rosters_write_admin" on rosters for all using (is_admin()) with check (is_admin());

alter table matchdays enable row level security;
create policy "matchdays_select_members" on matchdays for select using (can_read_league_data());
create policy "matchdays_write_admin" on matchdays for all using (is_admin()) with check (is_admin());

alter table matches enable row level security;
create policy "matches_select_members" on matches for select using (can_read_league_data());
create policy "matches_write_admin" on matches for all using (is_admin()) with check (is_admin());

alter table lineups enable row level security;
create policy "lineups_select_members" on lineups for select using (can_read_league_data());
create policy "lineups_write_admin" on lineups for all using (is_admin()) with check (is_admin());

alter table lineup_players enable row level security;
create policy "lineup_players_select_members" on lineup_players for select using (can_read_league_data());
create policy "lineup_players_write_admin" on lineup_players for all using (is_admin()) with check (is_admin());

alter table standings enable row level security;
create policy "standings_select_members" on standings for select using (can_read_league_data());
create policy "standings_write_admin" on standings for all using (is_admin()) with check (is_admin());

alter table market_values enable row level security;
create policy "market_values_select_members" on market_values for select using (can_read_league_data());
create policy "market_values_write_admin" on market_values for all using (is_admin()) with check (is_admin());

alter table import_source_types enable row level security;
create policy "import_source_types_select_members" on import_source_types for select using (can_read_league_data());
create policy "import_source_types_write_admin" on import_source_types for all using (is_admin()) with check (is_admin());

-- import_batches: solo admin, e' audit interno dell'import, non contenuto
-- da mostrare ai membri normali.
alter table import_batches enable row level security;
create policy "import_batches_admin_only" on import_batches for all using (is_admin()) with check (is_admin());

-- profiles: ognuno legge la propria riga, admin legge tutte. Nessuna policy
-- di insert/update/delete per utenti normali: quelle scritture passano solo
-- dal trigger handle_new_user e dalla funzione approve_registration, entrambe
-- security definer (bypassano RLS di proposito, dall'interno).
alter table profiles enable row level security;
create policy "profiles_select_own_or_admin" on profiles for select using (id = auth.uid() or is_admin());

-- registration_requests: ognuno legge la propria richiesta, admin legge tutte.
-- Stesso principio: insert arriva dal trigger, update solo da approve_registration.
alter table registration_requests enable row level security;
create policy "registration_requests_select_own_or_admin" on registration_requests for select using (auth_user_id = auth.uid() or is_admin());

