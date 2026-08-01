-- Bonus/malus granulari (gol, assist, cartellini, rigori, portiere
-- imbattuto...) per singolo giocatore REALE, dalla pagina "Voti" di
-- leghe.fantacalcio.it (fonte diversa dagli xlsx Formazioni, che riportano
-- solo voto/fantavoto finali — vedi commento originale su
-- lineup_players.voto in 20260726000000_schema_iniziale.sql). Prima non
-- modellato perché non esisteva un dato reale da cui derivarlo; ora esiste
-- per la stagione 2025-26 (37 file HTML, uno per giornata di Campionato).
--
-- Lookup estendibile (stessa filosofia di competition_kinds/formats): 13
-- tipi osservati scansionando tutti i 37 file di una stagione reale, non
-- ipotetici. Escluso deliberatamente il malus "fuori ruolo" Mantra
-- (attributo data-malus sul singolo giocatore, sempre -1 quando presente
-- nei file osservati): è un vincolo di formazione/legalità schieramento,
-- non un evento della partita reale al pari di gol/assist/cartellini —
-- concettualmente diverso da "bonus/malus per ogni scontro" richiesto.
-- Nessuna colonna "points": la tabella è solo per la VISUALIZZAZIONE
-- (badge accanto al giocatore in Formazioni), non per ricalcolare il
-- fantavoto — che resta sempre quello importato dagli xlsx, stessa
-- filosofia "standings mai ricalcolate automaticamente".
create table bonus_kinds (
  code text primary key,
  label text not null
);

insert into bonus_kinds (code, label) values
  ('gol_fatto', 'Gol segnato (+3)'),
  ('gol_subito', 'Gol subito (-1)'),
  ('assist', 'Assist'),
  ('assist_soft', 'Assist Soft'),
  ('assist_gold', 'Assist Gold'),
  ('ammonizione', 'Ammonizione (-0.5)'),
  ('espulsione', 'Espulso (-1)'),
  ('autogol', 'Autogol (-2)'),
  ('rigore_segnato', 'Rigore segnato (+3)'),
  ('rigore_sbagliato', 'Rigore sbagliato (-3)'),
  ('rigore_parato', 'Rigore parato (+3)'),
  ('portiere_imbattuto', 'Portiere imbattuto'),
  ('player_of_the_match', 'Player of the match');

-- Un evento è un fatto della partita REALE di Serie A di quella giornata,
-- non della formazione fantacalcio: se due squadre schierano lo stesso
-- giocatore la stessa giornata, condividono lo stesso set di eventi. Per
-- questo la FK è a matchday_id (SEMPRE una giornata di Campionato, l'unica
-- fonte diretta) + player_id, non a lineup_player_id — evita di duplicare
-- righe identiche per ogni squadra che schiera quel giocatore, e permette
-- di "derivare" i bonus di Coppa con un JOIN invece di un secondo import
-- (vedi matchday_bonus_sources sotto).
create table player_matchday_bonuses (
  id uuid primary key default gen_random_uuid(),
  matchday_id uuid not null references matchdays(id) on delete cascade,
  player_id uuid not null references players(id),
  kind_code text not null references bonus_kinds(code),
  position_order int not null default 0
);
create index player_matchday_bonuses_lookup on player_matchday_bonuses (matchday_id, player_id);

-- Collega la giornata di UNA competizione (tipicamente Coppa) alla giornata
-- di Campionato che condivide gli stessi risultati reali di Serie A: mostrare
-- i bonus di una giornata di Coppa diventa un JOIN attraverso questa
-- mappatura invece di un secondo import — "derivare" i bonus/malus di Coppa
-- (vedi piano-sviluppo sezione 6) è letteralmente popolare questa tabella.
-- Assente per una giornata = nessun bonus derivabile (stesso principio
-- "nessun dato inventato" del resto del progetto), non un errore.
create table matchday_bonus_sources (
  matchday_id uuid primary key references matchdays(id) on delete cascade,
  source_matchday_id uuid not null references matchdays(id) on delete cascade
);

alter table bonus_kinds enable row level security;
create policy "bonus_kinds_select_members" on bonus_kinds for select using (can_read_league_data());
create policy "bonus_kinds_write_admin" on bonus_kinds for all using (is_admin()) with check (is_admin());

alter table player_matchday_bonuses enable row level security;
create policy "player_matchday_bonuses_select_members" on player_matchday_bonuses for select using (can_read_league_data());
create policy "player_matchday_bonuses_write_admin" on player_matchday_bonuses for all using (is_admin()) with check (is_admin());

alter table matchday_bonus_sources enable row level security;
create policy "matchday_bonus_sources_select_members" on matchday_bonus_sources for select using (can_read_league_data());
create policy "matchday_bonus_sources_write_admin" on matchday_bonus_sources for all using (is_admin()) with check (is_admin());
