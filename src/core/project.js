// Progetto modificabile: muri, vani, pavimenti, arredi. Tutto in mm interi. Funzioni pure.
// Un progetto nuovo e' VUOTO: nessun muro, nessun pavimento, nessun arredo.
import { validatePlan, wallLengthMm, SCHEMA } from "./model.js";
import { LIBRERIA_3D, dimensioniArredo, angoliArredo } from "./arredi.js";

// Libreria degli arredi: derivata dalla libreria 3D (src/core/arredi.js). Colore in RGB per la pianta 2D.
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const LIBRERIA_ARREDI = Object.fromEntries(Object.entries(LIBRERIA_3D).map(([k, v]) => [k, {
  nome: v.nome, categoria: v.categoria, L: v.L, D: v.D, H: v.H, colore: rgb(v.finiture[0].colore),
}]));

// Pavimenti: legni e marmo con foto reali (assets/tex, Poly Haven CC0). "foto" = slug del set fotografico.
// Il gres non ha foto: resta a colore pieno.
export const MATERIALI_PAVIMENTO = {
  parquet: { nome: "Parquet rovere a doghe", colore: [200, 164, 118], foto: "parquet" },
  rovere_doghe: { nome: "Rovere naturale a doghe", colore: [196, 160, 116], foto: "pav_rovere_doghe" },
  spina_pesce: { nome: "Parquet a spina di pesce", colore: [190, 150, 104], foto: "pav_spina_pesce" },
  rovere_scuro: { nome: "Rovere scuro", colore: [92, 62, 40], foto: "pav_rovere_scuro" },
  quadrotti: { nome: "Parquet a quadrotti", colore: [180, 140, 96], foto: "pav_quadrotti" },
  marmo: { nome: "Marmo chiaro", colore: [240, 240, 236], foto: "marmo" },
  gres: { nome: "Gres chiaro", colore: [220, 218, 212] },
};

// Finiture dei muri: diversi bianchi, intonaci e marmo, con foto reali
export const MATERIALI_MURO = {
  intonaco_bianco: { nome: "Bianco calce", colore: [246, 245, 240], foto: "mur_bianco_calce" },
  bianco_latte: { nome: "Bianco latte", colore: [240, 236, 226], foto: "mur_bianco_latte" },
  bianco_civile: { nome: "Bianco civile", colore: [242, 240, 234], foto: "mur_bianco_civile" },
  intonaco_grigio: { nome: "Grigio perla", colore: [176, 180, 186], foto: "mur_grigio_perla" },
  intonaco_ocra: { nome: "Intonaco beige", colore: [217, 183, 122], foto: "intonaco" },
  marmo: { nome: "Marmo chiaro", colore: [240, 240, 236], foto: "marmo" },
};

// Tinte dei muri, moltiplicate sulla foto (Naturale = nessuna tinta)
export const TINTE_MURO = {
  naturale: { nome: "Naturale", hex: "#ffffff" },
  avorio: { nome: "Avorio", hex: "#f2e8d4" },
  ocra: { nome: "Ocra", hex: "#d9b77a" },
  salvia: { nome: "Verde salvia", hex: "#a9b8a0" },
  terracotta: { nome: "Terracotta", hex: "#c98a6b" },
  ardesia: { nome: "Blu ardesia", hex: "#6e7f96" },
  grafite: { nome: "Grafite", hex: "#5b6068" },
};

// Cambia la tinta di un muro. Restituisce { p } o { errore }.
export function impostaTintaMuro(p, id, tinta) {
  if (!TINTE_MURO[tinta]) return { errore: "tinta sconosciuta" };
  if (!p.walls.some((w) => w.id === id)) return { errore: "muro inesistente" };
  return { p: { ...p, walls: p.walls.map((w) => (w.id === id ? { ...w, tinta } : w)) } };
}

// Cambia il materiale di un pavimento. Restituisce { p } o { errore }.
export function impostaMaterialePavimento(p, id, materiale) {
  if (!MATERIALI_PAVIMENTO[materiale]) return { errore: "materiale sconosciuto" };
  if (!p.floors.some((f) => f.id === id)) return { errore: "pavimento inesistente" };
  return { p: { ...p, floors: p.floors.map((f) => (f.id === id ? { ...f, materiale } : f)) } };
}

// Cambia la finitura di un muro (e di tutti i tratti del suo muro). Restituisce { p } o { errore }.
export function impostaFinituraMuro(p, id, finitura) {
  if (!MATERIALI_MURO[finitura]) return { errore: "finitura sconosciuta" };
  if (!p.walls.some((w) => w.id === id)) return { errore: "muro inesistente" };
  return { p: { ...p, walls: p.walls.map((w) => (w.id === id ? { ...w, finitura } : w)) } };
}

