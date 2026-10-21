"""Ispezione riproducibile di un originale locale: nessun upload esterno.
python tools/prova-pianta-reale.py --image C:/percorso/pianta.png --output scratch/pianta-reale
"""
import argparse,base64,http.server,threading,json,hashlib
from pathlib import Path
from PIL import Image,ImageDraw
from playwright.sync_api import sync_playwright
from serve import CantieriHandler

args=argparse.ArgumentParser(description=__doc__)
args.add_argument('--image',required=True);args.add_argument('--output',required=True)
opt=args.parse_args();originale=Path(opt.image);out=Path(opt.output);out.mkdir(parents=True,exist_ok=True)
class H(CantieriHandler):
 def log_message(self,*a):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),H);threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
report={'sha256_originale':hashlib.sha256(originale.read_bytes()).hexdigest(),'errori_js':[],'rete_esterna':[]}
try:
 with sync_playwright() as p:
  b=p.chromium.launch(channel='msedge',headless=True);context=b.new_context(viewport={'width':1440,'height':1100})
  def route(r):
   if not r.request.url.startswith(base):report['rete_esterna'].append(r.request.url);r.abort()
   else:r.continue_()
  context.route('**/*',route);page=context.new_page();page.on('pageerror',lambda e:report['errori_js'].append(str(e)))
  page.goto(base,wait_until='networkidle')
  url='data:image/png;base64,'+base64.b64encode(originale.read_bytes()).decode()
  report['rilevamenti']=page.evaluate('''async url=>{
   const im=new Image();im.src=url;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
   const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const {riconosciCasa}=await import('/src/io/riconoscimento-locale.js?v=1');
   return await riconosciCasa(ctx.getImageData(0,0,c.width,c.height));
  }''',url)
  r=report['rilevamenti'];im=Image.open(originale).convert('RGB');d=ImageDraw.Draw(im)
  for w in r['muri']:d.line([tuple(w['a']),tuple(w['b'])],fill='#e05c00',width=2)
  for o in r['aperture']:
   w=next(w for w in r['muri'] if w['id']==o['wall']);i=1 if w['a'][0]==w['b'][0] else 0
   a=list(w['a']);a[i]+=o['offset'];z=a.copy();z[i]+=o['width'];d.line([tuple(a),tuple(z)],fill='#157ee8' if o['type']=='finestra' else '#15994a',width=3)
  im.resize((im.width*2,im.height*2)).save(out/'overlay.png')
  print('rilevamenti:',len(r['muri']),'muri,',len(r['aperture']),'aperture,',len(r['stanze']),'stanze',flush=True)
  page.locator('button.hud-tab[data-scheda="planimetrie"]').click();page.locator('#pl-file').set_input_files(str(originale))
  page.wait_for_function('()=>!document.querySelector("#pl-file").disabled')
  page.locator('#trc-genera-casa').click()
  page.wait_for_function('()=>document.querySelector("#pl-stato").textContent.includes("generato e salvato")')
  page.locator('button.hud-tab[data-scheda="progetto"]').click()
  with page.expect_download() as dl:page.locator('#scarica').click()
  report['progetto']=json.loads(Path(dl.value.path()).read_text(encoding='utf-8'))
  progetto=report['progetto']
  assert progetto['verifica_importazione']['dimensioni_stimate']
  assert progetto['verifica_importazione']['finiture_dimostrative']
  assert progetto['floors'] and progetto['openings'] and all(o.get('cdi') for o in progetto['openings'])
  report['infissi_montati']=page.evaluate("""async p=>{
   const {buildModel}=await import('/src/core/build.js');const c=await (await fetch('/data/cdi-catalog.json')).json();
   const r=buildModel(p,c);if(!r.ok)throw Error(JSON.stringify(r.report));return r.stats.vani_con_infisso;
  }""",progetto)
  assert report['infissi_montati']==len(progetto['openings'])
  page.locator('button.hud-tab[data-scheda="progetto"]').click()
  page.wait_for_function('()=>document.querySelector("aside").getBoundingClientRect().right<5')
  page.screenshot(path=str(out/'modello-3d.png'))
  page.locator('#btn-pp').click()
  assert 'Esci' in page.locator('#btn-pp').inner_text() or 'Esci' in (page.locator('#btn-pp').get_attribute('aria-label') or '')
  page.keyboard.press('Escape')
  report['prima_persona']=True
  assert not report['errori_js'] and not report['rete_esterna']
  b.close()
finally:
 (out/'risultati.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
 server.shutdown();server.server_close()
