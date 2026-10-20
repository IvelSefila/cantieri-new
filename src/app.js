// Interfaccia: progetto modificabile (vuoto all'avvio), modalità vista e costruzione, import/export.
import { validatePlan, wallLengthMm } from "./core/model.js?v=v20261020bo";
import { buildModel } from "./core/build.js?v=v20261020bo";
import { measurePlan } from "./core/measure.js?v=v20261020bo";
import { TIPO_PER_CATEGORIA } from "./core/cdi.js?v=v20261020bo";
import {
  progettoVuoto, aggiungiMuro, aggiungiVano, aggiungiPavimento, aggiungiArredo,
  ruotaArredo, spostaArredo, eliminaElemento, verificaProgetto, LIBRERIA_ARREDI, MATERIALI_PAVIMENTO,
} from "./core/project.js?v=v20261020bo";
import { createViewer } from "./view/scene.js?v=v20261020bo";
import { parseDxf } from "./io/dxf.js?v=v20261020bo";
import { dxfToPlan } from "./io/toPlan.js?v=v20261020bo";
import { montaTracciamento } from "./trace/ui.js?v=v20261020bo";
import { agganciaPunto, puntiNotevoli } from "./core/snap.js?v=v20261020bo";
import { stanze } from "./core/rooms.js?v=v20261020bo";
import { planSvg } from "./view2d/plan.js?v=v20261020bo";
import { montaHud } from "./ui/hud.js?v=v20261020bo";
import { rapportoAntincendio } from "./core/antincendio.js?v=v20261020bo";
import { apriScheda, chiudiScheda } from "./ui/scheda.js?v=v20261020bo";
import { descrivi, eseguiAzione, stanzaAPunto } from "./core/elementi.js?v=v20261020bo";
import { impostaPavimentoStanza, spezzaMuro, muroAPunto, impostaTintaMuro } from "./core/project.js?v=v20261020bo";

// Tipi di scatola che appartengono a un vano (telai, ante, vetri, maniglie): servono per risalire al vano cliccato
const PEZZI_VANO = ["telaio", "telaio_legno", "telaio_scrigno", "vetro", "vetro_fume", "anta", "anta_legno", "maniglia", "binario"];
import { calcolaGSA, calcolaAsolEst, ORIENTAMENTI } from "./core/gsa.js?v=v20261020bo";
import { montaScheda } from "./ui/energia-ui.js?v=v20261020bo";
import { renderAffidabilita } from "./ui/affidabilita-ui.js?v=v20261020bo";
import { partiInfisso, telaioPorta } from "./core/infissi3d.js?v=v20261020bo";
import { partiArredo } from "./core/arredi.js?v=v20261020bo";
import { inquadraturaFrontale } from "./core/inquadratura.js?v=v20261020bo";
import { apriDockInfissi, chiudiDockInfissi } from "./ui/dock-infissi.js?v=v20261020bo";
import { montaArredo } from "./ui/arredo-ui.js?v=v20261020bo";
import { arredaTutto, finiturTutto, infissiAutomatici, funzioneStanza, FUNZIONI } from "./core/automatismi.js?v=v20261020bo";
import { alloggiDelProgetto, analizzaAlloggi } from "./core/alloggi.js?v=v20261020bo";
import { impostaFunzioneStanza } from "./core/project.js?v=v20261020bo";

// Prima persona: pulsante sopra il ?, messaggio in alto, tasti WASD e frecce sovrimpressi che si illuminano
let pulsantePP = null;
let messaggioPP = null;
let tastiPP = null;
function entraPrimaPersona() {
  if (stato.viewer.passeggiataAttiva()) stato.viewer.esciPasseggiata();
  else {
    document.querySelector("aside")?.classList.add("chiuso");
    stato.arredo?.seleziona(null);
    // profondita' del telaio di ogni porta: stessa del 3D, cosi' il perno dell'anta coincide col bordo dell'anta
    for (const o of stato.progetto.openings) {
      if (o.type !== "porta") continue;
      const itemId = Object.prototype.hasOwnProperty.call(stato.assegnazioni, o.id) ? stato.assegnazioni[o.id] : (o.cdi ?? null);
      const item = itemId ? stato.catalogo?.items.find((i) => i.id === itemId) : null;
      o.telaio_mm = item ? telaioPorta(o, item) : 50;
    }
    stato.viewer.avviaPasseggiata(stato.progetto);
    messaggio("Frecce o W A S D per camminare, trascina per guardare, Shift corre, Esc esce.", "info");
  }
}
// Telefono (schermo tattile): due manopole come nei giochi; computer: tasti WASD e frecce
const TATTILE = window.matchMedia("(pointer: coarse)").matches;
let manopole = null;
function aggiornaPrimaPersona(on) {
  if (pulsantePP) pulsantePP.textContent = on ? "Esci dalla prima persona" : "Entra in prima persona";
  if (messaggioPP) messaggioPP.style.display = on && !TATTILE ? "block" : "none";
  if (tastiPP) tastiPP.style.display = on && !TATTILE ? "grid" : "none";
  if (manopole) manopole.style.display = on && TATTILE ? "block" : "none";
  document.body.classList.toggle("pp-on", on && TATTILE); // in prima persona sul telefono sparisce la barra degli strumenti
  if (!on && manopole) { allineaTastiMovimento({ x: 0, y: 0 }); stato.viewer.setStickPasseggiata(null, { x: 0, y: 0 }); }
}

// Manopola virtuale: cerchio con pallino; il valore va da -1 a 1 (y positivo = su)
function manopola(lato, onChange) {
  // Manopola relativa, con eventi di tocco diretti (il piu' affidabile sui telefoni):
  // il pallino parte dal centro e segue lo spostamento del dito, come nei giochi
  const base = document.createElement("div");
  base.dataset.stick = lato;
  base.style.cssText = `position:absolute;bottom:20px;${lato}:16px;width:112px;height:112px;border-radius:50%;background:rgba(16,22,38,.45);border:2px solid rgba(255,196,77,.5);touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;pointer-events:auto`;
  const pallino = document.createElement("div");
  pallino.style.cssText = "position:absolute;left:50%;top:50%;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;background:rgba(255,196,77,.75);pointer-events:none;transform:translate(0px,0px)";
  base.append(pallino);
  const RAGGIO = 38;
  const ZONA_MORTA = 0.12;
  let tocco = null;
  let inizio = null;
  const muovi = (t) => {
    let dx = t.clientX - inizio.x, dy = t.clientY - inizio.y;
    const d = Math.hypot(dx, dy);
    if (d > RAGGIO) { dx = (dx / d) * RAGGIO; dy = (dy / d) * RAGGIO; }
    pallino.style.transform = `translate(${dx}px,${dy}px)`;
    const zona = (v) => { const a = Math.abs(v); return a < ZONA_MORTA ? 0 : Math.sign(v) * (a - ZONA_MORTA) / (1 - ZONA_MORTA); };
    onChange({ x: zona(dx / RAGGIO), y: zona(-dy / RAGGIO) });
  };
  const fine = () => {
    if (tocco === null) return;
    tocco = null;
    inizio = null;
    pallino.style.transform = "translate(0px,0px)";
    onChange({ x: 0, y: 0 });
  };
  base.addEventListener("touchstart", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const t = e.changedTouches[0];
    tocco = t.identifier;
    inizio = { x: t.clientX, y: t.clientY };
  }, { passive: false });
  // Il movimento e la fine si ascoltano sulla finestra: il dito puo' uscire dalla manopola
  // Il dito di questa manopola si cerca tra tutti i tocchi ancora sullo schermo: cosi' nessun rilascio resta perso
  window.addEventListener("touchmove", (e) => {
    if (tocco === null) return;
    for (const t of e.touches) if (t.identifier === tocco) { muovi(t); e.preventDefault(); }
  }, { passive: false });
  const finisce = (e) => {
    if (tocco === null) return;
    const ancora = [...e.touches].some((t) => t.identifier === tocco);
    if (!ancora) fine();
  };
  window.addEventListener("touchend", finisce);
  window.addEventListener("touchcancel", finisce);
  window.addEventListener("blur", fine);
  return base;
}
// In prima persona sul telefono il tocco fuori dalle manopole non arriva alla scena (sta in app.js, quindi sempre aggiornato)
for (const tipo of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) {
  document.addEventListener(tipo, (e) => {
    // Le manopole usano eventi di tocco propri: il puntatore del tocco non deve mai arrivare alla scena
    if (!document.body.classList.contains("pp-on") || e.pointerType !== "touch") return;
    e.stopPropagation();
  }, true);
}

// In prima persona sul telefono nessun trascinamento deve muovere la pagina o la scena: solo le manopole
document.addEventListener("touchmove", (e) => {
  if (!document.body.classList.contains("pp-on")) return;
  if (e.target.closest?.("[data-stick]")) return;
  e.preventDefault();
}, { passive: false });

