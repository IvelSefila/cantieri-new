// Pavimento della stanza: poligono interno, un solo pavimento per stanza, modifica dalla scheda.
import { test } from "node:test";
import assert from "node:assert/strict";
import { impostaPavimentoStanza, progettoVuoto, verificaProgetto } from "../src/core/project.js";
import { descrivi, eseguiAzione } from "../src/core/elementi.js";
import { buildModel } from "../src/core/build.js";

const quadrato = [[0, 0], [3000, 0], [3000, 2000], [0, 2000]];
const stanza = { id: "stanza_t", interno: quadrato, superficieMm2: 6e6, contorno: quadrato };

test("crea il pavimento della stanza con il materiale scelto", () => {
  const r = impostaPavimentoStanza(progettoVuoto(), quadrato, "marmo");
  assert.equal(r.p.floors.length, 1);
  assert.equal(r.p.floors[0].materiale, "marmo");
  assert.deepEqual(r.p.floors[0].poligono, quadrato);
});

test("stessa stanza: aggiorna il materiale senza duplicare", () => {
  let p = impostaPavimentoStanza(progettoVuoto(), quadrato, "marmo").p;
  p = impostaPavimentoStanza(p, quadrato, "rovere_scuro").p;
  assert.equal(p.floors.length, 1);
  assert.equal(p.floors[0].materiale, "rovere_scuro");
});

test("scheda stanza: finiture e azione finitura creano il pavimento", () => {
  const p = progettoVuoto();
  const d = descrivi(p, "stanza", stanza);
  assert.equal(d.finiture.opzioni.length >= 4, true);
  const nuovo = eseguiAzione(p, "stanza", stanza, "finitura:spina_pesce");
  assert.equal(nuovo.floors[0].materiale, "spina_pesce");
  assert.equal(descrivi(nuovo, "stanza", stanza).righe[2][1].length > 0, true);
});

test("il modello 3D riconosce il pavimento poligonale e lo centra sul riquadro", () => {
  const p = impostaPavimentoStanza(progettoVuoto(), quadrato, "parquet").p;
  const scatole = buildModel(p).boxes.filter((b) => b.kind === "pavimento");
  assert.equal(scatole.length, 1);
  assert.equal(scatole[0].cx, 1500);
  assert.equal(scatole[0].cy, 1000);
  assert.equal(scatole[0].L, 3000);
  assert.equal(scatole[0].D, 2000);
});

test("verifica: pavimento di stanza con coordinate non intere segnalato", () => {
  let p = progettoVuoto();
  p = { ...p, floors: [{ id: "pav_x", poligono: [[0, 0], [10.5, 0], [10, 10]], materiale: "parquet" }] };
  assert.equal(verificaProgetto(p).ok, false);
});
