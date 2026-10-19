// Sovrimpressione delle misure sulla vista 3D: etichette in mm ancorate a punti del modello.
// Le posizioni si ricalcolano solo quando la scena viene disegnata (rendering su richiesta).
import * as THREE from "three";

export function creaSovrimpressione(container) {
  const strato = document.createElement("div");
  strato.className = "misure-strato";
  strato.style.cssText = "position:absolute; inset:0; pointer-events:none; overflow:hidden; display:none;";
  container.appendChild(strato);
  let etichette = [];
  let visibile = false;
  const nodi = [];

  function assicura(n) {
    while (nodi.length < n) {
      const el = document.createElement("div");
      el.className = "misura";
      el.style.cssText = "position:absolute; transform:translate(-50%,-50%) scale(var(--misura-scala,1)); padding:2px 7px; border-radius:999px; font:600 11px/1.3 ui-monospace,Consolas,monospace; color:#e9eef7; background:rgba(10,14,24,0.78); border:1px solid rgba(255,196,77,0.5); white-space:nowrap; box-shadow:0 0 10px rgba(255,196,77,0.25);";
      strato.appendChild(el);
      nodi.push(el);
    }
    for (let i = n; i < nodi.length; i++) nodi[i].style.display = "none";
  }

  return {
    scala(v) {
      strato.style.setProperty("--misura-scala", String(v));
    },
    imposta(lista) {
      etichette = lista;
    },
    visibile(v) {
      visibile = v;
      strato.style.display = v ? "block" : "none";
    },
    // proietta: (x_mm, y_mm, h_mm) -> [px, py] in coordinate del contenitore, oppure null se dietro la camera
    aggiorna(proietta, larghezza, altezza) {
      if (!visibile) return;
      assicura(etichette.length);
      etichette.forEach((e, i) => {
        const p = proietta(e.mm[0], e.mm[1], e.h ?? 1400);
        const el = nodi[i];
        if (!p || p[0] < -50 || p[1] < -30 || p[0] > larghezza + 50 || p[1] > altezza + 30) {
          el.style.display = "none";
          return;
        }
        el.style.display = "block";
        el.style.left = `${p[0]}px`;
        el.style.top = `${p[1]}px`;
        el.textContent = e.testo;
      });
    },
  };
}

// Proiezione di un punto del piano (mm) sullo schermo, con la camera attuale.
export function proiettore(camera, MM_TO_M, larghezza, altezza) {
  const v = new THREE.Vector3();
  return (x, y, h) => {
    v.set(x * MM_TO_M, h * MM_TO_M, y * MM_TO_M).project(camera);
    if (v.z > 1) return null; // dietro la camera
    return [((v.x + 1) / 2) * larghezza, ((1 - v.y) / 2) * altezza];
  };
}
