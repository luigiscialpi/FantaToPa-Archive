-- I file Formazioni_*.xlsx di Coppa Fase Finale (eliminazione diretta)
-- riportano una riga aggiuntiva "Fattore campo" (bonus per chi ha il
-- vantaggio campo in quel turno), assente in Campionato e nei gironi di
-- Coppa. Finora l'adapter la riconosceva solo per non rompere la lettura
-- del TOTALE (che già la include), ma non la salvava da nessuna parte —
-- stessa gap che aveva defense_modifier prima della migration precedente.
-- Stesso trattamento: colonna dedicata su lineups, non not null default 0.
alter table lineups
  add column field_advantage integer not null default 0;
