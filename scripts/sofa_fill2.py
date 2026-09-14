#!/usr/bin/env python3
"""Piste Wayback Machine : endpoints api.sofascore.com archivés pour les journées passées."""
import json
import time
from datetime import datetime, timezone

import requests

# dates réelles des rounds joués depuis les events déjà récoltés
events = json.load(open("/home/z/my-project/scripts/sofa_ckpt_events.json"))
ended = [e for e in events if e["status"] == "Ended"]
rounds_dates = {}
for e in ended:
    d = datetime.fromtimestamp(e["startTimestamp"], tz=timezone.utc).strftime("%Y-%m-%d")
    rounds_dates.setdefault(e["round"], set()).add(d)
print("Dates par round:")
for r in sorted(rounds_dates):
    print(f"  J{r}: {sorted(rounds_dates[r])}")

dates = sorted({d for ds in rounds_dates.values() for d in ds})

# Wayback availability API pour scheduled-events
for date in dates:
    api = f"https://api.sofascore.com/api/v1/sport/football/scheduled-events/{date}"
    av = f"http://archive.org/wayback/available?url={api}&timestamp=20260915"
    try:
        r = requests.get(av, timeout=20).json()
        snap = r.get("archived_snapshots", {}).get("closest", {})
        print(f"[{date}] snapshot: {snap.get('url', 'AUCUN')}")
    except Exception as e:
        print(f"[{date}] err {e}")
    time.sleep(0.6)
