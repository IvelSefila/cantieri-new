// Test del calcolo GSA (superficie solare equivalente).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { calcolaGSA } from "../src/core/gsa.js";

const here = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(join(here, "..", "data", "plan-ar02.json"), "utf-8"));

test("GSA AR-02: solo i terrazzi, lo scrigno interno e' escluso", () => {
  const r = calcolaGSA(plan);
  // terrazzo A 2,40 x 2,40 (O) + terrazzo B 2,80 x 2,40 (E). Lo scrigno cucina e' su tramezzo interno.
  assert.ok(Math.abs(r.areaVetroTotale_m2 - (5.76 + 6.72)) < 1e-9);
  const atteso = 5.76 * 0.6 * 0.8 + 6.72 * 0.6 * 0.8;
  assert.ok(Math.abs(r.asolTotale_m2 - atteso) < 1e-9);
  assert.ok(!r.righe.some((x) => x.vano === "scrigno_cucina_b"));
});

test("GSA: orientamento ricavato dalla geometria del perimetro (Y cresce a sud)", () => {
  const r = calcolaGSA(plan);
  assert.equal(r.perOrientamento.O > 0, true);
  assert.equal(r.perOrientamento.E > 0, true);
  assert.equal(r.mancanti.length, 0);
});

test("GSA: un orientamento dichiarato prevale sulla geometria", () => {
  const r = calcolaGSA(plan, { orientamenti: { per_ovest: "SO" } });
  assert.equal(r.righe.find((x) => x.vano === "terrazzo_a").orientamento, "SO");
});

test("GSA: un vano in legno non entra nel calcolo", () => {
  const p = structuredClone(plan);
  p.openings = p.openings.filter((o) => o.id === "blindata_a");
  assert.equal(calcolaGSA(p).righe.length, 0);
});
