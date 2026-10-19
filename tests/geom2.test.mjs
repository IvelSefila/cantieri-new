// Test di snap e stanze: logica pura.
import { test } from "node:test";
import assert from "node:assert/strict";
import { agganciaPunto, lunghezzaSegmento } from "../src/core/snap.js";
import { stanze, connettiMuri, spezzaMuri } from "../src/core/rooms.js";

test("snap: vertice esistente entro tolleranza ha la precedenza", () => {
  const r = agganciaPunto([1003, 2998], { griglia: 100, tolleranza: 50, punti: [[1000, 3000]] });
  assert.deepEqual(r.punto, [1000, 3000]);
  assert.equal(r.aggancio, "vertice");
});

test("snap: direzione a 45 gradi dal punto di partenza con lunghezza intera", () => {
  const r = agganciaPunto([3010, 3005], { partenza: [1000, 1000], griglia: 0 });
  assert.equal(r.aggancio, "angolo");
  assert.equal(r.punto[0] - 1000, r.punto[1] - 1000);
  assert.ok(r.punto.every(Number.isInteger));
});

test("snap: griglia quando nessun vertice o angolo e' vicino", () => {
  const r = agganciaPunto([1234, 5678], { griglia: 100 });
  assert.deepEqual(r.punto, [1200, 5700]);
  assert.equal(r.aggancio, "griglia");
});

test("lunghezza: esatta per segmenti assiali, arrotondata e segnalata per gli obliqui", () => {
  assert.deepEqual(lunghezzaSegmento([0, 0], [4000, 0]), { mm: 4000, esatta: true });
  const o = lunghezzaSegmento([0, 0], [3000, 4000]);
  assert.equal(o.mm, 5000);
  assert.equal(o.esatta, false);
});

test("stanze: rettangolo 4x3 m con muri di 200 mm: superficie interna 10,64 m2", () => {
  const muri = [
    { id: "n", a: [0, 0], b: [4000, 0], t: 200 },
    { id: "e", a: [4000, 0], b: [4000, 3000], t: 200 },
    { id: "s", a: [4000, 3000], b: [0, 3000], t: 200 },
    { id: "w", a: [0, 3000], b: [0, 0], t: 200 },
  ];
  const r = stanze(muri);
  assert.equal(r.length, 1);
  assert.equal(r[0].superficieMm2, 10640000);
});

test("stanze: divisorio centrale crea due stanze con superficie interna corretta", () => {
  const muri = [
    { id: "n", a: [0, 0], b: [4000, 0], t: 200 },
    { id: "e", a: [4000, 0], b: [4000, 3000], t: 200 },
    { id: "s", a: [4000, 3000], b: [0, 3000], t: 200 },
    { id: "w", a: [0, 3000], b: [0, 0], t: 200 },
    { id: "d", a: [2000, 0], b: [2000, 3000], t: 200 },
  ];
  const r = stanze(muri).map((s) => s.superficieMm2).sort((a, b) => a - b);
  assert.deepEqual(r, [5040000, 5040000]);
});

test("giunzione: un muro che finisce sul filo interno si porta sull'asse del perimetro", () => {
  const muri = [
    { id: "per", a: [0, 140], b: [4000, 140], t: 280 },
    { id: "div", a: [2000, 280], b: [2000, 3000], t: 150 },
  ];
  const c = connettiMuri(muri);
  assert.deepEqual(c[1].a, [2000, 140]);
});

test("spezzatura: un muro con un estremo sul suo interno viene diviso", () => {
  const muri = [
    { id: "lungo", a: [0, 0], b: [4000, 0], t: 200 },
    { id: "t", a: [2000, 0], b: [2000, 3000], t: 200 },
  ];
  const tratti = spezzaMuri(muri);
  assert.equal(tratti.filter((w) => w.id.startsWith("lungo")).length, 2);
});
