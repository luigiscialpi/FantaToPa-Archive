-- Simmetrica a approve_registration (schema_iniziale.sql): stessa forma
-- (unica transazione, security definer, solo admin), ma porta status a
-- 'rejected' su profiles invece di 'approved'+team_id — profiles.status
-- resta la vera barriera d'accesso (sezione 9), letta dal layout protetto
-- per mostrare il messaggio "richiesta non approvata".
create or replace function reject_registration(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req registration_requests%rowtype;
begin
  if not is_admin() then
    raise exception 'Solo admin può rifiutare';
  end if;

  select * into req from registration_requests where id = request_id and status = 'pending';
  if not found then
    raise exception 'Richiesta non trovata o già gestita';
  end if;

  update profiles
    set status = 'rejected'
    where id = req.auth_user_id;

  update registration_requests
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now()
    where id = request_id;
end;
$$;
