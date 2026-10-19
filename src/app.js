// Interfaccia: progetto modificabile (vuoto all'avvio), modalita' vista e costruzione, import/export.
import { validatePlan } from "./core/model.js";
import { buildModel } from "./core/build.js";
import { measurePlan } from "./core/measure.js";
import { TIPO_PER_CATEGORIA } from "./core/cdi.js";
import {
  progettoVuoto, aggiungiMuro, aggiungiVano, aggiungiPavimento, aggiungiArredo,
  ruotaArredo, spostaArredo, eliminaElemento, verificaProgetto, LIBRERIA_ARREDI, MATERIALI_PAVIMENTO,
} from "./core/project.js";
import { createViewer } from "./view/scene.js";
import { parseDxf } from "./io/dxf.js";
import { dxfToPlan } from "./io/toPlan.js";
import { montaTracciamento } from "./trace/ui.js";
import { agganciaPunto, puntiNotevoli } from "./core/snap.js";
import { stanze } from "./core/rooms.js";
import { planSvg } from "./view2d/plan.js";
import { montaHud } from "./ui/hud.js";

let hud = null;

const $ = (id) => document.getElementById(id);
const stato = {
  progetto: progettoVuoto(),
  catalogo: null,
  arrediEsempio: null,
  assegnazioni: {},
  viewer: null,
  modo: "vista",
  strumento: "muro",
  griglia: 100,
  spessore: 250,
  altezza: 2100,
  sbalzo: 0,
  tipoVano: "porta",
  larghezzaVano: 900,
  pendente: null,
  arredoSelezionato: null,
  rotazione: 0,
  arredo: "divano",
  pavimento: "parquet",
  storia: [],
};

