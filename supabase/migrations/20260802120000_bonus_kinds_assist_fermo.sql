-- Nuovo tipo di bonus scoperto nella fonte HTML legacy della stagione
-- 2017-18 (icona "assistf_s.png", alt="assist da fermo" — assist da calcio
-- piazzato/palla inattiva), assente dal set osservato per il Campionato
-- 2025-26 (migrazione 20260731090000, 13 tipi). Nessun valore in punti noto
-- per questo bonus (a differenza di altri codici, il cui label riporta
-- "(+N)"): la fonte non lo specifica, quindi il label resta descrittivo
-- soltanto, stesso trattamento già usato per `portiere_imbattuto`/
-- `player_of_the_match`.
insert into bonus_kinds (code, label) values ('assist_fermo', 'Assist da fermo');
