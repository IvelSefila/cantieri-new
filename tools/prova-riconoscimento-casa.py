"""Prova offline: pixel -> OpenCV worker -> aperture/stanze -> mesh/JSON/IndexedDB."""
import http.server
import threading
import io
import json
import hashlib
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
from serve import CantieriHandler

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/evidenze/riconoscimento-casa';OUT.mkdir(parents=True,exist_ok=True)
FIX=ROOT/'tests/fixtures/riconoscimento-casa';FIX.mkdir(parents=True,exist_ok=True)
report={'prove':[],'errori_js':[],'rete_esterna':[], 'risultati':{},'hash_sorgenti':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [*sorted((ROOT/'src/io').glob('riconoscimento*')),ROOT/'src/trace/ui.js',ROOT/'src/app.js',ROOT/'src/ui/planimetrie.js',ROOT/'index.html',ROOT/'vendor/opencv/opencv.js',ROOT/'vendor/simplify/simplify.js']}}
def check(nome,ok):
 report['prove'].append({'nome':nome,'pass':bool(ok)})
 print(('PASS ' if ok else 'FAIL ')+nome,flush=True)
 assert ok,nome
def fixture():
 im=Image.new('RGB',(700,500),'white');d=ImageDraw.Draw(im)
 # Due stanze, una porta con arco e una finestra con tre linee sottili.
 for a,b in [((60,60),(150,60)),((230,60),(640,60)),((60,440),(640,440)),((60,60),(60,440)),((640,60),(640,440)),((350,60),(350,220)),((350,280),(350,440))]:d.line((a,b),fill='black',width=10)
 for y in [57,60,63]:d.line((150,y,230,y),fill='black',width=1)
 d.line((350,220,410,220),fill='black',width=1);d.arc((290,160,410,280),0,90,fill='black',width=1)
 return im
