import test from 'node:test';
import assert from 'node:assert/strict';
import {collegaAperture,elementiInMm} from '../src/io/riconoscimento-geometria.js';
import {buildModel} from '../src/core/build.js';
import {validatePlan} from '../src/core/model.js';

const muri=[{a:[20,100],b:[80,100],spessore_px:8},{a:[120,100],b:[200,100],spessore_px:8}];
function pixel(mask,x,y){if(x>=0&&x<240&&y>=0&&y<200)mask[Math.round(y)*240+Math.round(x)]=255;}
test('interruzione senza simboli non viene inventata come porta',()=>{
 const r=collegaAperture(muri,new Uint8Array(240*200),240,200);
 assert.equal(r.muri.length,2);assert.equal(r.aperture.length,0);assert.equal(r.dubbi.length,1);
});
test('simbolo finestra diventa vano passante, con parapetto e architrave reali',()=>{
 const mask=new Uint8Array(240*200);for(const y of [97,100,103])for(let x=80;x<=120;x++)pixel(mask,x,y);
 const r=collegaAperture(muri,mask,240,200);
 assert.equal(r.muri.length,1);assert.equal(r.aperture[0].type,'finestra');
 const {muri:w,vani:o}=elementiInMm({...r,stanze:[]},{origine:[0,0],mmPerPx:20});
 const plan={schema:1,unit:'mm',altezza_muri:2800,walls:w,openings:o};
 assert.equal(validatePlan(plan).ok,true);
 const model=buildModel(plan,{items:[]}),op=o[0],mid=op.offset+op.width/2;
 assert.ok(model.boxes.some(b=>b.kind==='muro_sotto'));
 assert.ok(model.boxes.some(b=>b.kind==='muro_sopra'));
 assert.equal(model.boxes.some(b=>b.kind==='muro'&&b.s0<mid&&b.s1>mid),false);
});
test('arco di battente diventa porta, esclusione e altezza ridotta rispettate',()=>{
 const mask=new Uint8Array(240*200);for(let a=0;a<Math.PI/2;a+=.008)pixel(mask,80+40*Math.cos(a),100+40*Math.sin(a));
 const r=collegaAperture(muri,mask,240,200);assert.equal(r.aperture[0].type,'porta');
 const e=elementiInMm({...r,stanze:[]},{origine:[0,0],mmPerPx:20},2000);
 assert.equal(e.vani[0].height,2000);assert.equal(e.vani[0].sill,0);
 r.aperture[0].escluso=true;
 assert.equal(elementiInMm({...r,stanze:[]},{origine:[0,0],mmPerPx:20}).vani.length,0);
});
test('esclusione muro elimina anche le aperture dipendenti',()=>{
 const rapporto={muri:[{...muri[0],id:'a',escluso:true}],aperture:[{id:'o',wall:'a',offset:5,width:10,type:'porta'}],stanze:[]};
 const e=elementiInMm(rapporto,{origine:[0,0],mmPerPx:20});assert.deepEqual(e.muri,[]);assert.deepEqual(e.vani,[]);
});
test('vano a fine muro usa estremi assoluti senza oltrepassarlo per arrotondamento',()=>{
 const rapporto={muri:[{id:'a',a:[.49,10],b:[10.49,10],spessore_px:2}],aperture:[{id:'o',wall:'a',offset:9,width:1,type:'porta'}],stanze:[]};
 const e=elementiInMm(rapporto,{origine:[0,0],mmPerPx:1.5});
 assert.equal(e.vani[0].offset,13);assert.equal(e.vani[0].width,2);
 assert.equal(validatePlan({schema:1,unit:'mm',altezza_muri:2800,walls:e.muri,openings:e.vani}).ok,true);
});