function messaggio(testo, tipo = "info") {
  const el = $("messaggi");
  el.textContent = testo;
  el.dataset.tipo = tipo;
  if (hud) hud.toast(testo, tipo);
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

// ---- Modifica con storia (annulla) ----
function applica(nuovo) {
  stato.storia.push(stato.progetto);
  if (stato.storia.length > 60) stato.storia.shift();
  stato.progetto = nuovo;
  ricostruisci();
}

function annullaUltimo() {
  if (!stato.storia.length) return messaggio("Niente da annullare.", "info");
  stato.progetto = stato.storia.pop();
  stato.pendente = null;
  ricostruisci();
}

// ---- Costruzione del modello ----
function ricostruisci() {
  const p = stato.progetto;
  if (stato.vista2d) aggiornaVista2d();
  const check = verificaProgetto(p);
  const righe = [];
  for (const e of check.errors) righe.push({ tipo: "errore", testo: `ERRORE: ${e}` });
  for (const w of check.warnings) righe.push({ tipo: "avviso", testo: `avviso: ${w}` });

  const arredi = [];
  const res = buildModel(p, stato.catalogo, stato.assegnazioni, arredi);
  if (!res.ok) {
    scrivi(righe);
    stato.viewer.setBoxes([]);
    messaggio("Modello non costruito: correggi gli errori.", "errore");
    renderVani();
    return;
  }
  for (const w of res.report.warnings) if (!check.warnings.includes(w)) righe.push({ tipo: "avviso", testo: `avviso: ${w}` });
  stato.viewer.setBoxes(res.boxes);

  if (p.walls.length === 0 && p.floors.length === 0 && p.furniture.length === 0) {
    righe.unshift({ tipo: "info", testo: "Progetto vuoto: usa la modalità costruzione per aggiungere muri, vani, pavimenti e arredi." });
  } else {
    const m = measurePlan(p);
    const sta = stanze(p.walls);
    if (sta.length) {
      righe.push({ tipo: "info", testo: `Stanze rilevate: ${sta.length}.` });
      for (const s of sta.slice(0, 12)) righe.push({ tipo: "info", testo: `  ${s.id}: ${fmtM2(s.superficieMm2 / 1e6)}` });
    }
    righe.unshift(
      { tipo: "ok", testo: `Modello: ${p.walls.length} muri, ${p.openings.length} vani, ${p.floors.length} pavimenti, ${p.furniture.length} arredi.` },
      { tipo: "ok", testo: `Lunghezza muri: ${m.lunghezza_muri_mm.toLocaleString("it-IT")} mm (intera).` },
      { tipo: "ok", testo: `Superficie muri netta (due facce): ${fmtM2(m.superficie_muri_netta_m2)}.` },
    );
  }
  scrivi(righe);
  messaggio(stato.pendente ? `In attesa del secondo punto (${stato.strumento}). Esc annulla.` : "Pronto. Ogni misura è un intero in mm.", "ok");
  renderVani();
}

function renderVani() {
  const lista = $("vani");
  lista.innerHTML = "";
  for (const o of stato.progetto.openings) {
    const riga = document.createElement("div");
    riga.className = "vano";
    const titolo = document.createElement("div");
    titolo.textContent = `${o.id} • ${o.type} • ${o.width} × ${o.height} mm • muro ${o.wall}`;
    const sel = document.createElement("select");
    sel.appendChild(new Option("— vano aperto (nessun infisso)", ""));
    for (const it of stato.catalogo.items) {
      if (TIPO_PER_CATEGORIA[it.categoria] === o.type) sel.appendChild(new Option(it.nome, it.id));
    }
    const corrente = Object.prototype.hasOwnProperty.call(stato.assegnazioni, o.id) ? stato.assegnazioni[o.id] : (o.cdi ?? "");
    sel.value = corrente ?? "";
    sel.onchange = () => {
      stato.assegnazioni[o.id] = sel.value || null;
      ricostruisci();
    };
    riga.append(titolo, sel);
    lista.appendChild(riga);
  }
}

// Vista 2D: sovrapposizione SVG sopra la 3D, generata dal progetto corrente (stessa sorgente).
function aggiornaVista2d() {
  const box = document.getElementById("vista");
  let ov = document.getElementById("vista-2d");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "vista-2d";
    ov.style.cssText = "position:absolute; inset:0; display:none; background:#f7f8fa; z-index:5;";
    box.style.position = "relative";
    box.appendChild(ov);
  }
  ov.style.display = stato.vista2d ? "block" : "none";
  if (stato.vista2d) ov.innerHTML = planSvg(stato.progetto);
}

function caricaProgetto(p, nome, { esempio = false } = {}) {
  stato.progetto = { floors: [], furniture: [], ...p };
  stato.mostraArrediEsempio = esempio;
  stato.storia = [];
  stato.assegnazioni = {};
  stato.pendente = null;
  $("nome-plan").textContent = `${nome}: ${p.name ?? ""}`;
  ricostruisci();
}

// ---- Scatta e snap ----
function aggancia(v) {
  const g = stato.griglia;
  return g > 0 ? Math.round(v / g) * g : Math.round(v);
}

// Proiezione di un punto mm su un muro: offset lungo il muro.
function offsetSuMuro(p, muro) {
  const dx = muro.b[0] - muro.a[0];
  const dy = muro.b[1] - muro.a[1];
  const L = Math.hypot(dx, dy);
  return Math.round(((p[0] - muro.a[0]) * dx + (p[1] - muro.a[1]) * dy) / L);
}

