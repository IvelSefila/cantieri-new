// Automatismi: finiture di tutto, finestre sulle facciate con aeroilluminante, arredo senza collisioni.
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggiungiMuro, progettoVuoto } from "../src/core/project.js";
import { finiturTutto, infissiAutomatici, arredaTutto } from "../src/core/automatismi.js";
import { collisioniArredo } from "../src/core/arredi.js";

function stanzaRettangolo() {
  let p = progettoVuoto();
  const pts = [[0, 0], [6000, 0], [6000, 4000], [0, 4000]];
  for (let i = 0; i < 4; i++) p = aggiungiMuro(p, pts[i], pts[(i + 1) % 4], 250).p;
  return p;
}

test("finiture: tutti i muri e una stanza con pavimento", () => {
  const r = finiturTutto(stanzaRettangolo(), { muro: "bianco_latte", pavimento: "marmo" });
  assert.ok(r.p.walls.every((w) => w.finitura === "bianco_latte"));
  assert.equal(r.p.floors.length, 1);
  assert.equal(r.p.floors[0].materiale, "marmo");
});

test("finestre: aeroilluminante >= 1/8 della stanza, sulle facciate, dichiarate fuori planimetria", () => {
  const r = infissiAutomatici(stanzaRettangolo(), { livello: "base" });
  const finestre = r.p.openings.filter((o) => o.type === "finestra");
  assert.ok(finestre.length >= 1);
  assert.equal(r.rapporto[0].ok, true);
  assert.ok(r.fuoriPlanimetria.some((t) => t.includes("finestre")));
});

test("finestre: nessuna sovrapposizione con porte o altre finestre sullo stesso muro", () => {
  const r = infissiAutomatici(stanzaRettangolo(), { livello: "avanzato" });
  const per = {};
  for (const o of r.p.openings) (per[o.wall] ??= []).push(o);
  for (const lista of Object.values(per)) {
    lista.sort((a, b) => a.offset - b.offset);
    for (let i = 1; i < lista.length; i++) assert.ok(lista[i].offset >= lista[i - 1].offset + lista[i - 1].width);
  }
});

test("arredo: pezzi aggiunti senza collisioni, avviso fuori planimetria", () => {
  const r = arredaTutto(stanzaRettangolo());
  assert.ok(r.aggiunti.length >= 2);
  for (const a of r.p.furniture) assert.equal(collisioniArredo(a, r.p).length, 0);
  assert.ok(r.fuoriPlanimetria.length === 1);
});
