// Test dei dati normativi: valori della Tabella S.4-12 e S.4-13 copiati dal testo ufficiale.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DENSITA_S412, CRITERI_S413, FONTE_NORMATIVA, voceDensita } from "../src/core/normativa.js";

test("Tabella S.4-12: sedici righe, valori come stampati nel testo ufficiale", () => {
  assert.equal(DENSITA_S412.length, 16);
  const valori = DENSITA_S412.map((r) => r.densitaPersoneM2);
  assert.deepEqual([...new Set(valori)].sort((a, b) => a - b), [0.05, 0.1, 0.2, 0.4, 0.7, 1.2, 2.0]);
});

test("Tabella S.4-12: ristorazione 0,7 e civile abitazione 0,05", () => {
  assert.equal(voceDensita("ristorazione").densitaPersoneM2, 0.7);
  assert.equal(voceDensita("civile_abitazione").densitaPersoneM2, 0.05);
});

test("voceDensita: codice sconosciuto restituisce null", () => {
  assert.equal(voceDensita("non_esiste"), null);
});

test("Tabella S.4-13: cinque criteri", () => {
  assert.equal(CRITERI_S413.length, 5);
});

test("fonte: edizione e pagina riportate", () => {
  assert.ok(FONTE_NORMATIVA.edizione.includes("1 gennaio 2023"));
  assert.ok(FONTE_NORMATIVA.url.startsWith("https://www.vigilfuoco.it/"));
});
