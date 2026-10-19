// Casi di prova (golden) del calcolo GSA per civile abitazione, dal PRD v1.0. Regole: DM 246/1987 + DM 25/1/2019.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { REGOLE_DM246 } from "../src/core/regole-dm246.js";
import { valutaCivileAbitazione, classificaTipo, metriAMm, altezzaAntincendi } from "../src/core/civile-abitazione.js";

const here = dirname(fileURLToPath(import.meta.url));

// Helper: altezza da quote in metri (apertura - piano esterno)
const alt = (apM, esM, extra = {}) => ({
  altezza: {
    quota_apertura_mm: metriAMm(apM), quota_piano_esterno_mm: metriAMm(esM),
    piano_esterno_accessibile_mezzi_vvf: true, vani_tecnici_esclusi: true, stato: "verificato", ...extra,
  },
});
const conAttivita = (att) => ({ ...alt(0, 0), attivita: att });
const h = (metri) => alt(metri, 0);

test("regole: il file JSON e il modulo JS coincidono (rules/dm246_gsa.json)", () => {
  const json = JSON.parse(readFileSync(join(here, "..", "rules", "dm246_gsa.json"), "utf-8"));
  assert.equal(json.stato, "in_attesa_approvazione");
  for (const t of REGOLE_DM246.tipi) {
    const j = json.tipi.find((x) => x.id === t.id);
    assert.equal(j.da_mm, t.da_mm);
    assert.equal(j.a_mm, t.a_mm);
    assert.equal(j.lp_base, t.lp_base);
  }
  assert.equal(json.incremento.soglia_h_mm, REGOLE_DM246.incremento.soglia_h_mm);
});

