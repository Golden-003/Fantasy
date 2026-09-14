#!/usr/bin/env python3
"""BALAYAGE COMPLET : /event/{id} → 301 Location = identité du match.
Toute la saison PL 26/27 est dans la plage 16363200-16364000."""
import json
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from curl_cffi import requests as creq

LO, HI = 16365200, 16372500  # plage élargie
ids_known = {e["id"] for e in json.load(open("/home/z/my-project/scripts/sofa_ckpt_ids.json"))}
standings = json.load(open("/home/z/my-project/scripts/sofa_ckpt_standings.json"))
slugs = {t["slug"] for t in standings["teams"] if t["slug"]}

PAT = re.compile(r"^/football/match/([a-z0-9-]+)/([A-Za-z0-9]+)#id:(\d+)$")
found = {}
lock_print = __import__("threading").Lock()


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
        elif r.status_code == 200:
            return nid, None, None  # pas de redirect — ignorer
    except Exception:
        pass
    return nid, None, None


t0 = time.time()
todo = [n for n in range(LO, HI + 1)]
done = 0
with ThreadPoolExecutor(max_workers=12) as ex:
    futs = {ex.submit(probe, n): n for n in todo}
    for f in as_completed(futs):
        nid, pair, cid = f.result()
        done += 1
        if pair:
            is_pl = pair.split("--")[0]  # slugPair peut contenir 2 slugs
            # le pair est "slugA-slugB" — déterminons si les DEUX slugs sont des équipes PL actuelles
            with lock_print:
                found[nid] = {"slugPair": pair, "customId": cid}
                if done % 150 == 0:
                    print(f"  ... {done}/{len(todo)} ids testés ({time.time()-t0:.0f}s), {len(found)} redirects")

print(f"\nBalayage terminé en {time.time()-t0:.0f}s — {len(found)} matchs redirigés")

# filtre les matchs dont les 2 slugs sont PL (test par paires connues)
pairs_pl = set()
for a in slugs:
    for b in slugs:
        if a != b:
            pairs_pl.add(f"{a}-{b}" if a < b else f"{b}-{a}")

pl_hits = {nid: v for nid, v in found.items() if v["slugPair"] in pairs_pl}
print(f"Matchs PL 26/27 identifiés par balayage: {len(pl_hits)}")

json.dump({str(nid): v for nid, v in pl_hits.items()},
          open("/home/z/my-project/scripts/sofa_ckpt_sweep_high.json", "w"))
new = {v["slugPair"] for v in pl_hits.values()} - {e["slugPair"] for e in json.load(open("/home/z/my-project/scripts/sofa_ckpt_events.json"))}
print(f"Nouvelles paires jamais vues: {len(new)}")
for p in sorted(new)[:40]:
    print(f"   {p}")
