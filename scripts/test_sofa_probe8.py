#!/usr/bin/env python3
"""Sonde 8 : contenu SSR d'une page match Sofascore — le Graal (score, stats, compos, notes)."""
from curl_cffi import requests as creq
import json, re, sys

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})

def get_next_data(url):
    r = S.get(url, timeout=40)
    m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', r.text, re.S)
    if not m:
        return r.status_code, None, len(r.text)
    try:
        return r.status_code, json.loads(m.group(1)), len(r.text)
    except Exception:
        return r.status_code, None, len(r.text)

MATCHES = [
    ("everton-watford", "https://www.sofascore.com/football/match/everton-watford/zY"),
    ("hull-city-swansea-city", "https://www.sofascore.com/football/match/hull-city-swansea-city/zbWb"),
    ("nottingham-forest-aston-villa", "https://www.sofascore.com/football/match/nottingham-forest-aston-villa/ACgcsHVxc"),
]

for name, url in MATCHES:
    st, d, size = get_next_data(url)
    print(f"\n{'='*66}\n[{name}] HTTP {st} — {size:,} octets")
    if not d:
        print("  pas de __NEXT_DATA__"); continue
    pp = d.get("props", {}).get("pageProps", {})
    print(f"  pageProps keys: {list(pp.keys())[:18]}")
    ev = pp.get("event") or {}
    if ev:
        print(f"  🔥 EVENT: keys={list(ev.keys())[:20]}")
        ht, at = ev.get("homeTeam", {}), ev.get("awayTeam", {})
        print(f"     {ht.get('name','?')} ({ht.get('id')}) vs {at.get('name','?')} ({at.get('id')})")
        print(f"     status={ev.get('status',{}).get('description')} tournament={ev.get('tournament',{}).get('uniqueTournament',{}).get('name')} round={ev.get('roundInfo',{}).get('round')}")
        print(f"     startTimestamp={ev.get('startTimestamp')}")
        hs = ev.get("homeScore", {}); as_ = ev.get("awayScore", {})
        print(f"     score: {hs.get('current')}-{as_.get('current')}")
    # cherche lineups, statistics, incidents n'importe où
    def find_keys(node, wanted, path="", depth=0, out=None):
        if out is None: out = []
        if depth > 6: return out
        if isinstance(node, dict):
            for k, v in node.items():
                if k in wanted and isinstance(v, (dict, list)) and v:
                    out.append((path + "." + k, type(v).__name__, len(v) if hasattr(v, '__len__') else 0))
                out += find_keys(v, wanted, path + "." + k, depth + 1)
        elif isinstance(node, list) and node:
            out += find_keys(node[0], wanted, f"{path}[]", depth + 1)
        return out
    hits = find_keys(pp, {"lineups", "statistics", "incidents", "playerEvents", "scoreEvents", "lineupPlayers", "substitutes", "confirmed", "averageRating", "votes", "bestPlayer", "statisticsPeriods", "teamEvents"})
    for p, t, n in hits[:25]:
        print(f"   📦 {p}: {t}[{n}]")
