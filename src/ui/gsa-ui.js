// Scheda GSA (Gestione della Sicurezza Antincendio, DM 2/9/2021): dati inseriti dall'utente, risultato solo
// dopo il pulsante "Calcola GSA". Ogni obbligo mostra l'articolo o l'allegato del decreto.
import { calcolaGSA, LIVELLO3, PLANIMETRIA_ELEMENTI, PIANO_CONTENUTI, GSA_FONTE } from "../core/gsa-incendio.js";

function el(tag, cls, testo) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (testo !== undefined) e.textContent = testo;
  return e;
}

// Stato iniziale: nessun valore, nessun risultato
export function datiGSAIniziali() {
  return {
    lavoratori: "",
    aperto_pubblico: false,
    pubblico_contemporaneo: "",
    soggettaCPI: "",          // "si" | "no" | "" (non so)
    cantiereFiamme: false,
    attivita_complessa: false,
    livello3: [],
    data_corso_addetti: "",
    data_ultima_esercitazione: "",
    planimetria_elementi: [],
    piano_contenuti: [],
    doc_vr: "",
    doc_piano: "",
    doc_attestati: "",
    doc_registro: "",
    doc_informazione: "",
  };
}

// Dal modulo al motore: testo vuoto = dato non noto (null), "si"/"no" = booleano
function verso(d) {
  const tri = (v) => (v === "si" ? true : v === "no" ? false : null);
  const num = (v) => (v === "" || v === null ? undefined : Number(v));
  return {
    lavoratori: num(d.lavoratori),
    aperto_pubblico: d.aperto_pubblico,
    pubblico_contemporaneo: num(d.pubblico_contemporaneo),
    soggettaCPI: d.soggettaCPI === "" ? undefined : d.soggettaCPI === "si",
    cantiereFiamme: d.cantiereFiamme,
    attivita_complessa: d.attivita_complessa,
    livello3: d.livello3,
    data_corso_addetti: d.data_corso_addetti || null,
    data_ultima_esercitazione: d.data_ultima_esercitazione || null,
    planimetria_elementi: d.planimetria_elementi,
    piano_contenuti: d.piano_contenuti,
    doc_vr: tri(d.doc_vr),
    doc_piano: tri(d.doc_piano),
    doc_attestati: tri(d.doc_attestati),
    doc_registro: tri(d.doc_registro),
    doc_informazione: tri(d.doc_informazione),
  };
}

