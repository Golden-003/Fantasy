#!/usr/bin/env python3
"""Refresh du classement PL (Phase 1 seule) — met à jour sofa_ckpt_standings.json
sans toucher aux checkpoints squads/players. À lancer AVANT sofa_scrape_resume.py."""
import json
import re

from curl_cffi import requests as creq

CKPT = "/home/z/my-project/scripts/sofa_ckpt_standings.json"
S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})


def get_next_data(url, retries=3):
    for a in range(retries):
        try:
            r = S.get(url, timeout=40, headers={"Accept": "text/html"})
            if r.status_code == 200:
                m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', r.text, re.S)
                if m:
                    return json.loads(m.group(1))
                return None
            import time
            time.sleep(1.5 * (a + 1))
        except Exception:
            import time
            time.sleep(2)
    return None


d = get_next_data("https://www.sofascore.com/tournament/football/england/premier-league/17")
if not d:
    print("FATAL: page tournoi inaccessible")
    raise SystemExit(1)

pp = d["props"]["pageProps"]
season = pp["info"]["season"]
stand = (pp.get("standings") or [{}])[0]
rows = stand.get("rows") or []
teams = []
for r in rows:
    t = r.get("team") or {}
    teams.append({
        "sofascoreId": t.get("id"),
        "slug": t.get("slug"),
        "name": t.get("name"),
        "shortName": t.get("shortName"),
        "nameCode": t.get("nameCode"),
        "position": r.get("position"),
        "matches": r.get("matches"),
        "wins": r.get("wins"),
        "draws": r.get("draws"),
        "losses": r.get("losses"),
        "scoresFor": r.get("scoresFor"),
        "scoresAgainst": r.get("scoresAgainst"),
        "points": r.get("points"),
    })

if len(teams) != 20:
    print(f"ERREUR: {len(teams)} équipes au lieu de 20 — checkpoint NON modifié")
    raise SystemExit(1)

old = json.load(open(CKPT))
json.dump({"season": old.get("season") or season, "teams": teams}, open(CKPT, "w"), ensure_ascii=False)
print(f"✅ Classement rafraîchi (saison {season['name']}) — {len(teams)} équipes")
for t in teams[:6]:
    print(f"  {t['position']:>2}. {t['name']:<20s} {t['matches']}J {t['points']}pts ({t['scoresFor']}-{t['scoresAgainst']})")
