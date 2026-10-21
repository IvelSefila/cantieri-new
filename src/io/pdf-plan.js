// Segmenti vettoriali PDF.js 5.4: non identifica da solo quali linee siano muri.
import { pxToMm } from '../trace/geometry.js?v=v20261021a';
import { validatePlan } from '../core/model.js?v=v20261021a';

const identita = () => [1,0,0,1,0,0];
const moltiplica = (a,b) => [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
const applica = (m,x,y) => [m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];

export function segmentiPdf(operatorList, OPS, viewport) {
  let matrice = identita(), stack = [], esclusi = 0;
  const segmenti = [], visti = new Set();
  const aggiungi = (a,b) => {
    const m = moltiplica(viewport.transform, matrice);
    const pa = applica(m,...a), pb = applica(m,...b);
    if (![...pa,...pb].every(Number.isFinite) || Math.hypot(pa[0]-pb[0],pa[1]-pb[1]) < 0.1) return;
    const key = [pa,pb].map(p=>p.map(x=>x.toFixed(4)).join(',')).sort().join('|');
    if (!visti.has(key)) { segmenti.push({ id:segmenti.length, a:pa, b:pb }); visti.add(key); }
  };
  for (let i=0;i<operatorList.fnArray.length;i++) {
    const op = operatorList.fnArray[i], args = operatorList.argsArray[i];
    if (op === OPS.save || op === OPS.paintFormXObjectBegin) {
      stack.push([...matrice]);
      if (op === OPS.paintFormXObjectBegin && args[0]) matrice = moltiplica(matrice,args[0]);
    } else if (op === OPS.restore || op === OPS.paintFormXObjectEnd) matrice = stack.pop() || identita();
    else if (op === OPS.transform) matrice = moltiplica(matrice,args);
    else if (op === OPS.constructPath) {
      // La versione inclusa codifica ogni path con DrawOPS (0 move, 1 line, 2/3 curve, 4 close).
      const data = args[1]?.[0];
      if (!data || !ArrayBuffer.isView(data)) { esclusi++; continue; }
      // I riempimenti possono essere glifi, retini o sagome: non diventano assi dei muri.
      if (![OPS.stroke,OPS.closeStroke,OPS.fillStroke,OPS.eoFillStroke,OPS.closeFillStroke,OPS.closeEOFillStroke].includes(args[0])) { esclusi++; continue; }
      let pos=null, inizio=null;
      for (let j=0;j<data.length;) {
        const tipo=data[j++];
        if (tipo===0) { pos=[data[j++],data[j++]]; inizio=pos; }
        else if (tipo===1) { const q=[data[j++],data[j++]]; if(pos) aggiungi(pos,q); pos=q; }
        else if (tipo===4) { if(pos&&inizio) aggiungi(pos,inizio); pos=inizio; }
        else if (tipo===2) { esclusi++; pos=[data[j+4],data[j+5]]; j+=6; }
        else if (tipo===3) { esclusi++; pos=[data[j+2],data[j+3]]; j+=4; }
        else { esclusi++; break; }
      }
    }
  }
  return {segmenti,esclusi};
}

export function calibrazioneScalaPdf(viewport, denominatore) {
  if (!Number.isFinite(denominatore) || denominatore <= 0 || denominatore > 10000) throw new Error('Scala PDF non valida');
  if(!Number.isFinite(viewport?.scale)||viewport.scale<=0)throw new Error('Pagina PDF non valida');
  return { origine:[0,0], mmPerPx:25.4 / 72 * denominatore / viewport.scale };
}

export function pianoDaSegmenti(segmenti, cal, {spessore=250,altezza=2800,nome='Planimetria PDF'}={}) {
  if (!cal || !segmenti.length) throw new Error('Calibra la tavola e seleziona gli assi dei muri');
  const walls = segmenti.map((s,i)=>({ id:`pdf_${i+1}`,a:pxToMm(s.a,cal,0),b:pxToMm(s.b,cal,0),t:spessore }));
  const plan = {schema:1,unit:'mm',name:nome,altezza_muri:altezza,walls,openings:[],fonte:'PDF vettoriale: segmenti selezionati e scala confermata'};
  const check=validatePlan(plan);
  if(!check.ok) throw new Error(check.errors.join('; '));
  let scarto=0;
  segmenti.forEach((s,i)=>[s.a,s.b].forEach((p,j)=>p.forEach((v,k)=>{scarto=Math.max(scarto,Math.abs((v-cal.origine[k])*cal.mmPerPx-walls[i][j===0?'a':'b'][k]));})));
  plan.verifica_importazione={metodo:'segmenti_pdf',scala_mm_px:cal.mmPerPx,segmenti:segmenti.length,scarto_arrotondamento_max_mm:scarto};
  return plan;
}
