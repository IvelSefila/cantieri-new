// Arredo intelligente: ogni pezzo sceglie la parete giusta in base alla sua funzione e all'orientamento.
// Le regole sono dati (REGOLE_ARREDO) e vanno lette con skill arredo-planimetria (.claude/skills/arredo-planimetria).
import { stanze } from "./rooms.js?v=v20261020bk";
import { orientamentoDaGeometria, latoEsterno } from "./gsa.js?v=v20261020bk";
import { aggiungiArredo } from "./project.js?v=v20261020bk";
import { collisioniArredo, LIBRERIA_3D } from "./arredi.js?v=v20261020bk";
import { dentroPoligono } from "./elementi.js?v=v20261020bk";
import { funzioneStanza, ARREDO_PER_FUNZIONE_ELENCO } from "./funzioni-stanze.js?v=v20261020bk";

// Regole per tipo di pezzo. parete: dove sta il pezzo (testata = la schiena contro il muro).
//  - preferenze: orientamenti (N, NE, E, SE, S, SO, O, NO) in ordine di preferenza per la parete
//  - evita: "finestra" (non davanti alle finestre), "porta" (mai a meno di 900 mm dalle porte)
//  - vicinoA: il pezzo va accanto (o davanti, per "davanti") a un altro pezzo della stessa stanza
export const REGOLE_ARREDO = {
  letto_matrimoniale: { parete: "testata", preferenze: ["N", "NO", "NE", "O", "E"], evita: ["finestra", "porta"] },
  letto_singolo: { parete: "testata", preferenze: ["N", "NO", "NE", "O", "E"], evita: ["finestra", "porta"] },
  comodino: { vicinoA: "letto", evita: ["porta"] },
  armadio: { parete: "libera", preferenze: ["N", "NO", "NE", "E", "O"], evita: ["finestra", "porta"] },
  scrivania: { parete: "finestra", preferenze: ["E", "O", "SE", "SO"], evita: ["porta"] },
  cassettiera: { parete: "libera", preferenze: ["N", "NO", "NE"], evita: ["finestra", "porta"] },
  divano: { parete: "libera", preferenze: ["N", "NO", "NE", "O", "E"], evita: ["finestra", "porta"] },
  tavolino: { davanti: "divano", evita: ["porta"] },
  mobile_tv: { paretePosta: "opposta_divano", evita: ["finestra", "porta"] },
  poltrona: { vicinoA: "divano", evita: ["porta"] },
  cucina: { parete: "libera", preferenze: ["N", "NO", "NE", "O", "E", "SO"], evita: ["finestra", "porta"] },
  frigorifero: { vicinoA: "cucina", evita: ["porta"] },
  tavolo: { parete: "libera", preferenze: [], evita: ["porta"], centro: true },
  sedia: { vicinoA: "tavolo", evita: ["porta"] },
  wc: { parete: "umida", preferenze: ["N", "NO", "NE", "O", "E"], evita: ["porta", "finestra"] },
  bidet: { vicinoA: "wc", evita: ["porta"] },
  lavabo: { parete: "umida", preferenze: ["N", "NO", "NE", "O", "E"], evita: ["porta"] },
  doccia: { parete: "umida", preferenze: ["N", "NO", "NE", "O", "E"], evita: ["porta"] },
};

const MARGINE_PORTA = 900;
const DISTANZA_FINESTRA = 600;

function bordi(s) {
  const out = [];
  for (let i = 0; i < s.interno.length; i++) out.push([s.interno[i], s.interno[(i + 1) % s.interno.length]]);
  return out;
}

// Muro del progetto che corrisponde a un lato della stanza (il piu' vicino al punto medio)
function muroDelLato(p, a, b) {
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let migliore = null;
  for (const w of p.walls) {
    const d = distPuntoSegmento(mid, w.a, w.b);
    if (!migliore || d < migliore.d) migliore = { w, d };
  }
  return migliore && migliore.d < 400 ? migliore.w : null;
}

