#!/usr/bin/env python3
"""Johtaa näkösyvyysmittauspisteiden sijainnit raportin karttakalvoilta.

Käyttö projektin juuresta:
    python3 tools/johda-pistesijainnit.py raportti.pdf > data/mittauspisteet.json

Vaatii poppler-työkalut (`pdftoppm`, `pdftotext`) ja Pillow-kirjaston.

MIKSI TÄMÄ ON TARPEEN
---------------------
Raportissa ei ole pisteiden koordinaatteja missään muodossa. Kalvoilla on
taustakarttakuva, jonka päälle on ladottu jokaiselle pisteelle oranssi
sijaintimerkki ja värillinen laatikko, jossa lukee pistetunnus ja mitattu
arvo. Merkin paikka kuvassa on ainoa tieto pisteen sijainnista.

MITEN
-----
1. Kalvot 3–9 renderöidään 200 dpi:n kuviksi.
2. Kuvista etsitään värilliset laatikot (syaani/keltainen/pinkki täyttö) ja
   oranssit sijaintimerkit yhtenäisinä värialueina.
3. Pistetunnus luetaan PDF:n tekstikerroksesta ja liitetään laatikkoon, jonka
   sisällä tunnus on. Laatikko liitetään lähimpään vapaaseen merkkiin
   (etäisyys mitataan laatikon reunasta) ahneella globaalilla parituksella.
4. Sama piste esiintyy usealla kalvolla. Tulokseksi otetaan mediaani, jolloin
   yksittäisen kalvon virhepari ei siirrä pistettä.
5. Kuvapikselit muunnetaan koordinaateiksi alla kuvatulla kohdistuksella.

KOHDISTUS KARTTAKUVASTA KOORDINAATEIKSI
---------------------------------------
Taustakartta on upotettu kalvolle rasterina (794 × 559 px, 75 ppi sekä vaaka-
että pystysuunnassa, eli venyttämättä) ja se on pohjoinen ylöspäin. Kartassa ei
ole koordinaattiruudukkoa eikä mittakaavajanaa, joten kohdistus on sovitettu.

Vertailuaineistona ovat mittauspisteiden omat nimet. Raportin selitetaulukko
antaa jokaiselle pisteelle paikannimen ("Kinkosalmi luode", "Kiesilänjoen suu",
"Vieruvanjärvi"…), ja nämä nimet löytyvät OpenStreetMapista. Nimille haettiin
koordinaatit Nominatim-palvelusta kertaluonteisesti, ja niitä verrattiin
saman pisteen sijaintimerkkiin kalvolla.

Sovitus on pienimmän neliösumman similariteetti, jossa on kolme vapausastetta
(mittakaava ja siirtymä kahteen suuntaan) – kierrosta ei sallita, koska kartta
on pohjoinen ylöspäin. Selvät poikkeamat karsittiin yksi kerrallaan: nimi voi
osua OSM:ssä samannimiseen mutta eri kohteeseen (esim. Kaijanlahti löytyy
kahdesta paikasta), ja järven nimi osoittaa järven keskelle eikä siihen
kohtaan, jossa mittaus tehdään.

Jäljelle jäi VERTAILUPISTEET-taulukon 9 pistettä. Niiden jäännösvirheiden
neliökeskiarvo on noin 0,6 km ja suurin noin 1,0 km. Suuruusluokka vastaa sitä,
että vertailukohde on nimen paikka kartalla eikä mittausvene.

TULOKSEN TARKKUUS
-----------------
Sijainnit ovat ARVIOITA, tyypillisesti 0,5–1 km:n päässä oikeasta. Kartan
pohjoisosassa (Suomenniemen pisteet E1–E3) ei ole vertailupisteitä, joten siellä
sovitus on ekstrapolaatiota ja virhe voi olla suurempi.

Tarkkuus riittää kartan lähtötilanteeksi, mutta ei mittauspaikan tunnistamiseen
maastossa. Jokainen piste kantaa siksi kentän "tarkkuus": "arvio". Kun mittaaja korjaa pisteen kirjaussivulla
(kirjaa.html), korjattu sijainti tulee mukaan vientiin ja sen tarkkuus on
"mitattu". Korjattuja arvoja EI saa yliajaa ajamalla tämä työkalu uudelleen –
tarkista aina diff.

Jos pistelista muuttuu, päivitä NIMET-taulukko: se on käsin luettu raportin
sivun 3 selitetaulukosta, joka on PDF:ssä kuvana eikä tekstinä.
"""
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

