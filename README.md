# prokuolimo.fi

Pro Kuolimo ry:n verkkosivusto: staattinen HTML, CSS ja JavaScript. Ei
palvelinkoodia, ei tietokantaa eikä käännösvaihetta – kirjasimet, kuvat ja
aineistot ovat sivuston mukana.

Ainoa poikkeus ulkoisiin verkkopyyntöihin ovat karttasivut `kartta.html` ja
`kirjaa.html`, jotka hakevat karttalaatat OpenStreetMapista. Muut sivut
toimivat edelleen kokonaan ilman verkkoa.

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

## Kartta ja mittausten kirjaus

`kartta.html` näyttää mittaustulokset kartalla aikajanan kanssa. `kirjaa.html`
on mittaajien työkalu, jolla näkösyvyysmittauksen voi kirjata maastossa. Se on
testausvaiheen ajan päävalikossa, jotta testaajat löytävät sen. `noindex` ja
`robots.txt`-esto ovat yhä paikallaan, mutta ne pitävät loitolla vain
hakukoneet – sivu on käytännössä julkinen.

**Tunnuslukua ei toistaiseksi kysytä:** portti aukeaa millä tahansa
syötteellä, myös tyhjällä. Käyttöönotto on `TUNNUS_KAYTOSSA = true`
tiedostossa `assets/js/kirjaa.js`; palauta samalla kentän `required`-määre ja
portin tekstit `kirjaa.html`:ssä. Tunnusluku on tallessa (`kuolimo2026`), ja
uuden saa laskettua selaimen konsolissa komennolla
`prokuolimoTiiviste("uusi tunnus")`.

Tunnusluku ei olisi tietoturvaa vaan este satunnaiselle kävijälle – sivusto on
staattinen, joten palvelinpuolen tarkistusta ei ole. Nyt kun sitäkään ei ole,
sivu on auki kaikille jotka tietävät osoitteen.

Kirjaukset tallentuvat toistaiseksi vain selaimen `localStorage`-muistiin ja
viedään sieltä JSON- tai CSV-tiedostona. Tietokantatallennus on avoin asia.

Leaflet on kopioitu repoon (`assets/vendor/leaflet/`, BSD-2) kirjasimien
tapaan. Offline-käyttöä varten `kirjaa-sw.js` pitää sivun osat ja jo katsotut
karttalaatat välimuistissa; kasvata sen `VERSIO`-vakiota, kun kirjaussivun
tiedostoja muutetaan.

## Mittauspisteiden sijainnit

`data/mittauspisteet.json` on johdettu mittausraportin karttakalvoilta:

```bash
python3 tools/johda-pistesijainnit.py aineistot/uusi-raportti.pdf > data/mittauspisteet.json
```

Sijainnit ovat **arvioita** noin kilometrin tarkkuudella – raportissa ei ole
koordinaatteja, vaan pisteiden paikka on luettu kartan sijaintimerkeistä ja
kohdistettu koordinaatistoon pisteiden paikannimien avulla. Mittaajat
tarkentavat sijainteja kirjaussivulla, joten älä yliaja korjattuja arvoja
ajamalla työkalua uudelleen – tarkista aina diff.

## Sisällön päivitys ilman koodia

| Mitä | Missä |
| --- | --- |
| Uutiset | `data/uutiset.json` |
| Aineistoluettelo | `data/aineistot.json` + tiedosto `aineistot/`-hakemistoon |
| Linkkilista | `data/linkit.json` |
| Näkösyvyystulokset | `data/nakosyvyys.json` |
| Mittauspisteiden sijainnit | `data/mittauspisteet.json` |
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