function gestisciClic(hit) {
  if (stato.modo !== "costruzione") return;
  // aggancio: vertici esistenti (entro 150 mm), angoli 0/45/90 dal punto in sospeso, poi griglia
  const agg = agganciaPunto(hit.mm, {
    griglia: stato.griglia,
    partenza: stato.pendente,
    tolleranza: 150,
    punti: puntiNotevoli(stato.progetto),
  });
  const p = agg.punto;
  const pr = stato.progetto;
  const errore = (e) => messaggio(e, "errore");
  try {
    switch (stato.strumento) {
      case "muro": {
        if (!stato.pendente) { stato.pendente = p; break; }
        if (p[0] === stato.pendente[0] && p[1] === stato.pendente[1]) break;
        const r = aggiungiMuro(pr, stato.pendente, p, stato.spessore);
        if (r.errore) return errore(r.errore);
        stato.pendente = p; // catena di muri: il secondo punto diventa il primo del successivo
        applica(r.p);
        break;
      }
      case "vano": {
        if (!hit.wall) return errore("Clicca su un muro per inserire il vano.");
        const muro = pr.walls.find((w) => w.id === hit.wall);
        const L = Math.hypot(muro.b[0] - muro.a[0], muro.b[1] - muro.a[1]);
        const larg = stato.larghezzaVano;
        let off = offsetSuMuro(hit.mm, muro) - Math.round(larg / 2);
        off = Math.max(0, Math.min(off, Math.round(L) - larg));
        const r = aggiungiVano(pr, muro.id, off, larg, stato.altezza, stato.sbalzo, stato.tipoVano);
        if (r.errore) return errore(r.errore);
        applica(r.p);
        break;
      }
      case "pavimento": {
        if (!stato.pendente) { stato.pendente = p; break; }
        const a = stato.pendente;
        const r = aggiungiPavimento(pr, Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[0], p[0]), Math.max(a[1], p[1]), stato.pavimento);
        stato.pendente = null;
        if (r.errore) return errore(r.errore);
        applica(r.p);
        break;
      }
      case "arredo": {
        const r = aggiungiArredo(pr, stato.arredo, p[0], p[1], stato.rotazione);
        if (r.errore) return errore(r.errore);
        applica(r.p);
        break;
      }
      case "sposta": {
        if (!stato.arredoSelezionato) {
          if (hit.kind === "arredo") stato.arredoSelezionato = hit.id;
          else messaggio("Clicca un arredo per selezionarlo, poi il punto di destinazione.", "info");
          break;
        }
        applica(spostaArredo(pr, stato.arredoSelezionato, p[0], p[1]));
        stato.arredoSelezionato = null;
        break;
      }
      case "elimina": {
        if (!hit.id) return;
        let id = hit.id;
        if (hit.kind && hit.kind.startsWith("muro")) id = hit.wall;
        else if (["telaio", "vetro", "anta", "maniglia"].includes(hit.kind)) id = hit.id.split(":")[0];
        else if (hit.kind === "pavimento" || hit.kind === "arredo") id = hit.id;
        applica(eliminaElemento(pr, id));
        break;
      }
    }
  } catch (e) {
    errore(`Errore: ${e.message}`);
  }
  ricostruisci();
}