from PIL import Image

NS = "{http://www.w3.org/1999/xhtml}"
DPI = 200
PT_PER_PX = DPI / 72.0

# Kalvot, joilla on karttakuva ja mittausmerkit.
KALVOT = range(3, 10)

# Kohdistus: kalvon pikseli (200 dpi) -> WGS84. Ks. moduulin alun kuvaus.
# VERTAILUPISTE on se kalvon pikseli, joka vastaa koordinaattia VERTAILU_WGS84.
METRIA_PER_PIKSELI = 25.1706
VERTAILUPISTE = (1515.24, 661.96)
VERTAILU_WGS84 = (61.28, 27.55)

# Sovituksessa käytetään vakioleveyttä, jotta muunnos on kääntyvä samoilla
# luvuilla kuin sovitus tehtiin.
ASTE_ITA = 111320.0 * math.cos(math.radians(VERTAILU_WGS84[0]))
ASTE_POHJOINEN = 111320.0

# Sovitukseen jääneet vertailupisteet: piste -> (lat, lon) OpenStreetMapista.
# Nämä ovat dokumentaatiota ja tarkistusta varten; muunnos on jo sovitettu.
VERTAILUPISTEET = {
    "A1": (61.2333788, 27.6351674),  # Torvisaari, Savitaipale
    "A2": (61.2455664, 27.5641366),  # Kuolimonsalmi, Savitaipale
    "A4": (61.2224044, 27.5578909),  # Kinkosalmi, Savitaipale
    "B1": (61.2136531, 27.6316876),  # Pappilanlahti, Savitaipale
    "C1": (61.2683027, 27.4025199),  # Kiesilänjoki, Suomenniemi
    "F2": (61.2480650, 27.6580591),  # Tupasaari, Savitaipale
    "H3": (61.1490820, 27.3125609),  # Rautjärvi, Savitaipale
    "H6": (61.2300377, 27.3138155),  # Kukasjärvi, Suomenniemi
    "H7": (61.1925167, 27.3537773),  # Vieruvanjärvi, Mäntyharju
}

# Laatikoiden täyttövärit ja sijaintimerkin väri renderöidyssä kuvassa.
LAATIKKO = {(0, 255, 255), (255, 255, 0), (255, 102, 153)}
LAATIKKO_MIN_PX = 1200
MERKKI_MIN_PX = 300
MAKS_ETAISYYS_PX = 90

TUNNUS = re.compile(r"^([A-J])[.]?(\d)[.]?$")

# Tekstinpoiminnassa vääristyneet tunnukset, tarkistettu käsin kalvoilta.
ALIAS = {"HH": "H8", "H.": "H1", "14": "A4", ".H3": "H3", "B.3": "B3"}

# Alueiden ja pisteiden nimet on luettu raportin sivun 3 selitetaulukosta.
# Taulukko on kalvolla kuvana, joten sitä ei voi poimia tekstikerroksesta.
# Huom. taulukossa ei ole riviä pisteelle H7, vaikka piste on kartalla ja
# sille on mittaustuloksia; sen nimi jää siksi tyhjäksi.
ALUEET = {
    "A": "Isoselkä",
    "B": "Pappilanlahti–Kaijanlahti",
    "C": "Kirvesselkä",
    "D": "Morovanselkä",
    "E": "Suomenniemi",
    "F": "Pylkönselkä–Kärnäkoski",
    "G": "Parranselkä–Partakoski",
    "H": "Kiesilänjoen valuma-alue",
    "J": "Uuhijoen valuma-alue",
}

NIMET = {
    "A1": "Torvisaari läntinen",
    "A2": "Kuolimonsalmen suu",
    "A3": "Pyhä Paula (puhdistamon suu)",
    "A4": "Kinkosalmi luode",
    "B1": "Leinvihko länsi",
    "B2": "Uuhijoen suu (uusi)",
    "B3": "Kaijanlahti – pohjoinen",
    "B4": "Kaijanlahti – etelä",
    "C1": "Kiesilänjoen suu",
    "C2": "Kirvessalmi",
    "D1": "Morovanselkä eteläinen",
    "D2": "Morovanselkä pohjoinen",
    "E1": "Puhdistamon suu",
    "E2": "Kuhalahti",
    "E3": "Muuriaissaari etelä",
    "F1": "Kärnäkosken suu",
    "F2": "Tupasaari itä",
    "G1": "Orrain suu",
    "G2": "Partakosken reitti",
    "H1": "Korpijärvi itä – Sulunlahti länsi",
    "H2": "Korpijärvi länsi – Sääskisaari länsi",
    "H3": "Rautjärvi – Kuuponniemi pohjoinen",
    "H4": "Virmajärvi – Haudanselkä lounas",
    "H5": "Virmajärvi – Kuljunselkä lounas",
    "H6": "Kukasjärvi – Vääräsaari etelä",
    "H7": "",
    "H8": "Säänjärvi – Hujasenvuori",
    "H9": "Säänjärvi – Hujasensaari etelä",
    "J1": "Säynjärvi – Suurensaarenselkä",
    "J2": "Säynjärvi – Hiidenlahti",
}

