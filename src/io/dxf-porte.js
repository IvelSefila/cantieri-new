// Porte battenti ortogonali: arco a 90°, anta radiale e cardine su muro.
// I simboli ambigui non modificano il modello.
export function riconosciPorteDxf(parsed,plan,scala){
 const report={riconosciute:0,da_verificare:0,avvisi:[]};
 const linee=parsed.entities.filter(e=>e.tipo==='LINE'&&/(?:DOOR|PORT)/i.test(e.layer));
 for(const arco of parsed.archiPorta||[]){
  const c=arco.centro.map(v=>v*scala),r=arco.raggio*scala;
  const sweep=((arco.fine-arco.inizio)%360+360)%360;
  const tol=Math.max(1,r*.005);
  const estremi=[arco.inizio,arco.fine].map(g=>[c[0]+r*Math.cos(g*Math.PI/180),c[1]+r*Math.sin(g*Math.PI/180)]);
  const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const ante=linee.filter(l=>l.layer===arco.layer&&l.punti.some((p,i)=>dist(p.map(v=>v*scala),c)<=tol&&estremi.some(q=>dist(l.punti[1-i].map(v=>v*scala),q)<=tol)));
  const candidati=[];
  if(Math.abs(sweep-90)<.1&&ante.length===1)for(const w of plan.walls){
   const k=w.a[1]===w.b[1]?0:w.a[0]===w.b[0]?1:-1;if(k<0)continue;const n=1-k;
   // Cardine e un estremo dell'arco devono stare sull'asse/filo del muro.
   if(Math.abs(c[n]-w.a[n])>w.t/2+tol)continue;
   for(const end of estremi){
    if(Math.abs(end[n]-c[n])>tol)continue;
    const lo=Math.min(c[k],end[k]),hi=Math.max(c[k],end[k]);
    if(lo<Math.min(w.a[k],w.b[k])-tol||hi>Math.max(w.a[k],w.b[k])+tol)continue;
    const offset=Math.round(w.b[k]>w.a[k]?lo-w.a[k]:w.a[k]-hi),width=Math.round(r);
    if(offset<0||offset+width>Math.abs(w.b[k]-w.a[k]))continue;
    if(plan.openings.some(o=>o.wall===w.id&&offset<o.offset+o.width&&offset+width>o.offset))continue;
    const cardine=(w.b[k]>w.a[k]?c[k]===lo:c[k]===hi)?'a':'b';
    candidati.push({wall:w.id,offset,width,cardine});
   }
  }
  if(candidati.length!==1){report.da_verificare++;continue;}
  const q=candidati[0];
  plan.openings.push({id:`dxf_porta_${++report.riconosciute}`,wall:q.wall,offset:q.offset,width:q.width,height:Math.min(2100,Math.round(plan.altezza_muri*.75)),sill:0,type:'porta',apertura:{cardine:q.cardine}});
 }
 if(report.riconosciute)report.avvisi.push(`${report.riconosciute} porte riconosciute da arco e anta: varchi creati; altezza indicativa.`);
 if(report.da_verificare)report.avvisi.push(`${report.da_verificare} simboli porta da verificare: posizione fuori muro, geometria ambigua o sovrapposizione; nessun taglio applicato.`);
 return report;
}
