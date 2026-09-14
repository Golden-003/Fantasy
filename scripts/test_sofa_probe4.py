#!/usr/bin/env python3
"""Sonde 4 : robots.txt + sitemaps → URLs de matchs avec IDs réels."""
from curl_cffi import requests as creq
import re, sys

S = creq.Session(impersonate="chrome124", headers={"Accept-Language": "fr-FR,fr;q=0.9"})

r = S.get("https://www.sofascore.com/robots.txt", timeout=20)
print(f"[robots.txt] HTTP {r.status_code}")
print(r.text[:1500])

# essaie les sitemaps standards
for u in ["https://www.sofascore.com/sitemap.xml",
          "https://www.sofascore.com/sitemap-index.xml"]:
    try:
        r = S.get(u, timeout=20)
        print(f"\n[{u}] HTTP {r.status_code} — {len(r.text):,} octets")
        locs = re.findall(r"<loc>(.*?)</loc>", r.text)[:40]
        print(f"  {len(locs)} <loc> trouvés:")
        for l in locs[:40]:
            print(f"   - {l}")
    except Exception as e:
        print(f"[{u}] EXC {e}")