// ---- Pannello costruzione (inserito sopra gli strumenti di import) ----
function costruisciPannello() {
  const box = document.createElement("div");
  box.style.cssText = "border-top:1px solid #d5dbe3; margin-top:10px; padding-top:8px;";
  box.innerHTML = `
    <div><b>Modalità</b>
      <button data-modo="vista">Vista</button>
      <button data-modo="costruzione">Costruzione</button>
    </div>
    <div id="pannello-costruzione" style="display:none; margin-top:6px;">
      <div>Strumento:
        <select id="strumento">
          <option value="muro">Muro</option>
          <option value="vano">Vano (clic su un muro)</option>
          <option value="pavimento">Pavimento (2 clic)</option>
          <option value="arredo">Arredo</option>
          <option value="sposta">Sposta arredo</option>
          <option value="elimina">Elimina</option>
        </select>
      </div>
      <div>Griglia: <select id="griglia">
        <option value="0">libera (1 mm)</option><option value="10">10 mm</option><option value="50">50 mm</option><option value="100" selected>100 mm</option>
      </select></div>
      <div>Spessore muro (mm): <input id="spessore" type="number" value="250" step="2" style="width:80px"></div>
      <div>Altezza vano (mm): <input id="altezza" type="number" value="2100" style="width:80px"> Davanzale: <input id="sbalzo" type="number" value="0" style="width:60px"></div>
      <div>Tipo vano: <select id="tipo-vano"><option value="porta">porta</option><option value="finestra">finestra</option><option value="scorrevole">scorrevole</option></select>
        Larghezza: <input id="larg-vano" type="number" value="900" style="width:70px"></div>
      <div>Pavimento: <select id="pavimento">${Object.entries(MATERIALI_PAVIMENTO).map(([k, v]) => `<option value="${k}">${v.nome}</option>`).join("")}</select></div>
      <div>Arredo: <select id="arredo">${Object.entries(LIBRERIA_ARREDI).map(([k, v]) => `<option value="${k}">${v.nome}</option>`).join("")}</select>
        <button id="ruota">Ruota (R)</button></div>
      <div style="margin-top:6px; display:flex; gap:4px; flex-wrap:wrap;">
        <button id="annulla">Annulla (Ctrl+Z)</button>
        <button id="esc">Esc</button>
      </div>
    </div>
    <div style="margin-top:8px; display:flex; gap:4px; flex-wrap:wrap;">
      <button id="vista2d">Vista 2D / 3D</button>
      <button id="nuovo">Nuovo progetto (vuoto)</button>
      <button id="esempio">Apri esempio AR-02</button>
    </div>`;
  $("sez-costruzione").appendChild(box);
  $("sez-progetto-azioni").append($("nuovo"), $("esempio"));
  $("sez-vista").append($("vista2d"));
  const stileBox = document.createElement("div");
  stileBox.innerHTML = `<div>Stile di resa:</div><select id="stile">
        <option value="solido">Solido</option>
        <option value="vetro">Vetro (semi-trasparente)</option>
        <option value="dollhouse">Dollhouse 1,30 m</option>
        <option value="vetro-dollhouse">Vetro + dollhouse</option>
      </select>`;
  $("sez-stile").appendChild(stileBox);

  for (const b of box.querySelectorAll("[data-modo]")) {
    b.onclick = () => {
      stato.modo = b.dataset.modo;
      $("pannello-costruzione").style.display = stato.modo === "costruzione" ? "block" : "none";
      stato.pendente = null;
      stato.arredoSelezionato = null;
      messaggio(stato.modo === "costruzione" ? "Costruzione: scegli lo strumento." : "Vista.", "info");
    };
  }
  $("stile").onchange = (e) => stato.viewer.setStile(e.target.value);
  $("strumento").onchange = (e) => { stato.strumento = e.target.value; stato.pendente = null; stato.arredoSelezionato = null; };
  $("griglia").onchange = (e) => { stato.griglia = Number(e.target.value); };
  $("spessore").onchange = (e) => { stato.spessore = Number(e.target.value); };
  $("altezza").onchange = (e) => { stato.altezza = Number(e.target.value); };
  $("sbalzo").onchange = (e) => { stato.sbalzo = Number(e.target.value); };
  $("tipo-vano").onchange = (e) => { stato.tipoVano = e.target.value; };
  $("larg-vano").onchange = (e) => { stato.larghezzaVano = Number(e.target.value); };
  $("pavimento").onchange = (e) => { stato.pavimento = e.target.value; };
  $("arredo").onchange = (e) => { stato.arredo = e.target.value; };
  $("ruota").onclick = () => { stato.rotazione = (stato.rotazione + 90) % 360; messaggio(`Rotazione arredo: ${stato.rotazione}°`, "info"); };
  $("annulla").onclick = annullaUltimo;
  $("esc").onclick = () => { stato.pendente = null; stato.arredoSelezionato = null; ricostruisci(); };
  $("nuovo").onclick = () => caricaProgetto(progettoVuoto(), "nuovo");
  $("vista2d").onclick = () => {
    stato.vista2d = !stato.vista2d;
    aggiornaVista2d();
  };
  $("esempio").onclick = () => apriEsempio();
}

// Esempio AR-02: pavimento parquet sotto l'impronta dei muri e arredi di esempio visibili.
async function apriEsempio() {
  const p = await fetch("data/plan-ar02.json").then((r) => r.json());
  caricaProgetto({ ...p, floors: [], furniture: [] }, "esempio", { esempio: true });
}

