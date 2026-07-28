#!/usr/bin/env python3
"""Tarkistaa sivuston linkit.

Käyttö projektin juuresta:
    python3 tools/check-links.py            # sisäiset linkit ja tiedostot
    python3 tools/check-links.py --ulkoiset # myös ulkoiset URL:t (verkkoyhteys)

Sisäinen tarkistus varmistaa, että jokainen href/src ja jokainen ankkuri
(#id) löytyy. Ulkoinen tarkistus tekee HEAD-kyselyn: PDF-linkit osoittavat
nykyisen WordPress-sivuston wp-content-hakemistoon, joten ne on hyvä
tarkistaa aina julkaisun jälkeen.
"""
import re
import sys
import glob
import json
import os
import urllib.parse
import urllib.request
import concurrent.futures as cf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

HREF = re.compile(r'(?:href|src)="([^"]+)"')
IDS = re.compile(r'\sid="([^"]+)"')

pages = sorted(glob.glob("*.html"))
# Skriptit rakentavat osan linkeistä, joten ankkurit kerätään myös JS:stä.
extra_sources = sorted(glob.glob("assets/js/*.js")) + sorted(glob.glob("data/*.json"))

ids = {}
for p in pages:
    ids[p] = set(IDS.findall(open(p, encoding="utf-8").read()))
# Web-komponentit tuovat mukanaan kiinteät ankkurit.
for p in pages:
    ids[p] |= {"main", "paavalikko"}

internal_errors = []
external = set()

for src in pages + extra_sources:
    text = open(src, encoding="utf-8").read()
    links = HREF.findall(text)
    if src.endswith(".json") or src.endswith(".js"):
        links += re.findall(r'"(https?://[^"]+)"', text)

    for link in links:
        if "${" in link:  # JS-mallipohjan paikanpitäjä, ei oikea linkki
            continue
        if link.startswith(("http://", "https://")):
            external.add(link)
            continue
        if link.startswith(("mailto:", "tel:", "data:")):
            continue
        path, _, frag = link.partition("#")
        target = path or src
        if path and not os.path.exists(path):
            internal_errors.append(f"{src}: puuttuva tiedosto {path}")
            continue
        if frag and target.endswith(".html") and frag not in ids.get(target, set()):
            internal_errors.append(f"{src}: ankkuri #{frag} puuttuu tiedostosta {target}")

# Varmistetaan, että JSON-datan kuvat ja sivujen kuvat ovat olemassa.
for p in pages:
    for m in re.findall(r'srcset="([^"]+)"', open(p, encoding="utf-8").read()):
        for part in m.split(","):
            f = part.strip().split(" ")[0]
            if f and not os.path.exists(f):
                internal_errors.append(f"{p}: puuttuva kuva {f}")

# Navigaation kohteet määritellään site.js:ssä, joten ne tarkistetaan erikseen.
nav_js = open("assets/js/site.js", encoding="utf-8").read()
for href in re.findall(r'href:\s*"([^"]+)"', nav_js):
    if not os.path.exists(href):
        internal_errors.append(f"assets/js/site.js: navigaation kohde {href} puuttuu")

print(f"Sivuja: {len(pages)}   sisäisiä virheitä: {len(internal_errors)}")
for e in internal_errors:
    print("  RIKKI", e)

if "--ulkoiset" in sys.argv:
    # GET selaimen tunnisteella: osa julkishallinnon palvelimista hylkää
    # HEAD-pyynnöt ja tuntemattomat User-Agentit, mikä näyttäisi rikkinäiseltä.
    UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
          "(KHTML, like Gecko) Chrome/126 Safari/537.36")
    # Facebook estää automaattiset pyynnöt. Oman sivuston canonical- ja
    # og:url-osoitteet vastaavat vasta julkaisun jälkeen; ne tarkistetaan
    # sisäisenä tiedostona joka tapauksessa.
    SKIP = ("facebook.com",)

    def own_page(u):
        return u.startswith("https://prokuolimo.fi/") and "wp-content" not in u

    def check(u):
        q = urllib.parse.quote(u, safe=":/?&=#%+~,.–()")
        try:
            req = urllib.request.Request(q, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                return u, r.status, r.geturl()
        except Exception as err:
            return u, getattr(err, "code", None) or type(err).__name__, ""

    checkable = sorted(
        u for u in external if not any(s in u for s in SKIP) and not own_page(u)
    )
    print(f"\nUlkoisia linkkejä: {len(checkable)} (ohitettu {len(external) - len(checkable)})")
    broken = 0
    with cf.ThreadPoolExecutor(8) as ex:
        for u, st, final in ex.map(check, checkable):
            if st != 200:
                broken += 1
                print(f"  RIKKI {st}  {u}")
            # Verrataan purettuja osoitteita, jotta ä/ö:n prosenttikoodaus ei
            # näytä uudelleenohjaukselta.
            elif final and urllib.parse.unquote(final).rstrip("/") != u.rstrip("/"):
                print(f"  OHJAUS {u}\n         -> {final}")
    print(f"Rikkinäisiä ulkoisia linkkejä: {broken}")

sys.exit(1 if internal_errors else 0)
