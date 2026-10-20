// Serramenti CDI in 3D dettagliato: per ogni vano, l'elenco delle PARTI (scatole e cilindri) in coordinate locali
// del muro, in mm. Funzione pura: la vista (src/view/modelli3d.js) trasforma le parti in mesh Three.js.
// Coordinate locali: s = lungo il muro dall'inizio del vano, z = quota da terra, n = normale al muro (0 = asse).
// Ogni parte: { forma: "box", s0, s1, z0, z1, n0, n1, mat, ruolo }  oppure
//             { forma: "cil", s, z0, z1, n, r, mat, ruolo }  (cilindro verticale)  oppure
//             { forma: "cilN", s, z, n0, n1, r, mat, ruolo }  (cilindro lungo la normale: pomoli, rosette)
// mat: chiave del materiale. Per le porte con foto: "foto" (la vista applica la foto del catalogo sulle facce +n e -n).
import { TIPO_PER_CATEGORIA, materialeVano } from "./cdi.js?v=v20261020bv";

const box = (ruolo, mat, s0, s1, z0, z1, n0, n1) => ({ forma: "box", ruolo, mat, s0, s1, z0, z1, n0, n1 });

// Stile di resa: dal catalogo (item.resa3d) o, senza infisso, dal materiale del vano
export function stileVano(op, item) {
  if (item?.resa3d) return { ...item.resa3d, categoria: item.categoria, id: item.id, profondita_qfort_mm: item.profondita_qfort_mm, spessore_pannello_qfort_mm: item.spessore_pannello_qfort_mm };
  const m = materialeVano(op);
  if (op.type === "porta") return m === "vetro_fume"
    ? { pannello: "vetro_fume", scrigno: true, colore: "#2b2d31", maniglia: "incasso", materiale: "vetro", categoria: "porte_interne", generico: true }
    : { pannello: "liscio", colore: "#8b5e3c", maniglia: "minimal", materiale: "legno", categoria: "porte_interne", generico: true };
  return { colore: "#f1efe9", materiale: "pvc", telaio_vista_mm: 60, anta_vista_mm: 55, maniglia: "standard", categoria: op.type === "scorrevole" ? "scorrevoli_panoramici" : "finestre_pvc", generico: true };
}

// Profondita' del telaio di una porta (mm): la stessa usata nel 3D e nella passeggiata (perno dell'anta)
export function telaioPorta(op, item) {
  const st = stileVano(op, item);
  if (st.categoria === "porte_ingresso") return st.profondita_qfort_mm ?? 80;
  return st.pannello === "filomuro" ? 12 : 50;
}

// Tipo di apertura: il tipo del vano (modello) prevale sul catalogo
export function tipoApertura(op, item) {
  if (op.type === "porta") return "porta";
  return item ? TIPO_PER_CATEGORIA[item.categoria] || op.type : op.type;
}

