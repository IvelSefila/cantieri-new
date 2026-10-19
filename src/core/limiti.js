// Limiti di legge del DM 26/06/2015 come aggiornato dal DM 28/10/2025 (GU n. 283 del 5/12/2025, in vigore dal 3/6/2026).
// H'T = Htr,adj / somma(Ak) [W/m2K], superfici esterne lorde (Allegato 1, par. 3.3).
// Tabella 10: nuove costruzioni e demolizioni/ricostruzioni, per zona e rapporto di forma S/V.
// Tabella 11: ristrutturazioni importanti di primo livello, per zona e rapporto vetrato EX ANTE (9 %..100 %).
// Asol,est/Asup utile (Tabella 12): E.1 < 0,030, altri edifici < 0,040 (in gsa.js).

export const TAB10_HT = {
  // colonne: S/V < 0,4 ; 0,4 <= S/V < 0,7 ; S/V >= 0,7
  A: [0.80, 0.63, 0.58],
  B: [0.80, 0.63, 0.58],
  C: [0.80, 0.60, 0.55],
  D: [0.80, 0.58, 0.53],
  E: [0.75, 0.55, 0.50],
  F: [0.70, 0.53, 0.48],
};

// Tabella 11: rapporto vetrato (%) e valori per zona. Le due meta' della tabella stampata sono unite.
export const TAB11_VETRI_PERCENTUALI = [9, 14, 19, 24, 28, 33, 38, 43, 47, 52, 57, 62, 67, 71, 76, 81, 86, 90, 95, 100];
export const TAB11_HT = {
  "A": [0.72, 0.82, 0.92, 1.01, 1.10, 1.18, 1.26, 1.34, 1.41, 1.47, 1.53, 1.59, 1.64, 1.68, 1.72, 1.76, 1.79, 1.82, 1.84, 1.86],
  "B": [0.72, 0.82, 0.92, 1.01, 1.10, 1.18, 1.26, 1.34, 1.41, 1.47, 1.53, 1.59, 1.64, 1.68, 1.72, 1.76, 1.79, 1.82, 1.84, 1.86],
  "C": [0.60, 0.64, 0.71, 0.78, 0.85, 0.91, 0.97, 1.03, 1.08, 1.14, 1.18, 1.23, 1.27, 1.31, 1.35, 1.38, 1.42, 1.44, 1.47, 1.49],
  "D": [0.58, 0.58, 0.59, 0.65, 0.70, 0.75, 0.81, 0.86, 0.90, 0.95, 0.99, 1.03, 1.07, 1.11, 1.14, 1.18, 1.21, 1.24, 1.26, 1.29],
  "E": [0.55, 0.55, 0.55, 0.55, 0.58, 0.62, 0.66, 0.70, 0.74, 0.78, 0.82, 0.85, 0.89, 0.92, 0.95, 0.99, 1.02, 1.04, 1.07, 1.10],
  "F": [0.53, 0.53, 0.53, 0.53, 0.53, 0.53, 0.56, 0.60, 0.63, 0.66, 0.69, 0.72, 0.75, 0.79, 0.82, 0.85, 0.87, 0.90, 0.93, 0.96],
};

// Limite di H'T per nuova costruzione (Tabella 10). zona: "A".."F". SV = S/V in m-1.
export function limiteHTNuova(zona, SV) {
  const riga = TAB10_HT[zona];
  if (!riga) throw new Error(`zona climatica non valida: ${zona}`);
  if (!(SV > 0)) throw new Error("rapporto S/V non valido");
  if (SV < 0.4) return riga[0];
  if (SV < 0.7) return riga[1];
  return riga[2];
}

// Limite di H'T per ristrutturazione importante di primo livello (Tabella 11).
// Il rapporto vetrato non cade su una colonna esatta: si usa la colonna con il valore immediatamente
// inferiore (il limite cresce con il vetrato, quindi questa scelta e' la piu' severa). Il decreto non scrive
// la regola di interpolazione: da confermare.
export function limiteHTRistrutturazione(zona, rapportoVetratoPercento) {
  const riga = TAB11_HT[zona];
  if (!riga) throw new Error(`zona climatica non valida: ${zona}`);
  if (!(rapportoVetratoPercento >= 0 && rapportoVetratoPercento <= 100)) throw new Error("rapporto vetrato fuori da 0-100 %");
  let i = 0;
  TAB11_VETRI_PERCENTUALI.forEach((v, k) => { if (v <= rapportoVetratoPercento) i = k; });
  return riga[i];
}

// Verifica H'T = Htr,adj / A_tot contro il limite.
export function verificaHT({ Htr_adj_W_K, A_tot_m2, zona, SV, tipo = "nuova", rapportoVetratoPercento }) {
  if (!(A_tot_m2 > 0)) throw new Error("superficie disperdente non valida");
  const HT = Htr_adj_W_K / A_tot_m2;
  const limite = tipo === "nuova" ? limiteHTNuova(zona, SV) : limiteHTRistrutturazione(zona, rapportoVetratoPercento);
  return { HT, limite, verifica: HT < limite, tipo };
}
