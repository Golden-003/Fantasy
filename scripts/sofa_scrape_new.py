#!/usr/bin/env python3
"""Scrape les pages match des NOUVEAUX matchs trouvés par balayage + fusion finale."""
import json
import re
import time

from curl_cffi import requests as creq
from datetime import datetime, timezone

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
sweep = json.load(open("/home/z/my-project/scripts/sofa_ckpt_sweep.json"))

new = [(int(nid), v) for nid, v in sweep.items() if v["customId"] not in known]
print(f"Nouveaux matchs à scraper: {len(new)}")

for i, (nid, v) in enumerate(new, 1):
    url = f"https://www.sofascore.com/football/match/{v['slugPair']}/{v['customId']}"
    d = get_next_data(url)
    if not d:
        print(f"  [{i}] {v['slugPair']}: ECHEC")
        continue
    try:
        pp = d["props"]["pageProps"]
        ev = pp.get("event") or {}
        ut = (ev.get("tournament") or {}).get("uniqueTournament") or {}
        seas = ev.get("season") or {}
        if ut.get("id") != 17 or seas.get("id") != TARGET_SEASON:
            print(f"  [{i}] {v['slugPair']}: pas PL 26/27 ({ut.get('name')}, {seas.get('name')})")
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
        e = events[-1]
        print(f"  [{i}] J{e['round']:>2} {e['slugPair']:46s} {e['homeScore']}-{e['awayScore']} {e['status']}")
    except Exception as ex:
        print(f"  [{i}] err: {str(ex)[:70]}")

json.dump(events, open("/home/z/my-project/scripts/sofa_ckpt_events.json", "w"))
ended = [e for e in events if e["status"] == "Ended"]
ns = [e for e in events if e["status"] == "Not started"]
from collections import Counter
print(f"\nTOTAL {len(events)} matchs — joués: {len(ended)} {dict(sorted(Counter(e['round'] for e in ended).items()))}")
print(f"à venir: {len(ns)} {dict(sorted(Counter(e['round'] for e in ns).items()))}")

# fusion finale
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
print("🔥 sofa_data.json mis à jour:", len(json.dumps(final)), "car")
