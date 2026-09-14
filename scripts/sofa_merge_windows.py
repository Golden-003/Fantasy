#!/usr/bin/env python3
"""Fusionne les events de la fenêtre git (hier, 178 events) avec la fenêtre
fraîche du jour (96 events) — union par customId, le frais gagne pour
status/scores, incidents en union. Réécrit ckpt_events + sofa_data.json."""
import json
from datetime import datetime, timezone

CKPT = "/home/z/my-project/scripts/sofa_ckpt"

old = json.load(open("/tmp/events_old.json"))
new = json.load(open(f"{CKPT}_events.json"))
print(f"old: {len(old)} | new: {len(new)}")


def key_inc(i):
    return (i.get("type"), i.get("time"), i.get("player"), i.get("playerId"))


merged = {}
for e in old:
    merged[e["customId"]] = dict(e)
for e in new:
    cid = e["customId"]
    if cid not in merged:
        merged[cid] = dict(e)
        continue
    o = merged[cid]
    # le frais gagne si son statut est plus avancé ou s'il a des données
    fresh = dict(o)
    for k, v in e.items():
        if v is not None and (o.get(k) is None or k in ("status", "winnerCode", "startTimestamp", "venue",
                                                        "homeStandingsPos", "awayStandingsPos")):
            fresh[k] = v
    # scores: le frais gagne s'il est Ended ou a des scores
    if e["status"] == "Ended" or (e.get("homeScore") is not None and o["status"] != "Ended"):
        fresh["homeScore"], fresh["awayScore"] = e.get("homeScore"), e.get("awayScore")
    # incidents en union
    incs = {key_inc(i): i for i in (o.get("incidents") or [])}
    for i in (e.get("incidents") or []):
        incs.setdefault(key_inc(i), i)
    fresh["incidents"] = list(incs.values())
    merged[cid] = fresh

events = list(merged.values())

# sanity: un customId = un round cohérent
from collections import Counter
ended = [e for e in events if e["status"] == "Ended"]
ns = [e for e in events if e["status"] == "Not started"]
print(f"FUSION: {len(events)} events | joués {len(ended)} {dict(sorted(Counter(e['round'] for e in ended).items()))}")
print(f"        à venir {len(ns)} {dict(sorted(Counter(e['round'] for e in ns).items()))}")

json.dump(events, open(f"{CKPT}_events.json", "w"), ensure_ascii=False)

standings = json.load(open(f"{CKPT}_standings.json"))
final = {
    "scrapedAt": datetime.now(timezone.utc).isoformat(),
    "season": standings["season"],
    "teams": standings["teams"],
    "squads": json.load(open(f"{CKPT}_squads.json")),
    "events": events,
}
json.dump(final, open("/home/z/my-project/scripts/sofa_data.json", "w"), ensure_ascii=False)
print("🔥 sofa_data.json réécrit (fusion git+fraud)")
