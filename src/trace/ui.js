// Interfaccia del tracciamento su immagine: canvas, clic, overlay, esporta e invia al 3D.
import { nuovoStato, calibra, clicMuro, clicVano, annulla, annullaPunto, toPlan, mmToPx } from "./tracer.js?v=v20261020bp";
import { validatePlan } from "../core/model.js?v=v20261020bp";

export function montaTracciamento(root, { onPianta }) {
  let stato = nuovoStato({ spessore: 250, altezza: 2800, snapMm: 10 });
  let img = null;
  let modo = "calibra"; // calibra0 | calibra1 | calibra2 | muro | vano
  let punti = []; // clic di calibrazione in attesa (px)
  const $ = (sel) => root.querySelector(sel);
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const stato_txt = $(".trc-stato");

  function aggiornaInfo(msg) {
    const v = validatePlan(toPlan(stato));
    const errori = v.errors.length ? ` • errori: ${v.errors.length}` : "";
    const avvisi = v.warnings.length ? ` • avvisi: ${v.warnings.length}` : "";
    stato_txt.textContent = `${msg ?? ""} Muri: ${stato.muri.length} • Vani: ${stato.vani.length}${errori}${avvisi}`;
  }

  function disegna() {
    if (!img) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.style.height = "auto";
    ctx.drawImage(img, 0, 0);
    ctx.lineCap = "round";
    if (stato.cal) {
      for (const w of stato.muri) {
        const a = mmToPx(w.a, stato.cal);
        const b = mmToPx(w.b, stato.cal);
        ctx.strokeStyle = "rgba(30,64,175,0.9)";
        ctx.lineWidth = Math.max(2, (w.t / stato.cal.mmPerPx));
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      for (const v of stato.vani) {
        const w = stato.muri.find((m) => m.id === v.wall);
        if (!w) continue;
        const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
        const ux = (w.b[0] - w.a[0]) / L;
        const uy = (w.b[1] - w.a[1]) / L;
        const p1 = mmToPx([w.a[0] + ux * v.offset, w.a[1] + uy * v.offset], stato.cal);
        const p2 = mmToPx([w.a[0] + ux * (v.offset + v.width), w.a[1] + uy * (v.offset + v.width)], stato.cal);
        ctx.strokeStyle = "rgba(234,88,12,0.95)";
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
      }
    }
    ctx.fillStyle = "#dc2626";
    for (const p of punti) { ctx.beginPath(); ctx.arc(p[0], p[1], 6, 0, Math.PI * 2); ctx.fill(); }
    if (stato.pending && stato.cal) {
      const q = mmToPx(stato.pending, stato.cal);
      ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, Math.PI * 2); ctx.fillStyle = "#16a34a"; ctx.fill();
    }
  }

  function daClic(ev) {
    const r = canvas.getBoundingClientRect();
    const k = canvas.width / r.width;
    return [(ev.clientX - r.left) * k, (ev.clientY - r.top) * k];
  }

  function istruzioni() {
    const testi = {
      calibra0: "Calibrazione 1/3: clicca l'angolo di origine.",
      calibra1: "Calibrazione 2/3: clicca un secondo punto di cui conosci la distanza.",
      calibra2: "Calibrazione: inserisci la distanza reale in mm.",
      muro: "Muro: due clic per segmento (Esc chiude il segmento in sospeso).",
      vano: "Vano: due clic sullo stesso muro.",
    };
    return testi[modo];
  }

  canvas.addEventListener("click", (ev) => {
    if (!img) return;
    const p = daClic(ev);
    try {
      if (modo === "calibra0") { punti = [p]; modo = "calibra1"; }
      else if (modo === "calibra1") {
        punti = [punti[0], p];
        const dist = Number($("#trc-dist").value);
        if (!Number.isInteger(dist) || dist <= 0) { punti = []; modo = "calibra0"; aggiornaInfo("Distanza non valida: ricalibra."); disegna(); return; }
        stato = calibra(stato, punti[0], punti[1], dist);
        punti = [];
        modo = "muro";
      } else if (modo === "muro") {
        stato = clicMuro(stato, p);
      } else if (modo === "vano") {
        const tipo = $("#trc-tipo").value;
        const h = Number($("#trc-altezza").value);
        const sill = Number($("#trc-sill").value);
        stato = clicVano(stato, p, tipo, h, sill);
        if (stato.errore) aggiornaInfo(stato.errore);
      }
    } catch (e) {
      aggiornaInfo(`Errore: ${e.message}`);
    }
    aggiornaInfo(istruzioni());
    disegna();
  });

  $("#trc-file").addEventListener("change", (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    img = new Image();
    img.onload = () => {
      stato = nuovoStato({ spessore: Number($("#trc-spessore").value), altezza: Number($("#trc-altezza-muri").value), snapMm: 10 });
      punti = [];
      modo = "calibra0";
      aggiornaInfo(istruzioni());
      disegna();
    };
    img.src = url;
  });

  const bottoni = {
    "#trc-calibra": () => { stato = { ...stato, cal: null, pending: null, pendingVano: null }; punti = []; modo = "calibra0"; },
    "#trc-muro": () => { if (stato.cal) modo = "muro"; },
    "#trc-vano": () => { if (stato.cal) modo = "vano"; },
    "#trc-annulla": () => { stato = annulla(stato); },
    "#trc-esc": () => { stato = annullaPunto(stato); punti = []; },
  };
  for (const [sel, fn] of Object.entries(bottoni)) {
    $(sel).addEventListener("click", () => {
      fn();
      aggiornaInfo(istruzioni());
      disegna();
    });
  }

  // Zoom: lo schermo diventa piu' fine rispetto all'immagine; la precisione in mm resta quella dell'immagine.
  const larghezzaBase = () => root.querySelector(".trc-wrap").clientWidth;
  $("#trc-zoom").addEventListener("input", (ev) => {
    canvas.style.width = `${larghezzaBase() * Number(ev.target.value)}px`;
  });

  $("#trc-spessore").addEventListener("change", (ev) => { stato = { ...stato, spessore: Number(ev.target.value) }; });
  $("#trc-altezza-muri").addEventListener("change", (ev) => { stato = { ...stato, altezza: Number(ev.target.value) }; });
  $("#trc-snap").addEventListener("change", (ev) => { stato = { ...stato, snapMm: Number(ev.target.value) }; });

  $("#trc-invia").addEventListener("click", () => {
    const plan = toPlan(stato, "Planimetria tracciata su immagine");
    const v = validatePlan(plan);
    if (!v.ok) { aggiornaInfo(`Non inviato: ${v.errors[0]}`); return; }
    onPianta(plan);
    aggiornaInfo("Inviato al modello 3D.");
  });

  $("#trc-esporta").addEventListener("click", () => {
    const plan = toPlan(stato, "Planimetria tracciata su immagine");
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "planimetria-tracciata-mm.json";
    a.click();
  });

  window.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { stato = annullaPunto(stato); punti = []; aggiornaInfo(istruzioni()); disegna(); }
  });

  aggiornaInfo("Carica un'immagine per iniziare.");
  return { getStato: () => stato };
}