export function progettoVuoto(nome = "Nuovo progetto") {
  return {
    schema: SCHEMA,
    unit: "mm",
    altezza_muri: 2800,
    name: nome,
    walls: [],
    openings: [],
    floors: [],
    furniture: [],
  };
}

const intero = (v) => Number.isInteger(v);
const nuovoId = (prefisso, lista) => `${prefisso}_${String(lista.length + 1).padStart(3, "0")}`;
// id che non collide anche dopo eliminazioni (n = primo numero libero)
const nuovoIdUnico = (prefisso, lista) => {
  const usati = new Set(lista.map((x) => x.id));
  let n = lista.length + 1;
  while (usati.has(`${prefisso}_${String(n).padStart(3, "0")}`)) n++;
  return `${prefisso}_${String(n).padStart(3, "0")}`;
};

export function aggiungiMuro(p, a, b, t, kind = "tramezzo") {
  if (![...a, ...b, t].every(intero)) return { errore: "coordinate e spessore devono essere interi mm" };
  if (a[0] === b[0] && a[1] === b[1]) return { errore: "muro di lunghezza zero" };
  if (!(t > 0 && t % 2 === 0)) return { errore: "spessore: intero pari > 0" };
  const id = nuovoId("muro", p.walls);
  return { p: { ...p, walls: [...p.walls, { id, a, b, t, kind }] }, id };
}

export function aggiungiVano(p, muroId, offset, larghezza, altezza, davanzale, tipo, cdi = null) {
  const muro = p.walls.find((w) => w.id === muroId);
  if (!muro) return { errore: "muro inesistente" };
  if (![offset, larghezza, altezza, davanzale].every(intero)) return { errore: "valori del vano devono essere interi mm" };
  const L = wallLengthMm(muro);
  if (offset < 0 || offset + larghezza > L) return { errore: `il vano esce dal muro (lunghezza ${L} mm)` };
  const id = nuovoId("vano", p.openings);
  const op = { id, wall: muroId, offset, width: larghezza, height: altezza, sill: davanzale, type: tipo, cdi };
  const next = { ...p, openings: [...p.openings, op] };
  const v = validatePlan(next);
  if (!v.ok) return { errore: v.errors[0] };
  return { p: next, id, avvisi: v.warnings };
}

export function aggiungiPavimento(p, x0, y0, x1, y1, materiale = "parquet") {
  if (![x0, y0, x1, y1].every(intero)) return { errore: "coordinate pavimento: interi mm" };
  if (x1 <= x0 || y1 <= y0) return { errore: "pavimento di area nulla" };
  if (!MATERIALI_PAVIMENTO[materiale]) return { errore: "materiale sconosciuto" };
  const id = nuovoId("pav", p.floors);
  return { p: { ...p, floors: [...p.floors, { id, x0, y0, x1, y1, materiale }] }, id };
}

// Arredo: posizione del centro (mm interi), rotazione in gradi interi (0..359), dimensioni e finitura opzionali
export function aggiungiArredo(p, tipo, x, y, rot = 0, opzioni = {}) {
  const def = LIBRERIA_ARREDI[tipo];
  if (!def) return { errore: "tipo di arredo sconosciuto" };
  if (![x, y].every(intero)) return { errore: "posizione arredo: interi mm" };
  if (!intero(rot)) return { errore: "rotazione: gradi interi" };
  const dims = ["L", "D", "H"].filter((k) => opzioni[k] !== undefined);
  if (dims.some((k) => !(intero(opzioni[k]) && opzioni[k] > 0))) return { errore: "dimensioni arredo: interi mm > 0" };
  const id = nuovoIdUnico("arredo", p.furniture);
  const a = { id, tipo, x, y, rot: ((rot % 360) + 360) % 360 };
  for (const k of [...dims, "finitura"]) if (opzioni[k] !== undefined) a[k] = opzioni[k];
  return { p: { ...p, furniture: [...p.furniture, a] }, id };
}

// Modifica di un arredo (posizione, rotazione, dimensioni, finitura). Valori non validi: nessuna modifica.
export function modificaArredo(p, id, campi) {
  const a = p.furniture.find((x) => x.id === id);
  if (!a) return { errore: "arredo inesistente" };
  const nuovo = { ...a, ...campi };
  if (![nuovo.x, nuovo.y, nuovo.rot].every(intero)) return { errore: "posizione e rotazione: interi" };
  for (const k of ["L", "D", "H"]) if (nuovo[k] !== undefined && !(intero(nuovo[k]) && nuovo[k] > 0)) return { errore: `${k}: intero mm > 0` };
  nuovo.rot = ((nuovo.rot % 360) + 360) % 360;
  return { p: { ...p, furniture: p.furniture.map((x) => (x.id === id ? nuovo : x)) } };
}