test("T1 h = 11,99 m: fuori campo", () => assert.equal(valutaCivileAbitazione(h(11.99)).esito, "FUORI_CAMPO"));
test("T2 h = 12,00 m: tipo a, LP 0", () => {
  const r = valutaCivileAbitazione(h(12.0));
  assert.equal(r.tipo, "a"); assert.equal(r.lp_finale, 0); assert.equal(r.esito, "DETERMINATO");
});
test("T3 h = 24,00 m: tipo a, LP 0, con avviso di disomogeneita'", () => {
  const r = valutaCivileAbitazione(h(24.0));
  assert.equal(r.tipo, "a"); assert.equal(r.lp_finale, 0);
  assert.ok(r.avvisi.some((a) => a.testo.includes("24,00")));
});
test("T4 h = 24,01 m: tipo b, LP 1", () => {
  const r = valutaCivileAbitazione(h(24.01));
  assert.equal(r.tipo, "b"); assert.equal(r.lp_finale, 1);
});
test("T5 h = 32,00 e 32,01 m: LP 1 (tipo b e c)", () => {
  assert.equal(valutaCivileAbitazione(h(32.0)).lp_finale, 1);
  const r = valutaCivileAbitazione(h(32.01));
  assert.equal(r.tipo, "c"); assert.equal(r.lp_finale, 1);
});
test("T6 h = 54,01 m: tipo d, LP 2", () => {
  const r = valutaCivileAbitazione(h(54.01));
  assert.equal(r.tipo, "d"); assert.equal(r.lp_finale, 2);
});
test("T7 h = 80,01 m: tipo e, LP 3", () => {
  const r = valutaCivileAbitazione(h(80.01));
  assert.equal(r.tipo, "e"); assert.equal(r.lp_finale, 3);
});
test("T8 h = 30 m, attivita' comunicante non pertinente soggetta: LP incrementato (1 -> 2)", () => {
  const r = valutaCivileAbitazione({ ...h(30), attivita: [{ descrizione: "negozio 77", soggetta_DPR151: "si", comunicante: "si", pertinente: "no" }] });
  assert.equal(r.lp_base, 1); assert.equal(r.lp_finale, 2); assert.equal(r.incremento.stato, "applicato");
});
test("T9 h = 30 m, autorimessa pertinente comunicante: nessun incremento", () => {
  const r = valutaCivileAbitazione({ ...h(30), attivita: [{ descrizione: "autorimessa", soggetta_DPR151: "si", comunicante: "si", pertinente: "si" }] });
  assert.equal(r.lp_finale, 1); assert.equal(r.incremento.stato, "non_applicabile");
});
test("T10 h = 30 m, comunicante da verificare: INDETERMINATO con due scenari", () => {
  const r = valutaCivileAbitazione({ ...h(30), attivita: [{ descrizione: "deposito", soggetta_DPR151: "si", comunicante: "da_verificare", pertinente: "no" }] });
  assert.equal(r.esito, "INDETERMINATO");
  assert.deepEqual(r.scenari, { senza_incremento: 1, con_incremento: 2 });
  assert.equal(r.lp_finale, null);
});
test("T11 quote: apertura +25,20, piano esterno -0,80 -> h = 26,00 m esatto", () => {
  const r = valutaCivileAbitazione({ altezza: { quota_apertura_mm: metriAMm("25.20"), quota_piano_esterno_mm: metriAMm("-0.80"), piano_esterno_accessibile_mezzi_vvf: true, vani_tecnici_esclusi: true, stato: "verificato" } });
  assert.equal(r.altezza.h_mm, 26000);
  assert.equal(r.tipo, "b");
});
test("T12 piano esterno non accessibile ai mezzi VVF: avviso bloccante", () => {
  const r = valutaCivileAbitazione({ altezza: { quota_apertura_mm: 20000, quota_piano_esterno_mm: 0, piano_esterno_accessibile_mezzi_vvf: false, vani_tecnici_esclusi: true, stato: "verificato" } });
  assert.ok(r.altezza.avvisi.some((a) => a.bloccante));
});
test("T13 solo altezza stimata: risultato provvisorio", () => {
  const r = valutaCivileAbitazione({ altezza: { quota_apertura_mm: 30000, quota_piano_esterno_mm: 0, piano_esterno_accessibile_mezzi_vvf: true, vani_tecnici_esclusi: true, stato: "stimato" } });
  assert.ok(r.altezza.avvisi.some((a) => a.testo.includes("PROVVISORIO")));
});
test("T14 h < 12 m con autorimessa 400 m2: FUORI_CAMPO per la GSA, altre attivita' non calcolate", () => {
  const r = valutaCivileAbitazione({ ...h(8), attivita: [{ descrizione: "autorimessa 400 m2", soggetta_DPR151: "da_verificare", comunicante: "si", pertinente: "si" }] });
  assert.equal(r.esito, "FUORI_CAMPO");
  assert.match(r.altre_attivita, /non_calcolate/);
});

test("dato mancante: quota assente -> INDETERMINATO con elenco, mai un 'no'", () => {
  const r = valutaCivileAbitazione({ altezza: { quota_apertura_mm: 30000, piano_esterno_accessibile_mezzi_vvf: true } });
  assert.equal(r.esito, "INDETERMINATO");
  assert.ok(r.dati_mancanti.some((m) => m.includes("piano esterno")));
});
test("proprietà: per ogni h >= 12 m esiste esattamente un tipo (nessun buco, nessuna sovrapposizione)", () => {
  for (let mm = 12000; mm <= 90000; mm += 1) {
    const r = classificaTipo(mm);
    assert.ok(r.tipo, `h=${mm} senza tipo`);
    const candidati = REGOLE_DM246.tipi.filter((t) => mm >= (t.id === "a" ? 12000 : t.da_mm + 1) && (t.a_mm === null || mm <= t.a_mm));
    assert.equal(candidati.length, 1, `h=${mm}: ${candidati.map((c) => c.id)}`);
  }
});
test("quote: conversione in mm senza errori binari, stringhe non valide rifiutate", () => {
  assert.equal(metriAMm("0.1"), 100);
  assert.equal(metriAMm("12,345"), 12345);
  assert.ok(metriAMm("12.3456").errore);
});