// Tasti di movimento tenuti dalla manopola sinistra
let tastiManopola = new Set();
function allineaTastiMovimento(v) {
  const voglio = new Set();
  if (v.y > 0.3) voglio.add("KeyW");
  if (v.y < -0.3) voglio.add("KeyS");
  if (v.x < -0.3) voglio.add("KeyA");
  if (v.x > 0.3) voglio.add("KeyD");
  const tasto = (c) => ({ code: c, key: c.slice(3).toLowerCase() });
  for (const c of tastiManopola) if (!voglio.has(c)) window.dispatchEvent(new KeyboardEvent("keyup", tasto(c)));
  for (const c of voglio) if (!tastiManopola.has(c)) window.dispatchEvent(new KeyboardEvent("keydown", tasto(c)));
  tastiManopola = voglio;
}
function montaManopole() {
  manopole = document.createElement("div");
  manopole.style.cssText = "display:none;position:fixed;inset:0;pointer-events:none;z-index:75;touch-action:none";
  // La manopola sinistra non tocca mai lo sguardo: traduce il pallino in tasti W A S D (avanti, indietro, lati)
  const sinistra = manopola("left", (v) => allineaTastiMovimento(v));
  const destra = manopola("right", (v) => stato.viewer.setStickPasseggiata(null, v));
  sinistra.style.pointerEvents = "auto";
  destra.style.pointerEvents = "auto";
  manopole.append(sinistra, destra);
  document.body.append(manopole);
}
function montaPrimaPersona() {
  const stile = "padding:8px 14px;border-radius:999px;border:1px solid rgba(255,196,77,.5);background:rgba(16,22,38,.9);color:#f2f4f8;font:600 12px system-ui,sans-serif;cursor:pointer";
  pulsantePP = document.createElement("button");
  pulsantePP.id = "btn-pp";
  pulsantePP.textContent = "Entra in prima persona";
  pulsantePP.style.cssText = stile + ";position:fixed;left:16px;bottom:200px;z-index:70";
  pulsantePP.onclick = entraPrimaPersona;

  messaggioPP = document.createElement("div");
  messaggioPP.id = "msg-pp";
  messaggioPP.textContent = "Esci dalla visuale in prima persona cliccando Esc";
  messaggioPP.style.cssText = "display:none;position:fixed;top:120px;left:50%;transform:translateX(-50%);z-index:80;padding:10px 18px;border-radius:12px;background:rgba(16,22,38,.92);color:#ffc44d;font:700 13px system-ui,sans-serif;border:1px solid rgba(255,196,77,.5)";

  // Un tasto per direzione: lettera WASD e freccia nello stesso riquadro, si illumina con l'uno o l'altro
  const tasto = (chiavi, lettera, freccia) => {
    const d = document.createElement("div");
    d.dataset.k = chiavi.join(" ");
    d.innerHTML = `<span style="font:700 15px system-ui,sans-serif">${lettera}</span><span style="font:600 11px system-ui,sans-serif;opacity:.7;margin-left:4px">${freccia}</span>`;
    d.style.cssText = "display:flex;align-items:center;justify-content:center;width:56px;height:52px;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(16,22,38,.85);color:#f2f4f8;transition:background .06s,border-color .06s";
    return d;
  };
  const vuoto = () => document.createElement("div");
  // Quattro tasti in croce: W sopra, A S D sotto
  tastiPP = document.createElement("div");
  tastiPP.id = "tasti-pp";
  tastiPP.style.cssText = "display:none;position:fixed;left:16px;bottom:270px;z-index:80;grid-template-columns:repeat(3,56px);grid-template-rows:repeat(2,52px);gap:6px;pointer-events:none";
  tastiPP.append(
    vuoto(), tasto(["w", "arrowup"], "W", "↑"), vuoto(),
    tasto(["a", "arrowleft"], "A", "←"), tasto(["s", "arrowdown"], "S", "↓"), tasto(["d", "arrowright"], "D", "→"),
  );
  // Sul telefono i tasti a schermo camminano: tenere premuto simula il tasto della tastiera
  tastiPP.addEventListener("pointerdown", (e) => {
    const d = e.target.closest?.("[data-k]");
    if (!d) return;
    const k = d.dataset.k.split(" ")[0];
    d.setPointerCapture?.(e.pointerId);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
  });
  tastiPP.addEventListener("pointerup", (e) => {
    const d = e.target.closest?.("[data-k]");
    if (d) window.dispatchEvent(new KeyboardEvent("keyup", { key: d.dataset.k.split(" ")[0] }));
  });
  tastiPP.addEventListener("pointercancel", () => window.dispatchEvent(new KeyboardEvent("keyup", { key: "w" })));
  const accendi = (on) => (e) => {
    const k = e.key.toLowerCase();
    tastiPP?.querySelectorAll("[data-k]").forEach((d) => {
      if (!d.dataset.k.split(" ").includes(k)) return;
      d.style.background = on ? "rgba(255,196,77,.85)" : "rgba(16,22,38,.85)";
      d.style.borderColor = on ? "#ffc44d" : "rgba(255,255,255,.3)";
      d.style.color = on ? "#0a0e18" : "#f2f4f8";
    });
  };
  window.addEventListener("keydown", accendi(true));
  window.addEventListener("keyup", accendi(false));
  document.body.append(pulsantePP, messaggioPP, tastiPP);
}

// Legenda dei comandi: pulsante "?" in basso a sinistra, pannello che si apre e si chiude
function montaLegenda() {
  const pulsante = document.createElement("button");
  pulsante.textContent = "?";
  pulsante.id = "btn-legenda";
  pulsante.title = "Legenda dei comandi";
  pulsante.setAttribute("aria-label", "Legenda dei comandi");
  pulsante.style.cssText = "position:fixed;left:16px;bottom:150px;z-index:70;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,196,77,.6);background:rgba(16,22,38,.9);color:#f2f4f8;font:700 16px system-ui,sans-serif;cursor:pointer";
  const pannello = document.createElement("div");
  pannello.id = "pannello-legenda";
  pannello.style.cssText = "position:fixed;left:64px;bottom:150px;z-index:70;width:330px;max-height:70vh;overflow:auto;padding:14px 16px;border-radius:14px;background:rgba(16,22,38,.95);color:#f2f4f8;font:13px/1.55 system-ui,sans-serif;border:1px solid rgba(255,196,77,.4);display:none";
  const voce = (tasto, testo) => {
    const r = document.createElement("div");
    r.style.cssText = "display:flex;gap:10px;margin:4px 0;align-items:flex-start";
    const k = document.createElement("span");
    k.textContent = tasto;
    k.style.cssText = "min-width:92px;padding:2px 8px;border-radius:6px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.06);font:600 12px system-ui,sans-serif;text-align:center;white-space:nowrap";
    const t = document.createElement("span");
    t.textContent = testo;
    r.append(k, t);
    return r;
  };
  const titolo = (t) => { const d = document.createElement("div"); d.textContent = t; d.style.cssText = "font:700 12px system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#ffc44d;margin:10px 0 4px"; return d; };
  pannello.append(
    titolo("Mouse"),
    voce("Clic sinistro", "Seleziona, isola o evidenzia un elemento"),
    voce("Doppio clic", "Scheda dell'elemento: muro, pavimento, arredo, vano o stanza"),
    voce("Trascina", "Ruota la vista"),
    voce("Rotella", "Zoom"),
    titolo("Tastiera: vista"),
    voce("W A S D / frecce", "Muovi la vista (avanti, indietro, lati)"),
    voce("Tab", "Mostra o nascondi il pannello laterale"),
    titolo("Tastiera: costruzione"),
    voce("1 – 6", "Strumenti: muro, vano, pavimento, arredo, sposta, elimina"),
    voce("R", "Ruota l'arredo"),
    voce("Ctrl + Z", "Annulla l'ultima modifica"),
    voce("Esc", "Annulla l'operazione in corso o chiudi"),
    titolo("Prima persona"),
    voce("W A S D / frecce", "Cammina"),
    voce("Shift", "Corri"),
    voce("Esc", "Esci dalla prima persona"),
  );
  pulsante.onclick = () => { pannello.style.display = pannello.style.display === "block" ? "none" : "block"; };
  document.body.append(pulsante, pannello);
}

