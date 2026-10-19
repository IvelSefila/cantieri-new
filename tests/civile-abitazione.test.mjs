// Casi di prova (golden) del calcolo GSA per civile abitazione, dal PRD v1.0. Regole: DM 246/1987 + DM 25/1/2019.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { REGOLE_DM246 } from "../src/core/regole-dm246.js";
import { valutaCivileAbitazione, classificaTipo, metriAMm, altezzaAntincendi, classificaAttivitaDPR } from "../src/core/civile-abitazione.js";

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
  assert.equal(json.stato, "approvata");
  assert.equal(REGOLE_DM246.stato, json.stato);
  for (const t of REGOLE_DM246.tipi) {
    const j = json.tipi.find((x) => x.id === t.id);
    assert.equal(j.da_mm, t.da_mm);
    assert.equal(j.a_mm, t.a_mm);
    assert.equal(j.lp_base, t.lp_base);
  }
  assert.equal(json.incremento.soglia_h_mm, REGOLE_DM246.incremento.soglia_h_mm);
  assert.equal(json.dpr151.stato, REGOLE_DM246.dpr151.stato);
  assert.deepEqual(json.dpr151["77"].classi, REGOLE_DM246.dpr151["77"].classi);
  assert.deepEqual(json.dpr151["74"].classi, REGOLE_DM246.dpr151["74"].classi);
  assert.deepEqual(json.dpr151["49"].classi, REGOLE_DM246.dpr151["49"].classi);
  assert.equal(json.dpr151["74"].soglia_kw, REGOLE_DM246.dpr151["74"].soglia_kw);
  assert.equal(json.dpr151["49"].soglia_kw, REGOLE_DM246.dpr151["49"].soglia_kw);
  assert.equal(json.dpr151["75"].soglia_m2, REGOLE_DM246.dpr151["75"].soglia_m2);
  assert.equal(json.dpr151["77"].soglia_h_mm, REGOLE_DM246.dpr151["77"].soglia_h_mm);
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
  assert.equal(r.altre_attivita[0].stato, "non_classificata");
});

test("attivita 77: classe A/B/C dalla sola altezza, non prevista sotto 24 m", () => {
  assert.equal(valutaCivileAbitazione(h(20)).categoria_attivita_77.stato, "non_soggetta");
  assert.equal(valutaCivileAbitazione(h(24.0)).categoria_attivita_77.stato, "non_soggetta");
  assert.equal(valutaCivileAbitazione(h(24.01)).categoria_attivita_77.classe, "A");
  assert.equal(valutaCivileAbitazione(h(32.0)).categoria_attivita_77.classe, "A");
  assert.equal(valutaCivileAbitazione(h(32.01)).categoria_attivita_77.classe, "B");
  assert.equal(valutaCivileAbitazione(h(54.0)).categoria_attivita_77.classe, "B");
  assert.equal(valutaCivileAbitazione(h(54.01)).categoria_attivita_77.classe, "C");
});

test("altre attivita' 74/49: soglie 116 e 25 kW, classi A/B/C ai limiti 350 e 700", () => {
  assert.equal(classificaAttivitaDPR({ categoria_dpr151: "74", potenza_kw: 116 }).stato, "non_soggetta");
  assert.equal(classificaAttivitaDPR({ categoria_dpr151: "74", potenza_kw: 116.5 }).classe, "A");
  assert.equal(classificaAttivitaDPR({ categoria_dpr151: "74", potenza_kw: 350 }).classe, "A");
  assert.equal(classificaAttivitaDPR({ categoria_dpr151: "74", potenza_kw: 350.1 }).classe, "B");
  assert.equal(classificaAttivitaDPR({ categoria_dpr151: "74", potenza_kw: 700.1 }).classe, "C");
  assert.equal(classificaAttivitaDPR({ categoria_dpr151: "49", potenza_kw: 25 }).stato, "non_soggetta");
  assert.equal(classificaAttivitaDPR({ categoria_dpr151: "49", potenza_kw: 26 }).classe, "A");
  assert.equal(classificaAttivitaDPR({ categoria_dpr151: "49", potenza_kw: 400 }).classe, "B");
  assert.equal(classificaAttivitaDPR({ categoria_dpr151: "74" }).stato, "dati_mancanti");
});

