/**
 * Kirjaussivun offline-välimuisti.
 *
 * Kirjaus tehdään veneessä, jossa verkko on usein katvessa. Tämä service
 * worker pitää kirjaussivun osat ja jo kerran katsotut karttalaatat muistissa,
 * jotta sivu aukeaa ja kartta näkyy myös ilman yhteyttä.
 *
 * Rajaus on tarkoituksellisen kapea: käsitellään vain kirjaussivun omat
 * tiedostot ja karttalaatat. Kaikki muu menee suoraan verkkoon, jottei tämä
 * vaikuta sivuston varsinaisiin sivuihin.
 *
 * Strategia on verkko ensin, välimuisti varalle. Välimuisti ensin olisi
 * nopeampi, mutta runkoon kuuluu myös koko sivuston yhteisiä tiedostoja
 * (site.css, site.js): jos ne tarjottaisiin välimuistista, unohtunut
 * VERSIO-päivitys jäädyttäisi sivuston ulkoasun kaikilla, jotka ovat käyneet
 * kirjaussivulla. Verkko ensin ei voi vanhentua, ja katveessa fetch kaatuu
 * heti, joten varalle jäävä välimuisti vastaa käytännössä yhtä nopeasti.
 *
 * Kun kirjaussivun tiedostoja muutetaan, kasvata silti VERSIO, jotta vanhat
 * välimuistit siivoutuvat. Vanhat poistetaan aktivoinnin yhteydessä.
 */
const VERSIO = "kirjaa-v3";
const SIVU = `${VERSIO}-sivu`;
const LAATAT = `${VERSIO}-laatat`;

// Laattoja kertyy nopeasti; pidetään määrä kurissa.
const LAATTA_KATTO = 600;

const RUNKO = [
  "kirjaa.html",
  "assets/css/site.css",
  "assets/js/site.js",
  "assets/js/kirjaa.js",
  "assets/js/kartta-apu.js",
  "assets/js/luokat.js",
  "assets/vendor/leaflet/leaflet.js",
  "assets/vendor/leaflet/leaflet.css",
  "assets/fonts/archivo-var-latin.woff2",
  "assets/fonts/fraunces-var-latin.woff2",
  "assets/fonts/plexmono-400-latin.woff2",
  "assets/fonts/plexmono-500-latin.woff2",
  "data/mittauspisteet.json",
  "assets/favicon.svg",
];

const juuri = new URL("./", self.location).href;
const runkoUrlit = RUNKO.map((polku) => new URL(polku, juuri).href);

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(SIVU)
      // addAll kaatuisi kokonaan yhteen puuttuvaan tiedostoon, joten haetaan
      // osat erikseen: puuttuva kirjasin ei saa estää offline-tilaa.
      .then((cache) =>
        Promise.all(
          runkoUrlit.map((url) => cache.add(url).catch(() => null))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((nimet) =>
        Promise.all(
          nimet
            .filter((n) => n.startsWith("kirjaa-") && !n.startsWith(VERSIO))
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Kertoo, saako vastauksen tallentaa. Tarkistus on tarpeen, koska OpenStreetMap
 * vastaa estettyyn pyyntöön HTTP 200:lla ja "Access blocked" -kuvalla, ei
 * virhekoodilla. Ilman tätä estolaatat jäisivät välimuistiin pysyvästi, vaikka
 * eston syy korjattaisiin. Estovastaus kantaa otsakkeen Cache-Control: no-cache,
 * ja Cache-Control on niitä harvoja otsakkeita, jotka näkyvät myös
 * CORS-vastauksesta – x-blocked ei näkyisi.
 */
function saaTallentaa(vastaus) {
  const ohje = vastaus.headers.get("cache-control") || "";
  return !/\bno-store\b|\bno-cache\b/i.test(ohje);
}

/** Siivoaa laattavälimuistin vanhimmasta päästä, kun katto ylittyy. */
async function rajoita(cache) {
  const avaimet = await cache.keys();
  if (avaimet.length <= LAATTA_KATTO) return;
  for (const avain of avaimet.slice(0, avaimet.length - LAATTA_KATTO)) {
    await cache.delete(avain);
  }
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Karttalaatat: verkko ensin, välimuisti varalle.
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith(
      fetch(request)
        .then(async (vastaus) => {
          if (vastaus.ok && saaTallentaa(vastaus)) {
            const cache = await caches.open(LAATAT);
            await cache.put(request, vastaus.clone());
            rajoita(cache);
          }
          return vastaus;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Kirjaussivun osat: verkko ensin, välimuisti varalle katvealueella.
  const ilmanKyselya = url.origin + url.pathname;
  if (runkoUrlit.includes(ilmanKyselya)) {
    e.respondWith(
      fetch(request)
        .then(async (vastaus) => {
          if (vastaus.ok && saaTallentaa(vastaus)) {
            const cache = await caches.open(SIVU);
            await cache.put(ilmanKyselya, vastaus.clone());
          }
          return vastaus;
        })
        .catch(async () => {
          const osuma = await caches.match(ilmanKyselya);
          if (osuma) return osuma;
          throw new Error(`Ei verkkoa eikä välimuistia: ${ilmanKyselya}`);
        })
    );
  }
});
