// Dati e azioni degli elementi del progetto (funzioni pure, testabili).
import { wallLengthMm } from "./model.js?v=v20261020bl";
import { stanze } from "./rooms.js?v=v20261020bl";
import { ingombroArredo, LIBRERIA_ARREDI, MATERIALI_MURO, MATERIALI_PAVIMENTO, TINTE_MURO, impostaMaterialePavimento, impostaFinituraMuro, impostaTintaMuro, impostaPavimentoStanza, impostaFunzioneStanza } from "./project.js?v=v20261020bl";

// Opzioni di finitura nella scheda: l'azione e' "finitura:<id>"
function opzioniFinitura(elenco, attiva) {
  return { titolo: "Finitura", attiva, opzioni: Object.entries(elenco).map(([id, v]) => ({ id, nome: v.nome })) };
}

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

// Funzione attuale della stanza: scelta salvata, altrimenti quella suggerita (vedi automatismi.js)
function funzioneAttiva(progetto, s) {
  const chiave = JSON.stringify(s.interno.map(([x, y]) => [Math.round(x), Math.round(y)]));
  const scelta = (progetto.funzioniStanze ?? []).find((f) => JSON.stringify(f.poligono) === chiave);
  return scelta ? scelta.funzione : null;
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
        ["Finitura", MATERIALI_MURO[w.finitura ?? "intonaco_bianco"]?.nome ?? "Intonaco bianco"],
        ["Nota", c.motivo],
        ["Per esserne certi", c.documenti.join("; ")],
        ["Lunghezza", `${wallLengthMm(w).toLocaleString("it-IT")} mm`],
        ["Spessore", `${w.t} mm`],
        ["Altezza", `${progetto.altezza_muri} mm`],
        ["Vani sul muro", vani.length ? vani.map((v) => `${v.id} (${v.width} mm)`).join(", ") : "nessuno"],
      ],
      finiture: opzioniFinitura(MATERIALI_MURO, w.finitura ?? "intonaco_bianco"),
      tinte: { titolo: "Colore", attiva: w.tinta ?? "naturale", opzioni: Object.entries(TINTE_MURO).map(([id, v]) => ({ id, nome: v.nome, hex: v.hex })) },
      azioni: c.portante
        ? [{ id: "abbatti", etichetta: "Abbatti muro: non possibile, muro portante", pericolo: true, disabile: true }]
        : [{ id: "abbatti", etichetta: "Abbatti muro", pericolo: true, conferma: false }],
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
      righe: [["Materiale", MATERIALI_PAVIMENTO[f.materiale]?.nome ?? f.materiale], ["Superficie", `${m2.toFixed(2).replace(".", ",")} m²`]],
      finiture: opzioniFinitura(MATERIALI_PAVIMENTO, f.materiale),
      azioni: [{ id: "elimina", etichetta: "Elimina pavimento", pericolo: true }],
    };
  }
  if (tipo === "stanza") {
    const s = id;
    // pavimento della stanza: se gia' creato, il materiale attuale; altrimenti si sceglie e si crea
    const chiave = JSON.stringify(s.interno.map(([x, y]) => [Math.round(x), Math.round(y)]));
    const pavimento = progetto.floors.find((f) => f.poligono && JSON.stringify(f.poligono) === chiave);
    return {
      titolo: s.id,
      righe: [
        ["Superficie interna", `${(s.superficieMm2 / 1e6).toFixed(2).replace(".", ",")} m²`],
        ["Vertici", `${s.contorno.length}`],
        ["Pavimento", pavimento ? (MATERIALI_PAVIMENTO[pavimento.materiale]?.nome ?? pavimento.materiale) : "non ancora scelto"],
      ],
      finiture: opzioniFinitura(MATERIALI_PAVIMENTO, pavimento?.materiale ?? null),
      funzioni: {
        titolo: "Funzione della stanza",
        attiva: funzioneAttiva(progetto, s),
        opzioni: [["soggiorno", "Soggiorno"], ["cucina", "Cucina"], ["camera", "Camera"], ["bagno", "Bagno"], ["disimpegno", "Disimpegno"], ["ripostiglio", "Ripostiglio"]].map(([id, nome]) => ({ id, nome })),
      },
      azioni: [],
    };
  }
  return null;
}

// Applica un'azione a un elemento. Restituisce il nuovo progetto, o null se non applicabile.
export function eseguiAzione(progetto, tipo, id, azione) {
  if (azione.startsWith("finitura:")) {
    const v = azione.slice("finitura:".length);
    const r = tipo === "muro" ? impostaFinituraMuro(progetto, id, v)
      : tipo === "pavimento" ? impostaMaterialePavimento(progetto, id, v)
      : tipo === "stanza" ? impostaPavimentoStanza(progetto, id.interno, v)
      : null;
    return r?.p ?? null;
  }
  if (azione.startsWith("funzione:") && tipo === "stanza") {
    return impostaFunzioneStanza(progetto, id.interno, azione.slice("funzione:".length)).p;
  }
  if (azione.startsWith("tinta:")) {
    const r = tipo === "muro" ? impostaTintaMuro(progetto, id, azione.slice("tinta:".length)) : null;
    return r?.p ?? null;
  }
  if (azione === "abbatti" && tipo === "muro") {
    const w = progetto.walls.find((x) => x.id === id);
    if (!w || classificaMuro(w).portante) return null; // muro portante: non si abbatte

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
