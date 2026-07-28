-- Recupera 3 informazioni presenti negli xlsx Formazioni ma finora perse in
-- fase di import/persistenza:
--   1) counts_for_total: nel file, il fantavoto dei giocatori che concorrono
--      al totale squadra è in verde (nota nel foglio: "In verde i fantavoti
--      che portano punteggio alla squadra"), gli altri in un colore più
--      leggero. Non deducibile da voto/fantavoto null: un panchinaro può
--      avere un fantavoto reale e comunque non contare (il titolare ha
--      giocato), e viceversa un panchinaro può sostituire un titolare e
--      contare pur restando slot='panchina'. Default true a livello DB come
--      rete di sicurezza; l'adapter fornirà sempre un valore esplicito.
--   2) defense_modifier: già estratto dall'adapter xlsx ma mai scritto su
--      lineups — perso silenziosamente all'upsert.
--   3) submitted_via/submitted_at: riga "Inserita via app|web il
--      DD-MM-YYYY HH:mm:ss" del file, letta e scartata finora.
alter table lineups
  add column defense_modifier integer not null default 0,
  add column submitted_via text check (submitted_via in ('app', 'web')),
  -- ponytail: timestamp senza fuso orario (non timestamptz). Il valore
  -- arriva dal file già come stringa "naive" DD-MM-YYYY HH:mm:ss (orario
  -- locale del dispositivo di chi ha inviato la formazione, non annotato con
  -- un fuso esplicito); è un dato di sola visualizzazione, mai confrontato
  -- con altri istanti cross-timezone. Upgrade path se mai servisse: calcolare
  -- l'offset Europe/Rome (CET/CEST) in fase di adapter e passare a
  -- timestamptz.
  add column submitted_at timestamp;

alter table lineup_players
  add column counts_for_total boolean not null default true;
