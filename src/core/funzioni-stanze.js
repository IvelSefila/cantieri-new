// Funzione delle stanze: scelta dell'utente o suggerita dalla geometria; arredo base per funzione.
import { stanze } from "./rooms.js?v=v20261020bv";

export const FUNZIONI = {
  soggiorno: "Soggiorno",
  cucina: "Cucina",
  camera: "Camera",
  bagno: "Bagno",
  disimpegno: "Disimpegno",
  ripostiglio: "Ripostiglio",
  comune: "Parte comune (corridoio, ascensore)",
};


// Il suggerimento e' una stima: la planimetria importata non porta le etichette delle stanze.
export function funzioneStanza(p, s) {
  const scelta = (p.funzioniStanze ?? []).find((f) => JSON.stringify(f.poligono) === JSON.stringify(s.interno.map(([x, y]) => [Math.round(x), Math.round(y)])));
  if (scelta) return { funzione: scelta.funzione, sorgente: "scelta" };
  return { funzione: suggerisciFunzione(s, p), sorgente: "suggerita" };
}

function bboxStanza(s) {
  const xs = s.interno.map((q) => q[0]), ys = s.interno.map((q) => q[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

function suggerisciFunzione(s, p) {
  const m2 = s.superficieMm2 / 1e6;
  const b = bboxStanza(s);
  const lati = [b.x1 - b.x0, b.y1 - b.y0];
  const snello = Math.max(...lati) / Math.max(1, Math.min(...lati)) >= 2.2;
  if (m2 <= 2.5) return "ripostiglio";
  if (m2 <= 4 && snello) return "disimpegno";
  if (m2 <= 6.5) return "bagno";
  const tutte = stanze(p.walls).map((x) => x.superficieMm2 / 1e6).sort((a, c) => c - a);
  if (m2 >= 16 && m2 === tutte[0]) return "soggiorno";
  return m2 >= 9 ? "camera" : "cucina";
}


// Pezzi per funzione: la funzione decide la lista, la superficie decide quanti
export const ARREDO_PER_FUNZIONE_ELENCO = {
  soggiorno: (m2) => (m2 >= 20 ? ["divano", "tavolino", "mobile_tv", "poltrona"] : ["divano", "tavolino"]),
  cucina: () => ["cucina", "frigorifero", "tavolo", "sedia", "sedia"],
  camera: (m2) => (m2 >= 12 ? ["letto_matrimoniale", "armadio", "comodino", "comodino", "scrivania"] : ["letto_singolo", "armadio", "comodino"]),
  bagno: (m2) => (m2 >= 5 ? ["wc", "lavabo", "doccia", "bidet"] : ["wc", "lavabo", "doccia"]),
  disimpegno: () => ["armadio"],
  ripostiglio: () => [],
  comune: () => [],
};
