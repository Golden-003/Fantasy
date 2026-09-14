#!/usr/bin/env python3
"""Sonde 10 : page joueur SSR — stats de saison disponibles ?"""
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

# page joueur Gyökeres (id 804508 vu dans l'effectif Arsenal)
st, d, sz = get_next_data("https://www.sofascore.com/player/viktor-gyokeres/804508")
print(f"[Gyökeres] HTTP {st} — {sz:,} octets")
if d:
    pp = d.get("props", {}).get("pageProps", {})
    print(f"pageProps keys: {list(pp.keys())[:20]}")
    player = pp.get("player") or {}
    print(f"player keys: {list(player.keys())[:25]}")
    print(f"  name={player.get('name')} marketValue={player.get('proposedMarketValue')} team={player.get('team',{}).get('name')}")
    # statistiques de saison ?
    def find_keys(node, wanted, path="", depth=0, out=None):
        if out is None: out = []
        if depth > 6: return out
        if isinstance(node, dict):
            for k, v in node.items():
                if k in wanted and isinstance(v, (dict, list)) and v:
                    out.append((path + "." + k, v))
                out += find_keys(v, wanted, path + "." + k, depth + 1)
        elif isinstance(node, list) and node:
            out += find_keys(node[0], wanted, f"{path}[]", depth + 1)
        return out
    for p, v in find_keys(pp, {"statistics", "seasons", "playerStatistics", "topStat", "statisticsSeasons", "nextEvent", "recentEvents", "lastEvents", "seasonStatistics"})[:20]:
        if isinstance(v, dict):
            print(f"  📦 {p}: dict keys={list(v.keys())[:10]}")
            print(f"      {json.dumps(v, ensure_ascii=False)[:500]}")
        else:
            print(f"  📦 {p}: list[{len(v)}]")
            if v:
                print(f"      [0]: {json.dumps(v[0], ensure_ascii=False)[:500]}")
