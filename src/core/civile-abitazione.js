// Calcolo del livello di prestazione GSA per edifici di civile abitazione (DM 246/1987 + DM 25/1/2019, punto 9-bis).
// Funzioni pure, aritmetica intera in millimetri (nessun numero binario in virgola mobile sulle quote).
// Ogni dato ha uno stato: verificato | dichiarato | stimato | non_disponibile | non_applicabile.
// Un dato decisivo mancante produce INDETERMINATO con l'elenco dei dati mancanti: mai un "no" implicito.
import { REGOLE_DM246 as R } from "./regole-dm246.js";

export const STATI_DATO = ["verificato", "dichiarato", "stimato", "non_disponibile", "non_applicabile"];
export const SI_NO_VERIFICA = ["si", "no", "da_verificare"];

// Quote in mm intere: converte un valore in metri inserito dall'utente (2 decimali) in mm senza errori di arrotondamento
export function metriAMm(valoreMetri) {
  if (valoreMetri === null || valoreMetri === undefined || valoreMetri === "") return null;
  const s = String(valoreMetri).trim().replace(",", ".");
  if (!/^-?\d+(\.\d{1,3})?$/.test(s)) return { errore: `quota non valida: ${valoreMetri}` };
  const [parte, dec = ""] = s.split(".");
  const neg = parte.startsWith("-");
  const intero = Math.abs(Number(parte)) * 1000 + Number((dec + "000").slice(0, 3));
  return neg ? -intero : intero;
}

// Altezza antincendi (DM 30/11/1983, p. 1.1 - formula di progetto, da verificare sul testo del 1983):
// h = quota apertura di riferimento - quota piano esterno di riferimento. Tutto in mm interi.
export function altezzaAntincendi(d = {}) {
  const avvisi = [];
  const mancanti = [];
  const stato = d.stato ?? "dichiarato";
  if (!STATI_DATO.includes(stato)) return { errore: `stato del dato non valido: ${stato}` };
  if (!Number.isInteger(d.quota_apertura_mm)) mancanti.push("quota dell'apertura di riferimento (livello inferiore dell'apertura piu' alta, esclusi vani tecnici)");
  if (!Number.isInteger(d.quota_piano_esterno_mm)) mancanti.push("quota del piano esterno di riferimento (piano esterno accessibile ai mezzi di soccorso)");
  if (mancanti.length) return { h_mm: null, stato, esito: "INDETERMINATO", mancanti, avvisi };
  const h = d.quota_apertura_mm - d.quota_piano_esterno_mm;
  if (d.piano_esterno_accessibile_mezzi_vvf !== true) {
    avvisi.push({ bloccante: true, testo: "piano di riferimento non conforme al chiarimento ministeriale: il piano esterno deve essere accessibile ai mezzi di soccorso (DM 246/1987 nota 2, chiarimento P558/4122 del 24/03/2004)" });
  }
  if (d.vani_tecnici_esclusi !== true) avvisi.push({ bloccante: false, testo: "confermare che i vani tecnici sono esclusi dal calcolo dell'apertura di riferimento" });
  if (stato === "stimato") avvisi.push({ bloccante: false, testo: "altezza stimata: risultato PROVVISORIO" });
  if (Number.isInteger(d.altezza_dichiarata_mm) && Math.abs(h - d.altezza_dichiarata_mm) > R.tolleranza_incoerenza_mm) {
    avvisi.push({ bloccante: false, testo: `altezza calcolata ${h} mm diversa da quella dichiarata ${d.altezza_dichiarata_mm} mm oltre ${R.tolleranza_incoerenza_mm} mm: verificare il rilievo` });
  }
  for (const s of R.soglie_prossimita_mm) {
    if (Math.abs(h - s) <= R.tolleranza_prossimita_mm) avvisi.push({ bloccante: false, testo: `h = ${h} mm e' a meno di ${R.tolleranza_prossimita_mm} mm dalla soglia ${s} mm: verificare il rilievo` });
  }
  return { h_mm: h, stato, esito: "DETERMINATO", mancanti: [], avvisi };
}

