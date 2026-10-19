// Test del motore: nessuna dipendenza esterna. Esegui: npm test (Node >= 18).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validatePlan, wallLengthMm } from "../src/core/model.js";
import { buildModel } from "../src/core/build.js";
import { measurePlan } from "../src/core/measure.js";
import { openingLocalBoxes, TIPO_PER_CATEGORIA } from "../src/core/cdi.js";

const here = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(here, "..", "data", f), "utf-8"));
const plan = load("plan-ar02.json");
const catalog = load("cdi-catalog.json");

test("planimetria AR-02: valida, tutti i valori interi in mm", () => {
  const r = validatePlan(plan);
  assert.equal(r.ok, true, r.errors.join("\n"));
  for (const w of plan.walls) {
    for (const v of [...w.a, ...w.b, w.t]) assert.ok(Number.isInteger(v), `muro ${w.id} non intero: ${v}`);
  }
});

test("AR-02: conteggi di riferimento (15 muri interni + 4 perimetrali, 9 porte, 2 vetrate)", () => {
  assert.equal(plan.walls.length, 19);
  assert.equal(plan.walls.filter((w) => w.id.startsWith("per_")).length, 4);
  assert.equal(plan.openings.filter((o) => o.type === "porta").length, 8);
  assert.equal(plan.openings.filter((o) => o.type === "scorrevole").length, 3);
});

test("precisione al millimetro: pieni + vani = lunghezza del muro, senza scarti", () => {
  const res = buildModel(plan, catalog);
  assert.equal(res.ok, true);
  for (const w of plan.walls) {
    const L = wallLengthMm(w);
    const pieces = res.boxes.filter((b) => b.wall === w.id && b.kind === "muro" && b.H === plan.altezza_muri);
    const vani = plan.openings.filter((o) => o.wall === w.id);
    const sumPieni = pieces.reduce((s, b) => s + b.L, 0);
    const sumVani = vani.reduce((s, o) => s + o.width, 0);
    assert.equal(sumPieni + sumVani, L, `muro ${w.id}: ${sumPieni} + ${sumVani} != ${L}`);
  }
});

test("nessuna scatola di muro attraversa un vano", () => {
  const res = buildModel(plan, catalog);
  for (const b of res.boxes) {
    if (!b.kind.startsWith("muro")) continue;
    for (const o of plan.openings.filter((x) => x.wall === b.wall)) {
      const overlapS = b.s0 < o.offset + o.width && b.s1 > o.offset;
      if (!overlapS) continue;
      // sotto il davanzale o sopra l'architrave e' ammesso
      const zEnd = b.cz + b.H / 2;
      const zStart = b.cz - b.H / 2;
      const sopra = zStart >= o.sill + o.height - 0.5;
      const sotto = zEnd <= o.sill + 0.5;
      assert.ok(sopra || sotto, `muro ${b.id} attraversa il vano ${o.id}`);
    }
  }
});

test("perimetro chiuso: ogni punto del perimetro e' coperto, tranne le vetrate", () => {
  const res = buildModel(plan, catalog);
  const covered = (x, y) =>
    res.boxes.some((b) => {
      if (!b.kind.startsWith("muro") || b.H !== plan.altezza_muri) return false;
      const ux = Math.cos(b.ang);
      const uy = Math.sin(b.ang);
      const dx = x - b.cx;
      const dy = y - b.cy;
      const along = dx * ux + dy * uy;
      const across = -dx * uy + dy * ux;
      return Math.abs(along) <= b.L / 2 + 1e-6 && Math.abs(across) <= b.D / 2 + 1e-6;
    });
  const per = plan.walls.filter((w) => w.id.startsWith("per_"));
  const vetrate = plan.openings.filter((o) => o.type === "scorrevole" && o.wall.startsWith("per_"));
  for (const w of per) {
    const L = wallLengthMm(w);
    for (let s = 0; s <= L; s += 50) {
      const x = w.a[0] + ((w.b[0] - w.a[0]) / L) * s;
      const y = w.a[1] + ((w.b[1] - w.a[1]) / L) * s;
      const inVetro = vetrate.some((o) => o.wall === w.id && s >= o.offset && s <= o.offset + o.width);
      if (inVetro) continue;
      assert.ok(covered(x, y), `perimetro aperto su ${w.id} a s=${s}`);
    }
  }
});

