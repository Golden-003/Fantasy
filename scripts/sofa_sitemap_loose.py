#!/usr/bin/env python3
"""Re-scan TOUS les chunks sitemap en filtrant large: toute URL match
contenant 2 fragments d'équipes PL (pas seulement les paires exactes)."""
import gzip
import json
import re

from curl_cffi import requests as creq

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})

standings = json.load(open("/home/z/my-project/scripts/sofa_ckpt_standings.json"))
SLUGS = {t["slug"] for t in standings["teams"] if t["slug"]}

# fragments discriminants par équipe (ordre: le plus spécifique d'abord)
FRAGS = ["nottingham-forest", "nottm-forest", "leeds-united", "manchester-united",
         "manchester-city", "tottenham-hotspur", "brighton-and-hove-albion",
         "crystal-palace", "aston-villa", "west-ham", "liverpool-fc", "liverpool",
         "newcastle-united", "arsenal", "chelsea", "everton", "brentford", "fulham",
         "bournemouth", "burnley", "sunderland", "ipswich-town", "hull-city",
         "leeds", "wolves", "wolverhampton", "forest", "spurs", "coventry"]

idx_txt = gzip.decompress(S.get("https://www.sofascore.com/sitemaps/en_sitemap_events_football.xml.gz", timeout=45).content).decode("utf-8", "ignore")
chunks = re.findall(r"<loc>(.*?)</loc>", idx_txt)
print(f"{len(chunks)} chunks")

hits = []
for i, cu in enumerate(chunks, 1):
    try:
        txt = gzip.decompress(S.get(cu, timeout=45).content).decode("utf-8", "ignore")
    except Exception:
        print(f"  chunk {i}: ECHEC")
        continue
    for u in re.findall(r"<loc>(.*?)</loc>", txt):
        m = re.match(r"^https://www\.sofascore\.com/football/match/([a-z0-9-]+)/([A-Za-z0-9]+)$", u)
        if not m:
            continue
        pair = m.group(1)
        frags = [f for f in FRAGS if f"-{f}-" in f"-{pair}-" or pair.startswith(f"{f}-") or pair.endswith(f"-{f}")]
        # au moins 2 fragments distincts d'équipes différentes
        if len(frags) >= 2 and frags[0] != frags[1]:
            hits.append({"url": u, "pair": pair, "customId": m.group(2), "frags": frags[:2]})

print(f"{len(hits)} URLs PL candidats (filtre large)")
# dédoublonner par customId
seen = {}
for h in hits:
    seen[h["customId"]] = h
json.dump(list(seen.values()), open("/home/z/my-project/scripts/sofa_ckpt_sitemap_loose.json", "w"), ensure_ascii=False)

# focus leeds-forest
lf = [h for h in seen.values() if "leeds" in h["pair"] and "forest" in h["pair"]]
print(f"\nLEEDS-FOREST: {len(lf)}")
for h in lf:
    print("  ", h["url"])
