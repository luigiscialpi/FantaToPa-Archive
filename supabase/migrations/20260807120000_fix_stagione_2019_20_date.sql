-- Corregge la data di inizio/fine della Stagione 2019/2020 creata senza
-- `starts_on`. Senza questa data l'ORDER BY starts_on DESC la piazza in
-- fondo alla lista in Albo d'Oro/Home, e `ends_on = today` la fa apparire
-- potenzialmente come "in corso" o con il click disabilitato.
update seasons
set starts_on = '2019-08-01',
    ends_on   = '2020-06-30'
where slug = '2019-20';
