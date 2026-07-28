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

## Näkösyvyysaineiston päivitys

`data/nakosyvyys.json` on koottu mittausraportista, jonka kopio on
`lahteet/`-hakemistossa. Kun uusi raportti julkaistaan:

```bash
python3 tools/extract-nakosyvyys.py lahteet/uusi-raportti.pdf > data/nakosyvyys.json
```

Skripti tulostaa stderr-virtaan kaikki kohdat, joita se ei osannut lukea
yksikäsitteisesti. Tarkista ne PDF:stä ennen julkaisua.

## Sisällön päivitys ilman koodia

| Mitä | Missä |
| --- | --- |
| Uutiset | `data/uutiset.json` |
| Aineistoluettelo | `data/aineistot.json` |
| Linkkilista | `data/linkit.json` |
| Näkösyvyystulokset | `data/nakosyvyys.json` |
| Hallitus ja yhteystiedot | `yhdistys.html` sekä `YHTEYS`-objekti `assets/js/site.js`:ssä |
| Navigaatio | `NAV`-taulukko `assets/js/site.js`:ssä |

## Julkaisu

Kopioi hakemiston sisältö palvelimen juureen. Mitään esiprosessointia ei
tarvita. Poikkeus: `media-source/` ja `lahteet/` ovat työhakemistoja, joita
ei tarvitse julkaista.

Aineistolinkit osoittavat nykyisen WordPress-sivuston
`wp-content/uploads/`-hakemistoon. Jos WordPress puretaan, siirrä tiedostot
ja päivitä osoitteet `data/aineistot.json`- ja `data/uutiset.json`-tiedostoihin.
