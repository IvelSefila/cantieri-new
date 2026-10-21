import test from 'node:test';
import assert from 'node:assert/strict';
import {rilevaMuriRaster,muriRasterInMm} from '../src/io/raster-muri.js';
import {validatePlan} from '../src/core/model.js';
function immagine(w=400,h=300){const data=new Uint8ClampedArray(w*h*4).fill(255);return {data,width:w,height:h};}
function rettangolo(im,x,y,w,h){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++){const k=(j*im.width+i)*4;im.data[k]=im.data[k+1]=im.data[k+2]=0;}}
test('raster: ricostruisce quattro muri da pixel, senza coordinate di progetto',()=>{
  const im=immagine();for(const r of [[50,50,300,6],[50,244,300,6],[50,50,6,200],[344,50,6,200]])rettangolo(im,...r);
  const r=rilevaMuriRaster(im);assert.equal(r.muri.length,4);
  const walls=muriRasterInMm(r.muri,{origine:[0,0],mmPerPx:20});
  assert.equal(validatePlan({schema:1,unit:'mm',altezza_muri:2800,walls,openings:[]}).ok,true);
  assert.equal(walls.every(w=>w.t===120),true);
  assert.equal(r.muri.filter(w=>w.a[1]===w.b[1]).length,2);
});
test('raster: bianco, nero uniforme e trasparenza non inventano una casa',()=>{
  const im=immagine();assert.equal(rilevaMuriRaster(im).muri.length,0);
  im.data.fill(0);assert.equal(rilevaMuriRaster(im).muri.length,0);
  for(let i=3;i<im.data.length;i+=4)im.data[i]=255;
  assert.equal(rilevaMuriRaster(im).muri.length,0);
});
test('raster: righe sottili di testo e scala assente rifiutate',()=>{
  const im=immagine();rettangolo(im,30,30,100,1);
  assert.equal(rilevaMuriRaster(im).muri.length,0);
  assert.throws(()=>muriRasterInMm([],null),/distanza reale/);
  assert.throws(()=>rilevaMuriRaster({width:5000,height:5000,data:[]}),/Raster/);
});

test('scala stimata conserva proporzioni ed esclude riferimenti metrici falsi', async()=>{
  const {stimaScalaRaster}=await import('../src/io/raster-muri.js');
  const muri=[{a:[10,20],b:[310,20],spessore_px:6},{a:[10,20],b:[10,220],spessore_px:6}];
  const cal=stimaScalaRaster(muri);
  assert.equal(cal.mmPerPx,250/6);
  assert.deepEqual(cal.origine,[10,20]);
  const mm=muriRasterInMm(muri,cal);
  assert.ok(Math.abs((mm[0].b[0]/mm[1].b[1])-1.5)<.001);
  assert.throws(()=>stimaScalaRaster([]));
});
