// HUD: barra a schede (ogni scheda mostra il suo pannello), modalita' Semplice / Architetto,
// hotbar degli strumenti, coordinate in mm, notifiche. Non contiene logica del progetto.

const ICONE = {
  muro: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="6" rx="1"/></svg>',
  vano: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M9 20v-8h6v8"/></svg>',
  pavimento: '<svg viewBox="0 0 24 24"><path d="M3 15l9-5 9 5-9 5z"/><path d="M3 19l9-5 9 5"/></svg>',
  arredo: '<svg viewBox="0 0 24 24"><path d="M4 11h16v5H4z"/><path d="M6 16v3M18 16v3M4 11V8h16v3"/></svg>',
  sposta: '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
  elimina: '<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/></svg>',
};

const SLOT = [
  { id: "muro", nome: "Muro", tasto: "1" },
  { id: "vano", nome: "Vano", tasto: "2" },
  { id: "pavimento", nome: "Pavimento", tasto: "3" },
  { id: "arredo", nome: "Arredo", tasto: "4" },
  { id: "sposta", nome: "Sposta", tasto: "5" },
  { id: "elimina", nome: "Elimina", tasto: "6" },
];

const SCHEDE = [
  { id: "progetto", nome: "Progetto" },
  { id: "costruzione", nome: "Costruzione" },
  { id: "gsa", nome: "GSA" },
  { id: "vista", nome: "Vista" },
];

let ultimo = null;

export function montaHud({ onScheda, onStrumento, onModo, onVista2d, onModalita } = {}) {
  const radice = document.body;
  const aside = document.querySelector("aside");
  const sezioni = [...document.querySelectorAll(".scheda")];

  // Barra superiore
  const top = document.createElement("div");
  top.className = "hud-top";
  top.innerHTML = `<div class="hud-logo">CANTIERI · MOTORE 3D</div>`;
  const tabs = document.createElement("div");
  tabs.className = "hud-tabs";
  for (const s of SCHEDE) {
    const b = document.createElement("button");
    b.className = "hud-tab";
    b.dataset.scheda = s.id;
    b.textContent = s.nome;
    b.onclick = () => apriScheda(s.id);
    tabs.appendChild(b);
  }
  top.appendChild(tabs);
  const spazio = document.createElement("div");
  spazio.className = "hud-spacer";
  top.appendChild(spazio);

  // Selettore di modalita': Semplice (amichevole) / Architetto (avanzata)
  const mod = document.createElement("div");
  mod.className = "hud-mode";
  for (const [id, nome] of [["semplice", "Semplice"], ["architetto", "Architetto"]]) {
    const b = document.createElement("button");
    b.dataset.modo = id;
    b.textContent = nome;
    b.onclick = () => impostaModalita(id);
    mod.appendChild(b);
  }
  top.appendChild(mod);
  const chip2d = document.createElement("button");
  chip2d.className = "switch-2d";
  chip2d.id = "hud-2d";
  chip2d.setAttribute("role", "switch");
  chip2d.setAttribute("aria-checked", "false");
  chip2d.innerHTML = '<span>3D</span><i class="knob"></i><span>2D</span>';
  chip2d.onclick = () => onVista2d?.();
  top.appendChild(chip2d);
  radice.appendChild(top);

  // Hotbar inferiore
  const barra = document.createElement("div");
  barra.className = "hud-hotbar";
  for (const s of SLOT) {
    const b = document.createElement("button");
    b.className = "hud-slot";
    b.dataset.strumento = s.id;
    b.innerHTML = `<span class="tasto">${s.tasto}</span>${ICONE[s.id]}<span>${s.nome}</span>`;
    b.onclick = () => selezionaStrumento(s.id);
    barra.appendChild(b);
  }
  radice.appendChild(barra);

  const coord = document.createElement("div");
  coord.className = "hud-coord";
  coord.id = "hud-coord";
  coord.innerHTML = "X <b>—</b> · Y <b>—</b> mm";
  radice.appendChild(coord);

  const toasts = document.createElement("div");
  toasts.className = "hud-toasts";
  radice.appendChild(toasts);

  // Scheda attiva: mostra solo il suo pannello e apre il cassetto
  function apriScheda(id) {
    for (const b of tabs.querySelectorAll(".hud-tab")) b.classList.toggle("attiva", b.dataset.scheda === id);
    for (const s of sezioni) s.classList.toggle("attiva", s.dataset.scheda === id);
    aside?.classList.remove("chiuso");
    if (id === "costruzione") onModo?.("costruzione");
    if (id === "vista") onModo?.("vista");
    onScheda?.(id);
  }

  function selezionaStrumento(id) {
    for (const b of barra.querySelectorAll(".hud-slot")) b.classList.toggle("attivo", b.dataset.strumento === id);
    onStrumento?.(id);
    apriScheda("costruzione");
  }

  function impostaModalita(id) {
    radice.classList.toggle("modo-semplice", id === "semplice");
    radice.classList.toggle("modo-architetto", id === "architetto");
    for (const b of mod.querySelectorAll("button")) b.classList.toggle("on", b.dataset.modo === id);
    onModalita?.(id);
    if (id === "semplice") {
      // in Semplice si nasconde il controllo avanzato, ma la scheda attiva resta
    }
  }

  window.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, select, textarea")) return;
    const s = SLOT.find((x) => x.tasto === e.key);
    if (s) selezionaStrumento(s.id);
    if (e.key === "Tab") { e.preventDefault(); aside?.classList.toggle("chiuso"); }
  });

  impostaModalita("semplice");
  apriScheda("progetto");
  aside?.classList.add("chiuso");

  return {
    coordinate(mm) {
      const el = document.getElementById("hud-coord");
      if (!el) return;
      el.innerHTML = mm
        ? `X <b>${mm[0].toLocaleString("it-IT")}</b> · Y <b>${mm[1].toLocaleString("it-IT")}</b> mm`
        : "X <b>—</b> · Y <b>—</b> mm";
    },
    toast(testo, tipo = "info") {
      // niente doppioni: stesso testo entro 1,5 secondi viene mostrato una volta sola
      const ora = Date.now();
      if (ultimo && ultimo.testo === testo && ora - ultimo.t < 1500) return;
      ultimo = { testo, t: ora };
      const t = document.createElement("div");
      t.className = `hud-toast ${tipo}`;
      t.textContent = testo;
      toasts.appendChild(t);
      setTimeout(() => t.classList.add("esce"), 3600);
      setTimeout(() => t.remove(), 4000);
      while (toasts.children.length > 4) toasts.firstChild.remove();
    },
    evidenziaStrumento: (id) => { for (const b of barra.querySelectorAll(".hud-slot")) b.classList.toggle("attivo", b.dataset.strumento === id); },
    apriScheda,
    impostaModalita,
  };
}
