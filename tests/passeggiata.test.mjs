import { test } from "node:test";
import assert from "node:assert/strict";
import {
  geometriaPorta, direzioneAnta, ostacoli, muoviConCollisioni, passo, aggiornaPorte,
  porteDelProgetto, posizioneIniziale, APERTURA_MAX_RAD, distanzaPuntoSegmento,
  vettoreSguardo, statoPasseggiata, aggiornaPasseggiata,
} from "../src/core/passeggiata.js";

// Edificio di prova: un muro orizzontale lungo 4000 mm con una porta da 900 mm all'offset 1000
const progetto = {
  schema: 1,
  unit: "mm",
  walls: [{ id: "m1", a: [0, 0], b: [4000, 0], t: 200, kind: "portante" }],
  openings: [{ id: "p1", wall: "m1", offset: 1000, width: 900, height: 2100, sill: 0, type: "porta", apertura: { cardine: "a", lato: "+" } }],
  floors: [],
  furniture: [],
};

test("geometria porta: cerniera e centro sul muro", () => {
  const g = geometriaPorta(progetto.openings[0], progetto.walls[0]);
  assert.deepEqual(g.cerniera, [1000, 0]);
  assert.deepEqual(g.centro, [1450, 0]);
  assert.equal(g.datiMancanti, false);
});

test("senso di apertura: lato + sposta l'anta verso la normale +n", () => {
  const g = geometriaPorta(progetto.openings[0], progetto.walls[0]);
  // muro con u=(1,0), n=(-uy,ux)=(0,1): a 90 gradi l'anta punta verso +y
  const d = direzioneAnta(g, Math.PI / 2);
  assert.ok(Math.abs(d[0]) < 1e-9 && Math.abs(d[1] - 1) < 1e-9);
});

test("senso di apertura: lato - e cardine b invertono la direzione", () => {
  const op = { ...progetto.openings[0], apertura: { cardine: "b", lato: "-" } };
  const g = geometriaPorta(op, progetto.walls[0]);
  assert.deepEqual(g.cerniera, [1900, 0]);
  const d = direzioneAnta(g, Math.PI / 2);
  // primo = -u = (-1,0), verso = -n = (0,-1): a 90 gradi punta verso -y
  assert.ok(Math.abs(d[0]) < 1e-9 && Math.abs(d[1] + 1) < 1e-9);
});

test("porta senza apertura: default dichiarato come dato mancante", () => {
  const op = { ...progetto.openings[0], apertura: undefined };
  const g = geometriaPorta(op, progetto.walls[0]);
  assert.equal(g.datiMancanti, true);
  assert.equal(g.cardine, "a");
  assert.equal(g.lato, "+");
});

test("ostacoli: muro spezzato dal vano porta, anta chiusa contro il muro", () => {
  const obst = ostacoli(progetto, {});
  const muri = obst.filter((o) => o.tipo === "muro");
  assert.equal(muri.length, 2);
  assert.deepEqual(muri[0].b, [1000, 0]);
  assert.deepEqual(muri[1].a, [1900, 0]);
  const anta = obst.find((o) => o.tipo === "anta");
  assert.ok(anta);
});

test("collisione: il corpo non attraversa un muro in un solo salto", () => {
  const obst = ostacoli(progetto, {});
  // muro in y=0 con spessore 200 (r=100); corpo 250: fermo a distanza >= 350, cioe' y <= -350
  const pos = muoviConCollisioni([500, -500], [0, 1000], obst);
  assert.ok(pos[1] <= -350 + 1e-9, `attraversato: y=${pos[1]}`);
  assert.ok(pos[1] > -400, `fermato troppo presto: y=${pos[1]}`);
});

test("collisione: la porta chiusa blocca, la porta aperta lascia passare", () => {
  const chiusa = ostacoli(progetto, {});
  const bloccata = muoviConCollisioni([1450, -800], [0, 800], chiusa);
  // anta chiusa lungo il muro in y=0, raggio 20 + corpo 250: il centro si ferma a y=-270,
  // con tolleranza di un passo (raggio/4 = 62,5 mm)
  assert.ok(bloccata[1] <= -270 + 1e-9 && bloccata[1] > -270 - 62.5, `anta chiusa: y=${bloccata[1]}`);
  const aperta = ostacoli(progetto, { p1: APERTURA_MAX_RAD });
  const passa = muoviConCollisioni([1450, -800], [0, 800], aperta);
  assert.ok(passa[1] > 0, `porta aperta: dovrebbe passare, y=${passa[1]}`);
});

test("passo: avanti sposta lungo yaw, senza superare la velocità", () => {
  const obst = [];
  const st = passo({ pos: [0, 0], yaw: 0 }, { avanti: true }, 0.5, obst);
  // yaw 0 => f = (0,1): avanza in +y
  assert.ok(Math.abs(st.pos[0]) < 1e-9);
  assert.ok(Math.abs(st.pos[1] - 900) < 1e-6);
});

test("aggiornaPorte: si apre avvicinandosi e si richiude allontanandosi", () => {
  const porte = porteDelProgetto(progetto);
  let angoli = {};
  let timer = {};
  // vicino al centro della porta
  let r = aggiornaPorte(porte, [1450, -300], angoli, timer, 1);
  angoli = r.angoli; timer = r.timer;
  assert.ok(angoli.p1 > 0, "dovrebbe aprirsi");
  assert.ok(angoli.p1 <= APERTURA_MAX_RAD + 1e-9);
  // molto lontano e tempo scaduto
  for (let i = 0; i < 20; i++) {
    r = aggiornaPorte(porte, [1450, -5000], angoli, timer, 0.5);
    angoli = r.angoli; timer = r.timer;
  }
  assert.ok(Math.abs(angoli.p1) < 1e-9, "dovrebbe richiudersi");
});

