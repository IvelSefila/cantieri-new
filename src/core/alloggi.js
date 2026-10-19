// Alloggi: gruppi di stanze collegate da porte interne. Un edificio con piu' alloggi si arreda un alloggio alla volta.
import { stanze } from "./rooms.js";

// Stanze che toccano un muro (una delle due facce cade dentro la stanza)
function stanzeSulMuro(w, interni) {
  const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  if (!L) return [];
  const nx = -(w.b[1] - w.a[1]) / L, ny = (w.b[0] - w.a[0]) / L;
  const mid = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2];
  return interni.filter((s) => pointInPoly([mid[0] + nx * 150, mid[1] + ny * 150], s.interno) || pointInPoly([mid[0] - nx * 150, mid[1] - ny * 150], s.interno));
}

function pointInPoly([x, y], poly) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

// Componenti collegate: due stanze si collegano se una porta sta su un muro che le tocca entrambe
export function alloggiDelProgetto(p) {
  const interni = stanze(p.walls);
  const padre = interni.map((_, i) => i);
  const trova = (i) => (padre[i] === i ? i : (padre[i] = trova(padre[i])));
  for (const o of p.openings) {
    if (o.type !== "porta") continue;
    const w = p.walls.find((x) => x.id === o.wall);
    if (!w) continue;
    const tocca = stanzeSulMuro(w, interni).map((s) => interni.indexOf(s));
    for (let k = 1; k < tocca.length; k++) padre[trova(tocca[k])] = trova(tocca[0]);
  }
  const gruppi = new Map();
  interni.forEach((s, i) => {
    const r = trova(i);
    if (!gruppi.has(r)) gruppi.set(r, []);
    gruppi.get(r).push(s);
  });
  return [...gruppi.values()].map((lista, k) => ({
    id: `alloggio_${k + 1}`,
    stanze: lista,
    m2: +(lista.reduce((a, s) => a + s.superficieMm2, 0) / 1e6).toFixed(1),
  }));
}
