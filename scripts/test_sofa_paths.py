#!/usr/bin/env python3
"""Test systématique de toutes les voies d'accès possibles à l'API Sofascore."""
import json
import sys
import time

import requests
from curl_cffi import requests as creq

TARGET = "https://api.sofascore.com/api/v1/sport/football/events/live"
EPL_STANDINGS = "https://api.sofascore.com/api/v1/unique-tournament/17/season/76986/standings/total"

results = []

def record(name, ok, detail):
    results.append((name, ok, detail))
    print(f"{'✅' if ok else '❌'} {name:42s} {detail[:110]}")

# ---------- VOIE 1 : curl_cffi TLS impersonation (empreintes navigateurs réels) ----------
print("=" * 70)
print("VOIE 1 — curl_cffi (usurpation empreinte TLS de vrais navigateurs)")
print("=" * 70)
for profile in ["chrome124", "chrome131", "safari17_0", "edge101", "firefox133"]:
    try:
        r = creq.get(
            TARGET,
            impersonate=profile,
            headers={"Accept": "application/json", "Referer": "https://www.sofascore.com/", "Origin": "https://www.sofascore.com"},
            timeout=20,
        )
        body = r.text[:200].replace("\n", " ")
        record(f"curl_cffi[{profile}]", r.status_code == 200, f"HTTP {r.status_code} → {body}")
        if r.status_code == 200:
            print(f"   🔥 DATA: {r.text[:300]}")
    except Exception as e:
        record(f"curl_cffi[{profile}]", False, f"EXC {type(e).__name__}: {str(e)[:90]}")
    time.sleep(1)

# ---------- VOIE 2 : proxys publics ----------
print("\n" + "=" * 70)
print("VOIE 2 — Proxys publics (leurs IPs, leur réputation)")
print("=" * 70)
proxies = [
    ("codetabs", "https://api.codetabs.com/v1/proxy?quest=" + TARGET),
    ("allorigins-raw", "https://api.allorigins.win/raw?url=" + TARGET),
    ("corsproxy.io", "https://corsproxy.io/?url=" + TARGET),
    ("thingproxy", "https://thingproxy.freeboard.io/fetch/" + TARGET),
    ("whateverorigin", "http://www.whateverorigin.org/get?url=" + TARGET),
]
for name, url in proxies:
    try:
        r = requests.get(url, timeout=25, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
        txt = r.text
        ok = r.status_code == 200 and '"reason":"challenge"' not in txt and "challenge" not in txt[:300]
        record(f"proxy[{name}]", ok, f"HTTP {r.status_code} → {txt[:160].replace(chr(10),' ')}")
        if ok:
            print(f"   🔥 DATA: {txt[:300]}")
    except Exception as e:
        record(f"proxy[{name}]", False, f"EXC {type(e).__name__}: {str(e)[:90]}")
    time.sleep(1)

# ---------- VOIE 2b : r.jina.ai (rendu côté serveur, bonne réputation IP) ----------
print("\n" + "=" * 70)
print("VOIE 2b — r.jina.ai (reader proxy)")
print("=" * 70)
for tgt in [TARGET, EPL_STANDINGS]:
    try:
        r = requests.get("https://r.jina.ai/" + tgt, timeout=40)
        ok = r.status_code == 200 and "challenge" not in r.text[:400].lower()
        record(f"jina[{tgt[-45:]}]", ok, f"HTTP {r.status_code} → {r.text[:150].replace(chr(10),' ')}")
        if ok:
            print(f"   🔥 DATA: {r.text[:400]}")
    except Exception as e:
        record(f"jina", False, f"EXC {type(e).__name__}: {str(e)[:90]}")
    time.sleep(1)

# ---------- Résumé ----------
print("\n" + "=" * 70)
wins = [r for r in results if r[1]]
print(f"RÉSULTAT : {len(wins)}/{len(results)} voies OK")
for name, _, detail in wins:
    print(f"   🏆 {name}: {detail[:100]}")
sys.exit(0 if wins else 2)
