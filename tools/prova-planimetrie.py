"""Collaudo UI reale, offline: import PC -> modello -> JSON e archivio IndexedDB.
Eseguire con Python + Playwright e Edge: python tools/prova-planimetrie.py
"""
import http.server
import hashlib
import json
import math
from pathlib import Path
import sys
import threading
from playwright.sync_api import sync_playwright
from serve import CantieriHandler

sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
FIX=ROOT/'tests/fixtures/planimetrie'
OUT=ROOT/'docs/evidenze/planimetrie';OUT.mkdir(parents=True,exist_ok=True)
manifest=json.loads((FIX/'manifest.json').read_text())
report={'prove':[],'errori_js':[],'richieste_esterne':[],'mutazioni_http':[],
        'fonti_sha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [*sorted((ROOT/'src').rglob('*.js')),ROOT/'index.html',*sorted(FIX.glob('*'))]}}
def save(): (OUT/'risultati.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
def check(name,ok,**details):
    report['prove'].append(dict(nome=name,passa=bool(ok),**details));save()
    print(f'{"PASS" if ok else "FAIL"} {name}',flush=True)
    if not ok:print(page.locator('#trc-verifica-info').inner_text(),page.locator('.trc-stato').inner_text(),flush=True)
    assert ok,name
class Handler(CantieriHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'

try:
  with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,channel='msedge')
    ctx=browser.new_context(viewport={'width':1440,'height':1100})
    # Osservazione nativa di Three.js, solo nel test: nessun accesso di debug nel prodotto.
    ctx.add_init_script('''window.__sceneTest=[];window.__THREE_DEVTOOLS__=new EventTarget();
      window.__THREE_DEVTOOLS__.addEventListener('observe',e=>{if(e.detail.isScene)window.__sceneTest.push(e.detail)});''')
    def route(r):
        if not r.request.url.startswith(url):
            report['richieste_esterne'].append(r.request.url);r.abort();return
        if r.request.method!='GET':report['mutazioni_http'].append(r.request.method+' '+r.request.url)
        r.continue_()
    ctx.route('**/*',route)
    page=ctx.new_page();page.set_default_timeout(12000)
    page.on('pageerror',lambda e:report['errori_js'].append(str(e)))
    def tab(name='planimetrie'):page.locator(f'button.hud-tab[data-scheda="{name}"]').click()
    def upload(name):
        tab();page.locator('#pl-file').set_input_files(str(FIX/name))
        page.wait_for_function('()=>!document.querySelector("#pl-file").disabled')
    def export():
        tab('progetto')
        with page.expect_download() as d:page.locator('#scarica').click()
        p=json.loads(Path(d.value.path()).read_text(encoding='utf-8'));tab();return p
    def dimensions(name,p,expected,tol=0):
        got=[math.dist(w['a'],w['b']) for w in p['walls']]
        errors=[abs(a-b) for a,b in zip(sorted(got),sorted(expected))]
        check(name,len(got)==len(expected) and max(errors,default=0)<=tol,lunghezze_mm=got,attese_mm=expected,scarto_massimo_mm=max(errors,default=0),tolleranza_mm=tol)
        check(name+' — scena 3D presente',page.locator('#vista canvas').count()==1)
        if name.endswith('dxf'):check(name+' — rapporto unità e arrotondamenti esportato',p.get('verifica_importazione',{}).get('metodo')=='dxf' and p['verifica_importazione']['rapporto']['arrotondamenti']==0)
        metric=page.evaluate('''async plan=>{
          const T=await import('three'),scene=window.__sceneTest.find(s=>s.children.some(o=>o.type==='GridHelper'));
          const muri=[];
          scene.traverse(o=>{
            if(o.userData.kind!=='muro')return;
            if(o.isInstancedMesh)for(let i=0;i<o.count;i++){
              const m=new T.Matrix4();o.getMatrixAt(i,m);muri.push({wall:o.userData.scatole[i].wall,m});
            }else if(o.isMesh&&o.userData.finito){o.updateMatrix();muri.push({wall:o.userData.wall,m:o.matrix});}
          });
          let scarto=0;
          for(const w of plan.walls){
            const v=muri.find(x=>x.wall===w.id);if(!v)return {ok:false};
            const pos=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();v.m.decompose(pos,q,s);
            const attesi=[Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),plan.altezza_muri,w.t,(w.a[0]+w.b[0])/2,plan.altezza_muri/2,(w.a[1]+w.b[1])/2];
            [s.x,s.y,s.z,pos.x,pos.y,pos.z].forEach((x,i)=>scarto=Math.max(scarto,Math.abs(x*1000-attesi[i])));
          }
          return {ok:muri.length===plan.walls.length&&scarto<.02,scarto,muri:muri.length};
        }''',p)
        check(name+' — misure mesh 3D',metric['ok'],scarto_mm=metric.get('scarto'),muri=metric.get('muri'))
        (OUT/(name.replace(' ','_').replace('/','_')+'.json')).write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf-8')
    def pdf_points(name,num,points):
        return page.evaluate('''async ({bytes,num,points})=>{
          const pdf=await import('./vendor/pdfjs/pdf.mjs');
          pdf.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',location.href).href;
          const doc=await pdf.getDocument({data:new Uint8Array(bytes),disableFontFace:true,isEvalSupported:false}).promise;
          const p=await doc.getPage(num),base=p.getViewport({scale:1});
          const v=p.getViewport({scale:Math.min(3,3200/Math.max(base.width,base.height))});
          const out=points.map(q=>v.convertToViewportPoint(...q));await doc.destroy();return out;
        }''',dict(bytes=list((FIX/name).read_bytes()),num=num,points=points))
    def click_point(p):
        c=page.locator('#trc-root canvas')
        size=c.evaluate('e=>({w:e.width,h:e.height,rw:e.getBoundingClientRect().width,rh:e.getBoundingClientRect().height})')
        c.click(position={'x':p[0]*size['rw']/size['w'],'y':p[1]*size['rh']/size['h']})
    def verify(points,length):
        page.locator('#trc-verifica-dist').fill(str(length));page.locator('#trc-verifica').click()
        for q in points:click_point(q)
    def pdf_page(num,count):
        page.locator('#trc-pagina').select_option(str(num))
        page.wait_for_function('([n,c])=>document.querySelector(".trc-stato").textContent.includes(`pagina ${n}/`) && document.querySelector("#trc-vettori-info").textContent.startsWith(`${c} segmenti`)',arg=[num,count])
    def generate_vector(points,expected,name):
        page.locator('#trc-spessore').fill('200');page.locator('#trc-spessore').dispatch_event('change')
        page.get_by_role('button',name='Applica scala PDF',exact=True).click()
        page.locator('#trc-tutti').click();verify([points[-1],points[0]],expected[-1])
        check(name+' — seconda quota',page.locator('#trc-genera-pdf').is_enabled())
        page.locator('#trc-genera-pdf').click()
        page.wait_for_function('()=>document.querySelector("#pl-stato").textContent.includes("generato e salvato")')
        dimensions(name,export(),expected)
    page.goto(url,wait_until='networkidle');tab()
    check('nuova voce Planimetrie accessibile',page.locator('#pl-file').is_visible())
    for stem,lengths in [('rettangolo',[6000,4000,6000,4000]),('elle',[8000,3000,4000,3000,4000,6000])]:
        for ext in ['json','dxf']:
            upload(f'{stem}.{ext}');dimensions(f'{stem} {ext}',export(),lengths)
    page.locator('#pl-dxf-rif').select_option('faccia_esterna');page.locator('#pl-spessore').fill('200')
    upload('rettangolo.dxf');p=export();dimensions('DXF filo esterno',p,[5800,3800,5800,3800])
    x=[v[0] for w in p['walls'] for v in [w['a'],w['b']]];y=[v[1] for w in p['walls'] for v in [w['a'],w['b']]]
    check('DXF esterno conserva ingombro 6000 x 4000 mm',max(x)-min(x)+200==6000 and max(y)-min(y)+200==4000)
    page.locator('#pl-dxf-rif').select_option('asse')
    count=page.locator('#pl-elenco .pl-card').count()
    page.reload(wait_until='networkidle');tab()
    check('raccolta persiste dopo refresh',page.locator('#pl-elenco .pl-card').count()==count)
    card=page.locator('.pl-card').filter(has=page.get_by_text('rettangolo.json',exact=True));card.get_by_role('button',name='Apri modello',exact=True).click()
    dimensions('modello riaperto',export(),[6000,4000,6000,4000])
    upload('vettoriale.pdf')
    check('PDF due pagine interamente locale',page.locator('#pl-editor').is_visible() and page.locator('#trc-pagina option').count()==2)
    page.wait_for_function('()=>document.querySelector("#trc-vettori-info").textContent.startsWith("4 segmenti")')
    points=pdf_points('vettoriale.pdf',1,manifest['pdf'][0]['points_pdf'])
    page.locator('#trc-scala-pdf').fill('200');page.get_by_role('button',name='Applica scala PDF',exact=True).click();page.locator('#trc-tutti').click()
    verify([points[3],points[0]],4000)
    check('scala errata blocca generazione',page.locator('#trc-genera-pdf').is_disabled() and 'NON compatibile' in page.locator('#trc-verifica-info').inner_text())
    page.locator('#trc-scala-pdf').fill('100')
    generate_vector(points,manifest['pdf'][0]['lengths'],'PDF vettoriale rettangolo')
    card=page.locator('.pl-card').filter(has=page.get_by_text('vettoriale.pdf',exact=True));card.get_by_role('button',name='Apri tavola originale',exact=True).click()
    page.wait_for_function('()=>document.querySelector(".trc-stato").textContent.includes("pagina 1/")')
    pdf_page(2,6)
    check('cambio pagina richiede nuova verifica',page.locator('#trc-genera-pdf').is_disabled())
    pdf_page(1,4);pdf_page(2,6)
    check('ritorno alle pagine conserva segmenti vettoriali',page.locator('#trc-vettori-info').inner_text().startswith('6 segmenti'))
    points=pdf_points('vettoriale.pdf',2,manifest['pdf'][1]['points_pdf'])
    page.screenshot(path=str(OUT/'pdf-vettoriale-ruotato.png'))
    generate_vector(points,manifest['pdf'][1]['lengths'],'PDF vettoriale ruotato elle')
    page.screenshot(path=str(OUT/'modello-pdf-elle.png'))
    # Raster: nessuna falsa estrazione automatica. Calibrazione e tracciamento reali.
    for name in ['scansione.pdf','scansione.png','scansione.jpg','scansione.webp']:
        upload(name)
        points=pdf_points(name,1,manifest['raster_pdf_points']) if name.endswith('.pdf') else manifest['raster_points']
        if name.endswith('.pdf'):check('PDF scansione riconosciuto senza vettori',page.locator('#trc-vettori-info').inner_text().startswith('0 segmenti') and page.locator('#trc-genera-pdf').is_disabled())
        # Come nell'uso manuale, ingrandisci la scansione prima di scegliere gli estremi.
        page.locator('#trc-zoom').press('End')
        page.locator('#trc-dist').fill('8000');page.locator('#trc-snap').select_option('0')
        page.locator('#trc-calibra').click();click_point(points[0]);click_point(points[1])
        verify([points[1],points[2]],4000)
        check(name+' — quota verificata','Quota compatibile' in page.locator('#trc-verifica-info').inner_text())
        if name.endswith('.pdf'):page.screenshot(path=str(OUT/'pdf-scansione.png'))
        page.locator('#trc-muro').click()
        for q in [*points,points[0]]:click_point(q)
        page.locator('#trc-invia').click()
        page.wait_for_function('()=>document.querySelector("#pl-stato").textContent.includes("generato e salvato")')
        # Raster originale: 10 mm/pixel. Non si dichiara una precisione millimetrica fittizia.
        dimensions(name,export(),manifest['raster_lengths'],tol=10)
    before=export();count=page.locator('.pl-card').count();upload('invalido.pdf')
    check('PDF corrotto rifiutato senza salvare né sostituire modello',not page.locator('#pl-editor').is_visible() and 'non completata' in page.locator('#pl-stato').inner_text() and page.locator('.pl-card').count()==count and export()['walls']==before['walls'])
    page.locator('#pl-titolo').fill('Copia progetto verificato');page.locator('#pl-salva').click()
    page.wait_for_function('()=>document.querySelector("#pl-stato").textContent.includes("Progetto salvato")')
    check('salvataggio manuale nella raccolta',page.locator('.pl-card').filter(has=page.get_by_text('Copia progetto verificato',exact=True)).count()==1)
    page.reload(wait_until='networkidle');tab('affidabilita')
    check('recupero non nasconde origine raster stimata','Tracciate su un’immagine' in page.locator('[data-scheda="affidabilita"].scheda').inner_text().replace("un'immagine",'un’immagine'))
    tab()
    page.screenshot(path=str(OUT/'raccolta-planimetrie.png'))
    page.set_viewport_size({'width':390,'height':844})
    check('menu mobile senza overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    page.screenshot(path=str(OUT/'raccolta-mobile.png'))
    check('nessun upload HTTP dei documenti',not report['mutazioni_http'])
    check('nessuna dipendenza da richieste esterne',not report['richieste_esterne'])
    check('nessun errore JavaScript',not report['errori_js'])
    browser.close()
finally:
    save();server.shutdown()
