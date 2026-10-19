// Back-test del bilancio mensile sulla relazione Blumatica di Roma (UNI/TS 11300-1, dati UNI 10349:2016).
// Valori della relazione: tests/fixtures/relazione-blumatica-roma-uni10349.txt (zona ZH1 riscaldamento, ZC1 raffrescamento).
import { test } from "node:test";
import assert from "node:assert/strict";
import { bilancioMensile, flussoSolareMensile_W, fattoreUtilizzazioneRiscaldamento } from "../src/core/mensile.js";
import { irradianzaMedia_W_m2 } from "../src/core/clima.js";

const vicino = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} invece di ${b} (tolleranza ${tol})`);

// Flussi solari delle 6 finestre della zona ZH1 (W), gennaio..dicembre, come stampati nella relazione
const FLUSSI = [
  [88.9, 118.3, 172.1, 258.9, 344.9, 424.0, 421.3, 314.5, 223.7, 158.8, 101.2, 85.8],
  [90.3, 119.0, 162.3, 218.4, 239.3, 274.2, 295.0, 253.0, 199.9, 148.4, 104.5, 88.1],
  [314.0, 314.8, 297.8, 247.9, 206.8, 206.9, 216.4, 238.1, 294.6, 335.6, 305.1, 325.9],
  [85.5, 122.6, 160.1, 209.6, 231.8, 265.4, 293.6, 249.4, 194.4, 140.5, 91.5, 85.2],
  [26.7, 35.5, 51.6, 77.7, 103.5, 127.2, 126.4, 94.4, 67.1, 47.6, 30.4, 25.8],
  [55.3, 58.2, 56.4, 51.6, 45.6, 47.2, 50.1, 51.7, 57.6, 62.0, 54.1, 57.1],
];
const SOLARI_W = Array.from({ length: 12 }, (_, m) => FLUSSI.reduce((s, f) => s + f[m], 0));
// Area solare equivalente mensile Asol,w (m2) e orientamento delle finestre senza ombreggiamento esterno
const ASOL = {
  1: { o: "N", A: [3.784, 3.784, 3.784, 3.738, 3.587, 3.490, 3.490, 3.654, 3.776, 3.780, 3.784, 3.784] },
  2: { o: "O", A: [1.561, 1.509, 1.480, 1.500, 1.493, 1.464, 1.431, 1.437, 1.458, 1.483, 1.646, 1.544] },
  4: { o: "E", A: [1.479, 1.555, 1.460, 1.439, 1.446, 1.417, 1.424, 1.417, 1.418, 1.404, 1.440, 1.493] },
  5: { o: "N", A: [1.135, 1.135, 1.135, 1.121, 1.076, 1.047, 1.047, 1.096, 1.133, 1.134, 1.135, 1.135] },
  6: { o: "S", A: [0.441, 0.427, 0.405, 0.389, 0.388, 0.390, 0.378, 0.369, 0.389, 0.411, 0.432, 0.432] },
};

test("Dati UNI 10349 di Roma: flusso solare = Asol x irradianza media mensile (5 finestre x 12 mesi)", () => {
  for (const [n, f] of Object.entries(ASOL)) {
    const calc = flussoSolareMensile_W({ orientamento: f.o, Asol_m2: f.A });
    // tolleranza: arrotondamento dei valori stampati (Asol a 3 decimali, irradiazione a 2 decimali in MJ)
    calc.forEach((w, m) => vicino(w, FLUSSI[n - 1][m], Math.max(0.15, 0.002 * w), `finestra ${n} mese ${m + 1}`));
  }
  vicino(irradianzaMedia_W_m2("N", 0), 2.03e6 / 86400, 1e-9, "irradianza N gennaio");
});

test("Riscaldamento ZH1: mesi pieni identici alla relazione (gen, feb, mar, dic)", () => {
  const ore = [744, 672, 744, 192, 0, 0, 0, 0, 0, 0, 672, 744];
  const r = bilancioMensile({
    modo: "riscaldamento", H_ve_W_K: 32.3, interni_W: 450.7, solari_W: SOLARI_W, tau_h: 18.07, ore,
    trasmissione_kWh: [1652, 1352, 1138, 183, 0, 0, 0, 0, 0, 0, 908, 1565],
    extraflusso_kWh: [63, 80, 80, 24, 0, 0, 0, 0, 0, 0, 76, 69],
  });
  vicino(r.a, 2.20, 0.01, "alpha H");
  vicino(r.gammaLim, 1.45, 0.01, "gamma limite");
  const attesi = { 0: [286, 335, 492, 0.91, 1248], 1: [237, 303, 516, 0.88, 946], 2: [204, 335, 670, 0.80, 622], 11: [272, 335, 497, 0.90, 1155] };
  for (const [m, [ve, int, sol, eta, qnd]] of Object.entries(attesi)) {
    const x = r.mesi[m];
    vicino(x.Q_ve_kWh, ve, 0.6, `ventilazione mese ${+m + 1}`);
    vicino(x.Q_int_kWh, int, 0.6, `interni mese ${+m + 1}`);
    vicino(x.Q_sol_kWh, sol, 0.6, `solari mese ${+m + 1}`);
    vicino(x.eta, eta, 0.006, `eta mese ${+m + 1}`);
    vicino(x.Q_nd_kWh, qnd, 1.5, `fabbisogno mese ${+m + 1}`);
  }
});

test("Riscaldamento ZH1: mesi parziali (apr, nov) con temperatura e sole dei soli giorni attivi", () => {
  // Nei mesi parziali la relazione usa temperatura e irradiazione dei soli giorni di accensione (dato giornaliero),
  // non la media del mese. Le ricaviamo dai valori stampati (ventilazione 35 e 161 kWh, solari 191 e 475 kWh).
  // Il motore da solo non le calcola: lo segnala tra i dati mancanti (durata reale della stagione).
  const thetaE = [8.1, 9.1, 11.5, 20 - 35 / (32.3 * 0.192), 19.2, 22.6, 26.4, 26.6, 21.7, 17.8, 20 - 161 / (32.3 * 0.672), 8.7];
  const solari = SOLARI_W.slice();
  solari[3] = (191 * 1000) / 192;
  solari[10] = (475 * 1000) / 672;
  const r = bilancioMensile({
    modo: "riscaldamento", H_ve_W_K: 32.3, interni_W: 450.7, solari_W: solari, tau_h: 18.07, thetaE_C: thetaE,
    ore: [744, 672, 744, 192, 0, 0, 0, 0, 0, 0, 672, 744],
    trasmissione_kWh: [1652, 1352, 1138, 183, 0, 0, 0, 0, 0, 0, 908, 1565],
    extraflusso_kWh: [63, 80, 80, 24, 0, 0, 0, 0, 0, 0, 76, 69],
  });
  vicino(r.mesi[3].eta, 0.64, 0.006, "eta aprile");
  vicino(r.mesi[3].Q_nd_kWh, 65, 1.5, "aprile");
  vicino(r.mesi[10].eta, 0.81, 0.006, "eta novembre");
  vicino(r.mesi[10].Q_nd_kWh, 517, 1.5, "novembre");
  vicino(r.Q_nd_totale_kWh, 4552, 4, "totale annuo");
});

test("Raffrescamento ZC1: mesi pieni identici alla relazione (giu, lug, ago, set)", () => {
  const r = bilancioMensile({
    modo: "raffrescamento", H_ve_W_K: 32.3, interni_W: 450.7, solari_W: SOLARI_W, tau_h: 18.07, Aw_m2: 24.15, Af_m2: 107.7,
    ore: [0, 0, 0, 0, 672, 720, 744, 744, 720, 120, 0, 0],
    trasmissione_kWh: [0, 0, 0, 0, 747, 354, -188, -199, 505, 140, 0, 0],
    extraflusso_kWh: [0, 0, 0, 0, 100, 104, 135, 117, 100, 15, 0, 0],
  });
  vicino(r.a, 6.25, 0.01, "alpha C");
  const attesi = { 5: [79, 0.997, 758], 6: [-10, 1.0, 1441], 7: [-14, 1.0, 1325], 8: [100, 0.97, 385] };
  for (const [m, [ve, eta, qnd]] of Object.entries(attesi)) {
    const x = r.mesi[m];
    vicino(x.Q_ve_kWh, ve, 0.6, `ventilazione mese ${+m + 1}`);
    vicino(x.eta, eta, 0.006, `eta mese ${+m + 1}`);
    vicino(x.Q_nd_kWh, qnd, 2, `fabbisogno mese ${+m + 1}`);
  }
});

test("Fattore di utilizzazione: casi limite", () => {
  vicino(fattoreUtilizzazioneRiscaldamento(1, 2), 2 / 3, 1e-12, "gamma = 1");
  assert.equal(fattoreUtilizzazioneRiscaldamento(0, 2), 1);
  assert.ok(fattoreUtilizzazioneRiscaldamento(5, 2) < 0.25);
});

test("Senza ore, terreno ed extraflusso il bilancio dichiara cosa manca", () => {
  const r = bilancioMensile({ modo: "riscaldamento", H_tr_W_K: 100, H_ve_W_K: 30, interni_W: 400, solari_W: Array(12).fill(300), tau_h: 20 });
  assert.equal(r.mancanti.length, 3);
});
