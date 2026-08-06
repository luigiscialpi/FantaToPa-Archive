#!/bin/zsh
# Dump completo (schema + dati) dello schema "public" del progetto Supabase
# linkato. Richiede libpq (pg_dump): `brew install libpq` se non presente.
# Uso: scripts/backup-supabase-db.sh <cartella-destinazione>
# La password del database viene chiesta in modo interattivo, mai passata
# come argomento o salvata su disco.
set -e

if [ -z "$1" ]; then
  echo "Uso: $0 <cartella-destinazione>" >&2
  echo "Esempio: $0 ~/fantatopa-backup-\$(date +%Y-%m-%d)" >&2
  exit 1
fi

DEST="$1"
CONN="postgresql://postgres.evsnaxdvaafwtjxcynpw@aws-0-eu-north-1.pooler.supabase.com:5432/postgres"

export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump non trovato. Installa libpq: brew install libpq" >&2
  exit 1
fi

mkdir -p "$DEST/schema" "$DEST/data"

read -s "PGPASSWORD?Password del database Postgres Supabase: "
export PGPASSWORD
echo
echo "==> Dump schema (solo struttura, schema public)..."
pg_dump "$CONN" --schema=public --schema-only --no-owner --no-privileges -f "$DEST/schema/schema.sql"
echo "==> Dump dati (tutte le righe, schema public)..."
pg_dump "$CONN" --schema=public --data-only --no-owner --no-privileges -f "$DEST/data/data.sql"
unset PGPASSWORD
echo "==> Fatto. File in $DEST/schema e $DEST/data"
