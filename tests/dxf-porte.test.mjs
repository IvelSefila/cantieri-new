import test from 'node:test';
import assert from 'node:assert/strict';
import {riconosciPorteDxf} from '../src/io/dxf-porte.js';
import {parseDxf} from '../src/io/dxf.js';
const simbolo=()=>({entities:[{tipo:'LINE',layer:'A-DOOR',punti:[[1000,0],[1000,850]]}],archiPorta:[{layer:'A-DOOR',centro:[1000,0],raggio:850,inizio:0,fine:90}]});
const piano=()=>({altezza_muri:2800,walls:[{id:'m',a:[0,0],b:[4000,0],t:200}],openings:[]});
test('arco e anta coerenti creano un varco da 850 mm',()=>{
 const p=piano(),r=riconosciPorteDxf(simbolo(),p,1);
 assert.equal(r.riconosciute,1);assert.equal(p.openings[0].offset,1000);assert.equal(p.openings[0].width,850);assert.equal(p.openings[0].height,2100);assert.equal(p.openings[0].apertura.cardine,'a');
});
test('simboli fuori muro, senza anta e ambigui non tagliano pareti',()=>{
 for(const tipo of ['fuori','anta','ambiguo','sovrapposto','angolo']){
  const p=piano(),s=simbolo();
  if(tipo==='fuori')p.walls[0].a[1]=p.walls[0].b[1]=2000;
  if(tipo==='anta')s.entities=[];
  if(tipo==='ambiguo')p.walls.push({...p.walls[0],id:'m2'});
  if(tipo==='sovrapposto')p.openings.push({wall:'m',offset:1100,width:500});
  if(tipo==='angolo')s.archiPorta[0].fine=45;
  const n=p.openings.length,r=riconosciPorteDxf(s,p,1);
  assert.equal(r.riconosciute,0,tipo);assert.equal(r.da_verificare,1,tipo);assert.equal(p.openings.length,n,tipo);
 }
});
test('muro invertito mantiene posizione fisica del varco',()=>{
 const p=piano();p.walls[0].a=[4000,0];p.walls[0].b=[0,0];
 riconosciPorteDxf(simbolo(),p,1);assert.equal(p.openings[0].offset,2150);assert.equal(p.openings[0].apertura.cardine,'b');
});
test('parser conserva archi porta come simboli senza estruderli',()=>{
 const p=parseDxf('0\nSECTION\n2\nENTITIES\n0\nARC\n8\nA-DOOR\n10\n1\n20\n0\n40\n.85\n50\n0\n51\n90\n0\nENDSEC\n');
 assert.equal(p.entities.length,0);assert.equal(p.archiPorta.length,1);assert.equal(p.archiPorta[0].raggio,.85);
});
