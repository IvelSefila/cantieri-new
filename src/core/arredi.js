// Arredi 3D procedurali (stile Sweet Home 3D, tutto in JavaScript): ogni arredo e' un elenco di PARTI in coordinate
// locali, in mm. Funzioni pure, testabili senza grafica.
// Coordinate locali: x lungo la larghezza L (da -L/2 a L/2), y lungo la profondita' D (-D/2 = schienale/retro,
// +D/2 = fronte), z = quota da terra (0..H).
// Parti: { forma: "box", x0, x1, y0, y1, z0, z1, mat, colore? } | { forma: "cil", x, y, z0, z1, r, mat } |
//        { forma: "sfera", x, y, z, r, mat }
// La rotazione di un arredo (gradi interi, senso orario in pianta) gira gli assi locali nel piano del progetto.

const B = (mat, x0, x1, y0, y1, z0, z1, colore) => ({ forma: "box", mat, x0, x1, y0, y1, z0, z1, ...(colore ? { colore } : {}) });
const C = (mat, x, y, z0, z1, r) => ({ forma: "cil", mat, x, y, z0, z1, r });
const S = (mat, x, y, z, r) => ({ forma: "sfera", mat, x, y, z, r });

const gambe = (L, D, h, r, rientro, mat = "metallo_nero") => [
  C(mat, -L / 2 + rientro, -D / 2 + rientro, 0, h, r), C(mat, L / 2 - rientro, -D / 2 + rientro, 0, h, r),
  C(mat, -L / 2 + rientro, D / 2 - rientro, 0, h, r), C(mat, L / 2 - rientro, D / 2 - rientro, 0, h, r),
];

const TESSUTI = [
  { id: "grigio", nome: "Tessuto grigio", colore: "#7d838c" },
  { id: "blu", nome: "Tessuto blu notte", colore: "#2f4560" },
  { id: "beige", nome: "Tessuto beige", colore: "#cdbfa8" },
  { id: "verde", nome: "Velluto verde", colore: "#3f5e4b" },
  { id: "terracotta", nome: "Tessuto terracotta", colore: "#a8583c" },
];
const LEGNI = [
  { id: "rovere", nome: "Rovere naturale", colore: "#b98a5c" },
  { id: "noce", nome: "Noce", colore: "#6b4a33" },
  { id: "bianco", nome: "Laccato bianco", colore: "#efede8" },
  { id: "grafite", nome: "Laccato grafite", colore: "#3b3e44" },
];

function divano(L, D, H, f) {
  const c = f.colore;
  const out = [
    B("tessuto", -L / 2, L / 2, -D / 2, D / 2, 80, 380, c),
    B("tessuto", -L / 2, L / 2, -D / 2, -D / 2 + 200, 380, H, c),
    B("tessuto", -L / 2, -L / 2 + 160, -D / 2, D / 2, 380, 620, c),
    B("tessuto", L / 2 - 160, L / 2, -D / 2, D / 2, 380, 620, c),
    ...gambe(L - 120, D - 120, 80, 18, 0),
  ];
  const posti = Math.max(1, Math.round((L - 320) / 700));
  const w = (L - 320) / posti;
  for (let i = 0; i < posti; i++) {
    const x0 = -L / 2 + 160 + i * w;
    out.push(B("cuscino", x0 + 8, x0 + w - 8, -D / 2 + 200, D / 2 - 20, 380, 500, c));
    out.push(B("cuscino", x0 + 12, x0 + w - 12, -D / 2 + 60, -D / 2 + 210, 420, H - 40, c));
  }
  return out;
}

function divanoAngolare(L, D, H, f) {
  const c = f.colore;
  const dp = 950;
  return [
    ...divano(L, dp, H, f).map((p) => (p.forma === "box" ? { ...p, y0: p.y0 - (D - dp) / 2, y1: p.y1 - (D - dp) / 2 } : { ...p, y: p.y - (D - dp) / 2 })),
    B("tessuto", L / 2 - dp, L / 2, -D / 2 + dp, D / 2, 80, 380, c),
    B("cuscino", L / 2 - dp + 20, L / 2 - 160, -D / 2 + dp, D / 2 - 20, 380, 500, c),
    B("tessuto", L / 2 - 160, L / 2, -D / 2 + dp, D / 2, 380, 620, c),
  ];
}

