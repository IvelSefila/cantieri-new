// Regole DM 246/1987 + DM 25/01/2019 (punto 9-bis) + DM 30/11/1983 p. 1.1 + DPR 151/2011 all. I (74, 49, 75, 77).
// Copia di rules/dm246_gsa.json: un test verifica che coincidano.
// Stato: DM 246/1987 e DM 25/1/2019 APPROVATI (R1-R7); DM 1983 e DPR 151/2011 estratti, IN ATTESA DI APPROVAZIONE (R8-R11).
export const REGOLE_DM246 = {
  versione_regole: "dm246-gsa@2026-10-19",
  stato: "approvata",
  tipi: [
    { id: "a", da_mm: 12000, a_mm: 24000, lp_base: 0 },
    { id: "b", da_mm: 24000, a_mm: 32000, lp_base: 1 },
    { id: "c", da_mm: 32000, a_mm: 54000, lp_base: 1 },
    { id: "d", da_mm: 54000, a_mm: 80000, lp_base: 2 },
    { id: "e", da_mm: 80000, a_mm: null, lp_base: 3 },
  ],
  limite_campo_mm: 12000,
  incremento: { soglia_h_mm: 24000, tetto_lp: 3, passi: 1 },
  soglie_prossimita_mm: [12000, 24000, 32000, 54000, 80000],
  tolleranza_prossimita_mm: 300,
  tolleranza_incoerenza_mm: 500,
  dpr151: {
    stato: "estratta_in_attesa_approvazione",
    "77": {
      soglia_h_mm: 24000,
      classi: [
        { classe: "A", fino_a_mm: 32000 },
        { classe: "B", oltre_mm: 32000, fino_a_mm: 54000 },
        { classe: "C", oltre_mm: 54000 },
      ],
    },
    "74": {
      soglia_kw: 116,
      classi: [
        { classe: "A", fino_a_kw: 350 },
        { classe: "B", oltre_kw: 350, fino_a_kw: 700 },
        { classe: "C", oltre_kw: 700 },
      ],
    },
    "49": {
      soglia_kw: 25,
      classi: [
        { classe: "A", fino_a_kw: 350 },
        { classe: "B", oltre_kw: 350, fino_a_kw: 700 },
        { classe: "C", oltre_kw: 700 },
      ],
    },
    "75": { soglia_m2: 300 },
  },
};
