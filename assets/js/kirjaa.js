/**
 * Näkösyvyysmittausten kirjaus maastossa (kirjaa.html).
 *
 * Sivu on tarkoitettu veneessä tai rannalla käytettäväksi: mittaaja näkee oman
 * sijaintinsa kartalla, valitsee mittauspisteen, tarkentaa tarvittaessa
 * sijainnin sormella ja kirjaa päivämäärän, kellonajan ja lukeman.
 *
 * TALLENNUS ON TOISTAISEKSI PAIKALLINEN. Kirjaukset menevät selaimen
 * localStorageen, eivät mihinkään palvelimelle – tämä on prototyyppi, jolla
 * työnkulku voidaan testata ennen kuin tietokannasta päätetään. Kirjaukset on
 * siksi vietävä JSON- tai CSV-tiedostona ja toimitettava sihteerille.
 * Selaimen tietojen tyhjennys poistaa kirjaukset, ja siitä varoitetaan sivulla.
 *
 * SALASANA EI OLE TIETOTURVAA. Koko sivusto on staattinen, joten mitään
 * palvelinpuolen tarkistusta ei ole. Tunnusluku on vain este, joka pitää sivun
 * pois satunnaisilta kävijöiltä ja hakukoneilta (sivulla on myös noindex ja
 * robots.txt-esto). Älä kirjaa tänne mitään, mikä ei kestä julkisuutta.
 */
import { esc, loadJSON, fiNum, fiDate } from "./site.js";
import {
  luoKartta,
  pisteMerkki,
  pisteenNimi,
  koordinaatti,
  etaisyys,
  lahinPiste,
} from "./kartta-apu.js";

/* --- Tunnusluku ---------------------------------------------------------- */

/**
 * FNV-1a-tiiviste. Tarkoitus on vain se, ettei tunnusluku ole selväkielisenä
 * lähdekoodissa. Vaihda tunnus laskemalla uusi arvo selaimen konsolissa:
 *     window.prokuolimoTiiviste("uusi tunnus")
 * ja korvaa TUNNUS_TIIVISTE sillä.
 */
