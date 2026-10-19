// Test degli elementi: portanti, punto dentro stanza, descrizione e azioni.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classificaMuro, dentroPoligono, descrivi, eseguiAzione, stanzaAPunto } from "../src/core/elementi.js";
import { progettoVuoto, aggiungiMuro, aggiungiVano } from "../src/core/project.js";

test("muri: spina e perimetrale portanti, tramezzo non portante", () => {
  assert.equal(classificaMuro({ kind: "spina", t: 250 }).portante, true);
  assert.equal(classificaMuro({ kind: "perimetrale", t: 280 }).portante, true);
  assert.equal(classificaMuro({ kind: "tramezzo", t: 150 }).portante, false);
});

test("punto dentro poligono", () => {
  const q = [[0, 0], [4000, 0], [4000, 3000], [0, 3000]];
  assert.equal(dentroPoligono([2000, 1500], q), true);
  assert.equal(dentroPoligono([5000, 1500], q), false);
});

test("descrizione muro: muro portante non abbattibile (azione disabilitata)", () => {
  let p = aggiungiMuro(progettoVuoto(), [0, 0], [4000, 0], 250, "spina").p;
  const d = descrivi(p, "muro", "muro_001");
  assert.equal(d.portante, true);
  assert.equal(d.azioni[0].disabile, true);
  assert.equal(eseguiAzione(p, "muro", "muro_001", "abbatti"), null);
});

test("abbattimento muro: rimuove anche i suoi vani", () => {
  let p = aggiungiMuro(progettoVuoto(), [0, 0], [4000, 0], 150, "tramezzo").p;
  p = aggiungiVano(p, "muro_001", 1000, 900, 2100, 0, "porta").p;
  const q = eseguiAzione(p, "muro", "muro_001", "abbatti");
  assert.equal(q.walls.length, 0);
  assert.equal(q.openings.length, 0);
});

test("stanza al punto: trova la stanza che contiene il punto", () => {
  let p = progettoVuoto();
  for (const [a, b] of [[[0, 0], [4000, 0]], [[4000, 0], [4000, 3000]], [[4000, 3000], [0, 3000]], [[0, 3000], [0, 0]]]) {
    p = aggiungiMuro(p, a, b, 200, "perimetrale").p;
  }
  const s = stanzaAPunto([2000, 1500], p);
  assert.ok(s);
  assert.equal(s.superficieMm2, 10640000);
  assert.equal(stanzaAPunto([9000, 9000], p), null);
});