function poltrona(L, D, H, f) {
  const c = f.colore;
  return [
    B("tessuto", -L / 2, L / 2, -D / 2, D / 2, 120, 400, c),
    B("tessuto", -L / 2, L / 2, -D / 2, -D / 2 + 180, 400, H, c),
    B("tessuto", -L / 2, -L / 2 + 140, -D / 2, D / 2, 400, 620, c),
    B("tessuto", L / 2 - 140, L / 2, -D / 2, D / 2, 400, 620, c),
    B("cuscino", -L / 2 + 150, L / 2 - 150, -D / 2 + 180, D / 2 - 20, 400, 500, c),
    ...gambe(L - 80, D - 80, 120, 16, 0, "legno"),
  ];
}

function tavolo(L, D, H, f) {
  return [B("legno", -L / 2, L / 2, -D / 2, D / 2, H - 40, H, f.colore), ...gambe(L, D, H - 40, 25, 70, "metallo_nero")];
}

function tavoloRotondo(L, D, H, f) {
  return [C("legno", 0, 0, H - 40, H, L / 2), C("metallo_nero", 0, 0, 30, H - 40, 45), C("metallo_nero", 0, 0, 0, 30, 260)];
}

function tavolino(L, D, H, f) {
  return [B("legno", -L / 2, L / 2, -D / 2, D / 2, H - 30, H, f.colore), B("legno", -L / 2 + 40, L / 2 - 40, -D / 2 + 40, D / 2 - 40, 60, 80, f.colore), ...gambe(L, D, H - 30, 14, 30, "metallo_nero")];
}

function sedia(L, D, H, f) {
  return [
    B("legno", -L / 2, L / 2, -D / 2, D / 2, 430, 460, f.colore),
    B("legno", -L / 2, L / 2, -D / 2, -D / 2 + 30, 460, H, f.colore),
    ...gambe(L, D, 430, 12, 25, "metallo_nero"),
  ];
}

function letto(L, D, H, f) {
  const c = f.colore;
  const out = [
    B("legno", -L / 2, L / 2, -D / 2, D / 2, 60, 300, c),
    B("materasso", -L / 2 + 20, L / 2 - 20, -D / 2 + 60, D / 2 - 20, 300, 520),
    B("lenzuolo", -L / 2 + 10, L / 2 - 10, -D / 2 + 600, D / 2 - 10, 500, 560),
    B("legno", -L / 2, L / 2, -D / 2, -D / 2 + 60, 60, 1000, c),
    ...gambe(L, D, 60, 20, 40, "metallo_nero"),
  ];
  const cuscini = L > 1200 ? 2 : 1;
  const w = (L - 120) / cuscini;
  for (let i = 0; i < cuscini; i++) out.push(B("cuscino_bianco", -L / 2 + 60 + i * w + 20, -L / 2 + 60 + (i + 1) * w - 20, -D / 2 + 90, -D / 2 + 470, 520, 640));
  return out;
}

function armadio(L, D, H, f) {
  const out = [B("legno", -L / 2, L / 2, -D / 2, D / 2, 0, H, f.colore)];
  const ante = Math.max(1, Math.round(L / 500));
  const w = L / ante;
  for (let i = 0; i < ante; i++) {
    out.push(B("fuga", -L / 2 + i * w - 2, -L / 2 + i * w + 2, D / 2, D / 2 + 2, 10, H - 10));
    out.push(B("metallo", -L / 2 + (i + 0.5) * w + (i % 2 ? -w / 2 + 40 : w / 2 - 40) - 8, -L / 2 + (i + 0.5) * w + (i % 2 ? -w / 2 + 40 : w / 2 - 40) + 8, D / 2, D / 2 + 25, H / 2 - 250, H / 2 + 250));
  }
  return out;
}

function comodino(L, D, H, f) {
  return [B("legno", -L / 2, L / 2, -D / 2, D / 2, 80, H, f.colore), B("fuga", -L / 2 + 20, L / 2 - 20, D / 2, D / 2 + 2, H / 2, H / 2 + 4), ...gambe(L, D, 80, 10, 30, "metallo_nero")];
}

