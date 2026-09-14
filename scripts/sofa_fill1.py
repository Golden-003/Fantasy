#!/usr/bin/env python3
"""Compléter les matchs manquants : pattern élargi + sitemaps multi-langues + wayback."""
import gzip
import json
import re
import time
from datetime import datetime, timezone

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

standings = json.load(open("/home/z/my-project/scripts/sofa_ckpt_standings.json"))
slugs = {t["slug"] for t in standings["teams"] if t["slug"]}
pairs = set()
for a in slugs:
    for b in slugs:
        if a != b:
            pairs.add(f"{a}-{b}" if a < b else f"{b}-{a}")

existing = {(c["slugPair"], c["customId"]) for c in json.load(open("/home/z/my-project/scripts/sofa_ckpt_candidates.json"))}
print(f"Existant: {len(existing)} candidats")

new_candidates = {}

# 1) sitemaps multi-langues avec pattern ÉLARGI (autorise chiffres dans l'ID)
for lang in ["fr", "es", "de", "en"]:
    try:
        idx_txt = fetch_gz(f"https://www.sofascore.com/sitemaps/{lang}_sitemap_events_football.xml.gz")
        if not idx_txt:
            print(f"[{lang}] index inaccessible"); continue
        chunks = re.findall(r"<loc>(.*?)</loc>", idx_txt)
        found = 0
        for chunk_url in chunks:
            txt = fetch_gz(chunk_url)
            if not txt:
                continue
            for u in re.findall(r"<loc>(.*?)</loc>", txt):
                m = re.match(r"^https://www\.sofascore\.com/football/match/([a-z0-9-]+)/([A-Za-z0-9]+)$", u)
                if m and m.group(1) in pairs:
                    key = (m.group(1), m.group(2))
                    if key not in existing and key not in new_candidates:
                        new_candidates[key] = u
                        found += 1
        print(f"[{lang}] {len(chunks)} chunks → +{found} nouveaux")
    except Exception as e:
        print(f"[{lang}] err {e}")

print(f"\nNouveaux candidats multi-langues: {len(new_candidates)}")
for k, u in list(new_candidates.items())[:20]:
    print(f"   {k[0]} / {k[1]}")

json.dump([{"slugPair": k[0], "customId": k[1], "url": u} for k, u in new_candidates.items()],
          open("/home/z/my-project/scripts/sofa_ckpt_candidates_extra.json", "w"))
