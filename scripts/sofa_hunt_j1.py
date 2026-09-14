#!/usr/bin/env python3
"""Chasse au match PL manquant (Forest-Leeds J1) : balayage d'IDs /event/{id}
au-dessus et en-dessous de la bande connue 16361500-16365200.
Capture tout redirect dont la paire ressemble à deux équipes PL (fragments),
scrape les nouveaux, fusionne dans ckpt_events + sofa_data.json."""
import json
import re
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

from curl_cffi import requests as creq

CKPT = "/home/z/my-project/scripts/sofa_ckpt"
PAT = re.compile(r"^/football/match/([a-z0-9-]+)/([A-Za-z0-9]+)#id:(\d+)$")

standings = json.load(open(f"{CKPT}_standings.json"))
SLUGS = {t["slug"] for t in standings["teams"] if t["slug"]}

FRAG2TEAM = {}
for s in SLUGS:
    FRAG2TEAM[s] = s
    for fr in re.split(r"-", s):
        if len(fr) >= 4:
            FRAG2TEAM[fr] = s
FRAG2TEAM.update({
    "wolves": "wolverhampton-wanderers" if "wolverhampton-wanderers" in SLUGS else None,
    "spurs": "tottenham-hotspur", "man": None, "united": None, "city": None,
})
FRAG2TEAM = {k: v for k, v in FRAG2TEAM.items() if v}


def pair_is_pl(pair):
    try:
        a, b = pair.rsplit("-", 1)[0], pair
        # découpe: essaie toutes les séparations en 2 slugs valides
        parts = pair.split("-")
        for i in range(1, len(parts)):
            for half, side in (("-".join(parts[:i]), "a"), ("-".join(parts[i:]), "b")):
                pass
        # mapping par fragments
        frags = parts
        teams = set()
        for f in frags:
            if f in FRAG2TEAM:
                teams.add(FRAG2TEAM[f])
        # heuristique: au moins 2 fragments reconnus pointant vers 2 équipes
        return len(teams) >= 1  # large, filtrage fin après scrape
    except Exception:
        return False


def probe(nid):
    try:
        S = creq.Session(impersonate="chrome124")
        r = S.get(f"https://www.sofascore.com/event/{nid}", timeout=20, allow_redirects=False,
                  headers={"Accept": "text/html"})
        if r.status_code in (301, 302):
            loc = r.headers.get("Location", "")
            m = PAT.match(loc)
            if m:
                return nid, m.group(1), m.group(2)
    except Exception:
        pass
    return nid, None, None


# ── 1) balayage ──────────────────────────────────────────────
BANDS = [(16365201, 16374000), (16356000, 16361499)]
found = {}
t0 = time.time()
total_ids = sum(hi - lo + 1 for lo, hi in BANDS)
print(f"Balayage {total_ids} IDs en 2 bandes...")
done = 0
with ThreadPoolExecutor(max_workers=16) as ex:
    futs = {}
    for lo, hi in BANDS:
        for n in range(lo, hi + 1):
            futs[ex.submit(probe, n)] = n
    for f in as_completed(futs):
        nid, pair, cid = f.result()
        done += 1
        if done % 2000 == 0:
            print(f"  {done}/{total_ids} ({time.time()-t0:.0f}s)")
        if pair and ("leeds" in pair or "forest" in pair or "nottingham" in pair):
            found[str(nid)] = {"slugPair": pair, "customId": cid}
            print(f"  ★ {nid} → {pair} / {cid}")

print(f"{len(found)} candidats Leeds/Forest en {time.time()-t0:.0f}s")
json.dump(found, open("/home/z/my-project/scripts/sofa_ckpt_j1hunt.json", "w"))
