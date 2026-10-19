// Costruzione del modello: planimetria -> scatole 3D in millimetri (coordinate del piano).
// Nessuna dipendenza da Three.js: la stessa funzione gira nel browser e nei test Node.
import { wallLengthMm, validatePlan } from "./model.js";
import { openingLocalBoxes, TIPO_PER_CATEGORIA } from "./cdi.js";

// Scatole di muro tra i vani: pieni, sottofinestra e sopra-vano.
function wallPieces(wall, ops, L, H, nLo, nHi) {
  const out = [];
  let cursor = 0;
  let k = 0;
  const push = (kind, s0, s1, z0, z1) => {
    if (s1 > s0 && z1 > z0) out.push({ kind, id: `${wall.id}:${k++}`, s0, s1, z0, z1, n0: nLo, n1: nHi });
  };
  for (const op of ops) {
    push("muro", cursor, op.offset, 0, H);
    if (op.sill > 0) push("muro_sotto", op.offset, op.offset + op.width, 0, op.sill);
    if (op.sill + op.height < H) push("muro_sopra", op.offset, op.offset + op.width, op.sill + op.height, H);
    cursor = op.offset + op.width;
  }
  push("muro", cursor, L, 0, H);
  return out;
}

// Trasforma una scatola locale (s, n, z) in una scatola mondiale (cx, cy, cz), dimensioni e angolo.
function toWorld(local, wall, ux, uy, L) {
  const nx = -uy;
  const ny = ux;
  const sc = (local.s0 + local.s1) / 2;
  const nc = (local.n0 + local.n1) / 2;
  const ax = wall.a[0];
  const ay = wall.a[1];
  return {
    kind: local.kind,
    id: local.id,
    wall: wall.id,
    cx: ax + ux * sc + nx * nc,
    cy: ay + uy * sc + ny * nc,
    cz: (local.z0 + local.z1) / 2,
    L: local.s1 - local.s0,
    D: local.n1 - local.n0,
    H: local.z1 - local.z0,
    ang: Math.atan2(uy, ux),
    // estremi esatti lungo il muro, per i test di precisione
    s0: local.s0,
    s1: local.s1,
  };
}

// plan: modello validato. catalog: { items: [...] } con id, categoria, nome.
// assignment: opzionale { [openingId]: itemId | null } (sovrascrive op.cdi).
export function buildModel(plan, catalog, assignment = {}) {
  const report = validatePlan(plan);
  if (!report.ok) return { ok: false, report, boxes: [] };

  const H = plan.altezza_muri;
  const itemById = new Map((catalog?.items || []).map((it) => [it.id, it]));
  const boxes = [];
  const usedItems = new Map();
  const warnings = [...report.warnings];
  const wallsById = new Map(plan.walls.map((w) => [w.id, w]));

  for (const wall of plan.walls) {
    const L = wallLengthMm(wall);
    if (!Number.isInteger(L)) warnings.push(`muro ${wall.id}: obliquo, lunghezza ${L.toFixed(3)} mm non intera`);
    const ux = (wall.b[0] - wall.a[0]) / L;
    const uy = (wall.b[1] - wall.a[1]) / L;
    const nLo = -Math.floor(wall.t / 2);
    const nHi = Math.ceil(wall.t / 2);
    if (wall.t % 2 !== 0) warnings.push(`muro ${wall.id}: spessore dispari, mezzeria arrotondata`);

    const ops = plan.openings.filter((o) => o.wall === wall.id).sort((p, q) => p.offset - q.offset);
    const local = wallPieces(wall, ops, L, H, nLo, nHi);
    for (const op of ops) {
      const itemId = Object.prototype.hasOwnProperty.call(assignment, op.id) ? assignment[op.id] : op.cdi;
      const item = itemId ? itemById.get(itemId) : null;
      if (itemId && !item) warnings.push(`vano ${op.id}: infisso ${itemId} non presente nel catalogo`);
      if (item) {
        usedItems.set(op.id, item.id);
        if (TIPO_PER_CATEGORIA[item.categoria] !== op.type) warnings.push(`vano ${op.id}: infisso ${item.id} non compatibile con tipo ${op.type}`);
      }
      if (item) local.push(...openingLocalBoxes(op, wall.t, item).map((b) => ({ ...b, n0: b.n0, n1: b.n1 })));
    }
    for (const lb of local) boxes.push(toWorld(lb, wall, ux, uy, L));
  }

  const stats = {
    scatole: boxes.length,
    muri: plan.walls.length,
    vani: plan.openings.length,
    vani_con_infisso: usedItems.size,
    walls: wallsById.size,
  };
  return { ok: true, report: { ...report, warnings }, boxes, stats, usedItems: Object.fromEntries(usedItems) };
}
