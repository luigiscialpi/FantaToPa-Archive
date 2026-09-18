create table assistant_settings (
  id text primary key default 'default' check (id = 'default'),
  models text[] not null default array['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'],
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

alter table assistant_settings enable row level security;

-- Qualunque utente approvato che può usare l'assistente può leggere la catena dei modelli
create policy "assistant_settings_read_authenticated" on assistant_settings
  for select using (auth.role() = 'authenticated');

-- Solo gli admin possono modificare o inserire le impostazioni dei modelli
create policy "assistant_settings_admin_update" on assistant_settings
  for update using (is_admin()) with check (is_admin());

create policy "assistant_settings_admin_insert" on assistant_settings
  for insert with check (is_admin());

-- Inserimento della configurazione di default
insert into assistant_settings (id, models)
values ('default', array['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'])
on conflict (id) do nothing;
