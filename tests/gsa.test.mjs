// Test del calcolo GSA (superficie solare equivalente).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { calcolaGSA } from "../src/core/gsa.js";

const here = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(join(here, "..", "data", "plan-ar02.json"), "utf-8"));

test("GSA AR-02: area vetrata e Asol con i default dichiarati", () => {
  const r = calcolaGSA(plan);
  // terrazzo A 2,40 x 2,40 + terrazzo B 2,80 x 2,40 + scrigno vetro fume' 1,20 x 2,10
  assert.ok(Math.abs(r.areaVetroTotale_m2 - (5.76 + 6.72 + 2.52)) < 1e-9);
  const atteso = 5.76 * 0.6 * 0.8 + 6.72 * 0.6 * 0.8 + 2.52 * 0.35 * 0.8;
  assert.ok(Math.abs(r.asolTotale_m2 - atteso) < 1e-9);
});

test("GSA: senza orientamenti dichiarati, li elenca come dati mancanti", () => {
  const r = calcolaGSA(plan);
  assert.ok(r.mancanti.some((m) => m.includes("orientamento")));
  assert.ok(r.datiMancanti.length >= 5);
});

test("GSA: con orientamenti, i totali si raggruppano per orientamento", () => {
  const r = calcolaGSA(plan, { orientamenti: { per_ovest: "O", per_est: "E" } });
  assert.ok(r.perOrientamento.O > 0);
  assert.ok(r.perOrientamento.E > 0);
  assert.equal(r.mancanti.filter((m) => m.includes("orientamento")).length, 1); // solo lo scrigno
});

test("GSA: un vano in legno non entra nel calcolo", () => {
  const p = structuredClone(plan);
  p.openings = p.openings.filter((o) => o.id === "blindata_a");
  assert.equal(calcolaGSA(p).righe.length, 0);
});
