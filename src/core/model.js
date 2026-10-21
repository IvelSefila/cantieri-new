// Modello planimetria: formato v1, unita' INTERE in millimetri.
// Nessun arrotondamento nascosto: un valore non intero viene rifiutato.
//
// plan = {
//   schema: 1, unit: "mm", name, altezza_muri,
//   walls:    [{ id, a:[x,y], b:[x,y], t, kind }]          // asse muro, spessore t
//   openings: [{ id, wall, offset, width, height, sill, type, cdi? }]
//             offset = distanza dal punto a del muro (lungo l'asse), larghezza, altezza, davanzale
// }

export const SCHEMA = 1;
export const MAZZETTA_MIN_MM = 150; // avviso se un vano lascia meno di 15 cm di muro pieno

const isInt = (v) => Number.isSafeInteger(v);
const isPair = (p) => Array.isArray(p) && p.length === 2 && p.every(isInt);
const idValido = v => typeof v === 'string' && v.trim().length > 0 && !['__proto__','constructor','prototype'].includes(v);

export function validatePlan(plan) {
  const errors = [];
  const warnings = [];
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return { ok: false, errors: ["plan non valido"], warnings };
  if (plan.schema !== SCHEMA) errors.push(`schema richiesto ${SCHEMA}`);
  if (plan.unit !== "mm") errors.push('unit deve essere "mm"');
  if (!isInt(plan.altezza_muri) || plan.altezza_muri <= 0) errors.push("altezza_muri: intero mm > 0");

  const walls = Array.isArray(plan.walls) ? plan.walls : [];
  const openings = Array.isArray(plan.openings) ? plan.openings : [];
  if (!Array.isArray(plan.walls)) errors.push("walls deve essere un array");
  if (!Array.isArray(plan.openings)) errors.push("openings deve essere un array");
  const wallById = new Map();

  for (const w of walls) {
    if (!w || typeof w !== "object") { errors.push("muro non valido"); continue; }
    if (!idValido(w.id)) { errors.push("muro senza id valido"); continue; }
    if (wallById.has(w.id)) errors.push(`muro duplicato: ${w.id}`);
    if (!isPair(w.a) || !isPair(w.b)) { errors.push(`muro ${w.id}: a/b devono essere coppie di interi mm`); continue; }
    if (!isInt(w.t) || w.t <= 0) errors.push(`muro ${w.id}: spessore t intero > 0`);
    if (w.a[0] === w.b[0] && w.a[1] === w.b[1]) errors.push(`muro ${w.id}: lunghezza zero`);
    wallById.set(w.id, w);
  }

  const perWall = new Map();
  const openingIds = new Set();
  for (const o of openings) {
    if (!o || typeof o !== "object") { errors.push("vano non valido"); continue; }
    if (!idValido(o.id)) { errors.push("vano senza id valido"); continue; }
    if(wallById.has(o.id))errors.push(`id duplicato fra muro e vano: ${o.id}`);
    if (openingIds.has(o.id)) errors.push(`vano duplicato: ${o.id}`);
    openingIds.add(o.id);
    const w = wallById.get(o.wall);
    if (!w) { errors.push(`vano ${o.id}: muro ${o.wall} inesistente`); continue; }
    for (const k of ["offset", "width", "height", "sill"]) {
      if (!isInt(o[k])) errors.push(`vano ${o.id}: ${k} deve essere intero mm`);
    }
    if (errors.some((e) => e.startsWith(`vano ${o.id}`))) continue;
    const L = wallLengthMm(w);
    if (o.width <= 0 || o.height <= 0) errors.push(`vano ${o.id}: larghezza e altezza > 0`);
    if (!["porta", "finestra", "scorrevole"].includes(o.type)) errors.push(`vano ${o.id}: tipo non ammesso`);
    if(o.cdi!=null && typeof o.cdi!=='string')errors.push(`vano ${o.id}: codice infisso non valido`);
    if (o.materiale !== undefined && !["legno", "vetro", "vetro_fume"].includes(o.materiale)) errors.push(`vano ${o.id}: materiale non ammesso (${o.materiale})`);
    if (o.sill < 0) errors.push(`vano ${o.id}: davanzale negativo`);
    if (o.offset < 0 || o.offset + o.width > L) errors.push(`vano ${o.id}: fuori dal muro ${w.id} (lunghezza ${L} mm)`);
    if (o.sill + o.height > plan.altezza_muri) errors.push(`vano ${o.id}: supera l'altezza dei muri`);
    if (!perWall.has(o.wall)) perWall.set(o.wall, []);
    perWall.get(o.wall).push(o);
  }

  for (const [wid, list] of perWall) {
    list.sort((p, q) => p.offset - q.offset);
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      const next = list[i + 1];
      if (next && cur.offset + cur.width > next.offset) errors.push(`vani sovrapposti sul muro ${wid}: ${cur.id} e ${next.id}`);
      if (next && next.offset - (cur.offset + cur.width) < MAZZETTA_MIN_MM) warnings.push(`muro ${wid}: mazzetta tra ${cur.id} e ${next.id} < ${MAZZETTA_MIN_MM} mm`);
    }
    const L = wallLengthMm(wallById.get(wid));
    const first = list[0];
    const last = list[list.length - 1];
    if (first.offset < MAZZETTA_MIN_MM && first.offset > 0) warnings.push(`muro ${wid}: mazzetta iniziale < ${MAZZETTA_MIN_MM} mm (${first.id})`);
    if (L - (last.offset + last.width) < MAZZETTA_MIN_MM && L - (last.offset + last.width) > 0) warnings.push(`muro ${wid}: mazzetta finale < ${MAZZETTA_MIN_MM} mm (${last.id})`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

// Lunghezza esatta in mm. Muri orizzontali/verticali: intero esatto.
// Muri obliqui: sqrt, quindi NON intero: il chiamante lo segnala.
export function wallLengthMm(w) {
  const dx = w.b[0] - w.a[0];
  const dy = w.b[1] - w.a[1];
  if (dx === 0) return Math.abs(dy);
  if (dy === 0) return Math.abs(dx);
  return Math.sqrt(dx * dx + dy * dy);
}

export function isAxisAligned(w) {
  return w.a[0] === w.b[0] || w.a[1] === w.b[1];
}