function maniglia(out, tipo, s, z, nFaccia, verso) {
  // verso: +1 maniglia sulla faccia n positiva, -1 sulla negativa
  const n0 = verso > 0 ? nFaccia : nFaccia - 1;
  const fuori = (d) => (verso > 0 ? [nFaccia, nFaccia + d] : [nFaccia - d, nFaccia]);
  if (tipo === "maniglione") {
    const [a, b] = fuori(70);
    out.push({ forma: "cil", ruolo: "maniglia", mat: "inox", s, z0: z - 600, z1: z + 600, n: (a + b) / 2 + verso * 25, r: 16 });
    for (const dz of [-450, 450]) out.push(box("maniglia", "inox", s - 10, s + 10, z + dz - 10, z + dz + 10, ...fuori(55)));
    return;
  }
  if (tipo === "pomolo") {
    out.push({ forma: "cilN", ruolo: "maniglia", mat: "inox", s, z, n0: fuori(60)[0], n1: fuori(60)[1], r: 32 });
    out.push({ forma: "cilN", ruolo: "maniglia", mat: "inox", s, z: z - 120, n0: fuori(14)[0], n1: fuori(14)[1], r: 22 });
    return;
  }
  if (tipo === "incasso") {
    out.push(box("maniglia", "nero", s - 15, s + 15, z - 200, z + 200, ...fuori(4)));
    return;
  }
  if (tipo === "alzante") {
    out.push(box("maniglia", "inox", s - 15, s + 15, z - 30, z + 30, ...fuori(40)));
    out.push(box("maniglia", "inox", s - 12, s + 12, z - 380, z, ...(verso > 0 ? [nFaccia + 40, nFaccia + 62] : [nFaccia - 62, nFaccia - 40])));
    return;
  }
  // minimal / cortizo / standard: rosetta + leva orizzontale verso il centro dell'anta
  const leva = tipo === "standard" ? 130 : 120;
  out.push(box("maniglia", tipo === "standard" ? "bianco_lucido" : "inox", s - 20, s + 20, z - 35, z + 35, ...fuori(12)));
  out.push(box("maniglia", tipo === "standard" ? "bianco_lucido" : "inox", s - leva, s + 10, z - 11, z + 11, ...(verso > 0 ? [nFaccia + 40, nFaccia + 62] : [nFaccia - 62, nFaccia - 40])));
}

function finestra(op, wallT, st, scorrevole, esterno) {
  const out = [];
  const W = op.width, H = op.height, z0 = op.sill, z1 = op.sill + op.height;
  // profondita' del profilo da catalogo QFORT se nota, altrimenti il valore generico
  const prof = Math.min(st.profondita_qfort_mm ?? st.profilo_mm ?? (st.materiale === "pvc" ? 80 : 75), wallT - 20);
  const nA = -Math.floor(prof / 2), nB = Math.ceil(prof / 2);
  const tv = st.telaio_vista_mm ?? 60;
  const av = st.anta_vista_mm ?? 55;
  const telaio = st.materiale === "pvc" ? "pvc" : "alluminio";
  const col = { telaio, colore: st.colore };
  // telaio fisso
  out.push({ ...box("telaio", "telaio", 0, tv, z0, z1, nA, nB), ...col });
  out.push({ ...box("telaio", "telaio", W - tv, W, z0, z1, nA, nB), ...col });
  out.push({ ...box("telaio", "telaio", tv, W - tv, z1 - tv, z1, nA, nB), ...col });
  out.push({ ...box("telaio", "telaio", tv, W - tv, z0, z0 + (scorrevole ? 30 : tv), nA, nB), ...col });
  // davanzale in pietra sul lato esterno (se noto) e controdavanzale interno
  if (op.sill > 0) {
    const lato = esterno || 1;
    const nFuori = lato > 0 ? [Math.ceil(wallT / 2) - 10, Math.ceil(wallT / 2) + 40] : [-Math.ceil(wallT / 2) - 40, -Math.floor(wallT / 2) + 10];
    out.push(box("davanzale", "pietra", -40, W + 40, z0 - 30, z0, ...nFuori));
    const nDentro = lato > 0 ? [-Math.floor(wallT / 2) - 25, nA] : [nB, Math.ceil(wallT / 2) + 25];
    out.push(box("davanzale", "pietra", -20, W + 20, z0 - 20, z0, ...nDentro));
  }
  const zi0 = z0 + (scorrevole ? 30 : tv), zi1 = z1 - tv, si0 = tv, si1 = W - tv;
  if (scorrevole) {
    // binari, due (o piu') ante scorrevoli su piani diversi, montante di sovrapposizione
    out.push(box("binario", "nero", si0, si1, z0, z0 + 30, nA, nB));
    const n = st.libro ? Math.max(3, Math.round((si1 - si0) / 800)) : 2;
    const larg = (si1 - si0) / n;
    for (let i = 0; i < n; i++) {
      const a = si0 + i * larg - (st.libro ? 0 : i === 1 ? 40 : 0);
      const b = si0 + (i + 1) * larg + (st.libro ? 0 : i === 0 ? 40 : 0);
      const piano = st.libro ? [-15, 15] : i === 0 ? [nA + 6, -2] : [2, nB - 6];
      out.push(...anta(op.id, a, b, zi0, zi1, piano, av, col, `anta${i}`, st));
      if (!st.libro && i === 1) maniglia(out, st.maniglia === "alzante" ? "alzante" : "incasso", b - av - 40, Math.min(z0 + 1050, z1 - 300), piano[1], 1);
    }
    if (st.libro) for (let i = 1; i < n; i++) out.push({ forma: "cil", ruolo: "cerniera", mat: "inox", s: si0 + i * larg, z0: zi0 + 150, z1: zi0 + 250, n: 0, r: 8 });
    return out;
  }
  // battente: una o due ante (nodo centrale)
  const due = W > 1000;
  const nAnta = [nA + 8, nB - 4];
  const meta = due ? Math.round((si0 + si1) / 2) : si1;
  out.push(...anta(op.id, si0, meta, zi0, zi1, nAnta, av, col, "anta_sx", st));
  if (due) {
    out.push(...anta(op.id, meta, si1, zi0, zi1, nAnta, av, col, "anta_dx", st));
    maniglia(out, st.maniglia, meta + av / 2 + 25, Math.min(zi1 - 200, z0 + 1050), nAnta[0], -1);
  } else {
    maniglia(out, st.maniglia, si1 - av / 2, Math.min(zi1 - 200, zi0 + (zi1 - zi0) / 2), nAnta[0], -1);
  }
  // cerniere visibili (non per le ante a scomparsa)
  if ((st.anta_vista_mm ?? 1) > 0) {
    for (const zz of [zi0 + 120, zi1 - 160]) {
      out.push({ forma: "cil", ruolo: "cerniera", mat: "inox", s: si0 + 4, z0: zz, z1: zz + 70, n: nAnta[0] - 6, r: 7 });
      if (due) out.push({ forma: "cil", ruolo: "cerniera", mat: "inox", s: si1 - 4, z0: zz, z1: zz + 70, n: nAnta[0] - 6, r: 7 });
    }
  }
  return out;
}

