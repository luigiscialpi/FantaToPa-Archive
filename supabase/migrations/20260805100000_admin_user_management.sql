-- Pannello admin "Utenti" (richiesta esplicita, 2026-08-05): vedere tutti
-- gli utenti registrati con la squadra assegnata, cambiarne il ruolo,
-- riassegnare la squadra, eliminare l'account. Stesso pattern di
-- approve_registration/reject_registration: funzioni security definer che
-- controllano is_admin() al loro interno, uniche autorità di scrittura su
-- profiles/auth.users da qui — niente nuova policy RLS di update su
-- profiles, che resterebbe altrimenti scrivibile anche a bypass di queste
-- regole.

-- Registro di audit per le modifiche dirette dell'admin (questa pagina e,
-- in futuro, l'editing di Classifica/Calendario/Rose/Formazioni): before/
-- after come JSON della riga toccata.
create table admin_edits (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id),
  table_name text not null,
  row_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
alter table admin_edits enable row level security;
create policy "admin_edits_admin_only" on admin_edits for all using (is_admin()) with check (is_admin());

-- L'email vive solo in auth.users, mai leggibile da PostgREST/RLS: lettura
-- diretta permessa qui perché la funzione gira coi privilegi del suo owner
-- (postgres), stesso precedente di 20260804170000_registration_requests_email.sql.
create or replace function admin_list_users()
returns table (
  id uuid,
  email text,
  first_name text,
  last_name text,
  role text,
  status text,
  team_id uuid,
  team_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'Solo admin può vedere la lista utenti';
  end if;

  return query
    select p.id, u.email, p.first_name, p.last_name, p.role, p.status, p.team_id, t.canonical_name, u.created_at
    from profiles p
    join auth.users u on u.id = p.id
    left join teams t on t.id = p.team_id
    order by u.created_at asc;
end;
$$;

create or replace function admin_set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prev profiles%rowtype;
begin
  if not is_admin() then
    raise exception 'Solo admin può cambiare un ruolo';
  end if;
  if new_role not in ('user', 'admin') then
    raise exception 'Ruolo non valido: %', new_role;
  end if;

  select * into prev from profiles where id = target_user_id;
  if not found then
    raise exception 'Utente non trovato';
  end if;

  update profiles set role = new_role where id = target_user_id;

  insert into admin_edits (admin_user_id, table_name, row_id, action, before, after)
  values (auth.uid(), 'profiles', target_user_id, 'update', to_jsonb(prev), jsonb_build_object('role', new_role));
end;
$$;

create or replace function admin_set_user_team(target_user_id uuid, new_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prev profiles%rowtype;
begin
  if not is_admin() then
    raise exception 'Solo admin può riassegnare una squadra';
  end if;

  select * into prev from profiles where id = target_user_id;
  if not found then
    raise exception 'Utente non trovato';
  end if;

  update profiles set team_id = new_team_id where id = target_user_id;

  insert into admin_edits (admin_user_id, table_name, row_id, action, before, after)
  values (auth.uid(), 'profiles', target_user_id, 'update', to_jsonb(prev), jsonb_build_object('team_id', new_team_id));
end;
$$;

-- Eliminazione reale dell'account, non solo revoca: profiles.id -> auth.users(id)
-- on delete cascade si occupa già della riga profiles, qui basta cancellare
-- da auth.users. Niente SUPABASE_SERVICE_ROLE_KEY in apps/web (mai usata
-- lì, solo ingestion — AGENTS.md): la funzione gira coi privilegi del suo
-- owner (postgres), sufficienti a scrivere anche nello schema auth.
create or replace function admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prev profiles%rowtype;
begin
  if not is_admin() then
    raise exception 'Solo admin può eliminare un utente';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Non puoi eliminare il tuo stesso account da qui';
  end if;

  select * into prev from profiles where id = target_user_id;

  insert into admin_edits (admin_user_id, table_name, row_id, action, before, after)
  values (auth.uid(), 'profiles', target_user_id, 'delete', to_jsonb(prev), null);

  delete from auth.users where id = target_user_id;
end;
$$;
