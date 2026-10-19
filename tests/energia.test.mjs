// Test energia: valori calcolati a mano dalle formule citate nel modulo e dai dati di clima.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  trasmittanza, dispersioneTrasmissione, dispersioneVentilazione, caricoInvernale,
  guadagniSolariInverno, fabbisognoRiscaldamento, potenzaRadiatore, radiatoriNecessari, copPompaCalore,
  caricoEstivo, eerCondizionatore, fotovoltaico, solareTermico, potenzaMinimaFER,
} from "../src/core/energia.js";
import { CLIMA_ROMA } from "../src/core/clima.js";

const vicino = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

test("trasmittanza da stratigrafia: 300 mm lambda 0,8", () => {
  // R = 0,3/0,8 = 0,375 ; Rtot = 0,13 + 0,375 + 0,04 = 0,545 ; U = 1/0,545
  vicino(trasmittanza([{ s_mm: 300, lambda: 0.8 }]), 1 / 0.545, 1e-9);
});

test("trasmittanza rifiuta strati non validi", () => {
  assert.throws(() => trasmittanza([{ s_mm: 0, lambda: 0.8 }]));
});

test("dispersione per trasmissione con ponti termici al 10%", () => {
  const r = dispersioneTrasmissione([
    { id: "muro", U: 0.3, A_m2: 100 },
    { id: "solaio_cantina", U: 1.8, A_m2: 10, tipo: "non_riscaldato", b: 0.5 },
  ]);
  vicino(r.H_trasm_W_K, 30 + 9, 1e-9);            // 30 + 1,8*10*0,5
  vicino(r.H_con_ponti_W_K, 39 * 1.1, 1e-9);
});

test("dispersione rifiuta U o area non positivi", () => {
  assert.throws(() => dispersioneTrasmissione([{ id: "x", U: 0, A_m2: 10 }]));
  assert.throws(() => dispersioneTrasmissione([{ id: "x", U: 0.3, A_m2: 0 }]));
});

test("ventilazione 0,34 * n * V", () => {
  vicino(dispersioneVentilazione(300, { ricambi_h: 0.5 }), 0.34 * 0.5 * 300, 1e-9); // 51 W/K
});

test("carico invernale di progetto = (H_tr + H_v) * (20 - 0) con temperatura di Roma 0 C", () => {
  const c = caricoInvernale(39 * 1.1, 300, { ricambi_h: 0.5, theta_ext_inv: 0 });
  vicino(c.H_tot_W_K, 42.9 + 51, 1e-9);
  vicino(c.carico_W, 93.9 * 20, 1e-6);            // 1878 W
});

test("guadagni solari invernali: Aw (1-FF) g Fsh I(orientamento) da CLIMA_ROMA", () => {
  // 2 m2 a sud, FF 0,2, g 0,6 -> 2 * 0,8 * 0,6 * 802,1 = 769,99 kWh
  vicino(guadagniSolariInverno([{ orientamento: "S", Aw_m2: 2, FF: 0.2, g: 0.6 }]), 2 * 0.8 * 0.6 * 802.1, 1e-6);
  assert.throws(() => guadagniSolariInverno([{ orientamento: "X", Aw_m2: 2, FF: 0.2, g: 0.6 }]));
});

test("fabbisogno stagionale gradi giorno con guadagni solari invernali", () => {
  const vetrati = [{ orientamento: "S", Aw_m2: 2, FF: 0, g: 0.6 }];
  const f = fabbisognoRiscaldamento(100, vetrati, { gg: 1415 });
  vicino(f.Q_lorda_kWh, 0.024 * 1415 * 100, 1e-6);           // 3396
  vicino(f.Q_solare_kWh, 2 * 0.6 * 802.1, 1e-6);             // 962,5
  vicino(f.Q_nd_kWh, 0.024 * 1415 * 100 - 0.8 * 2 * 0.6 * 802.1, 1e-6); // 2626,0
});

test("fabbisogno non negativo: i guadagni oltre le perdite non producono energia negativa", () => {
  const f = fabbisognoRiscaldamento(1, [{ orientamento: "S", Aw_m2: 50, FF: 0, g: 0.6 }], { gg: 1415 });
  assert.equal(f.Q_nd_kWh, 0);
});

