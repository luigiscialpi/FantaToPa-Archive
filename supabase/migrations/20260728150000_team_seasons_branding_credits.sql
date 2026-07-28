-- Crediti residui asta: presenti nella riga "Crediti Residui: N" a fine
-- sezione squadra di Rose_*.xlsx, finora ignorati da adapters/xlsx/roster.ts
-- (il parser si fermava un rigo prima). Dato di stagione per squadra, stesso
-- posto di manager_name/logo_url/jersey_url già in team_seasons.
alter table team_seasons
  add column credits_remaining numeric;

comment on column team_seasons.credits_remaining is
  'Crediti residui asta, da "Crediti Residui: N" in Rose_*.xlsx. Null finché non importato per quella stagione.';

-- Storage per loghi/maglie squadra (piano di sviluppo, sezione 4: Storage è
-- la fonte definitiva per gli asset immagine, non la cartella public/ di
-- Next.js). Bucket pubblico in lettura: sono stemmi/maglie, non dati di lega
-- riservati (quelli restano dietro RLS sulle tabelle, come sempre) — evita
-- la complessità di signed URL con scadenza per un contenuto il cui rischio
-- di esposizione è sostanzialmente nullo. Scrittura solo admin, stesso
-- pattern is_admin() delle altre tabelle.
insert into storage.buckets (id, name, public)
values ('team-branding', 'team-branding', true)
on conflict (id) do nothing;

create policy "team_branding_select_public"
  on storage.objects for select
  using (bucket_id = 'team-branding');

create policy "team_branding_write_admin"
  on storage.objects for all
  using (bucket_id = 'team-branding' and public.is_admin())
  with check (bucket_id = 'team-branding' and public.is_admin());

-- Nome di chi gestisce una squadra, da mostrare ad ALTRI membri approvati
-- nell'header della pagina Rose: profiles_select_own_or_admin (sopra) limita
-- la lettura di profiles alla propria riga, e allargarla esporrebbe anche
-- role/status di tutti a tutti. Stessa eccezione mirata già usata per
-- teams_available_for_registration(): una funzione stretta che espone solo
-- team_id + nome visualizzato, solo per profili approvati (gated da
-- can_read_league_data(), non da un check ripetuto qui).
create or replace function team_managers()
returns table(team_id uuid, display_name text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not can_read_league_data() then
    return;
  end if;

  return query
    select p.team_id, nullif(trim(concat(coalesce(p.first_name, ''), ' ', coalesce(p.last_name, ''))), '')
    from profiles p
    where p.status = 'approved' and p.team_id is not null;
end;
$$;
grant execute on function team_managers() to authenticated;