// Arreda tutto: prima si sceglie l'alloggio (se ce ne sono piu' di uno), poi si confermano le funzioni delle sue stanze
function flussoArredo(mostraRisultato) {
  // Vista dall'alto, perfettamente verticale, con la planimetria a sinistra e il pannello a destra
  const xs = stato.progetto.walls.flatMap((w) => [w.a[0], w.b[0]]);
  const ys = stato.progetto.walls.flatMap((w) => [w.a[1], w.b[1]]);
  if (xs.length) {
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    // Area libera a sinistra del pannello (380 px + margini): la planimetria ci sta orizzontale, centrata, con un margine
    const el = stato.viewer.domElement;
    const W = el.clientWidth || 1200, H = el.clientHeight || 700;
    const liberoW = Math.max(300, W - 420);
    const FOV = 42, metaTan = Math.tan((FOV * Math.PI) / 360);
    const occupazione = 0.6; // zoom indietro: planimetria piu' piccola, tutta visibile con margine
    // Altezza visibile = 2 d tan(FOV/2) corrisponde a H px: px per mm = H / (2 d tan)
    const dX = ((x1 - x0) * H) / (2 * metaTan * occupazione * liberoW);
    const dY = (y1 - y0) / (2 * metaTan * occupazione);
    const d = Math.max(dX, dY, 3000);
    const spostamentoPx = Math.round(W / 2 - liberoW / 2); // la planimetria va al centro dell'area libera
    stato.viewer.vistaDallAltoSubito({
      camera: [Math.round(cx), Math.round(cy), Math.round(d)],
      bersaglio: [Math.round(cx), Math.round(cy), 0],
      spostamentoPx,
      su: (x1 - x0) >= (y1 - y0) ? [0, 0, -1] : [1, 0, 0],
    });
  }
  const alloggi = alloggiDelProgetto(stato.progetto);
  if (!alloggi.length) return messaggio("Nessuna stanza da arredare: disegna prima i muri.", "info");
  const velo = document.createElement("div");
  velo.id = "velo-alloggi";
  velo.style.cssText = "position:fixed;inset:0;z-index:200;pointer-events:none"; // niente velo: la planimetria 3D resta visibile
  const box = document.createElement("div");
  box.id = "pannello-alloggi";
  box.style.cssText = "pointer-events:auto;position:fixed;right:16px;top:110px;width:380px;max-height:78vh;overflow:auto;padding:14px;border-radius:16px;background:rgba(16,22,38,.94);color:#f2f4f8;font:13px/1.5 system-ui,sans-serif;border:1px solid rgba(255,196,77,.4)";
  const btn = "padding:9px 14px;border-radius:999px;border:1px solid rgba(255,196,77,.5);background:rgba(255,255,255,.06);color:#f2f4f8;font:600 12px system-ui,sans-serif;cursor:pointer;margin:4px";
  const chiudi = () => { velo.remove(); stato.viewer.setEvidenza(null); stato.viewer.ripristinaVistaCamera(); };

  const titolo = (t) => { const d = document.createElement("div"); d.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"; const b = document.createElement("b"); b.textContent = t; b.style.fontSize = "15px"; const x = document.createElement("button"); x.textContent = "✕"; x.style.cssText = btn; x.onclick = chiudi; d.append(b, x); return d; };

  const mostraEtichette = (alloggio) => {
    box.replaceChildren(titolo(`Alloggio ${alloggio.id.split("_")[1]}: conferma la funzione di ogni stanza`));
    const nota = document.createElement("div");
    nota.style.cssText = "margin-bottom:10px;opacity:.85";
    nota.textContent = "La planimetria non porta le etichette: le funzioni sono suggerite dalla forma e dalla superficie. Correggile se non corrispondono.";
    box.appendChild(nota);
    const selezioni = [];
    for (const s of alloggio.stanze) {
      const riga = document.createElement("div");
      // Barra cliccabile: si illumina al passaggio del mouse e la stanza si evidenzia in 3D
      riga.style.cssText = "display:flex;align-items:center;gap:10px;margin:6px 0;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);transition:background .15s,border-color .15s;cursor:pointer";
      riga.addEventListener("pointerover", () => { riga.style.background = "rgba(255,196,77,.18)"; riga.style.borderColor = "#ffc44d"; });
      riga.addEventListener("pointerout", () => { riga.style.background = "rgba(255,255,255,.04)"; riga.style.borderColor = "rgba(255,255,255,.12)"; });
      const etichetta = document.createElement("span");
      etichetta.style.flex = "1";
      etichetta.textContent = `${s.id} · ${(s.superficieMm2 / 1e6).toFixed(1).replace(".", ",")} m²`;
      const sel = document.createElement("select");
      sel.style.cssText = "padding:6px;border-radius:8px;background:#161d33;color:#f2f4f8;border:1px solid rgba(255,255,255,.2)";
      const { funzione } = funzioneStanza(stato.progetto, s);
      for (const [id, nome] of Object.entries(FUNZIONI)) {
        const o = document.createElement("option");
        o.value = id; o.textContent = nome; o.selected = id === funzione;
        sel.appendChild(o);
      }
      // Il pezzo di UI evidenzia la stanza nella scena 3D: si capisce a quale stanza si riferisce
      const evidenzia = () => stato.viewer.setEvidenza(s.interno);
      riga.addEventListener("pointerenter", evidenzia);
      sel.addEventListener("focus", evidenzia);
      sel.addEventListener("change", evidenzia);
      riga.append(etichetta, sel);
      box.appendChild(riga);
      selezioni.push({ s, sel });
    }
    const conferma = document.createElement("button");
    conferma.textContent = "Conferma e arreda";
    conferma.style.cssText = btn + ";margin-top:12px;border-color:#ffc44d";
    conferma.onclick = () => {
      let p = stato.progetto;
      for (const { s, sel } of selezioni) p = impostaFunzioneStanza(p, s.interno, sel.value).p;
      const r = arredaTutto(p, { stanzeScelte: alloggio.stanze.map((s) => s.interno) });
      chiudi();
      applica(r.p);
      mostraRisultato("Arredo automatico", r);
    };
    box.appendChild(conferma);
  };

  const analisi = analizzaAlloggi(stato.progetto);
  const info = (testo) => { const d = document.createElement("div"); d.style.cssText = "margin:4px 0;opacity:.85"; d.textContent = testo; return d; };
  if (alloggi.length === 1) {
    mostraEtichette(alloggi[0]);
  } else {
    box.replaceChildren(titolo("Quale alloggio vuoi arredare?"));
    for (const c of analisi.comuni) box.appendChild(info(`Parte comune, non arredata: ${c.stanza.id} (${c.m2} m²), ${c.motivo}`));
    for (const c of analisi.isolate) box.appendChild(info(`Vano chiuso, non arredato: ${c.stanza.id} (${c.m2} m²), ${c.motivo}`));
    for (const a of alloggi) {
      const b = document.createElement("button");
      b.textContent = `Alloggio ${a.id.split("_")[1]} · ${a.stanze.length} stanze · ${a.m2} m²`;
      b.style.cssText = btn;
      b.onclick = () => mostraEtichette(a);
      box.appendChild(b);
    }
  }
  velo.appendChild(box);
  document.body.appendChild(velo);
}

// Barra degli automatismi (sopra gli strumenti) e pannello con cio' che e' stato aggiunto
function montaAutomatismi() {
  const barra = document.createElement("div");
  barra.id = "barra-auto";
  barra.style.cssText = "display:none;position:fixed;left:50%;transform:translateX(-50%);bottom:112px;z-index:50;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:95vw"; // nascosta per ora: display:none e' l'ultima regola che conta
  const stile = "padding:8px 14px;border-radius:999px;border:1px solid rgba(255,196,77,.5);background:rgba(16,22,38,.85);color:#f2f4f8;font:600 12px system-ui,sans-serif;cursor:pointer";
  const pannello = document.createElement("div");
  pannello.id = "pannello-auto";
  pannello.style.cssText = "position:fixed;left:16px;top:120px;z-index:60;max-width:340px;padding:14px;border-radius:14px;background:rgba(16,22,38,.92);color:#f2f4f8;font:12px/1.5 system-ui,sans-serif;display:none;border:1px solid rgba(255,196,77,.4)";

  // Icona per riaprire il pannello dopo averlo ridotto
  const icona = document.createElement("button");
  icona.id = "icona-auto";
  icona.textContent = "▦ Automatismi";
  icona.title = "Mostra il pannello degli automatismi";
  icona.style.cssText = stile + ";position:fixed;left:16px;top:120px;z-index:60;display:none";
  icona.onclick = () => { icona.style.display = "none"; pannello.style.display = "block"; };

  const riduci = () => {
    if (pannello.style.display === "none") return;
    pannello.style.display = "none";
    icona.style.display = "block";
  };
  // Clic fuori dal pannello: si riduce a icona
  document.addEventListener("pointerdown", (ev) => {
    if (pannello.style.display !== "block") return;
    if (pannello.contains(ev.target) || barra.contains(ev.target) || icona.contains(ev.target)) return;
    riduci();
  });

  const mostra = (titolo, r) => {
    pannello.replaceChildren();
    const testa = document.createElement("div");
    testa.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:8px";
    const t = document.createElement("b");
    t.textContent = titolo;
    t.style.flex = "1";
    const riduciBtn = document.createElement("button");
    riduciBtn.textContent = "–";
    riduciBtn.title = "Riduci a icona";
    riduciBtn.style.cssText = stile;
    riduciBtn.onclick = riduci;
    const chiudiBtn = document.createElement("button");
    chiudiBtn.textContent = "✕";
    chiudiBtn.title = "Chiudi";
    chiudiBtn.style.cssText = stile;
    chiudiBtn.onclick = () => { pannello.style.display = "none"; icona.style.display = "none"; };
    testa.append(t, riduciBtn, chiudiBtn);
    pannello.appendChild(testa);
    const corpo = document.createElement("div");
    corpo.style.cssText = "max-height:60vh;overflow:auto";
    const elenco = r.aggiunti.length ? r.aggiunti : ["nulla da aggiungere"];
    for (const riga of elenco) { const d = document.createElement("div"); d.textContent = `• ${riga}`; corpo.appendChild(d); }
    for (const avviso of r.fuoriPlanimetria ?? []) {
      const d = document.createElement("div");
      d.style.color = "#ffb4b4";
      d.textContent = `⚠ ${avviso}`;
      corpo.appendChild(d);
    }
    pannello.appendChild(corpo);
    pannello.style.display = "block";
    icona.style.display = "none";
  };
  const esegui = (titolo, fn) => {
    const r = fn(stato.progetto);
    applica(r.p);
    mostra(titolo, r);
  };

  const bArredo = document.createElement("button");
  bArredo.textContent = "Arreda tutto";
  bArredo.style.cssText = stile;
  bArredo.onclick = () => flussoArredo(mostra);

  const bFiniture = document.createElement("button");
  bFiniture.textContent = "Intonaco muri e pavimenti";
  bFiniture.style.cssText = stile;
  bFiniture.onclick = () => esegui("Finiture", (p) => finiturTutto(p));

  const bInfissi = document.createElement("button");
  bInfissi.textContent = "Inserisci finestre";
  bInfissi.style.cssText = stile;
  bInfissi.onclick = () => esegui("Finestre (DM 5/7/1975 e orientamento)", (p) => infissiAutomatici(p));

  barra.append(bArredo, bFiniture, bInfissi);
  document.body.append(barra, pannello, icona);
}
import { montaGSA } from "./ui/gsa-ui.js?v=v20261020bo";

let hud = null;

const $ = (id) => document.getElementById(id);
const stato = {
  progetto: progettoVuoto(),
  catalogo: null,
  assegnazioni: {},
  viewer: null,
  modo: "vista",
  strumento: "muro",
  griglia: 100,
  spessore: 250,
  altezza: 2100,
  sbalzo: 0,
  tipoVano: "porta",
  larghezzaVano: 900,
  pendente: null,
  arredoSelezionato: null,
  rotazione: 0,
  arredo: "divano",
  pavimento: "parquet",
  storia: [],
  origine: "vuoto",
  dxfReport: null,
  schedaAnt: { assegnazioni: {}, quote: [] },
};

function messaggio(testo, tipo = "info") {
  const el = $("messaggi");
  el.textContent = testo;
  el.dataset.tipo = tipo;
  if (hud) hud.toast(testo, tipo);
}

function scrivi(righe) {
  $("esito").innerHTML = "";
  for (const r of righe) {
    const p = document.createElement("div");
    p.className = `riga ${r.tipo}`;
    p.textContent = r.testo;
    $("esito").appendChild(p);
  }
}

function fmtM2(v) {
  return v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m²";
}

// ---- Modifica con storia (annulla) ----
function applica(nuovo) {
  if (stato.origine === "vuoto") stato.origine = "disegnato";
  stato.storia.push(stato.progetto);
  if (stato.storia.length > 60) stato.storia.shift();
  stato.progetto = nuovo;
  ricostruisci();
}

function annullaUltimo() {
  if (!stato.storia.length) return messaggio("Niente da annullare.", "info");
  stato.progetto = stato.storia.pop();
  stato.pendente = null;
  ricostruisci();
}

// ---- Costruzione del modello ----
// Misure in sovrimpressione: lunghezze dei muri, larghezze dei vani e superfici delle stanze, in mm
function costruisciMisure(p) {
  const lista = [];
  const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  for (const w of p.walls) {
    const L = wallLengthMm(w);
    const dx = (w.b[0] - w.a[0]) / L;
    const dy = (w.b[1] - w.a[1]) / L;
    const off = w.t / 2 + 250;
    lista.push({ tipo: "muro", testo: `${fmt(L)} mm`, mm: [(w.a[0] + w.b[0]) / 2 - dy * off, (w.a[1] + w.b[1]) / 2 + dx * off], h: 1400 });
  }
  for (const o of p.openings) {
    const w = p.walls.find((x) => x.id === o.wall);
    if (!w) continue;
    const L = wallLengthMm(w);
    const dx = (w.b[0] - w.a[0]) / L;
    const dy = (w.b[1] - w.a[1]) / L;
    const s = o.offset + o.width / 2;
    lista.push({ tipo: "vano", testo: `${o.id} · ${fmt(o.width)} mm`, mm: [w.a[0] + dx * s, w.a[1] + dy * s], h: o.sill + o.height / 2 });
  }
  for (const s of stanze(p.walls)) {
    const n = s.contorno.length;
    const cx = s.contorno.reduce((a, q) => a + q[0], 0) / n;
    const cy = s.contorno.reduce((a, q) => a + q[1], 0) / n;
    lista.push({ tipo: "stanza", testo: `${(s.superficieMm2 / 1e6).toFixed(2).replace(".", ",")} m²`, mm: [cx, cy], h: 1000 });
  }
  return lista;
}

function aggiornaMisureVista() {
  if (!stato.misure || !stato.viewer) return;
  const f = stato.filtriMisure ?? { muri: true, vani: true, stanze: true };
  const chiave = { muro: "muri", vano: "vani", stanza: "stanze" };
  stato.viewer.setMisure(costruisciMisure(stato.progetto).filter((m) => f[chiave[m.tipo]]));
}

// Contesto per la scheda Affidabilità: cosa è noto e cosa manca, in ogni motore
function contestoAffidabilita() {
  const p = stato.progetto;
  const righe = calcolaGSA(p, { orientamenti: stato.orientamenti ?? {}, nordGradi: stato.nordGradi ?? 0 }).righe;
  const ambiti = {};
  for (const [chiave, ass] of Object.entries(stato.schedaAnt.assegnazioni ?? {})) {
    const id = ass.ambito || chiave;
    ambiti[id] = (ambiti[id] ?? 0) + 1;
  }
  return {
    localita: "Roma",
    geometria: {
      origine: stato.origine,
      muri: p.walls.length,
      stanze: stanze(p.walls).length,
      stanzeConMonconi: stanze(p.walls).filter((x) => x.monconi > 0).map((x) => x.id),
      muriObliqui: p.walls.filter((w) => !Number.isInteger(wallLengthMm(w))).length,
      arrotondamenti: stato.dxfReport?.arrotondamenti ?? 0,
      scartoMax_mm: stato.dxfReport?.scostamento_max_mm?.toFixed(3),
    },
    solare: {
      gglsh: stato.gsaGglsh != null,
      FFdaScheda: !!stato.gsaDaScheda,
      FshObDaRilievo: !!stato.gsaDaScheda && stato.gsaFshOb != null,
      vetriSenzaOrientamento: new Set(righe.filter((r) => !r.orientamento).map((r) => r.muro)).size,
      nordConfermato: stato.nordGradi != null,
    },
    energia: stato.energia?.contesto() ?? {},
    antincendio: {
      schedaCaricata: Object.keys(stato.schedaAnt.assegnazioni ?? {}).length > 0,
      ambitiMultiStanza: Object.values(ambiti).filter((n) => n > 1).length,
    },
  };
}

function aggiornaAffidabilita() {
  const box = $("sez-affidabilita");
  if (box) renderAffidabilita(box, contestoAffidabilita());
}

// Scheda GSA: vani vetrati, orientamenti da indicare, parametri e dati mancanti
function renderGSA() {
  const box = document.getElementById("sez-gsa");
  if (!box) return;
  const fmt = (v) => v.toFixed(2).replace(".", ",");
  const r = calcolaGSA(stato.progetto, {
    orientamenti: stato.orientamenti ?? {},
    Fsh: stato.gsaFsh ?? 1,
    Ff: stato.gsaFf ?? 0.8,
    nordGradi: stato.nordGradi ?? 0,
  });
  box.innerHTML = "";
  const nord = document.createElement("div");
  nord.className = "riga-azioni";
  nord.innerHTML = `<label>Nord del disegno, gradi in senso orario dall'alto <input id="gsa-nord" type="number" step="1" min="-180" max="360" value="${stato.nordGradi ?? ""}" placeholder="0" style="width:70px"></label>`;
  box.appendChild(nord);
  nord.querySelector("#gsa-nord").onchange = (e) => { stato.nordGradi = e.target.value === "" ? null : Number(e.target.value); renderGSA(); stato.energia?.aggiorna(); aggiornaAffidabilita(); };
  if (stato.nordGradi == null) {
    const d = document.createElement("div");
    d.className = "avviso";
    d.textContent = "Nord presunto in alto nel disegno: controlla la freccia del Nord sulla planimetria e inseriscila qui.";
    box.appendChild(d);
  }
  const riga = (t, classe = "") => {
    const d = document.createElement("div");
    d.className = classe;
    d.textContent = t;
    box.appendChild(d);
    return d;
  };
  riga(`Vani vetrati: ${r.righe.length} • area vetro ${fmt(r.areaVetroTotale_m2)} m²`);

  // orientamento di ogni muro con vani vetrati
  const muri = [...new Set(r.righe.map((x) => x.muro))];
  if (muri.length) riga("Orientamento delle pareti:", "avviso");
  for (const m of muri) {
    const linea = document.createElement("div");
    linea.className = "riga-azioni";
    const etichetta = document.createElement("span");
    etichetta.textContent = m;
    const sel = document.createElement("select");
    sel.appendChild(new Option("— da indicare", ""));
    for (const o of ORIENTAMENTI) sel.appendChild(new Option(o, o));
    sel.value = (stato.orientamenti ?? {})[m] ?? "";
    sel.onchange = () => {
      stato.orientamenti = { ...(stato.orientamenti ?? {}), [m]: sel.value || null };
      renderGSA();
      stato.energia?.aggiorna();
      aggiornaAffidabilita();
    };
    linea.append(etichetta, sel);
    box.appendChild(linea);
  }

  // parametri
  const par = document.createElement("div");
  par.className = "riga-azioni";
  par.innerHTML = `<label>Fsh <input id="gsa-fsh" type="number" step="0.05" min="0" max="1" value="${stato.gsaFsh ?? 1}" style="width:70px"></label>
    <label>Ff <input id="gsa-ff" type="number" step="0.05" min="0" max="1" value="${stato.gsaFf ?? 0.8}" style="width:70px"></label>`;
  box.appendChild(par);
  par.querySelector("#gsa-fsh").onchange = (e) => { stato.gsaFsh = Number(e.target.value); renderGSA(); };
  par.querySelector("#gsa-ff").onchange = (e) => { stato.gsaFf = Number(e.target.value); renderGSA(); };

  // dettaglio per vano
  for (const x of r.righe) {
    riga(`${x.vano} · ${x.materiale} · ${fmt(x.area_m2)} m² · g ${String(x.g).replace(".", ",")} · Asol ${fmt(x.asol_m2)} m² · ${x.orientamento ?? "orientamento da indicare"}`);
  }

  // Asol,est: risultato solo dopo il pulsante "Calcola Asol,est". Cambiando un dato il risultato va ricalcolato.
  const firma = JSON.stringify({ o: stato.orientamenti ?? {}, g: stato.gsaGglsh ?? null, f: stato.gsaFfTelaio ?? 0.2, s: stato.gsaFshOb ?? null, n: stato.nordGradi ?? null, sc: !!stato.gsaDaScheda });
  const pulsante = el_("button", "gsa-calcola", "Calcola Asol,est");
  pulsante.onclick = () => { stato.asolFirma = firma; renderGSA(); };
  box.appendChild(pulsante);
  if (stato.asolFirma !== firma) {
    rigaIn(box, "Premi Calcola Asol,est per il risultato. Il calcolo usa i dati sopra.", "info");
    return finisciDettagli(r, box);
  }
  // Asol,est secondo DM 26/06/2015 (verifica di legge): serve ggl+sh con schermo in uso e la frazione telaio FF
  const par2 = document.createElement("div");
  par2.className = "riga-azioni";
  par2.innerHTML = `<label>ggl+sh <input id="gsa-gglsh" type="number" step="0.01" min="0" max="1" value="${stato.gsaGglsh ?? ""}" style="width:70px"></label>
    <label>FF telaio <input id="gsa-ff-telaio" type="number" step="0.05" min="0" max="0.99" value="${stato.gsaFfTelaio ?? 0.2}" style="width:70px"></label>
    <label>Fsh,ob luglio <input id="gsa-fshob" type="number" step="0.05" min="0" max="1" value="${stato.gsaFshOb ?? ""}" placeholder="1" style="width:70px"></label>
    <label><input id="gsa-scheda" type="checkbox" ${stato.gsaDaScheda ? "checked" : ""}> FF e Fsh,ob presi da scheda tecnica e rilievo</label>`;
  box.appendChild(par2);
  par2.querySelector("#gsa-gglsh").onchange = (e) => { stato.gsaGglsh = e.target.value === "" ? null : Number(e.target.value); renderGSA(); aggiornaAffidabilita(); };
  par2.querySelector("#gsa-ff-telaio").onchange = (e) => { stato.gsaFfTelaio = Number(e.target.value); renderGSA(); aggiornaAffidabilita(); };
  par2.querySelector("#gsa-fshob").onchange = (e) => { stato.gsaFshOb = e.target.value === "" ? null : Number(e.target.value); renderGSA(); aggiornaAffidabilita(); };
  par2.querySelector("#gsa-scheda").onchange = (e) => { stato.gsaDaScheda = e.target.checked; aggiornaAffidabilita(); };
  const asupUtile_m2 = stanze(stato.progetto.walls).reduce((s, x) => s + x.superficieMm2, 0) / 1e6;
  const a = calcolaAsolEst(
    r.righe.map((x) => ({ id: x.vano, orientamento: x.orientamento, Aw_m2: x.area_m2, FF: stato.gsaFfTelaio ?? 0.2, gglsh: stato.gsaGglsh ?? null, Fsh_ob: stato.gsaFshOb ?? 1 })),
    { asupUtile_m2 },
  );
  const esito = a.verifica === null ? "" : a.verifica ? " • VERIFICATO" : " • NON VERIFICATO";
  riga(`Asol,est (DM 26/06/2015): ${fmt(a.asolEst_m2)} m² • Asup utile ${fmt(asupUtile_m2)} m² • rapporto ${a.rapporto === null ? "—" : a.rapporto.toFixed(4).replace(".", ",")} (limite < ${a.limite.toFixed(3).replace(".", ",")})${esito}`, a.verifica ? "ok" : "avviso");
  if (!a.completo) riga(`Asol,est incompleto, mancano: ${a.mancanti.join("; ")}`, "avviso");
  riga("Formula del DM 26/06/2015 aggiornato dal DM 28/10/2025. Fsol,est dai dati UNI 10349:2016 di Roma. Asup utile = somma delle stanze chiuse. Fsh,ob = 1 se non indicato (nessuna ombra).");
  finisciDettagli(r, box);
}

function rigaIn(box, t, classe = "") {
  const d = document.createElement("div");
  d.className = classe;
  d.textContent = t;
  box.appendChild(d);
}

function el_(tag, cls, testo) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (testo !== undefined) e.textContent = testo;
  return e;
}

