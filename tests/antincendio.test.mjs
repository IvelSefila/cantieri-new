// Test del modulo antincendio: superficie lorda, multipiano, affollamento, controllo quote.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { superficiePerAmbito, superficiePerPiano, controlloQuote, rapportoAntincendio } from "../src/core/antincendio.js";
import { stanze } from "../src/core/rooms.js";

const here = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(readFileSync(join(here, "..", "data", "plan-ar02.json"), "utf-8"));
const rettangolo = { schema: 1, unit: "mm", altezza_muri: 2800, walls: [
  { id: "n", a: [0, 0], b: [4000, 0], t: 200 }, { id: "e", a: [4000, 0], b: [4000, 3000], t: 200 },
  { id: "s", a: [4000, 3000], b: [0, 3000], t: 200 }, { id: "w", a: [0, 3000], b: [0, 0], t: 200 } ] };

test("superficie lorda per piano: uguale alla somma delle stanze, in mm2 esatti", () => {
  const r = superficiePerPiano([{ piano: "P0", plan: rettangolo }]);
  assert.equal(r[0].superficieLordaMm2, 10640000);
});

test("multipiano: due piani uguali con stesso ambito sommano le superfici", () => {
  const ass = { "P0:stanza_001": { ambito: "A1", destinazione: "residenziale", densita: 0.1, riferimentoDensita: "Tab S.4-12" },
                "P1:stanza_001": { ambito: "A1", destinazione: "residenziale", densita: 0.1, riferimentoDensita: "Tab S.4-12" } };
  const r = superficiePerAmbito([{ piano: "P0", plan: rettangolo }, { piano: "P1", plan: rettangolo }], ass);
  const a = r.ambiti.find((x) => x.ambito === "A1");
  assert.equal(a.superficieLordaMm2, 2 * 10640000);
  assert.deepEqual(a.piani.sort(), ["P0", "P1"]);
});

test("affollamento = densita' x superficie lorda, arrotondato per eccesso; nullo senza densita'", () => {
  const senza = superficiePerAmbito([{ piano: "P0", plan: rettangolo }]).ambiti[0];
  assert.equal(senza.affollamento, null);
  assert.ok(senza.mancanti.some((m) => m.includes("densit")));
  const con = superficiePerAmbito([{ piano: "P0", plan: rettangolo }], { "P0:stanza_001": { ambito: "X", destinazione: "uffici", densita: 0.1, riferimentoDensita: "Tab S.4-12" } }).ambiti[0];
  assert.equal(con.affollamento, Math.ceil(10.64 * 0.1));
});

test("attivita' dalla Tabella S.4-12: densita' e riferimento ufficiale ricavati dal codice", () => {
  const ass = { "P0:stanza_001": { ambito: "R1", destinazione: "ristorazione", attivita: "ristorazione" } };
  const a = superficiePerAmbito([{ piano: "P0", plan: rettangolo }], ass).ambiti[0];
  assert.equal(a.densitaPersoneM2, 0.7);
  assert.equal(a.riferimentoDensita, "Tabella S.4-12: Ambiti adibiti a ristorazione");
  assert.equal(a.affollamento, Math.ceil(10.64 * 0.7));
});

test("attivita' sconosciuta: segnalata; densita' esplicita prevale sulla tabella", () => {
  const sconosciuta = superficiePerAmbito([{ piano: "P0", plan: rettangolo }], { "P0:stanza_001": { ambito: "R1", attivita: "boh" } });
  assert.ok(sconosciuta.problemi.some((p) => p.tipo === "attivita_sconosciuta"));
  const esplicita = superficiePerAmbito([{ piano: "P0", plan: rettangolo }], { "P0:stanza_001": { ambito: "R1", attivita: "ristorazione", densita: 0.5, riferimentoDensita: "perizia" } }).ambiti[0];
  assert.equal(esplicita.densitaPersoneM2, 0.5);
  assert.equal(esplicita.riferimentoDensita, "perizia");
});

test("densita' o destinazione incoerenti nello stesso ambito: segnalate", () => {
  const ass = { "P0:stanza_001": { ambito: "X", densita: 0.1, riferimentoDensita: "t" }, "P0:stanza_002": { ambito: "X", densita: 0.5, riferimentoDensita: "t" } };
  const r = superficiePerAmbito([{ piano: "P0", plan: plan }], ass);
  assert.ok(r.problemi.some((p) => p.tipo === "densita_incoerente"));
});

test("controllo quote: quota uguale al modello = ok, quota diversa = discrepanza con scarto", () => {
  const e = controlloQuote(rettangolo, [{ muro: "n", mm: 4000 }, { muro: "e", mm: 3005 }]);
  assert.equal(e[0].esito, "ok");
  assert.equal(e[1].esito, "discrepanza");
  assert.equal(e[1].scartoMm, 5);
});

test("rapporto: contiene riferimento, documenti da allegare e avvertenza di responsabilita'", () => {
  const r = rapportoAntincendio([{ piano: "P0", plan: rettangolo }]);
  assert.ok(r.riferimento.includes("DM 3 agosto 2015"));
  assert.ok(r.documentiDaAllegare.length >= 5);
  assert.ok(r.avvertenza.includes("professionista"));
  assert.equal(r.superficieLordaTotaleMm2, 10640000);
});
