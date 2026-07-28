/**
 * Näkösyvyysrekisteri – sivuston tunnuselementti.
 *
 * Aineisto on koottu Pro Kuolimon julkaisemasta mittausraportista
 * (data/nakosyvyys.json, lähde-PDF linkitetty aineistossa). Esitys on
 * yhden sävyn luokiteltu sarja: tummempi = kirkkaampi vesi. Jokainen solu
 * näyttää myös mitatun lukeman, joten tieto ei ole pelkän värin varassa.
 */
import { esc, loadJSON, fiNum } from "./site.js";

/** Luokkarajat metreinä. Tunnus 1 = sameinta, 6 = kirkkainta. */
const BINS = [
  { bin: 1, min: 0, label: "alle 2" },
  { bin: 2, min: 2, label: "2–3" },
  { bin: 3, min: 3, label: "3–4" },
  { bin: 4, min: 4, label: "4–5" },
  { bin: 5, min: 5, label: "5–6" },
  { bin: 6, min: 6, label: "6 tai yli" },
];

function binOf(value) {
  let hit = BINS[0];
  for (const b of BINS) if (value >= b.min) hit = b;
  return hit.bin;
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Kierroksen tunnusluvut: havaintojen määrä, mediaani ja luokkajakauma. */
function summarise(data, round) {
  const values = Object.values(data.havainnot[round.id]);
  const counts = BINS.map((b) => values.filter((v) => binOf(v) === b.bin).length);
  return { round, n: values.length, med: median(values), counts };
}

function scaleLegend() {
  return `<div class="scale">
    <span>Näkösyvyys, m</span>
    <span class="scale__steps">${BINS.map(
      (b) => `<span class="scale__step" data-bin="${b.bin}">${b.label}</span>`
    ).join("")}</span>
  </div>`;
}

/**
 * Kierrosten yhteenveto. Palkin pituus kertoo mittauspisteiden määrän
 * suhteessa suurimpaan kierrokseen, ja palkin osat luokkajakauman. Näin
 * jäältä mitattu maaliskuun kierros ei näytä yhtä kattavalta kuin muut.
 */
function roundsList(data) {
  const stats = data.kierrokset.map((r) => summarise(data, r));
  const maxN = Math.max(...stats.map((s) => s.n));

  const rows = stats
    .map((s) => {
      const segs = s.counts
        .map((c, i) =>
          c
            ? `<span class="round__seg" data-bin="${i + 1}" style="flex:${c}"
                 title="${c} pistettä luokassa ${BINS[i].label} m"></span>`
            : ""
        )
        .join("");
      return `<li class="round">
        <span class="round__name">${esc(s.round.nimi)}</span>
        <span class="round__bar" role="img"
              aria-label="${esc(s.round.nimi)}: ${s.counts
                .map((c, i) => `${c} pistettä ${BINS[i].label} m`)
                .join(", ")}"><span class="round__fill"
              style="width:${((s.n / maxN) * 100).toFixed(1)}%">${segs}</span></span>
        <span class="round__stat">med. ${fiNum(s.med)} m · n=${s.n}</span>
      </li>`;
    })
    .join("");
  return `<ul class="rounds">${rows}</ul>`;
}

/** Koko rekisteri: mittauspisteet riveinä, kierrokset sarakkeina. */
function recordTable(data) {
  const head = data.kierrokset
    .map((r) => `<th scope="col">${esc(r.nimi).replace(" ", "<br>")}</th>`)
    .join("");

  const body = data.pisteet
    .map((p) => {
      const cells = data.kierrokset
        .map((r) => {
          const v = data.havainnot[r.id][p];
          if (v === undefined) {
            return `<td class="is-empty" title="Piste ${p}, ${r.nimi}: ei mittausta">–</td>`;
          }
          return `<td data-bin="${binOf(v)}" title="Piste ${p}, ${r.nimi}: ${fiNum(v)} m">${fiNum(
            v
          )}</td>`;
        })
        .join("");
      return `<tr><th scope="row">${esc(p)}</th>${cells}</tr>`;
    })
    .join("");

  const foot = data.kierrokset
    .map((r) => {
      const s = summarise(data, r);
      return `<td>${fiNum(s.med)}</td>`;
    })
    .join("");

  // Taulukon selite on <caption>-elementin sijasta oma kappale ennen
  // vierityskehystä: leveä caption kasvattaa sivun vaakavieritystä, ja selite
  // on muutenkin helpompi lukea ilman vieritystä. Yhteys taulukkoon
  // säilyy aria-describedby-viittauksella.
  return `<p class="note" id="record-selite">Näkösyvyys metreinä
    mittauspisteittäin. Viiva tarkoittaa, ettei pisteellä mitattu kyseisellä
    kierroksella. Taulukkoa voi vierittää sivusuunnassa.</p>
  <div class="recordwrap">
    <table class="record" aria-describedby="record-selite">
      <caption class="visually-hidden">Näkösyvyysmittaukset mittauspisteittäin ja kierroksittain</caption>
      <thead><tr><th scope="col">Piste</th>${head}</tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><th scope="row">Mediaani</th>${foot}</tr></tfoot>
    </table>
  </div>`;
}

async function init() {
  const preview = document.querySelector("[data-nakosyvyys-preview]");
  const full = document.querySelector("[data-nakosyvyys]");
  if (!preview && !full) return;

  const host = full || preview;
  const data = await loadJSON("data/nakosyvyys.json", host.querySelector("[data-status]") || host);
  if (!data) return;

  const latest = data.kierrokset[data.kierrokset.length - 1];
  const s = summarise(data, latest);

  if (preview) {
    preview.innerHTML = `
      ${roundsList(data)}
      ${scaleLegend()}
      <p class="note">Viimeisin kierros ${esc(latest.nimi)}: mediaani ${fiNum(
        s.med
      )} metriä, ${s.n} mittauspistettä.</p>`;
  }

  if (full) {
    full.innerHTML = `
      ${roundsList(data)}
      ${scaleLegend()}
      <div class="stack-lg" style="margin-top:2.5rem">
        ${recordTable(data)}
      </div>`;
  }

  // Täytetään mahdolliset lukemat sivun muissa kohdissa.
  document.querySelectorAll("[data-ns-luku]").forEach((el) => {
    const key = el.dataset.nsLuku;
    if (key === "mediaani") el.textContent = fiNum(s.med);
    if (key === "kierros") el.textContent = latest.nimi;
    if (key === "pisteet") el.textContent = String(data.pisteet.length);
    if (key === "kierroksia") el.textContent = String(data.kierrokset.length);
  });
}

init();