function distPuntoSegmento([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// Punti delle porte e delle finestre nel piano (mm), per il calcolo delle distanze
function puntiAperture(p, tipo) {
  return p.openings.filter((o) => o.type === tipo).map((o) => {
    const w = p.walls.find((x) => x.id === o.wall);
    if (!w) return null;
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const t = (o.offset + o.width / 2) / L;
    return { p: [w.a[0] + (w.b[0] - w.a[0]) * t, w.a[1] + (w.b[1] - w.a[1]) * t], wall: w.id };
  }).filter(Boolean);
}

// Lati candidati della stanza: parete, orientamento, presenza di finestre e porte
function paretiDellaStanza(p, s, interni) {
  const porte = puntiAperture(p, "porta");
  const finestre = puntiAperture(p, "finestra");
  const out = [];
  for (const [a, b] of bordi(s)) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 600) continue;
    const w = muroDelLato(p, a, b);
    const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
    // normale verso l'interno della stanza
    let nx = -uy, ny = ux;
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (!dentroPoligono([mid[0] + nx * 100, mid[1] + ny * 100], s.interno)) { nx = -nx; ny = -ny; }
    const orient = w ? (orientamentoDaGeometria(p, w, { interni: interni.map((x) => x.interno) }) ?? null) : null;
    const esterna = w ? !!latoEsterno(w, interni.map((x) => x.interno)) : false;
    const conFinestra = w ? finestre.some((f) => f.wall === w.id) : false;
    const conPorta = w ? porte.some((f) => f.wall === w.id) : false;
    out.push({ a, b, L, ux, uy, nx, ny, mid, orient, esterna, conFinestra, conPorta, muro: w?.id ?? null });
  }
  return { lati: out, porte: porte.map((x) => x.p), finestre: finestre.map((x) => x.p) };
}

function ingombro(tipo, x, y, rot) {
  const d = LIBRERIA_3D[tipo];
  const scambia = rot === 90 || rot === 270;
  const L = scambia ? d.D : d.L, D = scambia ? d.L : d.D;
  return { x0: x - L / 2, x1: x + L / 2, y0: y - D / 2, y1: y + D / 2, L, D };
}

function angoliDentro(g, s) {
  return [[g.x0, g.y0], [g.x1, g.y0], [g.x1, g.y1], [g.x0, g.y1]].every(([x, y]) => dentroPoligono([x, y], s.interno));
}

function vicinoPorte(punti, g, raggio) {
  return punti.some(([x, y]) => x > g.x0 - raggio && x < g.x1 + raggio && y > g.y0 - raggio && y < g.y1 + raggio);
}

// Punteggio di un candidato: preferenze di orientamento e parete; penalita' per finestre e porte
function punteggio(regola, lato, ctx) {
  let s = 0;
  if (regola.parete === "finestra") s += lato.conFinestra ? -60 : 80;
  if (regola.parete === "umida") s += lato.esterna ? 15 : -25; // i bagni: parete interna, condotti vicini
  if (regola.parete === "libera" && lato.esterna && regola.evita?.includes("finestra") && lato.conFinestra) s -= 40;
  if (regola.evita?.includes("finestra") && lato.conFinestra) s -= 50;
  if (regola.preferenze && lato.orient) {
    const i = regola.preferenze.indexOf(lato.orient);
    s += i >= 0 ? (regola.preferenze.length - i) * 20 : -10;
  }
  if (ctx?.paretePosta && lato.orient === ctx.paretePosta) s += 30;
  return s;
}

