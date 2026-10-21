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

export function parseDxf(testo,opzioni={}) {
  if(typeof testo!=='string'||testo.length>50*1024*1024)throw Error('DXF troppo grande o non valido');
  if(testo.startsWith('AutoCAD Binary DXF'))throw Error('DXF binario non supportato: esporta un DXF ASCII 2D');
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
  const forzata=Number(opzioni.unitaOriginali);
  if(Object.hasOwn(INSUNITS_A_MM,forzata)){
    report.avvisi.push(`Unità originali impostate dall'utente: ${NOME_UNITA[forzata]} (header: ${insunits??'assente'})`);
    insunits=forzata;report.unita=forzata;report.unita_confermate=true;
  }
  if (insunits === null || !(insunits in INSUNITS_A_MM)) {
    const scelta=Number(opzioni.unitaSeAssenti);
    if(Object.hasOwn(INSUNITS_A_MM,scelta)){
      insunits=scelta;report.unita=scelta;report.unita_confermate=true;
      report.avvisi.push(`Unità assenti o non supportate nell'header: ${NOME_UNITA[scelta]} confermati dall'utente`);
    }else report.avvisi.push('Unità DXF assenti o non supportate: scegli le unità originali prima di importare');
  }
  const perMm = Object.hasOwn(INSUNITS_A_MM,insunits) ? INSUNITS_A_MM[insunits] : null;

  // Sezione ENTITIES
  const start = cp.findIndex(([c, v]) => c === 2 && v === "ENTITIES");
  const entities = [];
  if (start < 0) {
    report.avvisi.push("sezione ENTITIES non trovata");
    return { entities, report, perMm };
  }
  let k = start + 1;
  let corrente = null;
  const chiudiVertice=()=>{
    if(corrente?._inVertex) {corrente.punti.push([corrente._vx,corrente._vy]);delete corrente._vx;delete corrente._vy;corrente._inVertex=false;}
  };
  const chiudi = () => {
    if(corrente){
      chiudiVertice();
      if(corrente.tipo==='LINE')corrente.punti=[[corrente._x1,corrente._y1],[corrente._x2,corrente._y2]];
      if(corrente.curva)report.avvisi.push(`layer ${corrente.layer}: polilinea curva (bulge) esclusa; serve una rappresentazione rettilinea verificata`);
      else if(corrente.nonSupportata)report.avvisi.push(`layer ${corrente.layer}: polilinea 3D, mesh, spline o piano non XY esclusi; serve geometria 2D rettilinea`);
      else if(corrente.punti.some(p=>!p.every(Number.isFinite)))report.avvisi.push(`layer ${corrente.layer}: coordinate incomplete o non numeriche, entità esclusa`);
      else entities.push(corrente);
    }
    corrente=null;
  };

  for (; k < cp.length; k++) {
    const [c, v] = cp[k];
    if (c === 0) {
      if (v === "ENDSEC") break;
      if (v === "VERTEX") { if (corrente?.tipo==='POLYLINE') {chiudiVertice();corrente._inVertex = true;} continue; }
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
    if (c === 8 && !corrente._inVertex) corrente.layer = v;
    if(c===42 && Number(v)!==0)corrente.curva=true;
    if((c===210||c===220)&&Number(v)!==0 || c===230&&Number(v)!==1)corrente.nonSupportata=true;
    if (corrente.tipo === "LINE") {
      if (c === 10) corrente._x1 = parseFloat(v);
      if (c === 20) corrente._y1 = parseFloat(v);
      if (c === 11) corrente._x2 = parseFloat(v);
      if (c === 21) corrente._y2 = parseFloat(v);
    } else if (corrente.tipo === "LWPOLYLINE") {
      if (c === 70 && !corrente._inVertex) corrente.chiusa = (parseInt(v, 10) & 1) === 1;
      if (c === 10) corrente._pt = [parseFloat(v), null];
      if (c === 20 && corrente._pt) { corrente._pt[1] = parseFloat(v); corrente.punti.push(corrente._pt); corrente._pt = null; }
    } else if (corrente.tipo === "POLYLINE") {
      if (c === 70 && !corrente._inVertex) {
        const flags=parseInt(v,10);corrente.chiusa=(flags&1)===1;
        if(flags&(2|4|8|16|64))corrente.nonSupportata=true;
      }
      if (!corrente._inVertex) { /* coordinate dell'intestazione POLYLINE: non sono vertici */ }
      else if (c === 10) corrente._vx = parseFloat(v);
      else if (c === 20) corrente._vy = parseFloat(v);
    }
  }
  chiudi();
  for(const [tipo,n]of Object.entries(report.altre))report.avvisi.push(`${n} entità ${tipo} non supportate, escluse dall'importazione`);
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
