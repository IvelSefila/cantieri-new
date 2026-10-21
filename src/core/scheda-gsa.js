// Dati serializzabili del modulo GSA: nessun DOM e nessun risultato precompilato.
import {LIVELLO3,PLANIMETRIA_ELEMENTI,PIANO_CONTENUTI} from './gsa-incendio.js?v=v20261021a';
import {CRITERI_ELEVATO,CRITERI_MEDIO,CRITERI_BASSO,RIDUZIONI} from './rischio-incendio.js?v=v20261021a';
export function datiGSAIniziali() {
  return {
    lavoratori:'',aperto_pubblico:false,pubblico_contemporaneo:'',soggettaCPI:'',cantiereFiamme:false,attivita_complessa:false,
    livello3:[],data_corso_addetti:'',data_ultima_esercitazione:'',planimetria_elementi:[],piano_contenuti:[],
    doc_vr:'',doc_piano:'',doc_attestati:'',doc_registro:'',doc_informazione:'',criteri:[],riduzioni:[],
    esodo:{distanzaDueVie_m:'',distanzaUnaVia_m:'',affollamento:'',numeroUscite:'',larghezzaUscite_m:'',pubblico:false,assistenza:false,materialiInfiammabili:false,areaRiposo:false},
  };
}

export function preparaSchedaGSA(raw) {
  const base=datiGSAIniziali();
  if(raw==null)return base;
  if(typeof raw!=='object'||Array.isArray(raw))throw Error('Scheda GSA non valida');
  const campi=(val,def)=>{
    const out={};
    for(const [k,d]of Object.entries(def)) {
      const x=val[k]??d;
      if(Array.isArray(d)) {
        if(!Array.isArray(x)||x.some(v=>typeof v!=='string'))throw Error(`GSA ${k}: elenco non valido`);
        out[k]=[...new Set(x)];
      }else if(typeof d==='object') {
        if(!x||typeof x!=='object'||Array.isArray(x))throw Error(`GSA ${k}: dati non validi`);
        out[k]=campi(x,d);
      }else {
        if(typeof x!==typeof d)throw Error(`GSA ${k}: tipo non valido`);
        out[k]=x;
      }
    }
    return out;
  };
  const out=campi(raw,base);
  const elenchi={livello3:Object.keys(LIVELLO3),planimetria_elementi:PLANIMETRIA_ELEMENTI.map(x=>x.id),piano_contenuti:PIANO_CONTENUTI.map(x=>x.id),criteri:[...CRITERI_ELEVATO,...CRITERI_MEDIO,...CRITERI_BASSO].map(x=>x.id),riduzioni:RIDUZIONI.map(x=>x.id)};
  for(const [key,ammessi]of Object.entries(elenchi))if(out[key].some(x=>!ammessi.includes(x)))throw Error(`GSA ${key}: voce sconosciuta`);
  for(const key of ['soggettaCPI','doc_vr','doc_piano','doc_attestati','doc_registro','doc_informazione'])if(!['','si','no'].includes(out[key]))throw Error(`GSA ${key}: scelta non valida`);
  return out;
}
