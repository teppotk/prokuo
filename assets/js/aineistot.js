/**
 * Aineistokirjasto: ryhmitelty tiedostolista, jota voi rajata hakusanalla
 * ja ryhmällä. Suodatus tehdään selaimessa – palvelinkoodia ei tarvita.
 */
import { esc, loadJSON } from "./site.js";

const root = document.querySelector("[data-docs]");
if (root) init(root);

async function init(el) {
  const status = el.querySelector("[data-status]");
  const groups = await loadJSON("data/aineistot.json", status);
  if (!groups) return;

  const total = groups.reduce((n, g) => n + g.tiedostot.length, 0);

  el.innerHTML = `
    <div class="filters">
      <label class="field">
        <span>Hae aineistoista</span>
        <input type="search" id="doc-haku" placeholder="esim. nieriä, kosteikko, 2025" autocomplete="off">
      </label>
      <label class="field">
        <span>Ryhmä</span>
        <select id="doc-ryhma">
          <option value="">Kaikki ryhmät</option>
          ${groups.map((g) => `<option value="${esc(g.ryhma)}">${esc(g.ryhma)}</option>`).join("")}
        </select>
      </label>
      <p class="filters__count" aria-live="polite" data-count></p>
    </div>
    <div class="doclist" data-list></div>`;

  const search = el.querySelector("#doc-haku");
  const select = el.querySelector("#doc-ryhma");
  const list = el.querySelector("[data-list]");
  const count = el.querySelector("[data-count]");

  function draw() {
    const q = search.value.trim().toLowerCase();
    const group = select.value;
    let shown = 0;

    const html = groups
      .filter((g) => !group || g.ryhma === group)
      .map((g) => {
        const files = g.tiedostot.filter((f) => {
          if (!q) return true;
          return `${f.nimi} ${g.ryhma} ${f.vuosi} ${f.tyyppi}`.toLowerCase().includes(q);
        });
        if (!files.length) return "";
        shown += files.length;
        return `<section class="docgroup">
          <h3>${esc(g.ryhma)}</h3>
          <ul>${files
            .map(
              (f) => `<li><a class="doc" href="${esc(f.url)}">
                <span class="doc__name">${esc(f.nimi)}</span>
                <span class="doc__meta">${esc(f.vuosi)}</span>
                <span class="doc__meta">${esc(f.tyyppi)}</span>
              </a></li>`
            )
            .join("")}</ul>
        </section>`;
      })
      .join("");

    list.innerHTML =
      html || `<p class="status">Haulla ei löytynyt aineistoja. Kokeile toista hakusanaa.</p>`;
    count.textContent = `${shown} / ${total} aineistoa`;
  }

  search.addEventListener("input", draw);
  select.addEventListener("change", draw);
  draw();
}
