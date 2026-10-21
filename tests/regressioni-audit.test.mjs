import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/core/project.js';
import { validatePlan } from '../src/core/model.js';
import { stanze } from '../src/core/rooms.js';
import { infissiAutomatici } from '../src/core/automatismi.js';
import { valutaCivileAbitazione } from '../src/core/civile-abitazione.js';
import { calcolaGsaDaCivico, geocodificaIndirizzo, interrogaLiDARPiemonte, interrogaOSMNazionale, normalizzaRegione, parseOsmXmlBuildings } from '../src/core/altimetria-civico.js';

const quadrato = (lato = 4000) => {
  const c = [[0,0],[lato,0],[lato,lato],[0,lato]];
  return { ...P.progettoVuoto(), walls: c.map((a,i) => ({ id:'w'+i, a, b:c[(i+1)%4], t:200 })) };
};
test('audit: crea/elimina/ricrea mantiene ID univoci per muri, vani e pavimenti', () => {
  let p = P.progettoVuoto();
  for(let i=0;i<3;i++) p=P.aggiungiMuro(p,[0,i*1000],[6000,i*1000],200).p;
  p=P.eliminaElemento(p,'muro_002'); p=P.aggiungiMuro(p,[0,4000],[6000,4000],200).p;
  assert.equal(validatePlan(p).ok,true);
  for(let i=0;i<3;i++)p=P.aggiungiVano(p,'muro_001',200+i*1800,900,2100,0,'porta').p;
  p=P.eliminaElemento(p,'vano_002');p=P.aggiungiVano(p,'muro_001',4800,900,2100,0,'porta').p;
  assert.equal(new Set(p.openings.map(o=>o.id)).size,p.openings.length);
  for(let i=0;i<3;i++)p=P.aggiungiPavimento(p,i*1000,0,i*1000+900,900).p;
  p=P.eliminaElemento(p,'pav_002');p=P.aggiungiPavimento(p,4000,0,4900,900).p;
  assert.equal(new Set(p.floors.map(o=>o.id)).size,p.floors.length);
});
test('audit: schema incompleto, null e ID vani duplicati sono rifiutati senza eccezioni',()=>{
  for(const p of [null,{}, {...P.progettoVuoto(),walls:[null]}, {...P.progettoVuoto(),openings:[null]}])
    assert.equal(validatePlan(p).ok,false);
  let p=P.aggiungiVano(quadrato(),'w0',200,900,2100,0,'porta').p;
  p.openings.push({...p.openings[0],offset:2000});
  assert.equal(validatePlan(p).ok,false);
});
test('audit: due divisori incrociati generano quattro stanze con area indipendente',()=>{
  const p=quadrato(10000);
  p.walls.push({id:'v',a:[5000,0],b:[5000,10000],t:200},{id:'h',a:[0,5000],b:[10000,5000],t:200});
  const s=stanze(p.walls);
  assert.equal(s.length,4);
  assert.equal(s.reduce((n,x)=>n+x.superficieMm2,0),4*4800*4800);
});
test('audit: divisione muro rifiuta un taglio attraverso un vano e preserva input',()=>{
  const p={...P.progettoVuoto(),walls:[{id:'w',a:[0,0],b:[6000,0],t:200},{id:'t',a:[3000,0],b:[3000,3000],t:200}],
    openings:[{id:'o',wall:'w',offset:2500,width:1000,height:2100,sill:0,type:'porta'}]};
  const copy=structuredClone(p),r=P.spezzaMuro(p,'w',[1000,0]);
  assert.deepEqual(p,copy);
  assert.ok(r.errore || validatePlan(r.p).ok);
});
test('audit: finestre automatiche idempotenti quando il requisito è soddisfatto',()=>{
  const r=infissiAutomatici(quadrato()),s=infissiAutomatici(r.p);
  assert.equal(r.rapporto[0].ok,true);
  assert.equal(s.aggiunti.length,0);
  assert.equal(s.rapporto[0].finestreM2,r.rapporto[0].finestreM2);
});
test('audit: geocoder scarta una via diversa anche se coincide il comune',async()=>{
  const fetchFn=async u=>({ok:true,json:async()=>u.includes('arcgis')?{candidates:[{score:90,address:'Via Mellea, Savigliano',location:{x:7.6,y:44.6},attributes:{StName:'Mellea',StPreType:'Via',City:'Savigliano',Region:'Piemonte',Addr_type:'StreetName'}}]}:[]});
  assert.equal((await geocodificaIndirizzo('Via Duccio Galimberti 2 Savigliano',{fetchFn})).ok,false);
});
test('audit: normalizza trattini e spazi nelle regioni',()=>{
  assert.equal(normalizzaRegione('Emilia Romagna'),'Emilia-Romagna');
  assert.equal(normalizzaRegione('Trentino Alto Adige'),'Trentino-Alto Adige');
});
test('audit: BDTRE mantiene principale il corpo vicino anche se più basso',async()=>{
  const gml=[{h:7,lat:45.00009},{h:30,lat:45.00045}].map(v=>`<ms:un_vol><ms:un_vol_av>${v.h}</ms:un_vol_av><gml:posList>${v.lat} 9 ${v.lat} 9</gml:posList></ms:un_vol>`).join('');
  const r=await interrogaLiDARPiemonte(45,9,{fetchFn:async()=>({ok:true,text:async()=>gml})});
  assert.equal(r.volumePrincipale.altezza_volumetrica_m,7);
});
test('audit: impronta OSM senza altezza non diventa LiDAR o esito determinato',async()=>{
  const xml='<osm><node id="1" lat="45" lon="9"/><node id="2" lat="45" lon="9.0003"/><node id="3" lat="45.0003" lon="9.0003"/><node id="4" lat="45.0003" lon="9"/><way id="1"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="building" v="yes"/></way></osm>';
  const r=await calcolaGsaDaCivico('test',{geo_precalcolata:{ok:true,lat:45,lon:9,regione:'Lombardia',display_name:'test'},fetchFn:async()=>({ok:true,text:async()=>xml})});
  assert.ok(!r.provider.includes('LiDAR'));
  assert.equal(r.fonte_tipologica,true);
  assert.equal(r.valutazione_gsa.esito,'INDETERMINATO');
});
test('audit: timeout copre anche un corpo WFS bloccato e termina il trasporto',async()=>{
  const signals=[];
  const r=await interrogaLiDARPiemonte(45,9,{timeoutMs:15,fetchFn:async(u,o)=>{signals.push(o.signal);return {ok:true,text:()=>new Promise(()=>{})};}});
  assert.equal(r.ok,false);
  assert.equal(signals.length,2);
  assert.ok(signals.every(s=>s.aborted));
});
test('audit: OSM e Overpass non rimangono in attesa indefinita',async()=>{
  const signals=[];
  const r=await interrogaOSMNazionale(45,9,{timeoutMs:15,fetchFn:(u,o)=>{signals.push(o.signal);return new Promise(()=>{});}});
  assert.equal(r.ok,false);
  assert.ok(signals.every(s=>s.aborted));
});
test('audit: simulare altri piani riusa la cartografia e non esegue nuove richieste',async()=>{
  let calls=0;
  const r=await calcolaGsaDaCivico('test',{numero_piani_override:10,geo_precalcolata:{ok:true,lat:45,lon:9,regione:'Lombardia'},
    cartografia_precalcolata:{volumi:[{altezza_volumetrica_m:18,fonte_altezza:'osm_height'}],provider:'OpenStreetMap'},fetchFn:async()=>{calls++;throw Error('richiesta non necessaria');}});
  assert.equal(r.esito,'OK');
  assert.equal(calls,0);
  assert.equal(r.edificio_selezionato.piani,10);
  assert.equal(r.misura_lidar,false);
});
test('audit: un avviso bloccante sul riferimento impedisce una classificazione determinata',()=>{
  const r=valutaCivileAbitazione({altezza:{fonti:[{fonte:'rilievo',h_mm:30000,stato:'verificato'}],piano_esterno_accessibile_mezzi_vvf:false,vani_tecnici_esclusi:true}});
  assert.equal(r.esito,'INDETERMINATO');
  assert.equal(r.lp_finale,null);
});
test('audit: edificio che contiene il punto precede quello con baricentro più vicino',()=>{
  const xml='<osm><node id="1" lat="45" lon="9"/><node id="2" lat="45" lon="9.001"/><node id="3" lat="45.001" lon="9.001"/><node id="4" lat="45.001" lon="9"/><node id="5" lat="45" lon="8.9999"/><node id="6" lat="45.0001" lon="8.9999"/><node id="7" lat="45.0001" lon="8.9998"/><way id="20"><nd ref="5"/><nd ref="6"/><nd ref="7"/><nd ref="5"/><tag k="building" v="yes"/></way><way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/><nd ref="4"/><nd ref="1"/><tag k="building" v="yes"/></way></osm>';
  const r=parseOsmXmlBuildings(xml,45.00005,9.00001);
  assert.equal(r[0].id,'10');
  assert.equal(r[0].distanza_m,0);
});
