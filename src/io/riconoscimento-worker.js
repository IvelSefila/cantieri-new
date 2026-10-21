// Dipendenze vendorizzate, caricate solo dentro questo worker.
importScripts('../../vendor/opencv/opencv.js','../../vendor/simplify/simplify.js');
// Questo build espone un thenable che restituisce se stesso: non risolverlo in una Promise.
const pronto=new Promise(resolve=>{self.cv.then(()=>resolve());});
self.onmessage=async({data:input})=>{
  const alloc=[];const keep=x=>(alloc.push(x),x);
  try{
    await pronto;const cv=self.cv;
    const {rilevaMuriRaster}=await import('./raster-muri.js?v=v20261021a');
    const {collegaAperture}=await import('./riconoscimento-geometria.js');
    const {width,height}=input;
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<8||height<8||width*height>2200000||input.data.length!==width*height*4)throw Error('Raster non valido');
    for(let i=0;i<input.data.length;i+=4){const a=input.data[i+3]/255;if(a<1){for(let j=0;j<3;j++)input.data[i+j]=input.data[i+j]*a+255*(1-a);input.data[i+3]=255;}}
    const src=keep(cv.matFromImageData(input)),gray=keep(new cv.Mat()),bin=keep(new cv.Mat());
    cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);
    if(cv.mean(gray)[0]<80)cv.bitwise_not(gray,gray);
    const hist=new Uint32Array(256);for(const v of gray.data)hist[v]++;
    let tono=180;for(let i=181;i<247;i++)if(hist[i]>hist[tono])tono=i;
    const riempita=hist[tono]>width*height*.06&&hist[255]>width*height*.1;
    let interni=null,interniRaw=null,esterni=null;
    if(riempita){
      const impronta=keep(cv.Mat.zeros(height,width,cv.CV_8UC1));
      for(let i=0;i<gray.data.length;i++)impronta.data[i]=gray.data[i]>170&&Math.abs(gray.data[i]-tono)<12?1:0;
      interniRaw=new Uint8Array(impronta.data);
      const bianco=keep(cv.Mat.zeros(height,width,cv.CV_8UC1)),etichette=keep(new cv.Mat()),stat=keep(new cv.Mat()),centri=keep(new cv.Mat());
      for(let i=0;i<gray.data.length;i++)bianco.data[i]=gray.data[i]>=249?255:0;
      cv.connectedComponentsWithStats(bianco,etichette,stat,centri,4,cv.CV_32S);
      const bordi=new Set();for(let x=0;x<width;x++){bordi.add(etichette.intAt(0,x));bordi.add(etichette.intAt(height-1,x));}for(let y=0;y<height;y++){bordi.add(etichette.intAt(y,0));bordi.add(etichette.intAt(y,width-1));}bordi.delete(0);
      esterni=Uint8Array.from(etichette.data32S,v=>bordi.has(v)?1:0);
      // Colma i vuoti bianchi di scale/ascensori e simboli dentro la campitura.
      // Serve solo come indizio di interno/esterno, mai come geometria del muro.
      const lato=Math.max(3,Math.round(Math.min(width,height)*.14))|1;
      const k=keep(cv.Mat.ones(lato,lato,cv.CV_8UC1));
      cv.morphologyEx(impronta,impronta,cv.MORPH_CLOSE,k);interni=new Uint8Array(impronta.data);
    }
    // Fondo grigio/arredi chiari esclusi; nessuna riduzione del tratto sottile dei simboli.
    cv.threshold(gray,bin,115,255,cv.THRESH_BINARY_INV);
    const dimensione=Math.max(2,Math.round(Math.min(width,height)/220));
    const kernel=keep(cv.Mat.ones(dimensione,dimensione,cv.CV_8UC1)),wallMask=keep(new cv.Mat()),symbols=keep(new cv.Mat());
    // Simboli sottili restano in bin per la classificazione; non devono fondere i muri.
    // Con kernel pari l'opening predefinito trasla i tratti di un pixel.
    // Ancore complementari conservano le coordinate del documento originale.
    cv.erode(bin,wallMask,kernel,new cv.Point(0,0));
    cv.dilate(wallMask,wallMask,kernel,new cv.Point(dimensione-1,dimensione-1));
    cv.threshold(gray,symbols,riempita?Math.min(248,tono-2):225,255,cv.THRESH_BINARY_INV);
    const rgba=new Uint8ClampedArray(width*height*4);
    for(let i=0;i<width*height;i++){rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=wallMask.data[i]?0:255;rgba[i*4+3]=255;}
    const base=rilevaMuriRaster({data:rgba,width,height},{minLunghezza:Math.max(10,Math.min(width,height)*.025),minRapporto:2.4});
    const spessori=base.muri.filter(w=>Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1])>Math.min(width,height)*.2).map(w=>w.spessore_px).sort((a,b)=>a-b);
    const spessoreStrutturale=spessori[Math.floor(spessori.length*.75)]||4;
    if(interniRaw)base.muri=base.muri.filter(w=>{
      const i=w.a[0]===w.b[0]?1:0,j=1-i,L=w.b[i]-w.a[i],campi=[];
      for(const verso of [-1,1]){
        let floor=0,fuori=0,n=0;
        for(let u=.15;u<.9;u+=.08){const p=[...w.a];p[i]+=L*u;p[j]+=verso*(w.spessore_px/2+3);const x=Math.round(p[0]),y=Math.round(p[1]);if(x<0||x>=width||y<0||y>=height)continue;const pos=y*width+x;floor+=interniRaw[pos];fuori+=esterni[pos];n++;}
        campi.push({floor:floor/Math.max(1,n),fuori:fuori/Math.max(1,n)});
      }
      return L>Math.min(width,height)*.2||(campi[0].floor>.25&&campi[1].floor>.25)||(campi[0].floor>.25&&campi[1].fuori>.3)||(campi[1].floor>.25&&campi[0].fuori>.3)||(w.spessore_px>=spessoreStrutturale*.8&&Math.max(campi[0].fuori,campi[1].fuori)>.5);
    });
    if(interniRaw)base.muri=base.muri.filter(w=>!base.muri.some(v=>{
      if(v===w||w.spessore_px>v.spessore_px*.7)return false;
      const i=w.a[0]===w.b[0]?1:0,j=1-i;
      if(v.a[j]!==v.b[j])return false;
      const distanza=Math.abs(w.a[j]-v.a[j]);
      const overlap=Math.min(w.b[i],v.b[i])-Math.max(w.a[i],v.a[i]);
      return distanza<=(w.spessore_px+v.spessore_px)*1.5&&overlap>(w.b[i]-w.a[i])*.7;
    }));
    const risultato=collegaAperture(base.muri,symbols.data,width,height,{interni,solido:bin.data});
    const barrier=keep(cv.Mat.zeros(height,width,cv.CV_8UC1));
    for(const w of risultato.muri)cv.line(barrier,new cv.Point(...w.a.map(Math.round)),new cv.Point(...w.b.map(Math.round)),new cv.Scalar(255),Math.max(2,Math.round(w.spessore_px)));
    // Stanze dal modello ricostruito: sanitari, scritte e battenti non sono pareti.
    // Ripara soltanto giunzioni piccole; non chiude porte prive di evidenza grafica.
    const giunzioni=keep(cv.Mat.ones(3,3,cv.CV_8UC1));
    cv.morphologyEx(barrier,barrier,cv.MORPH_CLOSE,giunzioni);
    const free=keep(new cv.Mat());cv.bitwise_not(barrier,free);
    const labels=keep(new cv.Mat()),stats=keep(new cv.Mat()),centers=keep(new cv.Mat());
    const count=cv.connectedComponentsWithStats(free,labels,stats,centers,4,cv.CV_32S),stanze=[];
    for(let l=1;l<count&&stanze.length<100;l++){
      const x=stats.intAt(l,cv.CC_STAT_LEFT),y=stats.intAt(l,cv.CC_STAT_TOP),w=stats.intAt(l,cv.CC_STAT_WIDTH),h=stats.intAt(l,cv.CC_STAT_HEIGHT),area=stats.intAt(l,cv.CC_STAT_AREA);
      if(x===0||y===0||x+w>=width||y+h>=height||area<Math.max(64,width*height*.0008))continue;
      // Non ci sono archi/scritte in barrier: il vecchio filtro dei settori
      // dei battenti eliminava intere camere e bagni vicini a un vano largo.
      const region=cv.Mat.zeros(height,width,cv.CV_8UC1),contours=new cv.MatVector(),hier=new cv.Mat();
      try{
        for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)if(labels.intAt(py,px)===l)region.ucharPtr(py,px)[0]=255;
        cv.findContours(region,contours,hier,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
        if(!contours.size())continue;
        const cnt=contours.get(0);
        try{
          const pts=[];for(let i=0;i<cnt.data32S.length;i+=2)pts.push({x:cnt.data32S[i],y:cnt.data32S[i+1]});
          if(pts.length)pts.push({...pts[0]});
          const poligono=self.simplify(pts,1.5,true).slice(0,-1).map(p=>[p.x,p.y]);
          if(poligono.length>=3)stanze.push({id:`stanza_${stanze.length+1}`,nome:`Stanza ${stanze.length+1}`,poligono,area_px:area});
        }finally{cnt.delete();}
      }finally{region.delete();contours.delete();hier.delete();}
    }
    self.postMessage({...risultato,stanze,motore:'OpenCV + Simplify.js / geometria Cantieri',versione:cv.getBuildInformation().split('\n').find(x=>x.includes('General configuration'))?.trim(),avvisi:['Riconoscimento geometrico sperimentale: controllare aperture, stanze e muri.','Le stanze sono contorni chiusi, non una classificazione della destinazione d\u0027uso.','Muri obliqui, simboli insoliti, scansioni deformate e arredi possono richiedere correzioni.']});
  }catch(e){self.postMessage({errore:typeof e==='number'?`OpenCV errore ${e}`:e.message||String(e)});}
  finally{for(const x of alloc.reverse())x.delete();}
};
