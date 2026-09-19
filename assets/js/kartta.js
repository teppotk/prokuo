/**
 * Näkösyvyyskartta ja aikajana (kartta.html).
 *
 * Yhdistää kaksi aineistoa: mittauspisteiden sijainnit
 * (data/mittauspisteet.json, johdettu raportin kartalta) ja mittaustulokset
 * (data/nakosyvyys.json, sama aineisto kuin rekisteritaulukossa). Kartta on
 * taulukon rinnakkaisesitys, ei sen korvaaja – rekisteritaulukko toimii
 * ilman verkkoa ja on edelleen ensisijainen lähde.
 *
 * Aikajana liikkuu mittauskierroksittain. Puuttuva mittaus piirretään
 * tyhjänä renkaana, ei nollana.
 */
import { esc, loadJSON, fiNum } from "./site.js";
import { BINS, binOf } from "./luokat.js";
import { luoKartta, pisteMerkki, pisteenNimi, koordinaatti } from "./kartta-apu.js";

const VAIHTOVALI_MS = 1400;

function mediaani(arvot) {
  const j = [...arvot].sort((a, b) => a - b);
  const k = Math.floor(j.length / 2);
  return j.length % 2 ? j[k] : (j[k - 1] + j[k]) / 2;
}

function selite() {
  return `<div class="scale">
    <span>Näkösyvyys, m</span>
    <span class="scale__steps">${BINS.map(
      (b) => `<span class="scale__step" data-bin="${b.bin}">${b.label}</span>`
    ).join("")}</span>
  </div>`;
}

/** Yhden pisteen koko aikasarja ponnahdusikkunaan. */
function aikasarja(data, piste) {
  const rivit = data.kierrokset
    .map((r) => {
      const v = data.havainnot[r.id][piste.id];
      if (v === undefined) {
        return `<li><span>${esc(r.nimi)}</span><em>ei mittausta</em></li>`;
      }
      return `<li><span>${esc(r.nimi)}</span>
        <b data-bin="${binOf(v)}">${fiNum(v)} m</b></li>`;
    })
    .join("");
  const tarkkuus =
    piste.tarkkuus === "arvio"
      ? `<p class="popup__note">Sijainti on arvio, joka on johdettu
         mittausraportin kartalta.</p>`
      : "";
  return `<div class="popup">
    <h3>${esc(pisteenNimi(piste))}</h3>
    <p class="popup__meta">${esc(piste.alueen_nimi)} ·
      <span class="num">${esc(koordinaatti(piste.lat, piste.lon))}</span></p>
    <ul class="popup__sarja">${rivit}</ul>
    ${tarkkuus}
  </div>`;
}

