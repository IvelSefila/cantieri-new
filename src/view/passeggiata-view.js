// Passeggiata in prima persona nella vista 3D: camera a altezza occhi, movimento con collisioni sul piano,
// porte che si aprono avvicinandosi. La logica e' in src/core/passeggiata.js; qui solo Three.js e input.
// Comandi: frecce o W A S D per camminare (A/D di lato), frecce sinistra/destra per girare,
// trascinamento del mouse per guardare, Shift per correre, Esc per uscire.
import * as THREE from "three";
import { ALTEZZA_OCCHI_MM, statoPasseggiata, aggiornaPasseggiata, vettoreSguardo, geometriaPorta, direzioneAnta } from "../core/passeggiata.js";

const MM = 0.001;
const SPESSORE_ANTA_MM = 40;
const LIMITE_PITCH = 1.2;
const SENSIBILITA_MOUSE = 0.004;
const VELOCITA_GIRO_RAD_S = 1.8;
const DT_MASSIMO_S = 0.05;

export function creaPasseggiata({ scene, camera, dom, controls, onStato }) {
  let attiva = false;
  let progetto = null;
  let stato = null;
  let ante = null;
  let ultimo = 0;
  let trascino = null;
  const tasti = new Set();
  const materiale = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.6 });
  const TASTI_USATI = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

  function costruisciAnte() {
    ante = new THREE.Group();
    for (const o of progetto.openings) {
      if (o.type !== "porta") continue;
      const w = progetto.walls.find((x) => x.id === o.wall);
      if (!w) continue;
      const g = geometriaPorta(o, w);
      const geo = new THREE.BoxGeometry(o.width * MM, o.height * MM, SPESSORE_ANTA_MM * MM);
      geo.translate((o.width * MM) / 2, (o.height * MM) / 2, 0);
      const mesh = new THREE.Mesh(geo, materiale);
      mesh.position.set(g.cerniera[0] * MM, 0, g.cerniera[1] * MM);
      mesh.userData = { id: o.id, g };
      ante.add(mesh);
    }
    scene.add(ante);
  }

  function aggiornaAnte() {
    if (!ante) return;
    for (const mesh of ante.children) {
      const { g } = mesh.userData;
      const d = direzioneAnta(g, stato.angoli[mesh.userData.id] ?? 0);
      mesh.rotation.y = Math.atan2(-d[1], d[0]);
    }
  }

  function applicaCamera() {
    const x = stato.pos[0] * MM, z = stato.pos[1] * MM, y = ALTEZZA_OCCHI_MM * MM;
    const d = vettoreSguardo(stato.yaw, stato.pitch);
    camera.position.set(x, y, z);
    camera.lookAt(x + d[0], y + d[2], z + d[1]);
  }

  function premuto(e) {
    if (!attiva) return;
    if (e.code === "Escape") { esci(); onStato?.(false); return; }
    if (TASTI_USATI.has(e.code)) e.preventDefault();
    tasti.add(e.code);
  }
  function rilasciato(e) { tasti.delete(e.code); }
  function puntatoreGiu(e) { trascino = { x: e.clientX, y: e.clientY }; }
  function puntatoreSu() { trascino = null; }
  function puntatoreMosso(e) {
    if (!trascino || !attiva) return;
    stato.yaw -= (e.clientX - trascino.x) * SENSIBILITA_MOUSE;
    stato.pitch = Math.max(-LIMITE_PITCH, Math.min(LIMITE_PITCH, stato.pitch - (e.clientY - trascino.y) * SENSIBILITA_MOUSE));
    trascino = { x: e.clientX, y: e.clientY };
    applicaCamera();
  }

  function avvia(p) {
    if (attiva) return;
    progetto = p;
    stato = statoPasseggiata(p);
    costruisciAnte();
    attiva = true;
    controls.enabled = false;
    ultimo = performance.now();
    window.addEventListener("keydown", premuto);
    window.addEventListener("keyup", rilasciato);
    dom.addEventListener("pointerdown", puntatoreGiu);
    window.addEventListener("pointerup", puntatoreSu);
    dom.addEventListener("pointermove", puntatoreMosso);
    applicaCamera();
    aggiornaAnte();
    onStato?.(true);
  }

  function esci() {
    if (!attiva) return;
    attiva = false;
    controls.enabled = true;
    tasti.clear();
    window.removeEventListener("keydown", premuto);
    window.removeEventListener("keyup", rilasciato);
    dom.removeEventListener("pointerdown", puntatoreGiu);
    window.removeEventListener("pointerup", puntatoreSu);
    dom.removeEventListener("pointermove", puntatoreMosso);
    if (ante) {
      for (const mesh of ante.children) mesh.geometry.dispose();
      ante.removeFromParent();
      ante = null;
    }
  }

  // Un passo di simulazione. Ritorna true se la scena va ridisegnata.
  function aggiorna() {
    if (!attiva) return false;
    const ora = performance.now();
    const dt = Math.min(DT_MASSIMO_S, (ora - ultimo) / 1000);
    ultimo = ora;
    if (tasti.has("ArrowLeft")) stato.yaw += VELOCITA_GIRO_RAD_S * dt;
    if (tasti.has("ArrowRight")) stato.yaw -= VELOCITA_GIRO_RAD_S * dt;
    const input = {
      avanti: tasti.has("KeyW") || tasti.has("ArrowUp"),
      indietro: tasti.has("KeyS") || tasti.has("ArrowDown"),
      sinistra: tasti.has("KeyA"),
      destra: tasti.has("KeyD"),
      corsa: tasti.has("ShiftLeft") || tasti.has("ShiftRight"),
    };
    const prima = { pos: stato.pos, angoli: stato.angoli, yaw: stato.yaw };
    stato = aggiornaPasseggiata(stato, input, dt, progetto);
    const mossa = stato.pos[0] !== prima.pos[0] || stato.pos[1] !== prima.pos[1];
    const porteMosse = Object.keys(stato.angoli).some((id) => stato.angoli[id] !== (prima.angoli[id] ?? 0));
    const girata = stato.yaw !== prima.yaw;
    applicaCamera();
    aggiornaAnte();
    return mossa || porteMosse || girata;
  }

  return { avvia, esci, aggiorna, attiva: () => attiva };
}
