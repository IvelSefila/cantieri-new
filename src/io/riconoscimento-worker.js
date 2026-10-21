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
    // Fondo grigio/arredi chiari esclusi; nessuna riduzione del tratto sottile dei simboli.
    cv.threshold(gray,bin,115,255,cv.THRESH_BINARY_INV);
    const dimensione=Math.max(2,Math.round(Math.min(width,height)/220));
    const kernel=keep(cv.Mat.ones(dimensione,dimensione,cv.CV_8UC1)),wallMask=keep(new cv.Mat()),symbols=keep(new cv.Mat());
    // Simboli sottili restano in bin per la classificazione; non devono fondere i muri.
    cv.morphologyEx(bin,wallMask,cv.MORPH_OPEN,kernel);
    cv.threshold(gray,symbols,225,255,cv.THRESH_BINARY_INV);
    const rgba=new Uint8ClampedArray(width*height*4);
    for(let i=0;i<width*height;i++){rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=wallMask.data[i]?0:255;rgba[i*4+3]=255;}
    const base=rilevaMuriRaster({data:rgba,width,height},{minLunghezza:Math.max(10,Math.min(width,height)*.025)});
    const risultato=collegaAperture(base.muri,symbols.data,width,height);
    const barrier=keep(cv.Mat.zeros(height,width,cv.CV_8UC1));
    for(const w of risultato.muri)cv.line(barrier,new cv.Point(...w.a.map(Math.round)),new cv.Point(...w.b.map(Math.round)),new cv.Scalar(255),Math.max(2,Math.round(w.spessore_px)));
    // I simboli dei battenti e dei serramenti possono chiudere il contorno della stanza
    // anche quando non e' possibile classificarli come un'apertura del modello.
    cv.bitwise_or(barrier,symbols,barrier);
    // Ripara soltanto giunzioni piccole; non chiude porte prive di evidenza grafica.
    cv.morphologyEx(barrier,barrier,cv.MORPH_CLOSE,kernel);
    const free=keep(new cv.Mat());cv.bitwise_not(barrier,free);
    const labels=keep(new cv.Mat()),stats=keep(new cv.Mat()),centers=keep(new cv.Mat());
    const count=cv.connectedComponentsWithStats(free,labels,stats,centers,4,cv.CV_32S),stanze=[];
    for(let l=1;l<count&&stanze.length<100;l++){
      const x=stats.intAt(l,cv.CC_STAT_LEFT),y=stats.intAt(l,cv.CC_STAT_TOP),w=stats.intAt(l,cv.CC_STAT_WIDTH),h=stats.intAt(l,cv.CC_STAT_HEIGHT),area=stats.intAt(l,cv.CC_STAT_AREA);
      if(x===0||y===0||x+w>=width||y+h>=height||area<width*height*.004)continue;
      const cx=centers.doubleAt(l,0),cy=centers.doubleAt(l,1);
      const settoreBattente=risultato.aperture.some(o=>{
        if(o.type!=='porta'||area>o.width**2)return false;
        const muro=risultato.muri.find(w=>w.id===o.wall),L=Math.hypot(muro.b[0]-muro.a[0],muro.b[1]-muro.a[1]);
        const mid=muro.a.map((v,i)=>v+(muro.b[i]-v)*(o.offset+o.width/2)/L);
        return Math.hypot(cx-mid[0],cy-mid[1])<o.width;
      });
      if(settoreBattente)continue;
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
