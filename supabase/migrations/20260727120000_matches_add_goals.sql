-- Aggiunge i gol per singola partita a `matches`. Il file sorgente
-- Calendario_*.xlsx riporta un campo "risultato" (es. "2-2") accanto al
-- fantavoto, finora parsificato solo per derivare home/away_result_points
-- (3/1/0) e poi scartato. Verificato che la somma di questi gol per
-- squadra, su tutta la stagione, torna esattamente con goals_for/
-- goals_against dello snapshot importato in `standings` (vedi test di
-- regressione in packages/ingestion/adapters/xlsx/calendar.test.ts).
-- Servono per calcolare Gf/Gs/Dr anche su un intervallo di giornate, cosa
-- che lo snapshot in `standings` (sempre e solo il finale stagione) non
-- permette.
alter table matches
  add column home_goals int,
  add column away_goals int;

comment on column matches.home_goals is
  'Gol squadra home in questa partita, dal campo "risultato" del calendario xlsx (non dal fantavoto). Null per partite importate prima di questa colonna, finché non ri-importate.';
comment on column matches.away_goals is
  'Gol squadra away in questa partita, dal campo "risultato" del calendario xlsx (non dal fantavoto). Null per partite importate prima di questa colonna, finché non ri-importate.';