function tiiviste(teksti) {
  let h = 0x811c9dc5;
  for (const merkki of "pro-kuolimo:" + teksti) {
    h ^= merkki.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
window.prokuolimoTiiviste = tiiviste;

const TUNNUS_TIIVISTE = "8d23c769";

/**
 * Tunnusluku on toistaiseksi pois käytöstä: portti aukeaa millä tahansa
 * syötteellä, myös tyhjällä. Tarkistus on jätetty koodiin tallelle, joten
 * käyttöönotto on tämän yhden arvon vaihtaminen takaisin todeksi – ja samalla
 * kirjaa.html:n portin tekstin ja kentän required-määreen palauttaminen.
 *
 * Huom. ilman tunnuslukua sivu on käytännössä auki kaikille, jotka tietävät
 * osoitteen. Sivu on edelleen noindex ja estetty robots.txt:ssä, mutta se
 * estää vain hakukoneita, ei ihmisiä.
 */
const TUNNUS_KAYTOSSA = false;
const AVAIN_PORTTI = "prokuolimo.portti";
const AVAIN_KIRJAUKSET = "prokuolimo.kirjaukset";
const AVAIN_KORJAUKSET = "prokuolimo.pistekorjaukset";
const AVAIN_MITTAAJA = "prokuolimo.mittaaja";

/**
 * Kuinka kaukana valitusta mittauspisteestä kirjattava sijainti saa olla ennen
 * kuin pistevalinta katsotaan vanhentuneeksi. Lähimmät pisteet (B1 ja B2) ovat
 * 587 metrin päässä toisistaan, joten raja on selvästi sen puolikkaan alle:
 * valinta ei voi jäädä osoittamaan naapuripistettä.
 */
const PISTEEN_SIETO_M = 250;

/* --- Paikallinen tallennus ----------------------------------------------- */

function lue(avain, oletus) {
  try {
    const teksti = localStorage.getItem(avain);
    return teksti ? JSON.parse(teksti) : oletus;
  } catch (err) {
    console.error(`Tallennuksen ${avain} luku epäonnistui:`, err);
    return oletus;
  }
}

function kirjoita(avain, arvo) {
  try {
    localStorage.setItem(avain, JSON.stringify(arvo));
    return true;
  } catch (err) {
    console.error(`Tallennuksen ${avain} kirjoitus epäonnistui:`, err);
    return false;
  }
}

/* --- Aika ---------------------------------------------------------------- */

/** Paikallinen päivämäärä muodossa 2026-09-18 (ei UTC, joka voi olla eri päivä). */
function tanaan(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function kello(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* --- Vienti -------------------------------------------------------------- */

const SARAKKEET = [
  ["pvm", "Päivämäärä"],
  ["klo", "Kello"],
  ["piste", "Piste"],
  ["pisteen_nimi", "Mittauspaikka"],
  ["nakosyvyys", "Näkösyvyys (m)"],
  ["lat", "Leveysaste"],
  ["lon", "Pituusaste"],
  ["sijainnin_lahde", "Sijainnin lähde"],
  ["tarkkuus_m", "GPS-tarkkuus (m)"],
  ["mittaaja", "Mittaaja"],
  ["huomiot", "Huomiot"],
];

/** Puolipiste-eroteltu CSV ja desimaalipilkku: aukeaa suomalaisessa Excelissä. */
function csv(kirjaukset) {
  const kentta = (arvo) => {
    const t = String(arvo ?? "").replace(/"/g, '""');
    return /[";\n]/.test(t) ? `"${t}"` : t;
  };
  const luku = (arvo) => (arvo == null ? "" : String(arvo).replace(".", ","));
  const numeeriset = new Set(["nakosyvyys", "lat", "lon", "tarkkuus_m"]);
  const rivit = [SARAKKEET.map(([, otsikko]) => kentta(otsikko)).join(";")];
  for (const k of kirjaukset) {
    rivit.push(
      SARAKKEET.map(([avain]) =>
        kentta(numeeriset.has(avain) ? luku(k[avain]) : k[avain])
      ).join(";")
    );
  }
  // BOM, jotta Excel tunnistaa ääkköset.
  return "﻿" + rivit.join("\r\n") + "\r\n";
}

function lataa(nimi, sisalto, tyyppi) {
  const url = URL.createObjectURL(new Blob([sisalto], { type: tyyppi }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nimi;
  a.click();
  URL.revokeObjectURL(url);
}

/* --- Sovellus ------------------------------------------------------------ */

async function kaynnista(juuri) {
  const status = juuri.querySelector("[data-status]");
  const aineisto = await loadJSON("data/mittauspisteet.json", status);
  if (!aineisto) return;

  const korjaukset = lue(AVAIN_KORJAUKSET, {});
  const pisteet = aineisto.pisteet.map((p) => ({ ...p, ...(korjaukset[p.id] || {}) }));

  juuri.innerHTML = `
    <div class="kirjausnakyma">

    <div class="kirjausnakyma__kartta">
      <div class="kartta kartta--kirjaus" data-kartta-el></div>

      <p class="sijaintitila" data-sijaintitila aria-live="polite">
        <span class="sijaintitila__viesti">Haetaan sijaintia…</span>
      </p>

      <div class="btn-row btn-row--kirjaus">
        <button class="btn btn--ghost" type="button" data-oma-sijainti>Oma sijainti</button>
        <button class="btn btn--ghost" type="button" data-lahin-piste>Lähin piste</button>
      </div>
    </div>

    <form class="lomake kirjausnakyma__lomake" data-lomake novalidate>
      <div class="lomake__rivi">
        <label class="field">
          <span>Mittauspiste</span>
          <select name="piste" data-piste required></select>
        </label>
        <label class="field field--kapea">
          <span>Näkösyvyys, m</span>
          <input type="number" name="nakosyvyys" inputmode="decimal"
                 min="0.1" max="30" step="0.1" required data-nakosyvyys>
        </label>
      </div>

      <div class="lomake__rivi">
        <label class="field field--kapea">
          <span>Päivämäärä</span>
          <input type="date" name="pvm" required data-pvm>
        </label>
        <label class="field field--kapea">
          <span>Kellonaika</span>
          <input type="time" name="klo" required data-klo>
        </label>
        <button class="btn btn--ghost btn--nyt" type="button" data-nyt>Nyt</button>
      </div>

      <div class="lomake__rivi">
        <label class="field">
          <span>Mittaaja</span>
          <input type="text" name="mittaaja" autocomplete="name" data-mittaaja>
        </label>
      </div>

      <label class="field">
        <span>Huomiot</span>
        <textarea name="huomiot" rows="2" data-huomiot
                  placeholder="Esimerkiksi sää, tuuli, levähavainto"></textarea>
      </label>

      <label class="valinta">
        <input type="checkbox" data-korjaa>
        <span>Tallenna tämä sijainti pisteen uudeksi paikaksi.
          Valitse tämä vain, jos olet varmasti oikealla mittauspaikalla –
          kartan pisteet ovat toistaiseksi arvioita.</span>
      </label>

      <p class="lomake__virhe" data-virhe role="alert" hidden></p>

      <button class="btn btn--primary btn--tallenna" type="submit">Tallenna kirjaus</button>

      <p class="kuittaus" data-kuittaus role="status" hidden></p>
    </form>

    <section class="kirjaukset kirjausnakyma__lista" aria-labelledby="kirjaukset-otsikko">
      <h2 id="kirjaukset-otsikko">Tallennetut kirjaukset <span data-maara></span></h2>
      <p class="note">Kirjaukset ovat vain tässä selaimessa. Vie ne tiedostoksi ja
        toimita sihteerille – selaimen tietojen tyhjennys poistaa ne.</p>
      <div data-lista></div>
      <div class="btn-row">
        <button class="btn btn--ghost" type="button" data-vie-json>Vie JSON</button>
        <button class="btn btn--ghost" type="button" data-vie-csv>Vie CSV</button>
        <button class="btn btn--ghost" type="button" data-tyhjenna>Tyhjennä kaikki</button>
      </div>
    </section>

    </div>`;

  const kartta = luoKartta(juuri.querySelector("[data-kartta-el]"), {
    scrollWheelZoom: true,
  });
  // Ilman karttaa sijaintia ei voi tarkentaa eikä lomake toimisi oikein,
  // joten näytetään yksi selkeä viesti puolitoimivan lomakkeen sijaan.
  if (!kartta) {
    juuri.innerHTML = `<p class="status">Karttakirjastoa ei saatu ladattua, joten
      kirjausta ei voi tehdä nyt. Kokeile uudelleen verkon piirissä tai kirjaa mittaus
      paperille ja toimita se sihteerille:
      <a href="mailto:leo.lauramaa@gmail.com">leo.lauramaa@gmail.com</a>.</p>`;
    return;
  }

  /* --- Kartan merkit ---------------------------------------------------- */

  const pisteMerkit = new Map();
  for (const p of pisteet) {
    const m = L.marker([p.lat, p.lon], {
      icon: pisteMerkki(p, null, p.tarkkuus === "arvio" ? "pin--arvio" : ""),
      alt: pisteenNimi(p),
    }).addTo(kartta);
    m.on("click", () => valitsePiste(p.id, true));
    pisteMerkit.set(p.id, m);
  }

  // Kirjauksen sijainti: raahattava merkki, joka on aina se paikka, joka
  // tallennetaan. Oma GPS-sijainti on erikseen, koska ne eivät ole sama asia.
  const kirjausMerkki = L.marker([pisteet[0].lat, pisteet[0].lon], {
    draggable: true,
    autoPan: true,
    icon: L.divIcon({
      className: "",
      html: '<span class="pin pin--kirjaus" aria-hidden="true"></span>',
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    }),
    alt: "Kirjauksen sijainti",
  }).addTo(kartta);

  // Aluksi näkyvissä on koko pisteistö; paikannus siirtää kartan käyttäjän luo.
  kartta.fitBounds(pisteet.map((p) => [p.lat, p.lon]), { padding: [30, 30] });

  let omaMerkki = null;
  let omaYmpyra = null;

  /* --- Tila ------------------------------------------------------------- */

  const tila = {
    lat: pisteet[0].lat,
    lon: pisteet[0].lon,
    lahde: "piste",
    tarkkuus: null,
    gps: null,
  };

  const sijaintitila = juuri.querySelector("[data-sijaintitila]");
  const pisteValinta = juuri.querySelector("[data-piste]");
  const virhe = juuri.querySelector("[data-virhe]");
  const kuittaus = juuri.querySelector("[data-kuittaus]");

  pisteValinta.innerHTML =
    pisteet
      .map(
        (p) =>
          `<option value="${esc(p.id)}">${esc(pisteenNimi(p))}${
            p.tarkkuus === "arvio" ? " (sijainti arvio)" : ""
          }</option>`
      )
      .join("") + '<option value="">— muu paikka, ei listalla —</option>';

  /** Matka luettavassa muodossa: alle kilometri metreinä, sen yli kilometreinä. */
  function matka(metria) {
    return metria >= 1000
      ? `${fiNum(metria / 1000)} km`
      : `${Math.round(metria)} m`;
  }

  /**
   * Mistä koordinaatti on peräisin. Tämä on kirjauksen tärkein epävarmuustieto:
   * puhelimen paikannus on mitattu, pistelistan sijainti voi olla pelkkä arvio.
   */
  function lahdeteksti() {
    if (tila.lahde === "gps") {
      return tila.tarkkuus != null
        ? `Puhelimen paikannus, tarkkuus ±${Math.round(tila.tarkkuus)} m`
        : "Puhelimen paikannus";
    }
    if (tila.lahde === "kartta") return "Asetettu kartalla";
    const valittu = pisteet.find((p) => p.id === pisteValinta.value);
    if (!valittu) return "Mittauspistettä ei ole valittu";
    return valittu.tarkkuus === "arvio"
      ? "Pistelistasta – sijainti on arvio, tarkenna kartalla"
      : "Pistelistasta, maastossa tarkennettu";
  }

  /** Näyttää lyhyen viestin koordinaattilukeman tilalla (haku, virhe). */
  function naytaViesti(teksti) {
    sijaintitila.innerHTML = `<span class="sijaintitila__viesti">${esc(teksti)}</span>`;
  }

  function paivitaSijainti() {
    kirjausMerkki.setLatLng([tila.lat, tila.lon]);

    // Lähin piste kertoo vain silloin jotain, kun sijainti ei ole pisteestä
    // itsestään – muuten se näyttäisi aina nollan metrin päässä olevan pisteen.
    let lahin = "";
    if (tila.lahde !== "piste") {
      const osuma = lahinPiste(pisteet, tila.lat, tila.lon);
      if (osuma) lahin = ` · lähin piste ${esc(osuma.piste.id)}, ${matka(osuma.etaisyys)}`;
    }

    const varoitus = irronnutPiste
      ? `<span class="sijaintitila__varoitus">Mittauspiste ${esc(irronnutPiste)} poistettiin
         valinnasta: siirsit kirjauksen kauas siitä. Valitse piste uudelleen, jos mittaat
         sitä.</span>`
      : "";

    sijaintitila.innerHTML = `
      <span class="label">Mittauspisteen koordinaatti</span>
      <b class="sijaintitila__arvo">${esc(koordinaatti(tila.lat, tila.lon))}</b>
      <span class="sijaintitila__meta">${esc(lahdeteksti())}${lahin}</span>
      ${varoitus}`;
  }

  function valitsePiste(id, siirraSijainti) {
    pisteValinta.value = id;
    irronnutPiste = "";
    const p = pisteet.find((x) => x.id === id);
    if (p && siirraSijainti) {
      tila.lat = p.lat;
      tila.lon = p.lon;
      tila.lahde = "piste";
      paivitaSijainti();
      kartta.panTo([p.lat, p.lon]);
    }
  }

  // Kerrotaan tilarivillä, jos valinta tyhjennettiin. Muuten pisteen
  // katoaminen lomakkeesta näyttäisi siltä, että lomake unohti syötteen itse.
  let irronnutPiste = "";

  /**
   * Tyhjentää pistevalinnan, kun kirjattava sijainti on siirretty kauas
   * valitusta pisteestä. Ilman tätä lomake väittäisi mittauksen tehdyn siinä
   * pisteessä, vaikka koordinaatti olisi kilometrien päässä – ja väite
   * tallentuisi aineistoon.
   *
   * Poikkeus on pisteen sijainnin korjaus: jos mittaaja on rastittanut sen,
   * hän on nimenomaan siirtämässä pistettä oikeaan paikkaansa, eikä valintaa
   * saa viedä alta.
   */
  function irrotaVanhentunutPiste() {
    const valittu = pisteet.find((p) => p.id === pisteValinta.value);
    if (!valittu || kentat.korjaa.checked) return;
    if (etaisyys(tila.lat, tila.lon, valittu.lat, valittu.lon) <= PISTEEN_SIETO_M) return;
    pisteValinta.value = "";
    irronnutPiste = valittu.id;
  }

  kirjausMerkki.on("dragend", () => {
    const { lat, lng } = kirjausMerkki.getLatLng();
    tila.lat = lat;
    tila.lon = lng;
    tila.lahde = "kartta";
    tila.tarkkuus = null;
    irrotaVanhentunutPiste();
    paivitaSijainti();
  });

  pisteValinta.addEventListener("change", () => {
    irronnutPiste = "";
    if (pisteValinta.value) valitsePiste(pisteValinta.value, true);
    else paivitaSijainti();
  });

  /* --- Paikannus -------------------------------------------------------- */

  let ensimmainenPaikannus = true;

  function paikannusVirhe(err) {
    const syyt = {
      1: "Paikannus on estetty. Salli sijainnin käyttö selaimen asetuksista.",
      2: "Sijaintia ei saatu. Siirrä merkki kartalla oikeaan kohtaan.",
      3: "Paikannus kesti liian kauan. Siirrä merkki kartalla oikeaan kohtaan.",
    };
    naytaViesti(syyt[err.code] || "Sijaintia ei saatu.");
  }

  function seuraaSijaintia() {
    if (!("geolocation" in navigator)) {
      naytaViesti("Selain ei tue paikannusta. Siirrä merkki kartalla oikeaan kohtaan.");
      return;
    }
    navigator.geolocation.watchPosition(
      (sijainti) => {
        const { latitude, longitude, accuracy } = sijainti.coords;
        tila.gps = { lat: latitude, lon: longitude, tarkkuus: accuracy };

        if (!omaMerkki) {
          omaMerkki = L.marker([latitude, longitude], {
            icon: L.divIcon({
              className: "",
              html: '<span class="pin pin--oma" aria-hidden="true"></span>',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            }),
            alt: "Oma sijainti",
            interactive: false,
          }).addTo(kartta);
          omaYmpyra = L.circle([latitude, longitude], {
            radius: accuracy,
            className: "oma-tarkkuus",
            interactive: false,
          }).addTo(kartta);
        } else {
          omaMerkki.setLatLng([latitude, longitude]);
          omaYmpyra.setLatLng([latitude, longitude]).setRadius(accuracy);
        }

        // Ensimmäisellä paikannuksella siirrytään käyttäjän luo ja ehdotetaan
        // lähintä pistettä. Sen jälkeen ei enää, jotta kartta ei nykisi eikä
        // käsin tehty tarkennus katoa.
        if (ensimmainenPaikannus) {
          ensimmainenPaikannus = false;
          kaytaOmaaSijaintia();
          kartta.setView([latitude, longitude], 14);
        }
      },
      paikannusVirhe,
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
    );
  }

  function kaytaOmaaSijaintia() {
    if (!tila.gps) {
      naytaViesti("Sijaintia ei ole vielä saatu. Odota hetki.");
      return;
    }
    tila.lat = tila.gps.lat;
    tila.lon = tila.gps.lon;
    tila.tarkkuus = tila.gps.tarkkuus;
    tila.lahde = "gps";
    paivitaSijainti();
    kartta.panTo([tila.lat, tila.lon]);
    ehdotaLahinta();
  }

  /** Valitsee lähimmän pisteen listasta, mutta ei siirrä kirjattavaa sijaintia. */
  function ehdotaLahinta() {
    const osuma = lahinPiste(pisteet, tila.lat, tila.lon);
    if (!osuma) return;
    pisteValinta.value = osuma.piste.id;
    irronnutPiste = "";
    paivitaSijainti();
  }

  juuri.querySelector("[data-oma-sijainti]").addEventListener("click", kaytaOmaaSijaintia);
  juuri.querySelector("[data-lahin-piste]").addEventListener("click", () => {
    const osuma = lahinPiste(pisteet, tila.lat, tila.lon);
    if (osuma) valitsePiste(osuma.piste.id, true);
  });

  /* --- Lomake ----------------------------------------------------------- */

  const lomake = juuri.querySelector("[data-lomake]");
  const kentat = {
    pvm: juuri.querySelector("[data-pvm]"),
    klo: juuri.querySelector("[data-klo]"),
    nakosyvyys: juuri.querySelector("[data-nakosyvyys]"),
    mittaaja: juuri.querySelector("[data-mittaaja]"),
    huomiot: juuri.querySelector("[data-huomiot]"),
    korjaa: juuri.querySelector("[data-korjaa]"),
  };

  function asetaNyt() {
    kentat.pvm.value = tanaan();
    kentat.klo.value = kello();
  }
  asetaNyt();
  juuri.querySelector("[data-nyt]").addEventListener("click", asetaNyt);
  kentat.mittaaja.value = lue(AVAIN_MITTAAJA, "");

  let kirjaukset = lue(AVAIN_KIRJAUKSET, []);

  function naytaVirhe(teksti) {
    virhe.textContent = teksti;
    virhe.hidden = !teksti;
    if (teksti) kuittaus.hidden = true;
  }

  /**
   * Tallennuksen kuittaus. Ilman sitä lomake vain tyhjenee, eikä kirjaaja näe
   * mistään, menikö syöte perille – lista on työpöydällä kartan alla ja
   * puhelimella vasta lomakkeen jälkeen, eli usein näkymän ulkopuolella.
   */
  let kuittausAjastin = null;
  function naytaKuittaus(k) {
    kuittaus.innerHTML =
      `Tallennettu: <b>${esc(k.piste || "muu paikka")}</b>, ` +
      `<span class="num">${fiNum(k.nakosyvyys)}</span> m, ` +
      `<span class="num">${esc(fiDate(k.pvm))}</span> klo ` +
      `<span class="num">${esc(k.klo)}</span>. Kirjaus näkyy listassa.`;
    kuittaus.hidden = false;
    clearTimeout(kuittausAjastin);
    kuittausAjastin = setTimeout(() => {
      kuittaus.hidden = true;
    }, 10000);
  }

  lomake.addEventListener("submit", (e) => {
    e.preventDefault();

    const arvo = Number(String(kentat.nakosyvyys.value).replace(",", "."));
    if (!kentat.nakosyvyys.value || !Number.isFinite(arvo) || arvo <= 0 || arvo > 30) {
      naytaVirhe("Anna näkösyvyys metreinä, esimerkiksi 4,5.");
      kentat.nakosyvyys.focus();
      return;
    }
    if (!kentat.pvm.value || !kentat.klo.value) {
      naytaVirhe("Täytä päivämäärä ja kellonaika.");
      return;
    }
    naytaVirhe("");

    const piste = pisteet.find((p) => p.id === pisteValinta.value);
    const kirjaus = {
      id: `${kentat.pvm.value}-${kentat.klo.value.replace(":", "")}-${
        pisteValinta.value || "muu"
      }-${Math.random().toString(36).slice(2, 7)}`,
      pvm: kentat.pvm.value,
      klo: kentat.klo.value,
      piste: pisteValinta.value,
      pisteen_nimi: piste ? piste.nimi : "",
      nakosyvyys: Math.round(arvo * 10) / 10,
      lat: Number(tila.lat.toFixed(5)),
      lon: Number(tila.lon.toFixed(5)),
      sijainnin_lahde: tila.lahde,
      tarkkuus_m: tila.lahde === "gps" && tila.tarkkuus != null
        ? Math.round(tila.tarkkuus)
        : "",
      mittaaja: kentat.mittaaja.value.trim(),
      huomiot: kentat.huomiot.value.trim(),
      tallennettu: new Date().toISOString(),
    };

    kirjaukset = [kirjaus, ...kirjaukset];
    if (!kirjoita(AVAIN_KIRJAUKSET, kirjaukset)) {
      naytaVirhe(
        "Kirjausta ei saatu tallennettua selaimeen. Vie aiemmat kirjaukset " +
          "tiedostoksi ja yritä uudelleen."
      );
      kirjaukset = kirjaukset.slice(1);
      return;
    }
    kirjoita(AVAIN_MITTAAJA, kirjaus.mittaaja);

    // Pisteen sijainnin korjaus on erillinen tieto: se muuttaa kartan pistettä
    // pysyvästi tässä selaimessa ja tulee mukaan vientiin.
    if (kentat.korjaa.checked && piste) {
      korjaukset[piste.id] = {
        lat: kirjaus.lat,
        lon: kirjaus.lon,
        tarkkuus: "mitattu",
        korjattu: kirjaus.tallennettu,
      };
      kirjoita(AVAIN_KORJAUKSET, korjaukset);
      Object.assign(piste, korjaukset[piste.id]);
      pisteMerkit.get(piste.id).setLatLng([piste.lat, piste.lon]);
      pisteMerkit.get(piste.id).setIcon(pisteMerkki(piste, null));
      kentat.korjaa.checked = false;
    }

    kentat.nakosyvyys.value = "";
    kentat.huomiot.value = "";
    asetaNyt();
    piirraLista(kirjaus.id);
    naytaKuittaus(kirjaus);
    kentat.nakosyvyys.focus();
  });

  /* --- Lista ja vienti -------------------------------------------------- */

  const lista = juuri.querySelector("[data-lista]");

  const maara = juuri.querySelector("[data-maara]");

  const LAHDE_LYHYT = {
    gps: "puhelimen paikannus",
    kartta: "asetettu kartalla",
    piste: "pistelistasta",
  };

  /**
   * Yksi kirjaus listassa. Rivillä näkyvät kaikki tallennetut kentät, myös
   * mittaaja ja huomiot: kirjaaja ei voi muuten varmistua siitä, että syöte
   * meni perille oikein, eikä vietävää aineistoa pääse tarkistamaan mitenkään
   * ennen vientiä.
   */
  function kirjausRivi(k, uusin) {
    const rivit = [
      ["Paikka", k.piste
        ? `${esc(k.piste)}${k.pisteen_nimi ? ` – ${esc(k.pisteen_nimi)}` : ""}`
        : "muu paikka, ei listalla"],
      ["Koordinaatti", `<span class="num">${esc(koordinaatti(k.lat, k.lon))}</span>
        <span class="kirjaus__lahde">${esc(LAHDE_LYHYT[k.sijainnin_lahde] || k.sijainnin_lahde)}${
          k.tarkkuus_m ? `, ±${esc(k.tarkkuus_m)} m` : ""
        }</span>`],
    ];
    if (k.mittaaja) rivit.push(["Mittaaja", esc(k.mittaaja)]);
    if (k.huomiot) rivit.push(["Huomiot", esc(k.huomiot)]);

    return `<li class="kirjaus${uusin ? " kirjaus--uusin" : ""}">
      <div class="kirjaus__paa">
        <span class="kirjaus__arvo num">${fiNum(k.nakosyvyys)} m</span>
        <span class="kirjaus__aika num">${esc(fiDate(k.pvm))} klo ${esc(k.klo)}</span>
        <button class="kirjaus__poista" type="button" data-poista="${esc(k.id)}"
                aria-label="Poista kirjaus ${esc(k.piste)} ${esc(fiDate(k.pvm))}">Poista</button>
      </div>
      <dl class="kirjaus__tiedot">${rivit
        .map(([nimi, arvo]) => `<div><dt>${nimi}</dt><dd>${arvo}</dd></div>`)
        .join("")}</dl>
    </li>`;
  }

  function piirraLista(korostaId) {
    maara.textContent = kirjaukset.length ? `(${kirjaukset.length})` : "";
    if (!kirjaukset.length) {
      lista.innerHTML = '<p class="status">Ei vielä kirjauksia.</p>';
      return;
    }
    lista.innerHTML = `<ul class="kirjauslista">${kirjaukset
      .map((k) => kirjausRivi(k, k.id === korostaId))
      .join("")}</ul>`;

    lista.querySelectorAll("[data-poista]").forEach((nappi) => {
      nappi.addEventListener("click", () => {
        kirjaukset = kirjaukset.filter((k) => k.id !== nappi.dataset.poista);
        kirjoita(AVAIN_KIRJAUKSET, kirjaukset);
        piirraLista();
      });
    });
  }
  piirraLista();

  juuri.querySelector("[data-vie-json]").addEventListener("click", () => {
    lataa(
      `nakosyvyyskirjaukset-${tanaan()}.json`,
      JSON.stringify({ viety: new Date().toISOString(), kirjaukset, pistekorjaukset: korjaukset }, null, 1),
      "application/json"
    );
  });

  juuri.querySelector("[data-vie-csv]").addEventListener("click", () => {
    lataa(`nakosyvyyskirjaukset-${tanaan()}.csv`, csv(kirjaukset), "text/csv");
  });

  juuri.querySelector("[data-tyhjenna]").addEventListener("click", () => {
    if (!kirjaukset.length) return;
    // Vahvistus tekstinä samassa napissa: kaksi painallusta, ei dialogia.
    const nappi = juuri.querySelector("[data-tyhjenna]");
    if (nappi.dataset.varmistus !== "1") {
      nappi.dataset.varmistus = "1";
      nappi.textContent = "Varmista: poista kaikki";
      setTimeout(() => {
        nappi.dataset.varmistus = "0";
        nappi.textContent = "Tyhjennä kaikki";
      }, 5000);
      return;
    }
    kirjaukset = [];
    kirjoita(AVAIN_KIRJAUKSET, kirjaukset);
    nappi.dataset.varmistus = "0";
    nappi.textContent = "Tyhjennä kaikki";
    piirraLista();
  });

  paivitaSijainti();
  seuraaSijaintia();

  // Karttalaatat ja sivun osat talteen, jotta sivu aukeaa myös katvealueella.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("kirjaa-sw.js").catch((err) => {
      console.error("Offline-välimuistia ei saatu käyttöön:", err);
    });
  }
}

/* --- Portti -------------------------------------------------------------- */

function init() {
  const portti = document.querySelector("[data-portti]");
  const juuri = document.querySelector("[data-kirjaa]");
  if (!portti || !juuri) return;

  function avaa() {
    portti.hidden = true;
    juuri.hidden = false;
    kaynnista(juuri);
  }

  if (sessionStorage.getItem(AVAIN_PORTTI) === TUNNUS_TIIVISTE) {
    avaa();
    return;
  }

  const kentta = portti.querySelector("[data-tunnus]");
  const viesti = portti.querySelector("[data-portti-virhe]");
  portti.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (TUNNUS_KAYTOSSA && tiiviste(kentta.value.trim()) !== TUNNUS_TIIVISTE) {
      viesti.hidden = false;
      kentta.value = "";
      kentta.focus();
      return;
    }
    // Istuntokohtainen: selaimen sulkeminen vaatii tunnuksen uudelleen.
    sessionStorage.setItem(AVAIN_PORTTI, TUNNUS_TIIVISTE);
    avaa();
  });
  if (TUNNUS_KAYTOSSA) kentta.focus();
}

init();
