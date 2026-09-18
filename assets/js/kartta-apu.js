/**
 * Karttasivujen yhteiset osat (kartta.html ja kirjaa.html).
 *
 * Kartta on Leaflet ja taustalaatat OpenStreetMapista. Nämä ovat sivuston
 * AINOAT ulkoiset verkkopyynnöt, ja ne on rajattu näille kahdelle sivulle:
 * muut sivut toimivat edelleen kokonaan ilman verkkoa. Leaflet itse on
 * kopioitu repoon (assets/vendor/leaflet), kuten kirjasimetkin.
 *
 * Merkit piirretään divIcon-elementteinä eikä Leafletin omina ympyröinä,
 * jotta värit tulevat site.css:n --b1…--b6-sarjasta. Näin tumma tila toimii
 * automaattisesti ja lukema näkyy värin päällä – tieto ei ole värin varassa.
 */
import { esc, fiNum } from "./site.js";
import { binOf } from "./luokat.js";

/** Kuolimon ja sen valuma-alueen rajaus: kartta ei lähde harhailemaan. */
export const KUOLIMO = { lat: 61.3, lon: 27.7 };
export const RAJAUS = [
  [61.05, 27.05],
  [61.52, 28.1],
];

const LAATAT = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const LAATTA_TEKIJAT =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-tekijät';

/**
 * Luo kartan annettuun elementtiin. Palauttaa Leaflet-karttaolion.
 * Jos Leaflet ei ole latautunut, palauttaa null ja kirjoittaa syyn
 * elementtiin, jotta sivu ei jää tyhjäksi.
 */
export function luoKartta(el, asetukset = {}) {
  if (typeof L === "undefined") {
    el.innerHTML =
      '<p class="status">Karttakirjastoa ei saatu ladattua. ' +
      "Mittaustulokset ovat silti luettavissa taulukkona.</p>";
    return null;
  }

  const kartta = L.map(el, {
    center: [KUOLIMO.lat, KUOLIMO.lon],
    zoom: 10,
    maxBounds: RAJAUS,
    maxBoundsViscosity: 0.6,
    zoomControl: true,
    // Kahden sormen vieritys estäisi sivun selaamisen puhelimella.
    scrollWheelZoom: asetukset.scrollWheelZoom ?? false,
    tap: false,
  });

  L.tileLayer(LAATAT, {
    minZoom: 8,
    maxZoom: 17,
    attribution: LAATTA_TEKIJAT,
    crossOrigin: true,
  }).addTo(kartta);

  return kartta;
}

/**
 * Mittauspisteen merkki. Arvo näytetään merkin sisällä; jos arvoa ei ole,
 * merkki jää tyhjäksi renkaaksi (puuttuva mittaus ei ole nolla).
 */
export function pisteMerkki(piste, arvo, lisaluokat = "") {
  const luokat = ["pin", lisaluokat].filter(Boolean).join(" ");
  const bin = arvo == null ? "" : ` data-bin="${binOf(arvo)}"`;
  const teksti = arvo == null ? "" : fiNum(arvo);
  const tyhja = arvo == null ? " pin--tyhja" : "";
  return L.divIcon({
    className: "",
    html: `<span class="${luokat}${tyhja}"${bin}><b>${esc(teksti)}</b><i>${esc(
      piste.id
    )}</i></span>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -18],
  });
}

/** Pisteen nimi ihmisluettavassa muodossa: "A1 – Torvisaari läntinen". */
export function pisteenNimi(piste) {
  return piste.nimi ? `${piste.id} – ${piste.nimi}` : piste.id;
}

/** Koordinaatti kirjattavassa muodossa: 61,26005 N 27,81319 E. */
export function koordinaatti(lat, lon) {
  return `${fiNum(lat, 5)} N, ${fiNum(lon, 5)} E`;
}

/** Etäisyys metreinä kahden koordinaatin välillä (haversine, riittävä tähän). */
export function etaisyys(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Lähin mittauspiste annetusta sijainnista, tai null jos pisteitä ei ole. */
export function lahinPiste(pisteet, lat, lon) {
  let paras = null;
  for (const p of pisteet) {
    const d = etaisyys(lat, lon, p.lat, p.lon);
    if (!paras || d < paras.etaisyys) paras = { piste: p, etaisyys: d };
  }
  return paras;
}
