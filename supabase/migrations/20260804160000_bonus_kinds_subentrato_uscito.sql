-- Nuovi tipi di evento: le fonti HTML legacy 2011-12/2012-13/2013-14
-- (Html2013BonusAdapter) hanno SEMPRE avuto icone "Entrato"/"Uscito" per
-- ogni sostituzione, ignorate finora (IGNORED_LABELS) perché non
-- esisteva ancora un code corrispondente. Nessuna fonte finora ha invece
-- un'icona "infortunio" verificabile: non aggiunta.
insert into bonus_kinds (code, label) values
  ('subentrato', 'Subentrato'),
  ('uscito', 'Uscito');
