// HUD in stile videogioco: barra a schede, hotbar degli strumenti, coordinate, notifiche.
// Non contiene logica del progetto: aziona i controlli esistenti (modalita', strumento, stile, 2D).

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
  { id: "vista", nome: "Vista" },
  { id: "stile", nome: "Stile" },
];

export function montaHud({ onScheda, onStrumento, onModo, onVista2d } = {}) {
  const radice = document.body;

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
    b.onclick = () => { impostaScheda(s.id); onScheda?.(s.id); };
    tabs.appendChild(b);
  }
  top.appendChild(tabs);
  const spazio = document.createElement("div");
  spazio.className = "hud-spacer";
  top.appendChild(spazio);
  const chip2d = document.createElement("button");
  chip2d.className = "hud-chip";
  chip2d.id = "hud-2d";
  chip2d.textContent = "Pianta 2D";
  chip2d.onclick = () => { chip2d.classList.toggle("on"); onVista2d?.(); };
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

  // Coordinate
  const coord = document.createElement("div");
  coord.className = "hud-coord";
  coord.id = "hud-coord";
  coord.innerHTML = "X <b>—</b> · Y <b>—</b> mm";
  radice.appendChild(coord);

  // Notifiche
  const toasts = document.createElement("div");
  toasts.className = "hud-toasts";
  radice.appendChild(toasts);

  // Cassetto: apri/chiudi con la scheda "Progetto" o con il tasto Tab
  const aside = document.querySelector("aside");

  function impostaScheda(id) {
    for (const b of tabs.querySelectorAll(".hud-tab")) b.classList.toggle("attiva", b.dataset.scheda === id);
    if (id === "progetto") aside.classList.remove("chiuso");
    if (id === "costruzione") { aside.classList.remove("chiuso"); onModo?.("costruzione"); }
    if (id === "vista") { onModo?.("vista"); }
  }

  function selezionaStrumento(id) {
    for (const b of barra.querySelectorAll(".hud-slot")) b.classList.toggle("attivo", b.dataset.strumento === id);
    onModo?.("costruzione");
    onStrumento?.(id);
    impostaScheda("costruzione");
  }

  window.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, select, textarea")) return;
    const s = SLOT.find((x) => x.tasto === e.key);
    if (s) selezionaStrumento(s.id);
    if (e.key === "Tab") { e.preventDefault(); aside.classList.toggle("chiuso"); }
  });

  impostaScheda("progetto");
  if (aside) aside.classList.add("chiuso");

  return {
    coordinate(mm) {
      const el = document.getElementById("hud-coord");
      if (!el) return;
      el.innerHTML = mm
        ? `X <b>${mm[0].toLocaleString("it-IT")}</b> · Y <b>${mm[1].toLocaleString("it-IT")}</b> mm`
        : "X <b>—</b> · Y <b>—</b> mm";
    },
    toast(testo, tipo = "info") {
      const t = document.createElement("div");
      t.className = `hud-toast ${tipo}`;
      t.textContent = testo;
      toasts.appendChild(t);
      setTimeout(() => t.classList.add("esce"), 3600);
      setTimeout(() => t.remove(), 4000);
      while (toasts.children.length > 4) toasts.firstChild.remove();
    },
    evidenziaStrumento: (id) => { for (const b of barra.querySelectorAll(".hud-slot")) b.classList.toggle("attivo", b.dataset.strumento === id); },
  };
}