// Tipo di edificio (Tabella A, DM 246/1987 punto 2.0) e LP base (DM 25/1/2019 punto 9-bis.2)
export function classificaTipo(h_mm) {
  if (h_mm < R.limite_campo_mm) return { tipo: null, lp_base: null, fuori_campo: true, avvisi: [] };
  const avvisi = [];
  const tipo = R.tipi.find((t) => h_mm >= (t.id === "a" ? R.limite_campo_mm : t.da_mm + 1) && (t.a_mm === null || h_mm <= t.a_mm));
  if (h_mm === 24000) avvisi.push({ bloccante: false, testo: "h = 24,00 m: la Tabella A include 24 m nel tipo a (LP 0), il punto 9-bis.3.1 scrive 12 m <= h < 24 m e il 9-bis.3.2 scrive 24 m < h. Applicato il tipo a: da confermare." });
  return { tipo: tipo.id, lp_base: tipo.lp_base, fuori_campo: false, avvisi };
}

// Incremento per attivita' comunicanti non pertinenti (DM 25/1/2019, punto 9-bis.2)
// attivita: [{ descrizione, soggetta_DPR151, comunicante, pertinente }] con valori si | no | da_verificare
export function incrementoAttivita(h_mm, attivita = []) {
  if (h_mm <= R.incremento.soglia_h_mm) return { stato: "non_applicabile", motivo: `h <= ${R.incremento.soglia_h_mm} mm: l'incremento si applica solo oltre 24 m` };
  const applicato = attivita.filter((a) => a.soggetta_DPR151 === "si" && a.comunicante === "si" && a.pertinente === "no");
  if (applicato.length) return { stato: "applicato", motivo: `attivita comunicante non pertinente soggetta al DPR 151/2011: ${applicato.map((a) => a.descrizione || "senza descrizione").join("; ")}`, passi: R.incremento.passi };
  // Un'attivita' ancora non escludibile tiene aperto lo scenario con incremento
  const dubbie = attivita.filter((a) => a.soggetta_DPR151 !== "no" && a.comunicante !== "no" && a.pertinente !== "si");
  if (dubbie.length) return { stato: "da_verificare", motivo: `attivita da verificare: ${dubbie.map((a) => a.descrizione || "senza descrizione").join("; ")}`, passi: R.incremento.passi };
  return { stato: "non_applicabile", motivo: "nessuna attivita' comunicante non pertinente soggetta al DPR 151/2011" };
}

// Classe da limiti del registro: oltre_<u> esclusivo, fino_a_<u> inclusivo
function classeInSoglie(valore, classi, unita) {
  const c = classi.find((k) => (k[`oltre_${unita}`] === undefined || valore > k[`oltre_${unita}`]) && (k[`fino_a_${unita}`] === undefined || valore <= k[`fino_a_${unita}`]));
  return c ? c.classe : null;
}

// Attivita' 77 (DPR 151/2011 all. I, n. 77): edificio civile con altezza antincendi > 24 m. Classe dalla sola h.
export function categoriaAttivita77(h_mm) {
  const c = R.dpr151["77"];
  if (!Number.isInteger(h_mm)) return { stato: "non_calcolata", motivo: "altezza antincendi non disponibile" };
  if (h_mm <= c.soglia_h_mm) return { stato: "non_soggetta", motivo: `h <= ${c.soglia_h_mm} mm: attivita' 77 non prevista` };
  return { stato: "soggetta", classe: classeInSoglie(h_mm, c.classi, "mm"), motivo: `altezza antincendi ${h_mm} mm (DPR 151/2011 n. 77)` };
}

// Altre attivita' DPR 151/2011 dichiarate: { descrizione, categoria_dpr151: "74"|"49"|"75", potenza_kw, superficie_m2 }
// Output separato dall'incremento LP. Le attivita' senza categoria o con categoria non codificata restano non_classificate.
export function classificaAttivitaDPR(a = {}) {
  const base = { descrizione: a.descrizione || "senza descrizione", categoria_dpr151: a.categoria_dpr151 ?? null };
  const cat = a.categoria_dpr151;
  if (cat === "74" || cat === "49") {
    const c = R.dpr151[cat];
    if (!Number.isFinite(a.potenza_kw)) return { ...base, stato: "dati_mancanti", motivo: "potenza in kW non indicata" };
    if (a.potenza_kw <= c.soglia_kw) return { ...base, stato: "non_soggetta", motivo: `potenza ${a.potenza_kw} kW non superiore a ${c.soglia_kw} kW` };
    return { ...base, stato: "soggetta", classe: classeInSoglie(a.potenza_kw, c.classi, "kw"), motivo: `potenza ${a.potenza_kw} kW (DPR 151/2011 n. ${cat})` };
  }
  if (cat === "75") {
    const c = R.dpr151["75"];
    if (!Number.isFinite(a.superficie_m2)) return { ...base, stato: "dati_mancanti", motivo: "superficie coperta in m2 non indicata" };
    if (a.superficie_m2 <= c.soglia_m2) return { ...base, stato: "non_soggetta", motivo: `superficie ${a.superficie_m2} m2 non superiore a ${c.soglia_m2} m2` };
    return { ...base, stato: "soggetta", classe: null, motivo: "classe di dettaglio (n. 75) non ancora codificata" };
  }
  return { ...base, stato: "non_classificata", motivo: "indicare la categoria DPR 151/2011 (74, 49 o 75); altre categorie non ancora codificate" };
}

