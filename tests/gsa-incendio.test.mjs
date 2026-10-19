// Motore GSA (DM 2/9/2021): obblighi, livelli, corsi, scadenze e documenti verificati sul testo ufficiale.
import { test } from "node:test";
import assert from "node:assert/strict";
import { obbligoPiano, livelloRischio, calcolaGSA, CORSI, ANNI_AGGIORNAMENTO, PLANIMETRIA_ELEMENTI } from "../src/core/gsa-incendio.js";

test("piano di emergenza: 10 lavoratori o pubblico oltre 50 persone (art. 2 comma 2)", () => {
  assert.equal(obbligoPiano({ lavoratori: 9 }).obbligatorio, false);
  assert.equal(obbligoPiano({ lavoratori: 10 }).obbligatorio, true);
  assert.equal(obbligoPiano({ lavoratori: 2, aperto_pubblico: true, pubblico_contemporaneo: 50 }).obbligatorio, false);
  assert.equal(obbligoPiano({ lavoratori: 2, aperto_pubblico: true, pubblico_contemporaneo: 51 }).obbligatorio, true);
  assert.equal(obbligoPiano({ lavoratori: 1, soggettaCPI: true }).obbligatorio, true);
});

test("misure semplificate solo per pubblico oltre 50 con meno di 10 lavoratori (all. II par. 4)", () => {
  const p = obbligoPiano({ lavoratori: 4, aperto_pubblico: true, pubblico_contemporaneo: 80 });
  assert.equal(p.misureSemplificate, true);
  assert.equal(p.obbligatorio, true); // il piano resta obbligatorio: la forma semplificata e' un'opzione
});

test("livello di rischio: 3 dall'elenco, 2 per DPR 151/2011 o fiamme, altrimenti 1", () => {
  assert.equal(livelloRischio({ livello3: ["alberghi_200"] }).livello, 3);
  assert.equal(livelloRischio({ soggettaCPI: true }).livello, 2);
  assert.equal(livelloRischio({ cantiereFiamme: true }).livello, 2);
  assert.equal(livelloRischio({}).livello, 1);
});

test("durata dei corsi (all. III 3.2.5-3.2.6): 1 = 4/2 ore, 2 = 8/5 ore, 3 = 16/8 ore", () => {
  assert.equal(CORSI[1].formazione.ore, 4);
  assert.equal(CORSI[1].aggiornamento.ore, 2);
  assert.equal(CORSI[2].formazione.ore, 8);
  assert.equal(CORSI[2].aggiornamento.ore, 5);
  assert.equal(CORSI[3].formazione.ore, 16);
  assert.equal(CORSI[3].aggiornamento.ore, 8);
  assert.equal(ANNI_AGGIORNAMENTO, 5);
});

test("calcolo: dati mancanti segnalati, nessun valore assunto", () => {
  const r = calcolaGSA({});
  assert.equal(r.completo, false);
  assert.ok(r.mancanti.some((m) => m.includes("lavoratori")));
});

test("calcolo: piano obbligatorio chiede planimetria, contenuti, esercitazione e scadenze", () => {
  const r = calcolaGSA({ lavoratori: 12, soggettaCPI: false, data_corso_addetti: "2024-03-10", data_ultima_esercitazione: "2025-05-02" });
  assert.equal(r.piano.obbligatorio, true);
  assert.equal(r.planimetria.length, PLANIMETRIA_ELEMENTI.length);
  assert.ok(r.mancanti.some((m) => m.startsWith("planimetria")));
  assert.equal(r.scadenze.find((s) => s.id === "aggiornamento_addetti").data, "2029-03-10");
  assert.equal(r.scadenze.find((s) => s.id === "esercitazione").data, "2026-05-02");
});

test("calcolo: senza piano nessuna planimetria richiesta, il rischio va nel DVR", () => {
  const r = calcolaGSA({ lavoratori: 3, soggettaCPI: false, data_corso_addetti: "2024-01-01" });
  assert.equal(r.piano.obbligatorio, false);
  assert.equal(r.planimetria, null);
  assert.match(r.obblighi.find((o) => o.id === "piano").testo, /documento di valutazione/);
});
