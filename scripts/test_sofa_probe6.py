#!/usr/bin/env python3
"""Sonde 6 : sitemap events football → combien de matchs ? filtre Premier League (tournament/17)."""
from curl_cffi import requests as creq
import gzip, re, sys

S = creq.Session(impersonate="chrome124")

r = S.get("https://www.sofascore.com/sitemaps/en_sitemap_events_football.xml.gz", timeout=60)
txt = gzip.decompress(r.content).decode("utf-8", "ignore")
print(f"[events football] {len(txt):,} car")
locs = re.findall(r"<loc>(.*?)</loc>", txt)
print(f"{len(locs):,} URLs de matchs")

# pattern d'URL match Sofascore : https://www.sofascore.com/football/match/<team>-<team>/<slug>/<id>
# les URLs d'events PL contiennent souvent le tournoi ? Non — le slug est team-vs-team. Filtrons par équipes PL connues.
pl_teams = ["arsenal","aston-villa","bournemouth","brentford","brighton","burnley","chelsea","crystal-palace","everton","fulham","leeds","liverpool","manchester-city","manchester-united","newcastle","nottingham-forest","sunderland","tottenham","west-ham","wolverhampton","hull"]
pl_urls = [u for u in locs if any(f"/{t}-" in u or f"-{t}/" in u or u.endswith(f"/{t}") for t in pl_teams)]
print(f"URLs avec équipes PL: {len(pl_urls):,}")
for u in pl_urls[:15]:
    print(f"  {u}")
print("  ...")
for u in pl_urls[-10:]:
    print(f"  {u}")

# extrait les IDs
ids = [re.search(r"/(\d+)$", u).group(1) for u in pl_urls if re.search(r"/(\d+)$", u)]
print(f"\n{len(ids)} IDs extraits — 8 derniers : {ids[-8:]}")