test("altre attivita' 75: soglia 300 m2, classe di dettaglio non ancora codificata", () => {
  assert.equal(classificaAttivitaDPR({ categoria_dpr151: "75", superficie_m2: 300 }).stato, "non_soggetta");
  const r = classificaAttivitaDPR({ categoria_dpr151: "75", superficie_m2: 301 });
  assert.equal(r.stato, "soggetta");
  assert.equal(r.classe, null);
  assert.equal(classificaAttivitaDPR({ descrizione: "deposito" }).stato, "non_classificata");
});

// Fonti a intervallo: fusione conservativa, conflitti e soglie
const fontiAlt = (...f) => ({ altezza: { fonti: f, piano_esterno_accessibile_mezzi_vvf: true, vani_tecnici_esclusi: true } });

test("F1 pratica 30,00 m e LiDAR [29,70; 30,30]: fusione su intervallo, DETERMINATO tipo b", () => {
  const r = valutaCivileAbitazione(fontiAlt({ fonte: "pratica", h_mm: 30000 }, { fonte: "LiDAR", min_mm: 29700, max_mm: 30300 }));
  assert.equal(r.esito, "DETERMINATO");
  assert.equal(r.tipo, "b");
  assert.equal(r.altezza.h_min_mm, 29700);
  assert.equal(r.altezza.h_max_mm, 30300);
  assert.equal(r.altezza.h_mm, null);
});

test("F2 LiDAR [23,60; 24,40] attraversa 24 m: INDETERMINATO, soglia e azione richiesta", () => {
  const r = valutaCivileAbitazione(fontiAlt({ fonte: "LiDAR", min_mm: 23600, max_mm: 24400 }));
  assert.equal(r.esito, "INDETERMINATO");
  assert.equal(r.motivo, "soglia_attraversata");
  assert.equal(r.soglia_mm, 24000);
  assert.ok(r.azione.includes("rilievo"));
  assert.equal(r.lp_finale, null);
});

test("F3 pratica 30,00 m e LiDAR [25,00; 25,40]: conflitto oltre 500 mm, INDETERMINATO", () => {
  const r = valutaCivileAbitazione(fontiAlt({ fonte: "pratica", h_mm: 30000 }, { fonte: "LiDAR", min_mm: 25000, max_mm: 25400 }));
  assert.equal(r.esito, "INDETERMINATO");
  assert.equal(r.motivo, "conflitto");
  assert.equal(r.altezza.conflitti.length, 1);
});

test("F4 intervallo a 250 mm dalla soglia 32 m: INDETERMINATO per soglia vicina", () => {
  const r = valutaCivileAbitazione(fontiAlt({ fonte: "LiDAR", min_mm: 31750, max_mm: 31900 }));
  assert.equal(r.esito, "INDETERMINATO");
  assert.equal(r.motivo, "soglia_vicina");
  assert.equal(r.soglia_mm, 32000);
});

test("F5 intervallo lontano dalle soglie [26,00; 28,00]: DETERMINATO tipo b", () => {
  const r = valutaCivileAbitazione(fontiAlt({ fonte: "LiDAR", min_mm: 26000, max_mm: 28000 }));
  assert.equal(r.esito, "DETERMINATO");
  assert.equal(r.tipo, "b");
});

test("F6 fonte stimata: risultato provvisorio anche su intervallo", () => {
  const r = valutaCivileAbitazione(fontiAlt({ fonte: "LiDAR", min_mm: 26000, max_mm: 28000, stato: "stimato" }));
  assert.equal(r.altezza.stato, "stimato");
  assert.ok(r.altezza.avvisi.some((a) => a.testo.includes("PROVVISORIO")));
});

test("F7 attivita 77 su intervallo [31,00; 33,00]: classi possibili A e B", () => {
  const r = valutaCivileAbitazione(fontiAlt({ fonte: "LiDAR", min_mm: 31000, max_mm: 33000 }));
  assert.equal(r.esito, "INDETERMINATO");
  assert.equal(r.categoria_attivita_77.stato, "soggetta_classe_incerta");
  assert.deepEqual(r.categoria_attivita_77.classi_possibili, ["A", "B"]);
});

test("F8 fonte non valida (min > max) produce ERRORE, nessuna fonte produce INDETERMINATO", () => {
  assert.equal(valutaCivileAbitazione(fontiAlt({ fonte: "errata", min_mm: 30000, max_mm: 29000 })).esito, "ERRORE");
  const r = valutaCivileAbitazione({ altezza: { fonti: [] } });
  assert.equal(r.esito, "INDETERMINATO");
  assert.equal(r.motivo, "nessuna_fonte");
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
