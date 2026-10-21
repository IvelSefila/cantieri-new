// Classificatore geometrico originale Cantieri. I punteggi sono indizi, non probabilita ML.
export function collegaAperture(muri, mask, width, height) {
  const nero=(x,y,r=1)=>{
    for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
      const a=Math.round(x)+dx,b=Math.round(y)+dy;
      if(a>=0&&a<width&&b>=0&&b<height&&mask[b*width+a])return true;
    }
    return false;
  };
  function indizi(pt,c,t,lo,hi){
    const gap=hi-lo;
    // Finestre: almeno due tratti sottili paralleli e lunghi nel vuoto fra muri.
    let righe=0,dentro=false;
    for(let v=Math.floor(c-t*.7);v<=Math.ceil(c+t*.7);v++){
      let hits=0,n=0;
      for(let u=lo+gap*.15;u<hi-gap*.15;u++){const p=pt(u,v);hits+=nero(...p,0)?1:0;n++;}
      const piena=hits/Math.max(1,n)>.65;
      if(piena&&!dentro)righe++;dentro=piena;
    }
    let arco=0;
    // Porte: arco a quarto di cerchio ancorato a uno stipite, fuori dalla banda muro.
    for(const verso of [-1,1])for(const delta of [-t*.5,0,t*.5]){
      const score=(pivot,radius)=>{
        let hits=0,n=0;
        for(let a=.18;a<1.4;a+=.055){
          const u=pivot+(pivot===lo?1:-1)*radius*Math.cos(a),v=c+delta+verso*radius*Math.sin(a);
          const interno=pt(pivot+(pivot===lo?1:-1)*radius*.65*Math.cos(a),c+delta+verso*radius*.65*Math.sin(a));
          hits+=nero(...pt(u,v),Math.max(1,Math.round(t*.16)))&&!nero(...interno,0)?1:0;n++;
        }
        return hits/n;
      };
      arco=Math.max(arco,score(lo,gap),score(hi,gap),Math.min(score(lo,gap/2),score(hi,gap/2)));
    }
    const tipo=righe>=2?'finestra':gap>=t*3&&arco>=.65?'porta':null;
    return {tipo,arco};
  }
  const gruppi=[];
  for(const w of muri){
    const verticale=Math.abs(w.b[1]-w.a[1])>Math.abs(w.b[0]-w.a[0]),i=verticale?1:0,j=1-i;
    const c=(w.a[j]+w.b[j])/2;
    let g=gruppi.find(g=>g.i===i&&Math.abs(g.c-c)<=Math.max(2,Math.min(g.t,w.spessore_px)*.65)&&Math.max(g.t,w.spessore_px)<Math.min(g.t,w.spessore_px)*2.5);
    if(!g){g={i,j,c,t:w.spessore_px,tratti:[]};gruppi.push(g);}
    g.tratti.push({lo:Math.min(w.a[i],w.b[i]),hi:Math.max(w.a[i],w.b[i])});
  }
  const out=[],aperture=[],dubbi=[];
  for(const g of gruppi){
    const {i,j,c,t}=g,pt=(u,v=c)=>i===0?[u,v]:[v,u];
    const spans=g.tratti.sort((a,b)=>a.lo-b.lo);
    let cur={...spans[0]},vani=[];
    const salva=()=>{const id=`auto_${out.length+1}`;out.push({id,a:pt(cur.lo),b:pt(cur.hi),spessore_px:t});for(const o of vani)aperture.push({...o,wall:id,offset:o.lo-cur.lo,width:o.hi-o.lo});};
    for(const s of spans.slice(1)){
      const gap=s.lo-cur.hi;
      if(gap<=Math.max(3,t*.8)){cur.hi=Math.max(cur.hi,s.hi);continue;}
      if(gap>Math.max(24,t*15)||gap<t*1.5){salva();cur={...s};vani=[];continue;}
      const lo=cur.hi,hi=s.lo;
      const {tipo,arco}=indizi(pt,c,t,lo,hi);
      if(tipo){vani.push({lo,hi,type:tipo,indizio:tipo==='finestra'?'linee parallele':'arco di apertura',punteggio:tipo==='finestra'?.8:arco});cur.hi=s.hi;}
      else{dubbi.push({a:pt(lo),b:pt(hi),motivo:'Interruzione senza simbolo riconoscibile'});salva();cur={...s};vani=[];}
    }
    salva();
  }
  // Aperture a filo di una parete perpendicolare: manca il secondo troncone collineare.
  for(const w of out){
    const i=w.a[0]===w.b[0]?1:0,j=1-i,c=w.a[j],t=w.spessore_px;
    const pt=(u,v=c)=>i===0?[u,v]:[v,u];
    for(const lato of ['a','b']){
      const end=w[lato][i],dir=lato==='a'?-1:1;
      const vicini=out.filter(v=>v!==w&&Math.abs(v.a[i]-v.b[i])<.01&&c>=Math.min(v.a[j],v.b[j])-v.spessore_px&&c<=Math.max(v.a[j],v.b[j])+v.spessore_px).map(v=>({v,d:(v.a[i]-end)*dir})).filter(v=>v.d>t*2.5&&v.d<=Math.max(30,t*15)).sort((a,b)=>a.d-b.d);
      const vicino=vicini[0];if(!vicino)continue;
      const target=vicino.v.a[i],lo=Math.min(end,target),hi=Math.max(end,target);
      const {tipo,arco}=indizi(pt,c,t,lo,hi);if(!tipo)continue;
      if(lato==='a')for(const o of aperture.filter(o=>o.wall===w.id))o.offset+=vicino.d;
      aperture.push({wall:w.id,offset:lato==='a'?0:end-w.a[i],width:vicino.d,type:tipo,indizio:tipo==='porta'?'arco a filo parete':'linee parallele a filo parete',punteggio:tipo==='porta'?arco:.8});
      w[lato]=pt(target);
    }
  }
  return {muri:out,aperture:aperture.map((o,i)=>({...o,id:`apertura_${i+1}`})),dubbi};
}

