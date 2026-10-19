// Fattore di correzione per l'irraggiamento incidente Fsol,est (DM 26/06/2015, App. A, par. 2.2):
//   Fsol,est = irradianza media di LUGLIO sull'esposizione / irradianza media ANNUA di Roma sul piano orizzontale.
//
// ATTENZIONE: non e' la tabella UNI/TS 11300-1 (testo a pagamento, non reperibile). Valori DERIVATI da
// PVGIS-SARAH3 (JRC, serie oraria 2015-2019, Roma 41,9 N / 12,5 E), piano verticale per orientamento.
// Vanno confermati con la tabella ufficiale prima di un uso per la verifica di legge.
// Stesso mese, stessa media oraria: il rapporto tra medie orarie coincide con quello tra irradiazioni mensili.

export const IRRAGGIAMENTO_ROMA_W_M2 = {
  fonte: "PVGIS-SARAH3 (JRC) 2015-2019, medie orarie G(i)",
  annuoOrizzontale: 188.24,
  // luglio sul piano verticale per orientamento (W/m2)
  luglioVerticale: { N: 61.93, NE: 116.51, E: 167.97, SE: 161.98, S: 129.95, SO: 162.38, O: 167.10, NO: 119.42 },
  luglioOrizzontale: 317.75,
};

// Fsol,est per orientamento (adimensionale)
export function fsolEst(orientamento) {
  const v = IRRAGGIAMENTO_ROMA_W_M2.luglioVerticale[orientamento];
  if (v === undefined) return null;
  return v / IRRAGGIAMENTO_ROMA_W_M2.annuoOrizzontale;
}