export function duplicaArredo(p, id, dx = 300, dy = 300) {
  const a = p.furniture.find((x) => x.id === id);
  if (!a) return { errore: "arredo inesistente" };
  const nid = nuovoIdUnico("arredo", p.furniture);
  return { p: { ...p, furniture: [...p.furniture, { ...a, id: nid, x: a.x + dx, y: a.y + dy }] }, id: nid };
}

// Ingombro in pianta. Rotazioni multiple di 90 gradi: valori interi esatti. Altre rotazioni: box che contiene
// l'arredo ruotato (non intero) e i quattro angoli.
export function ingombroArredo(a) {
  const def = LIBRERIA_ARREDI[a.tipo];
  const d = dimensioniArredo(a) ?? { L: def.L, D: def.D, H: def.H };
  const r = ((a.rot ?? 0) % 360 + 360) % 360;
  if (r % 90 === 0) {
    const ruotato = r === 90 || r === 270;
    const L = ruotato ? d.D : d.L;
    const D = ruotato ? d.L : d.D;
    return { x0: a.x - L / 2, y0: a.y - D / 2, L, D, H: d.H, colore: def.colore, rot: r };
  }
  const ang = angoliArredo(a);
  const xs = ang.map((q) => q[0]), ys = ang.map((q) => q[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), L: Math.max(...xs) - Math.min(...xs), D: Math.max(...ys) - Math.min(...ys), H: d.H, colore: def.colore, rot: r, angoli: ang };
}

export function ruotaArredo(p, id) {
  return { ...p, furniture: p.furniture.map((a) => (a.id === id ? { ...a, rot: (a.rot + 90) % 360 } : a)) };
}

export function spostaArredo(p, id, x, y) {
  if (![x, y].every(intero)) return p;
  return { ...p, furniture: p.furniture.map((a) => (a.id === id ? { ...a, x, y } : a)) };
}

// Elimina un elemento per id. Eliminando un muro si eliminano anche i suoi vani.
export function eliminaElemento(p, id) {
  if (p.walls.some((w) => w.id === id)) {
    return {
      ...p,
      walls: p.walls.filter((w) => w.id !== id),
      openings: p.openings.filter((o) => o.wall !== id),
    };
  }
  return {
    ...p,
    openings: p.openings.filter((o) => o.id !== id),
    floors: p.floors.filter((f) => f.id !== id),
    furniture: p.furniture.filter((a) => a.id !== id),
  };
}

// Pavimento di una stanza: poligono interno della stanza, in mm interi. Stessa stanza = stesso pavimento (aggiornato).
export function impostaPavimentoStanza(p, poligono, materiale) {
  if (!MATERIALI_PAVIMENTO[materiale]) return { errore: "materiale sconosciuto" };
  const pts = poligono.map(([x, y]) => [Math.round(x), Math.round(y)]);
  if (pts.length < 3) return { errore: "stanza senza area" };
  const chiave = JSON.stringify(pts);
  const esistente = p.floors.find((f) => f.poligono && JSON.stringify(f.poligono) === chiave);
  if (esistente) return { p: { ...p, floors: p.floors.map((f) => (f === esistente ? { ...f, materiale } : f)) }, id: esistente.id };
  const id = nuovoId("pav", p.floors);
  return { p: { ...p, floors: [...p.floors, { id, poligono: pts, materiale }] }, id };
}

// Funzione di una stanza (camera, bagno, ...), scelta dall'utente e salvata per poligono della stanza.
export function impostaFunzioneStanza(p, poligono, funzione) {
  const pts = poligono.map(([x, y]) => [Math.round(x), Math.round(y)]);
  const chiave = JSON.stringify(pts);
  const altre = (p.funzioniStanze ?? []).filter((f) => JSON.stringify(f.poligono) !== chiave);
  return { p: { ...p, funzioniStanze: [...altre, { poligono: pts, funzione }] } };
}

// Verifica completa del progetto: muri/vani con il validatore, pavimenti e arredi con i loro vincoli.
export function verificaProgetto(p) {
  const base = validatePlan(p);
  const errori = [...base.errors];
  for (const f of p.floors) {
    if (f.poligono) {
      if (!f.poligono.every(([x, y]) => intero(x) && intero(y))) errori.push(`pavimento ${f.id}: interi mm`);
    } else if (![f.x0, f.y0, f.x1, f.y1].every(intero)) errori.push(`pavimento ${f.id}: interi mm`);
  }
  for (const a of p.furniture) {
    if (!LIBRERIA_ARREDI[a.tipo]) errori.push(`arredo ${a.id}: tipo sconosciuto`);
  }
  return { ok: errori.length === 0, errors: errori, warnings: base.warnings };
}

