// Alloggi: gruppi di stanze collegate da porte, escluse le parti comuni (corridoio, pianerottolo, ascensore).
// Parte comune = stanza che, togliendola, separa il resto in due o piu' gruppi abbastanza grandi (un corridoio
// che porta a piu' alloggi). Stanza senza porte = vano chiuso (ascensore o tecnico): non e' un alloggio.
import { stanze } from "./rooms.js?v=v20261020bl";

function pointInPoly([x, y], poly) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

// Stanze che toccano un muro (una delle due facce cade dentro la stanza)
function stanzeSulMuro(w, interni) {
  const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  if (!L) return [];
  const nx = -(w.b[1] - w.a[1]) / L, ny = (w.b[0] - w.a[0]) / L;
  const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
  return interni.filter((s) => pointInPoly([mid[0] + nx * 150, mid[1] + ny * 150], s.interno) || pointInPoly([mid[0] - nx * 150, mid[1] - ny * 150], s.interno));
}

// Componenti connesse di un insieme di indici, usando il grafo delle porte
function componenti(indici, adj) {
  const visti = new Set();
  const out = [];
  for (const i of indici) {
    if (visti.has(i)) continue;
    const gruppo = [];
    const coda = [i];
    visti.add(i);
    while (coda.length) {
      const x = coda.shift();
      gruppo.push(x);
      for (const y of adj[x]) if (indici.includes(y) && !visti.has(y)) { visti.add(y); coda.push(y); }
    }
    out.push(gruppo);
  }
  return out;
}

const AREA_MIN_ALLOGGIO_MM2 = 30e6; // un gruppo che separa e' un alloggio solo se vale almeno 30 m2 o ha 2+ stanze

export function analizzaAlloggi(p) {
  const interni = stanze(p.walls);
  const n = interni.length;
  const adj = interni.map(() => new Set());
  for (const o of p.openings) {
    if (o.type !== "porta") continue;
    const w = p.walls.find((x) => x.id === o.wall);
    if (!w) continue;
    const tocca = stanzeSulMuro(w, interni).map((s) => interni.indexOf(s));
    for (const a of tocca) for (const b of tocca) if (a !== b) { adj[a].add(b); adj[b].add(a); }
  }
  const tutti = interni.map((_, i) => i);
  const comuni = new Map(); // indice -> motivo
  // 1) funzione scelta dall'utente: parte comune
  interni.forEach((s, i) => {
    const f = (p.funzioniStanze ?? []).find((x) => JSON.stringify(x.poligono) === JSON.stringify(s.interno.map(([x, y]) => [Math.round(x), Math.round(y)])));
    if (f?.funzione === "comune") comuni.set(i, "indicata come parte comune");
  });
  // 2) corridoi: togliendo la stanza, il resto si divide in gruppi abbastanza grandi
  for (let i = 0; i < n; i++) {
    if (comuni.has(i) || adj[i].size < 2) continue;
    // un corridoio e' stretto e lungo: una stanza ampia che distribuisce non e' un corridoio
    const xs = interni[i].interno.map((q) => q[0]), ys = interni[i].interno.map((q) => q[1]);
    const lunghezza = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const larghezza = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    if (larghezza <= 0 || lunghezza / larghezza < 2.5) continue;
    const resto = tutti.filter((j) => j !== i && adj[j].size > 0);
    const gruppi = componenti(resto, adj).filter((g) => g.reduce((a, j) => a + interni[j].superficieMm2, 0) >= AREA_MIN_ALLOGGIO_MM2 || g.length >= 2);
    if (gruppi.length >= 2) comuni.set(i, `collega ${gruppi.length} alloggi: corridoio o pianerottolo`);
  }
  // 3) vani chiusi: senza porte, non sono alloggi (es. ascensore o locale tecnico)
  const isolate = new Map();
  interni.forEach((s, i) => {
    if (!comuni.has(i) && adj[i].size === 0) isolate.set(i, "nessuna porta: vano chiuso, probabile ascensore o locale tecnico");
  });
  // 4) alloggi: gruppi di stanze dopo aver tolto le parti comuni e i vani chiusi
  const abitabili = tutti.filter((i) => !comuni.has(i) && !isolate.has(i));
  const gruppi = componenti(abitabili, adj);
  const alloggi = gruppi.map((g, k) => ({
    id: `alloggio_${k + 1}`,
    stanze: g.map((i) => interni[i]),
    m2: +(g.reduce((a, i) => a + interni[i].superficieMm2, 0) / 1e6).toFixed(1),
  }));
  return {
    alloggi,
    comuni: [...comuni].map(([i, motivo]) => ({ stanza: interni[i], motivo, m2: +(interni[i].superficieMm2 / 1e6).toFixed(1) })),
    isolate: [...isolate].map(([i, motivo]) => ({ stanza: interni[i], motivo, m2: +(interni[i].superficieMm2 / 1e6).toFixed(1) })),
  };
}

// Solo gli alloggi (compatibilita')
export function alloggiDelProgetto(p) {
  return analizzaAlloggi(p).alloggi;
}
