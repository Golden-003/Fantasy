#!/usr/bin/env python3
"""Sonde 5 : sitemap events → IDs de matchs PL récents + à venir."""
from curl_cffi import requests as creq
import gzip, re, io, sys

S = creq.Session(impersonate="chrome124")

def fetch(url):
    r = S.get(url, timeout=40)
    if url.endswith(".gz"):
        return gzip.decompress(r.content).decode("utf-8", "ignore")
    return r.text

txt = fetch("https://www.sofascore.com/sitemaps/en_sitemap_events_index.xml.gz")
print(f"[events index] {len(txt):,} car")
locs = re.findall(r"<loc>(.*?)</loc>", txt)
print(f"{len(locs)} sous-sitemaps")
# montre les derniers (les plus récents si triés par date/plage)
for l in locs[-25:]:
    print(f"  {l}")
# aussi les premiers pour comprendre le pattern
print("  ...")
for l in locs[:6]:
    print(f"  {l}")