// Spezza un muro agli incroci con gli altri muri (T o crocevia): ogni tratto diventa un muro a se'.
// Le aperture passano al tratto che le contiene. Restituisce { p, id } con l'id del tratto sotto mm.
export function spezzaMuro(p, wallId, mm) {
  const w = p.walls.find((x) => x.id === wallId);
  if (!w) return { errore: "muro inesistente" };
  const d = [w.b[0] - w.a[0], w.b[1] - w.a[1]];
  const L2 = d[0] * d[0] + d[1] * d[1];
  const cuts = [];
  const param = (q) => ((q[0] - w.a[0]) * d[0] + (q[1] - w.a[1]) * d[1]) / L2;
  for (const o of p.walls) {
    if (o.id === w.id) continue;
    for (const q of [o.a, o.b]) {
      const t = param(q);
      const lon = Math.abs((q[0] - w.a[0]) * d[1] - (q[1] - w.a[1]) * d[0]) / Math.sqrt(L2);
      // i muri divisori finiscono a meta' spessore dal muro portante: la tolleranza e' la somma delle meta' dei due spessori
      const tolleranza = (w.t + o.t) / 2 + 30;
      if (lon <= tolleranza && t > 0.001 && t < 0.999) cuts.push(t);
    }
  }
  const uniche = [...new Set(cuts.map((t) => Math.round(t * 1e6) / 1e6))].sort((x, y) => x - y);
  if (!uniche.length) {
    return { p, id: w.id };
  }
  const bordi = [0, ...uniche, 1];
  // punti di taglio in mm interi (il modello li richiede interi); lo stesso punto e' condiviso dai due tratti
  const punto = (t) => (t <= 0 ? w.a : t >= 1 ? w.b : [Math.round(w.a[0] + d[0] * t), Math.round(w.a[1] + d[1] * t)]);
  const tratti = [];
  for (let i = 0; i < bordi.length - 1; i++) {
    const t0 = bordi[i], t1 = bordi[i + 1];
    const id = i === 0 ? w.id : `${w.id}_${i}`;
    tratti.push({ id, t0, t1, muro: { ...w, id, a: punto(t0), b: punto(t1) } });
  }
  const walls = p.walls.flatMap((x) => (x.id === w.id ? tratti.map((tr) => tr.muro) : [x]));
  const openings = p.openings.map((o) => {
    if (o.wall !== w.id) return o;
    const pos = o.offset; // offset in mm lungo il muro
    const lunghezza = Math.sqrt(L2);
    const tr = tratti.find((x) => pos / lunghezza >= x.t0 - 1e-9 && pos / lunghezza <= x.t1 + 1e-9) ?? tratti[0];
    const inizio = tr.t0 * lunghezza;
    return { ...o, wall: tr.id, offset: Math.round(pos - inizio) };
  });
  const nuovo = { ...p, walls, openings };
  // tratto piu' vicino al punto cliccato
  const q = mm ?? [0, 0];
  let migliore = tratti[0];
  let dmin = Infinity;
  for (const tr of tratti) {
    const a = tr.muro.a, b = tr.muro.b;
    const ab = [b[0] - a[0], b[1] - a[1]];
    const l2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * ab[0] + (q[1] - a[1]) * ab[1]) / l2));
    const dist = Math.hypot(q[0] - (a[0] + ab[0] * t), q[1] - (a[1] + ab[1] * t));
    if (dist < dmin) { dmin = dist; migliore = tr; }
  }
  return { p: nuovo, id: migliore.id };
}

// Muro (o tratto) piu' vicino a un punto in mm, senza spezzare nulla
export function muroAPunto(p, mm) {
  if (!mm) return null;
  let migliore = null;
  let dmin = Infinity;
  for (const w of p.walls) {
    const ab = [w.b[0] - w.a[0], w.b[1] - w.a[1]];
    const l2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
    const t = Math.max(0, Math.min(1, ((mm[0] - w.a[0]) * ab[0] + (mm[1] - w.a[1]) * ab[1]) / l2));
    const dist = Math.hypot(mm[0] - (w.a[0] + ab[0] * t), mm[1] - (w.a[1] + ab[1] * t));
    if (dist < dmin) { dmin = dist; migliore = w.id; }
  }
  return migliore;
}
