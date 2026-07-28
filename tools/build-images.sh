#!/usr/bin/env bash
# Kuvien optimointi: media-source/*.jpg  ->  assets/img/<nimi>-{1600,1000,600}.webp
#
# Aja projektin juuresta:  ./tools/build-images.sh
# Vaatii ImageMagickin (magick). Ajetaan käsin vain kun media-source muuttuu;
# valmiit .webp-tiedostot ovat versionhallinnassa, joten sivusto ei tarvitse
# käännösvaihetta.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=media-source
OUT=assets/img
mkdir -p "$OUT"

# nimi <- lähdetiedosto [rajaus]
# Rajaus annetaan ImageMagickin -crop -muodossa (tyhjä = ei rajausta).
render() {
  local name="$1" file="$2" crop="${3:-}"
  local w
  for w in 1600 1000 600; do
    if [ -n "$crop" ]; then
      magick "$SRC/$file" -auto-orient -crop "$crop" +repage \
        -resize "${w}x>" -strip -quality 80 "$OUT/$name-$w.webp"
    else
      magick "$SRC/$file" -auto-orient \
        -resize "${w}x>" -strip -quality 80 "$OUT/$name-$w.webp"
    fi
    printf '  %s\n' "$OUT/$name-$w.webp"
  done
}

echo "Rakennetaan kuvat..."
render puro-talvi          "Lahtelan-kosteikko1.jpg"
render kuolimo-ranta       "DSC_0235.jpg"
render kosteikko-valmis    "Kapakojan-kosteikko.jpg"
render kosteikko-tyomaa    "DSC_0284-1.jpg"
render vesinayte           "Kapakkojan-kosteikon-puhdas-purkuvesi.jpg"
render maastoretki         "Lahtelan-kosteikolla-21.jpg"
render opastetaulu         "DSC_0416.jpg"
# Alkuperäisessä kuvassa on kuvatekstipalkki alalaidassa -> rajataan pois.
render saimaannieria       "Nieriä-kutuasussa.jpg"            "549x315+0+0"
render kalastusrajoitukset "Kalastusrajoitusalue-kartta.jpg"

# Avauskuva sosiaaliseen mediaan (1200x630).
magick "$SRC/Lahtelan-kosteikko1.jpg" -auto-orient -resize 1200x630^ \
  -gravity center -extent 1200x630 -strip -quality 82 "$OUT/og-kuva.jpg"
printf '  %s\n' "$OUT/og-kuva.jpg"

echo "Valmis."
