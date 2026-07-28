/** Linkkiluettelo yhdistyssivulle. */
import { esc, loadJSON } from "./site.js";

const root = document.querySelector("[data-links]");
if (root) init(root);

async function init(el) {
  const groups = await loadJSON("data/linkit.json", el.querySelector("[data-status]") || el);
  if (!groups) return;

  el.innerHTML = groups
    .map(
      (g) => `<section class="stack-sm">
        <h3>${esc(g.ryhma)}</h3>
        <ul class="linkgrid">
          ${g.linkit
            .map(
              (l) => `<li><a href="${esc(l.url)}">${esc(l.nimi)}
                <span>${esc(l.kuvaus)}</span></a></li>`
            )
            .join("")}
        </ul>
      </section>`
    )
    .join("");
}
