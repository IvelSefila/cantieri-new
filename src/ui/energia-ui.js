// Scheda "Energia": dati inseriti a mano o estratti da un PDF di relazione tecnica, calcoli (riscaldamento,
// raffrescamento, H'T, fotovoltaico, solare termico) con l'affidabilità di ogni risultato e i dati mancanti.
// Nessuna rete: il PDF viene letto nel browser con pdf.js (vendor/pdfjs), i dati restano in memoria della pagina.
import { DEFAULT_ENERGIA, dispersioneTrasmissione, dispersioneVentilazione, caricoInvernale, fabbisognoRiscaldamento,
  caricoEstivo, eerCondizionatore, copPompaCalore, fotovoltaico, solareTermico, PROSPETTO4_2008 } from "../core/energia.js?v=v20261020bq";
import { UNI10349_ROMA } from "../core/clima.js?v=v20261020bq";
import { parseDatiEnergetici } from "../core/pdfdati.js?v=v20261020bq";
import { DEFAULT_GSA } from "../core/gsa.js?v=v20261020bq";
import { verificaHT } from "../core/limiti.js?v=v20261020bq";
import { bilancioMensile, flussoSolareMensile_W } from "../core/mensile.js?v=v20261020bq";
import { NOTA_PONTI_10, STATI } from "../core/precisione.js?v=v20261020bq";

// Stagione di riscaldamento per zona (giorni per mese), UNI/TS 11300-1:2008 prospetto 3 / DPR 412/93
export const STAGIONE_ZONA = {
  A: [31, 28, 15, 0, 0, 0, 0, 0, 0, 0, 0, 31],
  B: [31, 28, 31, 0, 0, 0, 0, 0, 0, 0, 0, 31],
  C: [31, 28, 31, 0, 0, 0, 0, 0, 0, 0, 16, 31],
  D: [31, 28, 31, 15, 0, 0, 0, 0, 0, 0, 30, 31],
  E: [31, 28, 31, 15, 0, 0, 0, 0, 0, 17, 30, 31],
  F: [31, 28, 31, 22, 0, 0, 0, 0, 0, 27, 30, 31],
};

// Valori inseriti dall'utente. null = dato mancante (nessun default nascosto).
export function valoriIniziali() {
  return {
    superficie_utile_m2: null,
    volume_m3: null,
    superficie_disperdente_m2: null,
    U_medio_W_m2K: null,
    zona: UNI10349_ROMA.zona,
    gg: UNI10349_ROMA.gradiGiorno,
    theta_ext_inv_C: DEFAULT_ENERGIA.theta_ext_inv,
    theta_ext_est_C: DEFAULT_ENERGIA.theta_ext_est,
    ricambi_h: DEFAULT_ENERGIA.ricambi_h,
    FF: 0.2,
    gglsh: null,
    interni_W: null,
    tau_h: null,
    E_elettrico_kWh: null,
    orientamento_FV: "S",
    collettori_m2: null,
    persone: null,
    ponti_modo: "assenti",
    ponti_tipo: "cassa_vuota",
    ponti_nodi_testo: "",
    pdfCaricato: false,
  };
}

