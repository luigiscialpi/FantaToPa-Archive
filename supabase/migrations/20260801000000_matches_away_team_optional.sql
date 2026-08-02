-- I gironi di Coppa (competitions.format_code = 'gironi') hanno un numero
-- dispari di squadre (5): il file Formazioni_* stampa la squadra in esubero
-- di ogni giornata in un blocco senza avversario (colonne away vuote per
-- tutto il blocco) — non un incontro 1-contro-1, solo il punteggio di quella
-- squadra per la giornata. Serve poter registrare una partita con la sola
-- squadra home.
alter table matches alter column away_team_id drop not null;

-- Con away_team_id NULL l'unique esistente (matchday_id, home_team_id,
-- away_team_id) non basta: NULL non è mai considerato uguale a se stesso in
-- un vincolo unique standard, quindi l'upsert del loader (onConflict su
-- quelle tre colonne) non troverebbe mai la riga già inserita per una
-- squadra "solo" e ne creerebbe una nuova a ogni re-import. Indice parziale
-- dedicato: al più una riga "solo" per squadra/giornata.
create unique index matches_solo_home_team_unique
  on matches (matchday_id, home_team_id)
  where away_team_id is null;