function cassettiera(L, D, H, f) {
  const out = [B("legno", -L / 2, L / 2, -D / 2, D / 2, 60, H, f.colore), ...gambe(L, D, 60, 12, 40, "metallo_nero")];
  for (let i = 1; i < 4; i++) out.push(B("fuga", -L / 2 + 20, L / 2 - 20, D / 2, D / 2 + 2, 60 + (i * (H - 60)) / 4, 60 + (i * (H - 60)) / 4 + 4));
  return out;
}

function scrivania(L, D, H, f) {
  return [B("legno", -L / 2, L / 2, -D / 2, D / 2, H - 30, H, f.colore), B("metallo_nero", -L / 2, -L / 2 + 40, -D / 2 + 40, D / 2 - 40, 0, H - 30), B("metallo_nero", L / 2 - 40, L / 2, -D / 2 + 40, D / 2 - 40, 0, H - 30)];
}

function libreria(L, D, H, f) {
  const out = [B("legno", -L / 2, -L / 2 + 25, -D / 2, D / 2, 0, H, f.colore), B("legno", L / 2 - 25, L / 2, -D / 2, D / 2, 0, H, f.colore), B("legno", -L / 2, L / 2, -D / 2, -D / 2 + 10, 0, H, f.colore)];
  const ripiani = 5;
  for (let i = 0; i <= ripiani; i++) out.push(B("legno", -L / 2 + 25, L / 2 - 25, -D / 2, D / 2, (i * (H - 25)) / ripiani, (i * (H - 25)) / ripiani + 25, f.colore));
  // libri colorati sui ripiani (deterministici)
  const colori = ["#8c3b3b", "#2f4560", "#c49a45", "#3f5e4b", "#6d4c7d", "#d9d4c7"];
  for (let i = 0; i < ripiani; i++) {
    const z = (i * (H - 25)) / ripiani + 25;
    let x = -L / 2 + 40;
    let k = i;
    while (x < L / 2 - 120) {
      const w = 30 + ((k * 37) % 25);
      const h = 220 + ((k * 53) % 90);
      out.push(B("libro", x, x + w, -D / 2 + 30, D / 2 - 40, z, z + Math.min(h, (H - 25) / ripiani - 40), colori[k % colori.length]));
      x += w + 4;
      k++;
    }
  }
  return out;
}

function mobileTv(L, D, H, f) {
  return [
    B("legno", -L / 2, L / 2, -D / 2, D / 2, 120, H, f.colore),
    B("fuga", -L / 6, -L / 6 + 3, D / 2, D / 2 + 2, 130, H - 10), B("fuga", L / 6, L / 6 + 3, D / 2, D / 2 + 2, 130, H - 10),
    ...gambe(L, D, 120, 12, 40, "metallo_nero"),
    B("nero", -650, 650, -60, -20, H + 60, H + 800),
    B("metallo_nero", -150, 150, -120, 40, H, H + 10), B("metallo_nero", -20, 20, -60, -30, H + 10, H + 100),
  ];
}

function credenza(L, D, H, f) {
  const out = [B("legno", -L / 2, L / 2, -D / 2, D / 2, 150, H, f.colore), ...gambe(L, D, 150, 14, 50, "metallo_nero")];
  for (let i = 1; i < 3; i++) out.push(B("fuga", -L / 2 + (i * L) / 3, -L / 2 + (i * L) / 3 + 3, D / 2, D / 2 + 2, 160, H - 10));
  return out;
}

