// Costruzione del modello: planimetria -> scatole 3D in millimetri (coordinate del piano).
// Nessuna dipendenza da Three.js: la stessa funzione gira nel browser e nei test Node.
import { wallLengthMm, validatePlan } from "./model.js?v=v20261020bo";
import { openingLocalBoxes, TIPO_PER_CATEGORIA } from "./cdi.js?v=v20261020bo";
import { ingombroArredo, MATERIALI_PAVIMENTO, LIBRERIA_ARREDI } from "./project.js?v=v20261020bo";

// Pavimenti e arredi del progetto (vuoto di default): scatole sottili o parallelepipedi in mm.
function extrasProgetto(plan) {
  const out = [];
  for (const f of plan.floors || []) {
    const mat = MATERIALI_PAVIMENTO[f.materiale] || MATERIALI_PAVIMENTO.parquet;
    // pavimento rettangolare (x0..x1) oppure poligonale (stanza): il riquadro serve a centro e dimensioni
    const bb = f.poligono
      ? { x0: Math.min(...f.poligono.map((p) => p[0])), x1: Math.max(...f.poligono.map((p) => p[0])), y0: Math.min(...f.poligono.map((p) => p[1])), y1: Math.max(...f.poligono.map((p) => p[1])) }
      : { x0: f.x0, x1: f.x1, y0: f.y0, y1: f.y1 };
    out.push({
      kind: "pavimento", id: f.id, wall: null, materiale: f.materiale, colore: mat.colore, poligono: f.poligono ?? null,
      cx: (bb.x0 + bb.x1) / 2, cy: (bb.y0 + bb.y1) / 2, cz: 5,
      L: bb.x1 - bb.x0, D: bb.y1 - bb.y0, H: 10, ang: 0, s0: 0, s1: bb.x1 - bb.x0,
    });
  }
  for (const a of plan.furniture || []) {
    const g = ingombroArredo(a);
    out.push({
      kind: "arredo", id: a.id, wall: null, colore: g.colore,
      cx: g.x0 + g.L / 2, cy: g.y0 + g.D / 2, cz: g.H / 2,
      L: g.L, D: g.D, H: g.H, ang: 0, s0: 0, s1: g.L,
    });
  }
  return out;
}

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
    finitura: wall.finitura ?? "intonaco_bianco",
    tinta: wall.tinta ?? "naturale",
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
// arredi (opzionale): [{ id, min:[x,y,z] mm, dimensioni:[L,D,H] mm, colore:[r,g,b] }]
// Sono decorativi: non entrano nelle verifiche di muri e vani.
export function buildModel(plan, catalog, assignment = {}, arredi = []) {
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
      // i telai e le ante sono calcolati da zero del vano: si traslano all'offset reale lungo il muro
      if (item) local.push(...openingLocalBoxes(op, wall.t, item).map((b) => ({ ...b, s0: b.s0 + op.offset, s1: b.s1 + op.offset })));
    }
    for (const lb of local) boxes.push(toWorld(lb, wall, ux, uy, L));
  }

  boxes.push(...extrasProgetto(plan));

  for (const a of arredi) {
    const [L, D, H] = a.dimensioni;
    boxes.push({
      kind: "arredo",
      id: a.id,
      wall: null,
      cx: a.min[0] + L / 2,
      cy: a.min[1] + D / 2,
      cz: a.min[2] + H / 2,
      L,
      D,
      H,
      ang: 0,
      colore: a.colore,
      s0: 0,
      s1: L,
    });
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
