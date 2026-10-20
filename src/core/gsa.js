// Calcolo GSA (superficie solare equivalente) dai vani vetrati del progetto.
// Formula per ogni vano vetrato:   Asol = A_vetro x g x Fsh x Ff
//   A_vetro = larghezza x altezza (mm2 -> m2), g = trasmittanza solare del vetro,
//   Fsh = fattore di ombreggiatura (1 = nessuna ombra), Ff = frazione vetrata (1 - telaio/area).
// I valori non dichiarati usano un default ESPLICITO e vengono elencati come "dati mancanti".
import { materialeVano } from "./cdi.js?v=v20261020bm";
import { wallLengthMm } from "./model.js?v=v20261020bm";
import { fsolEst } from "./fsol.js?v=v20261020bm";
import { stanze } from "./rooms.js?v=v20261020bm";
import { dentroPoligono } from "./elementi.js?v=v20261020bm";

export const DEFAULT_GSA = { g: { vetro: 0.6, vetro_fume: 0.35 }, Fsh: 1, Ff: 0.8 };
export const ORIENTAMENTI = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

// Lato esterno di un muro, dalla geometria: nel punto s (mm dal punto a, di default metà muro) si guarda un punto
// a (t/2 + 100 mm) da ciascun lato della mezzeria. Per un vano si usa il centro del vano: un muro lungo può essere
// esterno in un tratto e interno in un altro, e la metà muro può cadere su un incrocio con un tramezzo.
// Se da un lato c'è una stanza e dall'altro no, il muro è sull'involucro e la normale esterna punta verso il lato
// senza stanza. Funziona per muri dritti e obliqui e per progetti disegnati o importati (non serve il tipo "perimetrale").
// Restituisce { nx, ny } (normale esterna, unitaria) oppure null se il muro è interno o non chiude stanze.
export function latoEsterno(wall, interni, s = null) {
  const L = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
  if (!L) return null;
  const ux = (wall.b[0] - wall.a[0]) / L;
  const uy = (wall.b[1] - wall.a[1]) / L;
  const nx = -uy;
  const ny = ux;
  const d = wall.t / 2 + 100;
  const pos = s ?? L / 2;
  const mx = wall.a[0] + ux * pos;
  const my = wall.a[1] + uy * pos;
  const dentro = (px, py) => interni.some((poly) => dentroPoligono([px, py], poly));
  const sinistra = dentro(mx + nx * d, my + ny * d);
  const destra = dentro(mx - nx * d, my - ny * d);
  if (sinistra === destra) return null;
  return sinistra ? { nx: -nx, ny: -ny } : { nx, ny };
}

// Orientamento (8 settori) da una normale esterna nel piano del disegno. Convenzione del progetto: Y cresce verso
// SUD e X verso EST quando il Nord del disegno è in alto. nordGradi = rotazione del Nord reale rispetto all'alto
// del disegno, in gradi orari (0 = Nord in alto).
export function orientamentoDaNormale({ nx, ny }, nordGradi = 0) {
  const azimut = (Math.atan2(nx, -ny) * 180) / Math.PI - nordGradi; // 0 = N, 90 = E
  const settore = ((Math.round(azimut / 45) % 8) + 8) % 8;
  return ORIENTAMENTI[settore];
}

// Orientamento dalla geometria. Un orientamento dichiarato in parametri.orientamenti prevale sempre.
// interni: contorni interni delle stanze (da stanze()). Se mancano si calcolano qui.
export function orientamentoDaGeometria(progetto, wall, { interni, nordGradi = 0 } = {}) {
  if (!wall) return null;
  const poli = interni ?? stanze(progetto.walls).map((x) => x.interno);
  const n = latoEsterno(wall, poli);
  return n ? orientamentoDaNormale(n, nordGradi) : null;
}

