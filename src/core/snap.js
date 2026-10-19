// Aggancio dei punti in costruzione. Funzioni pure, tutto in mm interi.
// Ordine di priorita': vertice esistente (entro la tolleranza) > angolo 0/45/90 rispetto al punto di partenza > griglia.

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Punti notevoli del progetto: estremi dei muri e centri dei pavimenti e degli arredi.
export function puntiNotevoli(progetto) {
  const pts = [];
  for (const w of progetto.walls) {
    pts.push(w.a, w.b);
  }
  for (const f of progetto.floors || []) {
    pts.push([f.x0, f.y0], [f.x1, f.y1], [f.x0, f.y1], [f.x1, f.y0]);
  }
  return pts;
}

// Aggancia un punto. opzioni: { griglia (mm, 0 = libera), partenza ([x,y] o null), tolleranza (mm), punti (array) }
// Restituisce { punto:[x,y] interi, aggancio: 'vertice' | 'angolo' | 'griglia' | 'libero' }.
export function agganciaPunto(p, opzioni = {}) {
  const griglia = opzioni.griglia ?? 0;
  const tolleranza = opzioni.tolleranza ?? 0;
  const partenza = opzioni.partenza ?? null;
  const punti = opzioni.punti ?? [];

  // 1. vertice esistente piu' vicino entro la tolleranza
  if (tolleranza > 0 && punti.length) {
    let best = null;
    for (const q of punti) {
      const d = dist(p, q);
      if (d <= tolleranza && (!best || d < best.d)) best = { q, d };
    }
    if (best) return { punto: [best.q[0], best.q[1]], aggancio: "vertice" };
  }

  // 2. angolo 0/45/90 rispetto al punto di partenza: si sceglie la direzione piu' vicina
  if (partenza) {
    const dx = p[0] - partenza[0];
    const dy = p[1] - partenza[1];
    const L = Math.hypot(dx, dy);
    if (L > 0) {
      const ang = Math.atan2(dy, dx);
      const passo = Math.PI / 4;
      const vicino = Math.round(ang / passo) * passo;
      const diff = Math.abs(ang - vicino);
      const soglia = (Math.PI / 180) * 4; // 4 gradi di tolleranza angolare
      if (diff <= soglia) {
        const x = Math.round(partenza[0] + L * Math.cos(vicino));
        const y = Math.round(partenza[1] + L * Math.sin(vicino));
        return { punto: applicaGriglia([x, y], griglia), aggancio: "angolo" };
      }
    }
  }

  // 3. griglia
  if (griglia > 0) return { punto: applicaGriglia(p, griglia), aggancio: "griglia" };
  return { punto: [Math.round(p[0]), Math.round(p[1])], aggancio: "libero" };
}

function applicaGriglia(p, griglia) {
  if (griglia > 0) return [Math.round(p[0] / griglia) * griglia, Math.round(p[1] / griglia) * griglia];
  return [Math.round(p[0]), Math.round(p[1])];
}

// Lunghezza del segmento in mm: intera per segmenti orizzontali/verticali, arrotondata e segnalata altrimenti.
export function lunghezzaSegmento(a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0) return { mm: Math.abs(dy), esatta: true };
  if (dy === 0) return { mm: Math.abs(dx), esatta: true };
  const L = Math.hypot(dx, dy);
  return { mm: Math.round(L), esatta: false, grezza: L };
}
