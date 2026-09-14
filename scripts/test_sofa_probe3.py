#!/usr/bin/env python3
"""Sonde 3 : profondeur des données SSR — joueurs (valeur ?), standings 20 équipes, pages de matchs."""
from curl_cffi import requests as creq
import json, re, sys

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})

def get_next_data(url):
    r = S.get(url, timeout=30, headers={"Accept": "text/html"})
    m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', r.text, re.S)
    if not m:
        return r.status_code, None
    try:
        return r.status_code, json.loads(m.group(1))
    except Exception:
        return r.status_code, None

# ---- 1) Joueur : TOUTES les clés disponibles ----
st, d = get_next_data("https://www.sofascore.com/team/football/arsenal/42")
pp = d["props"]["pageProps"]
players = pp["players"]["players"]
p0 = players[0]["player"]
print(f"[JOUEUR] {p0['name']} — toutes les clés :")
print(json.dumps({k: (str(v)[:80] if not isinstance(v, (dict, list)) else f"<{type(v).__name__}>") for k, v in p0.items()}, ensure_ascii=False, indent=1))

# ---- 2) teamDetails ----
td = pp.get("teamDetails") or {}
print(f"\n[TEAM DETAILS] keys: {list(td.keys())[:20]}")
for k in ("form", "recentForm", "nextMatch", "previousMatch", "team"):
    if k in td:
        print(f"  {k}: {json.dumps(td[k], ensure_ascii=False)[:400]}")

# ---- 3) Standings complet depuis page tournoi ----
st, d = get_next_data("https://www.sofascore.com/tournament/football/england/premier-league/17")
pp = d["props"]["pageProps"]
stand = pp.get("standings") or []
print(f"\n[STANDINGS] {len(stand)} groupe(s)")
if stand:
    g = stand[0]
    rows = g.get("rows") or []
    print(f"  groupe '{g.get('name')}' : {len(rows)} équipes")
    for r in rows[:4]:
        t = r.get("team") or {}
        pos = r.get("position")
        pts = r.get("points")
        print(f"  🔥 {pos}. {t.get('name')} ({pts} pts) — keys: {list(r.keys())[:14]}")

# ---- 4) Pages de matchs : URL à date ----
for u in ["https://www.sofascore.com/football/2026-09-12",
          "https://www.sofascore.com/football/2026-09-13"]:
    st, d = get_next_data(u)
    print(f"\n[PAGE DATE {u[-10:]}] HTTP {st}")
    if d:
        pp = d.get("props", {}).get("pageProps", {})
        print(f"  pageProps keys: {list(pp.keys())[:15]}")
        txt = json.dumps(pp)
        ids = list(set(re.findall(r'"id":(10\d{8})', txt)))[:8]
        print(f"  event ids (10xxxxxxxx): {ids}")
        evs = re.findall(r'\{"tournament":.{0,40}"name":"Premier League"', txt)
        print(f"  mentions Premier League: {len(evs)}")
