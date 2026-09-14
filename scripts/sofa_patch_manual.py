#!/usr/bin/env python3
"""PATCH MANUEL — matchs réels confirmés par recoupement multi-sources
(classement Sofascore GF/GA + reports de presse) mais introuvables en SSR
(hors fenêtre sitemap, hors bande d'IDs).
Injectés comme events synthétiques dans ckpt_events → traités comme les
autres par sofa_inject.ts (idempotent, persistant entre les syncs).

Validé pour Forest 0-1 Leeds (J1, 22 août 2026, Stach 88'):
- Leeds 4J 8pts (7-3): 3 matchs connus = 6-3 → J1 = 1-0 ✓ pts V-N-N-V=8 ✓
- Forest 4J 5pts (4-4): 0-1 J1 → cohérent avec V...=5pts ✓"""
import json
from datetime import datetime, timezone

CKPT = "/home/z/my-project/scripts/sofa_ckpt"

# kickoff 22 août 2026 14:00 UTC (créneau samedi classique UK 15:00 BST)
KICKOFF = int(datetime(2026, 8, 22, 14, 0, 0, tzinfo=timezone.utc).timestamp())

MANUAL_EVENTS = [
    {
        "customId": "MANUAL-J1-FOL",
        "slugPair": "leeds-united-nottingham-forest",
        "round": 1,
        "startTimestamp": KICKOFF,
        "status": "Ended",
        "winnerCode": 2,
        "homeTeam": "nottingham-forest", "homeTeamId": None,
        "awayTeam": "leeds-united", "awayTeamId": None,
        "homeScore": 0, "awayScore": 1,
        "venue": "The City Ground",
        "homeStandingsPos": None, "awayStandingsPos": None,
        "incidents": [
            {"type": "goal", "time": 88, "isHome": False,
             "player": "Anton Stach", "playerId": 889861,
             "assist": None, "assistId": None},
        ],
        "_manual": True,
    },
]

events = json.load(open(f"{CKPT}_events.json"))
by_cid = {e["customId"]: i for i, e in enumerate(events)}

added = 0
for me in MANUAL_EVENTS:
    if me["customId"] in by_cid:
        events[by_cid[me["customId"]]] = me
        print(f"↻ patch {me['customId']} actualisé")
    else:
        events.append(me)
        added += 1
        print(f"+ patch {me['customId']}: {me['homeTeam']} {me['homeScore']}-{me['awayScore']} {me['awayTeam']}")

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
print(f"🔥 sofa_data.json ({added} patch ajouté, {len(events)} events)")
