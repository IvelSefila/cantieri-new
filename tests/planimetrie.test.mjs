import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {formatoPlanimetria,leggiPlanimetria} from '../src/io/planimetrie.js';
import {segmentiPdf,calibrazioneScalaPdf,pianoDaSegmenti} from '../src/io/pdf-plan.js';

test('importazione: formati espliciti e limite dimensione',async()=>{
  assert.equal(formatoPlanimetria({name:'TAVOLA.PDF'}),'pdf');
  for(const ext of ['jpg','jpeg','png','webp'])assert.equal(formatoPlanimetria({name:`pianta.${ext}`}),'immagine');
  assert.throws(()=>formatoPlanimetria({name:'pianta.exe'}),/non supportato/);
  await assert.rejects(()=>leggiPlanimetria({name:'x.pdf',size:51*1024*1024}),/50 MB/);
});
for(const [nome,attesi] of [['rettangolo',[6000,4000,6000,4000]],['elle',[8000,3000,4000,3000,4000,6000]]]) {
  for(const ext of ['json','dxf'])test(`importazione ${nome}.${ext}: lunghezze note in mm`,async()=>{
    const name=`${nome}.${ext}`,data=await readFile(new URL(`./fixtures/planimetrie/${name}`,import.meta.url),'utf8');
    const result=await leggiPlanimetria({name,size:data.length,text:async()=>data},{spessoreDefault:200});
    assert.deepEqual(result.progetto.walls.map(w=>Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1])),attesi);
    if(ext==='dxf')assert.equal(result.report.arrotondamenti,0);
  });
}
test('importazione JSON e DXF malformati rifiutati',async()=>{
  await assert.rejects(()=>leggiPlanimetria({name:'x.json',text:async()=>'{}'}));
  await assert.rejects(()=>leggiPlanimetria({name:'x.dxf',text:async()=>''}));
});
const OPS={save:10,restore:11,transform:12,paintFormXObjectBegin:74,paintFormXObjectEnd:75,constructPath:91,stroke:20,closeStroke:21,fill:22,fillStroke:24};
const path=(paint,data)=>[paint,[new Float32Array(data)],null];
test('PDF: trasformazioni, form, ripristino, deduplica e curve escluse',()=>{
  const ops={fnArray:[10,12,91,74,91,75,11,91,91,91],argsArray:[[],[2,0,0,2,10,20],path(20,[0,0,0,1,100,0]),[[1,0,0,1,5,0]],path(20,[0,0,0,1,10,0]),[],[],path(20,[0,10,20,1,210,20]),path(22,[0,1,1,1,2,2]),path(20,[0,0,0,2,1,1,2,2,3,3])]};
  const out=segmentiPdf(ops,OPS,{transform:[1,0,0,-1,0,500]});
  assert.deepEqual(out.segmenti.map(s=>[s.a,s.b]),[[[10,480],[210,480]],[[20,480],[40,480]]]);
  assert.equal(out.esclusi,2);
});
test('PDF: pagina ruotata e scala fisica non dipendono dalla risoluzione canvas',()=>{
  for(const scale of [1,2,3]) {
    const viewport={scale,transform:[0,scale,scale,0,0,0]};
    const p=6000/100/25.4*72;
    const out=segmentiPdf({fnArray:[91],argsArray:[path(20,[0,0,0,1,p,0])]},OPS,viewport);
    const plan=pianoDaSegmenti(out.segmenti,calibrazioneScalaPdf(viewport,100));
    assert.deepEqual(plan.walls[0].b,[0,6000]);
    assert.ok(plan.verifica_importazione.scarto_arrotondamento_max_mm<=.5);
  }
  assert.throws(()=>calibrazioneScalaPdf(null,100),/Pagina/);
  assert.throws(()=>calibrazioneScalaPdf({scale:1},0),/Scala/);
});
test('PDF: poligono chiuso e frazioni arrotondate con scarto dichiarato',()=>{
  const out=segmentiPdf({fnArray:[91],argsArray:[path(20,[0,0,0,1,100,0,1,100,50,1,0,50,4])]},OPS,{transform:[1,0,0,1,0,0]});
  const plan=pianoDaSegmenti(out.segmenti,{origine:[0,0],mmPerPx:10.1234});
  assert.equal(plan.walls.length,4);
  assert.equal(plan.walls[0].b[0],1012);
  assert.ok(plan.verifica_importazione.scarto_arrotondamento_max_mm<=.5);
});
