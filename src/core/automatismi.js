// Automatismi: finiture, arredo per funzione della stanza, finestre secondo DM 5/7/1975 e orientamento.
// Funzioni pure sul progetto. Ogni risultato dice cosa ha aggiunto, quale norma lo richiede e cosa resta da verificare.
import { stanze } from "./rooms.js";
import { orientamentoDaGeometria, latoEsterno } from "./gsa.js";
import { aggiungiVano, impostaPavimentoStanza, impostaFinituraMuro, aggiungiArredo, MATERIALI_PAVIMENTO } from "./project.js";
import { collisioniArredo, LIBRERIA_3D } from "./arredi.js";
import { dentroPoligono } from "./elementi.js";

export const FUNZIONI = {
  soggiorno: "Soggiorno",
  cucina: "Cucina",
  camera: "Camera",
  bagno: "Bagno",
  disimpegno: "Disimpegno",
  ripostiglio: "Ripostiglio",
};

// Norme richiamate nei risultati (DM 5/7/1975, file in sources/dm_1975_05_07.txt)
const NORMA = {
  finestra: "DM 5/7/1975 art. 5: superficie finestrata apribile non inferiore a 1/8 della superficie del pavimento",
  apribile: "DM 5/7/1975 art. 2 c. 4: stanze da letto, soggiorno e cucina con finestra apribile",
  altezza: "DM 5/7/1975 art. 1: altezza minima interna 2,70 m (2,40 m per bagni, disimpegni, ripostigli)",
  ventilazione: "DM 5/7/1975 art. 6: senza ventilazione naturale, ventilazione meccanica",
};

// ---- Funzione delle stanze: scelta dell'utente (salvata nel progetto) oppure suggerita dalla geometria ----
// Il suggerimento e' una stima: la planimetria importata non porta le etichette delle stanze.
export function funzioneStanza(p, s) {
  const scelta = (p.funzioniStanze ?? []).find((f) => JSON.stringify(f.poligono) === JSON.stringify(s.interno.map(([x, y]) => [Math.round(x), Math.round(y)])));
  if (scelta) return { funzione: scelta.funzione, sorgente: "scelta" };
  return { funzione: suggerisciFunzione(s, p), sorgente: "suggerita" };
}

