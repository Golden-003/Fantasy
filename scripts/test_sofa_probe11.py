#!/usr/bin/env python3
"""Sonde 11 : détail incidents (buteurs/assists) + lastYearSummary joueur."""
from curl_cffi import requests as creq
import json, re

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})

def get_next_data(url):
    r = S.get(url, timeout=40)
    m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', r.text, re.S)
    return json.loads(m.group(1)) if m else None

# 1) incidents d'un match terminé
d = get_next_data("https://www.sofascore.com/football/match/hull-city-swansea-city/zbWb")
pp = d["props"]["pageProps"]
inc = pp.get("incidents") or []
print(f"[hull-swansea] {len(inc)} incidents:")
for i in inc[:12]:
    t = i.get("incidentType")
    p = i.get("player", {}).get("name")
    pa = i.get("playerAssist", {}).get("name") or i.get("assist1", {}).get("name")
    home = i.get("isHome")
    tm = i.get("time")
    print(f"   {t:12s} {tm}' {p}" + (f" (assist: {pa})" if pa else "") + (f" [{ 'H' if home else 'A'}]"))

# 2) eventMeta / standings properties
em = pp.get("eventMeta") or {}
print(f"\neventMeta keys: {list(em.keys())[:15]}")

# 3) lastYearSummary d'un joueur
d2 = get_next_data("https://www.sofascore.com/player/viktor-gyokeres/804508")
pp2 = d2["props"]["pageProps"]
lys = pp2.get("lastYearSummary") or {}
print(f"\n[lastYearSummary Gyökeres]")
print(json.dumps(lys, ensure_ascii=False)[:800])

tr = pp2.get("transfers") or []
print(f"\ntransfers: {len(tr)}")
if tr:
    print(json.dumps(tr[0], ensure_ascii=False)[:300])
