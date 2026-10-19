// Interfaccia: carica planimetria (JSON in mm), valida, costruisce il modello, assegna gli infissi CDI.
import { validatePlan } from "./core/model.js";
import { buildModel } from "./core/build.js";
import { measurePlan } from "./core/measure.js";
import { TIPO_PER_CATEGORIA } from "./core/cdi.js";
import { createViewer } from "./view/scene.js";
import { parseDxf } from "./io/dxf.js";
import { dxfToPlan } from "./io/toPlan.js";
import { montaTracciamento } from "./trace/ui.js";

const $ = (id) => document.getElementById(id);
const stato = { plan: null, catalog: null, assegnazioni: {}, viewer: null };

function messaggio(testo, tipo = "info") {
  const el = $("messaggi");
  el.textContent = testo;
  el.dataset.tipo = tipo;
}

function scrivi(righe) {
  $("esito").innerHTML = "";
  for (const r of righe) {
    const p = document.createElement("div");
    p.className = `riga ${r.tipo}`;
    p.textContent = r.testo;
    $("esito").appendChild(p);
  }
}

function fmtM2(v) {
  return v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m²";
}

function opzioniCatalogo(tipo) {
  const opts = [new Option("— vano aperto (nessun infisso)", "")];
  for (const it of stato.catalog.items) {
    if (TIPO_PER_CATEGORIA[it.categoria] === tipo) opts.push(new Option(it.nome, it.id));
  }
  return opts;
}

function renderVani() {
  const lista = $("vani");
  lista.innerHTML = "";
  for (const o of stato.plan.openings) {
    const riga = document.createElement("div");
    riga.className = "vano";
    const titolo = document.createElement("div");
    titolo.textContent = `${o.id} • ${o.type} • ${o.width} × ${o.height} mm • muro ${o.wall}`;
    const sel = document.createElement("select");
    for (const opt of opzioniCatalogo(o.type)) sel.appendChild(opt);
    const corrente = Object.prototype.hasOwnProperty.call(stato.assegnazioni, o.id) ? stato.assegnazioni[o.id] : (o.cdi ?? "");
    sel.value = corrente ?? "";
    sel.onchange = () => {
      stato.assegnazioni[o.id] = sel.value || null;
      renderModello();
    };
    riga.append(titolo, sel);
    lista.appendChild(riga);
  }
}

function renderModello() {
  const plan = stato.plan;
  const check = validatePlan(plan);
  const righe = [];
  for (const e of check.errors) righe.push({ tipo: "errore", testo: `ERRORE: ${e}` });
  for (const w of check.warnings) righe.push({ tipo: "avviso", testo: `avviso: ${w}` });

  if (!check.ok) {
    scrivi(righe);
    messaggio("Modello non costruito: correggi gli errori.", "errore");
    return;
  }

  const res = buildModel(plan, stato.catalog, stato.assegnazioni, plan.name?.includes("AR-02") || plan.name?.includes("Piano tipo") ? stato.arredi : []);
  for (const w of res.report.warnings) if (!check.warnings.includes(w)) righe.push({ tipo: "avviso", testo: `avviso: ${w}` });
  stato.viewer.setBoxes(res.boxes);

  const m = measurePlan(plan);
  righe.unshift(
    { tipo: "ok", testo: `Modello costruito: ${res.stats.scatole} scatole, ${res.stats.muri} muri, ${res.stats.vani} vani (${res.stats.vani_con_infisso} con infisso).` },
    { tipo: "ok", testo: `Lunghezza muri: ${m.lunghezza_muri_mm.toLocaleString("it-IT")} mm (intera, senza arrotondamenti).` },
    { tipo: "ok", testo: `Superficie muri netta (due facce): ${fmtM2(m.superficie_muri_netta_m2)}.` },
    { tipo: "ok", testo: `Superficie vani: ${fmtM2(m.superficie_vani_m2)}.` },
  );
  scrivi(righe);
  messaggio(`Pronto. Ogni misura è un intero in mm.`, "ok");
}

function caricaPlan(plan, nome) {
  stato.plan = plan;
  stato.assegnazioni = {};
  $("nome-plan").textContent = `${nome}: ${plan.name ?? ""}`;
  renderVani();
  renderModello();
}

async function init() {
  stato.viewer = createViewer($("vista"));
  const [plan, catalog, arredi] = await Promise.all([
    fetch("data/plan-ar02.json").then((r) => r.json()),
    fetch("data/cdi-catalog.json").then((r) => r.json()),
    fetch("data/arredi-ar02.json").then((r) => r.json()),
  ]);
  stato.catalog = catalog;
  stato.arredi = arredi.arredi;
  caricaPlan(plan, "planimetria di esempio");
  montaTracciamento(document.getElementById("trc-root"), {
    onPianta: (p) => caricaPlan(p, "tracciata su immagine"),
  });

  $("carica").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const plan = JSON.parse(await file.text());
      caricaPlan(plan, file.name);
    } catch (e) {
      messaggio(`File non leggibile come JSON: ${e.message}`, "errore");
    }
  });

  $("dxf").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const parsed = parseDxf(await file.text());
      const spessore = Number($("dxf-t").value);
      const { plan, check, report } = dxfToPlan(parsed, {
        riferimento: $("dxf-rif").value,
        spessoreDefault: spessore,
        nome: file.name,
      });
      const righe = [
        { tipo: "ok", testo: `DXF letto: ${report.entita} entità (${report.linee} linee, ${report.polilinee} polilinee), ${report.muri} muri.` },
        { tipo: "info", testo: `Unità del file: ${report.unita ?? "non dichiarate"} • riferimento: ${$("dxf-rif").value}.` },
      ];
      if (report.arrotondamenti > 0) righe.push({ tipo: "avviso", testo: `${report.arrotondamenti} valori arrotondati a mm intero (scarto massimo ${report.scostamento_max_mm.toFixed(3)} mm).` });
      for (const a of report.avvisi) righe.push({ tipo: "avviso", testo: a });
      for (const e of check.errors) righe.push({ tipo: "errore", testo: `ERRORE: ${e}` });
      scrivi(righe);
      if (check.ok) caricaPlan(plan, file.name);
      else messaggio("DXF non importato: correggi gli errori.", "errore");
    } catch (e) {
      messaggio(`DXF non leggibile: ${e.message}`, "errore");
    }
  });

  $("scarica").addEventListener("click", () => {
    const out = structuredClone(stato.plan);
    for (const o of out.openings) {
      if (Object.prototype.hasOwnProperty.call(stato.assegnazioni, o.id)) o.cdi = stato.assegnazioni[o.id];
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "planimetria-mm.json";
    a.click();
  });
}

init().catch((e) => messaggio(`Errore di avvio: ${e.message}`, "errore"));
