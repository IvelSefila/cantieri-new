// Lettore DXF minimale (ASCII). Legge solo cio' che serve alla planimetria:
// LINE, LWPOLYLINE, POLYLINE(+VERTEX). Tutto il resto viene contato e segnalato, non ignorato in silenzio.
// Nessuna dipendenza esterna.

// $INSUNITS del DXF -> fattore verso i millimetri (solo unita' di lunghezza comuni)
export const INSUNITS_A_MM = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 7: 1000000 };
export const NOME_UNITA = { 1: "pollici", 2: "piedi", 4: "millimetri", 5: "centimetri", 6: "metri", 7: "chilometri" };

// Coppie (codice, valore) dal testo DXF.
function coppie(testo) {
  const righe = testo.split(/\r?\n/);
  const out = [];
  for (let i = 0; i + 1 < righe.length; i += 2) {
    const codice = parseInt(righe[i].trim(), 10);
    if (Number.isNaN(codice)) continue; // riga spuria: contata sotto
    out.push([codice, righe[i + 1].trim()]);
  }
  return out;
}

export function parseDxf(testo) {
  const cp = coppie(testo);
  const report = { entita: 0, linee: 0, polilinee: 0, altre: {}, unita: null, avvisi: [] };

  // Unita' dall'header
  let insunits = null;
  for (let i = 0; i < cp.length - 1; i++) {
    if (cp[i][0] === 9 && cp[i][1] === "$INSUNITS" && cp[i + 1][0] === 70) {
      insunits = parseInt(cp[i + 1][1], 10);
    }
  }
  report.unita = insunits;
  if (insunits === null || !(insunits in INSUNITS_A_MM)) {
    report.avvisi.push("unita' non dichiarate nell'header: assumo metri (verificare)");
  }
  const perMm = insunits in INSUNITS_A_MM ? INSUNITS_A_MM[insunits] : 1000;

  // Sezione ENTITIES
  const start = cp.findIndex(([c, v]) => c === 2 && v === "ENTITIES");
  const entities = [];
  if (start < 0) {
    report.avvisi.push("sezione ENTITIES non trovata");
    return { entities, report, perMm };
  }
  let k = start + 1;
  let corrente = null;
  const chiudi = () => { if (corrente) entities.push(corrente); corrente = null; };

  for (; k < cp.length; k++) {
    const [c, v] = cp[k];
    if (c === 0) {
      if (v === "ENDSEC") break;
      if (v === "VERTEX") { if (corrente) corrente._inVertex = true; continue; } // vertice: la POLYLINE resta corrente
      if (v === "SEQEND") { chiudi(); continue; }
      chiudi();
      report.entita++;
      if (v === "LINE") { corrente = { tipo: "LINE", layer: "0", punti: [], chiusa: false }; report.linee++; }
      else if (v === "LWPOLYLINE") { corrente = { tipo: "LWPOLYLINE", layer: "0", punti: [], chiusa: false, _pt: null }; report.polilinee++; }
      else if (v === "POLYLINE") { corrente = { tipo: "POLYLINE", layer: "0", punti: [], chiusa: false }; report.polilinee++; }
      else { report.altre[v] = (report.altre[v] || 0) + 1; }
      continue;
    }
    if (!corrente) continue;
    if (c === 8) corrente.layer = v;
    if (corrente.tipo === "LINE") {
      if (c === 10) corrente._x1 = parseFloat(v);
      if (c === 20) corrente._y1 = parseFloat(v);
      if (c === 11) corrente._x2 = parseFloat(v);
      if (c === 21) {
        corrente._y2 = parseFloat(v);
        corrente.punti = [[corrente._x1, corrente._y1], [corrente._x2, corrente._y2]];
      }
    } else if (corrente.tipo === "LWPOLYLINE") {
      if (c === 70) corrente.chiusa = (parseInt(v, 10) & 1) === 1;
      if (c === 10) corrente._pt = [parseFloat(v), null];
      if (c === 20 && corrente._pt) { corrente._pt[1] = parseFloat(v); corrente.punti.push(corrente._pt); corrente._pt = null; }
    } else if (corrente.tipo === "POLYLINE") {
      if (c === 70) corrente.chiusa = (parseInt(v, 10) & 1) === 1;
      if (!corrente._inVertex) { /* coordinate dell'intestazione POLYLINE: non sono vertici */ }
      else if (c === 10) corrente._vx = parseFloat(v);
      else if (c === 20 && corrente._vx !== undefined) { corrente.punti.push([corrente._vx, parseFloat(v)]); corrente._vx = undefined; corrente._inVertex = false; }
    }
  }
  chiudi();
  // Rimuove il punto di chiusura duplicato (polilinea che ritorna sul primo vertice)
  for (const e of entities) {
    delete e._pt; delete e._x1; delete e._y1; delete e._x2; delete e._y2; delete e._vx; delete e._inVertex;
    const p = e.punti;
    if (e.tipo !== "LINE" && p.length > 2 && p[0][0] === p[p.length - 1][0] && p[0][1] === p[p.length - 1][1]) {
      p.pop();
      e.chiusa = true;
    }
  }
  return { entities: entities.filter((e) => e.punti.length >= 2), report, perMm };
}