im=fixture()
for ext in ['png','jpg','webp','pdf']:im.save(FIX/f'due-stanze.{ext}')
im.rotate(90,expand=True).save(FIX/'ruotata.png')
Image.eval(im,lambda x:255-x).save(FIX/'fondo-nero.png')
trasparente=im.convert('RGBA');trasparente.putalpha(im.convert('L').point(lambda x:0 if x>240 else 255));trasparente.save(FIX/'trasparente.png')
class H(CantieriHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),H);threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True)
  context=browser.new_context(viewport={'width':1440,'height':1100})
  context.add_init_script("window.__sceneTest=[];window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',e=>{if(e.detail.isScene)window.__sceneTest.push(e.detail)});")
  def route(r):
   if not r.request.url.startswith(base):report['rete_esterna'].append(r.request.url);r.abort()
   else:r.continue_()
  context.route('**/*',route)
  page=context.new_page();page.on('pageerror',lambda e:report['errori_js'].append(str(e)))
  page.goto(base,wait_until='networkidle')
  vuota=page.evaluate('''async()=>{const {riconosciCasa}=await import('/src/io/riconoscimento-locale.js?v=1');return await riconosciCasa(new ImageData(400,300));}''')
  check('immagine vuota non inventa elementi',not vuota['muri'] and not vuota['aperture'] and not vuota['stanze'])
  casi=[(ext,f'due-stanze.{ext}') for ext in ['png','jpg','webp','pdf']]+[(name,name+'.png') for name in ['ruotata','fondo-nero','trasparente']]
  for ext,file in casi:
   page.locator('button.hud-tab[data-scheda="planimetrie"]').click()
   page.locator('#pl-file').set_input_files(str(FIX/file))
   page.wait_for_function('()=>!document.querySelector("#pl-file").disabled',timeout=40000)
   info=page.locator('#trc-auto-info').inner_text();print(info,flush=True)
   check(ext+' riconosce porta finestra e due stanze','1 porte, 1 finestre, 2 stanze' in info)
   check(ext+' motore effettivo senza fallback','non disponibile' not in info)
   page.locator('#trc-riconoscimento-dettagli summary').click()
   page.get_by_label('Nome stanza_1',exact=True).fill('Zona giorno')
   if ext=='png':
    def pt(x,y):
     c=page.locator('#trc-root canvas');z=c.evaluate('e=>({w:e.width,rw:e.getBoundingClientRect().width})');c.click(position={'x':x*z['rw']/z['w'],'y':y*z['rw']/z['w']})
    page.locator('#trc-dist').fill('11600');page.locator('#trc-calibra').click();pt(60,60);pt(640,60)
    page.locator('#trc-verifica-dist').fill('7600');page.locator('#trc-verifica').click();pt(60,60);pt(60,440)
    page.locator('#trc-auto-usa').click()
    check('OFF con quote abilita modello semantico',page.locator('#trc-invia').is_enabled())
    with page.expect_download() as dl:page.locator('#trc-esporta').click()
    esatto=json.loads(Path(dl.value.path()).read_text(encoding='utf-8'))
    page.locator('#trc-stima').check();page.locator('#trc-stima').uncheck()
    with page.expect_download() as dl:page.locator('#trc-esporta').click()
    ripristinato=json.loads(Path(dl.value.path()).read_text(encoding='utf-8'))
    check('ON poi OFF ripristina muri aperture e quote',esatto==ripristinato and not esatto['verifica_importazione']['dimensioni_stimate'] and esatto['verifica_importazione']['seconda_quota']['conforme'])
   page.locator('#trc-stima').check()
   if ext!='png':page.locator('#trc-auto-usa').click()
   check(ext+' generazione senza quote',page.locator('#trc-invia').is_enabled())
   if ext=='png':page.screenshot(path=str(OUT/'rilevamenti.png'))
   page.locator('#trc-invia').click()
   page.wait_for_function('()=>document.querySelector("#pl-stato").textContent.includes("generato e salvato")')
   page.locator('button.hud-tab[data-scheda="progetto"]').click()
   with page.expect_download() as dl:page.locator('#scarica').click()
   plan=json.loads(Path(dl.value.path()).read_text(encoding='utf-8'))
   report['risultati'][ext]=plan
   check(ext+' aperture reali nel modello',sorted(o['type'] for o in plan['openings'])==['finestra','porta'])
   check(ext+' pavimenti e nome persistiti',len(plan['floors'])==2 and plan['verifica_importazione']['stanze'][0]['nome']=='Zona giorno')
   check(ext+' scala dichiarata stimata',plan['verifica_importazione']['dimensioni_stimate'] and plan['verifica_importazione']['seconda_quota'] is None)
   check(ext+' componenti importati eseguiti','OpenCV' in plan['verifica_importazione']['motore'] and plan['verifica_importazione']['versione'])
   metric=page.evaluate('''async plan=>{
    const {verificaProgetto}=await import('/src/core/project.js?v=v20261021a');
    const {buildModel}=await import('/src/core/build.js?v=v20261021a');
    const scene=window.__sceneTest.find(s=>s.children.some(o=>o.type==='GridHelper'));
    const model=buildModel(plan,{items:[]});
    const passanti=plan.openings.every(o=>!model.boxes.some(b=>b.wall===o.wall&&b.kind==='muro'&&b.s0<o.offset+o.width/2&&b.s1>o.offset+o.width/2));
    let meshes=0;scene?.traverse(o=>{if(o.isMesh)meshes++});return {valido:verificaProgetto(plan).ok,meshes,passanti};
   }''',plan)
   check(ext+' geometria valida e mesh presenti',metric['valido'] and metric['meshes']>10)
   check(ext+' varchi effettivamente scavati nei muri',metric['passanti'])
   check(ext+' stima visibile nel progetto','DIMENSIONI STIMATE' in page.locator('#nome-plan').inner_text())
   check(ext+' avviso stima permanente sul viewport',page.locator('#scala-stimata').is_visible())
   if ext=='png':page.screenshot(path=str(OUT/'modello-3d.png'))
  page.locator('button.hud-tab[data-scheda="planimetrie"]').click()
  page.locator('.pl-card').filter(has_text='due-stanze.png').get_by_role('button',name='Apri modello',exact=True).click()
  page.locator('button.hud-tab[data-scheda="progetto"]').click()
  with page.expect_download() as dl:page.locator('#scarica').click()
  riaperta=json.loads(Path(dl.value.path()).read_text(encoding='utf-8'))
  originale=report['risultati']['png']
  check('riapertura IndexedDB conserva geometria e provenienza',all(riaperta[k]==originale[k] for k in ['walls','openings','floors','verifica_importazione']))
  prima=page.locator('#stile').input_value()
  page.locator('button.hud-tab[data-scheda="vista"]').click()
  page.get_by_role('button',name='Passeggiata in prima persona',exact=True).click()
  check('casa riconosciuta visitabile in prima persona',page.locator('#stile').input_value()=='solido')
  page.keyboard.press('w');page.keyboard.press('Escape')
  check('uscita passeggiata ripristina la vista',page.locator('#stile').input_value()==prima)
  annullata=page.evaluate('''async()=>{
   const {riconosciCasa}=await import('/src/io/riconoscimento-locale.js?v=1');const ac=new AbortController();
   const lavoro=riconosciCasa(new ImageData(700,500),{signal:ac.signal});ac.abort();try{await lavoro;return false}catch(e){return e.message==='Analisi annullata'}
  }''')
  check('annullamento termina il worker',annullata)
  check('zero errori JavaScript',not report['errori_js']);check('nessun servizio esterno',not report['rete_esterna'])
  browser.close()
finally:
 (OUT/'risultati.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
 server.shutdown();server.server_close()
