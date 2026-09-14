#!/usr/bin/env python3
"""REPRISE scraping — phases 3+4 depuis checkpoints (standings + squads déjà OK)."""
import gzip
import json
import re
import sys
import time
from datetime import datetime, timezone

from curl_cffi import requests as creq

CKPT = "/home/z/my-project/scripts/sofa_ckpt"
S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})
stats = {"fetches": 0, "errors": 0}

def fetch_gz(url, retries=2):
    for a in range(retries):
        try:
            stats["fetches"] += 1
            r = S.get(url, timeout=45)
            if r.status_code == 200:
                return gzip.decompress(r.content).decode("utf-8", "ignore")
            time.sleep(1)
        except Exception:
            stats["errors"] += 1
            time.sleep(1.5)
    return None

def get_next_data(url, retries=2):
    for a in range(retries):
        try:
            stats["fetches"] += 1
            r = S.get(url, timeout=35, headers={"Accept": "text/html"})
            if r.status_code == 200:
                m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', r.text, re.S)
                if m:
                    return json.loads(m.group(1))
                return None
            time.sleep(1.2)
        except Exception:
            stats["errors"] += 1
            time.sleep(1.5)
    return None

def save(name, data):
    with open(f"{CKPT}_{name}.json", "w") as f:
        json.dump(data, f, ensure_ascii=False)

# ── charge checkpoints ──────────────────────────────────────
standings = json.load(open(f"{CKPT}_standings.json"))
squads = json.load(open(f"{CKPT}_squads.json"))
season = standings["season"]
TARGET_SEASON = season["id"]
teams = standings["teams"]
slugs = {t["slug"] for t in teams if t["slug"]}
print(f"Reprise: saison {season['name']} ({TARGET_SEASON}), {len(teams)} équipes, {sum(len(s['players']) for s in squads.values())} joueurs")

# ── PHASE 3 : sitemap → candidats ───────────────────────────
print("\nPHASE 3 — sitemap events (45 chunks)")
idx_txt = fetch_gz("https://www.sofascore.com/sitemaps/en_sitemap_events_football.xml.gz")
chunks = re.findall(r"<loc>(.*?)</loc>", idx_txt) if idx_txt else []
print(f"{len(chunks)} sous-sitemaps")

pairs = set()
for a in slugs:
    for b in slugs:
        if a != b:
            pairs.add(f"{a}-{b}" if a < b else f"{b}-{a}")

candidates = []
for i, chunk_url in enumerate(chunks, 1):
    txt = fetch_gz(chunk_url)
    if not txt:
        print(f"  chunk {i}: ECHEC")
        continue
    locs = re.findall(r"<loc>(.*?)</loc>", txt)
    n0 = len(candidates)
    for u in locs:
        m = re.match(r"^https://www\.sofascore\.com/football/match/([a-z0-9-]+)/([A-Za-z]+)$", u)
        if m and m.group(1) in pairs:
            candidates.append({"slugPair": m.group(1), "customId": m.group(2), "url": u})
    print(f"  chunk {i}/{len(chunks)}: +{len(candidates)-n0} candidats (total {len(candidates)})")

save("candidates", candidates)
print(f"TOTAL candidats PL: {len(candidates)}")

# ── PHASE 4 : pages match → events 26/27 ────────────────────
print(f"\nPHASE 4 — pages match ({len(candidates)})")
events = []
for c in candidates:
    d = get_next_data(c["url"])
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
        for i in (pp.get("incidents") or []):
            pa = i.get("playerAssist") or i.get("assist1") or {}
            incs.append({
                "type": i.get("incidentType"), "time": i.get("time"), "isHome": i.get("isHome"),
                "player": (i.get("player") or {}).get("name"), "playerId": (i.get("player") or {}).get("id"),
                "assist": pa.get("name"), "assistId": pa.get("id"),
            })
        em = pp.get("eventMeta") or {}
        events.append({
            "customId": c["customId"], "slugPair": c["slugPair"],
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
        print(f"  J{events[-1]['round']:>2} {c['slugPair']:46s} {events[-1]['homeScore']}-{events[-1]['awayScore']} {events[-1]['status']}")
    except Exception as e:
        print(f"  err {c['customId']}: {e}")

save("events", events)
ended = sum(1 for e in events if e["status"] == "Ended")
ns = sum(1 for e in events if e["status"] == "Not started")
print(f"\nTOTAL: {len(events)} matchs PL 26/27 — {ended} joués, {ns} à venir")
print(f"fetches: {stats['fetches']}, erreurs: {stats['errors']}")

# ── FUSION FINALE ───────────────────────────────────────────
final = {
    "scrapedAt": __import__("datetime").datetime.now(timezone.utc).isoformat(),
    "season": season,
    "teams": teams,
    "squads": squads,
    "events": events,
}
with open("/home/z/my-project/scripts/sofa_data.json", "w") as f:
    json.dump(final, f, ensure_ascii=False)
print("🔥 sofa_data.json écrit")
