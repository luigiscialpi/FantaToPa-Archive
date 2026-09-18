-- Esegue in sola lettura una SELECT già validata dall'applicazione (vedi
-- apps/web/lib/ai-assistente/sql-validator.ts). Questa funzione NON decide se il
-- contenuto della query è ammesso — quella decisione è già stata presa prima di
-- arrivare qui. Il suo compito è fornire un ambiente di esecuzione sicuro:
-- nessuna scrittura possibile, tempo limitato, righe limitate, a prescindere da
-- cosa succede a monte.
create or replace function execute_readonly_query(query_text text)
returns setof json
language plpgsql
security invoker  -- NON "security definer": deve girare con i privilegi e la
                   -- RLS di CHI CHIAMA la funzione, non bypassarli. Le funzioni
                   -- vicine in questo schema (is_admin, can_read_league_data)
                   -- sono security definer per un motivo opposto e specifico
                   -- (leggere `profiles` a prescindere dall'RLS del chiamante):
                   -- non copiare quell'attributo qui per abitudine.
set search_path = public
as $$
begin
  -- Garanzia a livello di motore Postgres, non di logica applicativa: qualunque
  -- istruzione di scrittura dentro query_text fallisce qui, indipendentemente
  -- da whitelist/grant/RLS.
  set local transaction_read_only = on;

  -- Copre query lette come "legittime" dal validator ma comunque costose
  -- (join non filtrati, tabelle che crescono) e qualunque funzione che perde
  -- tempo invece di scrivere (es. pg_sleep, se mai superasse gli altri controlli).
  set local statement_timeout = '3s';

  -- Limite assoluto di righe imposto QUI, indipendente da qualunque LIMIT che
  -- l'applicazione abbia già messo nel testo: resta valido anche se in futuro
  -- un altro punto del codice chiamasse questa funzione senza passare dal
  -- validator applicativo.
  return query execute format(
    'select to_json(_riga) from (%s) as _riga limit 500',
    query_text
  );
end;
$$;

grant execute on function execute_readonly_query(text) to authenticated;
