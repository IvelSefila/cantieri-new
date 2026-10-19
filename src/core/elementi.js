// Dati e azioni degli elementi del progetto (funzioni pure, testabili).
import { wallLengthMm } from "./model.js";
import { stanze } from "./rooms.js";
import { ingombroArredo, LIBRERIA_ARREDI } from "./project.js";

// Classificazione PRESUNTA: un muro è considerato portante se nel disegno è una spina o un perimetrale, oppure se
// ha spessore da struttura (>= 200 mm). Non è una verifica strutturale: dal disegno non si vede cosa regge un muro.
export const DOCUMENTI_STRUTTURA = [
  "Progetto strutturale o relazione di calcolo depositata (Genio Civile / sportello sismico)",
  "Certificato di collaudo statico",
  "In assenza: rilievo e saggi in sito, verifica di un ingegnere strutturista secondo NTC 2018",
];
export function classificaMuro(w) {
  const tipo = w.kind ?? (w.t >= 200 ? "spina" : "tramezzo");
  const daTipo = tipo === "spina" || tipo === "perimetrale";
  const daSpessore = !daTipo && w.t >= 200;
  const portante = daTipo || daSpessore;
  let motivo;
  if (daTipo) motivo = `Indicato come ${tipo} nel disegno: presunto portante. Abbatterlo richiede verifica strutturale (NTC 2018).`;
  else if (daSpessore) motivo = `Spessore ${w.t} mm (>= 200 mm): presunto portante anche se indicato come ${tipo}. Serve verifica strutturale.`;
  else motivo = `Spessore ${w.t} mm e tipo ${tipo}: presunto tramezzo non portante (CILA, DPR 380/01 art. 6-bis), da confermare.`;
  return {
    tipo,
    portante,
    certezza: "presunta dal disegno",
    motivo,
    documenti: DOCUMENTI_STRUTTURA,
  };
}

// Punto dentro un poligono (regola del raggio, coordinate piane).
export function dentroPoligono(p, poly) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const incrocia = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (incrocia) dentro = !dentro;
  }
  return dentro;
}

export function stanzaAPunto(p, progetto) {
  return stanze(progetto.walls).find((s) => dentroPoligono(p, s.interno)) ?? null;
}

// Scheda di un elemento: titolo, righe di dati, azioni possibili.
export function descrivi(progetto, tipo, id) {
  if (tipo === "muro") {
    const w = progetto.walls.find((x) => x.id === id);
    if (!w) return null;
    const c = classificaMuro(w);
    const vani = progetto.openings.filter((o) => o.wall === id);
    return {
      titolo: `Muro ${id}`,
      portante: c.portante,
      righe: [
        ["Tipo", c.tipo],
        ["Portante", `${c.portante ? "Sì" : "No"} (${c.certezza})`],
        ["Nota", c.motivo],
        ["Per esserne certi", c.documenti.join("; ")],
        ["Lunghezza", `${wallLengthMm(w).toLocaleString("it-IT")} mm`],
        ["Spessore", `${w.t} mm`],
        ["Altezza", `${progetto.altezza_muri} mm`],
        ["Vani sul muro", vani.length ? vani.map((v) => `${v.id} (${v.width} mm)`).join(", ") : "nessuno"],
      ],
      azioni: [{ id: "abbatti", etichetta: c.portante ? "Abbatti muro (portante)" : "Abbatti muro", pericolo: true, conferma: c.portante }],
    };
  }
  if (tipo === "vano") {
    const o = progetto.openings.find((x) => x.id === id);
    if (!o) return null;
    return {
      titolo: `Vano ${id}`,
      righe: [
        ["Tipo", o.type],
        ["Materiale", o.materiale ?? (o.type === "porta" ? "legno (default)" : "vetro (default)")],
        ["Muro", o.wall],
        ["Posizione lungo il muro", `${o.offset} mm`],
        ["Larghezza", `${o.width} mm`],
        ["Altezza", `${o.height} mm`],
        ["Davanzale", `${o.sill} mm`],
      ],
      azioni: [{ id: "elimina", etichetta: "Elimina vano", pericolo: true }],
    };
  }
  if (tipo === "arredo") {
    const a = progetto.furniture.find((x) => x.id === id);
    if (!a) return null;
    const g = ingombroArredo(a);
    return {
      titolo: LIBRERIA_ARREDI[a.tipo]?.nome ?? a.tipo,
      righe: [["Posizione", `X ${a.x} · Y ${a.y} mm`], ["Ingombro", `${g.L} × ${g.D} × ${g.H} mm`], ["Rotazione", `${a.rot}°`]],
      azioni: [{ id: "elimina", etichetta: "Elimina arredo", pericolo: true }],
    };
  }
  if (tipo === "pavimento") {
    const f = progetto.floors.find((x) => x.id === id);
    if (!f) return null;
    const m2 = ((f.x1 - f.x0) * (f.y1 - f.y0)) / 1e6;
    return {
      titolo: `Pavimento ${id}`,
      righe: [["Materiale", f.materiale], ["Superficie", `${m2.toFixed(2).replace(".", ",")} m²`]],
      azioni: [{ id: "elimina", etichetta: "Elimina pavimento", pericolo: true }],
    };
  }
  if (tipo === "stanza") {
    const s = id;
    return {
      titolo: s.id,
      righe: [
        ["Superficie interna", `${(s.superficieMm2 / 1e6).toFixed(2).replace(".", ",")} m²`],
        ["Vertici", `${s.contorno.length}`],
      ],
      azioni: [],
    };
  }
  return null;
}

// Applica un'azione a un elemento. Restituisce il nuovo progetto, o null se non applicabile.
export function eseguiAzione(progetto, tipo, id, azione) {
  if (azione === "abbatti" && tipo === "muro") {
    return {
      ...progetto,
      walls: progetto.walls.filter((w) => w.id !== id),
      openings: progetto.openings.filter((o) => o.wall !== id),
    };
  }
  if (azione === "elimina" && tipo === "vano") {
    return { ...progetto, openings: progetto.openings.filter((o) => o.id !== id) };
  }
  if (azione === "elimina" && tipo === "arredo") {
    return { ...progetto, furniture: progetto.furniture.filter((a) => a.id !== id) };
  }
  if (azione === "elimina" && tipo === "pavimento") {
    return { ...progetto, floors: progetto.floors.filter((f) => f.id !== id) };
  }
  return null;
}
