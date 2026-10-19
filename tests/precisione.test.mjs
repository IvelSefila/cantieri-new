// Affidabilita' dei motori: ogni motore dichiara stato, approssimazioni, cosa serve per il 100 % e documenti.
import { test } from "node:test";
import assert from "node:assert/strict";
import { valutaMotori, STATI, NOTA_PONTI_10, riepilogo } from "../src/core/precisione.js";
import { calcolaEnergiaScheda, valoriIniziali, leggiNodiPonti } from "../src/ui/energia-ui.js";
import { classificaMuro } from "../src/core/elementi.js";

const motore = (ctx, id) => valutaMotori(ctx).find((m) => m.id === id);

test("ogni motore ha stato valido, spiegazioni e documenti", () => {
  const motori = valutaMotori({});
  assert.equal(motori.length, 14);
  for (const m of motori) {
    assert.ok(STATI[m.stato], `${m.id}: stato ${m.stato}`);
    assert.ok(Array.isArray(m.perIl100) && m.perIl100.length > 0, `${m.id}: cosa serve per il 100 %`);
    assert.ok(Array.isArray(m.documenti), m.id);
    for (const a of m.approssimazioni) assert.ok(a.dato && a.perche, `${m.id}: approssimazione senza perche'`);
  }
  const c = riepilogo(motori);
  assert.equal(c.esatto + c.dati + c.stima + c.incompleto, 14);
});

test("Asol,est: manca ggl+sh -> MANCANO DATI; con scheda tecnica -> ESATTO SUI DATI", () => {
  assert.equal(motore({ solare: { gglsh: false } }, "asol").stato, "incompleto");
  assert.equal(motore({ solare: { gglsh: true, FFdaScheda: false } }, "asol").stato, "stima");
  assert.equal(motore({ solare: { gglsh: true, FFdaScheda: true, FshObDaRilievo: true } }, "asol").stato, "stima"); // Nord non confermato
  assert.equal(motore({ solare: { gglsh: true, FFdaScheda: true, FshObDaRilievo: true, nordConfermato: true } }, "asol").stato, "dati");
  assert.equal(motore({ localita: "Milano", solare: { gglsh: true, FFdaScheda: true } }, "asol").stato, "incompleto");
});

test("H'T: ponti assenti -> MANCANO DATI, percentuale -> STIMA, psi -> ESATTO SUI DATI", () => {
  const base = { U: true, superfici: true };
  assert.equal(motore({ energia: { ...base, ponti: "assenti" } }, "ht").stato, "incompleto");
  assert.equal(motore({ energia: { ...base, ponti: "forfait" } }, "ht").stato, "stima");
  assert.equal(motore({ energia: { ...base, ponti: "psi" } }, "ht").stato, "dati");
});

test("stanze con monconi: stima con l'elenco delle stanze da controllare", () => {
  const m = motore({ geometria: { stanze: 3, stanzeConMonconi: ["stanza_002"] } }, "stanze");
  assert.equal(m.stato, "stima");
  assert.ok(m.approssimazioni[0].dato.includes("stanza_002"));
  assert.equal(motore({ geometria: { stanze: 3, stanzeConMonconi: [] } }, "stanze").stato, "dati");
});

test("geometria tracciata su immagine e' una stima; muri portanti sempre presunti", () => {
  assert.equal(motore({ geometria: { origine: "immagine", muri: 4 } }, "geometria").stato, "stima");
  assert.equal(motore({ geometria: { origine: "dxf", muri: 4 } }, "geometria").stato, "dati");
  assert.equal(motore({}, "strutture").stato, "stima");
  const c = classificaMuro({ kind: "tramezzo", t: 250 });
  assert.equal(c.portante, true);
  assert.match(c.motivo, /presunto portante/);
  assert.equal(c.certezza, "presunta dal disegno");
});

test("la nota sul 10 % spiega l'origine e l'abrogazione", () => {
  assert.match(NOTA_PONTI_10, /prospetto 4/);
  assert.match(NOTA_PONTI_10, /2014/);
  assert.match(NOTA_PONTI_10, /DM 28\/10\/2025/);
});

test("scheda Energia: ogni risultato porta lo stato e senza dati elenca cosa manca", () => {
  const vuoto = calcolaEnergiaScheda(valoriIniziali(), []);
  assert.ok(vuoto.mancanti.some((m) => m.includes("superficie disperdente")));
  assert.ok(vuoto.mancanti.some((m) => m.includes("ponti termici")));
  const v = { ...valoriIniziali(), superficie_utile_m2: 92.8, volume_m3: 385.36, superficie_disperdente_m2: 242.26, U_medio_W_m2K: 0.3,
    ponti_modo: "psi", ponti_nodi_testo: "Pilastro; 0,90; 11,2\nSolaio; 0,70; 40", interni_W: 450, tau_h: 18, gglsh: 0.35 };
  const r = calcolaEnergiaScheda(v, [{ vano: "f1", muro: "m1", materiale: "vetro", area_m2: 2, orientamento: "S" }]);
  assert.equal(r.risultati.verificaHT.stato, "dati");
  assert.ok(Math.abs(r.risultati.verificaHT.HT - (0.3 * 242.26 + 0.9 * 11.2 + 0.7 * 40) / 242.26) < 1e-12);
  assert.equal(r.risultati.riscaldamento.stato, "stima");
  assert.equal(r.risultati.mensile.stato, "stima");
  assert.ok(r.risultati.mensile.Q_nd_kWh > 0);
  assert.equal(r.risultati.raffrescamento.stato, "stima");
});

test("righe dei ponti termici: lettura e errori", () => {
  const ok = leggiNodiPonti("Pilastro; 0,90; 11,2\n\nAngolo; -0,15; 5,6");
  assert.equal(ok.nodi.length, 2);
  assert.equal(ok.nodi[1].psi_W_mK, -0.15);
  assert.equal(leggiNodiPonti("Pilastro; 0,9").errori.length, 1);
});
