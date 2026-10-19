// Dati climatici di ROMA (41,9 N / 12,5 E) precalcolati da PVGIS-SARAH3 (JRC), serie oraria 2015-2019,
// su piano verticale per orientamento e su piano orizzontale. Nessuna chiamata di rete a runtime: i valori sono qui.
// Non sostituiscono la UNI 10349 / UNI TS 11300-1 ufficiali: sono una fonte misurata e dichiarata, da confermare.
// Per altre localita' l'utente inserisce i propri dati (vedi src/ui/energia-ui.js).
export const CLIMA_ROMA = {
  localita: "Roma",
  fonte: "PVGIS-SARAH3 (JRC) 2015-2019, medie di serie oraria",
  // kWh/m2 anno, piano orizzontale
  orizzontaleAnnuo_kWh_m2: 1649.8,
  // kWh/m2 nella stagione di riscaldamento (ottobre-aprile), piano verticale
  invernoVerticale_kWh_m2: { N: 122.1, NE: 185.1, E: 415.6, SE: 675.6, S: 802.1, SO: 649.6, O: 393.8, NO: 181.6 },
  // W/m2, 99° percentile oraria giugno-agosto su piano verticale: picco di progetto per il carico estivo
  estatePicco_W_m2: { N: 220, NE: 606, E: 782, SE: 704, S: 593, SO: 700, O: 777, NO: 605 },
  // W/m2, media di luglio su piano verticale (dati per il calcolo Fsol,est, vedi src/core/fsol.js)
  luglioVerticale_W_m2: { N: 61.93, NE: 116.51, E: 167.97, SE: 161.98, S: 129.95, SO: 162.38, O: 167.10, NO: 119.42 },
  // kWh/kWp anno, impianto fotovoltaico con inclinazione 36 gradi, perdite di sistema 14 % (PVGIS PVcalc)
  resaFV_kWh_kWp: { N: 735.9, NE: 877.6, E: 1177.3, SE: 1410.6, S: 1492.3, SO: 1390.3, O: 1150.4, NO: 859.5 },
  // gradi giorno DPR 412/93, zona D (valore riportato anche dalla relazione tecnica di esempio ACCA, Roma)
  gradiGiorno: 1415,
};
// kWh/m2 anno su piano a 36 gradi esposto a sud (PVGIS PVcalc, Roma): base per il solare termico.
export const INCLINATO_S36_KWH_M2 = 1926.4;
