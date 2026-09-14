#!/usr/bin/env python3
"""Scrape ciblé des matchs manquants (hors fenêtre sitemap) via customId connus
+ pages équipe (20 équipes) pour récupérer TOUS les matchs récents.
Fusionne dans sofa_ckpt_events.json puis réécrit sofa_data.json."""
import json
import re
import time
from datetime import datetime, timezone

from curl_cffi import requests as creq

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})
CKPT = "/home/z/my-project/scripts/sofa_ckpt"


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


def extract_event(pp):
    ev = pp.get("event") or {}
    ut = (ev.get("tournament") or {}).get("uniqueTournament") or {}
    seas = ev.get("season") or {}
    if ut.get("id") != 17:
        return None
    incs = []
    for inc in (pp.get("incidents") or []):
        pa = inc.get("playerAssist") or inc.get("assist1") or {}
        incs.append({
            "type": inc.get("incidentType"), "time": inc.get("time"), "isHome": inc.get("isHome"),
            "player": (inc.get("player") or {}).get("name"), "playerId": (inc.get("player") or {}).get("id"),
            "assist": pa.get("name"), "assistId": pa.get("id"),
        })
    em = pp.get("eventMeta") or {}
    return {
        "customId": ev.get("customId"),
        "slugPair": f"{(ev.get('homeTeam') or {}).get('slug')}-{(ev.get('awayTeam') or {}).get('slug')}",
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
    }


standings = json.load(open(f"{CKPT}_standings.json"))
TARGET_SEASON = standings["season"]["id"]
events = json.load(open(f"{CKPT}_events.json"))
by_custom = {e["customId"]: i for i, e in enumerate(events)}
slugs = {t["slug"]: t for t in standings["teams"] if t["slug"]}

# ── 1) Matchs ciblés par customId (matchs manquants connus) ──
TARGETED = [
    ("leeds-united-newcastle-united", "JsO"),   # J4 — dernier match joué
    ("leeds-united-nottingham-forest", "osJ"),  # J1 — dernier trou du calendrier
]
added = 0
for pair, cid in TARGETED:
    d = get_next_data(f"https://www.sofascore.com/football/match/{pair}/{cid}")
    if not d:
        print(f"  ✗ {pair}/{cid} inaccessible")
        continue
    ev = extract_event(d["props"]["pageProps"])
    if not ev or ev["round"] is None:
        print(f"  ✗ {pair}/{cid}: pas un event PL")
        continue
    ev["customId"] = ev["customId"] or cid
    if ev["customId"] in by_custom:
        events[by_custom[ev["customId"]]] = ev
        print(f"  ↻ J{ev['round']} {pair}: {ev['homeScore']}-{ev['awayScore']} {ev['status']} (mis à jour)")
    else:
        events.append(ev)
        by_custom[ev["customId"]] = len(events) - 1
        added += 1
        print(f"  + J{ev['round']} {pair}: {ev['homeScore']}-{ev['awayScore']} {ev['status']} (NOUVEAU)")

# ── 2) Pages équipe : récupérer les matchs récents sortis du sitemap ──
print("\nPages équipe (20) — récupération des matchs récents:")
team_added = 0
for slug, t in sorted(slugs.items()):
    d = get_next_data(f"https://www.sofascore.com/team/football/{slug}/{t['sofascoreId']}")
    if not d:
        print(f"  ✗ {slug} page inaccessible")
        continue
    pp = d["props"]["pageProps"]
    # chercher les events dans toutes les structures probables
    candidates = []
    for key in ("event", "events", "teamEvents", "nextEvents", "previousEvents"):
        v = pp.get(key)
        if isinstance(v, list):
            candidates += v
    # structure large: parcourir pageProps en profondeur limitée
    if not candidates:
        def walk(o, depth=0):
            if depth > 3:
                return
            if isinstance(o, dict):
                if "homeTeam" in o and "awayTeam" in o and "status" in o:
                    candidates.append(o)
                for v in o.values():
                    walk(v, depth + 1)
            elif isinstance(o, list):
                for v in o:
                    walk(v, depth + 1)
        walk(pp)
    n0 = team_added
    for raw in candidates:
        ev = extract_event({"event": raw})
        if not ev or not ev["customId"]:
            continue
        if ev["customId"] in by_custom:
            # rafraîchit le statut/score si déjà connu
            events[by_custom[ev["customId"]]] = {**events[by_custom[ev["customId"]]],
                                                 "status": ev["status"],
                                                 "homeScore": ev["homeScore"] if ev["homeScore"] is not None else events[by_custom[ev["customId"]]]["homeScore"],
                                                 "awayScore": ev["awayScore"] if ev["awayScore"] is not None else events[by_custom[ev["customId"]]]["awayScore"],
                                                 "winnerCode": ev["winnerCode"]}
            continue
        if ev["round"] is None:
            continue
        events.append(ev)
        by_custom[ev["customId"]] = len(events) - 1
        team_added += 1
    print(f"  {slug}: +{team_added - n0}")

json.dump(events, open(f"{CKPT}_events.json", "w"), ensure_ascii=False)

from collections import Counter
ended = [e for e in events if e["status"] == "Ended"]
print(f"\nTOTAL {len(events)} matchs | AJOUTÉS {added + team_added}")
print(f"joués: {len(ended)} {dict(sorted(Counter(e['round'] for e in ended).items()))}")

final = {
    "scrapedAt": datetime.now(timezone.utc).isoformat(),
    "season": standings["season"],
    "teams": standings["teams"],
    "squads": json.load(open(f"{CKPT}_squads.json")),
    "events": events,
}
json.dump(final, open("/home/z/my-project/scripts/sofa_data.json", "w"), ensure_ascii=False)
print("🔥 sofa_data.json réécrit")
