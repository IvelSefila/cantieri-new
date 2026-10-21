// DXF -> modello planimetria in mm interi.
// - Unita' dal DXF ($INSUNITS), convertite in mm.
// - riferimento "asse": la linea del DXF e' l'asse del muro.
// - riferimento "faccia_esterna": per le polilinee chiuse la linea e' il filo esterno; il contorno
//   viene spostato verso l'interno di t/2 con intersezione d'angolo (miter), cosi' il perimetro resta chiuso.
// Ogni arrotondamento a intero e' contato e riportato: nessuna correzione silenziosa.
import { validatePlan, SCHEMA } from "../core/model.js?v=v20261021a";

const TOL_MM = 0.0005; // sotto questa soglia un valore e' considerato gia' intero

function arrotonda(v, rep) {
  const r = Math.round(v);
  const dev = Math.abs(v - r);
  if (dev > TOL_MM) {
    rep.arrotondamenti++;
    rep.scostamento_max_mm = Math.max(rep.scostamento_max_mm, dev);
  }
  return r;
}

function area2(pts) { // doppia area con segno: >0 antiorario
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s;
}

// Intersezione tra due rette (p + s*u) e (q + r*v). null se parallele.
function intersezione(p, u, q, v) {
  const den = u[0] * v[1] - u[1] * v[0];
  if (Math.abs(den) < 1e-12) return null;
  const s = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den;
  return [p[0] + s * u[0], p[1] + s * u[1]];
}

// Sposta un contorno chiuso verso l'interno di d (mm), con miter agli angoli.
function contornoInterno(pts, d) {
  const n = pts.length;
  const orient = area2(pts) >= 0 ? 1 : -1; // antiorario: interno a sinistra
  const dirs = [];
  const offs = [];
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % n];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const u = [dx / len, dy / len];
    // normale verso l'interno
    const nrm = orient > 0 ? [-u[1], u[0]] : [u[1], -u[0]];
    dirs.push(u);
    offs.push([x1 + nrm[0] * d, y1 + nrm[1] * d]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const p = intersezione(offs[prev], dirs[prev], offs[i], dirs[i]);
    out.push(p ?? offs[i]);
  }
  return out;
}

export function dxfToPlan(parsed, opzioni = {}) {
  const rif = opzioni.riferimento === "faccia_esterna" ? "faccia_esterna" : "asse";
  const spessoreDefault = opzioni.spessoreDefault ?? 250;
  const spessori = opzioni.spessori ?? {};
  const rep = { arrotondamenti: 0, scostamento_max_mm: 0, avvisi: [], layers: {} };
  const scala = parsed.perMm;
  if(!Number.isFinite(scala)||scala<=0)throw Error('Unità DXF assenti o non supportate: scegli le unità originali prima di importare');
  const walls = [];
  let contatore = 0;

  for (const e of parsed.entities) {
    const t = spessori[e.layer] ?? spessoreDefault;
    if (!Number.isInteger(t) || t <= 0 || t % 2 !== 0) {
      rep.avvisi.push(`layer ${e.layer}: spessore ${t} non valido (intero pari > 0)`);
      continue;
    }
    rep.layers[e.layer] = (rep.layers[e.layer] || 0) + 1;

    // coordinate in mm (ancora decimali, arrotondate piu' avanti)
    let pts = e.punti.map(([x, y]) => [x * scala, y * scala]);

    if (e.tipo !== "LINE" && e.chiusa && rif === "faccia_esterna") {
      pts = contornoInterno(pts, t / 2);
    } else if (e.tipo !== "LINE" && e.chiusa === false && rif === "faccia_esterna") {
      rep.avvisi.push(`layer ${e.layer}: polilinea aperta trattata come asse`);
    }

    const ip = pts.map(([x, y]) => [arrotonda(x, rep), arrotonda(y, rep)]);
    const nSeg = e.chiusa ? ip.length : ip.length - 1;
    for (let i = 0; i < nSeg; i++) {
      const a = ip[i];
      const b = ip[(i + 1) % ip.length];
      if (a[0] === b[0] && a[1] === b[1]) continue; // segmento nullo dopo arrotondamento
      contatore++;
      walls.push({ id: `${e.layer}_${String(contatore).padStart(3, "0")}`, a, b, t, kind: e.layer });
    }
  }

  const plan = {
    schema: SCHEMA,
    unit: "mm",
    altezza_muri: opzioni.altezzaMuri ?? 2800,
    name: opzioni.nome ?? "Planimetria importata da DXF",
    fonte: `DXF (unita' originali: ${parsed.report.unita ?? "non dichiarate"}, riferimento: ${rif})`,
    walls,
    openings: [],
  };
  const check = validatePlan(plan);
  return { plan, check, report: { ...parsed.report, ...rep, avvisi:[...parsed.report.avvisi,...rep.avvisi], muri: walls.length } };
}