// Anta: profili perimetrali + vetro (+ veneziane interne al vetro se richieste)
function anta(id, s0, s1, z0, z1, piano, av, col, nome, st) {
  const out = [];
  const [n0, n1] = piano;
  const v = Math.max(av, 18);
  if (av > 0) {
    out.push({ ...box(nome, "telaio", s0, s0 + v, z0, z1, n0, n1), ...col });
    out.push({ ...box(nome, "telaio", s1 - v, s1, z0, z1, n0, n1), ...col });
    out.push({ ...box(nome, "telaio", s0 + v, s1 - v, z1 - v, z1, n0, n1), ...col });
    out.push({ ...box(nome, "telaio", s0 + v, s1 - v, z0, z0 + v, n0, n1), ...col });
  }
  const g0 = av > 0 ? v : 6;
  const nm = (n0 + n1) / 2;
  out.push(box("vetro", "vetro", s0 + g0, s1 - g0, z0 + g0, z1 - g0, nm - 12, nm + 12));
  if (st?.veneziane) {
    for (let z = z0 + g0 + 40; z < z1 - g0 - 20; z += 60) out.push(box("veneziana", "veneziana", s0 + g0 + 5, s1 - g0 - 5, z, z + 6, nm - 8, nm + 8));
  }
  return out;
}

