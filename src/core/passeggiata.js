// Passeggiata in prima persona: movimento con collisioni contro i muri e porte che si aprono da sole.
// Funzioni pure in mm del piano (x, y): nessuna dipendenza da Three.js, testabili in Node.
//
// Senso di apertura di una porta (campo opzionale `apertura` del vano, dalla planimetria):
//   cardine: "a" = la porta ruota attorno all'inizio del vano (lato a); "b" = attorno alla fine (lato b)
//   lato:    "+" = l'anta si apre verso la normale +n del muro; "-" verso -n
// Se manca, la porta usa cardine "a" e lato "+" e la differenza viene segnalata nel report del modello.

import { ingombroArredo } from "./project.js?v=v20261020br";

export const ALTEZZA_OCCHI_MM = 1600;
export const RAGGIO_CORPO_MM = 250;
export const VELOCITA_MM_S = 1800;
export const VELOCITA_CORSA_MM_S = 3000;
export const APERTURA_MAX_RAD = (95 * Math.PI) / 180;
export const VELOCITA_APERTURA_RAD_S = (150 * Math.PI) / 180;
const APRI_DENTRO_MM = 2000; // la porta comincia ad aprirsi quando ci si avvicina entro questa distanza dal centro del vano
const CHIUDI_OLTRE_MM = 2600; // e si richiude quando ci si allontana oltre questa distanza
const RITARDO_CHIUSURA_S = 1.5;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const len = (a) => Math.hypot(a[0], a[1]);

// Versori del muro: lungo il muro (u) e normale (n = -uy, ux, come in build.js)
export function assiMuro(w) {
  const d = sub(w.b, w.a);
  const L = len(d);
  const u = [d[0] / L, d[1] / L];
  return { u, n: [-u[1], u[0]], L };
}

// Distanza punto-segmento (mm)
export function distanzaPuntoSegmento(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  const t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)) : 0;
  const q = add(a, mul(ab, t));
  return len(sub(p, q));
}

// Centro della porta in mm, cardine e lato con i valori di default segnalati
export function geometriaPorta(op, w) {
  const { u, n, L } = assiMuro(w);
  const ap = op.apertura ?? {};
  const cardine = ap.cardine === "b" ? "b" : "a";
  const lato = ap.lato === "-" ? "-" : "+";
  const s0 = op.offset;
  const s1 = op.offset + op.width;
  // il perno sta sul bordo interno del telaio (op.telaio_mm), come nel 3D: l'anta non si stacca dal telaio
  const tel = op.telaio_mm ?? 0;
  const cerniera = add(w.a, mul(u, cardine === "a" ? s0 + tel : s1 - tel));
  const centro = add(w.a, mul(u, s0 + op.width / 2));
  return { id: op.id, wall: w.id, u, n, L, s0, s1, cardine, lato, cerniera, centro, larghezza: op.width - 2 * tel, datiMancanti: !op.apertura };
}

// Direzione dell'anta chiusa/aperta di angolo theta (rad): ruota dal muro verso il lato di apertura
export function direzioneAnta(g, theta) {
  const primo = g.cardine === "a" ? g.u : mul(g.u, -1);
  const verso = g.lato === "+" ? g.n : mul(g.n, -1);
  return add(mul(primo, Math.cos(theta)), mul(verso, Math.sin(theta)));
}

// Ostacoli in pianta: muri (saltando i vani-porta) + anta (chiusa nel vano, aperta altrimenti)
// stato: { [idPorta]: angolo in rad }
export function ostacoli(progetto, stato = {}) {
  const out = [];
  for (const w of progetto.walls) {
    const porte = progetto.openings.filter((o) => o.wall === w.id && o.type === "porta").sort((p, q) => p.offset - q.offset);
    const { u, L } = assiMuro(w);
    let cursore = 0;
    for (const o of porte) {
      if (o.offset > cursore) out.push({ tipo: "muro", id: w.id, a: w.a, b: add(w.a, mul(u, o.offset)), r: w.t / 2 });
      cursore = o.offset + o.width;
    }
    if (cursore < L) out.push({ tipo: "muro", id: w.id, a: add(w.a, mul(u, cursore)), b: w.b, r: w.t / 2 });
  }
  for (const o of progetto.openings) {
    // senzaAnta: vano aperto senza infisso, passaggio libero. Le porte fisse (fisso) restano chiuse e bloccano.
    if (o.type === "porta" && !o.senzaAnta) {
      const w = progetto.walls.find((x) => x.id === o.wall);
      if (!w) continue;
      const g = geometriaPorta(o, w);
      const theta = stato[o.id] ?? 0;
      const estremo = add(g.cerniera, mul(direzioneAnta(g, theta), g.larghezza));
      out.push({ tipo: "anta", id: o.id, a: g.cerniera, b: estremo, r: 20 });
    } else if (o.type === "finestra" || o.type === "scorrevole") {
      // le finestre sono vetri nel muro: il muro intero resta un ostacolo
    }
  }
  // Arredi: il perimetro dell'ingombro in pianta blocca il corpo
  for (const a of progetto.furniture ?? []) {
    const r = ingombroArredo(a);
    const pts = r.angoli ?? [[r.x0, r.y0], [r.x0 + r.L, r.y0], [r.x0 + r.L, r.y0 + r.D], [r.x0, r.y0 + r.D]];
    for (let i = 0; i < pts.length; i++) out.push({ tipo: "arredo", id: a.id, a: pts[i], b: pts[(i + 1) % pts.length], r: 0 });
  }
  return out;
}

