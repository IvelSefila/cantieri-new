// Estrazione dei dati energetici dal testo di una relazione tecnica (ex Legge 10 / DM 26/06/2015) gia' letto da un PDF.
// Non indovina: ogni campo trovato riporta la riga da cui viene; quelli assenti finiscono in `mancanti`
// e l'utente li inserisce a mano. Accetta decimali con virgola o con punto, separatori delle migliaia con spazio o punto.

// Un numero dal testo: "1 846,86" -> 1846.86, "385.36" -> 385.36, "0,00" -> 0, "1.415" -> 1415
export function numero(testo) {
  if (testo == null) return null;
  const s = String(testo).trim();
  if (/^-?\d{1,3}([ .]\d{3})+$/.test(s)) return Number(s.replace(/[ .]/g, ""));
  let t = s.replace(/ /g, "");
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

// Un numero: intero, decimale con , o ., o con separatore delle migliaia (non include altri numeri sulla riga)
const NUM = "-?(?:\\d{1,3}(?:[ .]\\d{3})+|\\d+)(?:[.,]\\d+)?";

function primaRiga(testo, regex) {
  // la riga che contiene il match (per citarla nel risultato)
  const idx = testo.search(regex);
  if (idx < 0) return null;
  const inizio = testo.lastIndexOf("\n", idx) + 1;
  const fine = testo.indexOf("\n", idx);
  return testo.slice(inizio, fine < 0 ? undefined : fine).replace(/\s+/g, " ").trim();
}

export function parseDatiEnergetici(testo) {
  const t = String(testo ?? "");
  const campi = {};
  const trovati = [];
  const mancanti = [];

  const cerca = (campo, regex, valore) => {
    const m = t.match(regex);
    if (!m) return;
    const v = valore(m);
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    campi[campo] = v;
    trovati.push({ campo, valore: v, riga: primaRiga(t, regex) });
  };

  // Superficie utile (m2), prima colonna della tabella
  cerca("superficie_utile_m2", new RegExp(`superficie utile[^\\d\\n]*?(${NUM})`, "i"), (m) => numero(m[1]));
  // Volume lordo (V) e superficie disperdente (S): il valore e' dopo le sigle "(V)" e "(S)"
  cerca("volume_m3", new RegExp(`\\(V\\)[^\\d\\n]*?(${NUM})`, "i"), (m) => numero(m[1]));
  cerca("superficie_disperdente_m2", new RegExp(`\\(S\\)[^\\d\\n]*?(${NUM})`, "i"), (m) => numero(m[1]));
  // Gradi giorno: "1415 GG"
  cerca("gg", /(\d{3,4})\s*GG\b/i, (m) => numero(m[1]));
  // Temperature di progetto: il numero e' quello davanti a "°K" o "°C" (la voce puo' andare a capo)
  const temperatura = (etichetta) => (m) => (/K/i.test(m[2]) ? numero(m[1]) - 273.15 : numero(m[1]));
  cerca("theta_ext_inv_C", new RegExp(`temperatura minima di progetto[\\s\\S]{0,250}?(${NUM})\\s*°\\s*([KC])`, "i"), temperatura("inv"));
  cerca("theta_ext_est_C", new RegExp(`temperatura massima estiva[\\s\\S]{0,250}?(${NUM})\\s*°\\s*([KC])`, "i"), temperatura("est"));
  // Rapporto Asol,est / Asup utile dichiarato dal software (per il confronto con il calcolo)
  cerca("asol_rapporto_dichiarato", new RegExp(`asol,?\\s*est\\s*/\\s*asup,?\\s*utile[^\\d\\n]*?(${NUM})`, "i"), (m) => numero(m[1]));

  for (const c of ["superficie_utile_m2", "volume_m3", "superficie_disperdente_m2", "gg", "theta_ext_inv_C", "theta_ext_est_C"]) {
    if (campi[c] === undefined) mancanti.push(c);
  }
  return { campi, trovati, mancanti };
}
