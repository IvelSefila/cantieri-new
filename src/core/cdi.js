// Infissi procedurali: ogni vano diventa un insieme di scatole in coordinate locali del muro.
// Coordinate locali (mm):  s = lungo il muro (da a verso b),  z = quota da terra,
//                          n = normale al muro (centrata sull'asse del muro).
// Tutti i valori sono interi: le mezzelunghezze sono arrotondate per difetto/eccesso in modo esplicito.

export const PROFILO_FINESTRA_MM = 60;   // telaio perimetrale
export const PROFILO_PORTA_MM = 70;      // telaio porta
export const VETRO_MM = 24;              // vetrocamera
export const ANTA_PORTA_MM = 45;         // spessore anta
export const MANIGLIA_SBALZO_MM = 30;    // sporgenza maniglia dall'anta

// Catalogo: categoria -> tipo di vano
export const TIPO_PER_CATEGORIA = {
  finestre_alluminio: "finestra",
  finestre_pvc: "finestra",
  scorrevoli_panoramici: "scorrevole",
  porte_ingresso: "porta",
  porte_interne: "porta",
};

function meta(kind, id, b) {
  return { kind, id, ...b };
}

// Scatole locali di un vano. nLo/nHi = mezzo spessore del muro (interi).
// REGOLA DI PROGETTO (permanente): il materiale di un vano e' quello dichiarato nel modello.
// Se non e' dichiarato: le porte sono in legno, le finestre e le vetrate in vetro.
// Il vetro non si assegna mai a una porta da solo.
export const MATERIALI_VANO = ["legno", "vetro"];
export function materialeVano(op) {
  if (op.materiale) return op.materiale;
  return op.type === "porta" ? "legno" : "vetro";
}

export const PROFILO_PORTA_LEGNO_MM = 40; // telaio sottile
export const ANTA_LEGNO_MM = 40;
export const MANIGLIA_VERTICALE_MM = 25;

export function openingLocalBoxes(op, wallT, item) {
  const W = op.width;
  const H = op.height;
  const z0 = op.sill;
  const z1 = op.sill + op.height;
  const nLo = -Math.floor(wallT / 2);
  const nHi = Math.ceil(wallT / 2);
  // il tipo del vano (dal modello) prevale sul catalogo: una porta resta una porta
  const tipo = op.type === "porta" ? "porta" : item ? TIPO_PER_CATEGORIA[item.categoria] || op.type : op.type;
  const out = [];

  if (tipo === "porta" && materialeVano(op) === "legno") {
    // porta in legno: telaio sottile, anta piena, maniglia verticale
    const p = PROFILO_PORTA_LEGNO_MM;
    const a = ANTA_LEGNO_MM;
    const aLo = -Math.floor(a / 2);
    const aHi = Math.ceil(a / 2);
    out.push(meta("telaio_legno", `${op.id}:telaio_sx`, { s0: 0, s1: p, z0, z1, n0: nLo, n1: nHi }));
    out.push(meta("telaio_legno", `${op.id}:telaio_dx`, { s0: W - p, s1: W, z0, z1, n0: nLo, n1: nHi }));
    out.push(meta("telaio_legno", `${op.id}:telaio_sup`, { s0: 0, s1: W, z0: z1 - p, z1, n0: nLo, n1: nHi }));
    out.push(meta("anta_legno", `${op.id}:anta`, { s0: p, s1: W - p, z0, z1: z1 - p, n0: aLo, n1: aHi }));
    // maniglia verticale sul lato del battente, a meta' altezza di presa
    out.push(meta("maniglia", `${op.id}:maniglia`, { s0: W - p - 90, s1: W - p - 70, z0: z0 + 900, z1: z0 + 1800, n0: aHi, n1: aHi + MANIGLIA_VERTICALE_MM }));
    return out;
  }

  if (tipo === "porta") {
    const p = PROFILO_PORTA_MM;
    const anta = Math.min(ANTA_PORTA_MM, wallT);
    const aLo = -Math.floor(anta / 2);
    const aHi = Math.ceil(anta / 2);
    out.push(meta("telaio", `${op.id}:stipite_sx`, { s0: 0, s1: p, z0, z1, n0: nLo, n1: nHi }));
    out.push(meta("telaio", `${op.id}:stipite_dx`, { s0: W - p, s1: W, z0, z1, n0: nLo, n1: nHi }));
    out.push(meta("telaio", `${op.id}:traverso`, { s0: 0, s1: W, z0: z1 - p, z1, n0: nLo, n1: nHi }));
    out.push(meta("anta", `${op.id}:anta`, { s0: p, s1: W - p, z0, z1: z1 - p, n0: aLo, n1: aHi }));
    const hs = W - p - 100;
    out.push(meta("maniglia", `${op.id}:maniglia`, { s0: hs, s1: hs + 30, z0: z0 + 1000, z1: z0 + 1100, n0: aHi, n1: aHi + MANIGLIA_SBALZO_MM }));
    return out;
  }

  // finestra e scorrevole: telaio perimetrale + vetro
  const p = PROFILO_FINESTRA_MM;
  out.push(meta("telaio", `${op.id}:spalla_sx`, { s0: 0, s1: p, z0, z1, n0: nLo, n1: nHi }));
  out.push(meta("telaio", `${op.id}:spalla_dx`, { s0: W - p, s1: W, z0, z1, n0: nLo, n1: nHi }));
  out.push(meta("telaio", `${op.id}:architrave`, { s0: 0, s1: W, z0: z1 - p, z1, n0: nLo, n1: nHi }));
  out.push(meta("telaio", `${op.id}:soglia`, { s0: 0, s1: W, z0, z1: z0 + p, n0: nLo, n1: nHi }));
  const vLo = -Math.floor(VETRO_MM / 2);
  const vHi = Math.ceil(VETRO_MM / 2);
  if (tipo === "scorrevole") {
    // mezzeria intera: larghezze dispari arrotondate per difetto (differenza di 1 mm, dichiarata)
    const mid = Math.floor(W / 2);
    const m0 = Math.floor(mid - p / 2);
    const m1 = m0 + p;
    out.push(meta("telaio", `${op.id}:montante`, { s0: m0, s1: m1, z0: z0 + p, z1: z1 - p, n0: nLo, n1: nHi }));
    out.push(meta("vetro", `${op.id}:vetro_sx`, { s0: p, s1: m0, z0: z0 + p, z1: z1 - p, n0: vLo, n1: vHi }));
    out.push(meta("vetro", `${op.id}:vetro_dx`, { s0: m1, s1: W - p, z0: z0 + p, z1: z1 - p, n0: vLo, n1: vHi }));
  } else {
    out.push(meta("vetro", `${op.id}:vetro`, { s0: p, s1: W - p, z0: z0 + p, z1: z1 - p, n0: vLo, n1: vHi }));
  }
  return out;
}

// Vano senza infisso assegnato: solo il foro (telaio di sicurezza per il muro vuoto, nessuna scatola).
export function openingIsEmpty(op) {
  return op.height <= 0 || op.width <= 0;
}
