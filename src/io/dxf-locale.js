// Il parser e la validazione non devono occupare il thread dell'interfaccia.
export function importaDxfLocale(file,opzioni={}, {signal,timeout=20000}={}) {
  return new Promise((resolve,reject)=>{
    if(signal?.aborted){reject(new DOMException('Importazione annullata','AbortError'));return;}
    const worker=new Worker(new URL('./dxf-worker.js?v=v20261021c',import.meta.url),{type:'module'});
    let timer;
    const termina=(err,result)=>{clearTimeout(timer);signal?.removeEventListener('abort',annulla);worker.terminate();err?reject(err):resolve(result);};
    const annulla=()=>termina(new DOMException('Importazione annullata','AbortError'));
    signal?.addEventListener('abort',annulla,{once:true});
    timer=setTimeout(()=>termina(Error('Importazione DXF scaduta: esporta soltanto i layer dei muri e riprova.')),timeout);
    worker.onmessage=({data})=>termina(data.errore?Error(data.errore):null,data);
    worker.onerror=e=>{e.preventDefault();termina(Error(e.message||'Errore del lettore DXF'));};
    const {signal:ignored,...config}=opzioni;
    try{worker.postMessage({file,opzioni:config});}catch(e){termina(e);}
  });
}
