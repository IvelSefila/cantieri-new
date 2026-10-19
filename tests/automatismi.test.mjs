// Automatismi: funzione delle stanze, arredo per funzione, finestre secondo DM 5/7/1975.
import { test } from "node:test";
import assert from "node:assert/strict";
import { aggiungiMuro, progettoVuoto, impostaFunzioneStanza } from "../src/core/project.js";
import { finiturTutto, infissiAutomatici, arredaTutto, funzioneStanza } from "../src/core/automatismi.js";
import { stanze } from "../src/core/rooms.js";
import { collisioniArredo } from "../src/core/arredi.js";

// Due stanze: soggiorno 6x5 m e camera 2,5x5 m (muro divisorio a x = 6000)
function appartamento() {
  let p = progettoVuoto();
  p = { ...p, altezza_muri: 2800 };
  const perimetro = [[0, 0], [8500, 0], [8500, 5000], [0, 5000]];
  for (let i = 0; i < 4; i++) p = aggiungiMuro(p, perimetro[i], perimetro[(i + 1) % 4], 250).p;
  p = aggiungiMuro(p, [6000, 0], [6000, 5000], 120).p;
  return p;
}

test("funzione: la stanza piu' grande e' il soggiorno, scelta salvata prevale sul suggerimento", () => {
  let p = appartamento();
  const [grande, piccola] = stanze(p.walls).sort((a, b) => b.superficieMm2 - a.superficieMm2);
  assert.equal(funzioneStanza(p, grande).funzione, "soggiorno");
  p = impostaFunzioneStanza(p, piccola.interno, "bagno").p;
  assert.equal(funzioneStanza(p, piccola).funzione, "bagno");
  assert.equal(funzioneStanza(p, piccola).sorgente, "scelta");
});

test("arredo: ogni pezzo sta nella stanza della sua funzione, niente divano in bagno", () => {
  let p = appartamento();
  const [grande, piccola] = stanze(p.walls).sort((a, b) => b.superficieMm2 - a.superficieMm2);
  p = impostaFunzioneStanza(p, piccola.interno, "bagno").p;
  const r = arredaTutto(p);
  const inBagno = r.p.furniture.filter((a) => a.x > 6000);
  assert.ok(inBagno.length >= 1);
  for (const a of inBagno) assert.ok(["wc", "lavabo", "doccia", "bidet"].includes(a.tipo), `${a.tipo} nel bagno`);
  for (const a of r.p.furniture) assert.equal(collisioniArredo(a, r.p).length, 0);
});

test("finestre: stanze abitabili ottengono 1/8 di aeroilluminante con finestra apribile", () => {
  const r = infissiAutomatici(appartamento());
  const soggiorno = r.rapporto.find((x) => x.funzione === "soggiorno");
  assert.equal(soggiorno.ok, true);
  const finestre = r.p.openings.filter((o) => o.type === "finestra");
  assert.ok(finestre.length >= 1);
  assert.ok(finestre.every((o) => o.apribile === true));
});

test("finestre: nessuna sovrapposizione sullo stesso muro", () => {
  const r = infissiAutomatici(appartamento());
  const per = {};
  for (const o of r.p.openings) (per[o.wall] ??= []).push(o);
  for (const lista of Object.values(per)) {
    lista.sort((a, b) => a.offset - b.offset);
    for (let i = 1; i < lista.length; i++) assert.ok(lista[i].offset >= lista[i - 1].offset + lista[i - 1].width);
  }
});

test("altezza interna sotto 2,70 m: segnalata", () => {
  const p = { ...appartamento(), altezza_muri: 2600 };
  assert.ok(infissiAutomatici(p).fuoriPlanimetria.some((t) => t.includes("2,70")));
});

test("finiture: tutti i muri e una stanza con pavimento", () => {
  const r = finiturTutto(appartamento(), { muro: "bianco_latte", pavimento: "marmo" });
  assert.ok(r.p.walls.every((w) => w.finitura === "bianco_latte"));
  assert.equal(r.p.floors.length, 2);
});
