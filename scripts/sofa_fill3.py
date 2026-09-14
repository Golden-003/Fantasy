#!/usr/bin/env python3
"""Sitemap tournaments → pages saison PL → matchs ?"""
import gzip
import json
import re
import time

from curl_cffi import requests as creq

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})

def fetch_gz(url, retries=2):
    for a in range(retries):
        try:
            r = S.get(url, timeout=45)
            if r.status_code == 200:
                return gzip.decompress(r.content).decode("utf-8", "ignore")
            time.sleep(1)
        except Exception:
            time.sleep(1.5)
    return None

def get_next_data(url):
    try:
        r = S.get(url, timeout=35, headers={"Accept": "text/html"})
        if r.status_code == 200:
            m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', r.text, re.S)
            if m:
                return json.loads(m.group(1))
    except Exception:
        pass
    return None

idx = fetch_gz("https://www.sofascore.com/sitemaps/en_sitemap_tournaments_index.xml.gz")
if idx:
    # cherche le sitemap football tournaments
    locs = re.findall(r"<loc>(.*?)</loc>", idx)
    foot = [l for l in locs if "football" in l]
    print(f"{len(locs)} sitemaps, football: {foot[:5]}")
    for u in foot[:3]:
        txt = fetch_gz(u)
        if not txt:
            continue
        pages = re.findall(r"<loc>(.*?)</loc>", txt)
        pl = [p for p in pages if "premier-league" in p]
        print(f"[{u.split('/')[-1]}] {len(pages):,} pages, PL: {len(pl)}")
        for p in pl[:12]:
            print(f"   {p}")
        break
else:
    print("tournaments index inaccessible")