// Valutazione completa. input: { quote: {...} , attivita: [...] , piano_esterno_accessibile_mezzi_vvf, ... }
export function valutaCivileAbitazione(input = {}) {
  const alt = altezzaAntincendi(input.altezza ?? {});
  if (alt.errore) return { esito: "ERRORE", errore: alt.errore };
  const riferimenti = ["DM 16/5/1987 n. 246, punto 1.0, 1.1, 2.0 (Tabella A)", "DM 25/1/2019, punto 9-bis.2", "DM 30/11/1983, p. 1.1 (altezza antincendi, estratto, in attesa di approvazione)", "DPR 151/2011 all. I, n. 74, 49, 75, 77 (estratto, in attesa di approvazione)"];
  const base = {
    versione_regole: R.versione_regole,
    stato_regole: R.stato,
    avvertenza: "Strumento di supporto al professionista. Non attesta la conformita' antincendio e non sostituisce la valutazione di un tecnico abilitato.",
    altezza: { h_mm: alt.h_mm, stato: alt.stato, avvisi: alt.avvisi },
    riferimenti,
    stato_dpr151: R.dpr151.stato,
    categoria_attivita_77: categoriaAttivita77(alt.h_mm),
    altre_attivita: (input.attivita ?? []).map(classificaAttivitaDPR),
    percorso_codice_v14: "non_calcolato: fuori dalla v1",
  };
  if (alt.esito === "INDETERMINATO") return { ...base, esito: "INDETERMINATO", dati_mancanti: alt.mancanti, lp_finale: null };
  const cls = classificaTipo(alt.h_mm);
  if (cls.fuori_campo) return { ...base, esito: "FUORI_CAMPO", tipo: null, lp_finale: null, dati_mancanti: [], avvisi: [...alt.avvisi], nota: "h sotto 12 m: DM 246/1987 non applicabile (verificare altre attivita' soggette)." };
  const inc = incrementoAttivita(alt.h_mm, input.attivita ?? []);
  const lpBase = cls.lp_base;
  const conIncremento = Math.min(lpBase + (inc.stato === "applicato" || inc.stato === "da_verificare" ? R.incremento.passi : 0), R.incremento.tetto_lp);
  const scenari = inc.stato === "da_verificare" ? { senza_incremento: lpBase, con_incremento: conIncremento } : null;
  const lpFinale = inc.stato === "applicato" ? conIncremento : inc.stato === "da_verificare" ? null : lpBase;
  const esito = inc.stato === "da_verificare" ? "INDETERMINATO" : "DETERMINATO";
  const dati = inc.stato === "da_verificare" ? [`attivita comunicante: stabilire se e' pertinente e soggetta al DPR 151/2011 (${inc.motivo})`] : [];
  return {
    ...base,
    esito,
    tipo: cls.tipo,
    lp_base: lpBase,
    incremento: inc,
    lp_finale: lpFinale,
    scenari,
    dati_mancanti: dati,
    avvisi: [...alt.avvisi, ...cls.avvisi],
    misure: { rinvio: `DM 25/1/2019 punto 9-bis.3.${lpFinale === null ? "x" : lpFinale === 0 ? "1" : lpFinale === 1 ? "2" : lpFinale === 2 ? "3" : "4"} (Tabella ${lpFinale ?? "—"}) - contenuto da codificare`, stato: "non_codificate" },
  };
}
