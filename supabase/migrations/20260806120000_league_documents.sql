-- Pagina "Doc" (richiesta esplicita 2026-08-06): due documenti di lega
-- (Storia, Costituzione) caricabili da Word (.docx, convertiti in HTML via
-- mammoth) o modificabili direttamente in pagina con un editor minimale.
-- `documents` è lo stato CORRENTE (una riga per kind, quello mostrato in
-- pagina a tutti i membri approvati). `document_versions` è lo storico
-- append-only (solo admin, come admin_edits) usato per "chi ha modificato e
-- quando" e per il pulsante di caricamento — mai la stessa tabella: la
-- pagina pubblica fa una lookup diretta per kind, non un "ultima riga tra
-- N" ordinata per data.
create table documents (
  kind text primary key check (kind in ('storia', 'costituzione')),
  content_html text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  -- Nome dell'autore al momento della modifica (non un join su profiles):
  -- un audit trail deve restare fedele a chi ha fatto cosa quel giorno,
  -- anche se in futuro quella persona cambia nome o lascia la lega.
  updated_by_name text
);
insert into documents (kind) values ('storia'), ('costituzione');

alter table documents enable row level security;
create policy "documents_select_approved" on documents for select using (can_read_league_data());
create policy "documents_write_admin" on documents for all using (is_admin()) with check (is_admin());

create table document_versions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('storia', 'costituzione')),
  content_html text not null,
  source text not null check (source in ('upload', 'edit')),
  -- original_filename/storage_path solo per source='upload': un'edit diretta
  -- non ha un file Word associato.
  original_filename text,
  storage_path text,
  created_by uuid not null references auth.users(id),
  created_by_name text not null,
  created_at timestamptz not null default now()
);

-- Storico grezzo, mai esposto ai membri non-admin (a differenza di
-- `documents`): stesso trattamento di admin_edits.
alter table document_versions enable row level security;
create policy "document_versions_admin_only" on document_versions for all using (is_admin()) with check (is_admin());

-- Bucket privato per il .docx originale (solo per un eventuale download
-- dallo storico admin, mai referenziato dalla pagina pubblica): a differenza
-- di team-branding, qui non c'è motivo di esporre pubblicamente il file.
insert into storage.buckets (id, name, public)
values ('league-documents', 'league-documents', false)
on conflict (id) do nothing;

create policy "league_documents_select_admin"
  on storage.objects for select
  using (bucket_id = 'league-documents' and public.is_admin());

create policy "league_documents_write_admin"
  on storage.objects for all
  using (bucket_id = 'league-documents' and public.is_admin())
  with check (bucket_id = 'league-documents' and public.is_admin());