function porta(op, wallT, st, esterno) {
  const out = [];
  const W = op.width, z0 = op.sill, z1 = op.sill + op.height;
  const nLo = -Math.floor(wallT / 2), nHi = Math.ceil(wallT / 2);
  const ingresso = st.categoria === "porte_ingresso";
  // spessore pannello da catalogo CDI (porte d'ingresso alluminio e PVC: 44 mm). Il profilo del telaio (p) e' 75-85 mm
  // spessore pannello da catalogo (44 mm per le porte d'ingresso QFORT) e profondita' del telaio QFORT se nota
  // porte d'ingresso: anta spessa quanto il profilo QFORT (75-85 mm); interne: 44 mm
  const sp = Math.min(ingresso ? (st.profondita_qfort_mm ?? 80) : 44, wallT - 20);
  const aA = -Math.floor(sp / 2), aB = Math.ceil(sp / 2);
  const p = ingresso ? (st.profondita_qfort_mm ?? 80) : st.pannello === "filomuro" ? 12 : 50;
  const matTelaio = ingresso ? "telaio_porta" : st.pannello === "rovere" ? "rovere" : "laccato";
  const col = { colore: ingresso ? "#2f3237" : st.colore };
  if (st.scrigno) {
    // porta scrigno: anta che scorre nel muro (qui chiusa), binario in alto, profili sottili, maniglia a incasso
    out.push(box("telaio", "nero", 0, 25, z0, z1, nLo, nHi));
    out.push(box("telaio", "nero", W - 25, W, z0, z1, nLo, nHi));
    out.push(box("binario", "nero", 0, W, z1 - 40, z1, nLo, nHi));
    out.push({ ...box("anta", st.pannello === "vetro_fume" ? "vetro_fume" : "vetro_satinato", 25, W - 25, z0 + 8, z1 - 40, -10, 10) });
    maniglia(out, "incasso", W - 80, z0 + 1050, 10, 1);
    maniglia(out, "incasso", W - 80, z0 + 1050, -10, -1);
    return out;
  }
  // telaio e coprifili su entrambe le facce (non per la porta filo muro)
  out.push({ ...box("telaio", matTelaio, 0, p, z0, z1, nLo, nHi), ...col });
  out.push({ ...box("telaio", matTelaio, W - p, W, z0, z1, nLo, nHi), ...col });
  out.push({ ...box("telaio", matTelaio, 0, W, z1 - p, z1, nLo, nHi), ...col });
  if (st.pannello !== "filomuro") {
    for (const lato of [-1, 1]) {
      const n = lato > 0 ? [nHi, nHi + 12] : [nLo - 12, nLo];
      out.push({ ...box("coprifilo", matTelaio, -70, 0, z0, z1 + 70, ...n), ...col });
      out.push({ ...box("coprifilo", matTelaio, W, W + 70, z0, z1 + 70, ...n), ...col });
      out.push({ ...box("coprifilo", matTelaio, 0, W, z1, z1 + 70, ...n), ...col });
    }
  }
  // anta: foto del catalogo sulle due facce (porte d'ingresso), altrimenti pannello procedurale
  const ant = box("anta", st.texture ? "foto" : st.pannello === "rovere" ? "rovere" : st.pannello === "vetro_satinato" ? "vetro_satinato" : "laccato", p, W - p, z0 + 6, z1 - p, aA, aB);
  // porta con foto: la foto ha gia' la maniglia; si specchia se il cardine e' dal lato "a" (la maniglia va dall'altro lato)
  // la foto va sulla faccia esterna: se l'esterno e' dal lato n negativo, le due facce si scambiano
  if (st.texture) { ant.texture = st.texture; ant.specchio = op.apertura?.specchio ?? ((op.apertura?.cardine ?? "a") === "a"); ant.facciaEsternaNeg = esterno < 0; }
  out.push({ ...ant, colore: st.colore });
  // fresature della porta grafite / filo muro
  if (st.pannello === "grafite" || st.pannello === "filomuro") {
    for (const zz of [z0 + 700, z0 + 1400]) {
      out.push(box("fresatura", "nero", p + 60, W - p - 60, zz, zz + 6, aB - 1, aB + 1));
      out.push(box("fresatura", "nero", p + 60, W - p - 60, zz, zz + 6, aA - 1, aA + 1));
    }
  }
  // cerniere sul lato opposto alla maniglia
  // cardine "b": cerniere e maniglia si specchiano (la maniglia resta dal lato opposto alle cerniere)
  const cardineB = (op.apertura?.cardine ?? "a") === "b";
  const sx = (v) => (cardineB ? W - v : v);
  // maniglia specchiata a parte (senza spostare le cerniere)
  const sxMan = (v) => (cardineB !== !!op.apertura?.maniglia_specchiata ? W - v : v);
  for (const zz of [z0 + 250, z0 + 1050, z1 - p - 300]) out.push({ forma: "cil", ruolo: "cerniera", mat: "inox", s: sx(p), z0: zz, z1: zz + 110, n: 0, r: ingresso ? 11 : 8 });
  // maniglie: esterno con maniglione/pomolo per le porte d'ingresso, leva all'interno
  const sMan = sxMan(W - p - (st.maniglia === "maniglione" ? 110 : 80));
  const ext = esterno || 1;
  if (st.texture) {
    // porta con foto: maniglie e cilindro gia' nel rendering, nessuna maniglia procedurale sopra
  } else if (ingresso) {
    maniglia(out, st.maniglia, sMan, z0 + 1050, ext > 0 ? aB : aA, ext);
    maniglia(out, "minimal", sxMan(W - p - 80), z0 + 1050, ext > 0 ? aA : aB, -ext);
    out.push({ forma: "cilN", ruolo: "cilindro_serratura", mat: "inox", s: sxMan(W - p - 80), z: z0 + 930, n0: aA - 6, n1: aB + 6, r: 14 });
  } else {
    maniglia(out, st.maniglia === "incasso" ? "incasso" : "minimal", sMan, z0 + 1050, aB, 1);
    maniglia(out, st.maniglia === "incasso" ? "incasso" : "minimal", sMan, z0 + 1050, aA, -1);
  }
  // soglia
  out.push(box("soglia", ingresso ? "inox" : "pietra", 0, W, z0, z0 + 6, nLo, nHi));
  return out;
}

