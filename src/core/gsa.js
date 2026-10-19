// Calcolo GSA (superficie solare equivalente) dai vani vetrati del progetto.
// Formula per ogni vano vetrato:   Asol = A_vetro x g x Fsh x Ff
//   A_vetro = larghezza x altezza (mm2 -> m2), g = trasmittanza solare del vetro,
//   Fsh = fattore di ombreggiatura (1 = nessuna ombra), Ff = frazione vetrata (1 - telaio/area).
// I valori non dichiarati usano un default ESPLICITO e vengono elencati come "dati mancanti".
import { materialeVano } from "./cdi.js";
import { wallLengthMm } from "./model.js";
import { fsolEst } from "./fsol.js";

export const DEFAULT_GSA = { g: { vetro: 0.6, vetro_fume: 0.35 }, Fsh: 1, Ff: 0.8 };
export const ORIENTAMENTI = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];

// Orientamento dalla geometria: il piano ha Y crescente verso SUD e X crescente verso EST.
// Solo i muri che stanno sul bordo del perimetro hanno un orientamento; i muri interni restano null.
// Un orientamento dichiarato in parametri.orientamenti prevale sempre.
export function orientamentoDaGeometria(progetto, wall) {
  if (!wall || wall.kind !== "perimetrale") return null;
  // limiti dell'involucro: coordinate fisse (asse) dei soli muri perimetrali
  const per = progetto.walls.filter((w) => w.kind === "perimetrale");
  const yFisse = per.filter((w) => w.a[1] === w.b[1]).map((w) => w.a[1]);
  const xFisse = per.filter((w) => w.a[0] === w.b[0]).map((w) => w.a[0]);
  const minY = Math.min(...yFisse), maxY = Math.max(...yFisse);
  const minX = Math.min(...xFisse), maxX = Math.max(...xFisse);
  const [ax, ay] = wall.a;
  const [bx, by] = wall.b;
  if (ay === by) { // muro orizzontale
    if (ay === minY) return "N";
    if (ay === maxY) return "S";
  }
  if (ax === bx) { // muro verticale
    if (ax === minX) return "O";
    if (ax === maxX) return "E";
  }
  return null;
}

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
    // solo le superfici trasparenti dell'involucro esterno contribuiscono al GSA
    if (!w || w.kind !== "perimetrale") continue;
    const A = (o.width * o.height) / 1e6;
    const gv = g[mat];
    const orientamento = orient[o.wall] ?? orientamentoDaGeometria(progetto, w);
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
