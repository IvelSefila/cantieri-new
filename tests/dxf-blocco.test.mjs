import test from 'node:test';
import assert from 'node:assert/strict';
import {dxfToPlan} from '../src/io/toPlan.js';
import {parseDxf} from '../src/io/dxf.js';
import {spezzaMuri} from '../src/core/rooms.js';
const entita=(layer,n)=>Array.from({length:n},(_,i)=>({tipo:'LINE',layer,punti:[[i*100,0],[i*100,2000]]}));
const parsed=entities=>({entities,perMm:1,report:{unita:4,avvisi:[]}});
test('DXF complesso viene fermato prima della generazione del modello',()=>{
 assert.throws(()=>dxfToPlan(parsed(entita('0',501))),/500 segmenti/);
});
test('filtro layer muri esclude annotazioni e dichiara le esclusioni',()=>{
 const r=dxfToPlan(parsed([...entita('xref$0$A-WALL',4),...entita('A-DIMS',600)]),{soloLayerMuri:true});
 assert.equal(r.plan.walls.length,4);assert.ok(r.report.avvisi.some(x=>x.includes('600')));
 assert.equal(dxfToPlan(parsed(entita('0',4)),{soloLayerMuri:true}).plan.walls.length,4);
});
test('DXF binario viene rifiutato esplicitamente',()=>{
 assert.throws(()=>parseDxf('AutoCAD Binary DXF\r\n'),/binario/);
});
test('unità manuali prevalgono su header e sono dichiarate nel rapporto',()=>{
 const p=parseDxf('0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n',{unitaOriginali:1});
 assert.equal(p.perMm,25.4);assert.ok(p.report.avvisi.some(x=>x.includes('header: 4')));
});
test('scala minuscola rispetto allo spessore viene segnalata prima delle stanze',()=>{
 const r=dxfToPlan(parsed([{tipo:'LINE',layer:'A-WALL',punti:[[0,0],[796,0]]}]));
 assert.ok(r.check.ok);assert.deepEqual(r.plan.walls[0].b,[796,0]);assert.equal(r.plan.walls[0].t,10);assert.equal(r.plan.altezza_muri,111);assert.ok(r.report.avvisi.some(x=>x.includes('preservate')));
});
test('intersezioni quasi coincidenti non moltiplicano i frammenti',()=>{
 const muri=Array.from({length:35},(_,i)=>({id:String(i),a:[0,i],b:[100000,100001-i],t:100}));
 const out=spezzaMuri(muri);
 assert.ok(out.length<=35*35);
 assert.ok(out.every(w=>Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1])>1e-6));
});


test('doppi fili e due quote coerenti ricostruiscono spessore e scala',()=>{
 const entities=[
 {tipo:'LINE',layer:'A-WALL',punti:[[0,-.125],[12,-.125]]},
 {tipo:'LINE',layer:'A-WALL',punti:[[0,.125],[12,.125]]},
 {tipo:'LINE',layer:'A-WALL',punti:[[-.125,0],[-.125,9]]},
 {tipo:'LINE',layer:'A-WALL',punti:[[.125,0],[.125,9]]},
 {tipo:'LINE',layer:'A-GLAZ',punti:[[2,0],[4,0]]}];
 const p={...parsed(entities),quoteTesto:[12000,9000]};
 const r=dxfToPlan(p,{soloLayerMuri:true});
 assert.ok(r.check.ok);assert.equal(r.plan.walls.length,2);
 assert.equal(r.plan.walls[0].t,250);assert.deepEqual(r.plan.walls[0].b,[12000,0]);
 assert.equal(r.plan.openings.length,1);assert.equal(r.plan.openings[0].width,2000);
 assert.equal(r.report.scala_da_quote,1000);
 const manuale=dxfToPlan({...p,report:{...p.report,unita_confermate:true}},{soloLayerMuri:true});
 assert.equal(manuale.report.scala_da_quote,undefined);
});
