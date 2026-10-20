// Stato del tracciamento: funzioni pure che restituiscono un nuovo stato (nessun DOM).
import { makeCalibration, pxToMm, muroPiuVicino, vanoDaClic } from "./geometry.js?v=v20261020bq";

export function nuovoStato(opzioni = {}) {
  return {
    cal: null,            // { origine, mmPerPx }
    muri: [],             // { id, a:[mm], b:[mm], t }
    vani: [],             // { id, wall, offset, width, height, sill, type }
    pending: null,        // punto mm in attesa (muro o vano)
    pendingVano: null,    // primo clic di un vano (mm)
    spessore: opzioni.spessore ?? 250,
    altezza: opzioni.altezza ?? 2800,
    snapMm: opzioni.snapMm ?? 10,
    storia: [],
  };
}

function conStoria(stato, nuovo) {
  const storia = [...stato.storia, { muri: stato.muri, vani: stato.vani }].slice(-50);
  return { ...nuovo, storia };
}

export function calibra(stato, origine, secondo, distanzaMm) {
  return { ...stato, cal: makeCalibration(origine, secondo, distanzaMm), pending: null, pendingVano: null };
}

// Clic su un muro: primo clic = inizio, secondo = fine (il muro diventa il segmento successivo).
export function clicMuro(stato, px) {
  if (!stato.cal) throw new Error("calibrare prima");
  const p = pxToMm(px, stato.cal, stato.snapMm);
  if (!stato.pending) return { ...stato, pending: p };
  if (p[0] === stato.pending[0] && p[1] === stato.pending[1]) return stato;
  const id = `muro_${String(stato.muri.length + 1).padStart(3, "0")}`;
  const muro = { id, a: stato.pending, b: p, t: stato.spessore };
  return conStoria(stato, { ...stato, muri: [...stato.muri, muro], pending: p });
}

// Clic su un vano: primo clic e secondo clic devono cadere sullo stesso muro.
export function clicVano(stato, px, tipo = "porta", altezza = 2100, sill = 0) {
  if (!stato.cal) throw new Error("calibrare prima");
  const p = pxToMm(px, stato.cal, stato.snapMm);
  if (!stato.pendingVano) return { ...stato, pendingVano: p };
  const tol = stato.spessore * 2 + 100;
  const m1 = muroPiuVicino(stato.pendingVano, stato.muri, tol);
  const m2 = muroPiuVicino(p, stato.muri, tol);
  if (!m1 || !m2 || m1.id !== m2.id) {
    return { ...stato, pendingVano: null, errore: "i due clic devono stare sullo stesso muro" };
  }
  const wall = stato.muri.find((w) => w.id === m1.id);
  const { offset, width } = vanoDaClic(stato.pendingVano, p, wall);
  if (width <= 0) return { ...stato, pendingVano: null, errore: "larghezza del vano nulla" };
  const id = `vano_${String(stato.vani.length + 1).padStart(3, "0")}`;
  const vano = { id, wall: wall.id, offset, width, height: altezza, sill, type: tipo };
  return conStoria(stato, { ...stato, vani: [...stato.vani, vano], pendingVano: null, errore: null });
}

// Annulla: ripristina l'ultimo elemento creato; se non ce n'e', annulla solo il punto in sospeso.
export function annulla(stato) {
  if (!stato.storia.length) return { ...stato, pending: null, pendingVano: null };
  const prev = stato.storia[stato.storia.length - 1];
  return { ...stato, muri: prev.muri, vani: prev.vani, storia: stato.storia.slice(0, -1), pending: null, pendingVano: null, errore: null };
}

// Esc: annulla solo il punto in sospeso, senza toccare gli elementi gia' creati.
export function annullaPunto(stato) {
  return { ...stato, pending: null, pendingVano: null };
}

// Pianta nel formato del motore (schema 1, mm interi). Chiamare validatePlan prima dell'uso.
export function toPlan(stato, nome = "Planimetria tracciata") {
  return {
    schema: 1,
    unit: "mm",
    altezza_muri: stato.altezza,
    name: nome,
    fonte: "tracciamento su immagine (calibrato)",
    walls: stato.muri.map((w) => ({ id: w.id, a: w.a, b: w.b, t: w.t })),
    openings: stato.vani.map((v) => ({ id: v.id, wall: v.wall, offset: v.offset, width: v.width, height: v.height, sill: v.sill, type: v.type })),
  };
}

// mm -> px per disegnare l'overlay.
export function mmToPx(pt, cal) {
  return [cal.origine[0] + pt[0] / cal.mmPerPx, cal.origine[1] + pt[1] / cal.mmPerPx];
}
