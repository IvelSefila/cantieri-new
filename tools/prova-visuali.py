"""Collaudo WebGL reale delle 11 visuali, con materiali e camera ispezionati."""
import http.server, threading, json, hashlib
from pathlib import Path
from playwright.sync_api import sync_playwright
from serve import CantieriHandler
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/evidenze/visuali';OUT.mkdir(parents=True,exist_ok=True)
class H(CantieriHandler):
 def log_message(self,*args):pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),H)
threading.Thread(target=srv.serve_forever,daemon=True).start()
r={'prove':[],'errori_js':[],'sorgenti':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'src/view/scene.js',ROOT/'src/view/modelli3d.js',ROOT/'src/app.js']}}
def check(n,v):
 r['prove'].append({'nome':n,'pass':bool(v)});print(('PASS ' if v else 'FAIL ')+n,flush=True);assert v,n
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(channel='msedge',headless=True)
  page=b.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:r['errori_js'].append(str(e)))
  page.goto(f'http://127.0.0.1:{srv.server_port}/');page.wait_for_load_state('networkidle')
  page.locator('button.hud-tab[data-scheda="progetto"]').click()
  page.get_by_role('button',name='Apri esempio AR-02',exact=True).click()
  page.wait_for_function("()=>document.querySelector('#esito').textContent.includes('19 muri')")
  for option in page.locator('#stile option').evaluate_all('(els)=>els.map(e=>e.value)'):
   page.locator('#stile').select_option(option,force=True);page.wait_for_timeout(120)
   check('menu app '+option,page.locator('#stile').input_value()==option)
   if option in ['iso-dollhouse','ultra-glass','notte']:page.screenshot(path=str(OUT/('app-'+option+'.png')))
  page.locator('#stile').select_option('dollhouse',force=True)
  page.locator('button.hud-tab[data-scheda="vista"]').click()
  page.get_by_role('button',name='Passeggiata in prima persona',exact=True).click();page.wait_for_timeout(150)
  check('prima persona sospende dollhouse e sincronizza menu',page.locator('#stile').input_value()=='solido')
  page.keyboard.press('Escape');page.wait_for_timeout(150)
  check('uscita prima persona ripristina dollhouse e menu',page.locator('#stile').input_value()=='dollhouse')
  page.evaluate("""async()=>{
   const THREE=await import('three');const {createViewer,STILI}=await import('./src/view/scene.js?v=v20261020bq');
   window.stili=Object.keys(STILI);const el=document.createElement('div');el.style='position:fixed;inset:0;z-index:9999;background:black';document.body.append(el);
   const add=THREE.Scene.prototype.add;
   THREE.Scene.prototype.add=function(...objects){if(objects.some(o=>o.isDirectionalLight))window.scena=this;return add.apply(this,objects)};
   window.v=createViewer(el);v.setQualita('basso');
   window.boxes=[{id:'p',kind:'pavimento',materiale:'parquet_rovere',cx:33000,cy:22000,cz:0,L:6000,D:4000,H:100,ang:0},
    {id:'w',kind:'muro',cx:33000,cy:20000,cz:1400,L:6000,D:200,H:2800,ang:0,finitura:'intonaco_bianco'},
    {id:'w2',kind:'muro',cx:30000,cy:22000,cz:1400,L:4000,D:200,H:2800,ang:Math.PI/2,finitura:'intonaco_bianco'}];
   v.setBoxes(boxes);
   window.info=()=>{const mats=[];scena.traverse(o=>{if(o.userData?.kind==='muro')for(const m of [].concat(o.material))mats.push({op:m.opacity,map:!!m.map,clip:m.clippingPlanes?.length||0,trans:m.transmission||0})});
   return {mats,near:scena.fog.near,dist:v.camera.position.distanceTo(v.controls.target),fov:v.camera.fov,lights:scena.children.filter(g=>g.isGroup).flatMap(g=>g.children).filter(o=>o.isPointLight).length,target:v.controls.target.toArray(),style:v.statistiche().stile};};
  }""")
  r['stili']={}
  for q in ['basso','medio','alto']:
   page.evaluate('(q)=>v.setQualita(q)',q)
   for s in page.evaluate('stili'):
    page.evaluate('(s)=>v.setStile(s)',s);page.wait_for_timeout(150)
    d=page.evaluate('info()');r['stili'][q+'-'+s]=d
    check(q+' '+s+' modello davanti alla nebbia',d['near']>d['dist'])
    check(q+' '+s+' centrato sul progetto importato',abs(d['target'][0]-32.95)<0.01 and abs(d['target'][2]-21.95)<0.01)
    if s in ['vetro','vetro-dollhouse','ultra-glass']:
     check(q+' '+s+' muri trasparenti senza foto opache',all(not m['map'] and (m['op']<1 or m['trans']>0) for m in d['mats']))
    if 'dollhouse' in s:check(q+' '+s+' muri tagliati',all(m['clip']==1 for m in d['mats']))
    if s=='notte':check(q+' notte luci calde reali',d['lights']==1)
    if q=='basso':page.screenshot(path=str(OUT/(s+'.png')))
   # Cambiare qualita' mentre l'isometrica e' attiva non deve reintrodurre la nebbia.
   page.evaluate("()=>{v.setStile('iso-dollhouse');v.setQualita('alto')}");page.wait_for_timeout(150)
   d=page.evaluate('info()');check('qualita dopo isometrica '+q,d['near']>d['dist'])
  page.evaluate("()=>{v.vistaDallAltoSubito({camera:[33000,22000,15000],bersaglio:[33000,22000,0],spostamentoPx:250,su:[0,0,-1]});v.setStile('solido')}")
  check('stile cancella offset e orientamento della vista tecnica',page.evaluate('!v.camera.view.enabled && v.camera.up.y===1'))
  page.evaluate("""async()=>{
   const {partiArredo}=await import('./src/core/arredi.js?v=v20261020bq');
   const a={id:'poltrona-test',tipo:'poltrona_poly',x:33000,y:22000,rot:0};
   v.setDettagli([{tipo:'arredo',a,parti:partiArredo(a)}]);v.setStile('argilla');
  }""")
  page.wait_for_function("()=>scena.children.some(g=>g.children.some(o=>o.userData?.modelloCaricato))")
  check('arredo glTF rispetta argilla',page.evaluate("()=>{let ok=true,n=0;scena.traverse(o=>{if(o.isMesh&&o.userData?.id==='poltrona-test'&&o.visible){n++;for(const m of [].concat(o.material))ok=ok&&!m.map&&m.color.getHex()===0xf2efe9}});return ok&&n>0}"))
  page.evaluate("()=>v.setStile('vetro-dollhouse')")
  page.wait_for_function("()=>scena.children.some(g=>g.children.some(o=>o.userData?.modelloCaricato))")
  check('arredo glTF rispetta taglio dollhouse',page.evaluate("()=>{let ok=true,n=0;scena.traverse(o=>{if(o.isMesh&&o.userData?.id==='poltrona-test'){n++;for(const m of [].concat(o.material))ok=ok&&m.clippingPlanes?.length===1}});return ok&&n>0}"))
  page.evaluate("()=>{v.setStile('solido');window.prima=v.camera.position.clone()}")
  page.mouse.click(1000,500)
  page.keyboard.down('w');page.wait_for_timeout(100);page.keyboard.up('w')
  check('WASD orbitale muove in metri senza salto chilometrico',page.evaluate('v.camera.position.distanceTo(prima)>0 && v.camera.position.distanceTo(prima)<5'))
  check('nessun errore JavaScript' ,not r['errori_js']);b.close()
finally:
 (OUT/'risultati.json').write_text(json.dumps(r,indent=2,ensure_ascii=False),encoding='utf-8');srv.shutdown();srv.server_close()

