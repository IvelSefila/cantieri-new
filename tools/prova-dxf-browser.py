"""Prova DXF reale locale e reattività durante parsing/annullamento."""
import json,sys,threading,http.server,os
from pathlib import Path
from playwright.sync_api import sync_playwright
from serve import CantieriHandler
class H(CantieriHandler):
 def log_message(self,*a): pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),H)
threading.Thread(target=server.serve_forever,daemon=True).start()
out=Path('scratch/dxf-browser');out.mkdir(parents=True,exist_ok=True)
report={}
try:
 with sync_playwright() as p:
  b=p.chromium.launch(channel='msedge',headless=True)
  page=b.new_page(viewport={'width':1440,'height':1000});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(os.environ.get('CANTIERI_TEST_BASE',f'http://127.0.0.1:{server.server_port}/'),wait_until='networkidle')
  page.locator('button.hud-tab[data-scheda="planimetrie"]').click()
  # Usa le unità dichiarate nel file, senza override manuale.
  page.locator('#pl-dxf-unita').select_option('')
  page.evaluate('window.ticks=0;setInterval(()=>window.ticks++,10)')
  page.locator('#pl-file').set_input_files(sys.argv[1])
  page.wait_for_function('()=>!document.querySelector("#pl-file").disabled',timeout=60000)
  report['stato']=page.locator('#pl-stato').inner_text()
  assert 'modello generato' in report['stato'],report['stato']
  assert 'Filtro layer muri' in page.locator('#pl-dettagli').text_content()
  if 'floor-plan-apartment' in Path(sys.argv[1]).name:
   assert 'Porte: 2 riconosciute, 2 da verificare' in report['stato']
   report['porte']=page.evaluate("""()=>{
     const p=Object.values(localStorage).map(v=>{try{return JSON.parse(v)}catch{return null}}).find(v=>v?.walls?.length===8&&v?.openings?.length===6);
     if(!p)throw Error('Progetto con porte non persistito');
     return p.openings.filter(o=>o.type==='porta');
   }""")
   assert len(report['porte'])==2 and all(o['width']==850 and o['height']==2100 for o in report['porte'])
  page.screenshot(path=str(out/'modello.png'))
  report['worker']=page.evaluate('''async()=>{
   const {importaDxfLocale}=await import('/src/io/dxf-locale.js');
   const line='0\\nLINE\\n10\\n0\\n20\\n0\\n11\\n1000\\n21\\n0\\n';
   const f=new File(['0\\nSECTION\\n2\\nENTITIES\\n'+line.repeat(100000)+'0\\nENDSEC\\n0\\nEOF\\n'],'stress.dxf');
   const t=window.ticks;let rejected=false;
   try{await importaDxfLocale(f,{unitaSeAssenti:4});}catch(e){rejected=e.message.includes('500 segmenti');}
   const ticks=window.ticks-t;
   const controller=new AbortController();const task=importaDxfLocale(f,{}, {signal:controller.signal});controller.abort();
   let cancelled=false;try{await task;}catch(e){cancelled=e.name==='AbortError';}
   return {rejected,ticks,cancelled};
  }''')
  assert report['worker']['rejected'] and report['worker']['ticks']>0 and report['worker']['cancelled'],report
  # Anche il limite di complessità attraversa il form e ripristina i controlli.
  page.locator('#pl-dxf-layer-muri').uncheck()
  page.locator('#pl-file').set_input_files(sys.argv[1])
  page.wait_for_function('()=>!document.querySelector("#pl-file").disabled')
  report['limite_ui']=page.locator('#pl-stato').inner_text()
  if Path(sys.argv[1]).stat().st_size>100000:
   assert 'oltre 500 segmenti' in report['limite_ui']
  else:
   assert 'modello generato' in report['limite_ui']
  report['errori_js']=errors;assert not errors
  b.close()
 print(json.dumps(report,ensure_ascii=False))
finally:
 (out/'risultati.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 server.shutdown();server.server_close()
