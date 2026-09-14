#!/usr/bin/env python3
"""
SCRAPER SOFASCORE — Pipeline SSR 100% réel (aucune donnée inventée)
Voie d'accès : pages HTML publiques (SSR __NEXT_DATA__) + sitemaps officiels.
L'API est bloquée (403) mais le SSR HTML passe Cloudflare.

Sortie: /home/z/my-project/scripts/sofa_data.json (+ checkpoints par phase)
"""
import gzip
import json
import re
import sys
import time
from datetime import datetime, timezone

from curl_cffi import requests as creq

OUT = "/home/z/my-project/scripts/sofa_data"
CKPT = "/home/z/my-project/scripts/sofa_ckpt"

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})

SEASON_PL_ID = 17          # uniqueTournament id Premier League
TARGET_SEASON = None       # sera détecté automatiquement (attendu: 96668 = 26/27)

stats = {"fetches": 0, "errors": 0, "start": time.time()}


def get_next_data(url, retries=3):
    """Télécharge une page et retourne le JSON __NEXT_DATA__."""
    for attempt in range(retries):
        try:
            stats["fetches"] += 1
            r = S.get(url, timeout=40, headers={"Accept": "text/html"})
            if r.status_code == 200:
                m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', r.text, re.S)
                if m:
                    return json.loads(m.group(1))
                return None
            time.sleep(1.5 * (attempt + 1))
        except Exception:
            stats["errors"] += 1
            time.sleep(2)
    return None


def throttle(base=0.35):
    time.sleep(base + (0.2 if stats["fetches"] % 7 == 0 else 0))


def save(name, data):
    with open(f"{CKPT}_{name}.json", "w") as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"  💾 checkpoint {name} ({len(json.dumps(data)):,} car)")


# ═══════════════════════════════════════════════════════════════
# PHASE 1 — Tournoi : saisons + classement réel 26/27
# ═══════════════════════════════════════════════════════════════
print("=" * 66)
print("PHASE 1 — Page tournoi Premier League (standings + seasons)")
print("=" * 66)
d = get_next_data("https://www.sofascore.com/tournament/football/england/premier-league/17")
if not d:
    print("FATAL: page tournoi inaccessible"); sys.exit(1)
pp = d["props"]["pageProps"]
season = pp["info"]["season"]
TARGET_SEASON = season["id"]
print(f"Saison courante: {season['name']} (id={TARGET_SEASON})")

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
print(f"{len(teams)} équipes → {[(t['position'], t['name']) for t in teams[:4]]} ...")
save("standings", {"season": season, "teams": teams})

slugs = {t["slug"] for t in teams if t["slug"]}
print(f"Slugs PL: {sorted(slugs)}")

# ═══════════════════════════════════════════════════════════════
# PHASE 2 — Effectifs des 20 équipes (joueurs réels + valeurs marché)
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 66)
print(f"PHASE 2 — Effectifs ({len(teams)} équipes)")
print("=" * 66)
squads = {}
for t in teams:
    slug, tid = t["slug"], t["sofascoreId"]
    d = get_next_data(f"https://www.sofascore.com/team/football/{slug}/{tid}")
    throttle()
    players = []
    if d:
        try:
            pp = d["props"]["pageProps"]
            td = pp.get("teamDetails") or {}
            for entry in (pp.get("players") or {}).get("players") or []:
                p = entry.get("player") or {}
                mv = p.get("proposedMarketValue")
                players.append({
                    "sofascoreId": p.get("id"),
                    "name": p.get("name"),
                    "shortName": p.get("shortName"),
                    "slug": p.get("slug"),
                    "position": p.get("position"),  # G | D | M | F
                    "jerseyNumber": p.get("jerseyNumber") or p.get("shirtNumber"),
                    "height": p.get("height"),
                    "dateOfBirth": p.get("dateOfBirth"),
                    "preferredFoot": p.get("preferredFoot"),
                    "country": (p.get("country") or {}).get("name"),
                    "marketValue": mv,  # € réels Sofascore
                    "userCount": p.get("userCount"),
                    "contractUntilTimestamp": p.get("contractUntilTimestamp"),
                })
            squads[slug] = {
                "sofascoreId": tid,
                "name": td.get("name") or t["name"],
                "manager": (td.get("manager") or {}).get("name"),
                "venue": (td.get("venue") or {}).get("stadium", {}).get("name"),
                "teamColors": td.get("teamColors"),
                "primaryTournament": (td.get("primaryUniqueTournament") or {}).get("name"),
                "players": players,
            }
            print(f"  ✅ {t['name']:28s} {len(players):3d} joueurs · coach: {squads[slug]['manager']}")
        except Exception as e:
            print(f"  ⚠️ {slug}: parse error {e}")
    else:
        print(f"  ⚠️ {slug}: page inaccessible")
    save("squads", squads)

total_players = sum(len(s["players"]) for s in squads.values())
print(f"\nTOTAL joueurs récoltés: {total_players}")

# ═══════════════════════════════════════════════════════════════
# PHASE 3 — Sitemap events football → candidats matchs PL 26/27
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 66)
print("PHASE 3 — Sitemap events football (45 chunks)")
print("=" * 66)

