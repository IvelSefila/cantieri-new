"""Regressioni UI su server reale e IndexedDB, con guasti di storage riproducibili.
Eseguire: python tools/prova-debug-generale.py (richiede Playwright e Edge).
"""
import hashlib
import http.server
import json
from pathlib import Path
import threading
import sys
from playwright.sync_api import sync_playwright
from serve import CantieriHandler

sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/evidenze/debug-generale';OUT.mkdir(parents=True,exist_ok=True)
FIX=ROOT/'tests/fixtures/planimetrie'
report={'prove':[],'errori_js':[],'rete_esterna':[],'hash_sorgenti':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [*sorted((ROOT/'src').rglob('*.js')),ROOT/'index.html']}}
def save():(OUT/'browser.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
def check(name,condition):
    report['prove'].append({'nome':name,'pass':bool(condition)});save()
    print(('PASS 'if condition else 'FAIL ')+name,flush=True);assert condition,name
class Handler(CantieriHandler):
    def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}/'
plan=json.loads((ROOT/'data/plan-bilocale.json').read_text(encoding='utf-8'))
plan['openings'][0]['cdi']='porta-athens'
try:
  with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,channel='msedge')
    ctx=browser.new_context(viewport={'width':1440,'height':1000})
    def route(r):
        if not r.request.url.startswith(base):report['rete_esterna'].append(r.request.url);r.abort()
        else:r.continue_()
    ctx.route('**/*',route)
    page=ctx.new_page();page.set_default_timeout(12000)
    page.on('pageerror',lambda e:report['errori_js'].append(str(e)))
    def tab(name='progetto'):
      btn=page.locator(f'button.hud-tab[data-scheda="{name}"]')
      if 'attiva' not in (btn.get_attribute('class') or '') or 'chiuso' in (page.locator('aside').first.get_attribute('class') or ''):btn.click()
    def load(p,name='modello.json'):
        tab();page.locator('#carica').set_input_files({'name':name,'mimeType':'application/json','buffer':json.dumps(p).encode()})
        page.wait_for_function('()=>!document.querySelector("#nome-plan").textContent.includes("Caricamento")')
        # La lettura File API completa in un task successivo all'evento change.
        page.wait_for_function('n=>document.querySelector("#nome-plan").textContent.startsWith(n+":")',arg=name)
    def export():
        tab()
        with page.expect_download() as d:page.locator('#scarica').click()
        return json.loads(Path(d.value.path()).read_text(encoding='utf-8'))
    page.goto(base,wait_until='networkidle');tab();page.get_by_role('button',name='Architetto',exact=True).click();load(plan)
    before=export()
    for raw in [dict(plan,funzioniStanze={}),dict(plan,furniture=[{'id':'a','tipo':'toString','x':0,'y':0,'rot':0}])]:
        page.locator('#carica').set_input_files({'name':'rifiutato.json','mimeType':'application/json','buffer':json.dumps(raw).encode()})
        page.wait_for_function('()=>document.querySelector("#messaggi").dataset.tipo==="errore"')
        check('JSON invalido non cambia il progetto',export()['walls']==before['walls'])
    page.locator('#ant-file').set_input_files({'name':'ambiti-invalidi.json','mimeType':'application/json','buffer':b'{"assegnazioni":null,"quote":[]}'} )
    page.wait_for_function('()=>document.querySelector("#ant-esito").textContent.includes("non leggibile")')
    check('scheda ambiti invalida non corrompe esportazione',export()['analisi']['schedaAnt']==before['analisi']['schedaAnt'])
    sheet={'assegnazioni':{'P0:stanza_001':{'ambito':'ufficio','densita':0.1,'destinazione':'ufficio','riferimentoDensita':'dato di prova'}},'quote':[{'muro':plan['walls'][0]['id'],'mm':6000}]}
    page.locator('#ant-file').set_input_files({'name':'ambiti.json','mimeType':'application/json','buffer':json.dumps(sheet).encode()})
    page.wait_for_function('()=>document.querySelector("#ant-esito").textContent.startsWith("Scheda caricata")')
    check('scheda ambiti valida esportata',export()['analisi']['schedaAnt']==sheet)
    tab('planimetrie')
    senza_unita=(FIX/'rettangolo.dxf').read_bytes().replace(b'$INSUNITS',b'ALTRO')
    page.locator('#pl-file').set_input_files({'name':'unita-assenti.dxf','mimeType':'application/dxf','buffer':senza_unita})
    page.wait_for_function('()=>!document.querySelector("#pl-file").disabled')
    check('DXF senza unità bloccato prima di cambiare modello','Unità DXF' in page.locator('#pl-stato').inner_text() and export()['walls']==before['walls'])
    tab('planimetrie');page.locator('#pl-dxf-unita').select_option('6')
    page.locator('#pl-file').set_input_files({'name':'unita-confermate.dxf','mimeType':'application/dxf','buffer':senza_unita})
    page.wait_for_function('()=>!document.querySelector("#pl-file").disabled')
    dxf=export()
    check('DXF unità confermate conserva 6000 x 4000 mm',sorted(__import__('math').dist(w['a'],w['b'])for w in dxf['walls'])==[4000,4000,6000,6000] and dxf['verifica_importazione']['rapporto']['unita_confermate'])
    load(plan,'infissi.json')
    # Scelta dell'infisso tramite il controllo prodotto e undo effettivo.
    opening=plan['openings'][0]['id']
    sel=page.locator('#vani select').first
    alternative=sel.locator('option').evaluate_all("xs=>xs.map(e=>e.value).find(v=>v&&v!=='porta-athens')")
    sel.select_option(alternative)
    check('scelta infisso nel progetto',next(o for o in export()['openings']if o['id']==opening)['cdi']==alternative)
    page.locator('button.hud-tab[data-scheda="progetto"]').click();page.keyboard.press('Control+z')
    check('Ctrl+Z ripristina anche infisso',next(o for o in export()['openings']if o['id']==opening)['cdi']=='porta-athens')
    page.locator('#vani select').first.select_option(alternative)
    tab('planimetrie');page.locator('#pl-file').set_input_files(str(FIX/'scansione.png'))
    page.wait_for_function('()=>!document.querySelector("#pl-file").disabled')
    page.locator('#pl-chiudi').click()  # Prova il percorso di chiusura prima di riaprire l'originale.
    page.locator('.pl-card').filter(has=page.get_by_text('scansione.png',exact=True)).get_by_role('button',name='Apri tavola originale').click()
    page.wait_for_function('()=>!document.querySelector("#trc-root").inert')
    page.locator('#pl-chiudi').focus();page.keyboard.press('Tab')
    check('Tab resta nel dialogo PDF/immagine',page.evaluate('document.activeElement.closest("dialog")?.id')=='pl-editor')
    page.keyboard.press('Control+z')
    current_tool=page.locator('.hud-slot.attivo').get_attribute('data-strumento') if page.locator('.hud-slot.attivo').count() else None
    page.locator('#pl-chiudi').focus();page.keyboard.press('2')
    check('scorciatoie editor non agiscono sotto il dialogo',(page.locator('.hud-slot.attivo').get_attribute('data-strumento') if page.locator('.hud-slot.attivo').count() else None)==current_tool)
    page.locator('#trc-esporta').click()
    check('esportazione tracciato senza calibrazione rifiutata','Non esportato' in page.locator('.trc-stato').inner_text())
    page.locator('#pl-chiudi').click()
    check('Ctrl+Z nel dialogo non modifica progetto principale',next(o for o in export()['openings']if o['id']==opening)['cdi']==alternative)
    # GSA lavoro: dati, reset del progetto, importazione e refresh.
    tab('gsa');page.locator('[data-gsa-campo="lavoratori"]').fill('12');page.locator('[data-gsa-campo="lavoratori"]').press('Tab')
    page.locator('[data-gsa-campo="aperto_pubblico"]').check()
    page.locator('[data-gsa-esodo="numeroUscite"]').fill('3');page.locator('[data-gsa-esodo="numeroUscite"]').press('Tab')
    saved=export()
    check('dati GSA lavoro inclusi nel JSON',saved['analisi']['gsaLavoro']['lavoratori']=='12' and saved['analisi']['gsaLavoro']['esodo']['numeroUscite']=='3')
    page.get_by_role('button',name='Nuovo progetto (vuoto)',exact=True).click();tab('gsa')
    check('nuovo progetto azzera GSA precedente',page.locator('[data-gsa-campo="lavoratori"]').input_value()=='' and not page.locator('[data-gsa-campo="aperto_pubblico"]').is_checked())
    load(saved,'gsa-salvata.json');page.reload(wait_until='networkidle');tab('gsa')
    check('GSA ripristinata dopo import e refresh',page.locator('[data-gsa-campo="lavoratori"]').input_value()=='12' and page.locator('[data-gsa-esodo="numeroUscite"]').input_value()=='3' and page.locator('[data-gsa-campo="aperto_pubblico"]').is_checked())
    page.locator('[data-gsa-campo="lavoratori"]').fill('-1');page.locator('[data-gsa-campo="lavoratori"]').press('Tab')
    page.get_by_role('button',name='Calcola GSA',exact=True).click()
    check('GSA blocca numeri negativi','Correggi i valori' in page.locator('.gsa-esito').last.inner_text())
    page.locator('[data-gsa-campo="lavoratori"]').fill('12');page.locator('[data-gsa-campo="lavoratori"]').press('Tab')
    page.get_by_role('button',name='Calcola GSA',exact=True).click()
    check('GSA torna calcolabile con dati validi','Correggi i valori' not in page.locator('.gsa-esito').last.inner_text() and len(page.locator('.gsa-esito').last.inner_text())>20)
    # Guasto reale sul secondo put della transazione: niente record parziali.
    tab('planimetrie');count=page.locator('.pl-card').count()
    page.evaluate('''()=>{window.putOriginale=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(v,k){
      if(this.name==='documenti')throw new DOMException('Spazio di prova esaurito','QuotaExceededError');return window.putOriginale.call(this,v,k);};}''')
    page.locator('#pl-file').set_input_files({'name':'quota.png','mimeType':'image/png','buffer':(FIX/'scansione.png').read_bytes()})
    page.wait_for_function('()=>!document.querySelector("#pl-file").disabled')
    check('errore archivio non impedisce apertura tavola',page.locator('#pl-editor').is_visible() and 'Archivio non aggiornato' in page.locator('#pl-stato').text_content())
    page.locator('#pl-chiudi').click()
    check('transazione archivio fallita non lascia record orfani',page.locator('.pl-card').count()==count)
    page.evaluate('()=>{IDBObjectStore.prototype.put=window.putOriginale;}')
    # Il percorso non interrompe la UI dopo i rifiuti.
    tab();page.get_by_role('button',name='Apri esempio AR-02',exact=True).click()
    page.wait_for_function("()=>document.querySelector('#esito').textContent.includes('19 muri')")
    check('esempio e rendering ancora funzionanti',page.locator('#vista canvas').count()==1 and '19 muri' in page.locator('#esito').inner_text())
    page.screenshot(path=str(OUT/'desktop.png'))
    page.set_viewport_size({'width':390,'height':844})
    check('layout mobile senza overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
    page.screenshot(path=str(OUT/'mobile.png'))
    check('zero errori JavaScript',not report['errori_js'])
    check('collaudo locale senza rete esterna',not report['rete_esterna'])
    browser.close()
except Exception as e:
    report['errore']=str(e)
    raise
finally:
    save();server.shutdown();server.server_close()
