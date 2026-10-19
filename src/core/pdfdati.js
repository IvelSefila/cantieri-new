// Estrazione dei dati energetici dal testo di una relazione tecnica (ex Legge 10 / DM 26/06/2015) già letto da un PDF.
// Non indovina: ogni campo trovato riporta la riga da cui viene; quelli assenti finiscono in `mancanti`
// e l'utente li inserisce a mano. Se lo stesso dato compare con valori diversi (per esempio una relazione con più
// zone termiche) il campo viene segnalato in `ambigui` con tutti i valori: va scelto a mano.
// Accetta decimali con virgola o con punto, separatori delle migliaia con spazio o punto.

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

function rigaDi(testo, indice) {
  const inizio = testo.lastIndexOf("\n", indice) + 1;
  const fine = testo.indexOf("\n", indice);
  return testo.slice(inizio, fine < 0 ? undefined : fine).replace(/\s+/g, " ").trim();
}

const temperatura = (m) => (/K/i.test(m[2]) ? numero(m[1]) - 273.15 : numero(m[1]));
const primo = (m) => numero(m[1]);

// Ogni campo: una o più espressioni, in ordine di preferenza. Si usa la prima che trova qualcosa.
const REGOLE = {
  superficie_utile_m2: [[new RegExp(`superficie utile[^\\d\\n]*?(${NUM})`, "gi"), primo]],
  volume_m3: [[new RegExp(`\\(V\\)[^\\d\\n]*?(${NUM})`, "gi"), primo]],
  superficie_disperdente_m2: [[new RegExp(`\\(S\\)[^\\d\\n]*?(${NUM})`, "gi"), primo]],
  // "1415 GG" (maiuscolo: "166 gg" sono i giorni di riscaldamento), oppure "Gradi giorno ... 1415" senza "DPR 412/93"
  gg: [
    [/(\d{3,4})\s*GG\b/g, primo],
    [/gradi\s+giorno\b[^\n]*?(?<![\d/])(\d{3,4})(?![\d/])/gi, primo],
  ],
  theta_ext_inv_C: [[new RegExp(`temperatura (?:minima di progetto|(?:di )?progetto invernale)[\\s\\S]{0,250}?(${NUM})\\s*°\\s*([KC])`, "gi"), temperatura]],
  theta_ext_est_C: [[new RegExp(`temperatura (?:massima estiva|(?:di )?progetto estiva)[\\s\\S]{0,250}?(${NUM})\\s*°\\s*([KC])`, "gi"), temperatura]],
  asol_rapporto_dichiarato: [[new RegExp(`asol,?\\s*est\\s*/\\s*asup,?\\s*utile[^\\d\\n]*?(${NUM})`, "gi"), primo]],
};

export const CAMPI_RICHIESTI = ["superficie_utile_m2", "volume_m3", "superficie_disperdente_m2", "gg", "theta_ext_inv_C", "theta_ext_est_C"];

export function parseDatiEnergetici(testo) {
  const t = String(testo ?? "");
  const campi = {};
  const trovati = [];
  const ambigui = [];
  for (const [campo, regole] of Object.entries(REGOLE)) {
    for (const [regex, valore] of regole) {
      const valori = [];
      for (const m of t.matchAll(regex)) {
        const v = valore(m);
        if (v !== null && Number.isFinite(v)) valori.push({ v, riga: rigaDi(t, m.index) });
      }
      if (!valori.length) continue;
      campi[campo] = valori[0].v;
      trovati.push({ campo, valore: valori[0].v, riga: valori[0].riga });
      const distinti = [...new Set(valori.map((x) => Math.round(x.v * 1000) / 1000))];
      if (distinti.length > 1) ambigui.push({ campo, valori: distinti, scelto: valori[0].v });
      break;
    }
  }
  const mancanti = CAMPI_RICHIESTI.filter((c) => campi[c] === undefined);
  return { campi, trovati, mancanti, ambigui };
}