// Sposta la posizione fuori dagli ostacoli (scorrimento su ogni asse separato).
// Il movimento e' spezzato in passi piccoli (un quarto del raggio) per non attraversare un muro in un solo salto.
export function muoviConCollisioni(p, delta, obst, raggio = RAGGIO_CORPO_MM) {
  const libero = (pos) => obst.every((o) => distanzaPuntoSegmento(pos, o.a, o.b) >= raggio + o.r);
  const n = Math.max(1, Math.ceil(len(delta) / (raggio / 4)));
  const d = mul(delta, 1 / n);
  let pos = p;
  for (let i = 0; i < n; i++) {
    const x = add(pos, [d[0], 0]);
    if (libero(x)) pos = x;
    const y = add(pos, [0, d[1]]);
    if (libero(y)) pos = y;
  }
  return pos;
}

// Passo di simulazione: input {avanti, indietro, sinistra, destra, corsa}, yaw in rad (0 = verso +y del piano)
export function passo(stato, input, dt, obst) {
  const velocita = (input.corsa ? VELOCITA_CORSA_MM_S : VELOCITA_MM_S) * dt;
  const f = [Math.sin(stato.yaw), Math.cos(stato.yaw)];
  const d = [-f[1], f[0]]; // destra
  let spostamento = [0, 0];
  if (input.avanti) spostamento = add(spostamento, mul(f, velocita));
  if (input.indietro) spostamento = add(spostamento, mul(f, -velocita));
  if (input.destra) spostamento = add(spostamento, mul(d, velocita));
  if (input.sinistra) spostamento = add(spostamento, mul(d, -velocita));
  const pos = muoviConCollisioni(stato.pos, spostamento, obst);
  return { ...stato, pos };
}

// Porte automatiche: si aprono avvicinandosi, si richiudono allontanandosi. Restituisce i nuovi angoli.
// porte: [geometriaPorta(...)], angoli: { [id]: rad }, timer: { [id]: s di attesa prima di chiudere }
export function aggiornaPorte(porte, pos, angoli, timer, dt) {
  const nuovi = { ...angoli };
  const nuoviTimer = { ...timer };
  for (const g of porte) {
    const dx = pos[0] - g.centro[0], dy = pos[1] - g.centro[1];
    const distanza = len([dx, dy]);
    const vicino = distanza <= APRI_DENTRO_MM;
    const lontano = distanza > CHIUDI_OLTRE_MM;
    let target = nuovi[g.id] ?? 0;
    if (vicino) { target = APERTURA_MAX_RAD; nuoviTimer[g.id] = RITARDO_CHIUSURA_S; }
    else if (lontano || (nuoviTimer[g.id] ?? 0) > 0) {
      nuoviTimer[g.id] = Math.max(0, (nuoviTimer[g.id] ?? 0) - dt);
      if (lontano && nuoviTimer[g.id] <= 0) target = 0;
    }
    const passoAng = VELOCITA_APERTURA_RAD_S * dt;
    const diff = target - (nuovi[g.id] ?? 0);
    nuovi[g.id] = (nuovi[g.id] ?? 0) + Math.sign(diff) * Math.min(Math.abs(diff), passoAng);
  }
  return { angoli: nuovi, timer: nuoviTimer };
}

// Dati delle porte del progetto, per la vista e per il report
export function porteDelProgetto(progetto) {
  const out = [];
  for (const o of progetto.openings) {
    if (o.type !== "porta" || o.senzaAnta || o.fisso) continue;
    const w = progetto.walls.find((x) => x.id === o.wall);
    if (w) out.push({ ...geometriaPorta(o, w), op: o });
  }
  return out;
}

// Distanza libera (mm) lungo una direzione dalla posizione, fino al primo ostacolo o al limite
function distanzaLibera(pos, dir, obst, limite = 8000, passo_ = 50) {
  for (let d = passo_; d <= limite; d += passo_) {
    const p = add(pos, mul(dir, d));
    if (obst.some((o) => distanzaPuntoSegmento(p, o.a, o.b) < o.r + 30)) return d - passo_;
  }
  return limite;
}