export function elementiInMm(rapporto, cal, altezza=2800) {
  const punto=p=>p.map((v,i)=>Math.round((v-cal.origine[i])*cal.mmPerPx));
  const muri=rapporto.muri.filter(w=>!w.escluso).map(w=>({...w,a:punto(w.a),b:punto(w.b),t:Math.max(2,Math.round(w.spessore_px*cal.mmPerPx/2)*2)})).filter(w=>Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1])>w.t);
  const ids=new Set(muri.map(w=>w.id));
  const vani=rapporto.aperture.filter(o=>!o.escluso&&ids.has(o.wall)).map(o=>{
    const raw=rapporto.muri.find(w=>w.id===o.wall),w=muri.find(w=>w.id===o.wall),i=raw.a[0]===raw.b[0]?1:0,dir=Math.sign(raw.b[i]-raw.a[i]);
    // Arrotonda gli estremi nello stesso riferimento del muro: offset+larghezza
    // arrotondati separatamente possono oltrepassare lo stipite di 1 mm.
    const estremo=d=>{const p=[...raw.a];p[i]+=dir*d;return (punto(p)[i]-w.a[i])*dir;};
    const offset=estremo(o.offset),fine=estremo(o.offset+o.width);
    return {id:o.id,wall:o.wall,offset,width:fine-offset,type:o.type,height:Math.min(altezza,o.type==='porta'?2100:1200),sill:o.type==='porta'?0:Math.min(900,Math.max(0,altezza-1200))};
  });
  const floors=rapporto.stanze.filter(s=>!s.escluso).map((s,i)=>({id:`auto_pav_${i+1}`,poligono:s.poligono.map(punto),materiale:'gres'}));
  return {muri,vani,floors};
}
