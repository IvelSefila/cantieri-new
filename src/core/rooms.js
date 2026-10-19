// Stanze dal grafo dei muri. Funzioni pure, coordinate intere in mm.
// 1. Si spezzano i muri nei punti dove un altro muro li tocca (T e croci).
// 2. Si costruisce il grafo planare (nodi = estremi, archi = tratti di muro).
// 3. Si trovano le facce chiuse; la superficie interna e' l'area del contorno spostato di t/2 verso l'interno.
// Il perimetro esterno (faccia non limitata) viene escluso.

const key = (p) => `${p[0]},${p[1]}`;

// Punto P sul segmento A-B (estremi inclusi), con coordinate intere e collinearita' esatta.
function suSegmento(p, a, b) {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  if (cross !== 0) return false;
  const dot = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]);
  const len2 = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  return dot >= 0 && dot <= len2;
}

// Giunzione: un estremo di muro che arriva vicino all'asse di un muro non parallelo si porta sull'asse.
// Serve perche' nel progetto i muri spesso finiscono sul filo interno e non sull'asse.
// Tolleranza: semisomma degli spessori (il filo interno dista da un asse di meta' spessore).
export function connettiMuri(muri) {
  const out = muri.map((w) => ({ ...w, a: [...w.a], b: [...w.b] }));
  const proietta = (p, v) => {
    const dx = v.b[0] - v.a[0];
    const dy = v.b[1] - v.a[1];
    const L2 = dx * dx + dy * dy;
    const t = ((p[0] - v.a[0]) * dx + (p[1] - v.a[1]) * dy) / L2;
    if (t < 0 || t > 1) return null;
    const q = [Math.round(v.a[0] + t * dx), Math.round(v.a[1] + t * dy)];
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    return { q, d };
  };
  for (const w of out) {
    for (const estremo of ["a", "b"]) {
      const p = w[estremo];
      let best = null;
      for (const v of muri) {
        if (v.id === w.id) continue;
        const cross = (w.b[0] - w.a[0]) * (v.b[1] - v.a[1]) - (w.b[1] - w.a[1]) * (v.b[0] - v.a[0]);
        if (cross === 0) continue; // paralleli: nessuna giunzione
        const r = proietta(p, v);
        if (!r) continue;
        const tol = (w.t + v.t) / 2 + 1;
        if (r.d <= tol && r.d > 0 && (!best || r.d < best.d)) best = r;
      }
      if (best) w[estremo] = best.q;
    }
  }
  return out;
}

// Spezza i muri dove l'estremo di un altro muro cade sul loro interno.
export function spezzaMuri(muri) {
  let tratti = muri.map((w) => ({ ...w }));
  let cambiato = true;
  let giro = 0;
  while (cambiato && giro++ < 100) {
    cambiato = false;
    const nuovi = [];
    for (const w of tratti) {
      const punti = [];
      for (const v of tratti) {
        if (v === w) continue;
        for (const p of [v.a, v.b]) {
          const interno = !(p[0] === w.a[0] && p[1] === w.a[1]) && !(p[0] === w.b[0] && p[1] === w.b[1]);
          if (interno && suSegmento(p, w.a, w.b)) punti.push(p);
        }
      }
      if (!punti.length) { nuovi.push(w); continue; }
      cambiato = true;
      // ordina i punti lungo il muro e crea i tratti
      const ordinati = [w.a, ...punti.filter((p, i, arr) => arr.findIndex((q) => q[0] === p[0] && q[1] === p[1]) === i), w.b];
      ordinati.sort((p, q) => ((p[0] - w.a[0]) * (w.b[0] - w.a[0]) + (p[1] - w.a[1]) * (w.b[1] - w.a[1])) - ((q[0] - w.a[0]) * (w.b[0] - w.a[0]) + (q[1] - w.a[1]) * (w.b[1] - w.a[1])));
      for (let i = 0; i < ordinati.length - 1; i++) {
        nuovi.push({ ...w, id: `${w.id}.${i}`, a: ordinati[i], b: ordinati[i + 1] });
      }
    }
    tratti = nuovi;
  }
  return tratti;
}

// Grafo planare: nodi e archi (sia verso che indietro) con angolo di uscita.
function costruisciGrafo(tratti) {
  const nodi = new Map();
  const adj = new Map();
  const aggiungi = (p) => {
    const k = key(p);
    if (!nodi.has(k)) { nodi.set(k, p); adj.set(k, []); }
    return k;
  };
  const archi = [];
  for (const w of tratti) {
    if (w.a[0] === w.b[0] && w.a[1] === w.b[1]) continue;
    const ka = aggiungi(w.a);
    const kb = aggiungi(w.b);
    if (ka === kb) continue;
    adj.get(ka).push({ verso: kb, t: w.t, wall: w.id });
    adj.get(kb).push({ verso: ka, t: w.t, wall: w.id });
    archi.push([ka, kb]);
  }
  return { nodi, adj };
}

