#!/usr/bin/env python3
"""Sonde 2 : extrait seasonId courant + standings de la page PL, puis sonde une page équipe et un match."""
from curl_cffi import requests as creq
import json, re, sys

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})

def get_next_data(url):
    r = S.get(url, timeout=30, headers={"Accept": "text/html"})
    m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', r.text, re.S)
    if not m:
        return r.status_code, None, len(r.text)
    try:
        return r.status_code, json.loads(m.group(1)), len(r.text)
    except Exception as e:
        return r.status_code, {"_parse_error": str(e)}, len(r.text)

# 1) Page tournoi : seasonId + standings
st, data, size = get_next_data("https://www.sofascore.com/tournament/football/england/premier-league/17")
pp = data.get("props", {}).get("pageProps", {}) if data else {}
season = pp.get("info", {}).get("season", {})
print(f"[PL page] HTTP {st}, season actuelle = {season.get('name')} id={season.get('id')}")
seasons = pp.get("seasons") or []
print(f"  seasons list: {len(seasons)} → 3 premières : {[(s.get('year'), s.get('id')) for s in seasons[:3]]}")
stand = pp.get("standings")
if stand:
    rows = stand if isinstance(stand, list) else stand.get("rows") or stand.get("total") or []
    print(f"  standings: type={type(stand).__name__}, rows={len(rows) if rows else 0}")
    if rows and isinstance(rows, list):
        r0 = rows[0]
        team = r0.get("team", {})
        print(f"  🔥 1er = {team.get('name')} — keys row: {list(r0.keys())[:12]}")

# 2) Page équipe Arsenal (id 42 sur Sofascore)
st2, d2, s2 = get_next_data("https://www.sofascore.com/team/football/arsenal/42")
print(f"\n[arsenal/42] HTTP {st2}, {s2:,} octets")
if d2:
    pp2 = d2.get("props", {}).get("pageProps", {})
    print(f"  pageProps keys: {list(pp2.keys())[:15]}")
    team = pp2.get("team") or {}
    print(f"  team: name={team.get('name')} id={team.get('id')} players? {type(team.get('players')).__name__ if team.get('players') else 'non'}")
    # cherche des listes de joueurs n'importe où
    def find_players(node, path="", depth=0):
        if depth > 7: return []
        out = []
        if isinstance(node, dict):
            for k, v in node.items():
                if k in ("players", "playerList", "roster") and isinstance(v, list) and len(v) > 3:
                    out.append((path + "." + k, v))
                else:
                    out += find_players(v, path + "." + k, depth + 1)
        elif isinstance(node, list):
            for i, v in enumerate(node[:20]):
                out += find_players(v, f"{path}[{i}]", depth + 1)
        return out
    found = find_players(d2)
    for p, lst in found:
        print(f"  🔥 liste joueurs trouvée : {p} → {len(lst)} entrées")
        p0 = lst[0]
        print(f"     1er joueur keys: {list(p0.keys()) if isinstance(p0, dict) else p0}")
        if isinstance(p0, dict):
            print(f"     1er joueur: {json.dumps(p0, ensure_ascii=False)[:300]}")

# 3) Cherche l'ID d'un vrai match récent via la page accueil football (events du jour)
st3, d3, s3 = get_next_data("https://www.sofascore.com/football")
if d3:
    ids = re.findall(r'"(event|match)"[^}]*?"id":(\d{8,})', json.dumps(d3)[:2_000_000])
    print(f"\n[football accueil] HTTP {st3} — event ids candidats: {ids[:5]}")
    # cherche directement des objets event
    txt = json.dumps(d3)
    m = re.search(r'\{"tournament":\{"name":"Premier League".*?"id":(\d{8,})', txt)
    if m:
        print(f"  🔥 event PL candidat id={m.group(1)}")
