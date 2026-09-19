#!/usr/bin/env python3
"""Purkaa Pro Kuolimon logon mittausohjeen PDF:stä sivustolle sopivaksi kuvaksi.

Käyttö projektin juuresta:
    python3 tools/pura-logo.py

Vaatii poppler-työkalun `pdfimages`, Pillow-kirjaston ja ImageMagickin
(`magick`) palettimuunnokseen.

MISTÄ LOGO TULEE
----------------
Yhdistyksellä ei ole erillistä logotiedostoa repossa. Logo on upotettuna
mittausohjeen PDF:ään, jossa se toistuu jokaisen sivun ylätunnisteessa
(377 x 106 pikseliä, kohdeobjekti 14). Sama kuva on myös vuoden 2024
ohjeversiossa, eli se on vakiintunut.

MITÄ TEHDÄÄN
------------
Logo on onneksi vain kahta tasaista väriä valkoisella pohjalla:

    teksti  #222222
    aallot  #2E91C9

Siksi reunojen pehmennys voidaan purkaa takaisin läpinäkyvyydeksi sen sijaan
että kuvaan jäisi valkoinen laatta. Jokainen pikseli on sekoitus väristä C ja
valkoisesta: p = a*C + (1-a)*255, joten peitto saadaan takaisin kaavalla
a = (255 - p) / (255 - C). Pikseli luetaan aalloksi, jos sinisyys ylittää
punaisen selvästi, muuten tekstiksi.

Sivusto on vain tumma, joten tekstin väri käännetään vaaleaksi (--ink).
Aaltojen sininen on yhdistyksen tunnusväri, eikä sitä muuteta. Lopputulos on
sama piirros käännettynä tummalle pohjalle, ei uudelleen piirretty logo.

Paperille tehdään toinen versio alkuperäisellä tummalla tekstillä: tulostus
käyttää vaaleaa pohjaa, jolla vaalea teksti katoaisi kokonaan.

Kuva suurennetaan kaksinkertaiseksi ja peittokanava kiristetään, jotta reunat
pysyvät terävinä myös tarkoilla näytöillä. Alkuperäinen 377 pikseliä riittäisi
vain noin 190 pikselin leveydelle.

Tallennusmuoto on PNG8 eikä webp, vastoin muun kuvamateriaalin käytäntöä.
Kahden tasaisen värin kuva palettiutuu erittäin hyvin: PNG8 on 12,7 kt, kun
häviötön webp on 64 kt ja häviöllinen webp sotkee tasaiset reunat.
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image

LAHDE_PDF = "aineistot/2025-11-19-nakosyvyysmittausten-ohjeistus.pdf"
KOHDE = "assets/img/pro-kuolimo-logo.png"
KOHDE_PAPERI = "assets/img/pro-kuolimo-logo-paperi.png"

TEKSTI = (34, 34, 34)
AALTO = (46, 145, 201)

# Tekstin väri tummalla pohjalla: sama kuin --ink site.css:ssä.
TEKSTI_VAALEA = (232, 236, 231)

SUURENNUS = 2
ODOTETTU_KOKO = (377, 106)


def peitto(arvo, vari_kanava):
    """Purkaa valkoiseen sekoitetun pikselin peiton takaisin."""
    if vari_kanava >= 255:
        return 0.0
    return max(0.0, min(1.0, (255 - arvo) / (255 - vari_kanava)))


def main():
    if not os.path.exists(LAHDE_PDF):
        sys.exit(f"Lähdettä ei löydy: {LAHDE_PDF}")

    tmp = tempfile.mkdtemp()
    subprocess.run(
        ["pdfimages", "-f", "1", "-l", "1", "-png", LAHDE_PDF, os.path.join(tmp, "logo")],
        check=True,
    )
    poimitut = sorted(f for f in os.listdir(tmp) if f.endswith(".png"))
    if not poimitut:
        sys.exit("PDF:n ensimmäiseltä sivulta ei löytynyt kuvia.")

    kuva = Image.open(os.path.join(tmp, poimitut[0])).convert("RGB")
    if kuva.size != ODOTETTU_KOKO:
        print(
            f"huom. odotettu koko {ODOTETTU_KOKO}, saatiin {kuva.size} – "
            "tarkista että PDF:n ylätunniste ei ole vaihtunut",
            file=sys.stderr,
        )

    leveys, korkeus = kuva.size
    lahde = kuva.load()

    def rakenna(tekstin_vari):
        ulos = Image.new("RGBA", kuva.size, (0, 0, 0, 0))
        kohde = ulos.load()
        for y in range(korkeus):
            for x in range(leveys):
                r, g, b = lahde[x, y]
                if b - r > 12:
                    kohde[x, y] = AALTO + (round(peitto(r, AALTO[0]) * 255),)
                else:
                    kohde[x, y] = tekstin_vari + (round(peitto(r, TEKSTI[0]) * 255),)

        iso = ulos.resize((leveys * SUURENNUS, korkeus * SUURENNUS), Image.LANCZOS)
        # Suurennus pehmentää reunat. Peittokanava kiristetään takaisin, jotta
        # kirjainten reunat ovat teräviä eivätkä sumeita.
        r, g, b, a = iso.split()
        a = a.point(lambda v: 0 if v < 40 else (255 if v > 215 else round((v - 40) * 255 / 175)))
        return Image.merge("RGBA", (r, g, b, a))

    os.makedirs(os.path.dirname(KOHDE), exist_ok=True)
    for polku, vari, nimi in (
        (KOHDE, TEKSTI_VAALEA, "näytölle"),
        (KOHDE_PAPERI, TEKSTI, "paperille"),
    ):
        iso = rakenna(vari)
        png = os.path.join(tmp, os.path.basename(polku))
        iso.save(png)
        subprocess.run(["magick", png, "-strip", f"PNG8:{polku}"], check=True)
        print(f"{polku} ({nimi}): {iso.size[0]} x {iso.size[1]} px, "
              f"{os.path.getsize(polku) / 1024:.1f} kt", file=sys.stderr)


if __name__ == "__main__":
    main()