test("posizione iniziale: vicino a un vano porta", () => {
  const p = posizioneIniziale(progetto);
  assert.deepEqual(p.pos, [1450, 800]);
});

test("vettore di sguardo: yaw 0 guarda in +y, yaw pi/2 in +x, pitch pi/2 verso l'alto", () => {
  const a = vettoreSguardo(0, 0);
  assert.ok(Math.abs(a[0]) < 1e-9 && Math.abs(a[1] - 1) < 1e-9 && Math.abs(a[2]) < 1e-9);
  const b = vettoreSguardo(Math.PI / 2, 0);
  assert.ok(Math.abs(b[0] - 1) < 1e-9 && Math.abs(b[1]) < 1e-9);
  const c = vettoreSguardo(0, Math.PI / 2);
  assert.ok(Math.abs(c[2] - 1) < 1e-9 && Math.abs(c[1]) < 1e-9);
});

test("passeggiata: la porta si apre da sola e il corpo passa nel vano", () => {
  let st = { ...statoPasseggiata(progetto), pos: [1450, -900], yaw: 0 };
  for (let i = 0; i < 30; i++) st = aggiornaPasseggiata(st, {}, 0.05, progetto);
  assert.ok(Math.abs(st.angoli.p1 - APERTURA_MAX_RAD) < 1e-6, `porta non aperta: ${st.angoli.p1}`);
  for (let i = 0; i < 24; i++) st = aggiornaPasseggiata(st, { avanti: true }, 0.05, progetto);
  assert.ok(st.pos[1] > 0, `non e' passato: y=${st.pos[1]}`);
});

test("passeggiata: senza input il corpo resta fermo", () => {
  const st0 = { ...statoPasseggiata(progetto), pos: [1450, -500], yaw: 0 };
  const st = aggiornaPasseggiata(st0, {}, 0.05, progetto);
  assert.deepEqual(st.pos, [1450, -500]);
});

test("arredo: il corpo non attraversa un divano in pianta", () => {
  const conArredo = { ...progetto, furniture: [{ id: "d1", tipo: "divano", x: 2000, y: 600, rot: 0 }] };
  const obst = ostacoli(conArredo, {});
  assert.ok(obst.some((o) => o.tipo === "arredo"));
  // il divano occupa circa y in [600 - D/2, 600 + D/2]: il corpo, avanzando verso +y da y=-200, si ferma prima
  const st = aggiornaPasseggiata({ pos: [2000, -200], yaw: 0, pitch: 0, angoli: {}, timer: {} }, { avanti: true }, 2, conArredo);
  assert.ok(st.pos[1] < 600, `attraversato l'arredo: y=${st.pos[1]}`);
});

test("partenza: lo sguardo punta verso l'interno dell'edificio", () => {
  const p = posizioneIniziale(progetto);
  // l'edificio di prova e' a y=0 e il punto di partenza sta a y=800: lo sguardo deve andare verso -y
  assert.ok(Math.cos(p.yaw) < 0, `sguardo verso l'esterno: yaw=${p.yaw}`);
});

test("posizione iniziale: mai dentro un muro, anche se il lato interno e' bloccato", () => {
  // muro perpendicolare a 800 mm dal vano: il punto interno standard cadrebbe nel muro
  const conTramezzo = {
    ...progetto,
    walls: [...progetto.walls, { id: "m2", a: [1450, 600], b: [1450, 3000], t: 200, kind: "tramezzo" }],
  };
  const p = posizioneIniziale(conTramezzo);
  const obst = ostacoli(conTramezzo, {});
  for (const o of obst) {
    assert.ok(distanzaPuntoSegmento(p.pos, o.a, o.b) >= 250 + o.r - 1e-9, `dentro ostacolo ${o.tipo} ${o.id}`);
  }
});

test("anta: non si apre sopra chi sta passando davanti al vano", () => {
  let stato = statoPasseggiata(progetto);
  const g = geometriaPorta(progetto.openings[0], progetto.walls[0]);
  // fermo a 800 mm dal vano, dal lato in cui l'anta si aprirebbe
  stato = { ...stato, pos: [g.centro[0] + g.n[0] * 800, g.centro[1] + g.n[1] * 800] };
  for (let i = 0; i < 300; i++) stato = aggiornaPasseggiata(stato, {}, 0.05, progetto);
  const theta = stato.angoli.p1 ?? 0;
  const fine = [g.cerniera[0] + direzioneAnta(g, theta)[0] * g.larghezza, g.cerniera[1] + direzioneAnta(g, theta)[1] * g.larghezza];
  assert.ok(distanzaPuntoSegmento(stato.pos, g.cerniera, fine) >= 250 + 20 - 1e-6, `anta sul corpo: theta=${theta}`);
});

test("sguardo di partenza: guarda verso lo spazio libero, non verso un muro vicino", () => {
  const p = posizioneIniziale(progetto);
  const obst = ostacoli(progetto, {});
  const d = vettoreSguardo(p.yaw, 0);
  // la distanza libera nella direzione scelta deve essere almeno quella di un passo di camminata
  let libero = 0;
  for (let k = 50; k <= 2000; k += 50) {
    const q = [p.pos[0] + d[0] * k, p.pos[1] + d[1] * k];
    if (obst.some((o) => distanzaPuntoSegmento(q, o.a, o.b) < o.r + 30)) break;
    libero = k;
  }
  assert.ok(libero >= 1000, `sguardo verso un muro a ${libero} mm`);
});
