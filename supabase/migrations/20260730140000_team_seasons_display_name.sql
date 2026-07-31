-- Nome storico della squadra per QUELLA specifica stagione (es. "Hertha
-- Rallo" nel 2020-21, poi ridenominata "Los Cientoquattros Hertha Rallo"
-- nelle stagioni successive). teams.canonical_name resta l'identità stabile
-- cross-stagione (usata per risolvere gli alias e per confronti storici tipo
-- Albo d'Oro): display_name è il nome che la squadra usava DAVVERO in questa
-- stagione, popolato in import-season.ts dal nome grezzo letto dai file
-- sorgente prima della risoluzione alias.
-- Nullable: stagioni importate prima di questa colonna (o senza il dato)
-- mostrano canonical_name come fallback lato query, non un valore fittizio.
alter table team_seasons add column display_name text;
