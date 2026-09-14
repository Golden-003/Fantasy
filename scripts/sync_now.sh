#!/bin/bash
# SYNC SOFASCORE ONE-SHOT — pipeline complet données réelles → Neon
# Usage: bash /home/z/my-project/scripts/sync_now.sh
set -e
cd /home/z/my-project
PY=/home/z/.venv/bin/python3
export DATABASE_URL="postgresql://neondb_owner:npg_0GW3MCBczivE@ep-winter-voice-audjvir9-pooler.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require"
export DATABASE_URL_UNPOOLED="postgresql://neondb_owner:npg_0GW3MCBczivE@ep-winter-voice-audjvir9.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "════════ 1/6 CLASSEMENT FRAIS ════════"
$PY scripts/sofa_refresh_standings.py 2>&1 | tail -3

echo "════════ 2/6 SITEMAP + PAGES MATCH (fenêtre récente) ════════"
$PY scripts/sofa_scrape_resume.py 2>&1 | tail -4

echo "════════ 3/6 FUSION fenêtre git (events hors sitemap) ════════"
git show HEAD:scripts/sofa_ckpt_events.json > /tmp/events_old.json 2>/dev/null || true
if [ -s /tmp/events_old.json ]; then
  $PY scripts/sofa_merge_windows.py 2>&1 | tail -2
else
  echo "  pas de version git antérieure — skip"
fi

echo "════════ 4/6 MATCHS CIBLÉS + PATCH MANUELS ════════"
$PY scripts/sofa_fill_missing.py 2>&1 | grep -E "^\s+[+↻✗]" || true
$PY scripts/sofa_patch_manual.py 2>&1 | tail -2

echo "════════ 5/6 INJECTION ════════"
bun scripts/sofa_inject.ts 2>&1 | grep -E "✅|currentRound|🏁"
bun scripts/sofa_dedup.ts 2>&1 | tail -1

echo "════════ 6/6 COMMIT checkpoints (pour les futures fusions) ════════"
git add scripts/sofa_ckpt_events.json scripts/sofa_data.json scripts/sofa_ckpt_standings.json
git commit -m "sync: checkpoints events/standings $(date -u +%FT%TZ)" --no-verify 2>&1 | tail -1 || true
git push origin main 2>&1 | tail -1 || true

echo "════════ ✅ SYNC TERMINÉ ════════"
