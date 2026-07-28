#!/usr/bin/env python3
"""Poimii näkösyvyystulokset Pro Kuolimon mittausraportista (PDF) JSON-muotoon.

Käyttö projektin juuresta:
    python3 tools/extract-nakosyvyys.py raportti.pdf > data/nakosyvyys.json

Vaatii poppler-työkalun `pdftotext`. Raportti on esityskalvosarja, jossa
jokaisella sivulla on kartta: pistetunnus (esim. "A1") ja sen alla mitattu
lukema (esim. "5,2"). Pari muodostetaan tiukalla sijaintiehdolla – arvo on
lähes samassa x-koordinaatissa noin 4–16 pistettä tunnuksen alapuolella.
Ehto on tarkoituksella tiukka: epäselvät parit jätetään mieluummin pois
kuin arvataan väärin. Ohitetut tapaukset tulostuvat stderr-virtaan, jotta
ne voi tarkistaa käsin PDF:stä.

Jos raporttiin tulee uusi mittauskierros, lisää sen sivu ROUNDS-taulukkoon.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

NS = "{http://www.w3.org/1999/xhtml}"
LABEL = re.compile(r"^([A-J])\.?(\d)\.?$")
VALUE = re.compile(r"^(\d)[,.](\d)\.?$")

# PDF-sivu -> (tunniste, näkyvä nimi). Sivut 1–2 ovat saatetekstiä.
ROUNDS = {
    3: ("2024-06", "kesäkuu 2024"),
    4: ("2024-08", "elokuu 2024"),
    5: ("2024-10", "lokakuu 2024"),
    6: ("2025-03", "maaliskuu 2025"),
    7: ("2025-06", "kesäkuu 2025"),
    8: ("2025-08", "elokuu 2025"),
    9: ("2025-10", "lokakuu 2025"),
}

# Lähdeaineistossa osa tunnuksista on tekstinpoiminnassa vääristynyt.
# Nämä vastaavuudet on tarkistettu käsin PDF:n kartalta.
ALIAS = {
    3: {".H3": "H3"},
    4: {"14": "A4"},
    5: {"H.": "H1"},
    8: {"HH": "H8"},
    9: {"HH": "H8"},
}

LAHDE = {
    "nimi": "Pro Kuolimo – näkösyvyysmittaustulokset 19.11.2025",
    "url": "aineistot/2025-11-19-pro-kuolimo-nakosyvyysmittaustulokset.pdf",
}


def words_per_page(pdf):
    """Palauttaa (sivunumero, [(sana, xMin, yMin), ...]) jokaiselta sivulta."""
    with tempfile.TemporaryDirectory() as tmp:
        xml = os.path.join(tmp, "ns.xml")
        subprocess.run(["pdftotext", "-bbox-layout", pdf, xml], check=True)
        root = ET.parse(xml).getroot()
        for index, page in enumerate(root.iter(NS + "page"), start=1):
            out = []
            for w in page.iter(NS + "word"):
                text = (w.text or "").strip()
                if text:
                    out.append((text, float(w.get("xMin")), float(w.get("yMin"))))
            yield index, out


def main(pdf):
    data = {}
    notes = []

    for page, words in words_per_page(pdf):
        if page not in ROUNDS:
            continue

        labels = []
        for text, x, y in words:
            match = LABEL.match(text)
            if match:
                labels.append((match.group(1) + match.group(2), x, y))
            elif text in ALIAS.get(page, {}):
                labels.append((ALIAS[page][text], x, y))

        values = [(t, x, y) for t, x, y in words if VALUE.match(t)]
        used, pairs = set(), {}

        for name, lx, ly in labels:
            hits = [
                (i, vt)
                for i, (vt, vx, vy) in enumerate(values)
                if i not in used and abs(vx - lx) <= 6 and 4 <= vy - ly <= 16
            ]
            if len(hits) == 1:
                used.add(hits[0][0])
                pairs[name] = hits[0][1]
            elif len(hits) > 1:
                notes.append(f"s.{page} {name}: monta ehdokasta {[h[1] for h in hits]}, ohitettu")

        for i, (vt, vx, vy) in enumerate(values):
            if i not in used:
                notes.append(f"s.{page}: pariton arvo {vt} kohdassa {vx:.0f},{vy:.0f}, ohitettu")

        data[ROUNDS[page][0]] = {
            k: round(float(v.rstrip(".").replace(",", ".")), 1) for k, v in pairs.items()
        }

    points = sorted({p for r in data.values() for p in r}, key=lambda s: (s[0], int(s[1:])))
    out = {
        "lahde": LAHDE,
        "kierrokset": [{"id": ROUNDS[p][0], "nimi": ROUNDS[p][1]} for p in sorted(ROUNDS)],
        "pisteet": points,
        "havainnot": data,
    }
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
    sys.stdout.write("\n")

    for note in notes:
        print("TARKISTA:", note, file=sys.stderr)
    for round_ in out["kierrokset"]:
        print(f"{round_['nimi']}: {len(data[round_['id']])} havaintoa", file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
