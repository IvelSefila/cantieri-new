import {test} from 'node:test';
import assert from 'node:assert/strict';
import {progettoVuoto,aggiungiMuro,aggiungiVano,verificaProgetto} from '../src/core/project.js';
import {preparaProgetto} from '../src/core/sessione.js';
import {parseDxf} from '../src/io/dxf.js';
import {dxfToPlan} from '../src/io/toPlan.js';
import {buildModel} from '../src/core/build.js';
import {datiGSAIniziali} from '../src/core/scheda-gsa.js';

const pianta=()=>aggiungiVano(aggiungiMuro(progettoVuoto(),[0,0],[6000,0],200).p,'muro_001',1000,900,2100,0,'porta').p;
const fileDxf=body=>[[0,'SECTION'],[2,'HEADER'],[9,'$INSUNITS'],[70,4],[0,'ENDSEC'],[0,'SECTION'],[2,'ENTITIES'],...body,[0,'ENDSEC'],[0,'EOF']].flat().join('\n')+'\n';

test('P1 import: id di vano e muro devono essere distinti anche fra collezioni',()=>{
  const p=pianta();p.openings[0].id=p.walls[0].id;
  assert.equal(verificaProgetto(p).ok,false);
});
test('P1 import: id oggetto non accettato come identificativo',()=>{
  const p=pianta();p.openings=[];p.walls[0].id={nome:'muro'};
  assert.throws(()=>preparaProgetto(p));
});
for(const key of ['toString','constructor','__proto__'])test(`P1 import: tipo arredo ereditato ${key} rifiutato`,()=>{
  const p=progettoVuoto();p.furniture=[{id:'a',tipo:key,x:0,y:0,rot:0}];
  assert.throws(()=>preparaProgetto(p));
});
test('P1 import: funzioniStanze malformate non arrivano al rendering',()=>{
  for(const value of [{},[null],[{poligono:[[0,0],[0,1000],[1000,0]],funzione:'toString'}]])assert.throws(()=>preparaProgetto({...pianta(),funzioniStanze:value}));
});
test('P1 import: finitura arredo non valida non raggiunge il motore 3D',()=>{
  assert.throws(()=>preparaProgetto({...progettoVuoto(),furniture:[{id:'a',tipo:'divano',x:0,y:0,rot:0,finitura:{colore:null}}]}));
});
test('P1 DXF: flag dei VERTEX non annullano chiusura e layer POLYLINE',()=>{
  const body=[[0,'POLYLINE'],[8,'MURI'],[70,1],[10,0],[20,0]];
  for(const [x,y]of [[0,0],[6000,0],[6000,4000],[0,4000]])body.push([0,'VERTEX'],[8,'0'],[10,x],[20,y],[70,0]);
  body.push([0,'SEQEND']);
  const out=dxfToPlan(parseDxf(fileDxf(body)),{spessoreDefault:200});
  assert.equal(out.plan.walls.length,4);
  assert.ok(out.plan.walls.every(w=>w.kind==='MURI'));
  assert.equal(buildModel(out.plan,{items:[]}).ok,true);
});
test('P1 DXF: archi bulge non sono trasformati in corde rettilinee',()=>{
  const out=dxfToPlan(parseDxf(fileDxf([[0,'LWPOLYLINE'],[8,'MURI'],[70,0],[10,0],[20,0],[42,1],[10,6000],[20,0]])));
  assert.equal(out.plan.walls.length,0);
  assert.ok(out.report.avvisi.some(x=>/curv|bulge/i.test(x)));
});
test('P2 DXF: LINE accetta campi coordinate in ordine diverso',()=>{
  const out=dxfToPlan(parseDxf(fileDxf([[0,'LINE'],[21,0],[11,6000],[20,0],[10,0]])));
  assert.equal(out.check.ok,true);
  assert.deepEqual(out.plan.walls[0].b,[6000,0]);
});
test('P1 import: quote e ambiti non numerici rifiutati prima della mutazione',()=>{
  for(const schedaAnt of [{assegnazioni:null,quote:[]},{assegnazioni:{},quote:[{muro:'x',mm:-5}]},{assegnazioni:{x:{ambito:{}}},quote:[]}])assert.throws(()=>preparaProgetto({...pianta(),analisi:{schedaAnt}}));
});
test('P1 sessione: dati GSA lavoro preservati e input malformato rifiutato',()=>{
  const gsa=datiGSAIniziali();gsa.lavoratori='12';gsa.esodo.numeroUscite='3';gsa.aperto_pubblico=true;
  const p=preparaProgetto({...pianta(),analisi:{gsaLavoro:gsa}});
  assert.deepEqual(preparaProgetto(JSON.parse(JSON.stringify(p))).analisi.gsaLavoro,gsa);
  assert.throws(()=>preparaProgetto({...pianta(),analisi:{gsaLavoro:{livello3:'scuola'}}}));
});
test('P1 rendering: appartenenza al vano esplicita anche con due punti negli id',()=>{
  const p=pianta();p.walls[0].id='ingresso:muro';p.openings[0].wall=p.walls[0].id;p.openings[0].id='ingresso:porta';p.openings[0].cdi='test';
  const m=buildModel(p,{items:[{id:'test',categoria:'porte_ingresso',nome:'Test'}]});
  assert.ok(m.boxes.some(b=>b.vano==='ingresso:porta'));
  assert.ok(m.boxes.filter(b=>b.kind.startsWith('muro')).every(b=>!b.vano));
});
test('P1 DXF: unità assenti richiedono scelta esplicita senza fattore nascosto',()=>{
  const txt=fileDxf([[0,'LINE'],[10,0],[20,0],[11,6],[21,0]]).replace('$INSUNITS','ALTRO');
  assert.throws(()=>dxfToPlan(parseDxf(txt)),/Unità DXF/);
  const m=dxfToPlan(parseDxf(txt,{unitaSeAssenti:6}));
  assert.equal(m.plan.walls[0].b[0],6000);
  assert.ok(m.report.avvisi.some(x=>x.includes('confermati')));
});
test('P1 DXF: mesh e spline non diventano muri 2D inventati',()=>{
  for(const flags of [2,4,8,16,64]){
    const body=[[0,'POLYLINE'],[70,flags],[0,'VERTEX'],[10,0],[20,0],[0,'VERTEX'],[10,6000],[20,0],[0,'SEQEND']];
    const r=dxfToPlan(parseDxf(fileDxf(body)));
    assert.equal(r.plan.walls.length,0);assert.ok(r.report.avvisi.length>0);
  }
});
