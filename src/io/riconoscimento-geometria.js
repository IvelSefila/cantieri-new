// Classificatore geometrico originale Cantieri. I punteggi sono indizi, non probabilita ML.
export function collegaAperture(muri, mask, width, height, {interni=null,solido=null}={}) {
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
    let lati=[];
    if(interni){
      for(const verso of [-1,1]){
        let n=0,hits=0;
        for(let u=lo+gap*.2;u<=hi-gap*.2;u+=Math.max(1,gap/12))for(const k of [1.5,2.5,4]){
          const p=pt(u,c+verso*Math.max(3,t*k)),x=Math.round(p[0]),y=Math.round(p[1]);
          if(x>=0&&x<width&&y>=0&&y<height){hits+=interni[y*width+x]?1:0;n++;}
        }
        lati.push(hits/Math.max(1,n));
      }
    }
    const adiacenti=lati.filter(v=>v>.6).length;
    const simbolo=gap>=t*3&&arco>=.65?'porta':righe>=2||(adiacenti===1&&righe===1)?'finestra':null;
    // Il riempimento della pianta distingue il confine esterno dai divisori.
    // Una finestra chiara non deve diventare un'interruzione a tutta altezza.
    const inferita=!simbolo&&adiacenti>0&&gap<=Math.min(width,height)*.2;
    const tipo=simbolo||(inferita?(adiacenti===1?'finestra':'porta'):null);
    return {tipo,arco,inferita,evidenza:righe>0||arco>.25};
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
      if(gap>Math.max(24,t*15,interni?Math.min(width,height)*.2:0)||gap<t*1.5){salva();cur={...s};vani=[];continue;}
      const lo=cur.hi,hi=s.lo;
      const {tipo,arco,inferita}=indizi(pt,c,t,lo,hi);
      if(tipo){vani.push({lo,hi,type:tipo,inferita,indizio:inferita?'continuita della parete e confine delle stanze':tipo==='finestra'?'linee parallele':'arco di apertura',punteggio:inferita?.6:tipo==='finestra'?.8:arco});cur.hi=s.hi;}
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
      const {tipo,arco,inferita}=indizi(pt,c,t,lo,hi);if(!tipo)continue;
      if(inferita){
        // Un montante corto puo' non superare il filtro dei segmenti. Accetta
        // l'estensione solo se esiste muro nero dentro il tratto, non per il solo
        // allineamento: altrimenti si inventerebbero divisori dentro le stanze.
        let supporto=0,run=0;
        for(let u=Math.ceil(lo+t*1.5);u<hi-t*1.5;u++){
          let n=0,hits=0;const h=Math.max(1,Math.floor(t/2));
          for(let v=-h;v<=h;v++){const p=pt(u,c+v),x=Math.round(p[0]),y=Math.round(p[1]);if(solido&&x>=0&&x<width&&y>=0&&y<height){n++;hits+=solido[y*width+x]?1:0;}}
          run=hits/Math.max(1,n)>.55?run+1:0;supporto=Math.max(supporto,run);
        }
        if(supporto<Math.max(2,t*.5))continue;
      }
      if(lato==='a')for(const o of aperture.filter(o=>o.wall===w.id))o.offset+=vicino.d;
      aperture.push({wall:w.id,offset:lato==='a'?0:end-w.a[i],width:vicino.d,type:tipo,inferita,indizio:inferita?'confine delle stanze a filo parete':tipo==='porta'?'arco a filo parete':'linee parallele a filo parete',punteggio:inferita?.6:tipo==='porta'?arco:.8});
      w[lato]=pt(target);
    }
  }
  const rifinite=[];
  for(const o of aperture){
    if(!solido){rifinite.push(o);continue;}
    const w=out.find(w=>w.id===o.wall),i=w.a[0]===w.b[0]?1:0,j=1-i,c=w.a[j],t=w.spessore_px;
    const pt=(u,v=c)=>i===0?[u,v]:[v,u],inizio=w.a[i]+o.offset,fine=inizio+o.width;
    const mezzo=Math.max(1,Math.floor(t/2)),pieni=[];
    let start=null;
    for(let u=Math.ceil(inizio);u<=Math.floor(fine);u++){
      let hits=0,n=0;for(let v=-mezzo;v<=mezzo;v++){const p=pt(u,c+v),x=Math.round(p[0]),y=Math.round(p[1]);if(x>=0&&x<width&&y>=0&&y<height){hits+=solido[y*width+x]?1:0;n++;}}
      const pieno=hits/Math.max(1,n)>.55;
      if(pieno&&start===null)start=u;
      if((!pieno||u===Math.floor(fine))&&start!==null){const end=pieno?u+1:u;if(end-start>=Math.max(2,t*.5))pieni.push([start,end]);start=null;}
    }
    let cursor=inizio;
    for(const [a,b]of [...pieni,[fine,fine]]){
      if(a-cursor>=Math.max(5,t*1.5)){
        const r=indizi(pt,c,t,cursor,a),tipo=r.tipo||o.type;
        rifinite.push({...o,lo:cursor,hi:a,offset:cursor-w.a[i],width:a-cursor,type:tipo,inferita:r.tipo?r.inferita:true,indizio:r.tipo&&!r.inferita?(tipo==='porta'?'arco di apertura':'linee del serramento'):o.indizio});
      }
      cursor=Math.max(cursor,b);
    }
  }
  const connessi=out.map(w=>({...w,a:[...w.a],b:[...w.b]}));
  for(const w of connessi){
    const i=w.a[0]===w.b[0]?1:0,j=1-i;
    for(const lato of ['a','b']){
      let best=null;
      for(const v of out){
        if(v.id===w.id||v.a[i]!==v.b[i])continue;
        const tol=(w.spessore_px+v.spessore_px)/2+1,d=Math.abs(v.a[i]-w[lato][i]);
        if(d>tol||w[lato][j]<Math.min(v.a[j],v.b[j])-tol||w[lato][j]>Math.max(v.a[j],v.b[j])+tol)continue;
        if(!best||d<best.d)best={d,pos:v.a[i]};
      }
      if(best)w[lato][i]=best.pos;
    }
  }
  const apertureFinali=rifinite.map(o=>{
    const old=out.find(w=>w.id===o.wall),w=connessi.find(w=>w.id===o.wall),i=w.a[0]===w.b[0]?1:0;
    const offset=Math.max(0,old.a[i]+o.offset-w.a[i]),fine=Math.min(w.b[i]-w.a[i],old.a[i]+o.offset+o.width-w.a[i]);
    return {...o,offset,width:fine-offset};
  }).filter(o=>o.width>0);
  return {muri:connessi,aperture:apertureFinali.map((o,i)=>({...o,id:`apertura_${i+1}`})),dubbi};
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
