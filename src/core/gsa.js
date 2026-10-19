// Calcolo GSA (superficie solare equivalente) dai vani vetrati del progetto.
// Formula per ogni vano vetrato:   Asol = A_vetro x g x Fsh x Ff
//   A_vetro = larghezza x altezza (mm2 -> m2), g = trasmittanza solare del vetro,
//   Fsh = fattore di ombreggiatura (1 = nessuna ombra), Ff = frazione vetrata (1 - telaio/area).
// I valori non dichiarati usano un default ESPLICITO e vengono elencati come "dati mancanti".
import { materialeVano } from "./cdi.js";
import { wallLengthMm } from "./model.js";

export const DEFAULT_GSA = { g: { vetro: 0.6, vetro_fume: 0.35 }, Fsh: 1, Ff: 0.8 };
export const ORIENTAMENTI = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

export function calcolaGSA(progetto, parametri = {}) {
  const g = { ...DEFAULT_GSA.g, ...(parametri.g ?? {}) };
  const Fsh = parametri.Fsh ?? DEFAULT_GSA.Fsh;
  const Ff = parametri.Ff ?? DEFAULT_GSA.Ff;
  const orient = parametri.orientamenti ?? {};
  const righe = [];
  const mancanti = [];

  for (const o of progetto.openings) {
    const mat = materialeVano(o);
    if (mat !== "vetro" && mat !== "vetro_fume") continue;
    const w = progetto.walls.find((x) => x.id === o.wall);
    const A = (o.width * o.height) / 1e6;
    const gv = g[mat];
    const orientamento = orient[o.wall] ?? null;
    if (!orientamento) mancanti.push(`orientamento del muro ${o.wall} (vano ${o.id})`);
    righe.push({
      vano: o.id,
      muro: o.wall,
      materiale: mat,
      lunghezza_muro_mm: w ? wallLengthMm(w) : null,
      area_m2: A,
      g: gv,
      Fsh,
      Ff,
      asol_m2: A * gv * Fsh * Ff,
      orientamento,
    });
  }

  const perOrientamento = {};
  for (const r of righe) {
    const k = r.orientamento ?? "non indicato";
    perOrientamento[k] = (perOrientamento[k] ?? 0) + r.asol_m2;
  }
  const areaVetro = righe.reduce((s, r) => s + r.area_m2, 0);
  const asolTot = righe.reduce((s, r) => s + r.asol_m2, 0);

  // dati che completerebbero il calcolo energetico, oltre a quelli sopra
  const datiMancanti = [
    "orientamento di ogni parete vetrata (N, NE, E, SE, S, SO, O, NO)",
    "trasmittanza solare g dichiarata per ogni vetro (oggi default: vetro 0,60, vetro fume 0,35)",
    "fattore di ombreggiatura Fsh (aggetti, balconi, alberi, edifici vicini)",
    "frazione vetrata Ff dal telaio del serramento (oggi default 0,80)",
    "zona climatica e irraggiamento solare medio mensile per orientamento",
    "altezza del davanzale e del serramento per vano (presenti nel modello)",
  ];

  return {
    righe,
    areaVetroTotale_m2: areaVetro,
    asolTotale_m2: asolTot,
    perOrientamento,
    parametri: { g, Fsh, Ff },
    mancanti,
    datiMancanti,
  };
}
