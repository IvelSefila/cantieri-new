// Scheda "Energia": dati inseriti a mano o estratti da un PDF di relazione tecnica, calcoli di base
// (riscaldamento, raffrescamento, fotovoltaico, solare termico) e lista dei dati mancanti.
// Nessuna rete: il PDF viene letto nel browser con pdf.js (vendor/pdfjs), i dati restano in memoria della pagina.
import { DEFAULT_ENERGIA, dispersioneTrasmissione, caricoInvernale, fabbisognoRiscaldamento, caricoEstivo,
  eerCondizionatore, copPompaCalore, fotovoltaico, solareTermico } from "../core/energia.js";
import { CLIMA_ROMA } from "../core/clima.js";
import { parseDatiEnergetici } from "../core/pdfdati.js";
import { DEFAULT_GSA } from "../core/gsa.js";

// Valori inseriti dall'utente. null = dato mancante (non c'e' un default). Il default di Roma e' dichiarato in clima.js.
export function valoriIniziali() {
  return {
    superficie_utile_m2: null,
    volume_m3: null,
    superficie_disperdente_m2: null,
    U_medio_W_m2K: null,          // trasmittanza media dell'involucro: dato di progetto, non stimato
    gg: CLIMA_ROMA.gradiGiorno,
    theta_ext_inv_C: DEFAULT_ENERGIA.theta_ext_inv,
    theta_ext_est_C: DEFAULT_ENERGIA.theta_ext_est,
    ricambi_h: DEFAULT_ENERGIA.ricambi_h,
    FF: 0.2,                      // frazione telaio: da scheda del serramento
    gglsh: null,                  // trasmittanza estiva con schermo in uso: dato del vetro/schermo
    E_elettrico_kWh: null,        // consumi elettrici annui per il fotovoltaico
    orientamento_FV: "S",
    collettori_m2: null,
    persone: null,
  };
}

