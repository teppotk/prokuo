/**
 * Uutislistan piirto. Sama moduuli palvelee etusivua ja uutisarkistoa:
 * data-limit-attribuutti rajaa näytettävien juttujen määrän.
 */
import { esc, loadJSON, fiDate } from "./site.js";

function newsItem(item) {
  const links = (item.linkit || [])
    .map((l) => `<li><a href="${esc(l.url)}">${esc(l.teksti)}</a></li>`)
    .join("");

  return `<li>
    <article class="news reveal">
      <p class="news__date"><time datetime="${esc(item.pvm)}">${fiDate(item.pvm)}</time></p>
      <div>
        <h3 class="news__title">${esc(item.otsikko)}</h3>
        <p class="news__body">${esc(item.teksti)}</p>
        ${links ? `<ul class="news__links">${links}</ul>` : ""}
      </div>
    </article>
  </li>`;
}

export async function renderNews(root) {
  const status = root.querySelector("[data-status]") || root;
  const items = await loadJSON(root.dataset.src || "data/uutiset.json", status);
  if (!items) return;

  const limit = Number(root.dataset.limit) || items.length;
  const shown = items.slice(0, limit);

  root.innerHTML = `<ol class="newslist">${shown.map(newsItem).join("")}</ol>`;
}

const target = document.querySelector("[data-news]");
if (target) renderNews(target);
