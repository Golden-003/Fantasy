#!/usr/bin/env python3
"""Sonde 7 : sous-sitemaps football numérotés → matchs PL (récents + à venir)."""
from curl_cffi import requests as creq
import gzip, re, sys

S = creq.Session(impersonate="chrome124")

def fetch_gz(url):
    r = S.get(url, timeout=60)
    return gzip.decompress(r.content).decode("utf-8", "ignore")

txt = fetch_gz("https://www.sofascore.com/sitemaps/en_sitemap_events_football.xml.gz")
subs = re.findall(r"<loc>(.*?)</loc>", txt)
print(f"{len(subs)} sous-sitemaps football")

PL_HINTS = ["premier-league","arsenal","aston-villa","bournemouth","brentford","brighton","burnley","chelsea","crystal-palace","everton","fulham","leeds","liverpool","manchester-city","manchester-united","newcastle","nottingham-forest","sunderland","tottenham","west-ham","wolverhampton","hull"]

found = {}
# teste le DERNIER (futurs) et l'AVANT-DERNIER, plus le 1er pour voir le format
for idx in [1, len(subs)-1, len(subs)]:
    url = subs[idx-1]
    try:
        t = fetch_gz(url)
        locs = re.findall(r"<loc>(.*?)</loc>", t)
        pl = [u for u in locs if any(h in u for h in PL_HINTS)]
        print(f"\n[{url.split('_')[-1]}] {len(locs):,} URLs, {len(pl)} PL")
        for u in pl[:10]:
            print(f"   {u}")
        if pl:
            found[idx] = pl
    except Exception as e:
        print(f"[{url}] EXC {e}")

all_ids = set()
for idx, urls in found.items():
    for u in urls:
        m = re.search(r"/(\d+)(?:\.xml)?$", u)
        if m: all_ids.add((u, m.group(1)))
print(f"\nTOTAL matchs PL vus : {len(all_ids)}")
