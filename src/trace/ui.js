// Interfaccia del tracciamento su immagine: canvas, clic, overlay, esporta e invia al 3D.
import { nuovoStato, calibra, clicMuro, clicVano, annulla, annullaPunto, toPlan, mmToPx } from "./tracer.js?v=v20261021a";
import { validatePlan } from "../core/model.js?v=v20261021a";
import { segmentiPdf, calibrazioneScalaPdf, pianoDaSegmenti } from "../io/pdf-plan.js?v=v20261021a";

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
  const infoVettori = () => { selezioneInfo.textContent = `${vettori.length} segmenti vettoriali • ${selezionati.size} selezionati. Seleziona solo gli assi dei muri, escludendo quote e arredi. ${stato.cal ? `Scala: ${stato.cal.mmPerPx.toFixed(6)} mm/px.` : 'Prima calibra su una quota o conferma la scala stampata.'}`; genera.disabled = !stato.cal || !selezionati.size || !verificaQuota?.conforme; $('#trc-invia').disabled=!verificaQuota?.conforme; };
  function resetVerifica() {verificaQuota=null;verificaInfo.textContent='Seconda quota da verificare.';infoVettori();}
  quotaNota.oninput=resetVerifica;

  function aggiornaInfo(msg) {
    const v = validatePlan(toPlan(stato));
    const errori = v.errors.length ? ` • errori: ${v.errors.length}` : "";
    const avvisi = v.warnings.length ? ` • avvisi: ${v.warnings.length}` : "";
    stato_txt.textContent = `${msg ?? ""} Muri: ${stato.muri.length} • Vani: ${stato.vani.length}${errori}${avvisi}`;
  }

  function disegna() {
    if (!img) return;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    canvas.style.height = "auto";
    adattaCanvas();
    ctx.drawImage(img, 0, 0);
    const pixelSchermo=canvas.width/canvas.getBoundingClientRect().width;
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
      if(modo==='verifica0') {punti=[p];modo='verifica1';disegna();return;}
      if(modo==='verifica1') {
        const attesa=Number(quotaNota.value);
        if(!Number.isFinite(attesa)||attesa<=0)throw Error('Seconda quota non valida');
        const v=[p[0]-punti[0][0],p[1]-punti[0][1]],lunghezza=Math.hypot(...v);
        if(lunghezza<2)throw Error('Scegli due estremi distinti della seconda quota.');
        if(direzioneCal && Math.abs(v[0]*direzioneCal[1]-v[1]*direzioneCal[0])/(lunghezza*Math.hypot(...direzioneCal))<.25)throw Error('Verifica una quota in una direzione diversa da quella di calibrazione.');
        const misurata=lunghezza*stato.cal.mmPerPx;
        const tolleranza=vettori.length?1:Math.max(1,stato.cal.mmPerPx,stato.cal.mmPerPx*canvas.width/canvas.getBoundingClientRect().width);
        verificaQuota={attesa_mm:attesa,misurata_mm:misurata,scarto_mm:misurata-attesa,tolleranza_mm:tolleranza,conforme:Math.abs(misurata-attesa)<=tolleranza};
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
        modo = "muro";
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
        img=image; pdfViewport=null; vettori=[]; pdfBar.hidden=true; reset(); disegna(); aggiornaInfo(istruzioni());
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
    if(!verificaQuota?.conforme)throw Error('Verifica prima la seconda quota');
    plan.verifica_importazione.seconda_quota=verificaQuota;
    onPianta(plan); aggiornaInfo(`Generato da ${plan.walls.length} segmenti. Scarto massimo di arrotondamento ${plan.verifica_importazione.scarto_arrotondamento_max_mm.toFixed(3)} mm.`);
  } catch(e) { aggiornaInfo(e.message); } };

  const bottoni = {
    "#trc-calibra": () => { if(stato.muri.length)throw Error('Annulla i muri tracciati prima di ricalibrare.'); stato = { ...stato, cal: null, pending: null, pendingVano: null }; punti = []; modo = "calibra0";resetVerifica(); },
    "#trc-muro": () => { if (stato.cal) modo = "muro"; },
    "#trc-vano": () => { if (stato.cal) modo = "vano"; },
    "#trc-annulla": () => { stato = annulla(stato); },
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
    const plan = toPlan(stato, "Planimetria tracciata su immagine");
    const v = validatePlan(plan);
    if (!v.ok || !stato.cal || !plan.walls.length || !verificaQuota?.conforme)throw Error(v.errors[0] || 'calibra, verifica la seconda quota e traccia almeno un muro');
    plan.verifica_importazione={metodo:'tracciamento_calibrato',scala_mm_px:stato.cal.mmPerPx,snap_mm:stato.snapMm,seconda_quota:verificaQuota};
    return plan;
  }
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