LAHDE = {
    "nimi": "Pro Kuolimo – näkösyvyysmittaustulokset 19.11.2025",
    "url": "aineistot/2025-11-19-pro-kuolimo-nakosyvyysmittaustulokset.pdf",
}


def alueet(kuva, sopii, min_px):
    """Etsii yhtenäiset värialueet. Palauttaa (x0, y0, x1, y1, painopiste)."""
    leveys, korkeus = kuva.size
    px = kuva.load()
    nahty = set()
    tulos = []
    for y in range(korkeus):
        for x in range(leveys):
            if (x, y) in nahty or not sopii(px[x, y]):
                continue
            pino = [(x, y)]
            nahty.add((x, y))
            osat = []
            while pino:
                cx, cy = pino.pop()
                osat.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if (
                        0 <= nx < leveys
                        and 0 <= ny < korkeus
                        and (nx, ny) not in nahty
                        and sopii(px[nx, ny])
                    ):
                        nahty.add((nx, ny))
                        pino.append((nx, ny))
            if len(osat) >= min_px:
                xs = [p[0] for p in osat]
                ys = [p[1] for p in osat]
                tulos.append(
                    (min(xs), min(ys), max(xs), max(ys),
                     sum(xs) / len(osat), sum(ys) / len(osat))
                )
    return tulos


def on_merkki(vari):
    r, g, b = vari
    return r > 235 and 165 < g < 215 and b < 60


def tunnukset(sivu_el):
    """Pistetunnukset ja niiden keskipisteet renderöinnin pikseleinä."""
    tulos = []
    for w in sivu_el.iter(NS + "word"):
        teksti = (w.text or "").strip()
        nimi = ALIAS.get(teksti) or (teksti.replace(".", "") if TUNNUS.match(teksti) else None)
        if nimi and TUNNUS.match(nimi):
            x = (float(w.get("xMin")) + float(w.get("xMax"))) / 2 * PT_PER_PX
            y = (float(w.get("yMin")) + float(w.get("yMax"))) / 2 * PT_PER_PX
            tulos.append((nimi, x, y))
    return tulos


def mediaani(arvot):
    j = sorted(arvot)
    k = len(j) // 2
    return j[k] if len(j) % 2 else (j[k - 1] + j[k]) / 2


def wgs84(sivu_x, sivu_y):
    """Renderöinnin pikselit -> (lat, lon). Kartta on pohjoinen ylöspäin."""
    pohjoinen = (VERTAILUPISTE[1] - sivu_y) * METRIA_PER_PIKSELI
    ita = (sivu_x - VERTAILUPISTE[0]) * METRIA_PER_PIKSELI
    return (VERTAILU_WGS84[0] + pohjoinen / ASTE_POHJOINEN,
            VERTAILU_WGS84[1] + ita / ASTE_ITA)


def tarkista_vertailupisteet(pisteet):
    """Tulostaa jäännösvirheet, jotta kohdistuksen laatu näkyy joka ajolla."""
    virheet = []
    for p in pisteet:
        odotettu = VERTAILUPISTEET.get(p["id"])
        if not odotettu:
            continue
        dpohj = (p["lat"] - odotettu[0]) * ASTE_POHJOINEN
        dita = (p["lon"] - odotettu[1]) * ASTE_ITA
        virheet.append((math.hypot(dpohj, dita), p["id"]))
    if not virheet:
        return
    rms = math.sqrt(sum(v * v for v, _ in virheet) / len(virheet))
    suurin = max(virheet)
    print(
        f"kohdistuksen jäännösvirhe: RMS {rms:.0f} m, suurin {suurin[0]:.0f} m "
        f"({suurin[1]}), {len(virheet)} vertailupistettä",
        file=sys.stderr,
    )


