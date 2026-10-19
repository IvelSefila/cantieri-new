// Limiti H'T del DM 26/06/2015 come aggiornato dal DM 28/10/2025 e registro normativo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { limiteHTNuova, limiteHTRistrutturazione, verificaHT, TAB10_HT, TAB11_HT } from "../src/core/limiti.js";
import { NORME, DATA_VERIFICA } from "../src/core/registro-norme.js";

test("Tabella 10 (nuove costruzioni): valori del testo ufficiale", () => {
  assert.equal(limiteHTNuova("A", 0.3), 0.80);
  assert.equal(limiteHTNuova("E", 0.5), 0.55);
  assert.equal(limiteHTNuova("E", 0.7), 0.50);
  assert.equal(limiteHTNuova("F", 0.2), 0.70);
  assert.throws(() => limiteHTNuova("G", 0.5));
  assert.throws(() => limiteHTNuova("E", 0));
});

test("Tabella 11 (ristrutturazioni): colonna immediatamente inferiore al vetrato", () => {
  assert.equal(limiteHTRistrutturazione("E", 9), 0.55);
  assert.equal(limiteHTRistrutturazione("C", 47), 1.08);
  assert.equal(limiteHTRistrutturazione("E", 50), 0.74);   // 47 % e' la colonna precedente
  assert.equal(limiteHTRistrutturazione("F", 100), 0.96);
  assert.equal(limiteHTRistrutturazione("A", 57), 1.53);
  assert.equal(limiteHTRistrutturazione("D", 3), 0.58);     // sotto 9 %: prima colonna
});

test("Tabelle complete: ogni riga ha 20 valori crescenti con il vetrato", () => {
  for (const [z, r] of Object.entries(TAB11_HT)) {
    assert.equal(r.length, 20, z);
    for (let i = 1; i < r.length; i++) assert.ok(r[i] >= r[i - 1], `${z} colonna ${i}`);
  }
  for (const [z, r] of Object.entries(TAB10_HT)) {
    assert.ok(r[0] >= r[1] && r[1] >= r[2], `zona ${z}`);
  }
});

test("Controprova con le relazioni reali: i limiti coincidono con quelli stampati", () => {
  // ACCA TerMus (Roma, zona D, S/V 242,26/385,36 = 0,63): limite stampato H'T,lim 0,58
  assert.equal(limiteHTNuova("D", 242.26 / 385.36), 0.58);
  // Blumatica (S/V 499,05/677,4 = 0,737): limite stampato H'T,L 0,530 in zona D
  assert.equal(limiteHTNuova("D", 499.05 / 677.4), 0.53);
});

test("verificaHT: H'T = Htr,adj / A", () => {
  const r = verificaHT({ Htr_adj_W_K: 77.5, A_tot_m2: 242.26, zona: "D", SV: 0.63 });
  assert.ok(Math.abs(r.HT - 77.5 / 242.26) < 1e-12);
  assert.equal(r.verifica, true);
  assert.equal(verificaHT({ Htr_adj_W_K: 200, A_tot_m2: 242.26, zona: "D", SV: 0.63 }).verifica, false);
});

test("Registro normativo: dati di verifica, stati ammessi e moduli collegati", () => {
  assert.equal(DATA_VERIFICA, "2026-10-19");
  const stati = new Set(["testo letto", "citata", "non verificata"]);
  for (const [id, n] of Object.entries(NORME)) {
    assert.ok(stati.has(n.stato), `${id}: stato ${n.stato}`);
    assert.ok(n.titolo && n.dettaglio !== undefined, id);
  }
  assert.equal(NORME.dm_requisiti_2015_2025.stato, "testo letto");
});
