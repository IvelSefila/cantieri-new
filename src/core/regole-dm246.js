// Regole DM 246/1987 + DM 25/01/2019 (punto 9-bis). Copia di rules/dm246_gsa.json: un test verifica che coincidano.
// Stato: IN ATTESA DI APPROVAZIONE (vedi docs/rules_extraction_report.md). Il motore lo dichiara in ogni output.
export const REGOLE_DM246 = {
  versione_regole: "dm246-gsa@2026-10-19",
  stato: "in_attesa_approvazione",
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
};
