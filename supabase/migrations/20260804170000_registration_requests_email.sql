-- L'admin deve poter contattare/riconoscere chi ha fatto la richiesta anche
-- quando nome/cognome sono ambigui o mancanti: registration_requests non
-- portava l'email (viveva solo in auth.users, non leggibile da PostgREST).
-- Colonna nullable per lo stesso motivo di first_name/last_name: il trigger
-- handle_new_user non deve mai far fallire l'intera transazione di signup.
alter table registration_requests add column email text;

-- Backfill per le righe già esistenti (pending o già revisionate): unica
-- occasione in cui si legge auth.users direttamente, permesso qui perché la
-- migrazione gira con privilegi di superuser, non attraverso PostgREST/RLS.
update registration_requests r
set email = u.email
from auth.users u
where u.id = r.auth_user_id
  and r.email is null;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id, new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name');

  insert into public.registration_requests (auth_user_id, first_name, last_name, requested_team_id, email)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    nullif(new.raw_user_meta_data->>'requested_team_id','')::uuid,
    new.email
  );
  return new;
end;
$$;