function bboxStanza(s) {
  const xs = s.interno.map((q) => q[0]), ys = s.interno.map((q) => q[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

function suggerisciFunzione(s, p) {
  const m2 = s.superficieMm2 / 1e6;
  const b = bboxStanza(s);
  const lati = [b.x1 - b.x0, b.y1 - b.y0];
  const snello = Math.max(...lati) / Math.max(1, Math.min(...lati)) >= 2.2;
  if (m2 <= 2.5) return "ripostiglio";
  if (m2 <= 4 && snello) return "disimpegno";
  if (m2 <= 6.5) return "bagno";
  const tutte = stanze(p.walls).map((x) => x.superficieMm2 / 1e6).sort((a, c) => c - a);
  if (m2 >= 16 && m2 === tutte[0]) return "soggiorno";
  return m2 >= 9 ? "camera" : "cucina";
}

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

// ---- Finestre ----
const LARGHEZZA = 1200;
const ALTEZZA = 1400;
const DAVANZALE = 900;
const MARGINE = 300; // dagli spigoli del muro e dalle porte
// Peso per il risparmio energetico (guadagni solari invernali): sud prima, est/ovest, nord ultimo
const PESO = { S: 3, SE: 2.5, SO: 2.5, E: 2, O: 2, NE: 1, NO: 1, N: 0.5 };
// Stanze che per legge devono avere finestra apribile e illuminazione naturale
const DEVONO_FINESTRA = new Set(["camera", "soggiorno", "cucina"]);

function postoLibero(p, muro, larghezza) {
  const L = Math.hypot(muro.b[0] - muro.a[0], muro.b[1] - muro.a[1]);
  const occupati = p.openings.filter((o) => o.wall === muro.id).map((o) => [o.offset - MARGINE, o.offset + o.width + MARGINE]);
  for (let off = MARGINE; off + larghezza <= L - MARGINE; off += 100) {
    const fine = off + larghezza;
    if (!occupati.some(([a, b]) => off < b && fine > a)) return Math.round(off);
  }
  return null;
}

export function infissiAutomatici(p) {
  let q = p;
  const aggiunti = [];
  const rapporto = [];
  const fuori = [];
  const interni = stanze(q.walls);
  const poligoniInterni = interni.map((x) => x.interno);
  for (const s of interni) {
    const { funzione, sorgente } = funzioneStanza(q, s);
    const areaMm2 = s.superficieMm2;
    const minimoMm2 = areaMm2 / 8;
    const voce = { stanza: s.id, funzione, sorgente, superficieM2: +(areaMm2 / 1e6).toFixed(2), minimoM2: +(minimoMm2 / 1e6).toFixed(2), finestreM2: 0, ok: null, norme: [] };
    rapporto.push(voce);
    if (!DEVONO_FINESTRA.has(funzione)) {
      if (funzione === "bagno") {
        const ha = q.openings.some((o) => o.type === "finestra" && q.walls.some((w) => w.id === o.wall && muroToccaStanza(w, s.interno)));
        if (!ha) { voce.norme.push(NORMA.ventilazione); fuori.push(`${s.id} (bagno) senza finestra: ventilazione meccanica da prevedere (DM 5/7/1975 art. 6)`); }
      }
      continue;
    }
    // muri esterni che chiudono la stanza, dal lato della stanza
    const candidati = [];
    for (const w of q.walls) {
      const ext = latoEsterno(w, poligoniInterni);
      if (!ext) continue;
      const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
      if (!dentroPoligono([mid[0] - ext.nx * 150, mid[1] - ext.ny * 150], s.interno)) continue;
      const orient = orientamentoDaGeometria(q, w, { interni: poligoniInterni }) ?? "N";
      candidati.push({ w, orient, peso: PESO[orient] ?? 1 });
    }
    candidati.sort((a, b) => b.peso - a.peso);
    for (const c of candidati) {
      if (voce.finestreM2 * 1e6 >= minimoMm2) break;
      const off = postoLibero(q, c.w, LARGHEZZA);
      if (off === null) continue;
      const r = aggiungiVano(q, c.w.id, off, LARGHEZZA, ALTEZZA, DAVANZALE, "finestra");
      if (r.errore) continue;
      q = { ...r.p, openings: r.p.openings.map((o) => (o.id === r.id ? { ...o, apribile: true } : o)) };
      voce.finestreM2 += (LARGHEZZA * ALTEZZA) / 1e6;
      aggiunti.push(`finestra ${LARGHEZZA} mm su ${c.w.id} (${c.orient}) in ${s.id} (${funzione})`);
    }
    voce.finestreM2 = +voce.finestreM2.toFixed(2);
    voce.ok = voce.finestreM2 * 1e6 >= minimoMm2;
    voce.norme.push(NORMA.finestra, NORMA.apribile);
    if (voce.finestreM2 * 1e6 < minimoMm2) fuori.push(`${s.id} (${funzione}): finestre ${voce.finestreM2} m² su ${voce.minimoM2} m² richiesti, non c'è facciata libera: serve verifica`);
  }
  // altezza interna: segnalata sul progetto, non modificabile qui
  if ((q.altezza_muri ?? 0) < 2700) fuori.push(`altezza interna ${q.altezza_muri} mm sotto 2,70 m (DM 5/7/1975 art. 1): verificare`);
  if (fuori.length === 0 && aggiunti.length === 0) fuori.push("nessuna finestra da aggiungere: le stanze abitabili sono già a norma");
  return { p: q, aggiunti, rapporto, fuoriPlanimetria: fuori.concat(aggiunti.length ? [`${aggiunti.length} finestre non presenti in planimetria`] : []) };
}

// Il muro tocca la stanza se un lato del suo asse cade dentro il poligono interno
function muroToccaStanza(w, interno) {
  const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  if (!L) return false;
  const nx = -(w.b[1] - w.a[1]) / L, ny = (w.b[0] - w.a[0]) / L;
  const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
  return dentroPoligono([mid[0] + nx * 150, mid[1] + ny * 150], interno) || dentroPoligono([mid[0] - nx * 150, mid[1] - ny * 150], interno);
}

// ---- Arredo per funzione: la stanza decide i pezzi, le dimensioni della stanza decidono quanti ----
const ARREDO_PER_FUNZIONE = {
  soggiorno: (m2) => (m2 >= 20 ? ["divano", "tavolino", "mobile_tv", "poltrona"] : ["divano", "tavolino"]),
  cucina: () => ["cucina", "frigorifero", "tavolo", "sedia", "sedia"],
  camera: (m2) => {
    const letto = m2 >= 12 ? "letto_matrimoniale" : "letto_singolo";
    return m2 >= 12 ? [letto, "armadio", "comodino", "comodino", "scrivania"] : [letto, "armadio", "comodino"];
  },
  bagno: (m2) => (m2 >= 5 ? ["wc", "lavabo", "doccia", "bidet"] : ["wc", "lavabo", "doccia"]),
  disimpegno: () => ["armadio"],
  ripostiglio: () => [],
};

// Ingombro in pianta di un pezzo ruotato (rot 0/90/180/270)
function ingombro(tipo, x, y, rot) {
  const d = LIBRERIA_3D[tipo];
  const scambia = rot === 90 || rot === 270;
  const L = scambia ? d.D : d.L, D = scambia ? d.L : d.D;
  return { x0: x - L / 2, x1: x + L / 2, y0: y - D / 2, y1: y + D / 2, cx: x, cy: y, L, D };
}

// Posto valido: tutto il pezzo dentro la stanza, lontano dalle porte, senza collisioni; preferito vicino a un muro
function trovaPosto(q, s, tipo, portePunti) {
  const b = bboxStanza(s);
  let migliore = null;
  for (const rot of [0, 90, 180, 270]) {
    for (let y = b.y0; y <= b.y1; y += 150) {
      for (let x = b.x0; x <= b.x1; x += 150) {
        const g = ingombro(tipo, x, y, rot);
        const angoli = [[g.x0, g.y0], [g.x1, g.y0], [g.x1, g.y1], [g.x0, g.y1]];
        if (!angoli.every(([ax, ay]) => dentroPoligono([ax, ay], s.interno))) continue;
        if (portePunti.some(([px, py]) => px > g.x0 - 900 && px < g.x1 + 900 && py > g.y0 - 900 && py < g.y1 + 900)) continue;
        const cand = { id: "_prova", tipo, x: Math.round(x), y: Math.round(y), rot, finitura: null };
        if (collisioniArredo(cand, q).length) continue;
        // distanza dal muro piu' vicino: piu' e' vicino, meglio e' (il pezzo si appoggia)
        const distMuro = Math.min(g.x0 - b.x0, b.x1 - g.x1, g.y0 - b.y0, b.y1 - g.y1);
        if (!migliore || distMuro < migliore.distMuro) migliore = { ...cand, distMuro };
      }
    }
  }
  return migliore;
}

export function arredaTutto(p) {
  let q = p;
  const aggiunti = [];
  const fuori = [];
  for (const s of stanze(q.walls)) {
    const { funzione } = funzioneStanza(q, s);
    const m2 = s.superficieMm2 / 1e6;
    const lista = (ARREDO_PER_FUNZIONE[funzione] ?? (() => []))(m2);
    const portePunti = q.openings.filter((o) => o.type === "porta").map((o) => {
      const w = q.walls.find((x) => x.id === o.wall);
      if (!w) return null;
      const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
      const t = (o.offset + o.width / 2) / L;
      return [w.a[0] + (w.b[0] - w.a[0]) * t, w.a[1] + (w.b[1] - w.a[1]) * t];
    }).filter(Boolean);
    let messi = 0;
    for (const tipo of lista) {
      const posto = trovaPosto(q, s, tipo, portePunti);
      if (!posto) continue;
      const r = aggiungiArredo(q, tipo, posto.x, posto.y, posto.rot);
      if (r.errore) continue;
      q = r.p;
      messi++;
      aggiunti.push(`${LIBRERIA_3D[tipo]?.nome ?? tipo} in ${s.id} (${FUNZIONI[funzione] ?? funzione})`);
    }
    if (messi < lista.length) fuori.push(`${s.id} (${FUNZIONI[funzione] ?? funzione}): ${lista.length - messi} pezzi non entrano senza collisioni`);
  }
  fuori.unshift(`${aggiunti.length} arredi non presenti in planimetria: scelti per funzione della stanza (stima, verifica la funzione dalla scheda della stanza)`);
  return { p: q, aggiunti, fuoriPlanimetria: fuori };
}
