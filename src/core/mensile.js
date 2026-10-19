// Bilancio energetico MENSILE dell'involucro (metodo quasi stazionario della UNI/TS 11300-1, da UNI EN ISO 13790).
// Formule lette sul testo UNI/TS 11300-1:2008 par. 15.1 (fattori di utilizzazione) e confermate dal back-test
// sulla relazione Blumatica di Roma (tests/mensile.test.mjs), calcolata con la UNI/TS 11300-1 vigente.
//
//   Riscaldamento: Q_H,nd = Q_H,ht - eta_H,gn * Q_gn          Q_H,ht = Q_tr + Q_extraflusso + Q_ve
//     gamma_H = Q_gn / Q_H,ht ; a_H = a_H,0 + tau / tau_H,0 (a_H,0 = 1, tau_H,0 = 15 h)
//     eta = (1 - gamma^a) / (1 - gamma^(a+1)) ; se gamma = 1: a / (a+1)
//   Raffrescamento: Q_C,nd = Q_gn - eta_C,ls * Q_C,ht
//     gamma_C = Q_gn / Q_C,ht ; a_C = a_C,0 + tau / tau_C,0 - k * Aw / Af (a_C,0 = 8,1 ; tau_C,0 = 17 h ; k = 13)
//     eta = (1 - gamma^-a) / (1 - gamma^-(a+1)) ; gamma = 1: a / (a+1) ; gamma < 0: 1
//
// Quello che il motore NON calcola da solo, e che va fornito (altrimenti il risultato è segnato come stima):
//   - la durata reale della stagione (ore attive per mese): la UNI/TS 11300-1 vigente la ricava dal bilancio;
//     qui si usano le ore inserite oppure la stagione di legge della zona climatica;
//   - lo scambio verso il terreno (UNI EN ISO 13370) e l'extraflusso verso la volta celeste.
import { UNI10349_ROMA, GIORNI_MESE, irradianzaMedia_W_m2 } from "./clima.js";

export function fattoreUtilizzazioneRiscaldamento(gamma, a) {
  if (gamma <= 0) return 1;
  if (Math.abs(gamma - 1) < 1e-12) return a / (a + 1);
  return (1 - gamma ** a) / (1 - gamma ** (a + 1));
}

export function fattoreUtilizzazioneRaffrescamento(gamma, a) {
  if (gamma < 0) return 1;
  if (Math.abs(gamma - 1) < 1e-12) return a / (a + 1);
  return (1 - gamma ** -a) / (1 - gamma ** -(a + 1));
}

export const PARAMETRI_DINAMICI = { aH0: 1, tauH0_h: 15, aC0: 8.1, tauC0_h: 17, k: 13 };

// Flusso solare medio mensile di un componente vetrato (W): Fsh,ob x Asol x I_sol(orientamento, mese)
export function flussoSolareMensile_W({ orientamento, Asol_m2, Fsh_ob = 1 }, dati = UNI10349_ROMA) {
  return Array.from({ length: 12 }, (_, m) => {
    const A = Array.isArray(Asol_m2) ? Asol_m2[m] : Asol_m2;
    const F = Array.isArray(Fsh_ob) ? Fsh_ob[m] : Fsh_ob;
    return F * A * irradianzaMedia_W_m2(orientamento, m, dati);
  });
}

const ORE_PIENE = GIORNI_MESE.map((g) => g * 24);

// p: {
//   modo: "riscaldamento" | "raffrescamento",
//   H_tr_W_K, H_ve_W_K, theta_i_C (20 / 26), thetaE_C[12] (default UNI 10349 Roma),
//   ore[12] ore attive per mese, interni_W (costante), solari_W[12],
//   trasmissione_kWh[12] (opzionale: sostituisce H_tr x dT x t, per esempio con il terreno già calcolato),
//   extraflusso_kWh[12] (opzionale), tau_h, Aw_m2 e Af_m2 (solo raffrescamento) }
export function bilancioMensile(p) {
  const modo = p.modo ?? "riscaldamento";
  const thetaE = p.thetaE_C ?? UNI10349_ROMA.thetaE_C;
  const thetaI = p.theta_i_C ?? (modo === "riscaldamento" ? 20 : 26);
  const ore = p.ore ?? ORE_PIENE;
  const k = PARAMETRI_DINAMICI;
  const a = modo === "riscaldamento"
    ? k.aH0 + p.tau_h / k.tauH0_h
    : k.aC0 + p.tau_h / k.tauC0_h - k.k * (p.Aw_m2 / p.Af_m2);
  const mesi = [];
  for (let m = 0; m < 12; m++) {
    const h = ore[m];
    if (!h) { mesi.push({ mese: m + 1, ore: 0, Q_nd_kWh: 0 }); continue; }
    const dT = thetaI - thetaE[m];
    const Q_tr = p.trasmissione_kWh ? p.trasmissione_kWh[m] : (p.H_tr_W_K * dT * h) / 1000;
    const Q_ex = p.extraflusso_kWh ? p.extraflusso_kWh[m] : 0;
    const Q_ve = (p.H_ve_W_K * dT * h) / 1000;
    const Q_ht = Q_tr + Q_ex + Q_ve;
    const Q_int = ((p.interni_W ?? 0) * h) / 1000;
    const Q_sol = ((p.solari_W?.[m] ?? 0) * h) / 1000;
    const Q_gn = Q_int + Q_sol;
    const gamma = Q_gn / Q_ht;
    let eta, Q_nd;
    if (modo === "riscaldamento") {
      eta = fattoreUtilizzazioneRiscaldamento(gamma, a);
      Q_nd = Math.max(0, Q_ht - eta * Q_gn);
    } else {
      eta = fattoreUtilizzazioneRaffrescamento(gamma, a);
      Q_nd = Math.max(0, Q_gn - eta * Q_ht);
    }
    mesi.push({ mese: m + 1, ore: h, Q_tr_kWh: Q_tr, Q_extra_kWh: Q_ex, Q_ve_kWh: Q_ve, Q_ht_kWh: Q_ht, Q_int_kWh: Q_int, Q_sol_kWh: Q_sol, Q_gn_kWh: Q_gn, gamma, eta, Q_nd_kWh: Q_nd });
  }
  const mancanti = [];
  if (!p.ore) mancanti.push("ore attive per mese (durata reale della stagione secondo UNI/TS 11300-1)");
  if (!p.trasmissione_kWh) mancanti.push("scambio verso il terreno (UNI EN ISO 13370), se ci sono pavimenti controterra");
  if (!p.extraflusso_kWh) mancanti.push("extraflusso verso la volta celeste (UNI/TS 11300-1)");
  return {
    modo, a, gammaLim: (a + 1) / a, mesi,
    Q_nd_totale_kWh: mesi.reduce((s, x) => s + x.Q_nd_kWh, 0),
    mancanti,
  };
}

// Ore attive della stagione di legge (zona D: 1 novembre - 15 aprile) da usare se non si conosce la stagione reale.
export const ORE_STAGIONE_ZONA_D = [31, 28, 31, 15, 0, 0, 0, 0, 0, 0, 30, 31].map((g) => g * 24);
