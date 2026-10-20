// Pannello "Infissi CDI" a destra della vista frontale di un vano: schede del catalogo filtrate per tipo di vano,
// compatibilita', scheda tecnica e montaggio con un clic. Stile da videogioco: vetro, animazioni, suoni leggeri.
import { modelliPerVano, NOMI_CATEGORIA } from "../core/catalogo.js?v=v20261020by";
import { partiInfisso } from "../core/infissi3d.js?v=v20261020by";
import { gruppoInfisso, miniatura } from "../view/modelli3d.js?v=v20261020by";

let audio = null;
let muto = false;
try { muto = localStorage.getItem("cantieri-muto") === "1"; } catch { /* nessun archivio */ }
function suono(freq = 660, durata = 0.06, volume = 0.04) {
  if (muto) return;
  try {
    audio = audio ?? new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(volume, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + durata);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + durata);
  } catch { /* audio non disponibile */ }
}
export { suono };

function el(tag, cls, testo) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (testo !== undefined) e.textContent = testo;
  return e;
}

// Miniatura per i modelli senza foto: l'infisso disegnato dal motore 3D
function anteprima(item, op) {
  if (item.image) return Promise.resolve(item.image);
  const campione = { ...op, id: "anteprima", offset: 0 };
  const muro = { id: "m", a: [0, 0], b: [op.width, 0], t: 300 };
  return miniatura(`infisso:${item.id}:${op.type}`, () => gruppoInfisso(partiInfisso(campione, 300, item), campione, muro, {}));
}

const VALORI = [
  ["linea", "Linea"], ["profilo_mm", "Profilo (mm)"], ["uw", "Uw (W/m²K)"], ["ud", "Ud (W/m²K)"], ["rw_db", "Isolamento acustico Rw (dB)"],
  ["classe_aria", "Permeabilità all'aria"], ["classe_acqua", "Tenuta all'acqua"], ["classe_vento", "Resistenza al vento"],
  ["sicurezza", "Sicurezza"], ["maniglia", "Maniglia"], ["cerniere", "Cerniere"], ["vetro", "Vetro"],
];