function finisciDettagli(r, box) {

  // dati mancanti per completare il calcolo
  rigaIn(box, "Dati mancanti per il calcolo completo:", "avviso");
  for (const m of [...r.mancanti, ...r.datiMancanti]) rigaIn(box, `• ${m}`);
}

// Modelli dettagliati di infissi (solo vani con un modello CDI montato) e arredi
function costruisciDettagli(p) {
  const lista = [];
  for (const o of p.openings) {
    const w = p.walls.find((x) => x.id === o.wall);
    if (!w) continue;
    const itemId = Object.prototype.hasOwnProperty.call(stato.assegnazioni, o.id) ? stato.assegnazioni[o.id] : (o.cdi ?? null);
    const item = itemId ? stato.catalogo.items.find((i) => i.id === itemId) : null;
    if (!item) continue; // vano aperto: solo il foro nel muro
    lista.push({ tipo: "infisso", parti: partiInfisso(o, w.t, item), op: o, wall: w });
  }
  for (const a of p.furniture) lista.push({ tipo: "arredo", parti: partiArredo(a), a });
  return lista;
}

// Vista frontale di un vano: la camera si mette davanti, il vano a sinistra, il pannello CDI a destra
function apriVistaFrontale(opId) {
  const p = stato.progetto;
  const o = p.openings.find((x) => x.id === opId);
  const w = o && p.walls.find((x) => x.id === o.wall);
  if (!o || !w) return;
  if (!stato.frontale) stato.frontale = { prevista: stato.viewer.vistaAttuale() };
  const q = inquadraturaFrontale(o, w, stato.viewer.vistaAttuale().camera);
  stato.viewer.volaA(q);
  apriDockInfissi({
    op: o,
    catalogo: stato.catalogo,
    assegnato: Object.prototype.hasOwnProperty.call(stato.assegnazioni, o.id) ? stato.assegnazioni[o.id] : (o.cdi ?? null),
    esterno: null,
    onScegli: (id) => {
      stato.assegnazioni[o.id] = id;
      ricostruisci();
      messaggio(id ? "Infisso montato." : "Vano lasciato aperto.", "ok");
    },
    onChiudi: () => chiudiVistaFrontale(),
  });
  messaggio(`Vano ${o.id}: scegli l'infisso CDI a destra. Esc chiude.`, "info");
}

