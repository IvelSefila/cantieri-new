// Calcolo del livello di prestazione GSA per edifici di civile abitazione (DM 246/1987 + DM 25/1/2019, punto 9-bis).
// Funzioni pure, aritmetica intera in millimetri (nessun numero binario in virgola mobile sulle quote).
// Ogni dato ha uno stato: verificato | dichiarato | stimato | non_disponibile | non_applicabile.
// Un dato decisivo mancante, un conflitto tra fonti o un intervallo che tocca una soglia produce INDETERMINATO
// con motivo e azione richiesta: mai un "no" implicito.
import { REGOLE_DM246 as R } from "./regole-dm246.js?v=v20261021a";

export const STATI_DATO = ["verificato", "dichiarato", "stimato", "non_disponibile", "non_applicabile"];
export const SI_NO_VERIFICA = ["si", "no", "da_verificare"];

const MANCANTE_APERTURA = "quota dell'apertura di riferimento (livello inferiore dell'apertura piu' alta, esclusi vani tecnici)";
const MANCANTE_PIANO = "quota del piano esterno di riferimento (piano esterno accessibile ai mezzi di soccorso)";
const AZIONE_SOGLIA = `acquisire una quota di dettaglio dell'apertura piu' alta dell'ultimo piano abitabile (rilievo puntuale o sezione quotata della pratica), con incertezza entro ${R.tolleranza_prossimita_mm} mm`;

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

// Fonti dell'altezza antincendi. Ogni fonte e' un valore esatto { h_mm } oppure un intervallo { min_mm, max_mm } in mm.
// Esempi: { fonte: "pratica", h_mm: 30000 }, { fonte: "LiDAR", min_mm: 29700, max_mm: 30300, stato: "stimato" }.
function leggiFonti(lista) {
  const fonti = [];
  for (const f of lista) {
    const min = Number.isInteger(f.h_mm) ? f.h_mm : f.min_mm;
    const max = Number.isInteger(f.h_mm) ? f.h_mm : f.max_mm;
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) return { errore: `fonte non valida: ${f.fonte ?? "senza nome"} (serve h_mm, oppure min_mm <= max_mm, interi in mm)` };
    const stato = f.stato ?? "dichiarato";
    if (!STATI_DATO.includes(stato)) return { errore: `stato del dato non valido per la fonte ${f.fonte ?? "senza nome"}: ${stato}` };
    fonti.push({ fonte: f.fonte ?? "senza nome", min_mm: min, max_mm: max, stato });
  }
  return { fonti };
}