// opzioni: { op, wall, catalogo, assegnato (id o null), esterno, onScegli(id|null), onChiudi() }
export function apriDockInfissi(opz) {
  chiudiDockInfissi(true);
  const { op, catalogo, onScegli, onChiudi } = opz;
  let assegnato = opz.assegnato ?? null;
  const gruppi = modelliPerVano(catalogo, op, { esterno: opz.esterno });
  let catAttiva = gruppi.find((g) => g.modelli.some((m) => m.item.id === assegnato))?.categoria ?? gruppi[0].categoria;
  let dettaglio = assegnato;

  const dock = el("aside", "dock-infissi");
  dock.setAttribute("role", "dialog");
  dock.setAttribute("aria-label", `Infissi CDI per il vano ${op.id}`);
  const testa = el("div", "dock-testa");
  const tit = el("div");
  tit.append(el("div", "dock-sopra", `Vano · ${op.type}`), el("div", "dock-titolo", op.id), el("div", "dock-misure", `${op.width} × ${op.height} mm · davanzale ${op.sill} mm`));
  const bottoni = el("div", "dock-bottoni");
  const btnMuto = el("button", "dock-muto", muto ? "🔇" : "🔊");
  btnMuto.title = "Suoni on/off";
  btnMuto.onclick = () => { muto = !muto; btnMuto.textContent = muto ? "🔇" : "🔊"; try { localStorage.setItem("cantieri-muto", muto ? "1" : "0"); } catch { /* */ } };
  const btnChiudi = el("button", "dock-chiudi", "✕");
  btnChiudi.title = "Chiudi (Esc)";
  btnChiudi.setAttribute("aria-label", "Chiudi il pannello degli infissi");
  btnChiudi.onclick = () => chiudi();
  bottoni.append(btnMuto, btnChiudi);
  testa.append(tit, bottoni);
  const tabs = el("div", "dock-tabs");
  const griglia = el("div", "dock-griglia");
  const scheda = el("div", "dock-dettaglio");
  dock.append(testa, tabs, griglia, scheda);
  document.body.appendChild(dock);
  requestAnimationFrame(() => dock.classList.add("aperto"));
  suono(520, 0.08);

  function disegnaTabs() {
    tabs.innerHTML = "";
    for (const g of gruppi) {
      const b = el("button", `dock-tab${g.categoria === catAttiva ? " attiva" : ""}`, `${g.nome} (${g.modelli.length})`);
      b.onclick = () => { catAttiva = g.categoria; suono(760, 0.04); disegnaTabs(); disegnaGriglia(); };
      tabs.append(b);
    }
  }

  function disegnaGriglia() {
    griglia.innerHTML = "";
    const vuota = el("button", `dock-card vuota${assegnato === null ? " montato" : ""}`);
    vuota.append(el("div", "dock-card-img vuoto-img", "∅"), el("div", "dock-card-nome", "Vano senza infisso"), el("div", "dock-card-linea", "solo il foro nel muro"));
    vuota.onclick = () => scegli(null);
    griglia.append(vuota);
    const g = gruppi.find((x) => x.categoria === catAttiva);
    g.modelli.forEach((m, i) => {
      const c = el("button", `dock-card ${m.stato}${m.item.id === assegnato ? " montato" : ""}${m.item.id === dettaglio ? " selezionato" : ""}`);
      c.style.animationDelay = `${i * 35}ms`;
      c.disabled = m.stato === "no";
      const img = el("div", "dock-card-img");
      const im = el("img");
      im.alt = m.item.nome;
      im.loading = "lazy";
      img.append(im);
      anteprima(m.item, op).then((src) => { if (src) im.src = src; });
      if (m.item.id === assegnato) img.append(el("span", "dock-nastro", "MONTATO"));
      const valori = el("div", "dock-card-valori");
      if (m.item.uw != null) valori.append(el("span", "chip", `Uw ${String(m.item.uw).replace(".", ",")}`));
      if (m.item.ud != null) valori.append(el("span", "chip", `Ud ${String(m.item.ud).replace(".", ",")}`));
      if (m.item.rw_db != null) valori.append(el("span", "chip", `${m.item.rw_db} dB`));
      if (m.stato === "avviso") valori.append(el("span", "chip avviso", "verifica"));
      c.append(img, el("div", "dock-card-nome", m.item.nome), el("div", "dock-card-linea", m.item.linea ?? NOMI_CATEGORIA[m.item.categoria]), valori);
      c.onmouseenter = () => suono(980, 0.025, 0.015);
      c.onclick = () => { dettaglio = m.item.id; disegnaDettaglio(); scegli(m.item.id); };
      griglia.append(c);
    });
  }

  function disegnaDettaglio() {
    scheda.innerHTML = "";
    const g = gruppi.flatMap((x) => x.modelli).find((m) => m.item.id === dettaglio);
    if (!g) { scheda.append(el("div", "dock-vuoto", "Scegli un modello: si monta subito nel vano.")); return; }
    const it = g.item;
    scheda.append(el("div", "dock-det-nome", it.nome));
    if (it.descrizione) scheda.append(el("div", "dock-det-desc", it.descrizione));
    const tab = el("div", "dock-det-tab");
    for (const [k, nome] of VALORI) {
      if (it[k] == null || it[k] === "") continue;
      const r = el("div", "dock-det-riga");
      r.append(el("span", "", nome), el("b", "", String(it[k]).replace(/^(\d+)\.(\d+)$/, "$1,$2")));
      tab.append(r);
    }
    scheda.append(tab);
    for (const n of g.note) scheda.append(el("div", `dock-nota ${g.stato}`, `• ${n}`));
    if (it.fonte) scheda.append(el("div", "dock-fonte", `Fonte dei dati: ${it.fonte}`));
  }

  function scegli(id) {
    if (id === assegnato) return;
    assegnato = id;
    suono(id ? 880 : 440, 0.09, 0.05);
    onScegli?.(id);
    disegnaGriglia();
    disegnaDettaglio();
  }

  const tasti = (e) => { if (e.key === "Escape") { e.stopPropagation(); chiudi(); } };
  window.addEventListener("keydown", tasti, true);
  function chiudi(silenzioso = false) {
    window.removeEventListener("keydown", tasti, true);
    dock.classList.remove("aperto");
    setTimeout(() => dock.remove(), 260);
    if (!silenzioso) { suono(400, 0.07); onChiudi?.(); }
    attivo = null;
  }
  attivo = { chiudi };
  disegnaTabs();
  disegnaGriglia();
  disegnaDettaglio();
  return attivo;
}

let attivo = null;
export function chiudiDockInfissi(silenzioso = false) {
  if (attivo) attivo.chiudi(silenzioso);
}
export function dockAperto() {
  return !!attivo;
}
