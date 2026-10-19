// Regola permanente dei materiali dei vani: porta = legno, finestra/vetrata = vetro, vetro solo se dichiarato.
import { test } from "node:test";
import assert from "node:assert/strict";
import { materialeVano, openingLocalBoxes } from "../src/core/cdi.js";

const wall = { t: 250 };
const base = { id: "v", offset: 0, width: 900, height: 2100, sill: 0 };

test("regola: una porta senza materiale dichiarato e' in legno", () => {
  assert.equal(materialeVano({ ...base, type: "porta" }), "legno");
});

test("regola: una finestra o una vetrata senza materiale dichiarato e' in vetro", () => {
  assert.equal(materialeVano({ ...base, type: "finestra" }), "vetro");
  assert.equal(materialeVano({ ...base, type: "scorrevole" }), "vetro");
});

test("regola: il materiale dichiarato prevale sul default", () => {
  assert.equal(materialeVano({ ...base, type: "porta", materiale: "vetro" }), "vetro");
});

test("porta in legno: nessuna parte in vetro, maniglia verticale alta 900 mm, telaio sottile 40 mm", () => {
  const boxes = openingLocalBoxes({ ...base, type: "porta", id: "p" }, wall.t, { categoria: "porte_interne" });
  assert.ok(!boxes.some((b) => b.kind === "vetro"), "nessun vetro su una porta in legno");
  const m = boxes.find((b) => b.kind === "maniglia");
  assert.equal(m.z1 - m.z0, 900);
  assert.ok(m.s1 - m.s0 < m.z1 - m.z0, "maniglia verticale");
  const telaio = boxes.filter((b) => b.kind === "telaio_legno");
  assert.ok(telaio.every((b) => (b.s1 - b.s0 === 40) || (b.z1 - b.z0 === 40) || b.s1 - b.s0 === 900), "telaio sottile");
});

test("il vetro compare solo su finestre e vetrate", () => {
  const boxes = openingLocalBoxes({ ...base, type: "finestra", id: "f", sill: 900, height: 1250 }, wall.t, { categoria: "finestre_pvc" });
  assert.ok(boxes.some((b) => b.kind === "vetro"));
});

test("vetro fume' dichiarato: scrigno in vetro scuro, profilo sottile, binario, nessun vetro chiaro", () => {
  const boxes = openingLocalBoxes({ ...base, type: "porta", materiale: "vetro_fume", id: "s", width: 1200 }, wall.t, null);
  assert.ok(boxes.some((b) => b.kind === "vetro_fume"));
  assert.ok(!boxes.some((b) => b.kind === "vetro"), "non deve essere vetro chiaro");
  assert.ok(boxes.some((b) => b.kind === "binario"), "binario superiore");
  assert.ok(!boxes.some((b) => b.kind === "telaio"), "non deve avere il telaio delle finestre");
});

test("materiale non ammesso: rifiutato dal validatore", async () => {
  const { validatePlan } = await import("../src/core/model.js");
  const p = { schema: 1, unit: "mm", altezza_muri: 2800, walls: [{ id: "w", a: [0, 0], b: [4000, 0], t: 250 }],
    openings: [{ id: "o", wall: "w", offset: 500, width: 900, height: 2100, sill: 0, type: "porta", materiale: "marmo" }] };
  assert.equal(validatePlan(p).ok, false);
});
