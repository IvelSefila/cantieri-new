// DXF -> modello planimetria in mm interi.
// - Unita' dal DXF ($INSUNITS), convertite in mm.
// - riferimento "asse": la linea del DXF e' l'asse del muro.
// - riferimento "faccia_esterna": per le polilinee chiuse la linea e' il filo esterno; il contorno
//   viene spostato verso l'interno di t/2 con intersezione d'angolo (miter), cosi' il perimetro resta chiuso.
// Ogni arrotondamento a intero e' contato e riportato: nessuna correzione silenziosa.
import { validatePlan, SCHEMA } from "../core/model.js?v=v20261021a";

const TOL_MM = 0.0005; // sotto questa soglia un valore e' considerato gia' intero

function arrotonda(v, rep) {
  const r = Math.round(v);
  const dev = Math.abs(v - r);
  if (dev > TOL_MM) {
    rep.arrotondamenti++;
    rep.scostamento_max_mm = Math.max(rep.scostamento_max_mm, dev);
  }
  return r;
}

function area2(pts) { // doppia area con segno: >0 antiorario
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s;
}

// Intersezione tra due rette (p + s*u) e (q + r*v). null se parallele.
function intersezione(p, u, q, v) {
  const den = u[0] * v[1] - u[1] * v[0];
  if (Math.abs(den) < 1e-12) return null;
  const s = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den;
  return [p[0] + s * u[0], p[1] + s * u[1]];
}

// Sposta un contorno chiuso verso l'interno di d (mm), con miter agli angoli.
function contornoInterno(pts, d) {
  const n = pts.length;
  const orient = area2(pts) >= 0 ? 1 : -1; // antiorario: interno a sinistra
  const dirs = [];
  const offs = [];
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % n];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const u = [dx / len, dy / len];
    // normale verso l'interno
    const nrm = orient > 0 ? [-u[1], u[0]] : [u[1], -u[0]];
    dirs.push(u);
    offs.push([x1 + nrm[0] * d, y1 + nrm[1] * d]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const p = intersezione(offs[prev], dirs[prev], offs[i], dirs[i]);
    out.push(p ?? offs[i]);
  }
  return out;
}

