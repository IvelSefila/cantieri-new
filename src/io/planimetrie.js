import { preparaProgetto } from '../core/sessione.js?v=v20261021g';
import { parseDxf } from './dxf.js?v=v20261021g';
import { dxfToPlan } from './toPlan.js?v=v20261021g';
import { importaDxfLocale } from './dxf-locale.js';

export function formatoPlanimetria(file) {
  const ext = String(file.name || '').split('.').pop().toLowerCase();
  if (['json', 'dxf', 'pdf', 'png', 'jpg', 'jpeg', 'webp'].includes(ext)) return ['jpg','jpeg','png','webp'].includes(ext) ? 'immagine' : ext;
  throw new Error('Formato non supportato: scegli JSON, DXF, PDF, PNG, JPG o WebP');
}

export async function leggiPlanimetria(file, opzioni = {}) {
  const formato = formatoPlanimetria(file);
  if (file.size > 50 * 1024 * 1024) throw new Error('Il file supera 50 MB: riduci o separa le pagine');
  if (formato === 'json') return { formato, progetto: preparaProgetto(JSON.parse(await file.text())) };
  if (formato === 'dxf') {
    if(typeof Worker!=='undefined')return {formato,...await importaDxfLocale(file,opzioni,{signal:opzioni.signal})};
    const result = dxfToPlan(parseDxf(await file.text(),opzioni), { ...opzioni, nome: file.name });
    if (!result.check.ok || !result.plan.walls.length) throw new Error(result.check.errors.join('; ') || 'Il DXF non contiene segmenti supportati');
    return { formato, progetto: preparaProgetto(result.plan), report: result.report };
  }
  return { formato, file };
}