function cucina(L, D, H, f) {
  // basi da 600 con top in pietra, lavello e piano cottura, pensili e cappa
  const out = [B("zoccolo", -L / 2 + 20, L / 2 - 20, -D / 2, D / 2 - 60, 0, 100), B("piano_pietra", -L / 2, L / 2, -D / 2, D / 2 + 20, H - 40, H)];
  const moduli = Math.max(1, Math.round(L / 600));
  const w = L / moduli;
  for (let i = 0; i < moduli; i++) {
    const x0 = -L / 2 + i * w;
    out.push(B("laccato", x0 + 2, x0 + w - 2, -D / 2, D / 2, 100, H - 40, f.colore));
    out.push(B("metallo", x0 + w / 2 - 120, x0 + w / 2 + 120, D / 2, D / 2 + 20, H - 120, H - 100));
    // pensili
    out.push(B("laccato", x0 + 2, x0 + w - 2, -D / 2, -D / 2 + 350, 1450, 2150, f.colore));
  }
  // lavello e miscelatore
  const xl = -L / 2 + w * 0.5;
  out.push(B("inox", xl - 250, xl + 250, -D / 2 + 100, D / 2 - 80, H - 2, H + 2));
  out.push(C("inox", xl, -D / 2 + 70, H, H + 250, 14));
  // piano cottura a induzione con 4 zone
  const xc = moduli > 2 ? -L / 2 + w * 2.5 : L / 2 - w / 2;
  out.push(B("nero", xc - 290, xc + 290, -D / 2 + 70, D / 2 - 60, H, H + 6));
  for (const [dx, dy] of [[-140, -110], [140, -110], [-140, 100], [140, 100]]) out.push(C("vetro_nero", xc + dx, (dx > 0 ? 0 : 0) + dy, H + 6, H + 8, 85));
  // cappa
  out.push(B("inox", xc - 300, xc + 300, -D / 2, -D / 2 + 500, 1600, 1650));
  out.push(B("inox", xc - 130, xc + 130, -D / 2, -D / 2 + 260, 1650, 2150));
  return out;
}

function isola(L, D, H, f) {
  return [
    B("laccato", -L / 2 + 50, L / 2 - 50, -D / 2 + 50, D / 2 - 50, 0, H - 40, f.colore),
    B("piano_pietra", -L / 2, L / 2, -D / 2, D / 2, H - 40, H),
  ];
}

function frigorifero(L, D, H, f) {
  return [
    B("inox", -L / 2, L / 2, -D / 2, D / 2, 0, H),
    B("fuga", -L / 2 + 10, L / 2 - 10, D / 2, D / 2 + 2, H * 0.62, H * 0.62 + 6),
    B("metallo", L / 2 - 60, L / 2 - 40, D / 2, D / 2 + 30, H * 0.65, H * 0.9),
    B("metallo", L / 2 - 60, L / 2 - 40, D / 2, D / 2 + 30, H * 0.35, H * 0.58),
  ];
}

function wc(L, D, H, f) {
  return [
    B("ceramica", -L / 2 + 30, L / 2 - 30, -D / 2 + 150, D / 2 - 40, 0, 380),
    B("ceramica", -L / 2, L / 2, -D / 2 + 130, D / 2, 380, 420),
    B("ceramica", -L / 2, L / 2, -D / 2, -D / 2 + 160, 380, H),
    B("metallo", -60, 60, -D / 2 + 150, -D / 2 + 162, H - 120, H - 40),
  ];
}

function bidet(L, D, H, f) {
  return [B("ceramica", -L / 2 + 30, L / 2 - 30, -D / 2 + 60, D / 2 - 40, 0, H - 40), B("ceramica", -L / 2, L / 2, -D / 2, D / 2, H - 40, H), C("inox", 0, -D / 2 + 50, H, H + 120, 12)];
}

function lavabo(L, D, H, f) {
  const out = [
    B("laccato", -L / 2, L / 2, -D / 2, D / 2 - 20, 300, H - 30, f.colore),
    B("ceramica", -L / 2, L / 2, -D / 2, D / 2, H - 30, H),
    B("specchio", -L / 2 + 50, L / 2 - 50, -D / 2, -D / 2 + 15, H + 200, H + 1000),
  ];
  const n = L >= 1100 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const x = -L / 2 + ((i + 0.5) * L) / n;
    out.push(B("ceramica_scura", x - 220, x + 220, -D / 2 + 90, D / 2 - 60, H - 2, H + 1));
    out.push(C("inox", x, -D / 2 + 50, H, H + 220, 12));
  }
  return out;
}

