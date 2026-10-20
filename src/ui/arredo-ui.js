// Modalita' Arredo (stile Sweet Home 3D): catalogo di arredi 3D, posizionamento con fantasma verde/rosso, aggancio ai
// muri, trascinamento, rotazione, duplica, elimina, dimensioni e finiture. Tutto in mm interi nel progetto.
import { LIBRERIA_3D, CATEGORIE_ARREDO, partiArredo, dimensioniArredo, agganciaAlMuro, collisioniArredo } from "../core/arredi.js?v=v20261020bk";
import { aggiungiArredo, modificaArredo, duplicaArredo, eliminaElemento, impostaMaterialePavimento, impostaTintaMuro, MATERIALI_PAVIMENTO, TINTE_MURO } from "../core/project.js?v=v20261020bk";
import { gruppoArredo, miniatura } from "../view/modelli3d.js?v=v20261020bk";
import { suono } from "./dock-infissi.js?v=v20261020bk";

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
  // Due sottoschede: Arredi e Pavimenti e verniciatura
  const sottoBarra = el("div", "arr-sottobarra");
  const bArredi = el("button", "arr-sub attiva", "Arredi");
  const bPav = el("button", "arr-sub", "Pavimenti");
  const bVern = el("button", "arr-sub", "Verniciature");
  sottoBarra.append(bArredi, bPav, bVern);
  // finestre distinte: Pavimenti (finPav) e Verniciature (finiture)
  const finPav = el("div", "arr-finiture arr-sezione");
  const finiture = el("div", "arr-finiture arr-sezione");
  finPav.style.display = "none";
  finiture.style.display = "none";
  function mostra(sezione) {
    filtri.style.display = sezione === "arredi" ? "" : "none";
    griglia.style.display = sezione === "arredi" ? "" : "none";
    ispettore.style.display = sezione === "arredi" ? "" : "none";
    aiuto.style.display = sezione === "arredi" ? "" : "none";
    finPav.style.display = sezione === "pavimenti" ? "" : "none";
    finiture.style.display = sezione === "verniciature" ? "" : "none";
    bArredi.classList.toggle("attiva", sezione === "arredi");
    bPav.classList.toggle("attiva", sezione === "pavimenti");
    bVern.classList.toggle("attiva", sezione === "verniciature");
  }
  bArredi.onclick = () => mostra("arredi");
  bPav.onclick = () => { disegnaPavimenti(); mostra("pavimenti"); };
  bVern.onclick = () => { disegnaFiniture(); mostra("verniciature"); };
  // dalla barra in basso: Arredo apre Arredi, Pavimento apre Pavimenti
  window.addEventListener("arredi:sezione", (e) => {
    if (e.detail === "pavimenti") { disegnaPavimenti(); mostra("pavimenti"); }
    else if (e.detail === "verniciature") { disegnaFiniture(); mostra("verniciature"); }
    else mostra("arredi");
  });
  // Applica a tutti i pavimenti o a tutti i muri del progetto e ridisegna
  // Secchiello: scelto un materiale, il clic su un pavimento o su un muro lo riempie
  let secchio = null; // { tipo: "pavimento" | "tinta", chiave, nome, colore }
  const cursore = el("div", "arr-secchio");
  cursore.style.display = "none";
  cursore.innerHTML = '<svg viewBox="0 0 24 24" width="40" height="40"><path d="M6 9h12l-1.6 11H7.6z" fill="currentColor" stroke="#1b2236" stroke-width="1"/><rect x="4.5" y="7" width="15" height="2.6" rx="1" fill="#1b2236"/><path d="M7 7a5 5 0 0 1 10 0" fill="none" stroke="#1b2236" stroke-width="1.4"/><path d="M17.6 16.5c0 1.2-.8 2-1.8 2s-1.8-.8-1.8-2c0-1.3 1.8-3.4 1.8-3.4s1.8 2.1 1.8 3.4z" fill="currentColor" stroke="#1b2236" stroke-width=".6"/></svg>';
  document.body.append(cursore);
  function impostaSecchio(nuovo) {
    secchio = nuovo;
    cursore.style.display = nuovo ? "block" : "none";
    cursore.style.color = nuovo?.colore ?? "#ffc44d";
    if (nuovo) messaggio(`Secchiello: ${nuovo.nome}. Clic su ${nuovo.tipo === "pavimento" ? "un pavimento" : "un muro"} per riempirlo. Tasto destro o Esc per uscire.`, "info");
  }
  document.addEventListener("pointermove", (e) => { if (secchio) { cursore.style.left = `${e.clientX + 6}px`; cursore.style.top = `${e.clientY - 26}px`; } });
  document.addEventListener("keydown", (e) => { if (secchio && e.key === "Escape") impostaSecchio(null); });
  document.addEventListener("contextmenu", () => { if (secchio) impostaSecchio(null); });
  function riempi(hit) {
    if (!secchio || !hit) return false;
    const p = opz.getProgetto();
    let q = null;
    if (secchio.tipo === "pavimento" && (hit.kind === "pavimento" || !hit.kind)) {
      // pavimento di una stanza: il riquadro della stanza sotto il clic
      q = opz.pavimentoAlPunto?.(hit.mm, secchio.chiave) ?? null;
    } else if (secchio.tipo === "tinta" && hit.kind === "muro") {
      q = opz.tintaMuroAlPunto?.(hit.mm, secchio.chiave) ?? null;
    } else {
      return false;
    }
    if (q) opz.applica(q);
    return true;
  }
  function disegnaPavimenti() {
    finPav.innerHTML = "";
    finPav.append(el("div", "arr-titolo-fin", "Pavimenti"));
    const pav = el("div", "arr-chips");
    for (const [k, v] of Object.entries(MATERIALI_PAVIMENTO)) {
      const b = el("button", "arr-chip", v.nome);
      b.onclick = () => {
        impostaSecchio({ tipo: "pavimento", chiave: k, nome: v.nome, colore: v.colore ? `rgb(${v.colore.join(",")})` : "#c8a476" });
        for (const x of pav.querySelectorAll(".arr-chip")) x.classList.toggle("attiva", x === b);
      };
      pav.append(b);
    }
    finPav.append(pav);
  }
  function disegnaFiniture() {
    finiture.innerHTML = "";

    // Verniciatura muri: modalita' di tinteggiatura, sotto il colore
    // Modalita' di tinteggiatura: prima si sceglie la modalita', poi il colore sotto
    const TECNICHE = [
      ["lavabile", "Pittura lavabile opaca"], ["satinata", "Pittura satinata"], ["smalto", "Smalto satinato"],
      ["calce", "Pittura a calce"], ["silicati", "Pittura ai silicati"], ["minerale", "Pittura minerale traspirante"],
      ["velatura", "Velatura a spugna"], ["spatolato", "Spatolato a stucco"], ["microcemento", "Effetto microcemento"],
      ["stucco", "Stucco veneziano lucidato"],
    ];
    let tecnicaMuro = null; // nessuna modalita' preselezionata
    const tin = el("div", "arr-chips");
    const tecnicaEtic = el("div", "arr-etic", "Scegli la modalità di tinteggiatura");
    for (const [id, nome] of TECNICHE) {
      const b = el("button", "arr-chip", nome);
      b.onclick = () => {
        tecnicaMuro = [id, nome];
        tecnicaEtic.textContent = `Modalità: ${nome}`;
        for (const x of tin.querySelectorAll(".arr-chip")) x.classList.toggle("attiva", x === b);
      };
      tin.append(b);
    }
    finiture.append(el("div", "arr-titolo-fin", "Verniciatura muri"), tin, tecnicaEtic);
    // Colori da interni: tinte pastello e terrose, non colori saturi
    finiture.append(el("div", "arr-titolo-fin", "Colore"));
    const pal = el("div", "arr-palette");
    const COLORI_INTERNI = [
      ["Bianco latte", "#F3EFE6"], ["Bianco caldo", "#F7F2E8"], ["Avorio", "#EDE3C8"], ["Sabbia", "#D9C7A7"],
      ["Ocra tenue", "#C9A66B"], ["Senape tenue", "#D1A94F"], ["Terracotta", "#B86B4B"], ["Terra di Siena", "#A9694A"],
      ["Rosa cipria", "#D9B8AE"], ["Lavanda polvere", "#B9B2CC"], ["Salvia", "#A7B29A"], ["Verde oliva", "#7D7F5C"],
      ["Verde bosco", "#4E5D4A"], ["Azzurro cielo", "#BFD3DD"], ["Blu ardesia", "#6E7F96"], ["Blu notte", "#2C3A4F"],
      ["Grigio perla", "#C9CACB"], ["Grigio talpa", "#8A8A86"], ["Grigio grafite", "#5B6068"], ["Antracite", "#3A3D42"],
      ["Tortora", "#B7A99A"], ["Caffè", "#6F5447"], ["Nero carbone", "#1F2226"],
    ];
    for (const [nome, hex] of COLORI_INTERNI) {
      const b = el("button", "arr-swatch");
      b.style.setProperty("background", hex, "important");
      b.title = nome;
      b.setAttribute("aria-label", nome);
      b.onclick = () => {
        const tec = tecnicaMuro ?? TECNICHE[0];
        const chiave = `colore_${hex.slice(1).toLowerCase()}_${tec[0]}`;
        const nomeCompleto = `${tec[1]} · ${nome}`;
        TINTE_MURO[chiave] = { nome: nomeCompleto, hex, tecnica: tec[0] };
        impostaSecchio({ tipo: "tinta", chiave, nome: nomeCompleto, colore: hex });
      };
      pal.append(b);
    }
    finiture.append(pal);
    finiture.append(el("div", "arr-titolo-fin", "Altro colore"));

    const pannello = el("div", "arr-picker");
    const tela = document.createElement("canvas");
    tela.width = 200; tela.height = 200; tela.className = "arr-tela";
    const luce = el("input", "arr-luce"); luce.type = "range"; luce.min = "10"; luce.max = "90"; luce.value = "50";
    const codice = el("input", "arr-codice"); codice.type = "text"; codice.placeholder = "#RRGGBB";
    const usa = el("button", "arr-usa", "Usa questo colore");
    pannello.append(tela, el("div", "arr-etic", "Luminosità"), luce, codice, usa);
    finiture.append(pannello);

    let colore = "#808080";
    let tinta = { h: 0, s: 0 }; // ultimo punto scelto sul cerchio
    // il campo # prende il colore scelto, con testo leggibile sopra
    function mostraColore() {
      const r = parseInt(colore.slice(1, 3), 16), g = parseInt(colore.slice(3, 5), 16), b = parseInt(colore.slice(5, 7), 16);
      codice.style.background = colore;
      codice.style.color = (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? "#111" : "#f5f5f5";
    }
    function hslHex(h, sat, l) {
      const k = (n) => (n + h / 30) % 12;
      const a = sat * Math.min(l, 1 - l);
      const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
    }
    function disegnaRuotaColori() {
      const ctx = tela.getContext("2d");
      const cx = 100, cy = 100;
      const grad = ctx.createConicGradient(0, cx, cy);
      for (let i = 0; i <= 12; i++) grad.addColorStop(i / 12, `hsl(${i * 30}, 100%, ${luce.value}%)`);
      ctx.clearRect(0, 0, 200, 200);
      ctx.beginPath(); ctx.arc(cx, cy, 98, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
      const centro = ctx.createRadialGradient(cx, cy, 0, cx, cy, 98);
      centro.addColorStop(0, "rgba(255,255,255,0.9)"); centro.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = centro; ctx.beginPath(); ctx.arc(cx, cy, 98, 0, Math.PI * 2); ctx.fill();
    }
    tela.onclick = (ev) => {
      const r = tela.getBoundingClientRect();
      const x = (ev.clientX - r.left) * (200 / r.width) - 100, y = (ev.clientY - r.top) * (200 / r.height) - 100;
      const dist = Math.hypot(x, y);
      if (dist > 98) return;
      const h = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      const sat = Math.min(1, dist / 98);
      tinta = { h, s: sat };
      colore = hslHex(h, sat, luce.value / 100);
      codice.value = colore;
      mostraColore();
      if (secchio?.tipo === "tinta") impostaSecchio({ ...secchio, colore, chiave: `colore_${colore.slice(1).toLowerCase()}`, nome: colore });
    };
    luce.oninput = () => {
      disegnaRuotaColori();
      colore = hslHex(tinta.h, tinta.s, luce.value / 100);
      codice.value = colore;
      mostraColore();
    };
    codice.onchange = () => {
      const v = codice.value.trim();
      if (!/^#[0-9a-f]{6}$/i.test(v)) return;
      colore = v.toLowerCase();
      codice.value = colore;
      mostraColore();
      if (secchio?.tipo === "tinta") impostaSecchio({ ...secchio, colore, chiave: `colore_${colore.slice(1)}`, nome: colore });
    };
    usa.onclick = () => {
      const tec = tecnicaMuro ?? TECNICHE[0];
      const chiave = `colore_${colore.slice(1).toLowerCase()}_${tec[0]}`;
      TINTE_MURO[chiave] = { nome: colore, hex: colore };
      impostaSecchio({ tipo: "tinta", chiave, nome: colore, colore });
    };
    disegnaRuotaColori();
  }
  box.append(sottoBarra, filtri, griglia, ispettore, aiuto, finPav, finiture);
  // tasto destro nel pannello: toglie la selezione (arredo da posare o arredo selezionato)
  box.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    if (piazzando) fineposa();
    if (selezionato) seleziona(null);
  });

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
    } else if (!ev.shiftKey && ev.target === viewer.domElement && !h) {
      // deseleziona solo con un clic sul vuoto della scena; pulsanti e pannelli non toccano la selezione
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
    riempi,
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