export function montaGSA(box) {
  const d = datiGSAIniziali();
  let risultato = null;
  let calcolatoCon = null;
  box.innerHTML = "";

  const avviso = el("div", "riga info", "Inserisci i dati, poi premi Calcola GSA. Il calcolo segue il DM 2 settembre 2021 (GU n. 237 del 4/10/2021), in vigore dal 4/10/2022.");
  box.append(avviso);

  const form = el("div", "gsa-form");
  const campo = (etichetta, nodo) => { const l = el("label", "gsa-campo"); l.append(el("span", "", etichetta), nodo); form.append(l); return nodo; };
  const numero = (chiave, etichetta, min = 0) => {
    const i = el("input"); i.type = "number"; i.min = String(min); i.value = d[chiave];
    i.onchange = () => { d[chiave] = i.value; segna(); };
    return campo(etichetta, i);
  };
  const data = (chiave, etichetta) => {
    const i = el("input"); i.type = "date"; i.value = d[chiave];
    i.onchange = () => { d[chiave] = i.value; segna(); };
    return campo(etichetta, i);
  };
  const tri = (chiave, etichetta) => {
    const s = el("select");
    for (const [v, t] of [["", "non so"], ["si", "sì"], ["no", "no"]]) s.append(new Option(t, v, false, d[chiave] === v));
    s.onchange = () => { d[chiave] = s.value; segna(); };
    return campo(etichetta, s);
  };
  const check = (chiave, etichetta) => {
    const i = el("input"); i.type = "checkbox"; i.checked = !!d[chiave];
    i.onchange = () => { d[chiave] = i.checked; segna(); };
    const l = el("label", "gsa-check"); l.append(i, " " + etichetta); form.append(l);
  };
  const gruppo = (titolo, lista, chiave) => {
    form.append(el("div", "gsa-titolo", titolo));
    for (const [id, testo] of lista) {
      const l = el("label", "gsa-check");
      const i = el("input"); i.type = "checkbox"; i.checked = d[chiave].includes(id);
      i.onchange = () => { d[chiave] = i.checked ? [...d[chiave], id] : d[chiave].filter((x) => x !== id); segna(); };
      l.append(i, " " + testo); form.append(l);
    }
  };

  form.append(el("div", "gsa-titolo", "1. Luogo di lavoro"));
  numero("lavoratori", "Lavoratori occupati (numero)");
  check("aperto_pubblico", "Luogo aperto al pubblico");
  numero("pubblico_contemporaneo", "Persone del pubblico contemporaneamente presenti");
  tri("soggettaCPI", "Attività soggetta al DPR 151/2011 (allegato I)?");
  check("cantiereFiamme", "Cantiere con sostanze infiammabili e fiamme libere");
  check("attivita_complessa", "Edificio complesso o attività con più titolari");
  form.append(el("div", "gsa-titolo", "2. Attività di livello 3 (all. III 3.2.2), se presente"));
  gruppo("Seleziona solo le voci che si applicano:", Object.entries(LIVELLO3), "livello3");

  form.append(el("div", "gsa-titolo", "3. Addetti e formazione"));
  data("data_corso_addetti", "Data dell'ultimo corso degli addetti antincendio");
  data("data_ultima_esercitazione", "Data dell'ultima esercitazione antincendio");

  form.append(el("div", "gsa-titolo", "4. Elementi della planimetria del piano (all. II 2.2 n. 3)"));
  gruppo("Presenti nella planimetria:", PLANIMETRIA_ELEMENTI.map((e) => [e.id, e.testo]), "planimetria_elementi");
  form.append(el("div", "gsa-titolo", "5. Contenuti scritti del piano (all. II 2.1-2.2)"));
  gruppo("Presenti nel piano:", PIANO_CONTENUTI.map((e) => [e.id, e.testo]), "piano_contenuti");

  form.append(el("div", "gsa-titolo", "6. Documenti"));
  tri("doc_vr", "Documento di valutazione dei rischi con parte antincendio");
  tri("doc_piano", "Piano di emergenza con planimetria");
  tri("doc_attestati", "Attestati di formazione e aggiornamento degli addetti");
  tri("doc_registro", "Registro delle esercitazioni e dei controlli");
  tri("doc_informazione", "Attestazione della formazione antincendio dei lavoratori");
  box.append(form);

  const bottone = el("button", "gsa-calcola", "Calcola GSA");
  bottone.onclick = () => { risultato = calcolaGSA(verso(d)); calcolatoCon = JSON.stringify(d); disegna(); };
  const stale = el("div", "gsa-stale");
  const esito = el("div", "gsa-esito");
  box.append(bottone, stale, esito);

  function segna() {
    if (risultato) stale.textContent = "I dati sono cambiati: premi Calcola GSA per aggiornare il risultato.";
    if (risultato && JSON.stringify(d) !== calcolatoCon) { risultato = null; esito.innerHTML = ""; }
  }

  function disegna() {
    esito.innerHTML = "";
    stale.textContent = "";
    if (!risultato) return;
    const r = risultato;
    const rigo = (t, cls = "") => esito.append(el("div", `riga-risultato ${cls}`, t));
    rigo(`Livello di rischio ${r.livello.livello}: ${r.livello.motivo}.`, "ok");
    const p = r.piano;
    rigo(p.obbligatorio ? `Piano di emergenza obbligatorio: ${p.motivi.join("; ")}.` : "Piano di emergenza non obbligatorio.", p.obbligatorio ? "ok" : "");
    if (p.misureSemplificate) rigo("Per questo esercizio è ammessa la forma semplificata (all. II par. 4).");
    if (!p.obbligatorio) rigo(p.senzaPiano);
    esito.append(el("div", "gsa-titolo", "Obblighi"));
    for (const o of r.obblighi) rigo(`${o.testo} [${o.riferimento}]`);
    esito.append(el("div", "gsa-titolo", "Corsi e scadenze"));
    rigo(`Corso addetti: formazione ${r.livello.corsi.formazione.sigla} (${r.livello.corsi.formazione.ore} ore); aggiornamento ${r.livello.corsi.aggiornamento.sigla} (${r.livello.corsi.aggiornamento.ore} ore) ogni 5 anni [art. 5, all. III].`);
    for (const s of r.scadenze) rigo(`Scadenza: ${s.testo} → ${s.data}`);
    if (r.planimetria) {
      esito.append(el("div", "gsa-titolo", "Planimetria del piano"));
      for (const e of r.planimetria) rigo(`${e.presente ? "✓" : "✗"} ${e.testo}`, e.presente ? "ok" : "avviso");
    }
    esito.append(el("div", "gsa-titolo", "Documenti"));
    for (const doc of r.documenti) {
      const stato = doc.presente === true ? "presente" : doc.presente === false ? "manca" : "da verificare";
      rigo(`${doc.obbligatorio ? "" : "(se previsto) "}${doc.nome}: ${stato} [${doc.riferimento}]`, doc.presente === true ? "ok" : doc.obbligatorio ? "avviso" : "");
    }
    if (r.mancanti.length) {
      esito.append(el("div", "gsa-titolo", `Per completare il calcolo (${r.mancanti.length})`));
      for (const m of r.mancanti) rigo(`• ${m}`, "avviso");
    }
    const f = el("div", "gsa-fonte");
    f.append(el("span", "", "Fonte: "), Object.assign(el("a", "", GSA_FONTE.documento + ", " + GSA_FONTE.gazzetta), { href: GSA_FONTE.url, target: "_blank", rel: "noopener" }));
    esito.append(f);
  }
  return { calcola: () => bottone.click(), stato: () => ({ risultato: !!risultato }) };
}
