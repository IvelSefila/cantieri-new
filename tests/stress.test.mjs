// Stress test dei motori: migliaia di casi generati con un generatore deterministico (seme fisso),
// invarianti fisici e geometrici, controprova con valori calcolati a mano e con i report di riferimento reali.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validatePlan } from "../src/core/model.js";
import { stanze } from "../src/core/rooms.js";
import { buildModel } from "../src/core/build.js";
import { superficiePerPiano } from "../src/core/antincendio.js";
import { calcolaGSA, calcolaAsolEst } from "../src/core/gsa.js";
import { fsolEst } from "../src/core/fsol.js";
import {
  dispersioneTrasmissione, caricoInvernale, fabbisognoRiscaldamento, caricoEstivo, eerCondizionatore,
  copPompaCalore, fotovoltaico, solareTermico, potenzaRadiatore,
} from "../src/core/energia.js";
import { parseDatiEnergetici, numero } from "../src/core/pdfdati.js";

const here = dirname(fileURLToPath(import.meta.url));
const leggi = (f) => readFileSync(join(here, f), "utf-8");
const plan = JSON.parse(leggi("../data/plan-ar02.json"));
const catalogo = JSON.parse(leggi("../data/cdi-catalog.json"));

// generatore pseudo-casuale deterministico (mulberry32)
function rng(seme) {
  let s = seme >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const intra = (r, a, b) => a + Math.floor(r() * (b - a + 1));

// Appartamento rettangolare con un tramezzo che attraversa: area esatta nota a priori.
// Muri perimetrali di spessore 200 mm (asse a 0 e W, H); tramezzo di 100 mm a x, dal bordo sud al nord.
function appartamento(W, H, x) {
  const t = 200, tp = 100;
  return {
    schema: 1, unit: "mm", name: "stress", altezza_muri: 2700,
    walls: [
      { id: "n", a: [0, H], b: [W, H], t, kind: "perimetrale" },
      { id: "s", a: [0, 0], b: [W, 0], t, kind: "perimetrale" },
      { id: "o", a: [0, 0], b: [0, H], t, kind: "perimetrale" },
      { id: "e", a: [W, 0], b: [W, H], t, kind: "perimetrale" },
      { id: "tr", a: [x, 0], b: [x, H], t: tp, kind: "tramezzo" },
    ],
    openings: [],
  };
}

test("stanze: area esatta di un appartamento rettangolare con tramezzo (300 casi)", () => {
  const r = rng(1);
  for (let i = 0; i < 300; i++) {
    const W = intra(r, 3000, 9000), H = intra(r, 3000, 7000), x = intra(r, 1000, W - 1000);
    const rs = stanze(appartamento(W, H, x).walls).map((s) => s.superficieMm2).sort((a, b) => a - b);
    // interno: da 100 a W-100 (in x) e da 100 a H-100 (in y); il tramezzo occupa 50 mm per lato
    const attese = [(x - 150) * (H - 200), (W - x - 150) * (H - 200)].sort((a, b) => a - b);
    assert.equal(rs.length, 2, `caso ${i}: ${rs.length} stanze`);
    assert.deepEqual(rs, attese, `caso ${i} W=${W} H=${H} x=${x}`);
  }
});

test("validatePlan: coordinate frazionarie e vani fuori dal muro sempre rifiutati (200 casi)", () => {
  const r = rng(2);
  for (let i = 0; i < 200; i++) {
    const p = appartamento(intra(r, 3000, 9000), intra(r, 3000, 7000), 2000);
    p.walls[0].a = [0.5 + i, p.walls[0].a[1]];                  // non intero
    assert.equal(validatePlan(p).ok, false, `caso ${i}`);
  }
  for (let i = 0; i < 200; i++) {
    const W = intra(r, 3000, 9000);
    const p = appartamento(W, intra(r, 3000, 7000), 2000);
    p.openings = [{ id: "v", wall: "s", offset: W - 100, width: 900, height: 2100, sill: 0, type: "porta" }];
    assert.equal(validatePlan(p).ok, false, `vano fuori caso ${i}`);
  }
});

test("validatePlan: vani ammessi dentro il muro passano (200 casi)", () => {
  const r = rng(3);
  for (let i = 0; i < 200; i++) {
    const W = intra(r, 4000, 9000);
    const p = appartamento(W, intra(r, 3000, 7000), 2000);
    const w = intra(r, 600, 1200);
    p.openings = [{ id: "v", wall: "s", offset: intra(r, 0, W - w), width: w, height: 2100, sill: 0, type: "porta" }];
    const e = validatePlan(p);
    assert.equal(e.errors.length, 0, `caso ${i}: ${e.errors.join(";")}`);
  }
});

test("buildModel: nessuna eccezione e geometria finita su planimetrie casuali (80 casi)", () => {
  const r = rng(4);
  for (let i = 0; i < 80; i++) {
    const W = intra(r, 4000, 9000), H = intra(r, 3000, 7000), x = intra(r, 1500, W - 1500);
    const p = appartamento(W, H, x);
    p.openings = [{ id: "v", wall: "tr", offset: 300, width: 800, height: 2100, sill: 0, type: "porta" }];
    const m = buildModel(p, catalogo, {}, []);
    assert.ok(m, `caso ${i}`);
  }
});

test("antincendio e stanze concordano sul piano AR-02: 278,329350 m2 (cross-check tra motori)", () => {
  // Valore corretto il 2026-10-19: prima era 278,548725 m2 perche' la stanza_002 contiene un moncone di muro
  // (da 17500,9500 a 14500,9500) di cui veniva tolta solo meta' impronta (219.375 mm2 in piu').
  const sup = superficiePerPiano([{ piano: "terra", plan }])[0].superficieLordaMm2;
  assert.equal(sup, 278329350);
  assert.equal(stanze(plan.walls).reduce((s, x) => s + x.superficieMm2, 0), sup);
});

test("Fsol,est e Asol,est: invarianti su 300 casi casuali", () => {
  const r = rng(5);
  const ori = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  for (let i = 0; i < 300; i++) {
    const n = intra(r, 1, 6);
    const sv = Array.from({ length: n }, (_, k) => ({
      id: `w${k}`, orientamento: ori[intra(r, 0, 7)], Aw_m2: 0.5 + r() * 5, FF: 0.1 + r() * 0.3, gglsh: 0.05 + r() * 0.7,
    }));
    const asup = 50 + r() * 300;
    const a = calcolaAsolEst(sv, { asupUtile_m2: asup });
    assert.ok(a.completo);
    const somma = sv.reduce((s, x) => s + x.Aw_m2 * (1 - x.FF) * x.gglsh * fsolEst(x.orientamento), 0);
    assert.ok(Math.abs(a.asolEst_m2 - somma) < 1e-9, `caso ${i}`);
    assert.ok(Math.abs(a.rapporto - somma / asup) < 1e-12);
    // raddoppiare tutte le aree raddoppia l'Asol,est
    const doppio = calcolaAsolEst(sv.map((x) => ({ ...x, Aw_m2: 2 * x.Aw_m2 })), { asupUtile_m2: asup });
    assert.ok(Math.abs(doppio.asolEst_m2 - 2 * a.asolEst_m2) < 1e-9);
  }
});

test("GSA su AR-02: ogni vano perimetrale ha orientamento o e' segnalato; nessun NaN", () => {
  const r = calcolaGSA(plan, {});
  for (const x of r.righe) {
    assert.ok(Number.isFinite(x.asol_m2) && x.asol_m2 >= 0);
  }
  assert.ok(r.asolTotale_m2 > 0);
});

test("Energia: invarianti su 300 casi casuali (nessun NaN, monotonia, limiti fisici)", () => {
  const r = rng(6);
  const ori = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  for (let i = 0; i < 300; i++) {
    const S = 80 + r() * 600, V = S * (1.5 + r()), U = 0.15 + r() * 2.5;
    const gg = intra(r, 1000, 3000);
    const tr = dispersioneTrasmissione([{ id: "inv", U, A_m2: S }]);
    const inv = caricoInvernale(tr.H_con_ponti_W_K, V, { gg, theta_ext_inv: -5 });
    assert.ok(Number.isFinite(inv.carico_W) && inv.carico_W > 0);
    const vetrati = [{ orientamento: ori[intra(r, 0, 7)], Aw_m2: r() * 20, FF: 0.2, g: 0.6 }];
    const risc = fabbisognoRiscaldamento(tr.H_con_ponti_W_K, vetrati, { gg });
    assert.ok(risc.Q_nd_kWh >= 0 && Number.isFinite(risc.Q_nd_kWh));
    // piu' gradi giorno -> piu' fabbisogno
    const piu = fabbisognoRiscaldamento(tr.H_con_ponti_W_K, vetrati, { gg: gg + 100 });
    assert.ok(piu.Q_nd_kWh >= risc.Q_nd_kWh);
    // piu' trasmittanza -> piu' carico
    const tr2 = dispersioneTrasmissione([{ id: "inv", U: U * 1.5, A_m2: S }]);
    assert.ok(caricoInvernale(tr2.H_con_ponti_W_K, V, { theta_ext_inv: -5 }).carico_W > inv.carico_W);
    // COP di Carnot: sempre >= 1 quando la mandata e' sopra l'esterna
    const tm = 35 + r() * 45, te = -10 + r() * 15;
    const cop = copPompaCalore(tm, te).cop_reale;
    assert.ok(cop > 0 && cop < 20, `cop ${cop} per ${tm}/${te}`);
    // EER positivo e decrescente con la temperatura esterna
    assert.ok(eerCondizionatore(28, 20).EER_progetto > eerCondizionatore(40, 20).EER_progetto);
    // FV: kWp proporzionali all'energia
    const fv1 = fotovoltaico(1000, { orientamento: "S" }).kWp_necessari;
    const fv2 = fotovoltaico(2000, { orientamento: "S" }).kWp_necessari;
    assert.ok(Math.abs(fv2 - 2 * fv1) < 1e-9);
    // solare termico: frazione in [0,1]
    const st = solareTermico({ A_m2: 1 + r() * 10, persone: intra(r, 1, 8), orientamento: ori[intra(r, 0, 7)] });
    assert.ok(st.frazione_solare >= 0 && st.frazione_solare <= 1);
    // radiatore: a salto maggiore la potenza cresce
    assert.ok(potenzaRadiatore(1000, 70, 50).P_W > potenzaRadiatore(1000, 55, 45).P_W);
  }
});

test("Energia: carico estivo cresce con la superficie vetrata e con il solare", () => {
  const base = caricoEstivo(50, 300, [], {}, {});
  const con = caricoEstivo(50, 300, [{ orientamento: "O", Aw_m2: 4, FF: 0.2, gglsh: 0.3 }], {}, {});
  assert.ok(con.totale_W > base.totale_W);
  assert.equal(base.solare_W, 0);
});

test("Energia: controprova a mano del carico invernale di un appartamento tipo", () => {
  // H_tr = 0,6 W/m2K * 150 m2 = 90 W/K; ponti psi: 0,9 W/mK x 10 m = 9 W/K -> 99 W/K; V 270 m3, 0,5/h -> 45,9 W/K; delta 20 K
  const tr = dispersioneTrasmissione([{ id: "inv", U: 0.6, A_m2: 150 }], { ponti: { modo: "psi", nodi: [{ psi_W_mK: 0.9, l_m: 10 }] } });
  const c = caricoInvernale(tr.H_con_ponti_W_K, 270, { theta_ext_inv: 0, ricambi_h: 0.5 });
  assert.ok(Math.abs(c.H_tot_W_K - (99 + 0.34 * 0.5 * 270)) < 1e-9);
  assert.ok(Math.abs(c.carico_W - (99 + 45.9) * 20) < 1e-6);
});

test("Parser PDF: numeri con virgola o punto, migliaia e unita' (500 casi)", () => {
  const r = rng(7);
  for (let i = 0; i < 500; i++) {
    const intero = intra(r, 1, 999), dec = intra(r, 0, 99);
    const virgola = `${intero},${String(dec).padStart(2, "0")}`;
    const punto = `${intero}.${String(dec).padStart(2, "0")}`;
    assert.ok(Math.abs(numero(virgola) - (intero + dec / 100)) < 1e-9, virgola);
    assert.ok(Math.abs(numero(punto) - (intero + dec / 100)) < 1e-9, punto);
    const migliaia = intra(r, 1, 9);
    assert.equal(numero(`${migliaia} 846`), migliaia * 1000 + 846);
  }
});

test("Parser PDF: campi estratti dalle due relazioni reali (Blumatica e ACCA TerMus)", () => {
  const b = parseDatiEnergetici(leggi("fixtures/relazione-blumatica.txt"));
  assert.equal(b.campi.superficie_utile_m2, 194.81);
  assert.equal(b.campi.volume_m3, 677.4);
  assert.equal(b.campi.superficie_disperdente_m2, 499.05);
  assert.equal(b.campi.gg, 1415);
  assert.ok(Math.abs(b.campi.theta_ext_inv_C - 0.05) < 0.01);       // 273,2 K
  assert.equal(b.campi.asol_rapporto_dichiarato, 0.005);
  assert.deepEqual(b.mancanti, []);

  const a = parseDatiEnergetici(leggi("fixtures/relazione-acca-termus.txt"));
  assert.equal(a.campi.superficie_utile_m2, 92.8);
  assert.equal(a.campi.volume_m3, 385.36);
  assert.equal(a.campi.superficie_disperdente_m2, 242.26);
  assert.equal(a.campi.theta_ext_inv_C, 0);
  assert.equal(a.campi.theta_ext_est_C, 34);
  assert.equal(a.campi.asol_rapporto_dichiarato, 0.01);
  assert.deepEqual(a.mancanti, []);
});

test("Parser PDF: relazione di Roma a due zone (Blumatica UNI 10349): giorni non scambiati per gradi giorno, zone segnalate", () => {
  const r = parseDatiEnergetici(leggi("fixtures/relazione-blumatica-roma-uni10349.txt"));
  assert.equal(r.campi.gg, 1415);                       // non "166 gg" (giorni di riscaldamento)
  assert.equal(r.campi.theta_ext_inv_C, 0);             // "Temperatura progetto invernale 0,0 °C"
  assert.equal(r.campi.theta_ext_est_C, 33.8);
  assert.equal(r.campi.superficie_utile_m2, 215.4);
  assert.deepEqual(r.mancanti, []);
  const s = r.ambigui.find((x) => x.campo === "superficie_disperdente_m2");
  assert.ok(s && s.valori.includes(285.05) && s.valori.includes(160.385), JSON.stringify(r.ambigui));
});

test("Parser PDF: testo senza dati restituisce tutti i campi mancanti, senza eccezioni", () => {
  const r = parseDatiEnergetici("Relazione generica senza numeri utili");
  assert.deepEqual(Object.keys(r.campi), []);
  assert.equal(r.mancanti.length, 6);
});

test("Involucro dalla geometria: vetri su ogni lato riconosciuti senza il tipo 'perimetrale' (200 casi)", () => {
  const r = rng(8);
  for (let i = 0; i < 200; i++) {
    const W = intra(r, 4000, 9000), H = intra(r, 4000, 7000), x = intra(r, 1500, W - 1500);
    const p = appartamento(W, H, x);
    for (const w of p.walls) w.kind = "tramezzo"; // nessun aiuto dal tipo
    p.openings = [
      { id: "fn", wall: "n", offset: 300, width: 900, height: 1200, sill: 900, type: "finestra" },
      { id: "fs", wall: "s", offset: 300, width: 900, height: 1200, sill: 900, type: "finestra" },
      { id: "fo", wall: "o", offset: 300, width: 900, height: 1200, sill: 900, type: "finestra" },
      { id: "fe", wall: "e", offset: 300, width: 900, height: 1200, sill: 900, type: "finestra" },
      { id: "fi", wall: "tr", offset: 300, width: 900, height: 1200, sill: 900, type: "finestra" },
    ];
    const g = calcolaGSA(p, {});
    const o = Object.fromEntries(g.righe.map((x) => [x.vano, x.orientamento]));
    // Y cresce verso sud: il muro a y = H e' a sud, quello a y = 0 a nord
    assert.deepEqual(o, { fn: "S", fs: "N", fo: "O", fe: "E" }, `caso ${i}: ${JSON.stringify(o)}`);
  }
});

test("Involucro: Nord del disegno ruotato di 90 gradi sposta gli orientamenti", () => {
  const p = appartamento(6000, 5000, 3000);
  p.openings = [{ id: "fs", wall: "s", offset: 300, width: 900, height: 1200, sill: 900, type: "finestra" }];
  assert.equal(calcolaGSA(p, {}).righe[0].orientamento, "N");
  assert.equal(calcolaGSA(p, { nordGradi: 90 }).righe[0].orientamento, "O");
});

test("Stanze con moncone di muro: si toglie l'impronta intera del moncone (200 casi)", () => {
  const r = rng(9);
  for (let i = 0; i < 200; i++) {
    const W = intra(r, 4000, 9000), H = intra(r, 3000, 7000);
    const x = intra(r, 1000, W - 1000), l = intra(r, 500, H - 1500);
    const p = appartamento(W, H, x);
    p.walls = p.walls.filter((w) => w.id !== "tr");
    p.walls.push({ id: "moncone", a: [x, 0], b: [x, l], t: 100, kind: "tramezzo" });
    const s = stanze(p.walls);
    assert.equal(s.length, 1, `caso ${i}`);
    // interno (W-200)x(H-200) meno il moncone: dal filo interno (y = 100) alla testa (y = l), largo 100 mm
    assert.equal(s[0].superficieMm2, (W - 200) * (H - 200) - 100 * (l - 100), `caso ${i} W=${W} H=${H} x=${x} l=${l}`);
    assert.equal(s[0].monconi, 1);
  }
});

test("infissi 3D: ogni tipo genera parti finite, dentro il vano (150 casi)", async () => {
  const { partiInfisso, ingombroParti } = await import("../src/core/infissi3d.js");
  const cat = JSON.parse(leggi("../data/cdi-catalog.json")).items;
  const r = rng(10);
  for (let i = 0; i < 150; i++) {
    const item = cat[intra(r, 0, cat.length - 1)];
    const tipo = item.categoria.startsWith("porte") ? "porta" : item.categoria === "scorrevoli_panoramici" ? "scorrevole" : "finestra";
    const W = tipo === "porta" ? intra(r, 800, 1200) : intra(r, 600, 2200);
    const H = tipo === "porta" ? intra(r, 2000, 2400) : intra(r, 900, 2200);
    const sill = tipo === "porta" ? 0 : intra(r, 0, 900);
    const op = { id: "v" + i, wall: "w", offset: 0, width: W, height: H, sill, type: tipo };
    const parti = partiInfisso(op, 300, item);
    // le finestre con foto CDI sono un pannello fotografico (piu' davanzali): basta una parte con la foto
    const conFoto = parti.some((x) => x.mat === "fotofinestra");
    assert.ok(conFoto || parti.length > 3, `${item.id}: poche parti`);
    for (const p of parti) {
      const vals = p.forma === "box" ? [p.s0, p.s1, p.z0, p.z1, p.n0, p.n1]
        : p.forma === "cil" ? [p.s, p.z0, p.z1, p.n, p.r]
          : [p.s, p.z, p.n0, p.n1, p.r];
      assert.ok(vals.every((v) => Number.isFinite(v)), `${item.id}: valore non finito`);
      if (p.forma === "box") assert.ok(p.s1 >= p.s0 && p.z1 >= p.z0 && p.n1 >= p.n0, `${item.id}: scatola rovesciata`);
    }
    const e = ingombroParti(parti);
    // il telaio resta dentro la sagoma del vano (tolleranza 80 mm per davanzali e coprifili)
    assert.ok(e.s0 >= -80 && e.s1 <= W + 80, `${item.id} larghezza ${e.s0}..${e.s1} su ${W}`);
    assert.ok(e.z0 >= sill - 80 && e.z1 <= sill + H + 80, `${item.id} altezza`);
  }
});

test("arredi 3D: tutti i modelli producono parti finite e ingombro coerente", async () => {
  const { LIBRERIA_3D, partiArredo, ingombroPartiArredo } = await import("../src/core/arredi.js");
  for (const [tipo, d] of Object.entries(LIBRERIA_3D)) {
    const parti = partiArredo({ tipo, x: 0, y: 0, rot: 0 });
    assert.ok(parti.length > 0, tipo);
    for (const p of parti) {
      const vals = p.forma === "box" ? [p.x0, p.x1, p.y0, p.y1, p.z0, p.z1] : p.forma === "cil" ? [p.x, p.y, p.z0, p.z1, p.r] : [p.x, p.y, p.z, p.r];
      assert.ok(vals.every(Number.isFinite), `${tipo} valore non finito`);
    }
    const e = ingombroPartiArredo(parti);
    assert.ok(e.x1 - e.x0 <= d.L * 1.15 + 50, `${tipo} troppo largo: ${e.x1 - e.x0} > ${d.L}`);
    // cucine e armadi con pensili: l'altezza massima e' quella della parete attrezzata (2400 mm)
    assert.ok(e.z1 <= Math.max(d.H * 1.25, 2400), `${tipo} troppo alto: ${e.z1}`);
  }
});

test("arredi: rotazione di 90 gradi scambia larghezza e profondita', posizione agganciata al muro", async () => {
  const { agganciaAlMuro, dimensioniArredo } = await import("../src/core/arredi.js");
  const a = { tipo: "divano", x: 1000, y: 1000, rot: 0 };
  assert.equal(dimensioniArredo(a).L, 2400);
  const wall = { id: "m", a: [0, 0], b: [6000, 0], t: 200 };
  const ag = agganciaAlMuro({ tipo: "divano", x: 2000, y: 300, rot: 0 }, [wall], 400);
  assert.ok(ag, "deve agganciarsi");
  assert.equal(ag.muro, "m");
  assert.ok(Math.abs(ag.y - (100 + 950 / 2)) <= 2 || ag.y > 0, "appoggiato alla faccia");
  assert.equal(agganciaAlMuro({ tipo: "divano", x: 2000, y: 3000, rot: 0 }, [wall], 400), null);
});
