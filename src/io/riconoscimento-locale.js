// Worker separato: OpenCV/WASM e pixel restano sul PC. Nessun servizio remoto.
export function riconosciCasa(imageData, {signal, timeout=30000}={}) {
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('./riconoscimento-worker.js?v=1',import.meta.url));
    let timer;
    const chiudi=()=>{clearTimeout(timer);signal?.removeEventListener('abort',annulla);worker.terminate();};
    const errore=msg=>{chiudi();reject(new Error(msg));};
    const annulla=()=>errore('Analisi annullata');
    if(signal?.aborted){annulla();return;}
    signal?.addEventListener('abort',annulla,{once:true});
    timer=setTimeout(()=>errore('Analisi oltre 30 secondi: riduci dimensioni o complessita della tavola'),timeout);
    worker.onerror=e=>errore(e.message||'Motore locale non disponibile');
    worker.onmessage=({data})=>{if(data.errore)errore(data.errore);else{chiudi();resolve(data);}};
    worker.postMessage({data:imageData.data,width:imageData.width,height:imageData.height},[imageData.data.buffer]);
  });
}
