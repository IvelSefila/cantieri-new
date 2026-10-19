// Progetto modificabile: muri, vani, pavimenti, arredi. Tutto in mm interi. Funzioni pure.
// Un progetto nuovo e' VUOTO: nessun muro, nessun pavimento, nessun arredo.
import { validatePlan, wallLengthMm, SCHEMA } from "./model.js";
import { LIBRERIA_3D, dimensioniArredo, angoliArredo } from "./arredi.js";

// Libreria degli arredi: derivata dalla libreria 3D (src/core/arredi.js). Colore in RGB per la pianta 2D.
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const LIBRERIA_ARREDI = Object.fromEntries(Object.entries(LIBRERIA_3D).map(([k, v]) => [k, {
  nome: v.nome, categoria: v.categoria, L: v.L, D: v.D, H: v.H, colore: rgb(v.finiture[0].colore),
}]));

export const MATERIALI_PAVIMENTO = {
  parquet: { nome: "Parquet rovere", colore: [200, 164, 118] },
  gres: { nome: "Gres chiaro", colore: [220, 218, 212] },
  marmo: { nome: "Marmo chiaro", colore: [240, 240, 236] },
};

// Finiture dei muri: intonaco tinteggiato o rivestimento in marmo
export const MATERIALI_MURO = {
  intonaco_bianco: { nome: "Intonaco bianco", colore: [244, 242, 236] },
  intonaco_grigio: { nome: "Intonaco grigio perla", colore: [176, 180, 186] },
  intonaco_ocra: { nome: "Intonaco ocra", colore: [217, 183, 122] },
  marmo: { nome: "Marmo chiaro", colore: [240, 240, 236] },
};

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

// Verifica completa del progetto: muri/vani con il validatore, pavimenti e arredi con i loro vincoli.
export function verificaProgetto(p) {
  const base = validatePlan(p);
  const errori = [...base.errors];
  for (const f of p.floors) {
    if (![f.x0, f.y0, f.x1, f.y1].every(intero)) errori.push(`pavimento ${f.id}: interi mm`);
  }
  for (const a of p.furniture) {
    if (!LIBRERIA_ARREDI[a.tipo]) errori.push(`arredo ${a.id}: tipo sconosciuto`);
  }
  return { ok: errori.length === 0, errors: errori, warnings: base.warnings };
}