// Cerca il posto migliore per un pezzo nella stanza, con la regola del suo tipo
function posto(p, s, interni, tipo, placed, ancora = null) {
  const regola = REGOLE_ARREDO[tipo] ?? {};
  const { lati, porte, finestre } = paretiDellaStanza(p, s, interni);
  const d = LIBRERIA_3D[tipo];
  let migliore = null;
  const prova = (x, y, rot, score) => {
    const g = ingombro(tipo, x, y, rot);
    if (!angoliDentro(g, s)) return;
    if (vicinoPorte(porte, g, MARGINE_PORTA)) return;
    if (regola.evita?.includes("finestra") && vicinoPorte(finestre, g, DISTANZA_FINESTRA)) return;
    const cand = { id: "_prova", tipo, x: Math.round(x), y: Math.round(y), rot, finitura: null };
    if (collisioniArredo(cand, { ...p, furniture: placed }).length) return;
    if (migliore === null || score > migliore.score) migliore = { ...cand, score };
  };

  if (regola.vicinoA || regola.davanti) {
    // accanto (o davanti) a un pezzo gia' posato: si cercano posti in una fascia intorno all'ancora
    if (!ancora) return null;
    const ga = ancora;
    for (let y = ga.y0 - 1200; y <= ga.y1 + 1200; y += 150) {
      for (let x = ga.x0 - 1200; x <= ga.x1 + 1200; x += 150) {
        for (const rot of [0, 90]) prova(x, y, rot, -Math.hypot(x - (ga.x0 + ga.x1) / 2, y - (ga.y0 + ga.y1) / 2) / 100);
      }
    }
    return migliore;
  }

  if (regola.centro) {
    const b = { x0: Math.min(...s.interno.map((q) => q[0])), x1: Math.max(...s.interno.map((q) => q[0])), y0: Math.min(...s.interno.map((q) => q[1])), y1: Math.max(...s.interno.map((q) => q[1])) };
    for (let y = b.y0; y <= b.y1; y += 150) for (let x = b.x0; x <= b.x1; x += 150) for (const rot of [0, 90]) prova(x, y, rot, -Math.hypot(x - (b.x0 + b.x1) / 2, y - (b.y0 + b.y1) / 2) / 100);
    return migliore;
  }

  // Pezzi a muro: la schiena contro un lato della stanza, centrato sul lato
  for (const lato of lati) {
    if (lato.L < d.L + 100 && lato.L < d.D + 100) continue;
    const orizz = Math.abs(lato.uy) < 0.5;
    const rot = orizz ? 0 : 90;
    const dimDent = orizz ? d.D : d.L; // profondita' del pezzo (perpendicolare al muro)
    const sc = punteggio(regola, lato, null);
    for (const f of [0.5, 0.35, 0.65]) {
      const cx = lato.a[0] + (lato.b[0] - lato.a[0]) * f;
      const cy = lato.a[1] + (lato.b[1] - lato.a[1]) * f;
      const off = dimDent / 2 + 30;
      prova(cx + lato.nx * off, cy + lato.ny * off, rot, sc - Math.abs(f - 0.5) * 10);
    }
  }
  return migliore;
}

// Arreda le stanze indicate (o tutte): per ogni stanza, i pezzi della sua funzione

export function arredaTutto(p, { stanzeScelte = null } = {}) {
  let q = p;
  const aggiunti = [];
  const fuori = [];
  const interni = stanze(q.walls);
  const scelte = stanzeScelte ?? interni.map((s) => s.interno);
  for (const s of interni) {
    if (!scelte.some((pl) => JSON.stringify(pl.map(([x, y]) => [Math.round(x), Math.round(y)])) === JSON.stringify(s.interno.map(([x, y]) => [Math.round(x), Math.round(y)])))) continue;
    const { funzione } = funzioneStanza(q, s);
    const m2 = s.superficieMm2 / 1e6;
    const lista = ARREDO_PER_FUNZIONE_ELENCO[funzione]?.(m2) ?? [];
    const placed = [...q.furniture];
    const posati = [];
    for (const tipo of lista) {
      const ancoraPezzo = REGOLE_ARREDO[tipo]?.vicinoA ?? REGOLE_ARREDO[tipo]?.davanti;
      const ancora = ancoraPezzo ? posati.find((a) => a.tipo === ancoraPezzo) : null;
      if (ancoraPezzo && !ancora) { fuori.push(`${tipo} senza ${ancoraPezzo} in ${s.id}`); continue; }
      const ancoraG = ancora ? ingombro(ancora.tipo, ancora.x, ancora.y, ancora.rot) : null;
      const pos = posto(q, s, interni, tipo, [...placed, ...posati], ancoraG);
      if (!pos) { fuori.push(`${LIBRERIA_3D[tipo]?.nome ?? tipo} non entra in ${s.id} (${funzione})`); continue; }
      const r = aggiungiArredo(q, tipo, pos.x, pos.y, pos.rot);
      if (r.errore) continue;
      q = r.p;
      const nuovo = r.p.furniture[r.p.furniture.length - 1];
      posati.push(nuovo);
      placed.push(nuovo);
      aggiunti.push(`${LIBRERIA_3D[tipo]?.nome ?? tipo} in ${s.id} (${funzione}, parete ${pos.score > 0 ? "preferita" : "ripiego"})`);
    }
  }
  fuori.unshift(`${aggiunti.length} arredi non presenti in planimetria: posati per funzione e orientamento (stima, verifica la funzione di ogni stanza)`);
  return { p: q, aggiunti, fuoriPlanimetria: fuori };
}
