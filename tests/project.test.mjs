// Test del progetto modificabile: nuovo progetto vuoto, inserimenti, verifiche, eliminazioni.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  progettoVuoto, aggiungiMuro, aggiungiVano, aggiungiPavimento, aggiungiArredo,
  ruotaArredo, spostaArredo, eliminaElemento, ingombroArredo, verificaProgetto, LIBRERIA_ARREDI,
} from "../src/core/project.js";
import { buildModel } from "../src/core/build.js";

const CAT = { items: [] };

test("nuovo progetto: vuoto, nessuna scatola, nessun pavimento, nessun arredo", () => {
  const p = progettoVuoto();
  assert.equal(p.walls.length + p.openings.length + p.floors.length + p.furniture.length, 0);
  const r = buildModel(p, CAT);
  assert.equal(r.ok, true);
  assert.equal(r.boxes.length, 0);
});

test("muro: coordinate intere obbligatorie, lunghezza nulla e spessore dispari rifiutati", () => {
  const p = progettoVuoto();
  assert.ok(aggiungiMuro(p, [0.5, 0], [100, 0], 250).errore);
  assert.ok(aggiungiMuro(p, [0, 0], [0, 0], 250).errore);
  assert.ok(aggiungiMuro(p, [0, 0], [100, 0], 251).errore);
  const ok = aggiungiMuro(p, [0, 0], [4000, 0], 250);
  assert.equal(ok.p.walls.length, 1);
});

test("vano: deve stare dentro il muro, altrimenti rifiutato", () => {
  let p = aggiungiMuro(progettoVuoto(), [0, 0], [4000, 0], 250).p;
  assert.ok(aggiungiVano(p, "muro_001", 3500, 900, 2100, 0, "porta").errore);
  const ok = aggiungiVano(p, "muro_001", 1000, 900, 2100, 0, "porta");
  assert.equal(ok.p.openings.length, 1);
});

test("eliminare un muro elimina anche i suoi vani", () => {
  let p = aggiungiMuro(progettoVuoto(), [0, 0], [4000, 0], 250).p;
  p = aggiungiVano(p, "muro_001", 1000, 900, 2100, 0, "porta").p;
  p = eliminaElemento(p, "muro_001");
  assert.equal(p.walls.length, 0);
  assert.equal(p.openings.length, 0);
});

test("arredi: ingombro esatto a 0 e 90 gradi, sempre interi", () => {
  let p = aggiungiArredo(progettoVuoto(), "divano", 1000, 2000, 0).p;
  const g0 = ingombroArredo(p.furniture[0]);
  assert.equal(g0.L, LIBRERIA_ARREDI.divano.L);
  p = ruotaArredo(p, p.furniture[0].id);
  const g90 = ingombroArredo(p.furniture[0]);
  assert.equal(g90.L, LIBRERIA_ARREDI.divano.D);
  assert.ok([g90.x0, g90.y0, g90.L, g90.D].every(Number.isInteger));
});

test("libreria: tutte le dimensioni sono pari in mm (centro esatto a meta' dimensione)", () => {
  for (const [nome, d] of Object.entries(LIBRERIA_ARREDI)) {
    assert.equal(d.L % 2, 0, `${nome} L dispari`);
    assert.equal(d.D % 2, 0, `${nome} D dispari`);
  }
});

test("spostare un arredo con coordinate non intere: nessuna modifica", () => {
  const p = aggiungiArredo(progettoVuoto(), "tavolo", 0, 0, 0).p;
  const q = spostaArredo(p, p.furniture[0].id, 10.5, 3);
  assert.equal(q.furniture[0].x, 0);
});

test("pavimento: area nulla rifiutata, valido crea una scatola sottile", () => {
  assert.ok(aggiungiPavimento(progettoVuoto(), 0, 0, 0, 100).errore);
  const p = aggiungiPavimento(progettoVuoto(), 0, 0, 4000, 3000).p;
  const r = buildModel(p, CAT);
  assert.equal(r.boxes.filter((b) => b.kind === "pavimento").length, 1);
  assert.equal(r.boxes[0].H, 10);
});

test("verifica progetto: vuoto e' valido", () => {
  assert.equal(verificaProgetto(progettoVuoto()).ok, true);
});
