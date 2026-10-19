// Finiture di pavimenti e muri, e regole di abbattimento dei muri portanti.
import { test } from "node:test";
import assert from "node:assert/strict";
import { impostaFinituraMuro, impostaMaterialePavimento, impostaTintaMuro, MATERIALI_MURO, MATERIALI_PAVIMENTO, TINTE_MURO, aggiungiPavimento, progettoVuoto } from "../src/core/project.js";
import { descrivi, eseguiAzione } from "../src/core/elementi.js";

function progettoConMuri() {
  let p = progettoVuoto("prova");
  p = { ...p, walls: [
    { id: "tr_1", a: [0, 0], b: [4000, 0], t: 100, kind: "tramezzo" },
    { id: "sp_1", a: [0, 0], b: [0, 4000], t: 300, kind: "spina" },
  ] };
  return p;
}

test("pavimento: si cambia il materiale tra parquet e marmo, materiale ignoto rifiutato", () => {
  let p = progettoVuoto("prova");
  p = aggiungiPavimento(p, 0, 0, 3000, 3000, "parquet").p;
  const id = p.floors[0].id;
  const r = impostaMaterialePavimento(p, id, "marmo");
  assert.equal(r.p.floors[0].materiale, "marmo");
  assert.ok(impostaMaterialePavimento(p, id, "legno_finto").errore);
  assert.equal(descrivi(r.p, "pavimento", id).righe[0][1], MATERIALI_PAVIMENTO.marmo.nome);
  assert.equal(descrivi(r.p, "pavimento", id).finiture.opzioni.length, Object.keys(MATERIALI_PAVIMENTO).length);
});

test("muro: finitura intonaco o marmo, default intonaco bianco", () => {
  const p = progettoConMuri();
  assert.equal(descrivi(p, "muro", "tr_1").finiture.attiva, "intonaco_bianco");
  const r = impostaFinituraMuro(p, "tr_1", "marmo");
  assert.equal(r.p.walls.find((w) => w.id === "tr_1").finitura, "marmo");
  assert.equal(r.p.walls.find((w) => w.id === "sp_1").finitura, undefined);
  assert.ok(impostaFinituraMuro(p, "tr_1", "vernice_fosforescente").errore);
});

test("muro tramezzo: si puo' abbattere, azione applicata", () => {
  const p = progettoConMuri();
  const nuovo = eseguiAzione(p, "muro", "tr_1", "abbatti");
  assert.ok(nuovo);
  assert.equal(nuovo.walls.some((w) => w.id === "tr_1"), false);
});

test("muro portante: non abbattibile, azione disabilitata e rifiutata", () => {
  const p = progettoConMuri();
  const scheda = descrivi(p, "muro", "sp_1");
  assert.equal(scheda.portante, true);
  const az = scheda.azioni.find((a) => a.id === "abbatti");
  assert.equal(az.disabile, true);
  assert.equal(eseguiAzione(p, "muro", "sp_1", "abbatti"), null);
  assert.equal(eseguiAzione(p, "muro", "sp_1", "abbatti")?.walls, undefined);
});

test("finitura applicata dalla scheda: 'finitura:<id>' cambia il materiale", () => {
  const p = progettoConMuri();
  const nuovo = eseguiAzione(p, "muro", "tr_1", "finitura:intonaco_ocra");
  assert.equal(nuovo.walls.find((w) => w.id === "tr_1").finitura, "intonaco_ocra");
  assert.ok(MATERIALI_MURO.intonaco_ocra);
});

test("tinta del muro: naturale di default, tinte note, tinta sconosciuta rifiutata", () => {
  const p = progettoConMuri();
  assert.equal(descrivi(p, "muro", "tr_1").tinte.attiva, "naturale");
  const r = impostaTintaMuro(p, "tr_1", "ocra");
  assert.equal(r.p.walls.find((w) => w.id === "tr_1").tinta, "ocra");
  assert.ok(impostaTintaMuro(p, "tr_1", "verde_fluo").errore);
  const nuovo = eseguiAzione(p, "muro", "tr_1", "tinta:salvia");
  assert.equal(nuovo.walls.find((w) => w.id === "tr_1").tinta, "salvia");
});

test("catalogo: ogni finitura con foto ha il set di file dichiarato", () => {
  for (const v of [...Object.values(MATERIALI_PAVIMENTO), ...Object.values(MATERIALI_MURO)]) {
    if (v.foto) assert.match(v.foto, /^[a-z0-9_]+$/);
  }
  assert.ok(Object.keys(TINTE_MURO).length >= 5);
});
