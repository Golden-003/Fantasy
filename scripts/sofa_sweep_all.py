#!/usr/bin/env python3
"""Re-balayage du lot principal en sauvant TOUS les redirects (recherche de variants de slugs)."""
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from curl_cffi import requests as creq

LO, HI = 16361500, 16365200
PAT_PARTS = None

import re
PAT = re.compile(r"^/football/match/([a-z0-9-]+)/([A-Za-z0-9]+)#id:(\d+)$")

all_found = {}
lock = __import__("threading").Lock()


def probe(nid):
    try:
        S = creq.Session(impersonate="chrome124")
        r = S.get(f"https://www.sofascore.com/event/{nid}", timeout=25, allow_redirects=False,
                  headers={"Accept": "text/html"})
        if r.status_code in (301, 302):
            loc = r.headers.get("Location", "")
            m = PAT.match(loc)
            if m:
                return nid, m.group(1), m.group(2)
    except Exception:
        pass
    return nid, None, None


t0 = time.time()
with ThreadPoolExecutor(max_workers=14) as ex:
    futs = {ex.submit(probe, n): n for n in range(LO, HI + 1)}
    for f in as_completed(futs):
        nid, pair, cid = f.result()
        if pair:
            all_found[str(nid)] = {"slugPair": pair, "customId": cid}

print(f"{len(all_found)} redirects sauvés en {time.time()-t0:.0f}s")
json.dump(all_found, open("/home/z/my-project/scripts/sofa_ckpt_sweep_all.json", "w"))

# analyse : slugs qui contiennent un fragment d'équipe PL mais ne matchent pas les paires exactes
standings = json.load(open("/home/z/my-project/scripts/sofa_ckpt_standings.json"))
slugs = {t["slug"] for t in standings["teams"] if t["slug"]}
pairs_pl = set()
for a in slugs:
    for b in slugs:
        if a != b:
            pairs_pl.add(f"{a}-{b}" if a < b else f"{b}-{a}")

FRAGMENTS = ["brighton", "hove", "wolverhampton", "wolves", "nottingham", "nottm", "forest",
             "manchester", "man-", "united", "newcastle", "tottenham", "spurs", "west-ham",
             "crystal", "palace", "aston", "villa", "leeds", "sunderland", "coventry",
             "arsenal", "liverpool", "chelsea", "everton", "brentford", "fulham", "bournemouth",
             "burnley", "ipswich", "hull", "city"]

non_exact = {nid: v for nid, v in all_found.items() if v["slugPair"] not in pairs_pl}
print(f"\n{len(non_exact)} redirects NON-paires-PL exactes — cherchons les variants:")
variants = {}
for nid, v in non_exact.items():
    pair = v["slugPair"]
    hits = [fr for fr in FRAGMENTS if fr in pair]
    if len(hits) >= 2:
        variants[nid] = v
        print(f"   {nid} → {pair} / {v['customId']}")
json.dump(variants, open("/home/z/my-project/scripts/sofa_ckpt_variants.json", "w"))
print(f"\n{len(variants)} candidats variants trouvés")
