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

  for (const az of dati.azioni || []) {
    const b = document.createElement("button");
    b.className = `scheda-azione${az.pericolo ? " pericolo" : ""}`;
    b.textContent = az.etichetta;
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