function chiudiVistaFrontale() {
  chiudiDockInfissi(true);
  if (stato.frontale) stato.viewer.volaA(stato.frontale.prevista);
  stato.frontale = null;
}

function ricostruisci() {
  const p = stato.progetto;
  renderGSA();
  stato.energia?.segna();
  aggiornaAffidabilita();
  aggiornaMisureVista();
  if (stato.vista2d) aggiornaVista2d();
  const check = verificaProgetto(p);
  const righe = [];
  for (const e of check.errors) righe.push({ tipo: "errore", testo: `ERRORE: ${e}` });
  for (const w of check.warnings) righe.push({ tipo: "avviso", testo: `avviso: ${w}` });

  const arredi = [];
  const res = buildModel(p, stato.catalogo, stato.assegnazioni, arredi);
  if (!res.ok) {
    scrivi(righe);
    stato.viewer.setBoxes([]);
    messaggio("Modello non costruito: correggi gli errori.", "errore");
    renderVani();
    return;
  }
  for (const w of res.report.warnings) if (!check.warnings.includes(w)) righe.push({ tipo: "avviso", testo: `avviso: ${w}` });
  // i modelli dettagliati sostituiscono i vecchi box di telai/ante/vetri e degli arredi
  const idVani = new Set(p.openings.map((o) => o.id));
  const scatole = res.boxes.filter((b) => b.kind !== "arredo" && !(b.id && idVani.has(String(b.id).split(":")[0]) && b.kind !== "muro"));
  stato.viewer.setBoxes(scatole);
  stato.viewer.setDettagli(costruisciDettagli(p));
  stato.arredo?.aggiorna();

  if (p.walls.length === 0 && p.floors.length === 0 && p.furniture.length === 0) {
    righe.unshift({ tipo: "info", testo: "Progetto vuoto: usa la modalità costruzione per aggiungere muri, vani, pavimenti e arredi." });
  } else {
    const m = measurePlan(p);
    const sta = stanze(p.walls);
    if (sta.length) {
      righe.push({ tipo: "info", testo: `Stanze rilevate: ${sta.length}.` });
      for (const s of sta.slice(0, 12)) righe.push({ tipo: "info", testo: `  ${s.id}: ${fmtM2(s.superficieMm2 / 1e6)}` });
    }
    righe.unshift(
      { tipo: "ok", testo: `Modello: ${p.walls.length} muri, ${p.openings.length} vani, ${p.floors.length} pavimenti, ${p.furniture.length} arredi.` },
      { tipo: "ok", testo: m.lunghezza_muri_obliqui_mm > 0
        ? `Lunghezza muri: ${m.lunghezza_muri_mm.toLocaleString("it-IT")} mm (muri dritti, intera) + ${m.lunghezza_muri_obliqui_mm.toLocaleString("it-IT")} mm (muri obliqui, non intera).`
        : `Lunghezza muri: ${m.lunghezza_muri_mm.toLocaleString("it-IT")} mm (intera).` },
      { tipo: "ok", testo: `Superficie muri netta (due facce): ${fmtM2(m.superficie_muri_netta_m2)}.` },
    );
  }
  scrivi(righe);
  messaggio(stato.pendente ? `In attesa del secondo punto (${stato.strumento}). Esc annulla.` : "Pronto. Ogni misura è un intero in mm.", "ok");
  renderVani();
}

