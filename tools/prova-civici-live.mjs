// Prova opt-in contro i servizi reali, mai nella suite offline.
// node tools/prova-civici-live.mjs [report.json]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { calcolaGsaDaCivico } from '../src/core/altimetria-civico.js';

const file = resolve(process.argv[2] || 'docs/evidenze/civici-live.json');
const campioni = JSON.parse(await readFile(new URL('../tests/fixtures/civici-italia.json', import.meta.url), 'utf8'));
const sha = createHash('sha256').update(await readFile(new URL('../src/core/altimetria-civico.js', import.meta.url))).digest('hex');
const risultati = [];
const started = new Date().toISOString();
async function prova(campione) {
  const richieste = [];
  const t0 = Date.now();
  const totale = AbortSignal.timeout(25000);
  const fetchFn = async (url, options = {}) => {
    const t = Date.now();
    const voce = { url: String(url), stato: null };
    richieste.push(voce);
    try {
      const signals = [totale, AbortSignal.timeout(6000), options.signal].filter(Boolean);
      const res = await fetch(url, { ...options, headers: { ...options.headers, 'User-Agent': 'CantieriNew/0.1 verifica-civici (read-only; https://github.com/IvelSefila/cantieri-new)' }, signal: AbortSignal.any(signals) });
      voce.stato = res.status;
      voce.cors = res.headers.get('access-control-allow-origin');
      voce.retry_after = res.headers.get('retry-after');
      const bytes = await res.arrayBuffer();
      voce.bytes = bytes.byteLength;
      // Il corpo viene letto entro il timeout: si passa una Response utilizzabile dai parser reali.
      return new Response(bytes, { status: res.status, headers: res.headers });
    } catch (e) {
      voce.errore = e.message;
      throw e;
    } finally { voce.ms = Date.now() - t; }
  };
  let esito;
  try {
    esito = await calcolaGsaDaCivico(campione.indirizzo, { fetchFn });
  } catch (e) { esito = { esito: 'ERRORE', errore: e.message }; }
  const geo = esito.coordinate;
  const distanzaCittaM = geo ? Math.hypot((geo.lat - campione.lat) * 111320, (geo.lon - campione.lon) * 111320 * Math.cos(campione.lat * Math.PI / 180)) : null;
  const r = { campione, ms: Date.now() - t0, regione_coerente: esito.regione === campione.regione,
    entro_area_campione_5km: distanzaCittaM !== null && distanzaCittaM < 5000,
    nota: 'Il controllo entro 5 km verifica solo la città attesa; non certifica la precisione del civico o l’altezza.',
    richieste, risultato: esito };
  risultati.push(r);
  console.log(`${risultati.length}/${campioni.length} ${campione.regione}: ${esito.esito} | ${esito.provider || esito.errore} | ${r.ms} ms`);
  await salva();
}
async function salva() {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ iniziato: started, aggiornato: new Date().toISOString(), sha256_altimetria: sha,
    ambito: 'Campione di 22 indirizzi in 20 regioni; nessuna certificazione di copertura nazionale o di altezza reale.',
    totale_atteso: campioni.length, risultati }, null, 2));
}
// Sequenziale: limiti dei servizi pubblici e artefatto incrementale senza scritture concorrenti.
for (const c of campioni) { await prova(c); await new Promise(resolve => setTimeout(resolve, 1500)); }
console.log(`Report: ${file}`);