// Sguardo di partenza: la direzione piu' vicina al centro dell'edificio che abbia almeno 1 m libero davanti;
// se nessuna la ha, quella con piu' spazio libero. Cosi' non si parte di fronte a un muro.
function sguardoLibero(pos, obst, centro) {
  const verso = sub(centro, pos);
  const base = len(verso) > 1 ? Math.atan2(verso[0], verso[1]) : 0;
  // scostamenti dal centro, dal piu' vicino: 0, +-22,5, +-45, ... fino a 180 gradi
  const scostamenti = Array.from({ length: 17 }, (_, k) => (k * Math.PI) / 8).sort((a, b) => a - b);
  const candidati = [];
  for (const s of scostamenti) { candidati.push(base + s); if (s) candidati.push(base - s); }
  candidati.sort((a, b) => Math.abs(Math.atan2(Math.sin(a - base), Math.cos(a - base))) - Math.abs(Math.atan2(Math.sin(b - base), Math.cos(b - base))));
  for (const yaw of candidati) {
    if (distanzaLibera(pos, [Math.sin(yaw), Math.cos(yaw)], obst) >= 1000) return yaw;
  }
  let migliore = base;
  let migliore_d = -1;
  for (const yaw of candidati) {
    const d = distanzaLibera(pos, [Math.sin(yaw), Math.cos(yaw)], obst);
    if (d > migliore_d) { migliore_d = d; migliore = yaw; }
  }
  return migliore;
}

// Punto di partenza: davanti al vano piu' vicino al centro dell'edificio, dal lato dell'edificio (o l'origine se non ci sono muri).
// Mai sul vano: l'anta chiusa occupa la luce e il corpo partirebbe dentro la porta.
export function posizioneIniziale(progetto) {
  if (!progetto.walls.length) return { pos: [0, 0], yaw: 0 };
  const xs = progetto.walls.flatMap((w) => [w.a[0], w.b[0]]);
  const ys = progetto.walls.flatMap((w) => [w.a[1], w.b[1]]);
  const c = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const porte = porteDelProgetto(progetto);
  const obst = ostacoli(progetto, {});
  // Il punto di partenza non deve stare dentro un muro (o a meno del raggio del corpo da esso)
  const libero = (p) => obst.every((o) => distanzaPuntoSegmento(p, o.a, o.b) >= RAGGIO_CORPO_MM + o.r);
  if (!porte.length) return { pos: c, yaw: 0 };
  // Vani in ordine di vicinanza al centro; per ciascuno si prova il lato interno, poi l'esterno, a distanze crescenti
  // Si esce dalla porta d'ingresso (blindata), come da un ascensore sul pianerottolo: poi il vano piu' vicino al centro
  const ingresso = (g) => /blindat|ingresso/i.test(g.op?.id ?? "");
  const ordinate = [...porte].sort((p, q) => (ingresso(q) ? 1 : 0) - (ingresso(p) ? 1 : 0) || len(sub(p.centro, c)) - len(sub(q.centro, c)));
  for (const g of ordinate) {
    const lato0 = dot(sub(c, g.centro), g.n) >= 0 ? 1 : -1;
    for (const lato of [lato0, -lato0]) {
      for (const d of [800, 1000, 1300, 1600]) {
        const pos = add(g.centro, mul(g.n, lato * d));
        if (!libero(pos)) continue;
        return { pos, yaw: sguardoLibero(pos, obst, c) };
      }
    }
  }
  return { pos: c, yaw: 0 };
}

// Vettore di sguardo unitario [x, y, z] del piano (x, y in mm e z in altezza): yaw sul piano, pitch verso l'alto
export function vettoreSguardo(yaw, pitch) {
  const c = Math.cos(pitch);
  return [Math.sin(yaw) * c, Math.cos(yaw) * c, Math.sin(pitch)];
}

// Stato iniziale della passeggiata: posizione e sguardo di partenza, porte chiuse
export function statoPasseggiata(progetto) {
  const { pos, yaw } = posizioneIniziale(progetto);
  return { pos, yaw, pitch: 0, angoli: {}, timer: {} };
}

// Un passo completo: movimento con collisioni contro muri e ante, poi porte automatiche.
// input: {avanti, indietro, sinistra, destra, corsa}; l'anta usata per le collisioni e' quella del passo precedente.
export function aggiornaPasseggiata(stato, input, dt, progetto) {
  const obst = ostacoli(progetto, stato.angoli);
  const mosso = passo(stato, input, dt, obst);
  const porte = porteDelProgetto(progetto);
  const r = aggiornaPorte(porte, mosso.pos, stato.angoli, stato.timer, dt);
  // Un'anta che si apre non puo' investire chi sta passando: se l'anta nuova toccherebbe il corpo, resta com'era
  const angoli = { ...r.angoli };
  for (const g of porte) {
    const nuovo = angoli[g.id] ?? 0;
    const prima = stato.angoli[g.id] ?? 0;
    if (nuovo === prima) continue;
    const fine = add(g.cerniera, mul(direzioneAnta(g, nuovo), g.larghezza));
    if (distanzaPuntoSegmento(mosso.pos, g.cerniera, fine) < RAGGIO_CORPO_MM + 20) angoli[g.id] = prima;
  }
  return { ...mosso, angoli, timer: r.timer };
}