function renderVani() {
  const lista = $("vani");
  lista.innerHTML = "";
  for (const o of stato.progetto.openings) {
    const riga = document.createElement("div");
    riga.className = "vano";
    const titolo = document.createElement("div");
    titolo.textContent = `${o.id} • ${o.type} • ${o.width} × ${o.height} mm • muro ${o.wall}`;
    const sel = document.createElement("select");
    sel.appendChild(new Option("— vano aperto (nessun infisso)", ""));
    for (const it of stato.catalogo.items) {
      if (TIPO_PER_CATEGORIA[it.categoria] === o.type) sel.appendChild(new Option(it.nome, it.id));
    }
    const corrente = Object.prototype.hasOwnProperty.call(stato.assegnazioni, o.id) ? stato.assegnazioni[o.id] : (o.cdi ?? "");
    sel.value = corrente ?? "";
    sel.onchange = () => {
      stato.assegnazioni[o.id] = sel.value || null;
      ricostruisci();
    };
    riga.append(titolo, sel);
    lista.appendChild(riga);
  }
}

// Vista 2D: sovrapposizione SVG sopra la 3D, generata dal progetto corrente (stessa sorgente).
function aggiornaVista2d() {
  const box = document.getElementById("vista");
  let ov = document.getElementById("vista-2d");
  if (!ov) {
    ov = document.createElement("div");
    ov.id = "vista-2d";
    ov.style.cssText = "position:absolute; inset:0; display:none; background:#f7f8fa; z-index:5;";
    box.style.position = "relative";
    box.appendChild(ov);
  }
  ov.style.display = stato.vista2d ? "block" : "none";
  // interruttori 3D | 2D: stessa posizione in scheda Vista e in alto
  for (const sw of document.querySelectorAll(".switch-2d")) {
    sw.classList.toggle("on", !!stato.vista2d);
    sw.setAttribute("aria-checked", stato.vista2d ? "true" : "false");
  }
  if (stato.vista2d) ov.innerHTML = planSvg(stato.progetto);
}

function caricaProgetto(p, nome, { origine = "json", dxfReport = null } = {}) {
  stato.progetto = { floors: [], furniture: [], ...p };
  stato.origine = origine;
  stato.dxfReport = dxfReport;
  stato.storia = [];
  stato.assegnazioni = {};
  stato.pendente = null;
  $("nome-plan").textContent = `${nome}: ${p.name ?? ""}`;
  ricostruisci();
}

// ---- Scatta e snap ----
function aggancia(v) {
  const g = stato.griglia;
  return g > 0 ? Math.round(v / g) * g : Math.round(v);
}

// Proiezione di un punto mm su un muro: offset lungo il muro.
function offsetSuMuro(p, muro) {
  const dx = muro.b[0] - muro.a[0];
  const dy = muro.b[1] - muro.a[1];
  const L = Math.hypot(dx, dy);
  return Math.round(((p[0] - muro.a[0]) * dx + (p[1] - muro.a[1]) * dy) / L);
}

// Vista: clic su pavimento o stanza evidenzia la stanza
function gestisciVista(hit) {
  // Clic su un pavimento: scelta della finitura (parquet, marmo)
  if (hit.kind === "pavimento") return gestisciDoppio(hit);
  // un clic su un muro: lo seleziona (spezzato agli incroci) e lo evidenzia, senza spostare la vista
  if (hit.kind && hit.kind.startsWith("muro")) {
    const sp = spezzaMuro(stato.progetto, hit.wall, hit.mm);
    if (sp.errore) return;
    if (sp.p !== stato.progetto) applica(sp.p);
    stato.viewer.setEvidenzaMuro(sp.id);
    return messaggio(`Muro ${sp.id} selezionato. Doppio clic per la scheda.`, "info");
  }
  if (hit.kind && hit.kind !== "pavimento") return;
  if (!hit.mm) return;
  const s = stanzaAPunto(hit.mm, stato.progetto);
  stato.viewer.setEvidenza(s ? s.interno : null);
  if (s) messaggio(`${s.id}: ${(s.superficieMm2 / 1e6).toFixed(2).replace(".", ",")} m²`, "info");
}

// Doppio clic: scheda dell'elemento (o della stanza), con le azioni possibili
function gestisciDoppio(hit) {
  let p = stato.progetto;
  // porte e finestre (qualsiasi pezzo dell'infisso) aprono la vista del vano; un muro, anche vicino a una porta, resta un muro
  const suMuroHit = !!hit.kind && hit.kind.startsWith("muro");
  const idVano = suMuroHit ? null : (hit.vano ?? (hit.kind && PEZZI_VANO.includes(hit.kind) ? String(hit.id).split(":")[0] : null));
  if (idVano && p.openings.some((o) => o.id === idVano)) return apriVistaFrontale(idVano);
  let tipo = null;
  let id = null;
  if (hit.kind && hit.kind.startsWith("muro")) {
    tipo = "muro";
    chiudiScheda();
    // spezza il muro agli incroci e evidenzia solo il tratto cliccato
    const sp = spezzaMuro(p, hit.wall, hit.mm);
    if (!sp.errore && sp.p !== p) { applica(sp.p); p = sp.p; }
    id = sp.errore ? hit.wall : sp.id;
    stato.viewer.setEvidenzaMuro(id);

  }
  else if (PEZZI_VANO.includes(hit.kind)) { tipo = "vano"; id = hit.id.split(":")[0]; }
  else if (hit.kind === "arredo") { tipo = "arredo"; id = hit.id; }
  else if (hit.kind === "pavimento") { tipo = "pavimento"; id = hit.id; }
  let dati = tipo ? descrivi(p, tipo, id) : null;
  if (!dati && hit.mm) {
    const s = stanzaAPunto(hit.mm, p);
    if (s) { tipo = "stanza"; id = s; dati = descrivi(p, "stanza", s); stato.viewer.setEvidenza(s.interno); }
  }
  if (!dati) return messaggio("Nessun elemento qui.", "info");
  const suMuro = tipo === "muro";
  apriScheda({ titolo: dati.titolo, portante: dati.portante, righe: dati.righe, azioni: dati.azioni, finiture: dati.finiture, tinte: dati.tinte, funzioni: dati.funzioni,
    destra: suMuro,
    onChiudi: suMuro ? () => stato.viewer.setEvidenzaMuro(null) : null,
  }, (az) => {
    const nuovo = eseguiAzione(p, tipo, id, az);
    if (!nuovo) return;
    applica(nuovo);
    stato.viewer.setEvidenza(null);
    messaggio(az.startsWith("finitura:") ? "Finitura applicata." : "Azione eseguita.", "ok");
  });
}


function gestisciClic(hit) {
  if (stato.modo !== "costruzione") { gestisciVista(hit); return; }
  // aggancio: vertici esistenti (entro 150 mm), angoli 0/45/90 dal punto in sospeso, poi griglia
  const agg = agganciaPunto(hit.mm, {
    griglia: stato.griglia,
    partenza: stato.pendente,
    tolleranza: 150,
    punti: puntiNotevoli(stato.progetto),
  });
  const p = agg.punto;
  const pr = stato.progetto;
  const errore = (e) => messaggio(e, "errore");
  try {
    switch (stato.strumento) {
      case "muro": {
        if (!stato.pendente) { stato.pendente = p; break; }
        if (p[0] === stato.pendente[0] && p[1] === stato.pendente[1]) break;
        const r = aggiungiMuro(pr, stato.pendente, p, stato.spessore);
        if (r.errore) return errore(r.errore);
        stato.pendente = p; // catena di muri: il secondo punto diventa il primo del successivo
        applica(r.p);
        break;
      }
      case "vano": {
        if (!hit.wall) return errore("Clicca su un muro per inserire il vano.");
        const muro = pr.walls.find((w) => w.id === hit.wall);
        const L = Math.hypot(muro.b[0] - muro.a[0], muro.b[1] - muro.a[1]);
        const larg = stato.larghezzaVano;
        let off = offsetSuMuro(hit.mm, muro) - Math.round(larg / 2);
        off = Math.max(0, Math.min(off, Math.round(L) - larg));
        const r = aggiungiVano(pr, muro.id, off, larg, stato.altezza, stato.sbalzo, stato.tipoVano);
        if (r.errore) return errore(r.errore);
        applica(r.p);
        break;
      }
      case "pavimento": {
        if (!stato.pendente) { stato.pendente = p; break; }
        const a = stato.pendente;
        const r = aggiungiPavimento(pr, Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.max(a[0], p[0]), Math.max(a[1], p[1]), stato.pavimento);
        stato.pendente = null;
        if (r.errore) return errore(r.errore);
        applica(r.p);
        break;
      }
      case "arredo": {
        const r = aggiungiArredo(pr, stato.arredo, p[0], p[1], stato.rotazione);
        if (r.errore) return errore(r.errore);
        applica(r.p);
        break;
      }
      case "sposta": {
        if (!stato.arredoSelezionato) {
          if (hit.kind === "arredo") stato.arredoSelezionato = hit.id;
          else messaggio("Clicca un arredo per selezionarlo, poi il punto di destinazione.", "info");
          break;
        }
        applica(spostaArredo(pr, stato.arredoSelezionato, p[0], p[1]));
        stato.arredoSelezionato = null;
        break;
      }
      case "elimina": {
        if (!hit.id) return;
        let id = hit.id;
        if (hit.kind && hit.kind.startsWith("muro")) id = hit.wall;
        else if (PEZZI_VANO.includes(hit.kind)) id = hit.id.split(":")[0];
        else if (hit.kind === "pavimento" || hit.kind === "arredo") id = hit.id;
        applica(eliminaElemento(pr, id));
        break;
      }
    }
  } catch (e) {
    errore(`Errore: ${e.message}`);
  }
  ricostruisci();
}

