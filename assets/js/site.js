/**
 * Sivuston yhteiset osat: ylä- ja alatunniste sekä pienet apufunktiot.
 *
 * Ylä- ja alatunniste on toteutettu web-komponenteilla, jotta navigaatio on
 * määritelty yhdessä paikassa. Komponentit kirjoittavat tavalliseen DOM:iin
 * (ei shadow DOM), jotta site.css koskee myös niihin.
 */

/** Navigaation ainoa totuuslähde. Lisää sivu tähän, niin se näkyy kaikkialla. */
export const NAV = [
  { href: "kuolimo.html", text: "Kuolimo" },
  { href: "toiminta.html", text: "Toiminta" },
  { href: "nakosyvyys.html", text: "Näkösyvyys" },
  { href: "aineistot.html", text: "Aineistot" },
  { href: "uutiset.html", text: "Uutiset" },
  { href: "yhdistys.html", text: "Yhdistys" },
];

const CTA = { href: "liity.html", text: "Liity jäseneksi" };

const YHTEYS = {
  nimi: "Pro Kuolimo ry",
  osoite: "Peltoinlahdentie 29, 54800 Savitaipale",
  ytunnus: "2686282-1",
  puheenjohtaja: { nimi: "Kari Kotirinta", puh: "050 453 2032", email: "kari.kotirinta@gmail.com" },
  sihteeri: { nimi: "Leo Lauramaa", puh: "0400 727 625", email: "leo.lauramaa@gmail.com" },
  facebook: "https://www.facebook.com/Prokuolimo",
};

/** Yhdistyksen tunnus: järven ääriviiva ja kaksi syvyyskäyrää. */
const MARK = `<svg class="brand__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
  <path d="M24 4c9 1 16 7 17 16 1 9-4 18-13 23-7 3-16 0-20-7C4 29 6 18 12 11c4-5 8-7 12-7Z"
        stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>
  <path d="M24 11.5c7 1 11 5 12 11 1 6-3 13-9 16-5 2-12 0-14-5-2-5-1-12 3-16 3-4 5-6 8-6Z"
        stroke="currentColor" stroke-width="1.5" stroke-opacity=".72" stroke-linejoin="round"/>
  <path d="M24 19c4 .6 6 2.6 6 5.6 0 3.6-3 6.4-6 6.4-4 0-6-2.8-6-6.4 0-3 3-5.6 6-5.6Z"
        fill="currentColor" fill-opacity=".9"/>
</svg>`;

/** Nykyinen tiedostonimi, esim. "kuolimo.html". Juuri vastaa index.html:ää. */
function currentPage() {
  const file = location.pathname.split("/").pop();
  return file === "" ? "index.html" : file;
}

class SiteHeader extends HTMLElement {
  connectedCallback() {
    const here = currentPage();
    const links = NAV.map(
      (item) =>
        `<a class="nav__link" href="${item.href}"${
          item.href === here ? ' aria-current="page"' : ""
        }>${item.text}</a>`
    ).join("");

    this.innerHTML = `
<a class="skip" href="#main">Siirry sisältöön</a>
<header class="topbar">
  <div class="wrap topbar__inner">
    <a class="brand" href="index.html" aria-label="Pro Kuolimo ry, etusivu">
      ${MARK}
      <span class="brand__text">
        <span class="brand__name">Pro Kuolimo</span>
        <span class="brand__sub">Vesiensuojelua vuodesta 2012</span>
      </span>
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="paavalikko">
      <span class="nav-toggle__bars" aria-hidden="true"><i></i><i></i><i></i></span>
      Valikko
    </button>
    <nav class="nav" id="paavalikko" aria-label="Päävalikko">
      ${links}
      <a class="btn btn--primary nav__cta" href="${CTA.href}">${CTA.text}</a>
    </nav>
  </div>
</header>`;

    const toggle = this.querySelector(".nav-toggle");
    const nav = this.querySelector(".nav");
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      nav.dataset.open = String(!open);
    });
    // Esc sulkee mobiilivalikon ja palauttaa kohdistuksen painikkeeseen.
    nav.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        toggle.setAttribute("aria-expanded", "false");
        nav.dataset.open = "false";
        toggle.focus();
      }
    });
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    const navLinks = NAV.concat(CTA)
      .map((i) => `<li><a href="${i.href}">${i.text}</a></li>`)
      .join("");

    this.innerHTML = `
<footer class="footer">
  <div class="wrap">
    <div class="footer__grid">
      <div>
        <div class="footer__mark">
          ${MARK.replace("brand__mark", "")}
          <span>Pro Kuolimo ry</span>
        </div>
        <p>Edistämme vesiensuojelua, luonnonsuojelua ja maisemanhoitoa
        Kuolimolla ja sen valuma-alueella Etelä-Karjalassa ja Etelä-Savossa.</p>
      </div>
      <div>
        <h2>Sivut</h2>
        <ul>${navLinks}</ul>
      </div>
      <div>
        <h2>Yhteys</h2>
        <ul>
          <li>${YHTEYS.osoite}</li>
          <li>${YHTEYS.puheenjohtaja.nimi}, puheenjohtaja<br>
            <a href="tel:${YHTEYS.puheenjohtaja.puh.replace(/\s/g, "")}">${YHTEYS.puheenjohtaja.puh}</a></li>
          <li><a href="mailto:${YHTEYS.sihteeri.email}">${YHTEYS.sihteeri.email}</a></li>
          <li><a href="${YHTEYS.facebook}">Facebook</a></li>
        </ul>
      </div>
      <div>
        <h2>Tietoa</h2>
        <ul>
          <li>Y-tunnus ${YHTEYS.ytunnus}</li>
          <li>Rekisterinumero 209.206</li>
          <li>Perustettu 20.10.2012</li>
          <li><a href="aineistot/pro-kuolimo-ry-esite-09082025.pdf">Yhdistyksen esite (PDF)</a></li>
        </ul>
      </div>
    </div>
    <div class="footer__base">
      <span>© Pro Kuolimo ry ${new Date().getFullYear()}</span>
      <span>Valtakunnallinen suojelija: ministeri Pertti Salolainen</span>
    </div>
  </div>
</footer>`;
  }
}

customElements.define("site-header", SiteHeader);
customElements.define("site-footer", SiteFooter);

/* --- Apufunktiot sivukohtaisille moduuleille ---------------------------- */

/** Estää HTML-injektion, kun JSON-sisältö kirjoitetaan innerHTML:llä. */
export function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}

/**
 * Lataa JSON-tiedoston ja kertoo virheestä käyttäjälle annetussa elementissä.
 * Palauttaa null, jos lataus epäonnistuu.
 */
export async function loadJSON(path, statusEl) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (statusEl) {
      statusEl.textContent =
        "Sisällön lataus ei onnistunut. Päivitä sivu tai kokeile hetken kuluttua uudelleen.";
    }
    console.error(`Tiedostoa ${path} ei voitu lukea:`, err);
    return null;
  }
}

/** 2026-05-07 -> 7.5.2026 */
export function fiDate(iso) {
  const [y, m, d] = String(iso).split("-");
  return d ? `${Number(d)}.${Number(m)}.${y}` : `${Number(m)}/${y}`;
}

/** Muotoilee desimaaliluvun suomalaisittain: 4.5 -> "4,5" */
export function fiNum(n, decimals = 1) {
  return Number(n).toFixed(decimals).replace(".", ",");
}