def main(pdf):
    tmp = tempfile.mkdtemp()
    subprocess.run(
        ["pdftoppm", "-f", str(KALVOT[0]), "-l", str(KALVOT[-1]), "-r", str(DPI),
         "-png", pdf, os.path.join(tmp, "kalvo")],
        check=True,
    )
    xml = os.path.join(tmp, "teksti.xml")
    subprocess.run(["pdftotext", "-bbox-layout", pdf, xml], check=True)
    sivut = list(ET.parse(xml).getroot().iter(NS + "page"))

    kertyma = {}
    for kalvo in KALVOT:
        polku = os.path.join(tmp, f"kalvo-{kalvo}.png")
        kuva = Image.open(polku).convert("RGB")
        laatikot = alueet(kuva, lambda v: v in LAATIKKO, LAATIKKO_MIN_PX)
        merkit = alueet(kuva, on_merkki, MERKKI_MIN_PX)

        # Laatikko tunnistetaan sen sisällä olevasta pistetunnuksesta.
        nimetyt = {}
        for nimi, x, y in tunnukset(sivut[kalvo - 1]):
            for i, r in enumerate(laatikot):
                if r[0] - 6 <= x <= r[2] + 6 and r[1] - 6 <= y <= r[3] + 6:
                    nimetyt[i] = nimi
                    break

        parit = []
        for i, nimi in nimetyt.items():
            x0, y0, x1, y1, _, _ = laatikot[i]
            for j, (_, _, _, _, cx, cy) in enumerate(merkit):
                dx = max(x0 - cx, 0, cx - x1)
                dy = max(y0 - cy, 0, cy - y1)
                parit.append((math.hypot(dx, dy), nimi, j, cx, cy))
        parit.sort()

        varatut_nimet, varatut_merkit = set(), set()
        loydetyt = 0
        for etaisyys, nimi, j, cx, cy in parit:
            if etaisyys > MAKS_ETAISYYS_PX or nimi in varatut_nimet or j in varatut_merkit:
                continue
            varatut_nimet.add(nimi)
            varatut_merkit.add(j)
            kertyma.setdefault(nimi, []).append((cx, cy))
            loydetyt += 1

        puuttuu = sorted(set(nimetyt.values()) - varatut_nimet)
        print(f"kalvo {kalvo}: {loydetyt} paria", file=sys.stderr)
        if puuttuu:
            print(f"  ilman sijaintimerkkiä: {', '.join(puuttuu)}", file=sys.stderr)

    pisteet = []
    for nimi in sorted(kertyma, key=lambda n: (n[0], int(n[1:]))):
        havainnot = kertyma[nimi]
        mx = mediaani([p[0] for p in havainnot])
        my = mediaani([p[1] for p in havainnot])
        hajonta = max(math.hypot(x - mx, y - my) for x, y in havainnot)
        if hajonta > 15:
            print(
                f"  huom. {nimi}: kalvojen välinen hajonta {hajonta:.0f} px "
                f"(~{hajonta * METRIA_PER_PIKSELI:.0f} m)",
                file=sys.stderr,
            )
        lat, lon = wgs84(mx, my)
        pisteet.append(
            {
                "id": nimi,
                "alue": nimi[0],
                "alueen_nimi": ALUEET[nimi[0]],
                "nimi": NIMET.get(nimi, ""),
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "tarkkuus": "arvio",
                "kalvoja": len(havainnot),
            }
        )

    print(f"pisteitä yhteensä: {len(pisteet)}", file=sys.stderr)
    tarkista_vertailupisteet(pisteet)

    json.dump(
        {
            "lahde": LAHDE,
            "kohdistus": {
                "menetelma": "Raportin karttakuvan sijaintimerkit. Kuva on "
                             "kohdistettu koordinaatistoon sovittamalla se "
                             "mittauspisteiden paikannimien OpenStreetMap-"
                             "sijainteihin (pienin neliösumma, 9 vertailupistettä).",
                "vertailupisteita": len(VERTAILUPISTEET),
                "jaannosvirhe_rms_m": 610,
                "huomio": "Sijainnit ovat arvioita, tyypillisesti 0,5–1 km:n "
                          "päässä oikeasta. Korjaa maastossa kirjaussivulla.",
            },
            "pisteet": pisteet,
        },
        sys.stdout,
        ensure_ascii=False,
        indent=1,
    )
    print()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
