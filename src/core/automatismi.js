// Automatismi: finiture, arredo per funzione della stanza, finestre secondo DM 5/7/1975 e orientamento.
// Funzioni pure sul progetto. Ogni risultato dice cosa ha aggiunto, quale norma lo richiede e cosa resta da verificare.
import { stanze } from "./rooms.js?v=v20261020bq";
import { orientamentoDaGeometria, latoEsterno } from "./gsa.js?v=v20261020bq";
import { aggiungiVano, impostaPavimentoStanza, impostaFinituraMuro, MATERIALI_PAVIMENTO } from "./project.js?v=v20261020bq";
import { FUNZIONI, funzioneStanza } from "./funzioni-stanze.js?v=v20261020bq";
import { dentroPoligono } from "./elementi.js?v=v20261020bq";
export { arredaTutto } from "./arredo-intelligente.js?v=v20261020bq";
export { funzioneStanza, FUNZIONI } from "./funzioni-stanze.js?v=v20261020bq";

// Norme richiamate nei risultati (DM 5/7/1975, file in sources/dm_1975_05_07.txt)
const NORMA = {
  finestra: "DM 5/7/1975 art. 5: superficie finestrata apribile non inferiore a 1/8 della superficie del pavimento",
  apribile: "DM 5/7/1975 art. 2 c. 4: stanze da letto, soggiorno e cucina con finestra apribile",
  altezza: "DM 5/7/1975 art. 1: altezza minima interna 2,70 m (2,40 m per bagni, disimpegni, ripostigli)",
  ventilazione: "DM 5/7/1975 art. 6: senza ventilazione naturale, ventilazione meccanica",
};

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

