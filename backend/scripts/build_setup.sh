#!/bin/sh
# Regénère supabase/setup_complete.sql = toutes les migrations (dans l'ordre) + seed.sql.
# Pratique pour un projet Supabase hébergé : un seul copier-coller dans le SQL Editor.
set -eu
cd "$(dirname "$0")/../supabase"
out=setup_complete.sql
{
  echo "-- Fichier généré par scripts/build_setup.sh : migrations + seed. Ne pas modifier à la main."
  for f in migrations/*.sql; do
    echo ""
    echo "-- ============ $f ============"
    cat "$f"
  done
  echo ""
  echo "-- ============ seed.sql ============"
  cat seed.sql
} > "$out"
echo "OK -> supabase/$out"
