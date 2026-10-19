// Modalita' Arredo (stile Sweet Home 3D): catalogo di arredi 3D, posizionamento con fantasma verde/rosso, aggancio ai
// muri, trascinamento, rotazione, duplica, elimina, dimensioni e finiture. Tutto in mm interi nel progetto.
import { LIBRERIA_3D, CATEGORIE_ARREDO, partiArredo, dimensioniArredo, agganciaAlMuro, collisioniArredo } from "../core/arredi.js";
import { aggiungiArredo, modificaArredo, duplicaArredo, eliminaElemento } from "../core/project.js";
import { gruppoArredo, miniatura } from "../view/modelli3d.js";
import { suono } from "./dock-infissi.js";

const GRIGLIA = 50;
const passo = (v) => Math.round(v / GRIGLIA) * GRIGLIA;

function el(tag, cls, testo) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (testo !== undefined) e.textContent = testo;
  return e;
}

// Posizione proposta per un arredo nel punto p: aggancio al muro se vicino, altrimenti griglia di 50 mm
export function posizioneProposta(base, p, walls) {
  const a = { ...base, x: passo(p[0]), y: passo(p[1]) };
  const ag = agganciaAlMuro(a, walls);
  return ag ? { ...a, x: ag.x, y: ag.y, rot: ag.rot, muro: ag.muro } : a;
}