test("validazione: rifiuta valori non interi, vani fuori muro e vani sovrapposti", () => {
  const bad = structuredClone(plan);
  bad.walls[0].t = 280.5;
  assert.equal(validatePlan(bad).ok, false);

  const out = structuredClone(plan);
  out.openings[0].offset = 99999;
  assert.equal(validatePlan(out).ok, false);

  const over = structuredClone(plan);
  const first = over.openings[0];
  over.openings.push({ ...first, id: "copia", offset: first.offset + 10 });
  assert.equal(validatePlan(over).ok, false);
});

test("avviso mazzetta: vano troppo vicino all'angolo", () => {
  const p = structuredClone(plan);
  p.openings.push({ id: "stretto", wall: "a_camere", offset: 50, width: 800, height: 2100, sill: 0, type: "porta" });
  const r = validatePlan(p);
  assert.ok(r.warnings.some((w) => w.includes("mazzetta")), "atteso avviso mazzetta");
});

test("infisso procedurale: ogni scatola sta dentro il vano", () => {
  const wall = { id: "w", a: [0, 0], b: [5000, 0], t: 280 };
  const op = { id: "v", wall: "w", offset: 1000, width: 1400, height: 1250, sill: 900, type: "finestra" };
  const item = { id: "f", categoria: "finestre_pvc" };
  const boxes = openingLocalBoxes(op, wall.t, item);
  assert.ok(boxes.length >= 4);
  for (const b of boxes) {
    assert.ok(b.s0 >= 0 && b.s1 <= op.width, `${b.id} fuori in larghezza`);
    assert.ok(b.z0 >= op.sill && b.z1 <= op.sill + op.height, `${b.id} fuori in altezza`);
    assert.ok(Number.isInteger(b.s0) && Number.isInteger(b.s1) && Number.isInteger(b.z0) && Number.isInteger(b.z1));
  }
});

test("catalogo: 19 modelli, tutti con categoria riconosciuta", () => {
  assert.equal(catalog.items.length, 19);
  for (const it of catalog.items) assert.ok(TIPO_PER_CATEGORIA[it.categoria], `categoria sconosciuta: ${it.categoria}`);
});

test("misure: superfici in mm^2 esatte e coerenti con la somma per muro", () => {
  const m = measurePlan(plan);
  const sum = m.per_muro.reduce((s, x) => s + x.superficie_netta_m2, 0);
  assert.ok(Math.abs(sum - m.superficie_muri_netta_m2) < 1e-6, "somma per muro diversa dal totale");
  assert.equal(m.lunghezza_muri_obliqui_mm, 0);
  assert.ok(Number.isInteger(m.lunghezza_muri_mm));
});

test("arredi: 56 elementi decorativi in mm interi, dentro l'edificio, senza alterare i muri", () => {
  const arredi = load("arredi-ar02.json").arredi;
  const senza = buildModel(plan, catalog, {}, []);
  const con = buildModel(plan, catalog, {}, arredi);
  assert.equal(arredi.length, 56);
  assert.equal(con.boxes.filter((b) => b.kind === "arredo").length, 56);
  assert.equal(con.boxes.filter((b) => b.kind.startsWith("muro")).length, senza.boxes.filter((b) => b.kind.startsWith("muro")).length);
  for (const a of arredi) {
    assert.ok([...a.min, ...a.dimensioni].every(Number.isInteger), `${a.id} non intero`);
    assert.ok(a.min[0] >= 0 && a.min[0] + a.dimensioni[0] <= 22000, `${a.id} fuori in x`);
    assert.ok(a.min[1] >= 0 && a.min[1] + a.dimensioni[1] <= 14000, `${a.id} fuori in y`);
  }
});
