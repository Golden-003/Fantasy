#!/usr/bin/env python3
"""Test : les pages HTML publiques de Sofascore embarquent-elles des données SSR exploitables ?"""
from curl_cffi import requests as creq
import re, json, sys

PAGES = [
    ("classement PL", "https://www.sofascore.com/football/england/premier-league/summer-2025/standings"),
    ("page PL accueil", "https://www.sofascore.com/tournament/football/england/premier-league/17"),
    ("accueil football", "https://www.sofascore.com/football"),
]

for name, url in PAGES:
    try:
        r = creq.get(url, impersonate="chrome124", timeout=30,
                     headers={"Accept": "text/html,application/xhtml+xml", "Accept-Language": "fr-FR,fr;q=0.9"})
        html = r.text
        size = len(html)
        print(f"\n{'='*70}\n[{name}] HTTP {r.status_code} — {size:,} octets")
        # Cherche les payloads de données embarqués (Next.js RSC / __NEXT_DATA__)
        for marker in ["self.__next_f.push", "__NEXT_DATA__", "seasonId", "uniqueTournament", "standsTotal", "teamId"]:
            cnt = html.count(marker)
            print(f"   marker « {marker} » : {cnt} occurrence(s)")
        # cherche des noms d'équipes PL connus dans le HTML
        for team in ["Arsenal", "Liverpool", "Manchester City", "Chelsea", "Newcastle"]:
            if team in html:
                print(f"   ⚽ équipe trouvée dans le HTML : {team}")
        # essaie d'extraire un fragment JSON significatif
        m = re.search(r'"seasonId":(\d+)', html)
        if m:
            print(f"   🔥 seasonId trouvé : {m.group(1)}")
        m = re.search(r'\{"team":\{"name":"([A-Za-z ]+)"', html)
        if m:
            print(f"   🔥 fragment team JSON : {m.group(1)}")
    except Exception as e:
        print(f"\n[{name}] EXC {type(e).__name__}: {str(e)[:120]}")
