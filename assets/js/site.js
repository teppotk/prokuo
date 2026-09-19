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
  { href: "kirjaa.html", text: "Kirjaus" },
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

/**
 * Yhdistyksen virallinen logo. Lähde on media-source/ProKuolimologo_*.png ja
 * julkaistavat versiot syntyvät build-images.sh:lla, joka rajaa läpinäkyvän
 * reunuksen pois. Valkoinen versio on näytölle, tumma tulostukseen.
 *
 * Sama kuva sekä ylä- että alatunnisteessa, eri kokoisena. Linkillä on oma
 * aria-label, joten kuva on ruudunlukijalle koristeellinen (alt="") eikä
 * nimeä toisteta kahdesti.
 */
const LOGO = `<img class="brand__logo" src="assets/img/pro-kuolimo-logo-valkoinen.png"
  width="675" height="174" alt="">`;

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
      ${LOGO}
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

    const auki = () => toggle.getAttribute("aria-expanded") === "true";

    const aseta = (tila) => {
      toggle.setAttribute("aria-expanded", String(tila));
      nav.dataset.open = String(tila);
    };

    const sulje = (palautaKohdistus) => {
      if (!auki()) return;
      aseta(false);
      // Kohdistus palautetaan vain näppäimistöltä suljettaessa. Hiiren tai
      // sormen jäljiltä nappiin hyppäävä kohdistusrengas olisi hämmentävä.
      if (palautaKohdistus) toggle.focus();
    };

    toggle.addEventListener("click", () => aseta(!auki()));

    // Napautus valikon ulkopuolelle sulkee sen. Kuuntelija on pointerdownissa
    // eikä clickissä, jotta valikko sulkeutuu heti kosketuksesta eikä vasta
    // sormen noustessa. Rajana on koko yläpalkkielementti, joten avausnapin
    // oma käsittelijä saa hoitaa napin napautuksen ilman että tämä ehtii
    // sulkea valikon juuri ennen sitä.
    document.addEventListener("pointerdown", (e) => {
      if (!this.contains(e.target)) sulje(false);
    });

    // Esc sulkee mistä tahansa. Aiemmin kuuntelija oli valikossa, joten Esc ei
    // toiminut heti avaamisen jälkeen: kohdistus on silloin avausnapissa,
    // joka on valikon ulkopuolella.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") sulje(true);
    });

    // Valikon linkki sulkee valikon. Sivunvaihto hoitaisi sen itsestään, mutta
    // saman sivun ankkurilinkki (esim. #kartta) ei lataa sivua uudelleen, ja
    // valikko jäisi auki kohteen päälle.
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) sulje(false);
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
        <img class="footer__logo" src="assets/img/pro-kuolimo-logo-valkoinen.png"
             width="675" height="174"
             alt="Pro Kuolimo ry – puhtaan veden puolesta">
        <img class="footer__logo footer__logo--paperi"
             src="assets/img/pro-kuolimo-logo-tumma.png"
             width="675" height="174" alt="" aria-hidden="true">
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
