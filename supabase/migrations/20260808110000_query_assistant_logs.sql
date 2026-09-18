create table query_assistant_logs (
  id uuid primary key default gen_random_uuid(),
  -- Un tentativo di Gemini (Passo 8 può farne fino a due) è una riga.
  -- richiesta_id è lo stesso per tutti i tentativi della stessa domanda
  -- dell'utente: leggendo il log, righe con lo stesso richiesta_id sono la
  -- storia di UNA sola interazione, non richieste distinte.
  richiesta_id uuid not null,
  tentativo int not null default 1,
  user_id uuid references profiles(id),
  domanda text not null,
  sql_generata text,
  -- 'rifiutata' = il validator o Gemini hanno fatto il loro lavoro e hanno
  -- bloccato qualcosa correttamente. 'errore_interno' = qualcosa che NON
  -- doveva succedere (bug, Gemini irraggiungibile, Supabase giù) — è la
  -- categoria che segnala davvero un problema da controllare, non le altre tre.
  esito text not null check (esito in ('accettata', 'rifiutata', 'fuori_tema', 'errore_interno')),
  motivo_rifiuto text,
  latenza_ms int,
  righe_restituite int,
  created_at timestamptz not null default now()
);

alter table query_assistant_logs enable row level security;
create policy "query_assistant_logs_admin_only" on query_assistant_logs
  for all using (is_admin()) with check (is_admin());

create policy "query_assistant_logs_insert_own" on query_assistant_logs
  for insert with check (user_id = auth.uid());
