// Misure in aritmetica intera: mm e mm^2. La conversione in m2 avviene solo in uscita.
import { wallLengthMm } from "./model.js?v=v20261020bw";

// Superficie di una parete finita, due facce, al netto dei vani. Tutto in mm^2 interi.
export function measurePlan(plan) {
  let lunghezzaMuri = 0; // mm, somma delle lunghezze assiali (interi)
  let lunghezzaObliqui = 0; // mm, lunghezze non intere (solo muri obliqui)
  let superficieMuri2 = 0; // mm^2, due facce, al lordo dei vani
  let vaniArea2 = 0; // mm^2, somma larghezza*altezza dei vani
  const perMuro = [];

  for (const w of plan.walls) {
    const L = wallLengthMm(w);
    if (Number.isInteger(L)) lunghezzaMuri += L;
    else lunghezzaObliqui += L;
    const lordo2 = 2 * L * plan.altezza_muri;
    superficieMuri2 += lordo2;
    const vani = plan.openings.filter((o) => o.wall === w.id);
    const area = vani.reduce((s, o) => s + o.width * o.height, 0);
    vaniArea2 += area;
    perMuro.push({ id: w.id, lunghezza_mm: L, vani: vani.length, superficie_netta_m2: (lordo2 - 2 * area) / 1e6 });
  }

  const vaniAreaTot = plan.openings.reduce((s, o) => s + o.width * o.height, 0);
  return {
    lunghezza_muri_mm: lunghezzaMuri,
    lunghezza_muri_obliqui_mm: Number(lunghezzaObliqui.toFixed(3)),
    superficie_muri_netta_m2: (superficieMuri2 - 2 * vaniAreaTot) / 1e6,
    superficie_vani_m2: vaniAreaTot / 1e6,
    vani: plan.openings.length,
    per_muro: perMuro,
  };
}
