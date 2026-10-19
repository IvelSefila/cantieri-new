// Test della vista 2D: quote e stanze coincidono con il modello.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { planSvg, escHtml } from "../src/view2d/plan.js";
import { stanze } from "../src/core/rooms.js";
import { wallLengthMm } from "../src/core/model.js";

const here = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(join(here, "..", "data", "plan-ar02.json"), "utf-8"));
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

test("vista 2D: una quota per ogni muro, con la lunghezza esatta in mm", () => {
  const svg = planSvg(plan);
  for (const w of plan.walls) {
    const L = wallLengthMm(w);
    assert.ok(svg.includes(`>${fmt(L)}</text>`), `quota mancante per ${w.id} (${fmt(L)})`);
  }
});

test("vista 2D: una etichetta di superficie per ogni stanza", () => {
  const svg = planSvg(plan);
  const n = (svg.match(/ m²<\/text>/g) || []).length;
  assert.equal(n, stanze(plan.walls).length);
});

test("vista 2D: progetto vuoto senza errori", () => {
  const svg = planSvg({ walls: [], openings: [], floors: [], furniture: [] });
  assert.ok(svg.includes("Progetto vuoto"));
});

test("escape HTML: id con caratteri speciali non rompono la vista", () => {
  assert.equal(escHtml('<a href="x">&'), "&lt;a href=&quot;x&quot;&gt;&amp;");
});
