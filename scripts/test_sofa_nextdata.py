#!/usr/bin/env python3
"""Extrait et analyse le payload __NEXT_DATA__ des pages Sofascore."""
from curl_cffi import requests as creq
import json, sys, re

url = "https://www.sofascore.com/tournament/football/england/premier-league/17"
r = creq.get(url, impersonate="chrome124", timeout=30,
             headers={"Accept": "text/html", "Accept-Language": "fr-FR,fr;q=0.9"})
html = r.text
print(f"HTTP {r.status_code} — {len(html):,} octets")

m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
if not m:
    # parfois l'attribut est différent
    m = re.search(r'__NEXT_DATA__[^>]*>(.*?)</script>', html, re.S)
if not m:
    print("Pas de __NEXT_DATA__ parsable"); sys.exit(1)

try:
    data = json.loads(m.group(1))
except Exception as e:
    print(f"JSON invalide: {e}"); sys.exit(1)

def walk(node, path="", depth=0, out=None):
    """Liste les chemins avec listes/dicts de taille significative."""
    if out is None: out = []
    if depth > 8: return out
    if isinstance(node, dict):
        keys = list(node.keys())
        if len(keys) > 3:
            out.append((path, f"dict[{len(keys)}] keys={keys[:8]}"))
        for k, v in node.items():
            walk(v, f"{path}.{k}", depth + 1, out)
    elif isinstance(node, list) and len(node) > 2:
        out.append((path, f"list[{len(node)}]"))
        if node and depth < 8:
            walk(node[0], f"{path}[0]", depth + 1, out)
    return out

print("\n--- Structure du payload (branches significatives) ---")
for p, d in walk(data)[:60]:
    print(f"  {p}: {d}")

# cherche des chaînes JSON sérialisées dans les valeurs texte (RSC flight data)
big_strings = []
def find_str(node, path=""):
    if isinstance(node, dict):
        for k, v in node.items(): find_str(v, f"{path}.{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node[:50]): find_str(v, f"{path}[{i}]")
    elif isinstance(node, str) and len(node) > 2000:
        big_strings.append((path, len(node)))
find_str(data)
print("\n--- Chaînes > 2000 car (données sérialisées possibles) ---")
for p, l in big_strings[:20]:
    print(f"  {p}: {l:,} car")
