-- Fix admin_list_users: "structure of query does not match function result
-- type" a runtime — auth.users.email è character varying(255), non text.
-- return query in plpgsql non fa il cast implicito automaticamente come
-- farebbe un semplice SELECT, va reso esplicito.
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
    select p.id, u.email::text, p.first_name, p.last_name, p.role, p.status, p.team_id, t.canonical_name, u.created_at
    from profiles p
    join auth.users u on u.id = p.id
    left join teams t on t.id = p.team_id
    order by u.created_at asc;
end;
$$;
