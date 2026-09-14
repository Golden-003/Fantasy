#!/bin/bash
# SYNC SOFASCORE ONE-SHOT — pipeline complet données réelles → Neon
# Usage: bash /home/z/my-project/scripts/sync_now.sh
set -e
cd /home/z/my-project

export DATABASE_URL="postgresql://neondb_owner:npg_0GW3MCBczivE@ep-winter-voice-audjvir9-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require"
export DATABASE_URL_UNPOOLED="postgresql://neondb_owner:npg_0GW3MCBczivE@ep-winter-voice-audjvir9.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "════════ 1/4 SCRAPING SSR (standings + effectifs + matchs) ════════"
python3 scripts/sofa_scrape_resume.py 2>&1 | tail -6

echo "════════ 2/4 NOUVEAUX MATCHS (balayage IDs) ════════"
python3 scripts/sofa_sweep_all.py 2>&1 | tail -3
python3 scripts/sofa_scrape_variants.py 2>&1 | tail -4

echo "════════ 3/4 INJECTION ════════"
bun scripts/sofa_inject.ts 2>&1 | grep -E "✅|🏁"
bun scripts/sofa_dedup.ts 2>&1 | tail -1

echo "════════ 4/4 NOTES JOUEURS (12 mois, optionnel si récent) ════════"
python3 scripts/sofa_players.py 2>&1 | tail -1
bun scripts/sofa_inject_notes.ts 2>&1 | tail -1

echo "════════ ✅ SYNC TERMINÉ ════════"
