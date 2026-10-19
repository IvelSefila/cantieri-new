// Finestra di dettaglio di un elemento (doppio clic). Il contenuto e' testo, mai HTML del progetto.
let aperta = null;

export function chiudiScheda() {
  if (aperta) { aperta.remove(); aperta = null; }
}

// dati: { titolo, portante?, righe: [[etichetta, valore]], azioni: [{id, etichetta, pericolo, conferma}] }
// onAzione(id): chiamato dopo l'eventuale conferma.
export function apriScheda(dati, onAzione) {
  chiudiScheda();
  const velo = document.createElement("div");
  velo.className = "scheda-velo";
  velo.addEventListener("click", (e) => { if (e.target === velo) chiudiScheda(); });

  const box = document.createElement("div");
  box.className = "scheda-modale";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", dati.titolo);

  const testa = document.createElement("div");
  testa.className = "scheda-testa";
  const titolo = document.createElement("div");
  titolo.className = "scheda-titolo";
  titolo.textContent = dati.titolo;
  const chiudi = document.createElement("button");
  chiudi.className = "scheda-chiudi";
  chiudi.textContent = "✕";
  chiudi.onclick = chiudiScheda;
  testa.append(titolo, chiudi);
  box.appendChild(testa);

  if (dati.portante !== undefined) {
    const badge = document.createElement("div");
    badge.className = `scheda-badge ${dati.portante ? "portante" : "tramezzo"}`;
    badge.textContent = dati.portante ? "PRESUNTO PORTANTE" : "PRESUNTO NON PORTANTE";
    box.appendChild(badge);
  }

  const tabella = document.createElement("div");
  tabella.className = "scheda-righe";
  for (const [k, v] of dati.righe) {
    const r = document.createElement("div");
    r.className = "scheda-riga";
    const a = document.createElement("span");
    a.textContent = k;
    const b = document.createElement("b");
    b.textContent = v;
    r.append(a, b);
    tabella.appendChild(r);
  }
  box.appendChild(tabella);

  // Finiture: un pulsante per materiale; la scelta applica "finitura:<id>" e chiude la scheda
  if (dati.finiture) {
    const titoloFin = document.createElement("div");
    titoloFin.className = "scheda-sezione";
    titoloFin.textContent = dati.finiture.titolo;
    const griglia = document.createElement("div");
    griglia.className = "scheda-finiture";
    for (const op of dati.finiture.opzioni) {
      const b = document.createElement("button");
      b.className = `scheda-finitura${op.id === dati.finiture.attiva ? " attiva" : ""}`;
      b.textContent = op.nome;
      b.onclick = () => { chiudiScheda(); onAzione(`finitura:${op.id}`); };
      griglia.appendChild(b);
    }
    box.append(titoloFin, griglia);
  }

  // Funzione della stanza: ne decide arredi e finestre (la planimetria non porta le etichette)
  if (dati.funzioni) {
    const titoloFun = document.createElement("div");
    titoloFun.className = "scheda-sezione";
    titoloFun.textContent = dati.funzioni.titolo + (dati.funzioni.attiva ? "" : " (suggerita, da confermare)");
    const griglia = document.createElement("div");
    griglia.className = "scheda-finiture";
    for (const op of dati.funzioni.opzioni) {
      const b = document.createElement("button");
      b.className = `scheda-finitura${op.id === dati.funzioni.attiva ? " attiva" : ""}`;
      b.textContent = op.nome;
      b.onclick = () => { chiudiScheda(); onAzione(`funzione:${op.id}`); };
      griglia.appendChild(b);
    }
    box.append(titoloFun, griglia);
  }

  // Colori: campioni cliccabili; la scelta applica "tinta:<id>"
  if (dati.tinte) {
    const titoloTinte = document.createElement("div");
    titoloTinte.className = "scheda-sezione";
    titoloTinte.textContent = dati.tinte.titolo;
    const campioni = document.createElement("div");
    campioni.className = "scheda-tinte";
    for (const op of dati.tinte.opzioni) {
      const b = document.createElement("button");
      b.className = `scheda-tinta${op.id === dati.tinte.attiva ? " attiva" : ""}`;
      b.style.background = op.hex;
      b.title = op.nome;
      b.setAttribute("aria-label", op.nome);
      b.onclick = () => { chiudiScheda(); onAzione(`tinta:${op.id}`); };
      campioni.appendChild(b);
    }
    box.append(titoloTinte, campioni);
  }

  for (const az of dati.azioni || []) {
    const b = document.createElement("button");
    b.className = `scheda-azione${az.pericolo ? " pericolo" : ""}`;
    b.textContent = az.etichetta;
    if (az.disabile) {
      b.disabled = true;
      box.appendChild(b);
      continue;
    }
    let pronto = false;
    b.onclick = () => {
      if (az.conferma && !pronto) {
        pronto = true;
        b.textContent = `Conferma: ${az.etichetta}`;
        return;
      }
      chiudiScheda();
      onAzione(az.id);
    };
    box.appendChild(b);
  }

  velo.appendChild(box);
  document.body.appendChild(velo);
  aperta = velo;
  return velo;
}

window.addEventListener("keydown", (e) => { if (e.key === "Escape") chiudiScheda(); });
