"""Immagine -> rilevamento -> calibrazione -> modello 3D -> archivio, senza ricalco."""
import http.server,threading,json,io,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
from serve import CantieriHandler
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/evidenze/raster-automatico';OUT.mkdir(parents=True,exist_ok=True)
class H(CantieriHandler):
 def log_message(self,*a):pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',0),H);threading.Thread(target=srv.serve_forever,daemon=True).start()
r={'prove':[],'errori_js':[],'rete':[],'sorgenti':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'src/io/raster-muri.js',ROOT/'src/trace/ui.js',ROOT/'src/ui/planimetrie.js']}}
def check(n,v):r['prove'].append({'nome':n,'pass':bool(v)});print(('PASS 'if v else 'FAIL ')+n,flush=True);assert v,n
im=Image.new('RGB',(400,300),'white');d=ImageDraw.Draw(im)
for x,y,w,h in [(50,50,300,6),(50,244,300,6),(50,50,6,200),(344,50,6,200)]:d.rectangle((x,y,x+w-1,y+h-1),fill='black')
buf=io.BytesIO();im.save(buf,format='PNG')
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(channel='msedge',headless=True);page=b.new_page(viewport={'width':1440,'height':1100})
  base=f'http://127.0.0.1:{srv.server_port}/'
  def route(q):
   if not q.request.url.startswith(base):r['rete'].append(q.request.url);q.abort()
   else:q.continue_()
  page.route('**/*',route);page.on('pageerror',lambda e:r['errori_js'].append(str(e)))
  page.goto(base,wait_until='networkidle');page.locator('button.hud-tab[data-scheda="planimetrie"]').click()
  page.locator('#pl-file').set_input_files({'name':'rettangolo-auto.png','mimeType':'image/png','buffer':buf.getvalue()})
  page.wait_for_function('()=>!document.querySelector("#pl-file").disabled')
  check('upload avvia riconoscimento senza ricalco','4 tratti murari' in page.locator('#trc-auto-info').inner_text())
  page.locator('#trc-auto-usa').click()
  check('scala assente non inventa misure','distanza reale' in page.locator('#trc-auto-info').inner_text())
  def pt(x,y):
   c=page.locator('#trc-root canvas');z=c.evaluate('e=>({w:e.width,rw:e.getBoundingClientRect().width})');c.click(position={'x':x*z['rw']/z['w'],'y':y*z['rw']/z['w']})
  page.locator('#trc-dist').fill('6000');page.locator('#trc-calibra').click();pt(50,50);pt(350,50)
  page.locator('#trc-auto-usa').click()
  check('quattro muri creati senza clic sui muri','Muri: 4' in page.locator('.trc-stato').inner_text())
  check('seconda quota ancora richiesta',page.locator('#trc-invia').is_disabled())
  page.locator('#trc-verifica-dist').fill('4000');page.locator('#trc-verifica').click();pt(350,50);pt(350,250)
  check('seconda quota compatibile abilita 3D',page.locator('#trc-invia').is_enabled())
  page.screenshot(path=str(OUT/'riconoscimento.png'));page.locator('#trc-invia').click()
  page.wait_for_function('()=>document.querySelector("#pl-stato").textContent.includes("generato e salvato")')
  check('modello 3D e archivio collegati',page.locator('#vista canvas').count()==1 and page.locator('.pl-card').count()==1)
  page.locator('button.hud-tab[data-scheda="progetto"]').click()
  with page.expect_download() as dl:page.locator('#scarica').click()
  plan=json.loads(Path(dl.value.path()).read_text(encoding='utf-8'));(OUT/'modello.json').write_text(json.dumps(plan,indent=2),encoding='utf-8')
  check('provenienza automatica esportata',plan['verifica_importazione']['metodo']=='raster_muri_automatici')
  check('nessuna falsa apertura su rettangolo chiuso',plan['openings']==[])
  check('scala e spessore ricavati dai pixel',len(plan['walls'])==4 and all(w['t']==120 for w in plan['walls']))
  page.screenshot(path=str(OUT/'modello-3d.png'))
  page.reload(wait_until='networkidle');page.locator('button.hud-tab[data-scheda="planimetrie"]').click()
  page.locator('#pl-file').set_input_files({'name':'stima.png','mimeType':'image/png','buffer':buf.getvalue()})
  page.wait_for_function('()=>!document.querySelector("#pl-file").disabled')
  page.locator('#trc-stima').check();page.locator('#trc-auto-usa').click()
  check('ON abilita 3D senza quote',page.locator('#trc-invia').is_enabled())
  page.locator('#trc-stima').uncheck()
  check('OFF ripristina obbligo calibrazione',page.locator('#trc-invia').is_disabled() and 'Muri: 0' in page.locator('.trc-stato').inner_text())
  page.locator('#trc-stima').check();page.locator('#trc-auto-usa').click();page.locator('#trc-invia').click()
  page.wait_for_function('()=>document.querySelector("#pl-stato").textContent.includes("generato e salvato")')
  page.locator('button.hud-tab[data-scheda="progetto"]').click()
  with page.expect_download() as dl:page.locator('#scarica').click()
  estimated=json.loads(Path(dl.value.path()).read_text(encoding='utf-8'))
  check('3D stimato esportato con provenienza',estimated['verifica_importazione']['dimensioni_stimate'] and estimated['verifica_importazione']['seconda_quota'] is None and len(estimated['walls'])==4)
  check('zero errori JavaScript' ,not r['errori_js']);check('nessuna rete esterna',not r['rete']);b.close()
finally:
 (OUT/'risultati.json').write_text(json.dumps(r,indent=2,ensure_ascii=False),encoding='utf-8');srv.shutdown();srv.server_close()