export function calcolaGSA(progetto, parametri = {}) {
  const g = { ...DEFAULT_GSA.g, ...(parametri.g ?? {}) };
  const Fsh = parametri.Fsh ?? DEFAULT_GSA.Fsh;
  const Ff = parametri.Ff ?? DEFAULT_GSA.Ff;
  const orient = parametri.orientamenti ?? {};
  const nordGradi = parametri.nordGradi ?? 0;
  const righe = [];
  const mancanti = [];
  const interni = stanze(progetto.walls).map((x) => x.interno);

  for (const o of progetto.openings) {
    const mat = materialeVano(o);
    if (mat !== "vetro" && mat !== "vetro_fume") continue;
    const w = progetto.walls.find((x) => x.id === o.wall);
    if (!w) continue;
    // solo le superfici trasparenti dell'involucro esterno contribuiscono: muro con una stanza da un solo lato.
    // Se il disegno non chiude stanze, vale il tipo "perimetrale" indicato nel progetto.
    const n = latoEsterno(w, interni, o.offset + o.width / 2);
    const esterno = interni.length ? n !== null : w.kind === "perimetrale";
    if (!esterno) continue;
    const A = (o.width * o.height) / 1e6;
    const gv = g[mat];
    const orientamento = orient[o.wall] ?? (n ? orientamentoDaNormale(n, nordGradi) : null);
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
    "direzione del Nord nel disegno (oggi presunta in alto): l'orientamento delle pareti dipende da questo",
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

// Limiti di Asol,est / Asup utile (DM 26/06/2015, App. A, Tabella 11): E.1 residenziale < 0,030, altri < 0,040.
export const LIMITE_ASOL_EST = { residenziale: 0.03, altri: 0.04 };

// Asol,est = SOMMA_k  Fsh,ob x ggl+sh x (1 - FF) x Aw,p x Fsol,est      [m2]   (DM 26/06/2015, App. A, par. 2.2)
//   serramenti: [{ id, orientamento, Aw_m2, FF, gglsh, Fsh_ob? }]
//   Aw_m2 = area proiettata del vano; FF = frazione di telaio; gglsh = trasmittanza solare con schermo in uso (luglio);
//   Fsh_ob = ombreggiatura da ostruzioni esterne a luglio, se assente vale 1 (nessuna ombra, valore conservativo).
// Un serramento con dati mancanti NON entra nel totale: compare in `mancanti` e `completo` diventa false.
export function calcolaAsolEst(serramenti, { asupUtile_m2, residenziale = true } = {}) {
  const righe = [];
  const mancanti = [];
  for (const s of serramenti) {
    const Fsol = fsolEst(s.orientamento);
    const Fsh = s.Fsh_ob ?? 1;
    const buchi = [];
    if (Fsol === null) buchi.push("orientamento");
    if (!(s.gglsh > 0 && s.gglsh <= 1)) buchi.push("ggl+sh");
    if (!(s.FF >= 0 && s.FF < 1)) buchi.push("FF");
    if (!(s.Aw_m2 > 0)) buchi.push("Aw,p");
    if (!(Fsh > 0 && Fsh <= 1)) buchi.push("Fsh,ob");
    if (buchi.length) {
      mancanti.push(`${s.id}: ${buchi.join(", ")}`);
      continue;
    }
    righe.push({
      id: s.id,
      orientamento: s.orientamento,
      Aw_m2: s.Aw_m2,
      FF: s.FF,
      gglsh: s.gglsh,
      Fsh_ob: Fsh,
      Fsol_est: Fsol,
      asol_m2: Fsh * s.gglsh * (1 - s.FF) * s.Aw_m2 * Fsol,
    });
  }
  const asolEst_m2 = righe.reduce((t, r) => t + r.asol_m2, 0);
  const limite = residenziale ? LIMITE_ASOL_EST.residenziale : LIMITE_ASOL_EST.altri;
  const rapporto = asupUtile_m2 > 0 ? asolEst_m2 / asupUtile_m2 : null;
  return {
    righe,
    asolEst_m2,
    asupUtile_m2: asupUtile_m2 ?? null,
    rapporto,
    limite,
    verifica: rapporto === null ? null : rapporto < limite,
    completo: mancanti.length === 0,
    mancanti,
  };
}