async function piirra(hook) {
  const status = hook.querySelector("[data-status]");
  const [pisteaineisto, data] = await Promise.all([
    loadJSON("data/mittauspisteet.json", status),
    loadJSON("data/nakosyvyys.json", status),
  ]);
  if (!pisteaineisto || !data) return;

  const pisteet = pisteaineisto.pisteet.filter((p) => p.lat != null && p.lon != null);

  hook.innerHTML = `
    <div class="kartta" data-kartta-el></div>
    <div class="aikajana">
      <button class="aikajana__nappi" type="button" data-edellinen
              aria-label="Edellinen kierros">←</button>
      <button class="aikajana__nappi aikajana__nappi--soita" type="button" data-soita
              aria-label="Selaa kierroksia">▶</button>
      <button class="aikajana__nappi" type="button" data-seuraava
              aria-label="Seuraava kierros">→</button>
      <label class="aikajana__liuku">
        <span class="visually-hidden">Mittauskierros</span>
        <input type="range" min="0" max="${data.kierrokset.length - 1}"
               step="1" value="${data.kierrokset.length - 1}" data-liuku>
      </label>
      <p class="aikajana__tila" data-tila aria-live="polite"></p>
    </div>
    ${selite()}
    <p class="note" data-kartta-huomio></p>`;

  const kartta = luoKartta(hook.querySelector("[data-kartta-el]"));
  if (!kartta) return;

  const liuku = hook.querySelector("[data-liuku]");
  const tila = hook.querySelector("[data-tila]");
  const huomio = hook.querySelector("[data-kartta-huomio]");

  const arviot = pisteet.filter((p) => p.tarkkuus === "arvio").length;
  huomio.innerHTML =
    `Kartalla ${pisteet.length} mittauspistettä. ` +
    (arviot
      ? `Sijainnit on johdettu <a href="${esc(pisteaineisto.lahde.url)}">mittausraportin
         kartalta</a> eivätkä ne ole mitattuja koordinaatteja: ${arviot} pisteen paikka on
         arvio noin kilometrin tarkkuudella. Mittaajat tarkentavat sijainteja maastossa.`
      : "");

  const merkit = new Map();
  for (const p of pisteet) {
    const m = L.marker([p.lat, p.lon], {
      icon: pisteMerkki(p, null),
      keyboard: true,
      alt: pisteenNimi(p),
    }).addTo(kartta);
    m.bindPopup(aikasarja(data, p), { maxWidth: 300 });
    merkit.set(p.id, m);
  }

  kartta.fitBounds(pisteet.map((p) => [p.lat, p.lon]), { padding: [30, 30] });

  function nayta(index) {
    const kierros = data.kierrokset[index];
    const havainnot = data.havainnot[kierros.id];
    for (const p of pisteet) {
      const arvo = havainnot[p.id];
      merkit.get(p.id).setIcon(pisteMerkki(p, arvo === undefined ? null : arvo));
    }
    const arvot = Object.values(havainnot);
    tila.innerHTML = `<b>${esc(kierros.nimi)}</b> · mediaani
      <span class="num">${fiNum(mediaani(arvot))}</span> m ·
      <span class="num">${arvot.length}</span> mittauspistettä`;
    liuku.setAttribute("aria-valuetext", kierros.nimi);
  }

  liuku.addEventListener("input", () => nayta(Number(liuku.value)));

  const siirra = (askel) => {
    const uusi = (Number(liuku.value) + askel + data.kierrokset.length) % data.kierrokset.length;
    liuku.value = String(uusi);
    nayta(uusi);
  };
  hook.querySelector("[data-edellinen]").addEventListener("click", () => siirra(-1));
  hook.querySelector("[data-seuraava]").addEventListener("click", () => siirra(1));

  // Selaus pysäytetään heti, jos käyttäjä koskee liukuun tai nuoliin.
  const soita = hook.querySelector("[data-soita]");
  let ajastin = null;
  const pysayta = () => {
    clearInterval(ajastin);
    ajastin = null;
    soita.textContent = "▶";
    soita.setAttribute("aria-label", "Selaa kierroksia");
  };
  soita.addEventListener("click", () => {
    if (ajastin) return pysayta();
    soita.textContent = "▮▮";
    soita.setAttribute("aria-label", "Pysäytä selaus");
    ajastin = setInterval(() => siirra(1), VAIHTOVALI_MS);
  });
  liuku.addEventListener("pointerdown", pysayta);
  hook.querySelector("[data-edellinen]").addEventListener("click", pysayta);
  hook.querySelector("[data-seuraava]").addEventListener("click", pysayta);

  nayta(data.kierrokset.length - 1);
}

/**
 * Kartta rakennetaan vasta kun osio on tulossa näkyviin.
 *
 * Karttalaatat ovat sivuston ainoat ulkoiset verkkopyynnöt. Näkösyvyyssivun
 * varsinainen sisältö – rekisteritaulukko ja pistekohtaiset kuvaajat – toimii
 * kokonaan ilman verkkoa, ja niin sen kuuluu toimia jatkossakin: sivu latautuu
 * pyytämättä mitään ulkopuolelta, ja vasta kun lukija vierittää kartan
 * kohdalle, laattoja haetaan. Omalla karttasivullaan osio on heti näkyvissä,
 * joten siellä tämä ei viivytä mitään.
 *
 * Tarkistus tehdään tavallisella vierityskuuntelijalla eikä
 * IntersectionObserverilla: yhdelle elementille se on yhtä tarkka, ja jos
 * ilmaisin ei jostain syystä laukeaisi, kartta jäisi rakentumatta kokonaan.
 * Tässä sama tarkistus ajetaan latauksessa, vierityksessä ja koon muutoksessa.
 */
const ENNAKKO_PX = 300;

function init() {
  const hook = document.querySelector("[data-kartta]");
  if (!hook) return;

  let rakennettu = false;

  function tarkista() {
    if (rakennettu) return;
    const ylapuoli = hook.getBoundingClientRect().top;
    if (ylapuoli > window.innerHeight + ENNAKKO_PX) return;
    rakennettu = true;
    window.removeEventListener("scroll", tarkista);
    window.removeEventListener("resize", tarkista);
    window.removeEventListener("load", tarkista);
    piirra(hook);
  }

  window.addEventListener("scroll", tarkista, { passive: true });
  window.addEventListener("resize", tarkista, { passive: true });
  // Sivun muu sisältö piirtyy vasta JSON-latausten jälkeen ja siirtää osiota,
  // joten tarkistus ajetaan vielä kertaalleen kun kaikki on paikallaan.
  window.addEventListener("load", tarkista);
  tarkista();
}

init();