// opz: { box, viewer, contenitore, getProgetto, applica(nuovoProgetto), messaggio(testo, tipo), attiva() }
export function montaArredo(opz) {
  const { box, viewer, contenitore, getProgetto, applica, messaggio } = opz;
  let categoria = "soggiorno";
  let ricerca = "";
  let piazzando = null; // { tipo, finitura, rot }
  let selezionato = null;
  let trascina = null; // { id, dx, dy, mosso }
  let attiva = false;

  box.innerHTML = "";
  const filtri = el("div", "arr-filtri");
  const cerca = el("input", "arr-cerca");
  cerca.type = "search";
  cerca.placeholder = "Cerca: divano, letto, cucina…";
  cerca.oninput = () => { ricerca = cerca.value.trim().toLowerCase(); disegnaCatalogo(); };
  const chips = el("div", "arr-chips");
  const griglia = el("div", "arr-griglia");
  const ispettore = el("div", "arr-ispettore");
  const aiuto = el("div", "arr-aiuto",
    "Clic su un arredo del catalogo, poi clic nella stanza per posarlo. Vicino a un muro si appoggia da solo. " +
    "Trascina per spostare · Q/E ruota 15° · R ruota 90° · Ctrl+D duplica · Canc elimina · frecce sposta 10 mm (Maiusc 100 mm) · Esc annulla.");
  filtri.append(cerca, chips);
  box.append(filtri, griglia, ispettore, aiuto);

  function disegnaChips() {
    chips.innerHTML = "";
    for (const [id, nome] of Object.entries(CATEGORIE_ARREDO)) {
      const b = el("button", `arr-chip${id === categoria ? " attiva" : ""}`, nome);
      b.onclick = () => { categoria = id; cerca.value = ""; ricerca = ""; disegnaChips(); disegnaCatalogo(); suono(760, 0.03); };
      chips.append(b);
    }
  }

  function disegnaCatalogo() {
    griglia.innerHTML = "";
    const voci = Object.entries(LIBRERIA_3D).filter(([k, d]) => (ricerca ? `${k} ${d.nome}`.toLowerCase().includes(ricerca) : d.categoria === categoria));
    voci.forEach(([tipo, d], i) => {
      const c = el("button", `arr-card${piazzando?.tipo === tipo ? " attiva" : ""}`);
      c.style.animationDelay = `${i * 30}ms`;
      c.title = `${d.nome} · ${d.L} × ${d.D} × ${d.H} mm`;
      const img = el("div", "arr-card-img");
      const im = el("img");
      im.alt = d.nome;
      img.append(im);
      miniatura(`arredo:${tipo}`, () => gruppoArredo(partiArredo({ tipo, x: 0, y: 0, rot: 0 }), { id: "m", tipo, x: 0, y: 0, rot: 20 })).then((src) => { if (src) im.src = src; });
      c.append(img, el("div", "arr-card-nome", d.nome), el("div", "arr-card-dim", `${d.L / 10} × ${d.D / 10} × ${d.H / 10} cm`));
      c.onclick = () => { iniziaPosa(tipo); };
      griglia.append(c);
    });
    if (!voci.length) griglia.append(el("div", "arr-vuoto", "Nessun arredo trovato."));
  }

  function iniziaPosa(tipo) {
    piazzando = { tipo, finitura: LIBRERIA_3D[tipo].finiture[0].id, rot: 0 };
    seleziona(null);
    suono(660, 0.05);
    messaggio(`Posa: ${LIBRERIA_3D[tipo].nome}. Clic nella stanza per posare, Esc per annullare.`, "info");
    disegnaCatalogo();
  }

  function fineposa() {
    piazzando = null;
    viewer.setFantasma(null);
    disegnaCatalogo();
  }

  function seleziona(id) {
    selezionato = id;
    viewer.setSelezione(id);
    disegnaIspettore();
  }

  function disegnaIspettore() {
    ispettore.innerHTML = "";
    const p = getProgetto();
    const a = p.furniture.find((x) => x.id === selezionato);
    if (!a || !LIBRERIA_3D[a.tipo]) { ispettore.classList.remove("visibile"); return; }
    ispettore.classList.add("visibile");
    const def = LIBRERIA_3D[a.tipo];
    const d = dimensioniArredo(a);
    ispettore.append(el("div", "arr-isp-titolo", def.nome), el("div", "arr-isp-id", a.id));
    const fin = el("div", "arr-finiture");
    for (const f of def.finiture) {
      const b = el("button", `arr-finitura${f.id === d.finitura.id ? " attiva" : ""}`);
      b.style.background = f.colore;
      b.title = f.nome;
      b.onclick = () => cambia({ finitura: f.id });
      fin.append(b);
    }
    ispettore.append(fin);
    const campi = el("div", "arr-campi");
    const campo = (nome, chiave, valore) => {
      const l = el("label", "arr-campo");
      l.append(el("span", "", nome));
      const i = el("input");
      i.type = "number";
      i.step = chiave === "rot" ? "15" : "10";
      i.value = valore;
      i.onchange = () => { const v = Math.round(Number(i.value)); if (Number.isFinite(v)) cambia({ [chiave]: v }); };
      l.append(i);
      campi.append(l);
    };
    campo("Largh. mm", "L", d.L); campo("Prof. mm", "D", d.D); campo("Alt. mm", "H", d.H);
    campo("X mm", "x", a.x); campo("Y mm", "y", a.y); campo("Rotaz. °", "rot", a.rot ?? 0);
    ispettore.append(campi);
    const coll = collisioniArredo(a, p);
    if (coll.length) ispettore.append(el("div", "arr-avviso", `Tocca ${coll.map((c) => (c.tipo === "muro" ? `il muro ${c.id}` : `l'arredo ${c.id}`)).join(", ")}`));
    const azioni = el("div", "arr-azioni");
    const bott = (t, fn, cls = "") => { const b = el("button", cls, t); b.onclick = fn; azioni.append(b); };
    bott("↻ 90°", () => cambia({ rot: (a.rot ?? 0) + 90 }));
    bott("⧉ Duplica", () => duplica());
    bott("Appoggia al muro", () => { const ag = agganciaAlMuro(a, p.walls, 1500); if (ag) cambia({ x: ag.x, y: ag.y, rot: ag.rot }); else messaggio("Nessun muro vicino.", "info"); });
    bott("🗑 Elimina", () => elimina(), "pericolo");
    ispettore.append(azioni);
  }

  function cambia(campi) {
    const r = modificaArredo(getProgetto(), selezionato, campi);
    if (r.errore) return messaggio(r.errore, "errore");
    applica(r.p);
    suono(820, 0.03);
    disegnaIspettore();
  }
  function duplica() {
    const r = duplicaArredo(getProgetto(), selezionato);
    if (r.errore) return;
    applica(r.p);
    seleziona(r.id);
    suono(900, 0.05);
  }
  function elimina() {
    if (!selezionato) return;
    applica(eliminaElemento(getProgetto(), selezionato));
    seleziona(null);
    suono(300, 0.08);
  }

  // Eventi sul viewport: fase di cattura per fermare la rotazione della vista quando si trascina un arredo
  const dom = viewer.domElement;
  function suPuntatoreGiu(ev) {
    if (!attiva || ev.button !== 0) return;
    if (piazzando) return; // la posa avviene al rilascio
    const h = viewer.oggettoDaEvento(ev);
    if (h?.kind === "arredo") {
      const a = getProgetto().furniture.find((x) => x.id === h.id);
      const p = viewer.pianoDaEvento(ev);
      if (a && p) {
        seleziona(a.id);
        trascina = { id: a.id, dx: a.x - p[0], dy: a.y - p[1], mosso: false };
        viewer.controls.enabled = false;
        ev.stopPropagation();
      }
    } else if (!ev.shiftKey) {
      seleziona(null);
    }
  }
  function suMovimento(ev) {
    if (!attiva) return;
    const p = viewer.pianoDaEvento(ev);
    if (!p) return;
    const prog = getProgetto();
    if (piazzando) {
      const a = posizioneProposta({ id: "_posa", tipo: piazzando.tipo, rot: piazzando.rot, finitura: piazzando.finitura }, p, prog.walls);
      if (!a.muro) a.rot = piazzando.rot;
      piazzando.ultimo = a;
      viewer.setFantasma(partiArredo(a), a, collisioniArredo(a, prog).length > 0);
      return;
    }
    if (trascina) {
      const a = prog.furniture.find((x) => x.id === trascina.id);
      const prop = posizioneProposta({ ...a, id: a.id }, [p[0] + trascina.dx, p[1] + trascina.dy], prog.walls);
      trascina.ultimo = prop;
      trascina.mosso = true;
      viewer.setFantasma(partiArredo(prop), prop, collisioniArredo(prop, prog).length > 0);
    }
  }
  function suPuntatoreSu(ev) {
    if (!attiva || ev.button !== 0) return;
    if (piazzando?.ultimo) {
      const a = piazzando.ultimo;
      const r = aggiungiArredo(getProgetto(), a.tipo, a.x, a.y, a.rot, { finitura: a.finitura });
      if (r.errore) { messaggio(r.errore, "errore"); return; }
      applica(r.p);
      suono(880, 0.07, 0.05);
      const nuovo = r.id;
      if (!ev.shiftKey) { fineposa(); seleziona(nuovo); } // Maiusc: continua a posare lo stesso arredo
      messaggio("Arredo posato.", "ok");
      return;
    }
    if (trascina) {
      viewer.controls.enabled = true;
      const t = trascina;
      trascina = null;
      viewer.setFantasma(null);
      if (t.mosso && t.ultimo) cambia({ x: t.ultimo.x, y: t.ultimo.y, rot: t.ultimo.rot });
    }
  }
  contenitore.addEventListener("pointerdown", suPuntatoreGiu, true);
  dom.addEventListener("pointermove", suMovimento);
  window.addEventListener("pointerup", suPuntatoreSu);

  window.addEventListener("keydown", (e) => {
    if (!attiva || e.target.closest?.("input, textarea, select")) return;
    const k = e.key.toLowerCase();
    if (k === "escape") { if (piazzando) fineposa(); else seleziona(null); return; }
    if (piazzando && ["q", "e", "r"].includes(k)) {
      piazzando.rot = (piazzando.rot + (k === "q" ? -15 : k === "e" ? 15 : 90) + 360) % 360;
      if (piazzando.ultimo) { piazzando.ultimo.rot = piazzando.rot; viewer.setFantasma(partiArredo(piazzando.ultimo), piazzando.ultimo); }
      e.preventDefault();
      return;
    }
    if (!selezionato) return;
    const a = getProgetto().furniture.find((x) => x.id === selezionato);
    if (!a) return;
    if (k === "delete" || k === "backspace") { elimina(); e.preventDefault(); }
    else if (k === "q") cambia({ rot: (a.rot ?? 0) - 15 });
    else if (k === "e") cambia({ rot: (a.rot ?? 0) + 15 });
    else if (k === "r") cambia({ rot: (a.rot ?? 0) + 90 });
    else if (k === "d" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); duplica(); }
    else if (k.startsWith("arrow")) {
      const s = e.shiftKey ? 100 : 10;
      const d = { arrowleft: [-s, 0], arrowright: [s, 0], arrowup: [0, -s], arrowdown: [0, s] }[k];
      if (d) { e.preventDefault(); cambia({ x: a.x + d[0], y: a.y + d[1] }); }
    }
  });

  disegnaChips();
  disegnaCatalogo();
  disegnaIspettore();

  return {
    attiva(v) {
      attiva = v;
      if (!v) { fineposa(); seleziona(null); }
    },
    aggiorna() { if (selezionato && !getProgetto().furniture.some((x) => x.id === selezionato)) seleziona(null); else disegnaIspettore(); viewer.setSelezione(selezionato); },
    seleziona,
    iniziaPosa,
    stato: () => ({ attiva, piazzando: piazzando?.tipo ?? null, selezionato }),
  };
}