// ---- Pannello costruzione (inserito sopra gli strumenti di import) ----
function costruisciPannello() {
  const box = document.createElement("div");
  box.style.cssText = "border-top:1px solid #d5dbe3; margin-top:10px; padding-top:8px;";
  box.innerHTML = `
    <div><b>Modalità</b>
      <button data-modo="vista">Vista</button>
      <button data-modo="costruzione">Costruzione</button>
    </div>
    <div id="pannello-costruzione" style="display:none; margin-top:6px;">
      <div>Strumento:
        <select id="strumento">
          <option value="muro">Muro</option>
          <option value="vano">Vano (clic su un muro)</option>
          <option value="pavimento">Pavimento (2 clic)</option>
          <option value="arredo">Arredo</option>
          <option value="sposta">Sposta arredo</option>
          <option value="elimina">Elimina</option>
        </select>
      </div>
      <div>Griglia: <select id="griglia">
        <option value="0">libera (1 mm)</option><option value="10">10 mm</option><option value="50">50 mm</option><option value="100" selected>100 mm</option>
      </select></div>
      <div>Spessore muro (mm): <input id="spessore" type="number" value="250" step="2" style="width:80px"></div>
      <div>Altezza vano (mm): <input id="altezza" type="number" value="2100" style="width:80px"> Davanzale: <input id="sbalzo" type="number" value="0" style="width:60px"></div>
      <div>Tipo vano: <select id="tipo-vano"><option value="porta">porta</option><option value="finestra">finestra</option><option value="scorrevole">scorrevole</option></select>
        Larghezza: <input id="larg-vano" type="number" value="900" style="width:70px"></div>
      <div>Pavimento: <select id="pavimento">${Object.entries(MATERIALI_PAVIMENTO).map(([k, v]) => `<option value="${k}">${v.nome}</option>`).join("")}</select></div>
      <div>Arredo: <select id="arredo">${Object.entries(LIBRERIA_ARREDI).map(([k, v]) => `<option value="${k}">${v.nome}</option>`).join("")}</select>
        <button id="ruota">Ruota (R)</button></div>
      <div style="margin-top:6px; display:flex; gap:4px; flex-wrap:wrap;">
        <button id="annulla">Annulla (Ctrl+Z)</button>
        <button id="esc">Esc</button>
      </div>
    </div>
    <div style="margin-top:8px; display:flex; gap:4px; flex-wrap:wrap;">
      <button id="vista2d" class="switch-2d" role="switch" aria-checked="false"><span>3D</span><i class="knob"></i><span>2D</span></button>
      <button id="nuovo">Nuovo progetto (vuoto)</button>
      <button id="esempio">Apri esempio AR-02</button>
    </div>`;
  $("sez-costruzione").appendChild(box);
  $("sez-progetto-azioni").append($("nuovo"), $("esempio"));
  $("sez-vista").append($("vista2d"));
  const etMisure = document.createElement("div");
  etMisure.style.cssText = "margin-top:10px;";
  etMisure.textContent = "Misure in sovrimpressione:";
  const swMisure = document.createElement("button");
  swMisure.id = "misure-switch";
  swMisure.className = "switch-2d";
  swMisure.setAttribute("role", "switch");
  swMisure.setAttribute("aria-checked", "false");
  swMisure.innerHTML = '<span>OFF</span><i class="knob"></i><span>ON</span>';
  swMisure.onclick = () => {
    stato.misure = !stato.misure;
    swMisure.classList.toggle("on", stato.misure);
    swMisure.setAttribute("aria-checked", String(stato.misure));
    stato.viewer?.setMisureVisibili(stato.misure);
    aggiornaMisureVista();
  };
  // filtri: quali tipi di misure mostrare, e dimensione delle etichette
  const filtri = document.createElement("div");
  filtri.style.cssText = "margin-top:10px;";
  filtri.innerHTML = `<div>Mostra misure:</div>
    <label><input type="checkbox" data-f="muri" checked> Muri</label>
    <label><input type="checkbox" data-f="vani" checked> Vani</label>
    <label><input type="checkbox" data-f="stanze" checked> Stanze</label>
    <div style="margin-top:6px;">Dimensione etichette: <input id="misure-scala" type="range" min="60" max="200" value="100" style="width:140px"></div>`;
  filtri.querySelectorAll("[data-f]").forEach((c) => {
    c.onchange = () => {
      stato.filtriMisure = { muri: true, vani: true, stanze: true, ...(stato.filtriMisure ?? {}), [c.dataset.f]: c.checked };
      aggiornaMisureVista();
    };
  });
  filtri.querySelector("#misure-scala").oninput = (e) => stato.viewer?.setMisureScala(Number(e.target.value) / 100);
  $("sez-vista").append(etMisure, swMisure, filtri);
  const stileBox = document.createElement("div");
  stileBox.innerHTML = `<div>Stile di resa:</div><select id="stile">
        <option value="fotorealistico">1. Fotorealistico (PBR)</option>
        <option value="solido">2. Solido</option>
        <option value="argilla">3. Argilla (modello bianco)</option>
        <option value="vetro">4. Vetro (contorni)</option>
        <option value="ultra-glass">5. Ultra glass (senza contorni)</option>
        <option value="blueprint">6. Blueprint (cianografia)</option>
        <option value="notte">7. Notte (luci calde)</option>
        <option value="neon">8. Neon (contorni luminosi)</option>
        <option value="dollhouse">9. Dollhouse 1,30 m</option>
        <option value="iso-dollhouse">10. Isometrico dollhouse</option>
        <option value="vetro-dollhouse">11. Vetro + dollhouse</option>
      </select>`;
  $("sez-vista").appendChild(stileBox);
  const btnPasseggiata = document.createElement("button");
  btnPasseggiata.id = "btn-passeggiata";
  btnPasseggiata.textContent = "Passeggiata in prima persona";
  btnPasseggiata.onclick = () => {
    if (stato.viewer.passeggiataAttiva()) stato.viewer.esciPasseggiata();
    else {
      document.querySelector("aside")?.classList.add("chiuso"); // il pannello laterale non copre la vista
      stato.arredo?.seleziona(null); // in prima persona nessuna selezione resta attiva
      stato.viewer.avviaPasseggiata(stato.progetto);
      messaggio("Frecce o W A S D per camminare, trascina per guardare, Shift corre, Esc esce.", "info");
    }
  };
  stato.viewer.setPasseggiataHandler((on) => {
    btnPasseggiata.textContent = on ? "Esci dalla passeggiata (Esc)" : "Passeggiata in prima persona";
    aggiornaPrimaPersona(on);
  });
  $("sez-vista").appendChild(btnPasseggiata);

  for (const b of box.querySelectorAll("[data-modo]")) {
    b.onclick = () => {
      stato.modo = b.dataset.modo;
      $("pannello-costruzione").style.display = stato.modo === "costruzione" ? "block" : "none";
      stato.pendente = null;
      stato.arredoSelezionato = null;
      messaggio(stato.modo === "costruzione" ? "Costruzione: scegli lo strumento." : "Vista.", "info");
    };
  }
  $("stile").onchange = (e) => stato.viewer.setStile(e.target.value);
  $("strumento").onchange = (e) => { stato.strumento = e.target.value; stato.pendente = null; stato.arredoSelezionato = null; };
  $("griglia").onchange = (e) => { stato.griglia = Number(e.target.value); };
  $("spessore").onchange = (e) => { stato.spessore = Number(e.target.value); };
  $("altezza").onchange = (e) => { stato.altezza = Number(e.target.value); };
  $("sbalzo").onchange = (e) => { stato.sbalzo = Number(e.target.value); };
  $("tipo-vano").onchange = (e) => { stato.tipoVano = e.target.value; };
  $("larg-vano").onchange = (e) => { stato.larghezzaVano = Number(e.target.value); };
  $("pavimento").onchange = (e) => { stato.pavimento = e.target.value; };
  $("arredo").onchange = (e) => { stato.arredo = e.target.value; };
  $("ruota").onclick = () => { stato.rotazione = (stato.rotazione + 90) % 360; messaggio(`Rotazione arredo: ${stato.rotazione}°`, "info"); };
  $("annulla").onclick = annullaUltimo;
  $("esc").onclick = () => { stato.pendente = null; stato.arredoSelezionato = null; ricostruisci(); };
  $("nuovo").onclick = () => caricaProgetto(progettoVuoto(), "nuovo", { origine: "vuoto" });
  $("vista2d").onclick = () => {
    stato.vista2d = !stato.vista2d;
    aggiornaVista2d();
  };
  $("esempio").onclick = () => apriEsempio();
}

// Esempio AR-02: solo muri e vani (senza pavimenti e arredi).
async function apriEsempio() {
  const p = await fetch("data/plan-ar02.json?v=v20261020ap").then((r) => r.json());
  caricaProgetto({ ...p, floors: [], furniture: [] }, "esempio", { origine: "esempio" });
}

