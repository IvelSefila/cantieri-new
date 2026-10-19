// Progetto modificabile: muri, vani, pavimenti, arredi. Tutto in mm interi. Funzioni pure.
// Un progetto nuovo e' VUOTO: nessun muro, nessun pavimento, nessun arredo.
import { validatePlan, wallLengthMm, SCHEMA } from "./model.js";

export const LIBRERIA_ARREDI = {
  divano: { nome: "Divano 2,40 m", L: 2400, D: 950, H: 800, colore: [70, 95, 130] },
  letto_matrimoniale: { nome: "Letto matrimoniale 1,80 × 2,00", L: 1800, D: 2000, H: 500, colore: [235, 230, 222] },
  letto_singolo: { nome: "Letto singolo 0,90 × 2,00", L: 900, D: 2000, H: 500, colore: [225, 220, 210] },
  tavolo: { nome: "Tavolo 1,60 × 0,90", L: 1600, D: 900, H: 750, colore: [180, 135, 90] },
  sedia: { nome: "Sedia", L: 450, D: 450, H: 900, colore: [60, 65, 72] },
  cucina: { nome: "Blocco cucina 2,40 m", L: 2400, D: 600, H: 900, colore: [42, 45, 50] },
  isola: { nome: "Isola cucina 2,00 × 0,90", L: 2000, D: 900, H: 900, colore: [245, 245, 242] },
  wc: { nome: "WC", L: 380, D: 700, H: 800, colore: [250, 250, 252] },
  lavabo: { nome: "Lavabo doppio 1,20", L: 1200, D: 520, H: 850, colore: [240, 240, 240] },
  vasca: { nome: "Vasca 1,70 × 0,75", L: 1700, D: 750, H: 550, colore: [250, 250, 252] },
  armadio: { nome: "Armadio 2,00 × 0,60", L: 2000, D: 600, H: 2200, colore: [240, 238, 235] },
  scrivania: { nome: "Scrivania 1,40 × 0,70", L: 1400, D: 700, H: 750, colore: [130, 150, 175] },
};

export const MATERIALI_PAVIMENTO = {
  parquet: { nome: "Parquet rovere", colore: [200, 164, 118] },
  gres: { nome: "Gres chiaro", colore: [220, 218, 212] },
  marmo: { nome: "Marmo chiaro", colore: [240, 240, 236] },
};

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

export function aggiungiArredo(p, tipo, x, y, rot = 0) {
  const def = LIBRERIA_ARREDI[tipo];
  if (!def) return { errore: "tipo di arredo sconosciuto" };
  if (![x, y].every(intero)) return { errore: "posizione arredo: interi mm" };
  if (![0, 90, 180, 270].includes(rot)) return { errore: "rotazione: 0, 90, 180 o 270" };
  const id = nuovoId("arredo", p.furniture);
  return { p: { ...p, furniture: [...p.furniture, { id, tipo, x, y, rot }] }, id };
}

// Dimensioni di un arredo dopo la rotazione (solo multipli di 90 gradi: nessun arrotondamento).
export function ingombroArredo(a) {
  const def = LIBRERIA_ARREDI[a.tipo];
  const ruotato = a.rot === 90 || a.rot === 270;
  const L = ruotato ? def.D : def.L;
  const D = ruotato ? def.L : def.D;
  return { x0: a.x - L / 2, y0: a.y - D / 2, L, D, H: def.H, colore: def.colore };
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