export function dxfToPlan(parsed, opzioni = {}) {
  const rif = opzioni.riferimento === "faccia_esterna" ? "faccia_esterna" : "asse";
  let spessoreDefault = opzioni.spessoreDefault ?? 250;
  let altezzaMuri = opzioni.altezzaMuri ?? 2800;
  const spessori = opzioni.spessori ?? {};
  const rep = { arrotondamenti: 0, scostamento_max_mm: 0, avvisi: [], layers: {} };
  let scala = parsed.perMm;
  if(!Number.isFinite(scala)||scala<=0)throw Error('Unità DXF assenti o non supportate: scegli le unità originali prima di importare');
  const walls = [];
  let contatore = 0;
  const layerMuri=parsed.entities.filter(e=>/(?:^|[$_\s-])(?:wall|walls|muro|muri|murature)(?:$|[$_\s-])/i.test(e.layer));
  let sorgenti=opzioni.soloLayerMuri&&layerMuri.length?layerMuri:parsed.entities;
  if(sorgenti.length!==parsed.entities.length)rep.avvisi.push(`Filtro layer muri: ${parsed.entities.length-sorgenti.length} entità di altri layer escluse. Verifica il disegno: i nomi dei layer non certificano la geometria.`);

  // Abbina solo facce rettilinee con gli stessi estremi longitudinali.
  // Nessun abbinamento di tratti parziali o appartenenti a layer diversi.
  if(sorgenti.reduce((n,e)=>n+(e.chiusa?e.punti.length:e.punti.length-1),0)>1000)throw Error('DXF troppo complesso: oltre 500 segmenti da trasformare in muri dopo abbinamento. Esporta soltanto i layer dei muri.');
  const usati=new Set(), ricostruite=[];
  const eps=1e-7;
  const asse=e=>{
    if(e.tipo!=='LINE')return null;
    const [a,b]=e.punti;
    const k=Math.abs(a[1]-b[1])<eps?0:Math.abs(a[0]-b[0])<eps?1:-1;
    return k<0?null:{k,n:1-k,lo:Math.min(a[k],b[k]),hi:Math.max(a[k],b[k]),f:a[1-k]};
  };
  for(let i=0;i<sorgenti.length;i++){
    if(usati.has(i))continue;
    const e=sorgenti[i],a=asse(e);let partner=-1,distanza=Infinity;
    if(a&&/(?:WALL|MUR)/i.test(e.layer))for(let j=i+1;j<sorgenti.length;j++){
      if(usati.has(j)||sorgenti[j].layer!==e.layer)continue;
      const b=asse(sorgenti[j]);if(!b||a.k!==b.k||Math.abs(a.lo-b.lo)>eps||Math.abs(a.hi-b.hi)>eps)continue;
      const d=Math.abs(a.f-b.f);
      if(d>eps&&d<(a.hi-a.lo)*0.1&&d<distanza){partner=j;distanza=d;}
    }
    if(partner>=0){
      const b=asse(sorgenti[partner]);
      const vicini=x=>sorgenti.filter(z=>{const v=asse(z);return z.layer===e.layer&&v&&v.k===x.k&&Math.abs(v.lo-x.lo)<eps&&Math.abs(v.hi-x.hi)<eps&&Math.abs(v.f-x.f)>eps&&Math.abs(v.f-x.f)<(x.hi-x.lo)*0.1;}).length;
      if(vicini(a)!==1||vicini(b)!==1)partner=-1;
    }
    if(partner<0){ricostruite.push(e);continue;}
    usati.add(partner);const b=asse(sorgenti[partner]),p=[0,0],q=[0,0];
    p[a.k]=a.lo;q[a.k]=a.hi;p[a.n]=q[a.n]=(a.f+b.f)/2;
    ricostruite.push({...e,punti:[p,q],spessoreDxf:distanza});
  }
  const coppie=sorgenti.length-ricostruite.length;
  if(coppie){sorgenti=ricostruite;rep.avvisi.push(`${coppie} coppie di facce parallele convertite in muri unici con spessore geometrico.`);}
  // Due quote indipendenti concordanti possono evidenziare un header errato.
  // Richiediamo entrambe le dimensioni, non una sola etichetta numerica.
  if(coppie && !parsed.report.unita_confermate && parsed.quoteTesto?.length>=2){
    const pp=sorgenti.flatMap(e=>e.punti);
    const sx=Math.max(...pp.map(p=>p[0]))-Math.min(...pp.map(p=>p[0]));
    const sy=Math.max(...pp.map(p=>p[1]))-Math.min(...pp.map(p=>p[1]));
    for(const fattore of [1000,100,10]){
      const ix=parsed.quoteTesto.findIndex(q=>Math.abs(q-sx*scala*fattore)<0.01);
      const iy=parsed.quoteTesto.findIndex((q,i)=>i!==ix&&Math.abs(q-sy*scala*fattore)<0.01);
      if(ix>=0&&iy>=0){scala*=fattore;rep.scala_da_quote=fattore;rep.avvisi.push(`Header incoerente con due quote testuali: applicato fattore ${fattore}. Scala dedotta da quote, da verificare prima dell'uso metrico.`);break;}
    }
  }

  // Le coordinate restano nelle unità dichiarate dal file. Solo le dimensioni
  // aggiunte per l'estrusione si adattano ai disegni piccoli.
  const punti = sorgenti.flatMap(e => e.punti);
  if (punti.length) {
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const [x,y] of punti){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    const ingombro=Math.max(maxX-minX,maxY-minY)*scala;
    if(ingombro>0 && ingombro<spessoreDefault*4){
      const rapporto=ingombro/20000;
      spessoreDefault=Math.max(2,Math.round(spessoreDefault*rapporto/2)*2);
      if(opzioni.altezzaMuri==null)altezzaMuri=Math.max(1,Math.round(2800*rapporto));
      rep.avvisi.push(`Ingombro DXF ${ingombro.toFixed(1)} mm: coordinate e unità del file preservate. Spessore indicativo ${spessoreDefault} mm e altezza di visualizzazione ${altezzaMuri} mm; verifica la scala prima di usare le misure.`);
    }
  }

  for (const e of sorgenti) {
    const t = spessori[e.layer] ?? (e.spessoreDxf ? Math.max(2,Math.round(e.spessoreDxf*scala/2)*2) : spessoreDefault);
    if (!Number.isInteger(t) || t <= 0 || t % 2 !== 0) {
      rep.avvisi.push(`layer ${e.layer}: spessore ${t} non valido (intero pari > 0)`);
      continue;
    }
    rep.layers[e.layer] = (rep.layers[e.layer] || 0) + 1;

    // coordinate in mm (ancora decimali, arrotondate piu' avanti)
    let pts = e.punti.map(([x, y]) => [x * scala, y * scala]);

    if (e.tipo !== "LINE" && e.chiusa && rif === "faccia_esterna") {
      pts = contornoInterno(pts, t / 2);
    } else if (e.tipo !== "LINE" && e.chiusa === false && rif === "faccia_esterna") {
      rep.avvisi.push(`layer ${e.layer}: polilinea aperta trattata come asse`);
    }

    const ip = pts.map(([x, y]) => [arrotonda(x, rep), arrotonda(y, rep)]);
    const nSeg = e.chiusa ? ip.length : ip.length - 1;
    for (let i = 0; i < nSeg; i++) {
      const a = ip[i];
      const b = ip[(i + 1) % ip.length];
      if (a[0] === b[0] && a[1] === b[1]) continue; // segmento nullo dopo arrotondamento
      contatore++;
      if(contatore>500)throw Error('DXF troppo complesso: oltre 500 segmenti da trasformare in muri. Esporta soltanto i layer dei muri, escludendo arredi, quote e tratteggi. Nessun modello è stato applicato.');
      walls.push({ id: `${e.layer}_${String(contatore).padStart(3, "0")}`, a, b, t, kind: e.layer });
    }
  }

  const plan = {
    schema: SCHEMA,
    unit: "mm",
    altezza_muri: altezzaMuri,
    name: opzioni.nome ?? "Planimetria importata da DXF",
    fonte: `DXF (unita' originali: ${parsed.report.unita ?? "non dichiarate"}, riferimento: ${rif})`,
    walls,
    openings: [],
  };
  // I segmenti su layer vetri che giacciono su un asse ricostruito
  // definiscono un vano finestra; simboli fuori asse restano esclusi.
  if(coppie)for(const e of parsed.entities){
    if(e.tipo!=='LINE'||!/(?:GLAZ|WINDOW|FINESTR)/i.test(e.layer))continue;
    const p=e.punti.map(p=>p.map(v=>Math.round(v*scala)));
    for(const w of walls){
      const k=w.a[1]===w.b[1]?0:w.a[0]===w.b[0]?1:-1;if(k<0)continue;const n=1-k;
      if(Math.abs(p[0][n]-w.a[n])>1||Math.abs(p[1][n]-w.a[n])>1)continue;
      const lo=Math.min(p[0][k],p[1][k]),hi=Math.max(p[0][k],p[1][k]);
      const offset=lo-Math.min(w.a[k],w.b[k]);
      if(offset<0||hi>Math.max(w.a[k],w.b[k])||hi<=lo)continue;
      const sill=Math.round(altezzaMuri*0.3),height=Math.round(altezzaMuri*0.45);
      if(!plan.openings.some(o=>o.wall===w.id&&offset<o.offset+o.width&&offset+hi-lo>o.offset))plan.openings.push({id:`dxf_finestra_${plan.openings.length+1}`,wall:w.id,offset,width:hi-lo,height,sill,type:'finestra'});
      break;
    }
  }
  if(plan.openings.length)rep.avvisi.push(`${plan.openings.length} finestre da layer vetri: altezze e davanzali indicativi.`);
  const check = validatePlan(plan);
  return { plan, check, report: { ...parsed.report, ...rep, avvisi:[...parsed.report.avvisi,...rep.avvisi], muri: walls.length } };
}