// esterno: +1 se l'esterno dell'edificio e' dal lato n positivo, -1 se negativo, 0 se non noto
export function partiInfisso(op, wallT, item, { esterno = 0 } = {}) {
  const st = stileVano(op, item);
  const tipo = tipoApertura(op, item);
  if (tipo === "porta") return porta(op, wallT, st, esterno);
  return finestra(op, wallT, st, tipo === "scorrevole", esterno);
}

// Ingombro delle parti (per i test): restituisce gli estremi in s, z, n
export function ingombroParti(parti) {
  const e = { s0: Infinity, s1: -Infinity, z0: Infinity, z1: -Infinity, n0: Infinity, n1: -Infinity };
  for (const p of parti) {
    if (p.forma === "box") {
      e.s0 = Math.min(e.s0, p.s0); e.s1 = Math.max(e.s1, p.s1);
      e.z0 = Math.min(e.z0, p.z0); e.z1 = Math.max(e.z1, p.z1);
      e.n0 = Math.min(e.n0, p.n0); e.n1 = Math.max(e.n1, p.n1);
    } else if (p.forma === "cil") {
      e.s0 = Math.min(e.s0, p.s - p.r); e.s1 = Math.max(e.s1, p.s + p.r);
      e.z0 = Math.min(e.z0, p.z0); e.z1 = Math.max(e.z1, p.z1);
      e.n0 = Math.min(e.n0, p.n - p.r); e.n1 = Math.max(e.n1, p.n + p.r);
    } else {
      e.s0 = Math.min(e.s0, p.s - p.r); e.s1 = Math.max(e.s1, p.s + p.r);
      e.z0 = Math.min(e.z0, p.z - p.r); e.z1 = Math.max(e.z1, p.z + p.r);
      e.n0 = Math.min(e.n0, p.n0); e.n1 = Math.max(e.n1, p.n1);
    }
  }
  return e;
}
