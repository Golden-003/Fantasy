#!/usr/bin/env python3
"""Explore les __NEXT_DATA__ des pages tournoi et équipe pour trouver
où Sofascore expose les events (résultats récents) en SSR."""
import json
import re
import sys

from curl_cffi import requests as creq

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})


def get_next_data(url):
    r = S.get(url, timeout=35, headers={"Accept": "text/html"})
    if r.status_code != 200:
        print(f"  HTTP {r.status_code} pour {url}")
        return None
    m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', r.text, re.S)
    return json.loads(m.group(1)) if m else None


def summarize(o, path="$", depth=0, out=None):
    if out is None:
        out = []
    if depth > 4:
        return out
    if isinstance(o, dict):
        if "homeTeam" in o and "awayTeam" in o:
            out.append(path)
        for k, v in o.items():
            summarize(v, f"{path}.{k}", depth + 1, out)
    elif isinstance(o, list) and o:
        summarize(o[0], f"{path}[]", depth + 1, out)
    return out


standings = json.load(open("/home/z/my-project/scripts/sofa_ckpt_standings.json"))
forest = next(t for t in standings["teams"] if t["slug"] == "nottingham-forest")
leeds = next(t for t in standings["teams"] if t["slug"] == "leeds-united")

for label, url in [
    ("TOURNOI", "https://www.sofascore.com/tournament/football/england/premier-league/17"),
    ("TEAM FOREST", f"https://www.sofascore.com/team/football/nottingham-forest/{forest['sofascoreId']}"),
    ("TEAM LEEDS", f"https://www.sofascore.com/team/football/leeds-united/{leeds['sofascoreId']}"),
]:
    print(f"\n=== {label} ===")
    d = get_next_data(url)
    if not d:
        continue
    pp = d["props"]["pageProps"]
    print("pageProps keys:", list(pp.keys())[:25])
    hits = summarize(pp)
    for h in hits[:20]:
        print("  event@ " + h)
