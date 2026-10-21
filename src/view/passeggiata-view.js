// Passeggiata in prima persona nella vista 3D: camera a altezza occhi, movimento con collisioni sul piano,
// porte che si aprono avvicinandosi. La logica e' in src/core/passeggiata.js; qui solo Three.js e input.
// Comandi: W A S D o frecce su/giu' per camminare (A/D di lato), frecce sinistra/destra per girare,
// trascinamento del mouse per guardare, Shift per correre, Esc per uscire.
import * as THREE from "three";
import { ALTEZZA_OCCHI_MM, statoPasseggiata, aggiornaPasseggiata, vettoreSguardo, geometriaPorta, direzioneAnta } from "../core/passeggiata.js?v=v20261021a";

const MM = 0.001;
const LIMITE_PITCH = 1.2;
const SENSIBILITA_MOUSE = 0.004;
const VELOCITA_GIRO_RAD_S = 1.8;
const DT_MASSIMO_S = 0.05;
const TASTI_USATI = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

// Campi di testo e menu: i tasti digitati li' non devono muovere la camera
const inCampo = (e) => {
  const t = e.target;
  return !!t && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
};

export function creaPasseggiata({ scene, camera, dom, controls, onStato, onRichiesta, onRichiestaEsci }) {
  let attiva = false;
  let progetto = null;
  let stato = null;
  let ante = null;
  let ultimo = 0;
  let trascino = null;
  const tasti = new Set();
  // Joystick virtuali (telefono): movimento e sguardo, valori -1..1
  const stick = { move: { x: 0, y: 0 }, look: { x: 0, y: 0 } };

  // Ante reali: le stesse parti dell'infisso montato (costruisciAnta), ruotate attorno alla cerniera.
  // Il perno sta sulla cerniera; il pezzo e' riportato in coordinate relative al perno.
  function costruisciAnte(porteInfisso, costruisciAnta) {
    ante = new THREE.Group();
    for (const d of porteInfisso) {
      const g = geometriaPorta(d.op, d.wall);
      const cerniera = new THREE.Vector3(g.cerniera[0] * MM, 0, g.cerniera[1] * MM);
      const pezzo = costruisciAnta(d);
      pezzo.position.sub(cerniera);
      const perno = new THREE.Group();
      perno.position.copy(cerniera);
      perno.add(pezzo);
      perno.userData = { id: d.op.id, g, phi: Math.atan2(g.u[1], g.u[0]), segno: g.cardine === "b" ? -1 : 1 };
      ante.add(perno);
    }
    scene.add(ante);
  }

  // Rotazione del perno: la lama del pezzo (asse X) va nella direzione dell'anta aperta, a partire dalla posizione chiusa
  function aggiornaAnte() {
    if (!ante) return;
    for (const perno of ante.children) {
      const { g, phi, id, segno } = perno.userData;
      const d = direzioneAnta(g, stato.angoli[id] ?? 0);
      perno.rotation.y = Math.atan2(-segno * d[1], segno * d[0]) + phi;
    }
  }

  // Piano (x, y) in mm -> mondo (x, z) in m; y = altezza occhi
  function applicaCamera() {
    const x = stato.pos[0] * MM, z = stato.pos[1] * MM, y = ALTEZZA_OCCHI_MM * MM;
    const d = vettoreSguardo(stato.yaw, stato.pitch);
    camera.position.set(x, y, z);
    camera.lookAt(x + d[0], y + d[2], z + d[1]);
  }

  function premuto(e) {
    if (!attiva) return;
    if (e.code === "Escape") {
      // Esc esce dalla passeggiata; l'evento non arriva agli altri gestori della pagina
      e.stopPropagation();
      e.preventDefault();
      onRichiestaEsci?.();
      return;
    }
    if (inCampo(e)) return;
    if (TASTI_USATI.has(e.code)) e.preventDefault();
    tasti.add(e.code);
  }
  function rilasciato(e) { tasti.delete(e.code); }
  function perdeFocus() { tasti.clear(); trascino = null; }

  function puntatoreGiu(e) {
    if (!attiva) return;
    // Sul telefono lo sguardo lo danno solo le manopole: il tocco sulla scena non ruota nulla
    if (e.pointerType === "touch") return;
    trascino = { x: e.clientX, y: e.clientY };
    dom.setPointerCapture?.(e.pointerId);
  }
  function puntatoreSu(e) {
    trascino = null;
    dom.releasePointerCapture?.(e.pointerId);
  }
  // Il mouse ruota lo sguardo: con il puntatore bloccato (lock) basta muoverlo, senza cliccare;
  // senza lock resta il trascinamento col tasto premuto.
  function ruota(dx, dy) {
    stato.yaw -= dx * SENSIBILITA_MOUSE;
    stato.pitch = Math.max(-LIMITE_PITCH, Math.min(LIMITE_PITCH, stato.pitch - dy * SENSIBILITA_MOUSE));
    applicaCamera();
    onRichiesta?.();
  }
  function puntatoreMosso(e) {
    if (!attiva) return;
    if (document.pointerLockElement === dom) { ruota(e.movementX, e.movementY); return; }
    if (!trascino) return;
    ruota(e.clientX - trascino.x, e.clientY - trascino.y);
    trascino = { x: e.clientX, y: e.clientY };
  }
  // Puntatore bloccato: il blocco parte dal pulsante (gesto dell'utente). Se il browser lo rilascia (Esc), si esce dalla passeggiata.
  let bloccato = false;
  function cambioBlocco() {
    if (!attiva) return;
    if (document.pointerLockElement === dom) { bloccato = true; return; }
    if (bloccato) { bloccato = false; onRichiestaEsci?.(); }
  }

  // porteInfisso: [{ op, wall, parti }] delle sole porte con infisso montato; costruisciAnta(d) restituisce il gruppo dell'anta
  // Obiettivo piu' ampio in prima persona: le cose appaiono piu' piccole e in scala, non ingrandite
  const FOV_PRIMA_PERSONA = 62;
  let fovPrecedente = null;
  function avvia(p, porteInfisso = [], costruisciAnta = () => new THREE.Group()) {
    if (attiva) return;
    progetto = p;
    fovPrecedente = camera.fov;
    camera.fov = FOV_PRIMA_PERSONA;
    camera.updateProjectionMatrix();
    stato = statoPasseggiata(p);
    costruisciAnte(porteInfisso, costruisciAnta);
    attiva = true;
    controls.enabled = false;
    ultimo = performance.now();
    tasti.clear();
    window.addEventListener("keydown", premuto, true);
    window.addEventListener("keyup", rilasciato);
    window.addEventListener("blur", perdeFocus);
    dom.addEventListener("pointerdown", puntatoreGiu);
    document.addEventListener("pointermove", puntatoreMosso);
    document.addEventListener("pointerlockchange", cambioBlocco);
    dom.addEventListener("pointerup", puntatoreSu);
    dom.addEventListener("pointercancel", puntatoreSu);
    applicaCamera();
    aggiornaAnte();
    onStato?.(true);
    // richiesta dal gesto del pulsante: il browser puo' rifiutarla (promessa rifiutata), allora resta il trascinamento
    const richiesta = dom.requestPointerLock?.();
    richiesta?.catch?.(() => {});
  }

  function esci() {
    if (!attiva) return;
    attiva = false;
    if (fovPrecedente !== null) { camera.fov = fovPrecedente; camera.updateProjectionMatrix(); fovPrecedente = null; }
    controls.enabled = true;
    tasti.clear();
    trascino = null;
    bloccato = false;
    if (document.pointerLockElement === dom) document.exitPointerLock();
    window.removeEventListener("keydown", premuto, true);
    window.removeEventListener("keyup", rilasciato);
    window.removeEventListener("blur", perdeFocus);
    dom.removeEventListener("pointerdown", puntatoreGiu);
    document.removeEventListener("pointermove", puntatoreMosso);
    document.removeEventListener("pointerlockchange", cambioBlocco);
    dom.removeEventListener("pointerup", puntatoreSu);
    dom.removeEventListener("pointercancel", puntatoreSu);
    if (ante) {
      ante.removeFromParent();
      ante = null;
    }
    onStato?.(false);
  }

  // Un passo di simulazione. Ritorna true se la scena va ridisegnata (movimento, giro, porte in moto).
  function aggiorna() {
    if (!attiva) return false;
    const ora = performance.now();
    const dt = Math.min(DT_MASSIMO_S, (ora - ultimo) / 1000);
    ultimo = ora;
    const prima = { x: stato.pos[0], y: stato.pos[1], yaw: stato.yaw, pitch: stato.pitch, angoli: stato.angoli };
    if (tasti.has("ArrowLeft")) stato.yaw += VELOCITA_GIRO_RAD_S * dt;
    if (tasti.has("ArrowRight")) stato.yaw -= VELOCITA_GIRO_RAD_S * dt;
    // joystick di sguardo: destra = girare a destra, su = guardare in alto
    stato.yaw -= stick.look.x * VELOCITA_GIRO_RAD_S * dt;
    stato.pitch = Math.max(-LIMITE_PITCH, Math.min(LIMITE_PITCH, stato.pitch + stick.look.y * VELOCITA_GIRO_RAD_S * 0.7 * dt));
    const input = {
      avanti: tasti.has("KeyW") || tasti.has("ArrowUp") || stick.move.y > 0.3,
      indietro: tasti.has("KeyS") || tasti.has("ArrowDown") || stick.move.y < -0.3,
      sinistra: tasti.has("KeyA") || stick.move.x < -0.3,
      destra: tasti.has("KeyD") || stick.move.x > 0.3,
      corsa: tasti.has("ShiftLeft") || tasti.has("ShiftRight"),
    };
    stato = aggiornaPasseggiata(stato, input, dt, progetto);
    const mossa = stato.pos[0] !== prima.x || stato.pos[1] !== prima.y;
    const girata = stato.yaw !== prima.yaw;
    const porteMosse = Object.keys(stato.angoli).some((id) => stato.angoli[id] !== (prima.angoli[id] ?? 0));
    applicaCamera();
    aggiornaAnte();
    return mossa || girata || porteMosse;
  }

  function setStick(move, look) {
    if (move) Object.assign(stick.move, move);
    if (look) Object.assign(stick.look, look);
  }
  return { avvia, esci, aggiorna, attiva: () => attiva, setStick };
}
