// Test del tracciamento su immagine: logica pura, nessun browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeCalibration, pxToMm, proiettaSuMuro, muroPiuVicino } from "../src/trace/geometry.js";
import { nuovoStato, calibra, clicMuro, clicVano, annulla, toPlan, mmToPx } from "../src/trace/tracer.js";
import { validatePlan } from "../src/core/model.js";

// origine (100,100) px = (0,0) mm; (300,100) px = 4000 mm  ->  20 mm per px
const cal = () => makeCalibration([100, 100], [300, 100], 4000);

test("calibrazione: scala da distanza nota, origine nel punto cliccato", () => {
  const c = cal();
  assert.equal(c.mmPerPx, 20);
  assert.deepEqual(pxToMm([100, 100], c), [0, 0]);
  assert.deepEqual(pxToMm([300, 100], c), [4000, 0]);
});

test("calibrazione non valida: distanza zero o punti coincidenti", () => {
  assert.throws(() => makeCalibration([0, 0], [10, 0], 0));
  assert.throws(() => makeCalibration([5, 5], [5, 5], 1000));
});

test("snap alla griglia di 10 mm: valori interi e multipli del passo", () => {
  const c = cal();
  const p = pxToMm([201.3, 152.7], c, 10);
  assert.ok(p.every(Number.isInteger));
  assert.equal(p[0] % 10, 0);
  assert.equal(p[1] % 10, 0);
});

test("andata e ritorno px -> mm -> px senza perdita sulla griglia", () => {
  const c = cal();
  const px = [250, 180];
  const mm = pxToMm(px, c, 0);
  const back = mmToPx(mm, c);
  assert.ok(Math.abs(back[0] - px[0]) < 0.01 && Math.abs(back[1] - px[1]) < 0.01);
});

test("proiezione su muro: offset e distanza perpendicolare in mm interi", () => {
  const r = proiettaSuMuro([1500, 120], [0, 0], [5000, 0]);
  assert.equal(r.offset, 1500);
  assert.equal(r.distanza, 120);
});

test("muro piu' vicino: scarta i punti troppo lontani", () => {
  const muri = [{ id: "m1", a: [0, 0], b: [5000, 0], t: 250 }];
  assert.equal(muroPiuVicino([2000, 100], muri, 300).id, "m1");
  assert.equal(muroPiuVicino([2000, 900], muri, 300), null);
});

test("flusso muri: due clic creano un muro; annulla lo riporta indietro", () => {
  let s = calibra(nuovoStato({ spessore: 250 }), [100, 100], [300, 100], 4000);
  s = clicMuro(s, [100, 100]);
  s = clicMuro(s, [300, 100]);
  assert.equal(s.muri.length, 1);
  assert.deepEqual(s.muri[0].a, [0, 0]);
  assert.deepEqual(s.muri[0].b, [4000, 0]);
  s = annulla(s);
  assert.equal(s.muri.length, 0);
});

test("vano da due clic sullo stesso muro: offset e larghezza esatti", () => {
  let s = calibra(nuovoStato({ spessore: 250 }), [100, 100], [300, 100], 4000);
  s = clicMuro(s, [100, 100]);
  s = clicMuro(s, [300, 100]); // muro 0..4000 mm lungo x
  s = clicVano(s, [100 + 1000 / 20, 100 + 3], "porta", 2100, 0); // 1000 mm
  s = clicVano(s, [100 + 1900 / 20, 100 - 2], "porta", 2100, 0); // 1900 mm
  assert.equal(s.vani.length, 1);
  assert.equal(s.vani[0].offset, 1000);
  assert.equal(s.vani[0].width, 900);
});

test("vano con due clic su muri diversi: rifiutato con errore", () => {
  let s = calibra(nuovoStato({ spessore: 250 }), [100, 100], [300, 100], 4000);
  s = clicMuro(s, [100, 100]);
  s = clicMuro(s, [300, 100]);
  s = clicMuro(s, [100, 300]);
  s = clicMuro(s, [300, 300]); // secondo muro, lontano dal primo
  s = clicVano(s, [200, 102], "porta", 2100, 0);
  s = clicVano(s, [200, 280], "porta", 2100, 0);
  assert.equal(s.vani.length, 0);
  assert.ok(s.errore);
});

test("toPlan: il risultato del tracciamento passa la validazione del motore", () => {
  let s = calibra(nuovoStato({ spessore: 250 }), [100, 100], [300, 100], 4000);
  s = clicMuro(s, [100, 100]);
  s = clicMuro(s, [300, 100]);
  s = clicVano(s, [110, 102], "porta", 2100, 0);
  s = clicVano(s, [150, 102], "porta", 2100, 0);
  const plan = toPlan(s, "test");
  const r = validatePlan(plan);
  assert.equal(r.ok, true, r.errors.join("; "));
  assert.ok(plan.walls.every((w) => Number.isInteger(w.a[0]) && Number.isInteger(w.b[0])));
});
