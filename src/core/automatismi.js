// Automatismi: finiture di tutto l'edificio, infissi sulle facciate, arredo delle stanze.
// Funzioni pure sul progetto. Ogni risultato dice cosa ha aggiunto e cosa NON e' nella planimetria.
import { stanze } from "./rooms.js";
import { orientamentoDaGeometria, latoEsterno } from "./gsa.js";
import { aggiungiVano, impostaPavimentoStanza, impostaFinituraMuro, aggiungiArredo, MATERIALI_PAVIMENTO } from "./project.js";
import { collisioniArredo } from "./arredi.js";
import { dentroPoligono } from "./elementi.js";

// ---- Finiture: intonaco su tutti i muri, pavimento in ogni stanza ----
export function finiturTutto(p, { muro = "intonaco_bianco", pavimento = "parquet" } = {}) {
  let q = p;
  for (const w of q.walls) q = impostaFinituraMuro(q, w.id, muro).p ?? q;
  let stanzeCoperte = 0;
  for (const s of stanze(q.walls)) {
    const r = impostaPavimentoStanza(q, s.interno, pavimento);
    if (r.p) { q = r.p; stanzeCoperte++; }
  }
  return { p: q, aggiunti: [`finitura muri: ${muro}`, `pavimento ${MATERIALI_PAVIMENTO[pavimento]?.nome ?? pavimento} in ${stanzeCoperte} stanze`], fuoriPlanimetria: [] };
}

// ---- Infissi: finestre sulle facciate, con orientamento e aeroilluminante RAI (DM 5/7/1975: >= 1/8 della superficie) ----
const LARGHEZZA = { base: 1200, avanzato: 1400 };
const ALTEZZA = 1400;
const DAVANZALE = 900;
const MARGINE_PORTA = 300;
// Peso dell'orientamento per il risparmio energetico: sud (guadagni solari invernali) prima, est/ovest poi, nord ultimo
const PESO = { S: 3, SE: 2.5, SO: 2.5, E: 2, O: 2, NE: 1, NO: 1, N: 0.5 };

// Posizioni libere su un muro: la finestra non tocca porte o altri vani (margine MARGINE_PORTA)
function postoLibero(p, muro, larghezza) {
  const L = Math.hypot(muro.b[0] - muro.a[0], muro.b[1] - muro.a[1]);
  const occupati = p.openings.filter((o) => o.wall === muro.id).map((o) => [o.offset - MARGINE_PORTA, o.offset + o.width + MARGINE_PORTA]);
  const passo = 100;
  for (let off = 300; off + larghezza <= L - 300; off += passo) {
    const fine = off + larghezza;
    if (!occupati.some(([a, b]) => off < b && fine > a)) return Math.round(off);
  }
  return null;
}

export function infissiAutomatici(p, { livello = "base", nordGradi = 0 } = {}) {
  let q = p;
  const aggiunti = [];
  const rapporto = [];
  const interni = stanze(q.walls);
  const larg = LARGHEZZA[livello] ?? LARGHEZZA.base;
  for (const s of interni) {
    const areaMm2 = s.superficieMm2;
    const minimoMm2 = areaMm2 / 8;
    let finestreMm2 = 0;
    // muri esterni che chiudono questa stanza, dal lato della stanza
    const candidati = [];
    for (const w of q.walls) {
      const ext = latoEsterno(w, interni.map((x) => x.interno));
      if (!ext) continue;
      const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
      const dentro = [mid[0] - ext.nx * 150, mid[1] - ext.ny * 150];
      if (!dentroPoligono(dentro, s.interno)) continue;
      const orient = orientamentoDaGeometria(q, w, { interni: interni.map((x) => x.interno), nordGradi }) ?? "N";
      candidati.push({ w, orient, peso: PESO[orient] ?? 1 });
    }
    candidati.sort((a, b) => b.peso - a.peso);
    for (const c of candidati) {
      if (finestreMm2 >= minimoMm2 && livello === "base") break;
      const off = postoLibero(q, c.w, larg);
      if (off === null) continue;
      const r = aggiungiVano(q, c.w.id, off, larg, ALTEZZA, DAVANZALE, "finestra");
      if (r.errore) continue;
      q = r.p;
      finestreMm2 += larg * ALTEZZA;
      aggiunti.push({ muro: c.w.id, stanza: s.id, orientamento: c.orient, larghezza: larg });
    }
    rapporto.push({
      stanza: s.id,
      superficieM2: +(areaMm2 / 1e6).toFixed(2),
      aeroilluminanteM2: +(finestreMm2 / 1e6).toFixed(2),
      minimoM2: +(minimoMm2 / 1e6).toFixed(2),
      ok: finestreMm2 >= minimoMm2,
    });
  }
  const fuori = aggiunti.length ? [`${aggiunti.length} finestre non presenti in planimetria (posizione scelta da orientamento e luce)`] : [];
  const carenti = rapporto.filter((r) => !r.ok).map((r) => r.stanza);
  if (carenti.length) fuori.push(`stanze sotto 1/8 di aeroilluminante (${carenti.join(", ")}): serve una finestra in piu' o una verifica`);
  return { p: q, aggiunti: aggiunti.map((a) => `finestra ${a.larghezza} mm su ${a.muro} (${a.orientamento})`), rapporto, fuoriPlanimetria: fuori };
}

// ---- Arredo: pezzi della libreria in ogni stanza, per superficie, senza collisioni ----
function tipiPerArea(m2) {
  if (m2 >= 14) return ["divano", "tavolo", "letto_matrimoniale"];
  if (m2 >= 9) return ["letto_matrimoniale", "armadio"];
  if (m2 >= 4) return ["letto_singolo", "armadio"];
  return [];
}

export function arredaTutto(p) {
  let q = p;
  const aggiunti = [];
  for (const s of stanze(q.walls)) {
    const m2 = s.superficieMm2 / 1e6;
    const xs = s.interno.map((pt) => pt[0]), ys = s.interno.map((pt) => pt[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    for (const tipo of tipiPerArea(m2)) {
      let posto = null;
      for (let y = y0 + 500; y <= y1 - 500 && !posto; y += 250) {
        for (let x = x0 + 500; x <= x1 - 500 && !posto; x += 250) {
          for (const rot of [0, 90]) {
            if (!dentroPoligono([x, y], s.interno)) continue;
            const cand = { id: "_prova", tipo, x: Math.round(x), y: Math.round(y), rot, finitura: null };
            if (collisioniArredo(cand, q).length === 0) { posto = cand; break; }
          }
        }
      }
      if (!posto) continue;
      const r = aggiungiArredo(q, tipo, posto.x, posto.y, posto.rot);
      if (r.errore) continue;
      q = r.p;
      aggiunti.push(`${tipo} in ${s.id}`);
    }
  }
  const fuori = aggiunti.length ? [`${aggiunti.length} arredi non presenti in planimetria (scelti per superficie delle stanze, non per funzione)`] : [];
  return { p: q, aggiunti, fuoriPlanimetria: fuori };
}
