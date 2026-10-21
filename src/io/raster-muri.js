// Analisi geometrica locale: tratti scuri rettilinei, senza modelli neurali o upload.
// Restituisce candidati, non una classificazione semantica di porte/finestre.
export function rilevaMuriRaster({data,width,height}, {soglia=115,minLunghezza=Math.max(20,Math.min(width,height)*.035),minSpessore=2,minRapporto=5}={}) {
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<8||height<8||width*height>2200000||data.length!==width*height*4)throw Error('Raster non valido o troppo grande');
  const mask=new Uint8Array(width*height);
  let neri=0;
  for(let i=0;i<mask.length;i++) {
    const k=i*4,a=data[k+3]/255;
    const lum=(.2126*data[k]+.7152*data[k+1]+.0722*data[k+2])*a+255*(1-a);
    if(lum<soglia){mask[i]=1;neri++;}
  }
  const candidati=[];
  function scandisci(verticale) {
    const n=verticale?height:width,m=verticale?width:height,gruppi=[];
    for(let asse=0;asse<m;asse++) {
      let start=-1;
      const fine=(end)=>{
        if(start<0||end-start<minLunghezza)return;
        // Una mazzetta corta non deve gonfiare lo spessore dell'intera parete:
        // il confronto sul minimo inglobava i pilastri e scartava le facciate corte.
        let g=gruppi.findLast(g=>g.fineAsse===asse-1 && Math.min(g.fine,end)-Math.max(g.inizio,start)>.85*Math.max(g.fine-g.inizio,end-start));
        if(g){g.inizio=Math.min(g.inizio,start);g.fine=Math.max(g.fine,end);g.fineAsse=asse;}
        else gruppi.push({inizio:start,fine:end,inizioAsse:asse,fineAsse:asse});
      };
      for(let t=0;t<=n;t++) {
        const nero=t<n&&mask[verticale?t*width+asse:asse*width+t];
        if(nero&&start<0)start=t;
        if(!nero&&start>=0){fine(t);start=-1;}
      }
    }
    for(const g of gruppi) {
      const sp=g.fineAsse-g.inizioAsse+1,L=g.fine-g.inizio;
      if(sp<minSpessore||sp>Math.min(width,height)*.06||L<sp*minRapporto)continue;
      const c=(g.inizioAsse+g.fineAsse)/2;
      candidati.push({a:verticale?[c,g.inizio]:[g.inizio,c],b:verticale?[c,g.fine]:[g.fine,c],spessore_px:sp});
    }
  }
  if(neri/mask.length>.65)return {muri:[],avvisi:['Immagine troppo scura: serve una planimetria scura su fondo chiaro.']};
  scandisci(false);scandisci(true);
  const muri=candidati.sort((a,b)=>Math.hypot(...a.b.map((x,i)=>x-a.a[i]))-Math.hypot(...b.b.map((x,i)=>x-b.a[i]))).slice(-600).map((w,i)=>({...w,id:`auto_${i+1}`}));
  return {muri,avvisi:['Rilevamento sperimentale di muri orizzontali e verticali. Quote, arredi e simboli possono generare falsi positivi.','Porte e finestre non classificate automaticamente. I vuoti tra segmenti restano aperti; verifica i collegamenti.'],frazione_scura:neri/mask.length};
}

export function muriRasterInMm(muri,cal) {
  if(!cal||!Number.isFinite(cal.mmPerPx)||cal.mmPerPx<=0)throw Error('Conferma una distanza reale prima di generare il 3D');
  const punto=p=>p.map((v,i)=>Math.round((v-cal.origine[i])*cal.mmPerPx));
  return muri.map((w,i)=>({id:`auto_${i+1}`,a:punto(w.a),b:punto(w.b),t:Math.max(2,Math.round(w.spessore_px*cal.mmPerPx/2)*2)})).filter(w=>Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1])>w.t);
}

// Ipotesi visiva: spessore mediano 250 mm, limitato da un ingombro di 4–30 m.
export function stimaScalaRaster(muri) {
  if(!muri.length)throw Error('Nessun muro da cui stimare la scala');
  const punti=muri.flatMap(w=>[w.a,w.b]);
  const origine=[0,1].map(i=>Math.min(...punti.map(p=>p[i])));
  const lato=Math.max(...[0,1].map(i=>Math.max(...punti.map(p=>p[i]))-origine[i]));
  const sp=muri.map(w=>w.spessore_px).filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b);
  if(!lato||!sp.length)throw Error('Geometria insufficiente per la stima');
  const mmPerPx=Math.min(30000/lato,Math.max(4000/lato,250/sp[Math.floor(sp.length/2)]));
  return {origine,mmPerPx};
}