async function init() {
  stato.viewer = createViewer($("vista"));
  stato.catalogo = await fetch("data/cdi-catalog.json?v=v20261020ap").then((r) => r.json());
  costruisciPannello();
  montaGSA($("sez-gsa-incendio"));
  stato.arredo = montaArredo({
    box: $("sez-arredi"),
    viewer: stato.viewer,
    contenitore: $("vista"),
    getProgetto: () => stato.progetto,
    applica: (nuovo) => applica(nuovo),
    tintaMuroAlPunto: (mm, tinta) => {
      const id = muroAPunto(stato.progetto, mm);
      if (!id) return null;
      const r = spezzaMuro(stato.progetto, id, mm);
      if (r.errore) return null;
      const t = impostaTintaMuro(r.p, r.id, tinta);
      return t.p ?? null;
    },
    pavimentoAlPunto: (mm, materiale) => {
      const s = mm ? stanzaAPunto(mm, stato.progetto) : null;
      if (!s) return null;
      return impostaPavimentoStanza(stato.progetto, s.interno, materiale).p ?? null;
    },
    messaggio,
  });
  montaAutomatismi();
  // Telefono: il pannello laterale ha la sua X per chiuderlo
  const pannelloLaterale = document.querySelector("aside");
  if (pannelloLaterale && !pannelloLaterale.querySelector(".aside-chiudi")) {
    const x = document.createElement("button");
    x.className = "aside-chiudi";
    x.textContent = "✕";
    x.setAttribute("aria-label", "Chiudi il pannello");
    x.onclick = () => pannelloLaterale.classList.add("chiuso");
    pannelloLaterale.prepend(x);
  }
  montaLegenda();
  montaPrimaPersona();
  if (TATTILE) montaManopole();
  stato.energia = montaScheda($("sez-energia"), {
    getRigheGSA: () => calcolaGSA(stato.progetto, {
      orientamenti: stato.orientamenti ?? {},
      Fsh: stato.gsaFsh ?? 1,
      Ff: stato.gsaFf ?? 0.8,
      nordGradi: stato.nordGradi ?? 0,
    }).righe,
    onCambio: () => aggiornaAffidabilita(),
  });
  // il menu degli stili parte dallo stile attivo nella vista
  $("stile").value = stato.viewer.statistiche().stile;
  const q = document.createElement("div");
  q.innerHTML = `<div style="margin-top:8px;">Qualità di resa:
      <select id="qualita"><option value="auto">Automatica (consigliata)</option><option value="basso">Basso (PC lenti)</option><option value="medio">Medio</option><option value="alto">Alto</option></select>
    </div>
    <div id="statistiche" class="hud-stat avanzato" style="margin-top:8px;"></div>`;
  $("sez-vista").appendChild(q);
  $("qualita").onchange = (e) => stato.viewer.setQualita(e.target.value);
  setInterval(() => {
    const st = stato.viewer?.statistiche();
    if (st) $("statistiche").textContent = `Qualità ${st.livello} · ${st.fps ? `${st.fps} fps` : "ferma (disegna solo quando muovi la vista)"} · ${st.chiamate} gruppi · ${st.triangoli.toLocaleString("it-IT")} triangoli`;
  }, 1000);
  // con il secchiello attivo il clic riempie pavimento o muro; altrimenti vale il normale strumento
  stato.viewer.setPickHandler((hit) => { if (stato.arredo?.riempi(hit)) return; gestisciClic(hit); });
  stato.viewer.setDoppioClicHandler(gestisciDoppio);
  // Il menu del browser non si apre su tutta l'app: il tasto destro e' dell'editor 3D (campi di testo esclusi)
  document.addEventListener("contextmenu", (ev) => {
    if (!ev.target.closest?.("input, textarea, [contenteditable]")) ev.preventDefault();
  });
  stato.viewer.setHoverHandler((mm) => hud?.coordinate(mm));
  hud = montaHud({
    onScheda: (id) => {
      const aside = document.querySelector("aside");
      stato.arredo?.attiva(id === "arredi");
      if (id === "vista") { stato.modo = "vista"; $("pannello-costruzione").style.display = "none"; }
      if (id === "stile") aside.classList.remove("chiuso");
    },
    onStrumento: (id) => {
      stato.strumento = id;
      stato.pendente = null;
      stato.arredoSelezionato = null;
      $("strumento").value = id;
      hud.evidenziaStrumento(id);
    },
    onModo: (m) => {
      if (m === "costruzione") document.querySelector("[data-modo=costruzione]").click();
      else document.querySelector("[data-modo=vista]").click();
    },
    onVista2d: () => $("vista2d").click(),
  });
  // Telefono: le schede stanno in un menu hamburger in alto
  const barraAlta = document.querySelector(".hud-top");
  const schede = barraAlta?.querySelector(".hud-tabs");
  if (barraAlta && schede && !barraAlta.querySelector(".hud-burger")) {
    const burger = document.createElement("button");
    burger.className = "hud-burger";
    burger.textContent = "☰";
    burger.title = "Menu";
    burger.setAttribute("aria-label", "Apri il menu delle schede");
    burger.setAttribute("aria-expanded", "false");
    burger.onclick = () => {
      const aperto = barraAlta.classList.toggle("menu-aperto");
      burger.setAttribute("aria-expanded", String(aperto));
    };
    schede.addEventListener("click", () => {
      barraAlta.classList.remove("menu-aperto");
      burger.setAttribute("aria-expanded", "false");
    });
    barraAlta.prepend(burger);
  }
  aggiornaVista2d(); // etichette ON/OFF anche nella barra in alto

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { stato.pendente = null; stato.arredoSelezionato = null; ricostruisci(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); annullaUltimo(); }
    if (e.key.toLowerCase() === "r" && stato.modo === "costruzione") { stato.rotazione = (stato.rotazione + 90) % 360; }
  });

  // Avvio: esempio AR-02 completo (pavimento e arredi di esempio). "Nuovo progetto" parte vuoto.
  await apriEsempio();

  montaTracciamento(document.getElementById("trc-root"), {
    onPianta: (p) => caricaProgetto(p, "tracciata su immagine", { origine: "immagine" }),
  });

  $("carica").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      caricaProgetto(JSON.parse(await file.text()), file.name, { origine: "json" });
    } catch (e) {
      messaggio(`File non leggibile come JSON: ${e.message}`, "errore");
    }
  });

  $("dxf").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const parsed = parseDxf(await file.text());
      const { plan, check, report } = dxfToPlan(parsed, {
        riferimento: $("dxf-rif").value,
        spessoreDefault: Number($("dxf-t").value),
        nome: file.name,
      });
      const righe = [
        { tipo: "ok", testo: `DXF letto: ${report.entita} entità (${report.linee} linee, ${report.polilinee} polilinee), ${report.muri} muri.` },
        { tipo: "info", testo: `Unità del file: ${report.unita ?? "non dichiarate"} • riferimento: ${$("dxf-rif").value}.` },
      ];
      if (report.arrotondamenti > 0) righe.push({ tipo: "avviso", testo: `${report.arrotondamenti} valori arrotondati a mm intero (scarto massimo ${report.scostamento_max_mm.toFixed(3)} mm).` });
      for (const a of report.avvisi) righe.push({ tipo: "avviso", testo: a });
      for (const e of check.errors) righe.push({ tipo: "errore", testo: `ERRORE: ${e}` });
      scrivi(righe);
      if (check.ok) caricaProgetto(plan, file.name, { origine: "dxf", dxfReport: report });
      else messaggio("DXF non importato: correggi gli errori.", "errore");
    } catch (e) {
      messaggio(`DXF non leggibile: ${e.message}`, "errore");
    }
  });

  // Strumenti antincendio (modalità Architetto): scheda ambiti e rapporto per il professionista
  const sezAnt = document.createElement("div");
  sezAnt.className = "blocco avanzato";
  sezAnt.innerHTML = `<h2>Antincendio (DM 3/8/2015)</h2>
    <div class="riga-azioni"><label>Scheda ambiti (JSON): <input id="ant-file" type="file" accept=".json,application/json"></label></div>
    <div class="riga-azioni"><button id="ant-rapporto">Genera rapporto (JSON)</button></div>
    <div id="ant-esito" class="hud-stat"></div>`;
  document.querySelector('[data-scheda="progetto"]').appendChild(sezAnt);
  $("ant-file").addEventListener("change", async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      stato.schedaAnt = { assegnazioni: {}, quote: [], ...JSON.parse(await f.text()) };
      $("ant-esito").textContent = `Scheda caricata: ${Object.keys(stato.schedaAnt.assegnazioni).length} stanze assegnate, ${stato.schedaAnt.quote.length} quote.`;
      aggiornaAffidabilita();
    } catch (e) {
      $("ant-esito").textContent = `Scheda non leggibile: ${e.message}`;
    }
  });
  $("ant-rapporto").addEventListener("click", () => {
    const r = rapportoAntincendio([{ piano: "P0", plan: stato.progetto }], stato.schedaAnt.assegnazioni, stato.schedaAnt.quote);
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rapporto-antincendio.json";
    a.click();
    $("ant-esito").textContent = `Superficie lorda totale: ${r.superficieLordaTotaleM2.toFixed(2)} m² • ambiti incompleti: ${r.incompleti.length}`;
  });

  $("scarica").addEventListener("click", () => {
    const out = structuredClone(stato.progetto);
    for (const o of out.openings) {
      if (Object.prototype.hasOwnProperty.call(stato.assegnazioni, o.id)) o.cdi = stato.assegnazioni[o.id];
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "progetto-mm.json";
    a.click();
  });
}

init().catch((e) => messaggio(`Errore di avvio: ${e.message}`, "errore"));
