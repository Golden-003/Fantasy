#!/usr/bin/env python3
"""Sonde 9 : pages PL par saison + slugs seasons depuis page tournoi → fixtures SSR ?"""
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

# récupère les slugs de saisons depuis la page tournoi
st, d, sz = get_next_data("https://www.sofascore.com/tournament/football/england/premier-league/17")
pp = d["props"]["pageProps"]
seasons = pp.get("seasons") or []
print(f"Seasons (5 premières): {[(s.get('year'), s.get('id')) for s in seasons[:5]]}")

# essaie des URL patterns par saison
CANDIDATES = []
for s in seasons[:2]:
    y = s.get("year")
    CANDIDATES += [
        f"https://www.sofascore.com/football/england/premier-league/{y}",
        f"https://www.sofascore.com/football/england/premier-league/{y}/results",
        f"https://www.sofascore.com/football/england/premier-league/{y}/fixtures",
    ]
CANDIDATES += [
    "https://www.sofascore.com/football/england/premier-league",
    "https://www.sofascore.com/football/england/premier-league/2026/results",
]

for u in CANDIDATES:
    st, d, sz = get_next_data(u)
    info = f"HTTP {st}, {sz:,} o"
    if d:
        pp2 = d.get("props", {}).get("pageProps", {})
        keys = list(pp2.keys())
        info += f" pageProps: {keys[:12]}"
        txt = json.dumps(pp2)
        n_pl = txt.count("Premier League")
        n_ev = txt.count('"startTimestamp"')
        info += f" | PL mentions={n_pl}, startTimestamp={n_ev}"
    print(f"\n[{u}] {info}")