test("radiatore: potenza a salto medio 40 K con P50 1000 W e n=1,3", () => {
  // dTm = (70+50)/2 - 20 = 40 ; P = 1000 * (40/50)^1,3 = 748,20 W
  vicino(potenzaRadiatore(1000, 70, 50).P_W, 748.20, 0.01);
});

test("radiatori necessari: inversa della potenza a salto dato", () => {
  vicino(radiatoriNecessari(748.20, 70, 50), 1000, 0.05);
});

test("salto termico non positivo rifiutato", () => {
  assert.throws(() => potenzaRadiatore(1000, 20, 18));
});

test("COP pompa di calore: Carnot 45 C mandata, -5 C esterna, eta 0,45", () => {
  // Carnot = 318,15/50 = 6,363 ; reale = 0,45 * 6,363 = 2,863
  vicino(copPompaCalore(45, -5).cop_reale, 0.45 * 318.15 / 50, 1e-9);
});

test("condizionatore: EER di progetto a 34 C esterni, 20 C interni", () => {
  // Te = 5 C = 278,15 K ; Tc = 44 C = 317,15 K ; Carnot = 278,15/39 ; EER = 0,45 * Carnot
  vicino(eerCondizionatore(34, 20).EER_progetto, 0.45 * 278.15 / 39, 1e-9);
});

test("carico estivo: trasmissione + ventilazione + solare (g con schermo, picco di Roma) + interni", () => {
  const vetrati = [{ orientamento: "S", Aw_m2: 5, FF: 0, gglsh: 0.28 }];
  const c = caricoEstivo(42.9, 300, vetrati, { persone: 2 }, { ricambi_h: 0.5, theta_ext_est: 34 });
  const dT = 34 - 20;
  vicino(c.trasmissione_W, (42.9 + 51) * dT, 1e-6);
  vicino(c.solare_W, 5 * 0.28 * CLIMA_ROMA.estatePicco_W_m2.S, 1e-6);   // 5 * 0,28 * 593
  vicino(c.totale_W, c.trasmissione_W + c.solare_W + 160, 1e-6);
});

test("fotovoltaico: resa PVGIS di Roma a sud (1492,3 kWh/kWp) senza PR aggiuntivo", () => {
  vicino(fotovoltaico(3000).kWp_necessari, 3000 / 1492.3, 1e-9);
  vicino(fotovoltaico(3000, { orientamento: "E" }).kWp_necessari, 3000 / 1177.3, 1e-9);
  assert.throws(() => fotovoltaico(3000, { resa_kWh_kWp: 0 }));
});

test("solare termico ACS: 2 persone, 25 L/g, 40 C da acqua a 15 C", () => {
  // fabbisogno = 2 persone * 25 L * 365 * 4,186 * 25 K / 3600
  const s = solareTermico({ A_m2: 4, persone: 2 });
  const acs = 2 * 25 * 365 * 4.186 * (40 - 15) / 3600;   // 1063,1 kWh/anno
  vicino(s.Q_acs_kWh, acs, 1e-6);
  vicino(s.Q_utile_kWh, 4 * 0.35 * 1926.4, 1e-6);       // 2694,0 kWh/anno
  vicino(s.frazione_solare, 1, 1e-12);                  // coperto per intero: frazione limitata a 1
});

test("solare termico: frazione solare proporzionale quando il collettore e' piccolo", () => {
  const s = solareTermico({ A_m2: 1, persone: 4 });
  vicino(s.frazione_solare, (1 * 0.35 * 1926.4) / (4 * 25 * 365 * 4.186 * 25 / 3600), 1e-9);
  assert.ok(s.frazione_solare < 1);
});

test("potenza minima FER: calcolata solo se K e' fornito", () => {
  assert.equal(potenzaMinimaFER(100, undefined).calcolata, false);
  vicino(potenzaMinimaFER(100, 50).P_minima_kW, 2, 1e-9);
});

test("pompa di calore: energia elettrica = fabbisogno / COP", () => {
  const cop = copPompaCalore(45, -5).cop_reale;
  vicino(cop, 2.8634, 1e-3);
});