function numeroDaInput(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Vetrature dal calcolo GSA: solo quelle con orientamento, altrimenti restano fuori e vengono segnalate
function vetrature(righeGSA, v) {
  const ok = [];
  const fuori = [];
  for (const r of righeGSA) {
    if (!r.orientamento) { fuori.push(r.vano); continue; }
    const g = r.materiale === "vetro_fume" ? DEFAULT_GSA.g.vetro_fume : DEFAULT_GSA.g.vetro;
    ok.push({ id: r.vano, orientamento: r.orientamento, Aw_m2: r.area_m2, FF: v.FF ?? 0.2, g, gglsh: v.gglsh });
  }
  return { ok, fuori };
}

// Calcolo completo a partire dai valori. Restituisce risultati e mancanti, senza eccezioni per i dati assenti.
export function calcolaEnergiaScheda(v, righeGSA = []) {
  const mancanti = [];
  const req = (campo, etichetta) => { if (v[campo] === null || v[campo] === undefined) mancanti.push(etichetta); };
  req("superficie_utile_m2", "superficie utile (m²)");
  req("volume_m3", "volume lordo (m³)");
  req("superficie_disperdente_m2", "superficie disperdente (m²)");
  req("U_medio_W_m2K", "trasmittanza media dell'involucro U (W/m²K)");
  const risultati = {};
  const p = { gg: v.gg, theta_ext_inv: v.theta_ext_inv_C, theta_ext_est: v.theta_ext_est_C, ricambi_h: v.ricambi_h };

  if (mancanti.length === 0) {
    const tr = dispersioneTrasmissione([{ id: "involucro", U: v.U_medio_W_m2K, A_m2: v.superficie_disperdente_m2 }], p);
    const inv = caricoInvernale(tr.H_con_ponti_W_K, v.volume_m3, p);
    const { ok, fuori } = vetrature(righeGSA, v);
    const risc = fabbisognoRiscaldamento(inv.H_tot_W_K, ok, p);
    const pdc = copPompaCalore(45, v.theta_ext_inv_C, p);
    risultati.riscaldamento = {
      carico_W: inv.carico_W,
      H_tot_W_K: inv.H_tot_W_K,
      Q_lorda_kWh: risc.Q_lorda_kWh,
      Q_solare_kWh: risc.Q_solare_kWh,
      Q_nd_kWh: risc.Q_nd_kWh,
      COP_45C: pdc.cop_reale,
      vetrature_escluse: fuori,
    };
    // raffrescamento: solo se sono noti gli schermi (ggl+sh)
    if (v.gglsh === null) mancanti.push("ggl+sh del vetro con schermo in uso (estate)");
    else {
      const est = caricoEstivo(tr.H_con_ponti_W_K, v.volume_m3, ok, {}, p);
      risultati.raffrescamento = {
        carico_W: est.totale_W,
        solare_W: est.solare_W,
        trasmissione_W: est.trasmissione_W,
        EER: eerCondizionatore(v.theta_ext_est_C, DEFAULT_ENERGIA.theta_int, p).EER_progetto,
      };
    }
  }

  if (v.E_elettrico_kWh !== null) {
    const fv = fotovoltaico(v.E_elettrico_kWh, { orientamento: v.orientamento_FV });
    risultati.fotovoltaico = { kWp: fv.kWp_necessari, resa_kWh_kWp: fv.resa_kWh_kWp };
  } else mancanti.push("consumo elettrico annuo (kWh) per il fotovoltaico");

  if (v.collettori_m2 !== null && v.persone !== null) {
    const st = solareTermico({ A_m2: v.collettori_m2, persone: v.persone, orientamento: "S" }, p);
    risultati.solareTermico = st;
  } else if (v.collettori_m2 === null && v.persone === null) mancanti.push("superficie collettori solari (m²) e numero di persone per l'ACS");

  return { risultati, mancanti };
}

// Testo di un PDF con pdf.js (vendor): una riga per ogni fine riga del documento
export async function testoDelPdf(file) {
  const pdfjs = await import("../../vendor/pdfjs/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../../vendor/pdfjs/pdf.worker.mjs", import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let testo = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    const contenuto = await pagina.getTextContent();
    for (const it of contenuto.items) {
      if (!("str" in it)) continue;
      testo += it.str + (it.hasEOL ? "\n" : " ");
    }
    testo += "\n";
  }
  return testo;
}

// Montaggio della scheda nel contenitore
export function montaScheda(box, { getRigheGSA, onCambio }) {
  const v = valoriIniziali();
  const campi = [
    ["superficie_utile_m2", "Superficie utile (m²)"],
    ["volume_m3", "Volume lordo (m³)"],
    ["superficie_disperdente_m2", "Superficie disperdente (m²)"],
    ["U_medio_W_m2K", "U medio involucro senza ponti termici (W/m²K)"],
    ["gg", "Gradi giorno"],
    ["theta_ext_inv_C", "Temp. esterna inverno (°C)"],
    ["theta_ext_est_C", "Temp. esterna estate (°C)"],
    ["ricambi_h", "Ricambi d'aria (1/h)"],
    ["FF", "Frazione telaio FF"],
    ["gglsh", "ggl+sh con schermo (estate)"],
    ["E_elettrico_kWh", "Consumo elettrico annuo (kWh)"],
    ["collettori_m2", "Collettori solari (m²)"],
    ["persone", "Persone (ACS)"],
  ];
  box.innerHTML = "";

  const pdf = document.createElement("input");
  pdf.type = "file";
  pdf.accept = "application/pdf";
  pdf.id = "energia-pdf";
  const esitoPdf = document.createElement("div");
  esitoPdf.className = "riga info";
  box.append(pdf, esitoPdf);

  const griglia = document.createElement("div");
  griglia.className = "riga-azioni";
  griglia.style.flexWrap = "wrap";
  for (const [chiave, etichetta] of campi) {
    const l = document.createElement("label");
    l.style.display = "block";
    l.style.width = "100%";
    l.append(`${etichetta} `);
    const i = document.createElement("input");
    i.type = "text";
    i.inputMode = "decimal";
    i.dataset.campo = chiave;
    i.value = v[chiave] ?? "";
    i.style.width = "90px";
    i.onchange = () => {
      v[chiave] = numeroDaInput(i.value);
      aggiorna();
    };
    l.append(i);
    griglia.append(l);
  }
  const selOr = document.createElement("select");
  selOr.dataset.campo = "orientamento_FV";
  for (const o of ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]) selOr.append(new Option(o, o, false, o === v.orientamento_FV));
  selOr.onchange = () => { v.orientamento_FV = selOr.value; aggiorna(); };
  const l2 = document.createElement("label");
  l2.style.display = "block";
  l2.append("Orientamento fotovoltaico/solare termico ", selOr);
  griglia.append(l2);
  box.append(griglia);

  const esito = document.createElement("div");
  box.append(esito);

  function aggiorna() {
    esito.innerHTML = "";
    let calcolo;
    try {
      calcolo = calcolaEnergiaScheda(v, getRigheGSA());
    } catch (e) {
      const d = document.createElement("div");
      d.className = "avviso";
      d.textContent = `Valore non valido: ${e.message}`;
      esito.append(d);
      return;
    }
    const { risultati, mancanti } = calcolo;
    const riga = (t, cls = "") => { const d = document.createElement("div"); d.className = cls; d.textContent = t; esito.append(d); };
    const f0 = (x) => Math.round(x).toLocaleString("it-IT");
    const f2 = (x) => x.toLocaleString("it-IT", { maximumFractionDigits: 2 });
    if (risultati.riscaldamento) {
      const r = risultati.riscaldamento;
      riga(`Riscaldamento: carico di progetto ${f0(r.carico_W)} W · fabbisogno ${f0(r.Q_nd_kWh)} kWh/anno (solare gratuito ${f0(r.Q_solare_kWh)} kWh)`, "ok");
      riga(`Pompa di calore a 45 °C: COP ${f2(r.COP_45C)} (stima Carnot)`);
    }
    if (risultati.raffrescamento) {
      const r = risultati.raffrescamento;
      riga(`Raffrescamento: carico di progetto ${f0(r.carico_W)} W (di cui solare ${f0(r.solare_W)} W) · EER ${f2(r.EER)}`, "ok");
    }
    if (risultati.fotovoltaico) riga(`Fotovoltaico: ${f2(risultati.fotovoltaico.kWp)} kWp (resa ${f0(risultati.fotovoltaico.resa_kWh_kWp)} kWh/kWp)`, "ok");
    if (risultati.solareTermico) {
      const s = risultati.solareTermico;
      riga(`Solare termico ACS: ${f0(s.Q_utile_kWh)} kWh utili su ${f0(s.Q_acs_kWh)} kWh richiesti · frazione ${s.frazione_solare === null ? "—" : (100 * s.frazione_solare).toFixed(0) + " %"}`, "ok");
    }
    if (mancanti.length) {
      riga("Dati mancanti per completare il calcolo:", "avviso");
      for (const m of mancanti) riga(`• ${m}`);
    }
    onCambio?.(risultati, mancanti);
  }

  pdf.onchange = async () => {
    const file = pdf.files?.[0];
    if (!file) return;
    esitoPdf.textContent = "Lettura del PDF in corso…";
    try {
      const testo = await testoDelPdf(file);
      const { campi: estratti, trovati, mancanti } = parseDatiEnergetici(testo);
      for (const [chiave] of campi) {
        if (estratti[chiave] !== undefined) {
          v[chiave] = estratti[chiave];
          const i = griglia.querySelector(`input[data-campo="${chiave}"]`);
          if (i) i.value = String(Math.round(estratti[chiave] * 100) / 100).replace(".", ",");
        }
      }
      esitoPdf.innerHTML = "";
      esitoPdf.textContent = `Dal PDF: ${trovati.length} campi trovati. Controllali nei campi qui sotto.`;
      if (mancanti.length) esitoPdf.textContent += ` Non trovati nel PDF: ${mancanti.join(", ")}.`;
      aggiorna();
    } catch (e) {
      esitoPdf.textContent = `PDF non letto: ${e.message}. Inserisci i dati a mano.`;
    }
  };

  aggiorna();
  return { valori: v, aggiorna };
}
