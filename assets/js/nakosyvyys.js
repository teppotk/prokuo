/**
 * Näkösyvyysrekisteri – sivuston tunnuselementti.
 *
 * Aineisto on koottu Pro Kuolimon julkaisemasta mittausraportista
 * (data/nakosyvyys.json, lähde-PDF linkitetty aineistossa). Esitys on
 * yhden sävyn luokiteltu sarja: tummempi = kirkkaampi vesi. Jokainen solu
 * näyttää myös mitatun lukeman, joten tieto ei ole pelkän värin varassa.
 */
import { esc, loadJSON, fiNum } from "./site.js";
import { BINS, binOf } from "./luokat.js";

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

/* --- Muutos ajan yli pisteittäin ---------------------------------------- */

/**
 * Pieni kuvaaja per mittauspiste ("small multiples") eikä 30 viivaa samassa
 * kuvassa: kolmekymmentä sarjaa päällekkäin olisi lukukelvoton sotku, eikä
 * väriä riitä erottamaan niitä. Jokaisessa kuvaajassa on yksi sarja, joten
 * selitettä ei tarvita – otsikko kertoo kumpi piste on kyseessä.
 *
 * Pystyasteikko on sama kaikissa (0–7 m), jotta pisteitä voi verrata
 * keskenään. Vaaka-akseli on todellisessa aikasuhteessa, joten talven tauko
 * näkyy välinä eikä kierrokset ole tasavälein.
 */
// Korkeampi kuvaaja kuin leveys antaisi olettaa: yhteinen 0–7 metrin asteikko
// litistää muutokset, joten pystysuuntaa tarvitaan, jotta 0,5 metrin ero
// näkyy lainkaan. Asteikkoa itseään ei kiristetä, koska nolla on
// näkösyvyydessä todellinen pohja (vedenpinta) ja pisteitä pitää voida
// verrata keskenään.
const TRENDI = { w: 168, h: 96, padX: 4, padY: 9, yMax: 7 };

/** Apuviivat metreinä. Jokaiseen metriin piirretty viivasto olisi liian tiheä. */
const TRENDI_VIIVAT = [2, 4, 6];

/** Kierroksen tunnus "2024-06" -> [vuosi, kuukausi]. */
function kierrosKausi(id) {
  const [y, m] = String(id).split("-").map(Number);
  return [y, m];
}

/**
 * Samojen kuukausien vuosimuutos: kesäkuu 2024 vastaan kesäkuu 2025 ja niin
 * edelleen. Kierrokset eivät ole vertailukelpoisia keskenään vuodenajan takia,
 * joten ainoa rehellinen muutosluku syntyy vuoden päässä olevista pareista.
 * Palauttaa keskiarvon ja parien määrän, tai null jos paria ei ole.
 */
function vuosimuutos(data, piste) {
  const arvo = (id) => data.havainnot[id] && data.havainnot[id][piste];
  const erot = [];
  for (const r of data.kierrokset) {
    const [y, m] = kierrosKausi(r.id);
    const edellinen = `${y - 1}-${String(m).padStart(2, "0")}`;
    const a = arvo(edellinen);
    const b = arvo(r.id);
    if (a !== undefined && b !== undefined) erot.push(b - a);
  }
  if (!erot.length) return null;
  return { muutos: erot.reduce((x, y) => x + y, 0) / erot.length, pareja: erot.length };
}

/** Kierrosten vaakasijainnit aikasuhteessa, 0…1. */
function kierrosSijainnit(data) {
  const kaudet = data.kierrokset.map((r) => kierrosKausi(r.id));
  const nolla = kaudet[0];
  const kk = kaudet.map(([y, m]) => (y - nolla[0]) * 12 + (m - nolla[1]));
  const kesto = kk[kk.length - 1] || 1;
  return kk.map((k) => k / kesto);
}

/** Yksi pisteen kuvaaja. Puuttuva mittaus katkaisee viivan, ei piirrä nollaa. */
function sparkline(data, piste, osuudet, maaliskuut) {
  const { w, h, padX, padY, yMax } = TRENDI;
  const x = (i) => padX + osuudet[i] * (w - 2 * padX);
  const y = (v) => padY + (1 - v / yMax) * (h - 2 * padY);

  const havainnot = data.kierrokset.map((r, i) => {
    const v = data.havainnot[r.id][piste];
    return v === undefined ? null : { i, v, x: x(i), y: y(v), nimi: r.nimi };
  });

  // Viiva katkeaa puuttuvien kohdalta: yhtenäiset jaksot omina polyline-osina.
  const jaksot = [];
  let jakso = [];
  for (const p of havainnot) {
    if (p) jakso.push(p);
    else if (jakso.length) {
      jaksot.push(jakso);
      jakso = [];
    }
  }
  if (jakso.length) jaksot.push(jakso);

  const viivat = TRENDI_VIIVAT.map(
    (m) => `<line class="trendi__apu" x1="${padX}" y1="${y(m).toFixed(1)}"
             x2="${w - padX}" y2="${y(m).toFixed(1)}"/>`
  ).join("");

  // Jääkierroksen kohta merkitään kaikissa kuvaajissa samalla tavalla.
  const jaa = maaliskuut
    .map(
      (i) =>
        `<rect class="trendi__jaa" x="${(x(i) - 3).toFixed(1)}" y="${padY - 3}"
           width="6" height="${h - 2 * padY + 6}"/>`
    )
    .join("");

  const polut = jaksot
    .filter((j) => j.length > 1)
    .map(
      (j) =>
        `<polyline class="trendi__viiva" points="${j
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" ")}"/>`
    )
    .join("");

  const pallot = havainnot
    .filter(Boolean)
    .map(
      (p) =>
        `<circle class="trendi__piste" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.6">
           <title>${esc(p.nimi)}: ${fiNum(p.v)} m</title></circle>`
    )
    .join("");

  const luettu = data.kierrokset
    .map((r) => {
      const v = data.havainnot[r.id][piste];
      return `${r.nimi} ${v === undefined ? "ei mittausta" : fiNum(v) + " metriä"}`;
    })
    .join(", ");

  return `<svg class="trendi__kuva" viewBox="0 0 ${w} ${h}" role="img"
    aria-label="Piste ${esc(piste)}: ${esc(luettu)}">
    ${jaa}${viivat}${polut}${pallot}
  </svg>`;
}