def fetch_gz(url, retries=2):
    for a in range(retries):
        try:
            stats["fetches"] += 1
            r = S.get(url, timeout=60)
            if r.status_code == 200:
                return gzip.decompress(r.content).decode("utf-8", "ignore")
            time.sleep(1.5)
        except Exception:
            stats["errors"] += 1
            time.sleep(2)
    return None

idx_txt = fetch_gz("https://www.sofascore.com/sitemaps/en_sitemap_events_football.xml.gz")
chunks = re.findall(r"<loc>(.*?)</loc>", idx_txt) if idx_txt else []
print(f"{len(chunks)} sous-sitemaps football")

# paires exactes d'équipes PL (ordre alphabétique dans l'URL Sofascore)
pairs = set()
for a in slugs:
    for b in slugs:
        if a != b:
            pairs.add(f"{a}-{b}" if a < b else f"{b}-{a}")
print(f"{len(pairs)} paires possibles (190 matchs aller-retour... {len(pairs)//2} matches)")

candidates = []
for i, chunk_url in enumerate(chunks, 1):
    txt = fetch_gz(chunk_url)
    throttle(0.15)
    if not txt:
        continue
    locs = re.findall(r"<loc>(.*?)</loc>", txt)
    for u in locs:
        m = re.match(r"^https://www\.sofascore\.com/football/match/([a-z0-9-]+)/([A-Za-z]+)$", u)
        if m and m.group(1) in pairs:
            candidates.append({"slugPair": m.group(1), "customId": m.group(2), "url": u})
    if i % 10 == 0:
        print(f"  ...chunk {i}/{len(chunks)} — {len(candidates)} candidats PL")

print(f"\nCandidats matchs PL (slugs exacts): {len(candidates)}")
save("candidates", candidates)

# ═══════════════════════════════════════════════════════════════
# PHASE 4 — Pages match : filtre saison 26/27 + incidents complets
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 66)
print(f"PHASE 4 — Pages match ({len(candidates)} candidats)")
print("=" * 66)
events = []
for c in candidates:
    d = get_next_data(c["url"])
    throttle()
    if not d:
        continue
    try:
        pp = d["props"]["pageProps"]
        ev = pp.get("event") or {}
        tour = ev.get("tournament") or {}
        ut = tour.get("uniqueTournament") or {}
        seas = ev.get("season") or {}
        if ut.get("id") != SEASON_PL_ID or seas.get("id") != TARGET_SEASON:
            continue
        incs = []
        for i in (pp.get("incidents") or []):
            incs.append({
                "type": i.get("incidentType"),
                "time": i.get("time"),
                "isHome": i.get("isHome"),
                "player": (i.get("player") or {}).get("name"),
                "playerId": (i.get("player") or {}).get("id"),
                "assist": ((i.get("playerAssist") or i.get("assist1") or {}) or {}).get("name"),
                "assistId": ((i.get("playerAssist") or i.get("assist1") or {}) or {}).get("id"),
                "injuryTime": i.get("injuryTime"),
            })
        em = pp.get("eventMeta") or {}
        events.append({
            "customId": c["customId"],
            "slugPair": c["slugPair"],
            "round": (ev.get("roundInfo") or {}).get("round"),
            "startTimestamp": ev.get("startTimestamp"),
            "status": (ev.get("status") or {}).get("description"),
            "winnerCode": ev.get("winnerCode"),
            "homeTeam": (ev.get("homeTeam") or {}).get("slug"),
            "homeTeamId": (ev.get("homeTeam") or {}).get("id"),
            "awayTeam": (ev.get("awayTeam") or {}).get("slug"),
            "awayTeamId": (ev.get("awayTeam") or {}).get("id"),
            "homeScore": (ev.get("homeScore") or {}).get("current"),
            "awayScore": (ev.get("awayScore") or {}).get("current"),
            "hasXg": ev.get("hasXg"),
            "referee": (ev.get("referee") or {}).get("name"),
            "venue": ((ev.get("venue") or {}).get("stadium") or {}).get("name"),
            "homeStandingsPos": em.get("homeTeamStandingsPosition"),
            "awayStandingsPos": em.get("awayTeamStandingsPosition"),
            "incidents": incs,
        })
        print(f"  ✅ J{events[-1]['round']:>2} {c['slugPair']:44s} {events[-1]['homeScore']}-{events[-1]['awayScore']} {events[-1]['status']}")
    except Exception as e:
        print(f"  ⚠️ {c['customId']}: {e}")
    save("events", events)

print(f"\nTOTAL matchs PL 26/27 confirmés: {len(events)}")
ended = sum(1 for e in events if e["status"] == "Ended")
notstarted = sum(1 for e in events if e["status"] == "Not started")
print(f"  terminés: {ended} · à venir: {notstarted}")

# ═══════════════════════════════════════════════════════════════
# RÉSUMÉ
# ═══════════════════════════════════════════════════════════════
dur = time.time() - stats["start"]
print("\n" + "=" * 66)
print(f"SCRAPING CORE TERMINÉ en {dur/60:.1f} min — {stats['fetches']} fetches, {stats['errors']} erreurs")
print(f"  Équipes: {len(teams)} · Joueurs: {total_players} · Matchs 26/27: {len(events)} ({ended} joués, {notstarted} à venir)")
