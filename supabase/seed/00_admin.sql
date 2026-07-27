-- supabase/seed/00_admin.sql
--
-- Da eseguire UNA VOLTA, a mano, dopo che ti sei registrato tu stesso dalla
-- UI normale (sezione 9 del piano: la registrazione crea comunque una riga
-- profiles in stato 'pending', anche per il primo utente).
--
-- Non è nella migrazione perché il tuo id utente non esiste finché non ti
-- registri — è un seed manuale one-off, non uno script ripetibile.
--
-- 1. Registrati normalmente dal sito (o da Supabase Studio > Authentication).
-- 2. Trova il tuo id in Studio > Authentication > Users, oppure:
--    select id, email from auth.users;
-- 3. Sostituisci <IL-TUO-UUID-QUI> sotto ed esegui questo file da Studio > SQL Editor.

update profiles
set role = 'admin', status = 'approved'
where id = '<IL-TUO-UUID-QUI>';

-- Verifica:
select id, role, status, first_name, last_name from profiles where role = 'admin';