function numeroDaInput(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Righe "descrizione; psi W/mK; lunghezza m" -> nodi dei ponti termici
export function leggiNodiPonti(testo) {
  const nodi = [];
  const errori = [];
  String(testo ?? "").split(/\r?\n/).forEach((r, i) => {
    if (!r.trim()) return;
    const parti = r.split(";").map((x) => x.trim());
    const psi = numeroDaInput(parti[1]);
    const l = numeroDaInput(parti[2]);
    if (parti.length < 3 || psi === null || !(l > 0)) errori.push(`riga ${i + 1}: scrivere "descrizione; psi; lunghezza"`);
    else nodi.push({ descrizione: parti[0], psi_W_mK: psi, l_m: l });
  });
  return { nodi, errori };
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

// Calcolo completo. Ogni risultato porta il suo stato di affidabilità (chiavi di STATI) e una nota.
export function calcolaEnergiaScheda(v, righeGSA = []) {
  const mancanti = [];
  const req = (campo, etichetta) => { if (v[campo] === null || v[campo] === undefined) mancanti.push(etichetta); };
  req("superficie_utile_m2", "superficie utile (m²)");
  req("volume_m3", "volume lordo (m³)");
  req("superficie_disperdente_m2", "superficie disperdente lorda (m²)");
  req("U_medio_W_m2K", "trasmittanza U dell'involucro (W/m²K) senza ponti termici");
  const risultati = {};
  const p = { gg: v.gg, theta_ext_inv: v.theta_ext_inv_C, theta_ext_est: v.theta_ext_est_C, ricambi_h: v.ricambi_h };

  let ponti;
  if (v.ponti_modo === "psi") {
    const { nodi, errori } = leggiNodiPonti(v.ponti_nodi_testo);
    if (errori.length) mancanti.push(...errori.map((e) => `ponti termici, ${e}`));
    if (!nodi.length) mancanti.push("ponti termici: almeno un nodo con psi e lunghezza");
    ponti = { modo: "psi", nodi };
  } else if (v.ponti_modo === "forfait") ponti = { modo: "forfait", tipo: v.ponti_tipo };
  else mancanti.push("ponti termici (psi x lunghezza): senza, le dispersioni sono sottostimate");

  if (v.superficie_disperdente_m2 !== null && v.volume_m3 !== null && v.U_medio_W_m2K !== null) {
    const tr = dispersioneTrasmissione([{ id: "involucro", U: v.U_medio_W_m2K, A_m2: v.superficie_disperdente_m2 }], { ponti });
    const inv = caricoInvernale(tr.H_con_ponti_W_K, v.volume_m3, p);
    const { ok, fuori } = vetrature(righeGSA, v);
    if (fuori.length) mancanti.push(`orientamento delle pareti con i vani ${fuori.join(", ")} (scheda GSA)`);
    const statoPonti = tr.ponti.modo === "psi" && ponti.nodi.length ? "dati" : tr.ponti.modo === "forfait" ? "stima" : "incompleto";
    risultati.verificaHT = {
      ...verificaHT({ Htr_adj_W_K: tr.H_con_ponti_W_K, A_tot_m2: v.superficie_disperdente_m2, zona: v.zona ?? "D", SV: v.superficie_disperdente_m2 / v.volume_m3 }),
      stato: statoPonti, nota: `Ponti termici: ${tr.ponti.nota}. U unica per tutto l'involucro.`,
    };
    const risc = fabbisognoRiscaldamento(inv.H_tot_W_K, ok, p);
    risultati.riscaldamento = {
      carico_W: inv.carico_W, Q_nd_kWh: risc.Q_nd_kWh, Q_solare_kWh: risc.Q_solare_kWh,
      COP_45C: copPompaCalore(45, v.theta_ext_inv_C, p).cop_reale,
      stato: "stima", nota: "Metodo dei gradi giorno (semplificato). Il carico di progetto segue UNI EN 12831 in forma semplificata.",
    };
    // Bilancio mensile UNI/TS 11300-1: servono apporti interni e costante di tempo
    if (v.interni_W !== null && v.tau_h !== null) {
      const solari = Array(12).fill(0);
      for (const w of ok) {
        const Asol = 0.9 * w.g * (1 - w.FF) * w.Aw_m2; // ggl = Fw x ggl,n con Fw = 0,9 (UNI/TS 11300-1:2008, 14.3.1)
        flussoSolareMensile_W({ orientamento: w.orientamento, Asol_m2: Asol }).forEach((x, m) => { solari[m] += x; });
      }
      const ore = (STAGIONE_ZONA[v.zona] ?? STAGIONE_ZONA.D).map((g) => g * 24);
      const bil = bilancioMensile({
        modo: "riscaldamento", H_tr_W_K: tr.H_con_ponti_W_K, H_ve_W_K: dispersioneVentilazione(v.volume_m3, p),
        interni_W: v.interni_W, solari_W: solari, tau_h: v.tau_h, ore,
      });
      risultati.mensile = {
        Q_nd_kWh: bil.Q_nd_totale_kWh, mesi: bil.mesi, stato: "stima",
        nota: `Formule UNI/TS 11300-1 (verificate). Stagione di legge della zona ${v.zona}, dati climatici UNI 10349 di Roma. Mancano: ${bil.mancanti.join("; ")}.`,
      };
    } else mancanti.push("apporti interni (W) e costante di tempo (h) per il bilancio mensile UNI/TS 11300-1");
    if (v.gglsh === null) mancanti.push("ggl+sh del vetro con schermo in uso (estate)");
    else {
      const est = caricoEstivo(tr.H_con_ponti_W_K, v.volume_m3, ok, {}, p);
      risultati.raffrescamento = {
        carico_W: est.totale_W, solare_W: est.solare_W,
        EER: eerCondizionatore(v.theta_ext_est_C, DEFAULT_ENERGIA.theta_int, p).EER_progetto,
        stato: "stima", nota: "Picco solare PVGIS (non UNI 10349-3). EER stimato con Carnot x 0,45.",
      };
    }
  }

  if (v.E_elettrico_kWh !== null) {
    const fv = fotovoltaico(v.E_elettrico_kWh, { orientamento: v.orientamento_FV });
    risultati.fotovoltaico = { kWp: fv.kWp_necessari, resa_kWh_kWp: fv.resa_kWh_kWp, stato: "stima", nota: "Resa PVGIS per Roma a 36 gradi, senza ombre locali." };
  } else mancanti.push("consumo elettrico annuo (kWh) per il fotovoltaico");

  if (v.collettori_m2 !== null && v.persone !== null) {
    risultati.solareTermico = { ...solareTermico({ A_m2: v.collettori_m2, persone: v.persone, orientamento: v.orientamento_FV }, p), stato: "stima", nota: "Rendimento medio del collettore 0,35 di stima." };
  } else mancanti.push("superficie collettori solari (m²) e numero di persone per l'acqua calda");

  return { risultati, mancanti };
}

// Testo di un PDF con pdf.js (vendor): una riga per ogni fine riga del documento
export async function testoDelPdf(file) {
  if(file.size>50*1024*1024)throw Error('PDF oltre 50 MB');
  const pdfjs = await import("../../vendor/pdfjs/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("../../vendor/pdfjs/pdf.worker.mjs", import.meta.url).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()),isEvalSupported:false }).promise;
  let testo = "";
  try {
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
  }finally{await doc.destroy();}
}

function badge(stato) {
  const s = document.createElement("span");
  s.className = `badge-stato ${stato}`;
  s.textContent = STATI[stato]?.etichetta ?? stato;
  s.title = STATI[stato]?.spiegazione ?? "";
  return s;
}

// Montaggio della scheda nel contenitore
export function montaScheda(box, { getRigheGSA, onCambio }) {
  let caricamentoPdf=0;
  const v = valoriIniziali();
  const campi = [
    ["superficie_utile_m2", "Superficie utile (m²)"],
    ["volume_m3", "Volume lordo (m³)"],
    ["superficie_disperdente_m2", "Superficie disperdente lorda (m²)"],
    ["U_medio_W_m2K", "U medio involucro, senza ponti termici (W/m²K)"],
    ["gg", "Gradi giorno"],
    ["theta_ext_inv_C", "Temp. esterna di progetto inverno (°C)"],
    ["theta_ext_est_C", "Temp. esterna di progetto estate (°C)"],
    ["ricambi_h", "Ricambi d'aria (1/h)"],
    ["FF", "Frazione telaio FF"],
    ["gglsh", "ggl+sh con schermo (estate)"],
    ["interni_W", "Apporti interni medi (W)"],
    ["tau_h", "Costante di tempo dell'edificio (h)"],
    ["E_elettrico_kWh", "Consumo elettrico annuo (kWh)"],
    ["collettori_m2", "Collettori solari (m²)"],
    ["persone", "Persone (acqua calda)"],
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
    i.onchange = () => { v[chiave] = numeroDaInput(i.value); segna(); };
    l.append(i);
    griglia.append(l);
  }
  const selZona = document.createElement("select");
  selZona.dataset.campo = "zona";
  for (const z of ["A", "B", "C", "D", "E", "F"]) selZona.append(new Option(z, z, false, z === v.zona));
  selZona.onchange = () => { v.zona = selZona.value; segna(); };
  const lZ = document.createElement("label");
  lZ.style.display = "block";
  lZ.append("Zona climatica ", selZona);
  const selOr = document.createElement("select");
  selOr.dataset.campo = "orientamento_FV";
  for (const o of ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]) selOr.append(new Option(o, o, false, o === v.orientamento_FV));
  selOr.onchange = () => { v.orientamento_FV = selOr.value; segna(); };
  const l2 = document.createElement("label");
  l2.style.display = "block";
  l2.append("Orientamento fotovoltaico / solare termico ", selOr);
  griglia.append(lZ, l2);
  box.append(griglia);

  // Ponti termici
  const ponti = document.createElement("div");
  ponti.className = "blocco-ponti";
  ponti.innerHTML = `<div style="margin-top:8px;"><b>Ponti termici</b></div>
    <label style="display:block;">Metodo <select id="ponti-modo">
      <option value="assenti">Non inseriti (dispersioni sottostimate)</option>
      <option value="psi">Valori psi x lunghezza (metodo corretto)</option>
      <option value="forfait">Stima a percentuale (prospetto 4 UNI/TS 11300-1:2008, abrogato)</option>
    </select></label>
    <label style="display:block;" id="ponti-tipo-l">Tipo di parete <select id="ponti-tipo">${Object.entries(PROSPETTO4_2008).map(([k, x]) => `<option value="${k}">${x.percentuale} % · ${x.nome}</option>`).join("")}</select></label>
    <label style="display:block;" id="ponti-nodi-l">Un nodo per riga: descrizione; psi (W/mK); lunghezza (m)<br>
      <textarea id="ponti-nodi" rows="4" style="width:100%;" placeholder="Pilastro; 0,90; 11,2&#10;Solaio di interpiano; 0,70; 46,0&#10;Finestra; 0,15; 38,4"></textarea></label>
    <details style="margin-top:4px;"><summary>Perché non c'è più la maggiorazione del 10 %?</summary><div class="riga info"></div></details>`;
  ponti.querySelector("details .riga").textContent = NOTA_PONTI_10;
  box.append(ponti);
  const selPonti = ponti.querySelector("#ponti-modo");
  const mostraPonti = () => {
    ponti.querySelector("#ponti-tipo-l").style.display = v.ponti_modo === "forfait" ? "block" : "none";
    ponti.querySelector("#ponti-nodi-l").style.display = v.ponti_modo === "psi" ? "block" : "none";
  };
  selPonti.onchange = () => { v.ponti_modo = selPonti.value; mostraPonti(); segna(); };
  ponti.querySelector("#ponti-tipo").value = v.ponti_tipo;
  ponti.querySelector("#ponti-tipo").onchange = (e) => { v.ponti_tipo = e.target.value; segna(); };
  ponti.querySelector("#ponti-nodi").onchange = (e) => { v.ponti_nodi_testo = e.target.value; segna(); };
  mostraPonti();

  const pulsante = document.createElement("button");
  pulsante.className = "gsa-calcola";
  pulsante.textContent = "Calcola energia";
  pulsante.onclick = () => aggiorna();
  const stale = document.createElement("div");
  stale.className = "gsa-stale";
  const esito = document.createElement("div");
  box.append(pulsante, stale, esito);

  // Modifica dei dati: il risultato precedente non vale piu'. Si ricalcola solo con il pulsante.
  function segna() {
    esito.innerHTML = "";
    stale.textContent = "Dati modificati: premi Calcola energia per il nuovo risultato.";
  }

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
      onCambio?.();
      return;
    }
    const { risultati, mancanti } = calcolo;
    const riga = (t, stato, nota) => {
      const d = document.createElement("div");
      d.className = `riga-risultato ${stato ?? ""}`;
      if (stato) d.append(badge(stato), " ");
      d.append(t);
      if (nota) { const n = document.createElement("div"); n.className = "nota-risultato"; n.textContent = nota; d.append(n); }
      esito.append(d);
    };
    const f0 = (x) => Math.round(x).toLocaleString("it-IT");
    const f2 = (x) => x.toLocaleString("it-IT", { maximumFractionDigits: 2 });
    const r = risultati;
    if (r.verificaHT) riga(`H'T ${r.verificaHT.HT.toFixed(3).replace(".", ",")} W/m²K, limite Tab. 10 zona ${v.zona} ${r.verificaHT.limite.toFixed(2).replace(".", ",")}: ${r.verificaHT.verifica ? "rispettato" : "NON rispettato"}`, r.verificaHT.stato, r.verificaHT.nota);
    if (r.riscaldamento) riga(`Riscaldamento: carico di progetto ${f0(r.riscaldamento.carico_W)} W · fabbisogno ${f0(r.riscaldamento.Q_nd_kWh)} kWh/anno · COP a 45 °C ${f2(r.riscaldamento.COP_45C)}`, r.riscaldamento.stato, r.riscaldamento.nota);
    if (r.mensile) riga(`Bilancio mensile UNI/TS 11300-1: fabbisogno ${f0(r.mensile.Q_nd_kWh)} kWh/anno`, r.mensile.stato, r.mensile.nota);
    if (r.raffrescamento) riga(`Raffrescamento: carico di picco ${f0(r.raffrescamento.carico_W)} W (solare ${f0(r.raffrescamento.solare_W)} W) · EER ${f2(r.raffrescamento.EER)}`, r.raffrescamento.stato, r.raffrescamento.nota);
    if (r.fotovoltaico) riga(`Fotovoltaico: ${f2(r.fotovoltaico.kWp)} kWp (resa ${f0(r.fotovoltaico.resa_kWh_kWp)} kWh/kWp)`, r.fotovoltaico.stato, r.fotovoltaico.nota);
    if (r.solareTermico) riga(`Solare termico: ${f0(r.solareTermico.Q_utile_kWh)} kWh utili su ${f0(r.solareTermico.Q_acs_kWh)} kWh richiesti · copertura ${r.solareTermico.frazione_solare === null ? "—" : (100 * r.solareTermico.frazione_solare).toFixed(0) + " %"}`, r.solareTermico.stato, r.solareTermico.nota);
    if (mancanti.length) {
      riga("Dati mancanti per completare il calcolo:", "incompleto");
      for (const m of mancanti) riga(`• ${m}`);
    }
    onCambio?.(risultati, mancanti);
  }

  pdf.onchange = async () => {
    const file = pdf.files?.[0];
    if (!file) return;
    const richiesta=++caricamentoPdf;
    esitoPdf.textContent = "Lettura del PDF in corso…";
    try {
      const testo = await testoDelPdf(file);
      if(richiesta!==caricamentoPdf)return;
      const { campi: estratti, trovati, mancanti, ambigui } = parseDatiEnergetici(testo);
      for (const [chiave] of campi) {
        if (estratti[chiave] !== undefined) {
          v[chiave] = estratti[chiave];
          const i = griglia.querySelector(`input[data-campo="${chiave}"]`);
          if (i) i.value = String(Math.round(estratti[chiave] * 100) / 100).replace(".", ",");
        }
      }
      v.pdfCaricato = trovati.length > 0;
      esitoPdf.textContent = `Dal PDF: ${trovati.length} campi trovati. Controllali nei campi qui sotto.`;
      if (mancanti.length) esitoPdf.textContent += ` Non trovati nel PDF: ${mancanti.join(", ")}.`;
      for (const x of ambigui) esitoPdf.textContent += ` ATTENZIONE: ${x.campo} compare con valori diversi (${x.valori.join(" / ")}), forse per zone diverse: usato ${x.scelto}, controlla.`;
      if (!trovati.length) esitoPdf.textContent += " Se il PDF è una scansione, il testo non si può leggere: inserisci i dati a mano.";
    } catch (e) {
      if(richiesta!==caricamentoPdf)return;
      esitoPdf.textContent = `PDF non letto: ${e.message}. Inserisci i dati a mano.`;
    }
    if(richiesta===caricamentoPdf){pdf.value='';segna();onCambio?.();}
  };

  // Stato per la scheda Affidabilità
  function contesto() {
    return {
      U: v.U_medio_W_m2K !== null,
      ponti: v.ponti_modo,
      superfici: v.superficie_disperdente_m2 !== null && v.volume_m3 !== null,
      pdf: v.pdfCaricato,
      mensileCompleto: false,
    };
  }

  segna();
  function ripristina(dati) {
    caricamentoPdf++;pdf.value='';esitoPdf.textContent='';
    const initial = valoriIniziali();
    for (const [k, def] of Object.entries(initial)) {
      const x = dati?.[k];
      v[k] = x === undefined ? def : (def === null || typeof def === "number") ? (x === null || Number.isFinite(x) ? x : def) : typeof x === typeof def ? x : def;
    }
    for (const input of griglia.querySelectorAll('[data-campo]')) input.value = v[input.dataset.campo] ?? '';
    selPonti.value = v.ponti_modo;
    ponti.querySelector('#ponti-tipo').value = v.ponti_tipo;
    ponti.querySelector('#ponti-nodi').value = v.ponti_nodi_testo;
    mostraPonti();
    segna();
  }
  return { valori: v, aggiorna, segna, contesto, ripristina };
}
