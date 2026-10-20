// Catalogo CDI per vano: quali modelli si possono montare in un vano e con quali avvisi.
// I limiti dimensionali sono INDICATIVI (regole di buona pratica per sistemi a battente e scorrevoli): il vincolo vero
// e' nella scheda tecnica CDI del sistema scelto. Il motore lo dichiara in ogni avviso.
import { TIPO_PER_CATEGORIA } from "./cdi.js?v=v20261020bn";

export const NOMI_CATEGORIA = {
  porte_ingresso: "Porte d'ingresso",
  porte_interne: "Porte interne",
  finestre_alluminio: "Finestre in alluminio",
  finestre_pvc: "Finestre in PVC",
  scorrevoli_panoramici: "Scorrevoli",
};

// Limiti indicativi per categoria (mm): larghezza e altezza del vano
export const LIMITI_INDICATIVI = {
  porte_ingresso: { lMin: 800, lMax: 1300, hMin: 2000, hMax: 2600 },
  porte_interne: { lMin: 600, lMax: 1200, hMin: 1900, hMax: 2500 },
  finestre_alluminio: { lMin: 400, lMax: 2400, hMin: 400, hMax: 2700 },
  finestre_pvc: { lMin: 400, lMax: 2200, hMin: 400, hMax: 2500 },
  scorrevoli_panoramici: { lMin: 1400, lMax: 6500, hMin: 1800, hMax: 3000 },
};
const NOTA_LIMITI = "limiti indicativi: verificare con la scheda tecnica CDI";

export function categoriePerVano(op) {
  if (op.type === "porta") return ["porte_ingresso", "porte_interne"];
  if (op.type === "scorrevole") return ["scorrevoli_panoramici"];
  return ["finestre_alluminio", "finestre_pvc"];
}

// esterno: true se il vano e' sull'involucro (muro con stanza da un solo lato), false se interno, null se non noto
export function compatibilita(item, op, { esterno = null } = {}) {
  const note = [];
  let stato = "ok";
  const tipo = TIPO_PER_CATEGORIA[item.categoria];
  if (tipo !== op.type) return { stato: "no", note: [`è per vani di tipo ${tipo}, il vano è ${op.type}`] };
  const lim = LIMITI_INDICATIVI[item.categoria];
  if (lim) {
    if (op.width < lim.lMin || op.width > lim.lMax) { stato = "avviso"; note.push(`larghezza ${op.width} mm fuori da ${lim.lMin}-${lim.lMax} mm (${NOTA_LIMITI})`); }
    if (op.height < lim.hMin || op.height > lim.hMax) { stato = "avviso"; note.push(`altezza ${op.height} mm fuori da ${lim.hMin}-${lim.hMax} mm (${NOTA_LIMITI})`); }
  }
  if (item.categoria === "porte_ingresso" && esterno === false) { stato = "avviso"; note.push("porta d'ingresso su un muro interno: di solito va sull'involucro o sul vano scala"); }
  if (item.categoria === "porte_interne" && esterno === true) { stato = "avviso"; note.push("porta interna su un muro esterno: non ha isolamento termico da ingresso"); }
  if (item.resa3d?.libro && op.width < 2000) { stato = "avviso"; note.push("lo scorrevole a libro richiede di solito almeno 2000 mm"); }
  if (tipo === "finestra" && op.width > 1000) note.push("vano oltre 1000 mm: due ante");
  if (item.uw == null && item.ud == null && tipo !== "porta") note.push("trasmittanza Uw non pubblicata: chiedere la scheda tecnica");
  return { stato, note };
}

// Modelli adatti al vano, raggruppati per categoria e ordinati: compatibili prima, poi con avvisi
export function modelliPerVano(catalogo, op, ctx = {}) {
  const ordine = { ok: 0, avviso: 1, no: 2 };
  return categoriePerVano(op).map((cat) => ({
    categoria: cat,
    nome: NOMI_CATEGORIA[cat],
    modelli: catalogo.items
      .filter((it) => it.categoria === cat)
      .map((it) => ({ item: it, ...compatibilita(it, op, ctx) }))
      .sort((a, b) => ordine[a.stato] - ordine[b.stato]),
  }));
}