/** Koko osio: yhteenveto ja pisteet alueittain. */
function trendit(data, pisteaineisto) {
  const osuudet = kierrosSijainnit(data);
  const maaliskuut = data.kierrokset
    .map((r, i) => (kierrosKausi(r.id)[1] === 3 ? i : -1))
    .filter((i) => i >= 0);

  const nimet = {};
  const alueet = {};
  if (pisteaineisto) {
    for (const p of pisteaineisto.pisteet) {
      nimet[p.id] = p.nimi;
      alueet[p.id] = `${p.alue} · ${p.alueen_nimi}`;
    }
  }

  const muutokset = data.pisteet.map((p) => [p, vuosimuutos(data, p)]);
  const kirkkaammat = muutokset.filter(([, m]) => m && m.muutos >= 0.2).length;
  const tummemmat = muutokset.filter(([, m]) => m && m.muutos <= -0.2).length;
  const ennallaan = muutokset.filter(([, m]) => m && Math.abs(m.muutos) < 0.2).length;
  const vertailematta = muutokset.filter(([, m]) => !m).length;

  const yhteenveto = `<ul class="trendisumma">
    <li><b class="num">${kirkkaammat}</b><span>pistettä kirkastunut</span></li>
    <li><b class="num">${tummemmat}</b><span>pistettä tummunut</span></li>
    <li><b class="num">${ennallaan}</b><span>ennallaan ±0,2 m</span></li>
    <li><b class="num">${vertailematta}</b><span>ilman vertailuparia</span></li>
  </ul>`;

  // Ryhmittely alueittain pitää järjestyksen samana kuin rekisteritaulukossa.
  const ryhmat = [];
  for (const p of data.pisteet) {
    const otsikko = alueet[p] || p[0];
    const viimeinen = ryhmat[ryhmat.length - 1];
    if (viimeinen && viimeinen.otsikko === otsikko) viimeinen.pisteet.push(p);
    else ryhmat.push({ otsikko, pisteet: [p] });
  }

  const kortit = (lista) =>
    lista
      .map((p) => {
        const m = vuosimuutos(data, p);
        const viimeisin = [...data.kierrokset]
          .reverse()
          .map((r) => data.havainnot[r.id][p])
          .find((v) => v !== undefined);
        // Suuntaa ei koodata värillä: etumerkki kertoo sen, ja osion
        // yhteenveto kertoo montako pistettä on kummassakin suunnassa.
        // Etumerkki luetaan pyöristetystä arvosta: muuten −0,03 m näkyisi
        // muodossa "−0,0 m/v", joka lukee pienenä laskuna vaikka on nolla.
        const pyoristetty = m ? Math.round(m.muutos * 10) / 10 : 0;
        const muutos = m
          ? `<span class="trendi__muutos">${
              pyoristetty > 0 ? "+" : pyoristetty < 0 ? "−" : "±"
            }${fiNum(Math.abs(pyoristetty))} m/v</span>${
              m.pareja < 3 ? `<span class="trendi__pareja">${m.pareja} paria</span>` : ""
            }`
          : `<span class="trendi__muutos trendi__muutos--tyhja">ei vertailuparia</span>`;
        return `<li class="trendi">
          <p class="trendi__nimi"><b>${esc(p)}</b>${
            nimet[p] ? ` ${esc(nimet[p])}` : ""
          }</p>
          ${sparkline(data, p, osuudet, maaliskuut)}
          <p class="trendi__luvut">${
            viimeisin === undefined
              ? "<span>ei mittauksia</span>"
              : `<span class="num">${fiNum(viimeisin)} m</span>`
          }${muutos}</p>
        </li>`;
      })
      .join("");

  return (
    yhteenveto +
    ryhmat
      .map(
        (r) => `<section class="trendiryhma">
          <h3>${esc(r.otsikko)}</h3>
          <ul class="trendiruudukko">${kortit(r.pisteet)}</ul>
        </section>`
      )
      .join("")
  );
}

async function init() {
  const preview = document.querySelector("[data-nakosyvyys-preview]");
  const full = document.querySelector("[data-nakosyvyys]");
  const trendiHook = document.querySelector("[data-trendit]");
  if (!preview && !full && !trendiHook) return;

  const host = full || preview || trendiHook;
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

  if (trendiHook) {
    // Pisteiden nimet ovat eri aineistossa. Ne ovat kuvaajille lisätietoa,
    // joten osio piirretään myös ilman niitä, jos lataus ei onnistu.
    const pisteaineisto = await loadJSON("data/mittauspisteet.json", null);
    trendiHook.innerHTML = trendit(data, pisteaineisto);
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
