#!/usr/bin/env python3
"""Scrape tous les matchs variants (slugs longs) + fusion finale complète."""
import json
import re
import time
from datetime import datetime, timezone

from curl_cffi import requests as creq

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})

def get_next_data(url, retries=2):
    for a in range(retries):
        try:
            r = S.get(url, timeout=35, headers={"Accept": "text/html"})
            if r.status_code == 200:
                m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', r.text, re.S)
                if m:
                    return json.loads(m.group(1))
                return None
            time.sleep(1.2)
        except Exception:
            time.sleep(1.5)
    return None

standings = json.load(open("/home/z/my-project/scripts/sofa_ckpt_standings.json"))
TARGET_SEASON = standings["season"]["id"]
events = json.load(open("/home/z/my-project/scripts/sofa_ckpt_events.json"))
known = {e["customId"] for e in events}

# tous les redirects du lot principal + variants + sweep initiaux
cand = {}
for f in ["sofa_ckpt_sweep_all.json", "sofa_ckpt_variants.json", "sofa_ckpt_sweep.json"]:
    try:
        cand.update(json.load(open(f"/home/z/my-project/scripts/{f}")))
    except Exception:
        pass

new = [(nid, v) for nid, v in cand.items() if v["customId"] not in known]
print(f"Candidats à scraper: {len(new)}")

added = 0
for i, (nid, v) in enumerate(new, 1):
    d = get_next_data(f"https://www.sofascore.com/football/match/{v['slugPair']}/{v['customId']}")
    if not d:
        continue
    try:
        pp = d["props"]["pageProps"]
        ev = pp.get("event") or {}
        ut = (ev.get("tournament") or {}).get("uniqueTournament") or {}
        seas = ev.get("season") or {}
        if ut.get("id") != 17 or seas.get("id") != TARGET_SEASON:
            continue
        incs = []
        for inc in (pp.get("incidents") or []):
            pa = inc.get("playerAssist") or inc.get("assist1") or {}
            incs.append({
                "type": inc.get("incidentType"), "time": inc.get("time"), "isHome": inc.get("isHome"),
                "player": (inc.get("player") or {}).get("name"), "playerId": (inc.get("player") or {}).get("id"),
                "assist": pa.get("name"), "assistId": pa.get("id"),
            })
        em = pp.get("eventMeta") or {}
        events.append({
            "customId": v["customId"], "slugPair": v["slugPair"],
            "round": (ev.get("roundInfo") or {}).get("round"),
            "startTimestamp": ev.get("startTimestamp"),
            "status": (ev.get("status") or {}).get("description"),
            "winnerCode": ev.get("winnerCode"),
            "homeTeam": (ev.get("homeTeam") or {}).get("slug"), "homeTeamId": (ev.get("homeTeam") or {}).get("id"),
            "awayTeam": (ev.get("awayTeam") or {}).get("slug"), "awayTeamId": (ev.get("awayTeam") or {}).get("id"),
            "homeScore": (ev.get("homeScore") or {}).get("current"),
            "awayScore": (ev.get("awayScore") or {}).get("current"),
            "venue": ((ev.get("venue") or {}).get("stadium") or {}).get("name"),
            "homeStandingsPos": em.get("homeTeamStandingsPosition"),
            "awayStandingsPos": em.get("awayTeamStandingsPosition"),
            "incidents": incs,
        })
        added += 1
        e = events[-1]
        print(f"  [{i}] J{e['round']:>2} {e['slugPair']:50s} {e['homeScore']}-{e['awayScore']} {e['status']}")
    except Exception as ex:
        pass

json.dump(events, open("/home/z/my-project/scripts/sofa_ckpt_events.json", "w"))
from collections import Counter
ended = [e for e in events if e["status"] == "Ended"]
ns = [e for e in events if e["status"] == "Not started"]
print(f"\nAJOUTÉS: {added} → TOTAL {len(events)}")
print(f"joués: {len(ended)} {dict(sorted(Counter(e['round'] for e in ended).items()))}")
print(f"à venir: {len(ns)} {dict(sorted(Counter(e['round'] for e in ns).items()))}")

# validation croisée avec le classement : somme des matchs joués
squads = json.load(open("/home/z/my-project/scripts/sofa_ckpt_squads.json"))
final = {
    "scrapedAt": datetime.now(timezone.utc).isoformat(),
    "season": standings["season"],
    "teams": standings["teams"],
    "squads": squads,
    "events": events,
}
with open("/home/z/my-project/scripts/sofa_data.json", "w") as f:
    json.dump(final, f, ensure_ascii=False)
print("🔥 sofa_data.json:", len(json.dumps(final)), "car")
