import test from 'node:test';
import assert from 'node:assert/strict';
import {stimaScalaRaster} from '../src/io/raster-muri.js';
const muri=[{a:[0,0],b:[500,0],spessore_px:3},{a:[500,0],b:[500,350],spessore_px:3}];
test('scala indicativa da almeno tre simboli porta concordanti',()=>{
 const aperture=[23,23,24].map(width=>({width,type:'porta',punteggio:.9,inferita:false}));
 const r=stimaScalaRaster(muri,aperture);assert.equal(r.mmPerPx,900/23);assert.match(r.ipotesi,/porte/);
 assert.ok(500*r.mmPerPx<30000);
});
test('simboli deboli o esclusi non alterano la scala',()=>{
 const base=stimaScalaRaster(muri);
 for(const extra of [{punteggio:.6},{escluso:true},{inferita:true}]){
  const r=stimaScalaRaster(muri,[20,20,20].map(width=>({width,type:'porta',punteggio:.9,...extra})));
  assert.equal(r.mmPerPx,base.mmPerPx);
 }
});
