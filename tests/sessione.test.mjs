import {test} from 'node:test';
import assert from 'node:assert/strict';
import {progettoVuoto,aggiungiMuro,aggiungiVano} from '../src/core/project.js';
import {preparaProgetto,esportaSessione} from '../src/core/sessione.js';

test('sessione: round trip conserva geometria, prodotto CDI e parametri tecnici',()=>{
  let p=aggiungiMuro(progettoVuoto(),[0,0],[5000,0],200).p;
  p=aggiungiVano(p,p.walls[0].id,500,900,2100,0,'porta').p;
  const analisi={nordGradi:90,orientamenti:{muro_001:'S'},schedaAnt:{assegnazioni:{},quote:[]},energia:{superficie_utile_m2:123,volume_m3:400}};
  const out=esportaSessione(p,{[p.openings[0].id]:'porta-athens'},analisi);
  const back=preparaProgetto(JSON.parse(JSON.stringify(out)));
  assert.deepEqual(back,out);
  assert.equal(back.openings[0].cdi,'porta-athens');
  assert.equal(back.analisi.energia.superficie_utile_m2,123);
});
test('sessione: input invalido non modifica progetto e rifiuta parametri HTML',()=>{
  const p=progettoVuoto(),copy=structuredClone(p);
  assert.throws(()=>preparaProgetto({schema:1,unit:'mm',altezza_muri:2800}));
  assert.throws(()=>preparaProgetto({...p,analisi:{nordGradi:'<b>invalido</b>'}}));
  assert.throws(()=>preparaProgetto({...p,analisi:{orientamenti:{x:'inesistente'}}}));
  assert.throws(()=>preparaProgetto({...p,analisi:{schedaAnt:{assegnazioni:{'P0:stanza_001':null},quote:[]}}}));
  assert.deepEqual(p,copy);
});
test('sessione: vecchio JSON geometrico ottiene analisi vuota senza dati del progetto precedente',()=>{
  const p=preparaProgetto(progettoVuoto());
  assert.equal(p.analisi.nordGradi,null);
  assert.equal(p.analisi.energia,null);
  assert.deepEqual(p.analisi.schedaAnt,{assegnazioni:{},quote:[]});
});
