// Dati climatici di ROMA. Nessuna chiamata di rete: i valori sono scritti qui, con la loro fonte.
//
// 1) UNI 10349:2016 (dato di legge per i calcoli energetici). La norma è a pagamento: i valori sono quelli
//    stampati nella relazione tecnica di esempio Blumatica (ubicazione Roma, 20 m s.l.m., zona D), che dichiara
//    "dati desunti e/o calcolati in accordo alla UNI 10349:2016 parti 1, 2 e 3". Copia del testo in
//    tests/fixtures/relazione-blumatica-roma-uni10349.txt. Stato: dato UNI riportato da software terzo, non letto
//    sulla norma: da confermare con la UNI 10349-1 per un progetto da depositare.
// 2) PVGIS-SARAH3 (JRC, serie oraria 2015-2019): usato SOLO dove la UNI non è disponibile qui
//    (picco estivo orario, resa fotovoltaica). È una stima, non un dato di legge.
// Per altre località servono i dati UNI 10349 del comune (vedi la scheda Affidabilità).

const ORIENTAMENTI = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
export const GIORNI_MESE = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const UNI10349_ROMA = {
  fonte: "UNI 10349:2016 parti 1-3, valori riportati nella relazione tecnica di esempio Blumatica (Roma, 20 m s.l.m.)",
  stato: "dato UNI riportato da software terzo",
  zona: "D",
  gradiGiorno: 1415,
  thetaProgettoInverno_C: 0.0,
  thetaProgettoEstate_C: 33.8,
  // temperatura media mensile dell'aria esterna, gennaio..dicembre (C)
  thetaE_C: [8.1, 9.1, 11.5, 15.9, 19.2, 22.6, 26.4, 26.6, 21.7, 17.8, 12.7, 8.7],
  // irradiazione solare giornaliera media mensile (MJ/m2 al giorno), gennaio..dicembre
  irradiazione_MJ_m2_giorno: {
    S: [10.83, 11.78, 12.04, 11.47, 10.15, 10.45, 11.45, 12.12, 12.81, 13.04, 10.81, 11.40],
    SE: [8.53, 9.96, 11.60, 13.04, 12.68, 13.81, 15.40, 14.79, 13.39, 11.61, 8.74, 8.84],
    E: [5.00, 6.81, 9.47, 12.58, 13.85, 16.18, 17.81, 15.21, 11.85, 8.64, 5.49, 4.93],
    NE: [2.31, 3.53, 5.87, 9.17, 11.39, 13.85, 14.68, 11.47, 7.95, 4.95, 2.72, 2.17],
    N: [2.03, 2.70, 3.93, 5.99, 8.31, 10.50, 10.43, 7.44, 5.12, 3.63, 2.31, 1.96],
    NO: [2.31, 3.53, 5.87, 9.17, 11.39, 13.85, 14.68, 11.47, 7.95, 4.95, 2.72, 2.17],
    O: [5.00, 6.81, 9.47, 12.58, 13.85, 16.18, 17.81, 15.21, 11.85, 8.64, 5.49, 4.93],
    SO: [8.53, 9.96, 11.60, 13.04, 12.68, 13.81, 15.40, 14.79, 13.39, 11.61, 8.74, 8.84],
    Oriz: [6.30, 9.00, 13.30, 18.70, 21.50, 25.50, 27.70, 22.90, 17.10, 11.80, 7.10, 6.10],
  },
};

// Irradianza media mensile (W/m2) = irradiazione giornaliera (MJ/m2) / 86400 s
export function irradianzaMedia_W_m2(orientamento, mese, dati = UNI10349_ROMA) {
  const H = dati.irradiazione_MJ_m2_giorno[orientamento];
  if (!H) return null;
  return (H[mese] * 1e6) / 86400;
}

// Media annua dell'irradianza sul piano orizzontale (W/m2), pesata sui giorni di ogni mese
export function irradianzaMediaAnnuaOrizzontale_W_m2(dati = UNI10349_ROMA) {
  const H = dati.irradiazione_MJ_m2_giorno.Oriz;
  const MJ = H.reduce((s, h, m) => s + h * GIORNI_MESE[m], 0);
  return (MJ * 1e6) / (365 * 86400);
}

// Irradiazione nella stagione di riscaldamento (kWh/m2). Zona D: 1 novembre - 15 aprile (DPR 412/93).
export const STAGIONE_ZONA_D_GIORNI = [31, 28, 31, 15, 0, 0, 0, 0, 0, 0, 30, 31];
export function irradiazioneStagione_kWh_m2(orientamento, giorni = STAGIONE_ZONA_D_GIORNI, dati = UNI10349_ROMA) {
  const H = dati.irradiazione_MJ_m2_giorno[orientamento];
  if (!H) return null;
  return H.reduce((s, h, m) => s + h * giorni[m], 0) / 3.6;
}

export const PVGIS_ROMA = {
  fonte: "PVGIS-SARAH3 (JRC) 2015-2019, serie oraria (stima, non dato di legge)",
  // W/m2, 99° percentile orario giugno-agosto su piano verticale: picco di progetto per il carico estivo
  estatePicco_W_m2: { N: 220, NE: 606, E: 782, SE: 704, S: 593, SO: 700, O: 777, NO: 605 },
  // kWh/kWp anno, impianto fotovoltaico a 36 gradi, perdite di sistema 14 % (PVGIS PVcalc)
  resaFV_kWh_kWp: { N: 735.9, NE: 877.6, E: 1177.3, SE: 1410.6, S: 1492.3, SO: 1390.3, O: 1150.4, NO: 859.5 },
  // kWh/m2 anno su piano a 36 gradi esposto a sud: base del solare termico
  inclinatoS36_kWh_m2: 1926.4,
};

// Compatibilità: vista unica usata dai motori
export const CLIMA_ROMA = {
  localita: "Roma",
  gradiGiorno: UNI10349_ROMA.gradiGiorno,
  invernoVerticale_kWh_m2: Object.fromEntries(ORIENTAMENTI.map((o) => [o, irradiazioneStagione_kWh_m2(o)])),
  estatePicco_W_m2: PVGIS_ROMA.estatePicco_W_m2,
  resaFV_kWh_kWp: PVGIS_ROMA.resaFV_kWh_kWp,
};
export const INCLINATO_S36_KWH_M2 = PVGIS_ROMA.inclinatoS36_kWh_m2;
