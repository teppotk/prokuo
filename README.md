# prokuolimo.fi

Pro Kuolimo ry:n verkkosivusto: staattinen HTML, CSS ja JavaScript. Ei
palvelinkoodia, ei tietokantaa, ei käännösvaihetta ja ei ulkoisia
verkkopyyntöjä – kirjasimet, kuvat ja aineistot ovat sivuston mukana.

## Kehitys

Sivusto vaatii HTTP-palvelimen: ES-moduulit ja `fetch()` eivät toimi
`file://`-osoitteesta.

```bash
python3 -m http.server 8000     # avaa http://localhost:8000
```

## Tarkistukset

```bash
python3 tools/check-links.py                # sisäiset linkit ja kuvat
python3 tools/check-links.py --ulkoiset     # myös PDF-linkit prokuolimo.fi:hin
```

## Kuvien uudelleenrakennus

Alkuperäiset kuvat ovat `media-source/`-hakemistossa, julkaistavat versiot
`assets/img/`-hakemistossa. Valmiit `.webp`-tiedostot kuuluvat
versionhallintaan, jotta sivusto toimii ilman työkaluja.

```bash
./tools/build-images.sh          # vaatii ImageMagickin
```

## Aineistotiedostot

Kaikki yhdistyksen julkaisemat raportit, suunnitelmat, ohjeet ja esitykset
ovat `aineistot/`-hakemistossa – 73 tiedostoa, noin 140 MB. Ne on kopioitu
muuttamattomina vanhalta WordPress-sivustolta, ja tiedostonimet on muunnettu
ASCII-muotoon (ä → a, ö → o), jotta osoitteissa ei tarvita
prosenttikoodausta. Sivusto ei siis ole enää millään tavalla riippuvainen
vanhasta WordPressistä.

Uuden aineiston lisääminen: kopioi tiedosto `aineistot/`-hakemistoon
pienaakkosin ja väliviivoin nimettynä, lisää rivi `data/aineistot.json`-
tiedostoon ja aja `python3 tools/check-links.py`.

## Näkösyvyysaineiston päivitys

`data/nakosyvyys.json` on koottu mittausraportista
`aineistot/2025-11-19-pro-kuolimo-nakosyvyysmittaustulokset.pdf`.
Kun uusi raportti julkaistaan:

```bash
python3 tools/extract-nakosyvyys.py aineistot/uusi-raportti.pdf > data/nakosyvyys.json
```

Skripti tulostaa stderr-virtaan kaikki kohdat, joita se ei osannut lukea
yksikäsitteisesti. Tarkista ne PDF:stä ennen julkaisua.

## Sisällön päivitys ilman koodia

| Mitä | Missä |
| --- | --- |
| Uutiset | `data/uutiset.json` |
| Aineistoluettelo | `data/aineistot.json` + tiedosto `aineistot/`-hakemistoon |
| Linkkilista | `data/linkit.json` |
| Näkösyvyystulokset | `data/nakosyvyys.json` |
| Hallitus ja yhteystiedot | `yhdistys.html` sekä `YHTEYS`-objekti `assets/js/site.js`:ssä |
| Navigaatio | `NAV`-taulukko `assets/js/site.js`:ssä |

## Julkaisu

Kopioi hakemiston sisältö palvelimen juureen. Mitään esiprosessointia ei
tarvita. Poikkeus: `media-source/` on työhakemisto (kuvien alkuperäiset), jota
ei tarvitse julkaista – `aineistot/` sen sijaan on julkaistavaa sisältöä.

Kaikki linkit ovat suhteellisia, joten sivusto toimii myös alihakemistossa.
Absoluuttisia `https://prokuolimo.fi/`-osoitteita on vain `canonical`- ja
`og:`-tageissa sekä `sitemap.xml`-tiedostossa; ne on tarkoitettu lopulliselle
julkaisuosoitteelle.
