"""Collaudo reale UI e, con --live, geocodifica/cartografia delle 20 regioni.
Eseguire: python tools/prova-browser.py [--live]
Non installa pacchetti. Richiede Playwright e Microsoft Edge disponibili.
"""
import http.server
import json
import hashlib
from pathlib import Path
import sys
import threading
from playwright.sync_api import sync_playwright
from serve import CantieriHandler

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "evidenze"
OUT.mkdir(parents=True, exist_ok=True)
REPORT = OUT / ("browser.json" if "--live" in sys.argv else "browser-ui.json")

class Handler(CantieriHandler):
    def log_message(self, *args):
        pass

server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
report = {"sha256_sorgenti": {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [*sorted((ROOT / 'src').rglob('*.js')), ROOT / 'tools/serve.py']}, "ui": [], "errori_js": [], "live": []}

def save():
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

def check(name, ok):
    report["ui"].append({"nome": name, "pass": bool(ok)})
    save()
    assert ok, name

try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, channel="msedge")
        page = browser.new_page(viewport={"width":1440,"height":1000})
        page.set_default_timeout(10000)
        page.on("pageerror", lambda e: report["errori_js"].append(str(e)))
        page.goto(f"http://127.0.0.1:{server.server_port}/", wait_until="networkidle")
        check("avvio 3D", page.locator("#vista canvas").count() > 0 and not report["errori_js"])
        page.locator('button.hud-tab[data-scheda="progetto"]').click()
        initial = page.locator("#nome-plan").inner_text()
        page.locator("#carica").set_input_files({"name":"invalido.json","mimeType":"application/json","buffer":b'{"schema":1,"unit":"mm","altezza_muri":2800}'})
        page.wait_for_timeout(150)
        check("import invalido preserva progetto precedente", page.locator("#nome-plan").inner_text() == initial)
        with page.expect_download() as download:
            page.locator("#scarica").click()
        exported = json.loads(Path(download.value.path()).read_text(encoding="utf-8"))
        check("esportazione dopo import rifiutato", "walls" in exported and "analisi" in exported)
        page.get_by_role("button", name="Nuovo progetto (vuoto)", exact=True).click()
        page.reload(wait_until="networkidle")
        check("refresh recupera progetto vuoto", "Nuovo progetto" in page.locator("#nome-plan").inner_text())
        page.locator('button.hud-tab[data-scheda="progetto"]').click()
        page.get_by_role("button", name="Apri esempio AR-02", exact=True).click()
        page.locator('button.hud-tab[data-scheda="asol"]').click()
        page.locator("#gsa-nord").fill("90")
        page.locator("#gsa-nord").press("Tab")
        page.locator('button.hud-tab[data-scheda="energia"]').click()
        page.locator('[data-campo="superficie_utile_m2"]').fill("123")
        page.locator('[data-campo="superficie_utile_m2"]').press("Tab")
        page.reload(wait_until="networkidle")
        page.locator('button.hud-tab[data-scheda="asol"]').click()
        check("nord persistito", page.locator("#gsa-nord").input_value() == "90")
        page.locator('button.hud-tab[data-scheda="energia"]').click()
        check("parametri energia persistiti", page.locator('[data-campo="superficie_utile_m2"]').input_value() == "123")
        for tab in page.locator("button.hud-tab").all():
            tab.click()
        page.locator("#hud-2d").click()
        check("vista 2D", page.locator("#vista-2d svg").count() == 1)
        page.locator("#hud-2d").click()
        page.screenshot(path=str(OUT / "desktop.png"))
        page.set_viewport_size({"width":390,"height":844})
        page.screenshot(path=str(OUT / "mobile.png"))
        check("viewport mobile senza overflow orizzontale", page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
        page.set_viewport_size({"width":1440,"height":1000})

        if "--live" in sys.argv:
            samples = json.loads((ROOT / "tests/fixtures/civici-italia.json").read_text(encoding="utf-8"))
            for sample in samples:
                result = page.evaluate("""async sample => {
                  const {calcolaGsaDaCivico} = await import('./src/core/altimetria-civico.js?v=v20261021a');
                  const requests=[];
                  const fetchFn=async (url,opts={})=>{
                    const q={url:String(url)}; requests.push(q); const start=performance.now();
                    try {const r=await fetch(url,opts);q.status=r.status;return r;}
                    catch(e){q.error=e.message;throw e;}
                    finally{q.ms=Math.round(performance.now()-start);}
                  };
                  const start=performance.now();
                  const result=await calcolaGsaDaCivico(sample.indirizzo,{fetchFn});
                  return {sample,requests,result,ms:Math.round(performance.now()-start)};
                }""", sample)
                report["live"].append(result)
                save()
                print(f'{len(report["live"])}/{len(samples)} {sample["regione"]}: {result["result"].get("provider", result["result"].get("errore"))}', flush=True)
                page.wait_for_timeout(1500)
        if "--live" in sys.argv:
            check("20 regioni effettivamente interrogate", len({r['sample']['regione'] for r in report['live']}) == 20)
            check("regione corretta per tutti i risultati risolti", all(r['result'].get('regione') == r['sample']['regione'] for r in report['live'] if r['result'].get('esito') == 'OK'))
            page.locator('button.hud-tab[data-scheda="gsa"]').click()
            page.locator('input[placeholder^="Cerca indirizzo"]').evaluate("e => e.value = 'Piazza Palazzo di Città 1 Torino'")
            page.get_by_role('button', name='Estrai Palazzo e Calcola GSA', exact=True).click()
            page.wait_for_function("()=>document.querySelector('#gsa-civico-stato').textContent.includes('Cartografia disponibile')")
            check("scheda civico visualizza vero LiDAR locale", 'LiDAR BDTRE' in page.locator('[data-scheda="gsa"].scheda').inner_text())
            check("riferimento non verificato resta indeterminato nella UI", 'INDETERMINATO' in page.locator('[data-scheda="gsa"].scheda').inner_text())
            page.get_by_role('button', name='10p', exact=True).click()
            check("simulazione dei piani visualizzata", 'Simulazione esplicita dei piani' in page.locator('[data-scheda="gsa"].scheda').inner_text())
        check("nessun errore JavaScript", not report["errori_js"])
        browser.close()
finally:
    save()
    server.shutdown()
print(json.dumps(report["ui"], ensure_ascii=False, indent=2))