// Altezza antincendi (DM 30/11/1983, p. 1.1): h = quota apertura di riferimento - quota piano esterno di riferimento.
// Fusione conservativa: l'intervallo finale e' l'inviluppo di tutte le fonti; fonti in disaccordo oltre la tolleranza sono un conflitto.
// Esito DETERMINATO solo se l'intervallo non attraversa e non sfiora (entro la tolleranza) una soglia di tipo/LP.
export function altezzaAntincendi(d = {}) {
  const avvisi = [];
  const stato = d.stato ?? "dichiarato";
  if (!STATI_DATO.includes(stato)) return { errore: `stato del dato non valido: ${stato}` };
  let fonti;
  if (Array.isArray(d.fonti)) {
    if (d.fonti.length === 0) return { h_mm: null, h_min_mm: null, h_max_mm: null, stato, esito: "INDETERMINATO", motivo: "nessuna_fonte", mancanti: ["nessuna fonte per l'altezza antincendi: indicare almeno un rilievo, una pratica o una stima"], conflitti: [], avvisi, azione: null };
    const lette = leggiFonti(d.fonti);
    if (lette.errore) return { errore: lette.errore };
    fonti = lette.fonti;
  } else {
    const mancanti = [];
    if (!Number.isInteger(d.quota_apertura_mm)) mancanti.push(MANCANTE_APERTURA);
    if (!Number.isInteger(d.quota_piano_esterno_mm)) mancanti.push(MANCANTE_PIANO);
    if (mancanti.length) return { h_mm: null, h_min_mm: null, h_max_mm: null, stato, esito: "INDETERMINATO", motivo: "dati_mancanti", mancanti, conflitti: [], avvisi, azione: null };
    const h = d.quota_apertura_mm - d.quota_piano_esterno_mm;
    fonti = [{ fonte: "quote dichiarate", min_mm: h, max_mm: h, stato }];
  }
  const statoGlobale = fonti.some((f) => f.stato === "stimato") ? "stimato" : stato;
  if (d.piano_esterno_accessibile_mezzi_vvf !== true) {
    avvisi.push({ bloccante: true, testo: "piano di riferimento non conforme al chiarimento ministeriale: il piano esterno deve essere accessibile ai mezzi di soccorso (DM 246/1987 nota 2, chiarimento P558/4122 del 24/03/2004)" });
  }
  if (d.vani_tecnici_esclusi !== true) avvisi.push({ bloccante: false, testo: "confermare che i vani tecnici sono esclusi dal calcolo dell'apertura di riferimento" });
  if (statoGlobale === "stimato") avvisi.push({ bloccante: false, testo: "altezza stimata: risultato PROVVISORIO" });

  // Fusione: inviluppo conservativo e controllo di coerenza a coppie
  const lo = Math.min(...fonti.map((f) => f.min_mm));
  const hi = Math.max(...fonti.map((f) => f.max_mm));
  const conflitti = [];
  for (let i = 0; i < fonti.length; i++) {
    for (let j = i + 1; j < fonti.length; j++) {
      const a = fonti[i], b = fonti[j];
      const distanza = Math.max(b.min_mm - a.max_mm, a.min_mm - b.max_mm);
      if (distanza > R.tolleranza_incoerenza_mm) conflitti.push({ fonti: [a.fonte, b.fonte], distanza_mm: distanza });
    }
  }
  const base = { fonti, stato: statoGlobale, avvisi, conflitti, h_min_mm: lo, h_max_mm: hi };
  if (conflitti.length) {
    const coppie = conflitti.map((c) => `${c.fonti[0]} / ${c.fonti[1]} (${c.distanza_mm} mm)`).join("; ");
    return { ...base, h_mm: null, esito: "INDETERMINATO", motivo: "conflitto", mancanti: [], azione: `le fonti sono in disaccordo oltre ${R.tolleranza_incoerenza_mm} mm: ${coppie}. Verificare quale fonte e' corretta` };
  }

  // Valore esatto: nessuna incertezza, si applicano solo gli avvisi di prossimita' alle soglie
  if (lo === hi) {
    const h = lo;
    if (Number.isInteger(d.altezza_dichiarata_mm) && Math.abs(h - d.altezza_dichiarata_mm) > R.tolleranza_incoerenza_mm) {
      avvisi.push({ bloccante: false, testo: `altezza calcolata ${h} mm diversa da quella dichiarata ${d.altezza_dichiarata_mm} mm oltre ${R.tolleranza_incoerenza_mm} mm: verificare il rilievo` });
    }
    for (const s of R.soglie_prossimita_mm) {
      if (Math.abs(h - s) <= R.tolleranza_prossimita_mm) avvisi.push({ bloccante: false, testo: `h = ${h} mm e' a meno di ${R.tolleranza_prossimita_mm} mm dalla soglia ${s} mm: verificare il rilievo` });
    }
    return { ...base, h_mm: h, esito: "DETERMINATO", motivo: null, mancanti: [], azione: null };
  }

  // Intervallo: non deve attraversare una soglia e non deve sfiorarla entro la tolleranza
  const M = R.tolleranza_prossimita_mm;
  const attraversata = R.soglie_prossimita_mm.find((s) => lo < s && s < hi);
  const vicina = R.soglie_prossimita_mm.find((s) => Math.abs(lo - s) < M || Math.abs(hi - s) < M);
  if (attraversata !== undefined || vicina !== undefined) {
    const soglia = attraversata ?? vicina;
    return { ...base, h_mm: null, esito: "INDETERMINATO", motivo: attraversata !== undefined ? "soglia_attraversata" : "soglia_vicina", soglia_mm: soglia, mancanti: [], azione: `${AZIONE_SOGLIA} (soglia ${soglia} mm)` };
  }
  avvisi.push({ bloccante: false, testo: `altezza su intervallo [${lo}, ${hi}] mm: nessuna soglia attraversata o sfiorata` });
  return { ...base, h_mm: null, esito: "DETERMINATO", motivo: null, mancanti: [], azione: null };
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

// Attivita' 77 (DPR 151/2011 all. I, n. 77): edificio civile con altezza antincendi > 24 m. Classe dall'altezza.
// Con un intervallo restituisce le classi possibili invece di una sola.
export function categoriaAttivita77(lo_mm, hi_mm = lo_mm) {
  const c = R.dpr151["77"];
  if (!Number.isInteger(lo_mm) || !Number.isInteger(hi_mm)) return { stato: "non_calcolata", motivo: "altezza antincendi non disponibile" };
  if (hi_mm <= c.soglia_h_mm) return { stato: "non_soggetta", motivo: `h <= ${c.soglia_h_mm} mm: attivita' 77 non prevista` };
  if (lo_mm <= c.soglia_h_mm) return { stato: "soggetta_incerta", motivo: `intervallo [${lo_mm}, ${hi_mm}] mm attraversa ${c.soglia_h_mm} mm` };
  const bordi = c.classi.map((k) => k.fino_a_mm).filter(Number.isInteger);
  const punti = [lo_mm, ...bordi.filter((b) => b > lo_mm && b < hi_mm).flatMap((b) => [b, b + 1]), hi_mm];
  const possibili = [...new Set(punti.map((p) => classeInSoglie(p, c.classi, "mm")))];
  if (possibili.length === 1) return { stato: "soggetta", classe: possibili[0], motivo: `altezza antincendi [${lo_mm}, ${hi_mm}] mm (DPR 151/2011 n. 77)` };
  return { stato: "soggetta_classe_incerta", classi_possibili: possibili, motivo: `intervallo [${lo_mm}, ${hi_mm}] mm (DPR 151/2011 n. 77)` };
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

// Valutazione completa. input: { altezza: { fonti | quote, piano_esterno_accessibile_mezzi_vvf, ... }, attivita: [...] }
export function valutaCivileAbitazione(input = {}) {
  const alt = altezzaAntincendi(input.altezza ?? {});
  if (alt.errore) return { esito: "ERRORE", errore: alt.errore };
  const riferimenti = ["DM 16/5/1987 n. 246, punto 1.0, 1.1, 2.0 (Tabella A)", "DM 25/1/2019, punto 9-bis.2", "DM 30/11/1983, p. 1.1 (altezza antincendi, estratto, in attesa di approvazione)", "DPR 151/2011 all. I, n. 74, 49, 75, 77 (estratto, in attesa di approvazione)"];
  const base = {
    versione_regole: R.versione_regole,
    stato_regole: R.stato,
    avvertenza: "Strumento di supporto al professionista. Non attesta la conformita' antincendio e non sostituisce la valutazione di un tecnico abilitato.",
    altezza: { h_mm: alt.h_mm, h_min_mm: alt.h_min_mm, h_max_mm: alt.h_max_mm, stato: alt.stato, fonti: alt.fonti ?? [], conflitti: alt.conflitti ?? [], avvisi: alt.avvisi },
    riferimenti,
    stato_dpr151: R.dpr151.stato,
    categoria_attivita_77: categoriaAttivita77(alt.h_min_mm, alt.h_max_mm),
    altre_attivita: (input.attivita ?? []).map(classificaAttivitaDPR),
    percorso_codice_v14: "non_calcolato: fuori dalla v1",
  };
  if (alt.esito === "INDETERMINATO") {
    return { ...base, esito: "INDETERMINATO", motivo: alt.motivo, soglia_mm: alt.soglia_mm, dati_mancanti: alt.mancanti.length ? alt.mancanti : [alt.azione].filter(Boolean), azione: alt.azione, lp_finale: null };
  }
  if (alt.avvisi.some(a => a.bloccante)) {
    return { ...base, esito: "INDETERMINATO", motivo: "riferimento_non_verificato", dati_mancanti: alt.avvisi.filter(a => a.bloccante).map(a => a.testo), azione: "Verificare il piano esterno di riferimento prima della classificazione", lp_finale: null };
  }
  const lo = alt.h_min_mm;
  const cls = classificaTipo(lo);
  if (cls.fuori_campo) return { ...base, esito: "FUORI_CAMPO", tipo: null, lp_finale: null, dati_mancanti: [], avvisi: [...alt.avvisi], nota: "h sotto 12 m: DM 246/1987 non applicabile (verificare altre attivita' soggette)." };
  const inc = incrementoAttivita(lo, input.attivita ?? []);
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