async function init() {
  stato.viewer = createViewer($("vista"));
  const [catalogo, arredi] = await Promise.all([
    fetch("data/cdi-catalog.json").then((r) => r.json()),
    fetch("data/arredi-ar02.json").then((r) => r.json()),
  ]);
  stato.catalogo = catalogo;
  stato.arrediEsempio = arredi.arredi;
  costruisciPannello();
  $("stile").onchange = (e) => stato.viewer.setStile(e.target.value);
  const q = document.createElement("div");
  q.innerHTML = `<div style="margin-top:8px;">Qualità di resa:
      <select id="qualita"><option value="auto">Automatica (consigliata)</option><option value="basso">Basso (PC lenti)</option><option value="medio">Medio</option><option value="alto">Alto</option></select>
    </div>
    <div id="statistiche" class="hud-stat avanzato" style="margin-top:8px;"></div>`;
  $("sez-vista").appendChild(q);
  $("qualita").onchange = (e) => stato.viewer.setQualita(e.target.value);
  setInterval(() => {
    const st = stato.viewer?.statistiche();
    if (st) $("statistiche").textContent = `Qualità ${st.livello} · ${st.fps} fps · ${st.chiamate} gruppi · ${st.triangoli.toLocaleString("it-IT")} triangoli`;
  }, 1000);
  stato.viewer.setPickHandler(gestisciClic);
  stato.viewer.setHoverHandler((mm) => hud?.coordinate(mm));
  hud = montaHud({
    onScheda: (id) => {
      const aside = document.querySelector("aside");
      if (id === "vista") { stato.modo = "vista"; $("pannello-costruzione").style.display = "none"; }
      if (id === "stile") aside.classList.remove("chiuso");
    },
    onStrumento: (id) => {
      stato.strumento = id;
      stato.pendente = null;
      stato.arredoSelezionato = null;
      $("strumento").value = id;
      hud.evidenziaStrumento(id);
    },
    onModo: (m) => {
      if (m === "costruzione") document.querySelector("[data-modo=costruzione]").click();
      else document.querySelector("[data-modo=vista]").click();
    },
    onVista2d: () => $("vista2d").click(),
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { stato.pendente = null; stato.arredoSelezionato = null; ricostruisci(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); annullaUltimo(); }
    if (e.key.toLowerCase() === "r" && stato.modo === "costruzione") { stato.rotazione = (stato.rotazione + 90) % 360; }
  });

  // Avvio: esempio AR-02 completo (pavimento e arredi di esempio). "Nuovo progetto" parte vuoto.
  await apriEsempio();

  montaTracciamento(document.getElementById("trc-root"), {
    onPianta: (p) => caricaProgetto(p, "tracciata su immagine"),
  });

  $("carica").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      caricaProgetto(JSON.parse(await file.text()), file.name);
    } catch (e) {
      messaggio(`File non leggibile come JSON: ${e.message}`, "errore");
    }
  });

  $("dxf").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const parsed = parseDxf(await file.text());
      const { plan, check, report } = dxfToPlan(parsed, {
        riferimento: $("dxf-rif").value,
        spessoreDefault: Number($("dxf-t").value),
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
      if (check.ok) caricaProgetto(plan, file.name);
      else messaggio("DXF non importato: correggi gli errori.", "errore");
    } catch (e) {
      messaggio(`DXF non leggibile: ${e.message}`, "errore");
    }
  });

  $("scarica").addEventListener("click", () => {
    const out = structuredClone(stato.progetto);
    for (const o of out.openings) {
      if (Object.prototype.hasOwnProperty.call(stato.assegnazioni, o.id)) o.cdi = stato.assegnazioni[o.id];
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "progetto-mm.json";
    a.click();
  });
}

init().catch((e) => messaggio(`Errore di avvio: ${e.message}`, "errore"));