// Facce del grafo: si percorre ogni semi-arco e si sceglie il successivo in senso orario.
export function facceGrafo(tratti) {
  const { nodi, adj } = costruisciGrafo(tratti);
  for (const [k, lista] of adj) {
    const p = nodi.get(k);
    lista.sort((x, y) => Math.atan2(nodi.get(x.verso)[1] - p[1], nodi.get(x.verso)[0] - p[0]) - Math.atan2(nodi.get(y.verso)[1] - p[1], nodi.get(y.verso)[0] - p[0]));
  }
  const visitati = new Set();
  const facce = [];
  for (const [ka, lista] of adj) {
    for (const e of lista) {
      const id0 = `${ka}>${e.verso}`;
      if (visitati.has(id0)) continue;
      const ciclo = [];
      let da = ka;
      let arco = e;
      let guardia = 0;
      while (guardia++ < 10000) {
        const id = `${da}>${arco.verso}`;
        if (visitati.has(id)) break;
        visitati.add(id);
        ciclo.push({ da, a: arco });
        const a = arco.verso;
        const lista2 = adj.get(a);
        const i = lista2.findIndex((x) => x.verso === da);
        // arco successivo: quello precedente nella lista ordinata (senso di percorrenza della faccia)
        const next = lista2[(i - 1 + lista2.length) % lista2.length];
        da = a;
        arco = next;
        if (da === ka && arco.verso === e.verso) break;
      }
      facce.push(ciclo.map((c) => nodi.get(c.da)));
    }
  }
  return facce;
}

// Area con segno (positiva se antioraria in coordinate piane).
export function areaFirmata(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}

// Contorno interno: ogni lato e' spostato verso l'interno della meta' dello spessore del muro.
export function contornoInterno(pts, mezziSpessori) {
  const n = pts.length;
  const orient = areaFirmata(pts) >= 0 ? 1 : -1;
  const dirs = [];
  const offs = [];
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % n];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const u = [dx / len, dy / len];
    const nrm = orient > 0 ? [-u[1], u[0]] : [u[1], -u[0]];
    const d = mezziSpessori[i];
    dirs.push(u);
    offs.push([x1 + nrm[0] * d, y1 + nrm[1] * d]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const p = offs[prev];
    const u = dirs[prev];
    const q = offs[i];
    const v = dirs[i];
    const den = u[0] * v[1] - u[1] * v[0];
    if (Math.abs(den) < 1e-12) {
      // lati paralleli: muro che prosegue dritto (anche con spessore diverso) o moncone di muro (inversione a 180°).
      // Si mettono la fine del lato precedente e l'inizio del successivo: il contorno gira intorno alla testa del
      // moncone e ne toglie l'impronta intera (prima ne toglieva circa meta').
      const fine = [pts[i][0] + (p[0] - pts[prev][0]), pts[i][1] + (p[1] - pts[prev][1])];
      out.push(fine);
      if (Math.hypot(fine[0] - q[0], fine[1] - q[1]) > 1e-9) out.push(q);
      continue;
    }
    const s = ((q[0] - p[0]) * v[1] - (q[1] - p[1]) * v[0]) / den;
    out.push([p[0] + s * u[0], p[1] + s * u[1]]);
  }
  return out;
}

// Stanze: facce con superficie interna positiva. Il perimetro esterno non e' una stanza.
export function stanze(muri) {
  const tratti = spezzaMuri(connettiMuri(muri));
  const facce = facceGrafo(tratti);
  const out = [];
  for (const pts of facce) {
    if (pts.length < 3) continue;
    const area = areaFirmata(pts);
    if (area <= 0) continue; // faccia esterna o negativa
    // spessore medio dei muri del contorno: per lato, lo spessore del muro piu' vicino al lato
    const mezzi = pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const w = tratti.find((t) => (samePt(t.a, p) && samePt(t.b, q)) || (samePt(t.a, q) && samePt(t.b, p)));
      return w ? w.t / 2 : 0;
    });
    const interno = contornoInterno(pts, mezzi);
    // monconi: muri che entrano nella stanza senza chiuderla (il contorno torna indietro sullo stesso tratto)
    const monconi = pts.filter((p, i) => samePt(pts[(i - 1 + pts.length) % pts.length], pts[(i + 1) % pts.length])).length;
    const areaInterna = Math.abs(areaFirmata(interno));
    out.push({
      id: `stanza_${String(out.length + 1).padStart(3, "0")}`,
      contorno: pts,
      interno,
      superficieMm2: Math.round(areaInterna),
      superficieAsseMm2: Math.round(area),
      monconi,
    });
  }
  return out;
}

function samePt(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}
