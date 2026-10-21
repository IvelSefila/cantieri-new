import { apriArchivio } from '../io/archivio-planimetrie.js?v=v20261021g';
import { leggiPlanimetria } from '../io/planimetrie.js?v=v20261021g';
import { montaTracciamento } from '../trace/ui.js?v=v20261021g';

const el=(tag,testo)=>{const e=document.createElement(tag);if(testo)e.textContent=testo;return e;};
export function montaPlanimetrie(root,{getSessione,onApri}) {
  let attiva=null, archivio=null, generazione=0, revisioneElenco=0, occupato=false;
  const titolo=el('input'); titolo.id='pl-titolo';titolo.placeholder='Nome della planimetria';titolo.setAttribute('aria-label','Nome della planimetria');
  const salva=el('button','Salva progetto nella raccolta');salva.id='pl-salva';salva.disabled=true;
  const file=el('input'); file.type='file';file.id='pl-file';file.accept='.json,.dxf,.pdf,.png,.jpg,.jpeg,.webp';
  const label=el('label','Inserisci dal tuo PC: JSON, DXF, PDF, PNG, JPG o WebP');label.append(file);
  const stato=el('div','Le planimetrie e i documenti originali restano nel browser di questo PC.');stato.id='pl-stato';stato.setAttribute('role','status');
  const dettagli=el('details');dettagli.id='pl-dettagli';dettagli.hidden=true;
  const dettaglioTesto=el('p');dettagli.append(el('summary','Dettagli e avvisi di importazione'),dettaglioTesto);
  let importazione=null;
  const annulla=el('button','Annulla importazione');annulla.id='pl-annulla';annulla.hidden=true;
  annulla.onclick=()=>importazione?.abort();
  const controlli=el('div');controlli.className='riga-azioni';
  const rif=el('select');rif.id='pl-dxf-rif';rif.add(new Option('Assi dei muri','asse'));rif.add(new Option('Filo esterno (polilinee chiuse)','faccia_esterna'));
  const spessore=el('input');spessore.id='pl-spessore';spessore.type='number';spessore.min='2';spessore.step='2';spessore.value='250';spessore.style.width='80px';
  const r=el('label','Riferimento DXF ');r.append(rif);const t=el('label','Spessore muri (mm) ');t.append(spessore);controlli.append(r,t);
  const unita=el('select');unita.id='pl-dxf-unita';
  for(const [v,n]of [['','Automatiche dall’header'],['4','Millimetri'],['5','Centimetri'],['6','Metri'],['1','Pollici'],['2','Piedi']])unita.add(new Option(n,v));
  const u=el('label','Unità originali DXF (scelta manuale prevale sull’header) ');u.append(unita);controlli.append(u);
  const layerMuri=el('input');layerMuri.type='checkbox';layerMuri.id='pl-dxf-layer-muri';layerMuri.checked=true;
  const filtro=el('label','DXF: usa solo layer WALL / MURI se presenti (esclude quote e arredi) ');filtro.append(layerMuri);controlli.append(filtro);
  const elenco=el('div');elenco.id='pl-elenco';
  stato.style.cssText='padding:10px;border:1px solid #64748b;border-radius:8px;margin:8px 0;overflow-wrap:anywhere';
  root.append(el('h2','Dal PC'),label,stato,annulla,dettagli,controlli,el('h2','Progetto corrente'),titolo,salva,el('h2','In memoria su questo browser'),elenco,el('h2','Esempi'));
  const dialog=el('dialog');dialog.id='pl-editor';
  const chiudi=el('button','Chiudi tavola');chiudi.id='pl-chiudi';chiudi.onclick=()=>dialog.close();
  const trc=document.getElementById('trc-root');trc.classList.remove('avanzato');trc.open=true;
  trc.querySelector('#trc-file').closest('label').hidden=true;
  dialog.append(chiudi,trc);document.body.append(dialog);
  const traccia=montaTracciamento(trc,{onPianta:plan=>{
    const token=++generazione;
    const origine=plan.verifica_importazione?.metodo==='segmenti_pdf'?'pdf_vettoriale':'immagine';
    onApri(plan,attiva?.titolo || plan.name,{origine});
    dialog.close();
    if(!archivio){stato.textContent='Modello 3D generato. Archivio non disponibile: scarica il progetto JSON.';return;}
    archivio.salva({...attiva,progetto:getSessione(),titolo:attiva?.titolo || plan.name,origine}).then(async record=>{
      if(token!==generazione)return;attiva=record;await aggiorna();stato.textContent='Modello 3D generato e salvato nella raccolta.';
    }).catch(e=>{stato.textContent=`Modello generato; salvataggio non riuscito: ${e.message}. Scarica il progetto JSON.`;});
  }});
  function impostaOccupato(value){
    occupato=value;file.disabled=value;salva.disabled=value||!archivio;trc.inert=value;
    for(const b of elenco.querySelectorAll('button'))b.disabled=value;
    for(const b of root.querySelectorAll('.pl-esempio'))b.disabled=value;
  }
  async function mostraTavola(documento) {
    dialog.showModal();
    try { await traccia.caricaFile(documento); }
    catch(e) {dialog.close();throw e;}
  }
  async function aggiorna() {
    if(!archivio)return;
    const revisione=++revisioneElenco;
    const voci=await archivio.elenco();if(revisione!==revisioneElenco)return;elenco.replaceChildren();
    if(!voci.length)elenco.append(el('p','Nessuna planimetria salvata. Importa un file o salva il progetto corrente.'));
    for(const voce of voci) {
      const card=el('div');card.className='pl-card';card.append(el('strong',voce.titolo),el('div',`${voce.origine} · ${new Date(voce.modificato).toLocaleString('it-IT')}`));
      if(voce.progetto) {const apri=el('button','Apri modello');apri.onclick=()=>{try{++generazione;onApri(voce.progetto,voce.titolo,{origine:voce.origine});attiva=voce;titolo.value=voce.titolo;stato.textContent=`Aperta: ${voce.titolo}`;}catch(e){stato.textContent=e.message;}};card.append(apri);}
      if(voce.haDocumento) {const tavola=el('button','Apri tavola originale');tavola.onclick=async()=>{impostaOccupato(true);++generazione;try{const doc=await archivio.documento(voce.id);if(!doc)throw Error('Documento non presente');await mostraTavola(doc);attiva=voce;titolo.value=voce.titolo;}catch(e){stato.textContent=e.message;}finally{impostaOccupato(false);}};card.append(tavola);}
      elenco.append(card);
    }
    impostaOccupato(occupato);
  }
  file.onchange=async()=>{
    const f=file.files[0];if(!f)return;
    const token=++generazione;impostaOccupato(true);
    try {
      stato.textContent=`Lettura locale di ${f.name}…`;
      dettagli.hidden=true;dettagli.open=false;
      importazione=new AbortController();annulla.hidden=!f.name.toLowerCase().endsWith('.dxf');
      const letto=await leggiPlanimetria(f,{riferimento:rif.value,spessoreDefault:Number(spessore.value),unitaOriginali:unita.value,soloLayerMuri:layerMuri.checked,signal:importazione.signal});
      if(token!==generazione)return;
      if(letto.progetto) {
        onApri(letto.progetto,f.name,{origine:letto.formato,dxfReport:letto.report});
        attiva={titolo:f.name,origine:letto.formato};
        const messaggioArchivio=await salvaImportazione({...attiva,progetto:getSessione()});
        stato.textContent=`${f.name}: modello generato nel browser. ${letto.report ? `${letto.report.muri} segmenti muro. ${letto.report.avvisi.length} avvisi: apri i dettagli.` : 'Misure lette dal JSON in mm.'}`;
        if(letto.report){dettaglioTesto.textContent=`${letto.report.arrotondamenti} arrotondamenti, scarto massimo ${letto.report.scostamento_max_mm.toFixed(3)} mm. ${letto.report.avvisi.join('; ')}`;dettagli.hidden=false;}
        if(letto.report?.porte)stato.textContent+=` Porte: ${letto.report.porte.riconosciute} riconosciute, ${letto.report.porte.da_verificare} da verificare.`;
        if(letto.report?.scala_da_quote)stato.textContent+=` Scala ricavata dalle quote (fattore ${letto.report.scala_da_quote}), da verificare.`;
        stato.textContent+=messaggioArchivio;
      } else {
        // Prima decodifica e visualizza; un documento illeggibile non entra nell'archivio.
        attiva=null;await mostraTavola(f);
        attiva={titolo:f.name,origine:letto.formato};
        const messaggioArchivio=await salvaImportazione({...attiva,file:f});
        stato.textContent='Tavola analizzata localmente: controlla muri, porte, finestre e stanze. Stima ON per un modello indicativo senza quote; OFF per calibrazione e seconda quota. Sui PDF puoi anche selezionare gli assi vettoriali.'+messaggioArchivio;
      }
      titolo.value=f.name;await aggiorna();
    } catch(e) {stato.textContent=`Importazione non completata: ${e.message}`;}
    finally {importazione=null;annulla.hidden=true;impostaOccupato(false);file.value='';}
  };
  async function salvaImportazione(voce){
    if(!archivio)return ' Archivio non disponibile: conserva il file originale e scarica il progetto JSON.';
    try{attiva=await archivio.salva(voce);return '';}
    catch(e){return ` Archivio non aggiornato: ${e.message}. Conserva il file originale e scarica il progetto JSON.`;}
  }
  salva.onclick=async()=>{
    const token=++generazione;impostaOccupato(true);
    try{const record=await archivio.salva({titolo:titolo.value.trim() || getSessione().name,progetto:getSessione(),origine:'progetto'});if(token!==generazione)return;attiva=record;await aggiorna();stato.textContent='Progetto salvato nella raccolta locale.';}
    catch(e){stato.textContent=`Non salvato: ${e.message}`;}
    finally{impostaOccupato(false);}
  };
  for(const [nome,url] of [['AR-02 · Piano tipo','data/plan-ar02.json?v=v20261020ap'],['Bilocale · Assi 6 × 4 m','data/plan-bilocale.json']]) {
    const b=el('button',nome);b.className='pl-esempio';b.onclick=async()=>{const token=++generazione;try{const r=await fetch(url);if(!r.ok)throw Error('Esempio non disponibile');const p=await r.json();if(token!==generazione)return;onApri({...p,floors:[],furniture:[]},nome,{origine:'esempio'});attiva=null;titolo.value=nome;stato.textContent=`Esempio aperto: ${nome}. Puoi salvarne una copia nella raccolta.`;}catch(e){if(token===generazione)stato.textContent=e.message;}};root.append(b);
  }
  apriArchivio().then(async db=>{archivio=db;impostaOccupato(occupato);await aggiorna();}).catch(e=>{stato.textContent=`${e.message}. Puoi comunque importare ed esportare il modello.`;});
  return {aggiorna};
}
