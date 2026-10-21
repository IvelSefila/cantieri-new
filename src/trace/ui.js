// Interfaccia del tracciamento su immagine: canvas, clic, overlay, esporta e invia al 3D.
import { nuovoStato, calibra, clicMuro, clicVano, annulla, annullaPunto, toPlan, mmToPx } from "./tracer.js?v=v20261021a";
import { validatePlan } from "../core/model.js?v=v20261021a";
import { segmentiPdf, calibrazioneScalaPdf, pianoDaSegmenti } from "../io/pdf-plan.js?v=v20261021a";
import { rilevaMuriRaster, stimaScalaRaster } from '../io/raster-muri.js?v=v20261021h';

import { riconosciCasa } from '../io/riconoscimento-locale.js?v=1';
import { elementiInMm } from '../io/riconoscimento-geometria.js?v=v20261021h';

export function montaTracciamento(root, { onPianta }) {
  let stato = nuovoStato({ spessore: 250, altezza: 2800, snapMm: 10 });
  let img = null;
  let modo = "calibra"; // calibra0 | calibra1 | calibra2 | muro | vano
  let punti = []; // clic di calibrazione in attesa (px)
  const $ = (sel) => root.querySelector(sel);
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const stato_txt = $(".trc-stato");
  let pdfDoc = null, pdfViewport = null, vettori = [], selezionati = new Set(), nomeFile = '', sequenza = 0;
  let verificaQuota = null;
  let direzioneCal = null;
  let cachePagine = new Map();
  let rilevati=[], rapportoAuto=null, automaticoUsato=false;
  let copiaMetrica=null, analisiController=null;
  const dettagli=document.createElement('details');dettagli.id='trc-riconoscimento-dettagli';
  const riepilogo=document.createElement('summary');riepilogo.textContent='Controlla porte, finestre e stanze';
  const lista=document.createElement('div');dettagli.append(riepilogo,lista);root.prepend(dettagli);
  const stima=document.createElement('input');stima.type='checkbox';stima.id='trc-stima';stima.setAttribute('role','switch');
  const stimaLabel=document.createElement('label');stimaLabel.append(stima,' Stima automatica misure — ON: 3D indicativo; OFF: calibra e verifica quote');
  root.prepend(stimaLabel);
  function applicaStima() {
    const candidati=rilevati.filter(w=>!w.escluso);
    const sorgente=candidati.length?candidati:stato.muri.map(w=>({a:w.a,b:w.b,spessore_px:w.t}));
    const cal=stimaScalaRaster(sorgente,rapportoAuto?.aperture);
    if(stato.muri.length&&stato.cal) {
      const vecchia=stato.cal,ratio=cal.mmPerPx/(candidati.length?vecchia.mmPerPx:1);
      stato={...stato,muri:stato.muri.map(w=>({...w,a:w.a.map(x=>Math.round(x*ratio)),b:w.b.map(x=>Math.round(x*ratio)),t:Math.max(2,Math.round(w.t*ratio/2)*2)})),vani:stato.vani.map(v=>({...v,offset:Math.round(v.offset*ratio),width:Math.round(v.width*ratio)})),storia:[],pending:null,pendingVano:null};
      stato.cal={...vecchia,mmPerPx:vecchia.mmPerPx*ratio};
    } else stato={...stato,cal};
    modo='auto';punti=[];
  }
  stima.onchange=()=>{
    try {
      if(stima.checked){copiaMetrica={stato,verificaQuota,automaticoUsato};applicaStima();}
      else if(copiaMetrica){stato=copiaMetrica.stato;verificaQuota=copiaMetrica.verificaQuota;automaticoUsato=copiaMetrica.automaticoUsato;copiaMetrica=null;dettagli.inert=automaticoUsato;}
      verificaBar.hidden=stima.checked;
      $('#trc-calibra').disabled=stima.checked;usaScala.disabled=stima.checked;
      autoInfo.textContent=stima.checked?'Dimensioni STIMATE: scala ricavata dai simboli delle porte o dallo spessore dei muri, ingombro 4–30 m. Proporzioni conservate; nessuna quota reale verificata. Usa i muri rilevati e invia al 3D.':'Modalità metrica: calibra e verifica la seconda quota. Ripristinato il tracciato precedente alla stima.';
      infoVettori();disegna();aggiornaInfo(stima.checked?'Dimensioni stimate.':'Modalità metrica.');
    }catch(e){stima.checked=false;copiaMetrica=null;autoInfo.textContent=e.message;}
  };
  const autoBar=document.createElement('div');autoBar.className='riga-azioni';
  const riconosci=document.createElement('button');riconosci.id='trc-auto';riconosci.textContent='Riconosci casa dalla tavola';
  const usaAuto=document.createElement('button');usaAuto.id='trc-auto-usa';usaAuto.textContent='Usa muri, porte, finestre e stanze';usaAuto.disabled=true;
  const generaCasa=document.createElement('button');generaCasa.id='trc-genera-casa';generaCasa.textContent='Genera casa 3D indicativa con porte e finestre';generaCasa.disabled=true;
  const completa=document.createElement('input');completa.type='checkbox';completa.id='trc-completa';completa.checked=true;
  const completaLabel=document.createElement('label');completaLabel.append(completa,' Monta porte e finestre dimostrative (non riconoscimento dei prodotti)');
  const autoInfo=document.createElement('div');autoInfo.id='trc-auto-info';autoInfo.setAttribute('role','status');
  autoBar.append(generaCasa,completaLabel,riconosci,usaAuto,autoInfo);root.prepend(autoBar);
  function aggiornaDettagli() {
    lista.replaceChildren();
    for(const o of rapportoAuto?.aperture||[]){
      const row=document.createElement('label'),check=document.createElement('input'),tipo=document.createElement('select');
      check.type='checkbox';check.checked=!o.escluso;check.setAttribute('aria-label',`Includi ${o.id}`);
      for(const [value,text]of [['porta','Porta'],['finestra','Finestra']])tipo.add(new Option(text,value));
      tipo.value=o.type;tipo.setAttribute('aria-label',`Tipo ${o.id}`);
      check.onchange=()=>{o.escluso=!check.checked;disegna();};tipo.onchange=()=>{o.type=tipo.value;disegna();};
      row.append(check,tipo,` ${o.id}: ${o.inferita?'IPOTESI — ':''}${o.indizio}. Da controllare.`);lista.append(row,document.createElement('br'));
    }
    for(const s of rapportoAuto?.stanze||[]){
      const row=document.createElement('label'),check=document.createElement('input'),nome=document.createElement('input');
      check.type='checkbox';check.checked=!s.escluso;check.setAttribute('aria-label',`Includi ${s.id}`);
      nome.value=s.nome;nome.setAttribute('aria-label',`Nome ${s.id}`);nome.maxLength=80;
      check.onchange=()=>{s.escluso=!check.checked;disegna();};nome.oninput=()=>{s.nome=nome.value;disegna();};
      row.append(check,nome);lista.append(row,document.createElement('br'));
    }
    const nota=document.createElement('p');nota.textContent=`${rapportoAuto?.dubbi?.length||0} interruzioni senza simboli certi: lasciate aperte. Puoi completarle con Muro e Vano. Questa lista si applica prima di usare i rilevamenti.`;lista.append(nota);
  }
  async function analizzaImmagine() {
    if(!img)return;
    if(stato.muri.length){autoInfo.textContent='Per conservare le modifiche, riapri la tavola prima di riconoscerla di nuovo.';return;}
    analisiController?.abort();const controller=new AbortController();analisiController=controller;
    riconosci.disabled=true;usaAuto.disabled=true;generaCasa.disabled=true;stima.disabled=true;
    autoInfo.textContent='Analisi locale di muri, simboli e stanze in corso...';
    const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,k=Math.min(1,1400/Math.max(w,h));
    const buffer=document.createElement('canvas');buffer.width=Math.round(w*k);buffer.height=Math.round(h*k);
    const c=buffer.getContext('2d',{willReadFrequently:true});c.drawImage(img,0,0,buffer.width,buffer.height);
    try{
      rapportoAuto=await riconosciCasa(c.getImageData(0,0,buffer.width,buffer.height),{signal:controller.signal});
    }catch(e){
      if(controller.signal.aborted)return;
      rapportoAuto={...rilevaMuriRaster(c.getImageData(0,0,buffer.width,buffer.height)),aperture:[],stanze:[],dubbi:[],avvisi:[`Motore completo non disponibile: ${e.message}. Eseguita soltanto analisi muri.`]};
    }finally{if(analisiController===controller){riconosci.disabled=false;stima.disabled=false;}}
    if(controller.signal.aborted)return;
    rilevati=rapportoAuto.muri.map(s=>({...s,a:s.a.map(x=>x/k),b:s.b.map(x=>x/k),spessore_px:s.spessore_px/k}));
    rapportoAuto={...rapportoAuto,muri:rilevati,aperture:rapportoAuto.aperture.map(o=>({...o,offset:o.offset/k,width:o.width/k})),stanze:rapportoAuto.stanze.map(s=>({...s,poligono:s.poligono.map(p=>p.map(v=>v/k))}))};
    autoInfo.textContent=`${rilevati.length} tratti murari candidati (arancioni), ${rapportoAuto.aperture.filter(o=>o.type==='porta').length} porte, ${rapportoAuto.aperture.filter(o=>o.type==='finestra').length} finestre, ${rapportoAuto.stanze.length} stanze. Controlla i rilevamenti, scegli scala stimata ON oppure quote verificate OFF, poi usa il risultato. ${rapportoAuto.motore?'':rapportoAuto.avvisi.join(' ')}`;
    usaAuto.disabled=!rilevati.length;generaCasa.disabled=!rilevati.length;
    if(stima.checked&&rilevati.length)applicaStima();
    aggiornaDettagli();disegna();
  }
  riconosci.onclick=()=>analizzaImmagine().catch(e=>{autoInfo.textContent=e.message;});
  usaAuto.onclick=()=>{
    try {
      if(stato.muri.length)throw Error('Per conservare il lavoro esistente, apri nuovamente la tavola prima di sostituire i muri.');
      if(!stato.cal)throw Error('Conferma una distanza reale oppure attiva Stima automatica misure');
      const {muri,vani}=elementiInMm(rapportoAuto,stato.cal,stato.altezza);
      if(!muri.length)throw Error('Nessun muro utilizzabile: controlla scala e selezione.');
      const v=validatePlan({...toPlan(stato),walls:muri,openings:vani});if(!v.ok)throw Error(v.errors.join('; '));
      stato={...stato,muri,vani,storia:[{muri:[],vani:[]}],pending:null,pendingVano:null};automaticoUsato=true;dettagli.inert=true;
      autoInfo.textContent=`${muri.length} muri e ${vani.length} aperture ricostruiti. ${stima.checked?'Dimensioni stimate: puoi inviare al 3D.':'Verifica la seconda quota, poi premi Invia al 3D.'} Altezza muri configurabile. Le aperture restano modificabili nel progetto.`;
      aggiornaInfo('Analisi automatica della tavola.');infoVettori();disegna();
    }catch(e){autoInfo.textContent=e.message;}
  };
  const verificaBar = document.createElement('div');verificaBar.className='riga-azioni';
  const quotaNota = document.createElement('input');quotaNota.id='trc-verifica-dist';quotaNota.type='number';quotaNota.min='1';quotaNota.value='4000';quotaNota.style.width='85px';
  const verificaBtn = document.createElement('button');verificaBtn.id='trc-verifica';verificaBtn.textContent='Verifica seconda quota';
  const quotaLabel=document.createElement('label');quotaLabel.append('Seconda quota reale (mm) ',quotaNota);
  const verificaInfo=document.createElement('div');verificaInfo.id='trc-verifica-info';verificaInfo.setAttribute('role','status');
  verificaBar.append(quotaLabel,verificaBtn,verificaInfo);root.prepend(verificaBar);
  verificaBtn.onclick=()=>{if(!stato.cal)return aggiornaInfo('Prima calibra o conferma la scala PDF.');punti=[];modo='verifica0';aggiornaInfo('Seconda quota: clicca il primo estremo, poi il secondo.');};
  const pdfBar = document.createElement('div');
  pdfBar.className = 'riga-azioni';
  pdfBar.hidden = true;
  const pagina = document.createElement('select'); pagina.id = 'trc-pagina'; pagina.setAttribute('aria-label','Pagina PDF');
  const scala = document.createElement('input'); scala.id = 'trc-scala-pdf'; scala.type = 'number'; scala.min = '1'; scala.value = '100'; scala.style.width = '75px';
  const usaScala = document.createElement('button'); usaScala.textContent = 'Applica scala PDF';
  const seleziona = document.createElement('button'); seleziona.textContent = 'Seleziona segmenti'; seleziona.id = 'trc-seleziona';
  const tutti = document.createElement('button'); tutti.textContent = 'Seleziona tutti'; tutti.id = 'trc-tutti';
  const nessuno = document.createElement('button'); nessuno.textContent = 'Deseleziona';
  const genera = document.createElement('button'); genera.textContent = 'Genera 3D dai segmenti selezionati'; genera.id = 'trc-genera-pdf';
  const selezioneInfo = document.createElement('div'); selezioneInfo.id = 'trc-vettori-info'; selezioneInfo.className = 'hud-stat';
  const scalaLabel = document.createElement('label'); scalaLabel.append('Scala stampata 1:',scala);
  pdfBar.append('Pagina ',pagina,scalaLabel,usaScala,seleziona,tutti,nessuno,genera,selezioneInfo);
  root.prepend(pdfBar);
  const infoVettori = () => { selezioneInfo.textContent = `${vettori.length} segmenti vettoriali • ${selezionati.size} selezionati. Seleziona solo gli assi dei muri, escludendo quote e arredi. ${stato.cal ? `Scala: ${stato.cal.mmPerPx.toFixed(6)} mm/px.` : 'Prima calibra su una quota o conferma la scala stampata.'}`; genera.disabled = stima.checked || !stato.cal || !selezionati.size || !verificaQuota?.conforme; $('#trc-invia').disabled=(!stima.checked&&!verificaQuota?.conforme)||!stato.muri.length; };
  function resetVerifica() {verificaQuota=null;verificaInfo.textContent='Seconda quota da verificare.';infoVettori();}
  quotaNota.oninput=resetVerifica;

  function aggiornaInfo(msg) {
    const v = validatePlan(toPlan(stato));
    const errori = v.errors.length ? ` • errori: ${v.errors.length}` : "";
    const avvisi = v.warnings.length ? ` • avvisi: ${v.warnings.length}` : "";
    stato_txt.textContent = `${msg ?? ""} Muri: ${stato.muri.length} • Vani: ${stato.vani.length}${errori}${avvisi}`;
    usaAuto.disabled=riconosci.disabled||!rilevati.length||stato.muri.length>0;
    infoVettori();
  }

  function disegna() {
    if (!img) return;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    canvas.style.height = "auto";
    adattaCanvas();
    ctx.drawImage(img, 0, 0);
    const pixelSchermo=canvas.width/canvas.getBoundingClientRect().width;
    for(const s of rapportoAuto?.stanze||[]){
      if(s.escluso)continue;
      ctx.beginPath();s.poligono.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();
      ctx.fillStyle='rgba(0,170,170,.12)';ctx.fill();ctx.strokeStyle='rgba(0,150,160,.8)';ctx.lineWidth=pixelSchermo;ctx.stroke();
      const p=s.poligono.reduce((a,p)=>[a[0]+p[0]/s.poligono.length,a[1]+p[1]/s.poligono.length],[0,0]);
      ctx.font=`${12*pixelSchermo}px sans-serif`;ctx.fillStyle='#00636b';ctx.fillText(s.nome,...p);
    }
    if(!automaticoUsato)for(const w of rilevati) {
      if(w.escluso)continue;
      ctx.strokeStyle='rgba(245,125,15,.85)';ctx.lineWidth=Math.max(2*pixelSchermo,w.spessore_px);
      ctx.beginPath();ctx.moveTo(...w.a);ctx.lineTo(...w.b);ctx.stroke();
    }
    if(!automaticoUsato)for(const o of rapportoAuto?.aperture||[]){
      const w=rilevati.find(w=>w.id===o.wall);if(!w||w.escluso||o.escluso)continue;
      const L=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);
      const p=d=>w.a.map((x,i)=>x+(w.b[i]-x)*d/L);
      ctx.strokeStyle=o.type==='porta'?'#22a447':'#1979ed';ctx.lineWidth=Math.max(w.spessore_px,4*pixelSchermo);
      ctx.beginPath();ctx.moveTo(...p(o.offset));ctx.lineTo(...p(o.offset+o.width));ctx.stroke();
    }
    for (const s of vettori) {
      ctx.strokeStyle = selezionati.has(s.id) ? '#00b896' : 'rgba(65,120,235,.4)';
      ctx.lineWidth = (selezionati.has(s.id) ? 3 : 1.25)*pixelSchermo;
      ctx.beginPath(); ctx.moveTo(...s.a); ctx.lineTo(...s.b); ctx.stroke();
    }
    ctx.lineCap = "round";
    if (stato.cal) {
      for (const w of stato.muri) {
        const a = mmToPx(w.a, stato.cal);
        const b = mmToPx(w.b, stato.cal);
        ctx.strokeStyle = "rgba(30,64,175,0.9)";
        ctx.lineWidth = Math.max(2, (w.t / stato.cal.mmPerPx));
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      for (const v of stato.vani) {
        const w = stato.muri.find((m) => m.id === v.wall);
        if (!w) continue;
        const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
        const ux = (w.b[0] - w.a[0]) / L;
        const uy = (w.b[1] - w.a[1]) / L;
        const p1 = mmToPx([w.a[0] + ux * v.offset, w.a[1] + uy * v.offset], stato.cal);
        const p2 = mmToPx([w.a[0] + ux * (v.offset + v.width), w.a[1] + uy * (v.offset + v.width)], stato.cal);
        ctx.strokeStyle = "rgba(234,88,12,0.95)";
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      }
    }
    ctx.fillStyle = "#dc2626";
    for (const p of punti) { ctx.beginPath(); ctx.arc(p[0], p[1], 5*pixelSchermo, 0, Math.PI * 2); ctx.fill(); }
    if (stato.pending && stato.cal) {
      const q = mmToPx(stato.pending, stato.cal);
      ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, Math.PI * 2); ctx.fillStyle = "#16a34a"; ctx.fill();
    }
  }

  function daClic(ev) {
    const r = canvas.getBoundingClientRect();
    const k = canvas.width / r.width;
    return [(ev.clientX - r.left) * k, (ev.clientY - r.top) * k];
  }

  function istruzioni() {
    const testi = {
      calibra0: "Calibrazione 1/3: clicca l'angolo di origine.",
      calibra1: "Calibrazione 2/3: clicca un secondo punto di cui conosci la distanza.",
      calibra2: "Calibrazione: inserisci la distanza reale in mm.",
      muro: "Muro: due clic per segmento (Esc chiude il segmento in sospeso).",
      vano: "Vano: due clic sullo stesso muro.",
    };
    return testi[modo];
  }

  canvas.addEventListener("click", (ev) => {
    if (!img) return;
    let p = daClic(ev);
    // Sui PDF vettoriali aggancia gli estremi originali: lo zoom non altera la misura.
    if(vettori.length && modo!=='seleziona') {
      const tol=10*canvas.width/canvas.getBoundingClientRect().width;
      const v=vettori.flatMap(s=>[s.a,s.b]).map(q=>({q,d:Math.hypot(q[0]-p[0],q[1]-p[1])})).sort((a,b)=>a.d-b.d)[0];
      if(v?.d<=tol)p=v.q;
    }
    try {
      if(modo==='auto') {
        const toll=10*canvas.width/canvas.getBoundingClientRect().width;
        const vicino=rilevati.map(s=>{const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1],t=Math.max(0,Math.min(1,((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dy)/(dx*dx+dy*dy)));return {s,d:Math.hypot(p[0]-s.a[0]-dx*t,p[1]-s.a[1]-dy*t)};}).sort((a,b)=>a.d-b.d)[0];
        if(vicino?.d<=toll)vicino.s.escluso=!vicino.s.escluso;
        disegna();return;
      }
      if(modo==='verifica0') {punti=[p];modo='verifica1';disegna();return;}
      if(modo==='verifica1') {
        const attesa=Number(quotaNota.value);
        if(!Number.isFinite(attesa)||attesa<=0)throw Error('Seconda quota non valida');
        const v=[p[0]-punti[0][0],p[1]-punti[0][1]],lunghezza=Math.hypot(...v);
        if(lunghezza<2)throw Error('Scegli due estremi distinti della seconda quota.');
        if(direzioneCal && Math.abs(v[0]*direzioneCal[1]-v[1]*direzioneCal[0])/(lunghezza*Math.hypot(...direzioneCal))<.25)throw Error('Verifica una quota in una direzione diversa da quella di calibrazione.');
        const misurata=lunghezza*stato.cal.mmPerPx;
        const tolleranza=vettori.length?1:Math.max(1,stato.cal.mmPerPx,stato.cal.mmPerPx*canvas.width/canvas.getBoundingClientRect().width);
        verificaQuota={attesa_mm:attesa,misurata_mm:misurata,scarto_mm:misurata-attesa,tolleranza_mm:tolleranza,conforme:Math.abs(misurata-attesa)<=tolleranza+1e-6};
        verificaInfo.textContent=`${verificaQuota.conforme?'Quota compatibile':'Quota NON compatibile'}: ${misurata.toFixed(2)} mm, scarto ${verificaQuota.scarto_mm.toFixed(2)} mm, risoluzione di selezione ${tolleranza.toFixed(2)} mm. ${vettori.length?'':'Non attesta l’esattezza metrica della scansione.'}`;
        punti=[];modo='muro';infoVettori();disegna();return;
      }
      if (modo === 'seleziona') {
        const toll = 10 * canvas.width / canvas.getBoundingClientRect().width;
        const vicino = vettori.map(s => {
          const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1],t=Math.max(0,Math.min(1,((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dy)/(dx*dx+dy*dy)));
          return {s,d:Math.hypot(p[0]-s.a[0]-t*dx,p[1]-s.a[1]-t*dy)};
        }).sort((a,b)=>a.d-b.d)[0];
        if(vicino && vicino.d<=toll) { if(selezionati.has(vicino.s.id)) selezionati.delete(vicino.s.id); else selezionati.add(vicino.s.id); }
        infoVettori(); disegna(); return;
      }
      if (modo === "calibra0") { punti = [p]; modo = "calibra1"; }
      else if (modo === "calibra1") {
        punti = [punti[0], p];
        const dist = Number($("#trc-dist").value);
        if (!Number.isInteger(dist) || dist <= 0) { punti = []; modo = "calibra0"; aggiornaInfo("Distanza non valida: ricalibra."); disegna(); return; }
        stato = calibra(stato, punti[0], punti[1], dist);
        direzioneCal=[punti[1][0]-punti[0][0],punti[1][1]-punti[0][1]];
        resetVerifica();
        punti = [];
        modo = rilevati.length ? 'auto' : 'muro';
      } else if (modo === "muro") {
        stato = clicMuro(stato, p);
      } else if (modo === "vano") {
        const tipo = $("#trc-tipo").value;
        const h = Number($("#trc-altezza").value);
        const sill = Number($("#trc-sill").value);
        stato = clicVano(stato, p, tipo, h, sill);
        if (stato.errore) aggiornaInfo(stato.errore);
      }
    } catch (e) {
      aggiornaInfo(`Errore: ${e.message}`);
      disegna(); return;
    }
    aggiornaInfo(stato.errore||istruzioni());
    disegna();
  });

  function reset() {
    analisiController?.abort();analisiController=null;riconosci.disabled=false;stima.disabled=false;lista.replaceChildren();dettagli.inert=false;dettagli.open=false;
    copiaMetrica=null;stima.checked=false;verificaBar.hidden=false;$('#trc-calibra').disabled=false;usaScala.disabled=false;
    generaCasa.disabled=true;
    rilevati=[];rapportoAuto=null;automaticoUsato=false;autoInfo.textContent='';usaAuto.disabled=true;
    stato = nuovoStato({spessore:Number($('#trc-spessore').value),altezza:Number($('#trc-altezza-muri').value),snapMm:Number($('#trc-snap').value)});
    punti=[]; modo='calibra0'; direzioneCal=null;selezionati=new Set();resetVerifica();
  }
  async function mostraPagina(numero, token=sequenza) {
    const documento=pdfDoc,cache=cachePagine;
    const page = await documento.getPage(numero);
    const base = page.getViewport({scale:1});
    const viewport = page.getViewport({scale:Math.min(3,3200/Math.max(base.width,base.height))});
    // PDF.js converte i path in Path2D durante render(): conserva prima i segmenti.
    let letti=cache.get(numero);
    if(!letti) {
      const ops=await page.getOperatorList();
      letti=segmentiPdf(ops,(await import('../../vendor/pdfjs/pdf.mjs')).OPS,viewport);
      cache.set(numero,letti);
    }
    if(token!==sequenza)return;
    const buffer = document.createElement('canvas'); buffer.width=Math.ceil(viewport.width); buffer.height=Math.ceil(viewport.height);
    await page.render({canvasContext:buffer.getContext('2d'),viewport}).promise;
    if(token!==sequenza) return;
    img=buffer; pdfViewport=viewport; vettori=letti.segmenti; reset(); infoVettori(); disegna();
    await analizzaImmagine();
    aggiornaInfo(`${nomeFile} • pagina ${numero}/${pdfDoc.numPages}. ${vettori.length ? 'Conferma scala e segmenti prima di generare.' : 'Scansione o pagina senza segmenti: calibra e traccia i muri.'} Elementi non lineari esclusi: ${letti.esclusi}.`);
  }
  async function caricaFile(f) {
    if(!f) return;
    if(f.size>50*1024*1024) throw new Error('File oltre 50 MB');
    const token=++sequenza;
    nomeFile=f.name || 'Tavola';
    img=null;pdfViewport=null;vettori=[];cachePagine=new Map();pdfBar.hidden=true;reset();
    const precedente=pdfDoc; pdfDoc=null;
    if(precedente) await precedente.destroy();
    if(/\.pdf$/i.test(f.name) || f.type==='application/pdf') {
      const pdfjs=await import('../../vendor/pdfjs/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc=new URL('../../vendor/pdfjs/pdf.worker.mjs',import.meta.url).href;
      const doc=await pdfjs.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false,disableFontFace:true,stopAtErrors:true}).promise;
      if(token!==sequenza) { await doc.destroy(); return; }
      pdfDoc=doc; pagina.replaceChildren();
      for(let i=1;i<=doc.numPages;i++) pagina.add(new Option(String(i),String(i)));
      pdfBar.hidden=false;
      await mostraPagina(1,token);
    } else {
      const url=URL.createObjectURL(f);
      try {
        const image=new Image(); image.src=url; await image.decode();
        if(image.naturalWidth*image.naturalHeight>20000000) throw new Error('Immagine oltre 20 megapixel: riduci la risoluzione');
        if(token!==sequenza) return;
        img=image; pdfViewport=null; vettori=[]; pdfBar.hidden=true; reset(); disegna(); await analizzaImmagine();aggiornaInfo('Analisi automatica pronta. Calibra per assegnare le misure reali.');
      } finally { URL.revokeObjectURL(url); }
    }
  }
  $('#trc-file').addEventListener('change',async ev=>{
    try { await caricaFile(ev.target.files[0]); } catch(e) { aggiornaInfo(`Documento non caricato: ${e.message}`); }
    finally { ev.target.value=''; }
  });
  pagina.onchange=async()=>{
    const token=++sequenza;pagina.disabled=true;
    img=null;pdfViewport=null;vettori=[];reset();ctx.clearRect(0,0,canvas.width,canvas.height);aggiornaInfo('Lettura della pagina…');
    try { await mostraPagina(Number(pagina.value),token); }catch(e){aggiornaInfo(e.message);}
    finally{if(token===sequenza)pagina.disabled=false;}
  };
  usaScala.onclick=()=>{ try { if(stato.muri.length)throw Error('Annulla i muri tracciati prima di cambiare scala.'); stato={...stato,cal:calibrazioneScalaPdf(pdfViewport,Number(scala.value)),pending:null,pendingVano:null};direzioneCal=null; modo='seleziona';resetVerifica();disegna();aggiornaInfo('Scala confermata: verifica una seconda quota indipendente prima di usare il modello.'); } catch(e) { aggiornaInfo(e.message); } };
  seleziona.onclick=()=>{ modo='seleziona'; aggiornaInfo('Clicca i segmenti da usare come assi dei muri.'); };
  tutti.onclick=()=>{ selezionati=new Set(vettori.map(s=>s.id)); infoVettori(); disegna(); };
  nessuno.onclick=()=>{ selezionati.clear(); infoVettori(); disegna(); };
  genera.onclick=()=>{ try {
    const plan=pianoDaSegmenti(vettori.filter(s=>selezionati.has(s.id)),stato.cal,{spessore:stato.spessore,altezza:stato.altezza,nome:nomeFile});
    if(stima.checked)throw Error('In modalita stimata usa i rilevamenti della tavola');
    if(!verificaQuota?.conforme)throw Error('Verifica prima la seconda quota');
    plan.verifica_importazione.seconda_quota=verificaQuota;
    onPianta(plan); aggiornaInfo(`Generato da ${plan.walls.length} segmenti. Scarto massimo di arrotondamento ${plan.verifica_importazione.scarto_arrotondamento_max_mm.toFixed(3)} mm.`);
  } catch(e) { aggiornaInfo(e.message); } };

  const bottoni = {
    "#trc-calibra": () => { if(stato.muri.length)throw Error('Annulla i muri tracciati prima di ricalibrare.'); stato = { ...stato, cal: null, pending: null, pendingVano: null }; punti = []; modo = "calibra0";resetVerifica(); },
    "#trc-muro": () => { if (stato.cal) modo = "muro"; },
    "#trc-vano": () => { if (stato.cal) modo = "vano"; },
    "#trc-annulla": () => { stato = annulla(stato); if(!stato.muri.some(w=>w.id.startsWith('auto_'))){automaticoUsato=false;dettagli.inert=false;} },
    "#trc-esc": () => { stato = annullaPunto(stato); punti = []; },
  };
  for (const [sel, fn] of Object.entries(bottoni)) {
    $(sel).addEventListener("click", () => {
      try {fn();}catch(e){aggiornaInfo(e.message);return;}
      aggiornaInfo(istruzioni());
      disegna();
    });
  }

  // Zoom: lo schermo diventa piu' fine rispetto all'immagine; la precisione in mm resta quella dell'immagine.
  function adattaCanvas() {
    const w=root.querySelector('.trc-wrap').clientWidth;
    const k=Math.min(w/canvas.width,Math.max(180,innerHeight*.44)/canvas.height);
    canvas.style.width=`${canvas.width*k*Number($('#trc-zoom').value)}px`;
  }
  $('#trc-zoom').addEventListener('input',adattaCanvas);
  window.addEventListener('resize',adattaCanvas);

  $("#trc-spessore").addEventListener("change", (ev) => { stato = { ...stato, spessore: Number(ev.target.value) }; });
  $("#trc-altezza-muri").addEventListener("change", (ev) => { stato = { ...stato, altezza: Number(ev.target.value) }; });
  $("#trc-snap").addEventListener("change", (ev) => { stato = { ...stato, snapMm: Number(ev.target.value) }; });

  function progettoTracciato() {
    const plan = toPlan(stato, automaticoUsato ? "Casa riconosciuta dalla tavola" : "Planimetria tracciata su immagine");
    const v = validatePlan(plan);
    if (!v.ok || !stato.cal || !plan.walls.length || (!stima.checked&&!verificaQuota?.conforme))throw Error(v.errors[0] || 'calibra, verifica la seconda quota e traccia almeno un muro');
    plan.verifica_importazione={metodo:automaticoUsato?'raster_muri_automatici':'tracciamento_calibrato',scala_mm_px:stato.cal.mmPerPx,snap_mm:stato.snapMm,seconda_quota:verificaQuota};
    if(automaticoUsato){plan.fonte='Muri rilevati automaticamente da immagine, scala calibrata e verificata';plan.verifica_importazione.avvisi=rapportoAuto.avvisi;plan.verifica_importazione.porte_finestre_riconosciute=stato.vani.some(v=>v.id.startsWith('apertura_'));plan.verifica_importazione.classificazione='geometrica_non_neurale';plan.verifica_importazione.motore=rapportoAuto.motore||'rilevatore muri';plan.verifica_importazione.versione=rapportoAuto.versione||null;
      const elementi=elementiInMm(rapportoAuto,stato.cal,stato.altezza);plan.floors=rilevati.some(w=>w.escluso)?[]:elementi.floors;
      plan.verifica_importazione.stanze=rapportoAuto.stanze.filter(s=>!s.escluso).map(s=>({id:s.id,nome:s.nome}));plan.verifica_importazione.aperture=rapportoAuto.aperture.filter(o=>!o.escluso).map(o=>({id:o.id,indizio:o.indizio,punteggio:o.punteggio}));}
    plan.verifica_importazione.dimensioni_stimate=stima.checked;
    if(stima.checked){plan.fonte='Ricostruzione indicativa — dimensioni stimate, non misurate';plan.verifica_importazione.seconda_quota=null;plan.verifica_importazione.ipotesi_scala=stato.cal.ipotesi||'Scala indicativa';}
    if(automaticoUsato&&stima.checked&&completa.checked){
      plan.openings=plan.openings.map(o=>({...o,cdi:o.type==='porta'?'porta-filomuro-bianca':o.type==='scorrevole'?'scorrevole-alzante-pvc':'pvc-essenziale-4'}));
      plan.verifica_importazione.finiture_dimostrative=true;
      plan.verifica_importazione.avvisi=[...(plan.verifica_importazione.avvisi||[]),'Porte e finestre montate con modelli dimostrativi; prodotti, altezze e misure non rilevati dalla foto.'];
    }
    return plan;
  }
  generaCasa.onclick=()=>{
    try{
      if(!rapportoAuto?.muri.length)throw Error('Prima attendi il riconoscimento della tavola.');
      if(!stima.checked){stima.checked=true;stima.onchange();}
      if(!automaticoUsato)usaAuto.onclick();
      if(!automaticoUsato)throw Error(autoInfo.textContent);
      onPianta(progettoTracciato());
    }catch(e){autoInfo.textContent=`Casa non generata: ${e.message}`;}
  };
  $("#trc-invia").addEventListener("click", () => {
    try{onPianta(progettoTracciato());aggiornaInfo('Inviato al modello 3D.');}
    catch(e){aggiornaInfo(`Non inviato: ${e.message}`);}
  });

  $("#trc-esporta").addEventListener("click", () => {
    let plan;try{plan=progettoTracciato();}catch(e){aggiornaInfo(`Non esportato: ${e.message}`);return;}
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "planimetria-tracciata-mm.json";
    a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { stato = annullaPunto(stato); punti = []; aggiornaInfo(istruzioni()); disegna(); }
  });

  aggiornaInfo("Carica un'immagine per iniziare.");
  return { getStato: () => stato, caricaFile };
}
