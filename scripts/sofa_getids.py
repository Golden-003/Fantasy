#!/usr/bin/env python3
"""Récupère les IDs numériques des matchs déjà récoltés (base du balayage)."""
import json
import re
import time

from curl_cffi import requests as creq

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})

events = json.load(open("/home/z/my-project/scripts/sofa_ckpt_events.json"))
out = []
for e in events:
    if e["status"] not in ("Ended", "Not started"):
        continue
    url = f"https://www.sofascore.com/football/match/{e['slugPair']}/{e['customId']}"
    try:
        r = S.get(url, timeout=30)
        m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', r.text, re.S)
        if not m:
            print(f"  {e['customId']}: pas de NEXT_DATA")
            continue
        d = json.loads(m.group(1))
        ev = d["props"]["pageProps"]["event"]
        nid = ev.get("id")
        cid = ev.get("customId")
        st = ev.get("startTimestamp")
        out.append({"id": nid, "customId": cid, "slugPair": e["slugPair"], "round": e["round"], "start": st, "status": e["status"]})
        dt = time.strftime("%Y-%m-%d %H:%M", time.gmtime(st)) if st else "?"
        print(f"  id={nid:>9} J{e['round']:>2} {e['slugPair']:48s} {dt}")
        time.sleep(0.3)
    except Exception as ex:
        print(f"  {e['customId']}: err {str(ex)[:60]}")

json.dump(out, open("/home/z/my-project/scripts/sofa_ckpt_ids.json", "w"))
print(f"\n{len(out)} IDs numériques sauvés")
