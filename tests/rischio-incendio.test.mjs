// Calcolo del rischio di incendio e dell'esodo (DM 10/3/1998): valori e limiti letti dal testo coordinato.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classificaRischio, verificaEsodo, LIMITI_ESODO } from "../src/core/rischio-incendio.js";

test("classificazione: un solo criterio di rischio elevato rende il luogo elevato (lett. C)", () => {
  assert.equal(classificaRischio({ esplosivi: true }).livello, "elevato");
  assert.equal(classificaRischio({ edificio_legno: true }).livello, "elevato");
  assert.equal(classificaRischio({ evacuazione_difficile: true }).livello, "elevato");
});

test("classificazione: medio e basso senza criteri elevati", () => {
  assert.equal(classificaRischio({ infiammabili_condizioni: true }).livello, "medio");
  assert.equal(classificaRischio({ bassa_infiammabilita: true }).livello, "basso");
  const nessuno = classificaRischio({});
  assert.equal(nessuno.livello, "basso");
  assert.ok(nessuno.note.some((n) => n.includes("Nessun criterio")));
});

test("riduzione del livello: consentita solo se non ci sono sostanze o esplosivi (dichiarata)", () => {
  const r = classificaRischio({ materiali_combustibili: true, riduzione_separazione: true });
  assert.equal(r.livelloFinale, "medio");
  const r2 = classificaRischio({ esplosivi: true, riduzione_separazione: true });
  assert.equal(r2.livelloFinale, "elevato");
});

test("esodo: limiti del punto 3.3 lett. c, e: rischio elevato 15-30 m con due vie, 6-15 m con una", () => {
  assert.deepEqual(LIMITI_ESODO.elevato.percorsoDueVie, [15, 30]);
  assert.deepEqual(LIMITI_ESODO.medio.percorsoUnaVia, [9, 30]);
  const ok = verificaEsodo({ livello: "elevato", distanzaDueVie_m: 30, distanzaUnaVia_m: 15, affollamento: 20, numeroUscite: 2 });
  assert.ok(ok.esiti.find((e) => e.id === "percorso_due_vie").ok);
  const ko = verificaEsodo({ livello: "elevato", distanzaDueVie_m: 31, distanzaUnaVia_m: 15, affollamento: 20, numeroUscite: 2 });
  assert.equal(ko.esiti.find((e) => e.id === "percorso_due_vie").ok, false);
});

test("esodo: pubblico o persone assistite portano al limite piu' basso (punto 3.4)", () => {
  const r = verificaEsodo({ livello: "medio", distanzaDueVie_m: 35, distanzaUnaVia_m: 5, affollamento: 10, numeroUscite: 1, pubblico: true });
  assert.equal(r.cauto, true);
  assert.equal(r.esiti.find((e) => e.id === "percorso_due_vie").limite, 30);
  assert.equal(r.esiti.find((e) => e.id === "percorso_due_vie").ok, false);
});

test("esodo: larghezza medio/basso = A/50 x 0,60 m arrotondato al modulo, minimo 0,80 m (punto 3.5)", () => {
  // 120 persone: 3 moduli -> 1,80 m
  const r = verificaEsodo({ livello: "basso", distanzaDueVie_m: 40, distanzaUnaVia_m: 10, affollamento: 120, numeroUscite: 2, larghezzaUscite_m: 1.8 });
  const l = r.esiti.find((e) => e.id === "larghezza_uscite");
  assert.equal(l.limite, 1.8);
  assert.equal(l.ok, true);
  const k = verificaEsodo({ livello: "basso", distanzaDueVie_m: 40, distanzaUnaVia_m: 10, affollamento: 120, numeroUscite: 2, larghezzaUscite_m: 1.2 });
  assert.equal(k.esiti.find((e) => e.id === "larghezza_uscite").ok, false);
  const m = verificaEsodo({ livello: "medio", distanzaDueVie_m: 40, distanzaUnaVia_m: 10, affollamento: 5, numeroUscite: 1, larghezzaUscite_m: 0.6 });
  assert.equal(m.esiti.find((e) => e.id === "larghezza_uscite").limite, 0.8);
});

test("esodo: piu' di 50 persone richiedono due uscite (punto 3.5 lett. a)", () => {
  const r = verificaEsodo({ livello: "basso", distanzaDueVie_m: 40, distanzaUnaVia_m: 10, affollamento: 51, numeroUscite: 1, larghezzaUscite_m: 1.2 });
  assert.equal(r.esiti.find((e) => e.id === "uscite_numero").ok, false);
});

test("esodo: dati assenti elencati", () => {
  const r = verificaEsodo({ livello: "medio" });
  assert.ok(r.mancanti.length >= 3);
});
