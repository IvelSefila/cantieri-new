// Vista 2D in SVG generata dalla stessa sorgente del 3D (progetto in mm). Funzione pura: restituisce una stringa SVG.
// Quote in mm: lunghezza di ogni muro e larghezza di ogni vano. Le superfici delle stanze vengono da core/rooms.js.
import { stanze } from "../core/rooms.js?v=v20261021a";
import { wallLengthMm } from "../core/model.js?v=v20261021a";
import { ingombroArredo, MATERIALI_PAVIMENTO } from "../core/project.js?v=v20261021a";

export function escHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Rettangolo di un muro: asse +/- t/2 sulla normale.
function rettangoloMuro(w) {
  const L = wallLengthMm(w);
  const ux = (w.b[0] - w.a[0]) / L;
  const uy = (w.b[1] - w.a[1]) / L;
  const nx = -uy * (w.t / 2);
  const ny = ux * (w.t / 2);
  const p = [
    [w.a[0] + nx, w.a[1] + ny],
    [w.b[0] + nx, w.b[1] + ny],
    [w.b[0] - nx, w.b[1] - ny],
    [w.a[0] - nx, w.a[1] - ny],
  ];
  return p;
}

// Punto del muro a distanza s dall'inizio, con lo scostamento n normale (mm).
function puntoSulMuro(w, s, n = 0) {
  const L = wallLengthMm(w);
  const ux = (w.b[0] - w.a[0]) / L;
  const uy = (w.b[1] - w.a[1]) / L;
  return [w.a[0] + ux * s - uy * n, w.a[1] + uy * s + ux * n];
}

export function planSvg(progetto, opzioni = {}) {
  const margine = opzioni.margine ?? 1200;
  const quote = opzioni.quote !== false;
  const pts = [];
  for (const w of progetto.walls) pts.push(...rettangoloMuro(w));
  for (const f of progetto.floors || []) {
    if (f.poligono) pts.push(...f.poligono);
    else pts.push([f.x0, f.y0], [f.x1, f.y1]);
  }
  if (!pts.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400"><text x="20" y="40" font-size="20" fill="#52606d">Progetto vuoto: aggiungi muri in modalità costruzione.</text></svg>`;
  }
  const x0 = Math.min(...pts.map((p) => p[0])) - margine;
  const x1 = Math.max(...pts.map((p) => p[0])) + margine;
  const y0 = Math.min(...pts.map((p) => p[1])) - margine;
  const y1 = Math.max(...pts.map((p) => p[1])) + margine;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" style="width:100%;height:100%;background:#f7f8fa">`);

  // pavimenti
  for (const f of progetto.floors || []) {
    const col = MATERIALI_PAVIMENTO[f.materiale]?.colore ?? [220, 210, 190];
    if (f.poligono) out.push(`<polygon points="${f.poligono.map((p) => p.join(",")).join(" ")}" fill="rgb(${col.join(",")})" stroke="#b8a88a" stroke-width="20"/>`);
    else out.push(`<rect x="${f.x0}" y="${f.y0}" width="${f.x1 - f.x0}" height="${f.y1 - f.y0}" fill="rgb(${col.join(",")})" stroke="#b8a88a" stroke-width="20"/>`);
  }

  // stanze: superficie al centro (mm2 -> m2 con due decimali)
  if (opzioni.stanze !== false) {
    for (const s of stanze(progetto.walls)) {
      const cx = s.contorno.reduce((a, p) => a + p[0], 0) / s.contorno.length;
      const cy = s.contorno.reduce((a, p) => a + p[1], 0) / s.contorno.length;
      out.push(`<text x="${cx}" y="${cy}" font-size="260" text-anchor="middle" fill="#334155">${(s.superficieMm2 / 1e6).toFixed(2).replace(".", ",")} m²</text>`);
    }
  }

  // muri
  for (const w of progetto.walls) {
    const p = rettangoloMuro(w).map((q) => q.join(",")).join(" ");
    out.push(`<polygon points="${p}" fill="#f1efe9" stroke="#1f2933" stroke-width="18"/>`);
  }

  // vani: vuoto bianco sul muro + battente/vetro
  for (const o of progetto.openings) {
    const w = progetto.walls.find((x) => x.id === o.wall);
    if (!w) continue;
    const color = o.type === "finestra" ? "#2563eb" : o.type === "scorrevole" ? "#0ea5e9" : "#b45309";
    out.push(`<line x1="${puntoSulMuro(w, o.offset)[0]}" y1="${puntoSulMuro(w, o.offset)[1]}" x2="${puntoSulMuro(w, o.offset + o.width)[0]}" y2="${puntoSulMuro(w, o.offset + o.width)[1]}" stroke="#f7f8fa" stroke-width="${w.t + 40}"/>`);
    out.push(`<line x1="${puntoSulMuro(w, o.offset)[0]}" y1="${puntoSulMuro(w, o.offset)[1]}" x2="${puntoSulMuro(w, o.offset + o.width)[0]}" y2="${puntoSulMuro(w, o.offset + o.width)[1]}" stroke="${color}" stroke-width="30"/>`);
    if (quote) {
      const m = puntoSulMuro(w, o.offset + o.width / 2, w.t / 2 + 260);
      out.push(`<text x="${m[0]}" y="${m[1]}" font-size="150" text-anchor="middle" fill="${color}">${escHtml(o.id)} ${fmt(o.width)}</text>`);
    }
  }

  // arredi
  for (const a of progetto.furniture || []) {
    const g = ingombroArredo(a);
    out.push(`<rect x="${g.x0}" y="${g.y0}" width="${g.L}" height="${g.D}" fill="rgb(${g.colore.join(",")})" fill-opacity="0.85" stroke="#111827" stroke-width="12"/>`);
  }

  // quote di linea sui muri (lunghezza in mm), al lato esterno
  if (quote) {
    for (const w of progetto.walls) {
      const L = wallLengthMm(w);
      const mid = puntoSulMuro(w, L / 2, w.t / 2 + 420);
      out.push(`<text x="${mid[0]}" y="${mid[1]}" font-size="160" text-anchor="middle" fill="#334155">${fmt(L)}</text>`);
    }
  }

  out.push("</svg>");
  return out.join("\n");
}
