// Asol,est normativo (DM 26/06/2015, App. A, par. 2.2) e back-test sul caso Poroton (Bologna, zona E).
import { test } from "node:test";
import assert from "node:assert/strict";
import { fsolEst } from "../src/core/fsol.js";
import { irradianzaMediaAnnuaOrizzontale_W_m2 } from "../src/core/clima.js";
import { calcolaAsolEst, LIMITE_ASOL_EST } from "../src/core/gsa.js";


test("Fsol,est dai dati UNI 10349:2016 di Roma: luglio sull'esposizione / media annua orizzontale", () => {
  // media annua orizzontale: somma(H_mese x giorni) / 365 = 15,6208 MJ/m2 al giorno; luglio S = 11,45 -> 0,7330
  assert.ok(Math.abs(fsolEst("S") - 11.45 / 15.6208) < 1e-4);
  assert.ok(Math.abs(fsolEst("E") - 17.81 / 15.6208) < 1e-4);
  assert.ok(Math.abs(fsolEst("N") - 10.43 / 15.6208) < 1e-4);
  assert.ok(Math.abs(fsolEst("Oriz") - 27.70 / 15.6208) < 1e-4);
  assert.equal(fsolEst("X"), null);
  // a luglio est e ovest ricevono piu' del sud sul verticale; il nord il meno
  assert.ok(fsolEst("E") > fsolEst("S") && fsolEst("S") > fsolEst("N"));
  assert.equal(fsolEst("E"), fsolEst("O"));
  // 15,6208 MJ/m2 al giorno = 180,8 W/m2
  assert.ok(Math.abs(irradianzaMediaAnnuaOrizzontale_W_m2() - 15.6208e6 / 86400) < 0.01);
});

test("Asol,est: un vano a sud, valori a mano", () => {
  // 0,28 x (1 - 0,20) x 1,80 x 0,7330 = 0,2955 m2 ; Asup 100 m2 -> rapporto 0,0030
  const r = calcolaAsolEst([{ id: "v1", orientamento: "S", Aw_m2: 1.8, FF: 0.2, gglsh: 0.28 }], { asupUtile_m2: 100 });
  assert.ok(Math.abs(r.asolEst_m2 - 0.4032 * (11.45 / (5701.6 / 365))) < 1e-9); // 5701,6 MJ/m2 anno sul piano orizzontale
  assert.ok(Math.abs(r.rapporto - r.asolEst_m2 / 100) < 1e-12);
  assert.equal(r.verifica, true);
  assert.equal(r.completo, true);
  assert.equal(r.righe[0].Fsh_ob, 1); // ombreggiatura assente = 1 (valore conservativo)
});

test("Asol,est: dati mancanti esclusi dal totale e dichiarati", () => {
  const r = calcolaAsolEst([
    { id: "ok", orientamento: "S", Aw_m2: 1.8, FF: 0.2, gglsh: 0.28 },
    { id: "senza_gglsh", orientamento: "S", Aw_m2: 1.8, FF: 0.2 },
  ], { asupUtile_m2: 100 });
  assert.equal(r.completo, false);
  assert.equal(r.righe.length, 1);
  assert.ok(r.mancanti.some((m) => m.startsWith("senza_gglsh") && m.includes("ggl+sh")));
});

test("Limite Tabella 11: 0,030 per E.1 residenziale, 0,040 per gli altri edifici", () => {
  assert.equal(LIMITE_ASOL_EST.residenziale, 0.03);
  assert.equal(calcolaAsolEst([], { asupUtile_m2: 100, residenziale: false }).limite, 0.04);
});

// Back-test sul caso Poroton (Bologna, zona E, Asup 948,8 m2). Il testo dice: superficie vetrata al minimo
// (1/8 della superficie utile), balconi come unico ombreggiamento, g 0,67 e tendaggi che portano ggl+sh a 0,28.
// Esito dichiarato dall'autore: senza tendaggi il rapporto supera 0,030; con i tendaggi rientra nel limite.
// Assunzioni nostre: Aw ripartito in parti uguali sugli 8 orientamenti, FF 0,20, Fsh 1 (balconi ignorati, quindi
// conservativo), irraggiamento di Roma usato al posto di Bologna. Si verifica l'ESITO, non il numero.
test("Back-test Poroton: senza tendaggi non rispetta, con tendaggi rispetta", () => {
  const asup = 948.8;
  const orientamenti = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  const aw = (asup / 8) / orientamenti.length;
  const serramenti = (gglsh) => orientamenti.map((o) => ({ id: `w_${o}`, orientamento: o, Aw_m2: aw, FF: 0.2, gglsh }));

  const senza = calcolaAsolEst(serramenti(0.67), { asupUtile_m2: asup });
  const con = calcolaAsolEst(serramenti(0.67 * 0.42), { asupUtile_m2: asup });
  assert.ok(senza.rapporto > 0.03, `senza tendaggi: ${senza.rapporto}`);
  assert.equal(senza.verifica, false);
  assert.ok(con.rapporto < 0.03, `con tendaggi: ${con.rapporto}`);
  assert.equal(con.verifica, true);
});
