/**
 * Näkösyvyyden luokittelu.
 *
 * Tämä on oma moduulinsa eikä osa site.js:ää tarkoituksella. site.js on
 * sivuston vanhin ja pisimpään välimuistissa ollut tiedosto, ja selain voi
 * tarjoilla siitä vanhan kopion jopa kymmenen minuuttia julkaisun jälkeen.
 * Jos uusi moduuli tuo site.js:stä uuden viennin, tuonti kaatuu
 * SyntaxErroriin juuri niillä käyttäjillä – ja moduulivirhettä ei voi
 * siepata sivulla. Uusi tiedosto ei voi olla välimuistissa vanhentuneena,
 * joten jaettu uusi koodi kuuluu tänne.
 *
 * Tunnus 1 = sameinta vettä, 6 = kirkkainta. Sama sarja ohjaa
 * rekisteritaulukon soluja, karttamerkkejä ja selitteitä.
 */
export const BINS = [
  { bin: 1, min: 0, label: "alle 2" },
  { bin: 2, min: 2, label: "2–3" },
  { bin: 3, min: 3, label: "3–4" },
  { bin: 4, min: 4, label: "4–5" },
  { bin: 5, min: 5, label: "5–6" },
  { bin: 6, min: 6, label: "6 tai yli" },
];

export function binOf(value) {
  let hit = BINS[0];
  for (const b of BINS) if (value >= b.min) hit = b;
  return hit.bin;
}
