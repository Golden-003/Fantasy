#!/usr/bin/env python3
"""PHASE 2 : pages joueur → lastYearSummary (notes réelles par match + blessures)."""
import json
import re
import time

from curl_cffi import requests as creq

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})
CKPT = "/home/z/my-project/scripts/sofa_ckpt_players_notes.json"

def get_next_data(url, retries=2):
    for a in range(retries):
        try:
            r = S.get(url, timeout=30, headers={"Accept": "text/html"})
            if r.status_code == 200:
                m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', r.text, re.S)
                if m:
                    return json.loads(m.group(1))
                return None
            time.sleep(1.2)
        except Exception:
            time.sleep(1.5)
    return None

squads = json.load(open("/home/z/my-project/scripts/sofa_ckpt_squads.json"))
try:
    notes = json.load(open(CKPT))
except Exception:
    notes = {}

players = []
for slug, sq in squads.items():
    for p in sq["players"]:
        if p.get("sofascoreId") and p.get("slug"):
            players.append(p)
print(f"{len(players)} joueurs, {len(notes)} déjà faits")

for i, p in enumerate(players, 1):
    sid = str(p["sofascoreId"])
    if sid in notes:
        continue
    d = get_next_data(f"https://www.sofascore.com/player/{p['slug']}/{sid}")
    if d:
        try:
            pp = d["props"]["pageProps"]
            lys = pp.get("lastYearSummary")
            notes[sid] = {"lastYearSummary": lys, "transfers": len(pp.get("transfers") or [])}
        except Exception:
            notes[sid] = None
    else:
        notes[sid] = None
    if i % 25 == 0:
        json.dump(notes, open(CKPT, "w"))
        print(f"  [{i}/{len(players)}] sauvegardé ({len(notes)} entrées)")
    time.sleep(0.25)

json.dump(notes, open(CKPT, "w"))
ok = sum(1 for v in notes.values() if v and v.get("lastYearSummary"))
print(f"TERMINÉ: {len(notes)} joueurs, {ok} avec lastYearSummary")