function doccia(L, D, H, f) {
  return [
    B("ceramica", -L / 2, L / 2, -D / 2, D / 2, 0, 40),
    B("vetro", -L / 2, L / 2, D / 2 - 8, D / 2, 40, H),
    B("vetro", L / 2 - 8, L / 2, -D / 2, D / 2, 40, H),
    B("inox", -L / 2 + 5, L / 2 - 5, D / 2 - 14, D / 2 - 8, H - 30, H - 10),
    C("inox", 0, -D / 2 + 30, H - 300, H - 280, 140),
    C("inox", 0, -D / 2 + 30, 1200, H - 280, 12),
  ];
}

function vasca(L, D, H, f) {
  return [
    B("ceramica", -L / 2, L / 2, -D / 2, D / 2, 0, H),
    B("acqua", -L / 2 + 70, L / 2 - 70, -D / 2 + 70, D / 2 - 70, H - 160, H - 150),
    C("inox", -L / 2 + 120, 0, H, H + 200, 12),
  ];
}

function pianta(L, D, H, f) {
  return [
    C("vaso", 0, 0, 0, 380, L / 2 - 40),
    S("foglie", 0, 0, 750, L / 2), S("foglie", 80, 60, 1050, L / 2 - 80), S("foglie", -70, -40, 1250, L / 2 - 120),
    C("legno", 0, 0, 380, H - 300, 15),
  ];
}

function lampada(L, D, H, f) {
  return [C("metallo_nero", 0, 0, 0, 25, L / 2 - 20), C("metallo_nero", 0, 0, 25, H - 300, 10), C("paralume", 0, 0, H - 300, H, L / 2)];
}

function tappeto(L, D, H, f) {
  return [B("tappeto", -L / 2, L / 2, -D / 2, D / 2, 0, H, f.colore)];
}

// Libreria degli arredi. Dimensioni di default in mm (pari: il centro cade su un intero).
export const LIBRERIA_3D = {
  divano: { nome: "Divano 3 posti", categoria: "soggiorno", L: 2400, D: 950, H: 800, finiture: TESSUTI, parti: divano },
  divano_angolare: { nome: "Divano angolare", categoria: "soggiorno", L: 2800, D: 1800, H: 800, finiture: TESSUTI, parti: divanoAngolare },
  poltrona: { nome: "Poltrona", categoria: "soggiorno", L: 900, D: 880, H: 820, finiture: TESSUTI, parti: poltrona },
  tavolino: { nome: "Tavolino da salotto", categoria: "soggiorno", L: 1100, D: 600, H: 420, finiture: LEGNI, parti: tavolino },
  mobile_tv: { nome: "Mobile TV con televisore", categoria: "soggiorno", L: 1800, D: 450, H: 500, finiture: LEGNI, parti: mobileTv },
  libreria: { nome: "Libreria", categoria: "soggiorno", L: 1200, D: 350, H: 2000, finiture: LEGNI, parti: libreria },
  credenza: { nome: "Credenza", categoria: "soggiorno", L: 1800, D: 500, H: 850, finiture: LEGNI, parti: credenza },
  cucina: { nome: "Cucina lineare 2,40 m", categoria: "cucina", L: 2400, D: 600, H: 900, finiture: LEGNI, parti: cucina },
  isola: { nome: "Isola cucina", categoria: "cucina", L: 2000, D: 900, H: 900, finiture: LEGNI, parti: isola },
  frigorifero: { nome: "Frigorifero", categoria: "cucina", L: 600, D: 660, H: 1860, finiture: [{ id: "inox", nome: "Inox", colore: "#c7ccd4" }], parti: frigorifero },
  tavolo: { nome: "Tavolo 1,60 × 0,90", categoria: "cucina", L: 1600, D: 900, H: 750, finiture: LEGNI, parti: tavolo },
  tavolo_rotondo: { nome: "Tavolo rotondo Ø 1,10", categoria: "cucina", L: 1100, D: 1100, H: 750, finiture: LEGNI, parti: tavoloRotondo },
  sedia: { nome: "Sedia", categoria: "cucina", L: 450, D: 480, H: 900, finiture: LEGNI, parti: sedia },
  letto_matrimoniale: { nome: "Letto matrimoniale 1,80 × 2,00", categoria: "camera", L: 1800, D: 2000, H: 1000, finiture: LEGNI, parti: letto },
  letto_singolo: { nome: "Letto singolo 0,90 × 2,00", categoria: "camera", L: 900, D: 2000, H: 1000, finiture: LEGNI, parti: letto },
  armadio: { nome: "Armadio 2,00 m", categoria: "camera", L: 2000, D: 600, H: 2200, finiture: LEGNI, parti: armadio },
  comodino: { nome: "Comodino", categoria: "camera", L: 500, D: 400, H: 500, finiture: LEGNI, parti: comodino },
  cassettiera: { nome: "Cassettiera", categoria: "camera", L: 1000, D: 500, H: 800, finiture: LEGNI, parti: cassettiera },
  scrivania: { nome: "Scrivania", categoria: "camera", L: 1400, D: 700, H: 750, finiture: LEGNI, parti: scrivania },
  wc: { nome: "WC sospeso", categoria: "bagno", L: 380, D: 560, H: 800, finiture: [{ id: "bianco", nome: "Ceramica bianca", colore: "#f7f7f5" }], parti: wc },
  bidet: { nome: "Bidet sospeso", categoria: "bagno", L: 380, D: 540, H: 400, finiture: [{ id: "bianco", nome: "Ceramica bianca", colore: "#f7f7f5" }], parti: bidet },
  lavabo: { nome: "Mobile lavabo doppio", categoria: "bagno", L: 1200, D: 520, H: 850, finiture: LEGNI, parti: lavabo },
  doccia: { nome: "Box doccia 0,90 × 0,90", categoria: "bagno", L: 900, D: 900, H: 2000, finiture: [{ id: "trasparente", nome: "Cristallo", colore: "#dfeaf0" }], parti: doccia },
  vasca: { nome: "Vasca 1,70 × 0,75", categoria: "bagno", L: 1700, D: 750, H: 560, finiture: [{ id: "bianco", nome: "Acrilico bianco", colore: "#f7f7f5" }], parti: vasca },
  pianta: { nome: "Pianta in vaso", categoria: "decoro", L: 500, D: 500, H: 1500, finiture: [{ id: "verde", nome: "Ficus", colore: "#3f6b45" }], parti: pianta },
  lampada: { nome: "Lampada da terra", categoria: "decoro", L: 400, D: 400, H: 1700, finiture: [{ id: "nero", nome: "Nero opaco", colore: "#222" }], parti: lampada },
  tappeto: { nome: "Tappeto", categoria: "decoro", L: 2000, D: 1400, H: 10, finiture: TESSUTI, parti: tappeto },
};

