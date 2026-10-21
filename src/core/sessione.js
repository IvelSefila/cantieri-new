// Unico formato per importazione, esportazione e recupero locale.
import { verificaProgetto } from './project.js?v=v20261021a';
import { preparaSchedaGSA } from './scheda-gsa.js?v=v20261021a';

export const PARAMETRI_ANALISI = ['nordGradi', 'gsaFsh', 'gsaFf', 'gsaGglsh', 'gsaFfTelaio', 'gsaFshOb'];
export function preparaProgetto(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Progetto JSON non valido');
  const p = structuredClone({ floors: [], furniture: [], ...raw });
  const v = verificaProgetto(p);
  if (!v.ok) throw new Error(v.errors.join('; '));
  const a = p.analisi ?? {};
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw new Error('Analisi non valida');
  for (const k of PARAMETRI_ANALISI) if (a[k] != null && !Number.isFinite(a[k])) throw new Error(`Parametro ${k} non numerico`);
  const orientamenti = a.orientamenti ?? {};
  if (!orientamenti || typeof orientamenti !== 'object' || Array.isArray(orientamenti) || Object.values(orientamenti).some(x => !['N','NE','E','SE','S','SO','O','NO'].includes(x))) throw new Error('Orientamenti non validi');
  const schedaAnt = a.schedaAnt ?? { assegnazioni: {}, quote: [] };
  if (!schedaAnt || !schedaAnt.assegnazioni || typeof schedaAnt.assegnazioni !== 'object' || Array.isArray(schedaAnt.assegnazioni) || !Array.isArray(schedaAnt.quote)) throw new Error('Scheda ambiti non valida');
  if (Object.values(schedaAnt.assegnazioni).some(x => !x || typeof x !== 'object' || Array.isArray(x) || (x.densita != null && (!Number.isFinite(x.densita) || x.densita < 0)) || ['ambito','attivita','destinazione','riferimentoDensita'].some(k=>x[k]!=null && typeof x[k]!=='string'))) throw new Error('Assegnazioni ambiti non valide');
  if (schedaAnt.quote.some(q => !q || typeof q.muro !== 'string' || !Number.isFinite(q.mm)||q.mm<=0)) throw new Error('Quote di controllo non valide');
  if (a.energia != null && (typeof a.energia !== 'object' || Array.isArray(a.energia))) throw new Error('Scheda energia non valida');
  p.analisi = { ...Object.fromEntries(PARAMETRI_ANALISI.map(k => [k, a[k] ?? null])), orientamenti, gsaDaScheda: a.gsaDaScheda === true, schedaAnt, energia: a.energia ?? null, gsaLavoro:a.gsaLavoro==null?null:preparaSchedaGSA(a.gsaLavoro) };
  return p;
}

export function esportaSessione(progetto, assegnazioni = {}, analisi = {}) {
  const out = structuredClone(progetto);
  for (const o of out.openings) if (Object.hasOwn(assegnazioni, o.id)) o.cdi = assegnazioni[o.id];
  out.analisi = structuredClone(analisi);
  return preparaProgetto(out);
}