export const CATEGORIE_ARREDO = {
  soggiorno: "Soggiorno", cucina: "Cucina", camera: "Camera", bagno: "Bagno", decoro: "Decoro",
};

// Dimensioni e finitura effettive di un arredo del progetto (i valori del progetto prevalgono sui default)
export function dimensioniArredo(a) {
  const def = LIBRERIA_3D[a.tipo];
  if (!def) return null;
  const fin = def.finiture.find((x) => x.id === a.finitura) ?? def.finiture[0];
  return { L: a.L ?? def.L, D: a.D ?? def.D, H: a.H ?? def.H, finitura: fin };
}

export function partiArredo(a) {
  const def = LIBRERIA_3D[a.tipo];
  if (!def) return [];
  const d = dimensioniArredo(a);
  return def.parti(d.L, d.D, d.H, d.finitura);
}

// Da coordinate locali dell'arredo a coordinate del piano (mm)
export function localeAPiano(a, lx, ly) {
  const t = ((a.rot ?? 0) * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return [a.x + lx * c - ly * s, a.y + lx * s + ly * c];
}

// Quattro angoli dell'impronta in pianta (mm)
export function angoliArredo(a) {
  const d = dimensioniArredo(a);
  if (!d) return [];
  return [[-d.L / 2, -d.D / 2], [d.L / 2, -d.D / 2], [d.L / 2, d.D / 2], [-d.L / 2, d.D / 2]].map(([x, y]) => localeAPiano(a, x, y));
}

function segmentiSiIncrociano(p1, p2, q1, q2) {
  const o = (a, b, c) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  return o(p1, p2, q1) !== o(p1, p2, q2) && o(q1, q2, p1) !== o(q1, q2, p2);
}

function dentro(p, poly) {
  let d = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}

function poligoniSiToccano(a, b) {
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    if (segmentiSiIncrociano(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return true;
  }
  return dentro(a[0], b) || dentro(b[0], a);
}

// Impronta di un muro (rettangolo dell'asse allargato di t/2)
export function improntaMuro(w) {
  const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
  const nx = -(w.b[1] - w.a[1]) / L, ny = (w.b[0] - w.a[0]) / L;
  const h = w.t / 2;
  return [[w.a[0] + nx * h, w.a[1] + ny * h], [w.b[0] + nx * h, w.b[1] + ny * h], [w.b[0] - nx * h, w.b[1] - ny * h], [w.a[0] - nx * h, w.a[1] - ny * h]];
}

// Collisioni di un arredo con muri e altri arredi (per il fantasma rosso e gli avvisi)
export function collisioniArredo(a, progetto) {
  const imp = angoliArredo(a);
  const out = [];
  for (const w of progetto.walls) if (poligoniSiToccano(imp, improntaMuro(w))) out.push({ tipo: "muro", id: w.id });
  for (const b of progetto.furniture ?? []) {
    if (b.id === a.id || !LIBRERIA_3D[b.tipo]) continue;
    if (LIBRERIA_3D[a.tipo]?.categoria === "decoro" && a.tipo === "tappeto") continue;
    if (b.tipo === "tappeto") continue;
    if (poligoniSiToccano(imp, angoliArredo(b))) out.push({ tipo: "arredo", id: b.id });
  }
  return out;
}

// Aggancio al muro: se il retro dell'arredo e' a meno di `soglia` mm dalla faccia di un muro, l'arredo si gira con il
// retro verso il muro e si appoggia alla faccia. Restituisce { x, y, rot, muro } oppure null.
export function agganciaAlMuro(a, walls, soglia = 400) {
  const d = dimensioniArredo(a);
  if (!d) return null;
  let migliore = null;
  for (const w of walls) {
    const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1];
    const L = Math.hypot(dx, dy);
    if (!L) continue;
    const ux = dx / L, uy = dy / L;
    const t = (a.x - w.a[0]) * ux + (a.y - w.a[1]) * uy;
    if (t < 0 || t > L) continue;
    const px = w.a[0] + ux * t, py = w.a[1] + uy * t;
    let nx = -uy, ny = ux;
    const lato = (a.x - px) * nx + (a.y - py) * ny;
    if (lato < 0) { nx = -nx; ny = -ny; }
    const dist = Math.abs(lato) - w.t / 2 - d.D / 2;
    if (dist > soglia || dist < -d.D) continue;
    if (!migliore || Math.abs(dist) < Math.abs(migliore.dist)) {
      // fronte (+y locale) lungo la normale: +y locale ruotato = (-sin t, cos t) = (nx, ny)
      const rot = Math.round((Math.atan2(-nx, ny) * 180) / Math.PI);
      const off = w.t / 2 + d.D / 2;
      // lungo il muro si resta dentro il segmento
      const tt = Math.max(d.L / 2, Math.min(L - d.L / 2, t));
      migliore = { dist, x: Math.round(w.a[0] + ux * tt + nx * off), y: Math.round(w.a[1] + uy * tt + ny * off), rot: ((rot % 360) + 360) % 360, muro: w.id };
    }
  }
  return migliore;
}

// Ingombro (box allineato agli assi) di tutte le parti, in coordinate locali: per i test
export function ingombroPartiArredo(parti) {
  const e = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const p of parti) {
    const [x0, x1, y0, y1, z0, z1] = p.forma === "box" ? [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1]
      : p.forma === "cil" ? [p.x - p.r, p.x + p.r, p.y - p.r, p.y + p.r, p.z0, p.z1]
        : [p.x - p.r, p.x + p.r, p.y - p.r, p.y + p.r, p.z - p.r, p.z + p.r];
    e.x0 = Math.min(e.x0, x0); e.x1 = Math.max(e.x1, x1);
    e.y0 = Math.min(e.y0, y0); e.y1 = Math.max(e.y1, y1);
    e.z0 = Math.min(e.z0, z0); e.z1 = Math.max(e.z1, z1);
  }
  return e;
}
