// Vista Three.js ottimizzata. Il modello in mm viene reso con poche chiamate di disegno:
//  - una InstancedMesh per tipo di elemento (muri, vetri, arredi...) invece di una mesh per scatola;
//  - rendering su richiesta: nessun frame se la scena e' ferma;
//  - livelli di qualita' rilevati dal dispositivo (basso / medio / alto), cambiabili dall'utente;
//  - stili di resa: ognuno cambia materiali, sfondo, luci e (se serve) i contorni.
// Clic e hover restituiscono il punto del piano in mm e l'elemento colpito (instanceId -> scatola).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { parquet, intonaco, marmo } from "./materials.js";
import { materialeRealistico, texturaRilievo } from "./realistico.js";
import { creaSovrimpressione, proiettore } from "./misure.js";
import { preparaAmbiente, gruppoInfisso, gruppoArredo } from "./modelli3d.js";
import { creaPost } from "./post.js";

const MM_TO_M = 0.001;
const TAGLIO_DOLLHOUSE_MM = 1300;

// Livelli di qualita'. "auto" sceglie in base a core, memoria e capacita' della GPU.
export const QUALITA = {
  basso: { dpr: 1, ombre: 512, ambiente: false, nebbia: true },
  medio: { dpr: 1.5, ombre: 1024, ambiente: true, nebbia: true },
  alto: { dpr: 2, ombre: 2048, ambiente: true, nebbia: true },
};

export function qualitaAutomatica(gl, navigatore = globalThis.navigator) {
  const core = navigatore?.hardwareConcurrency ?? 4;
  const memoria = navigatore?.deviceMemory ?? 4;
  const texture = gl?.capabilities?.maxTextureSize ?? 4096;
  if (core <= 4 || memoria <= 4 || texture < 8192) return "basso";
  if (core <= 8 || memoria <= 8) return "medio";
  return "alto";
}

// Catalogo degli stili, nell'ordine del menu (dal realistico allo stilizzato).
export const STILI = {
  fotorealistico: { nome: "Fotorealistico", modo: "realistico", sfondo: ["#dfeaf6", "#f1f5fa", "#fbfaf6"], griglia: [0xc9d3e0, 0xe2e8f0], sole: 3.2, cielo: 0.7 },
  solido: { nome: "Solido", sfondo: ["#1b2440", "#2a3658", "#0b1020"], griglia: [0x5b6b8c, 0x2c3652], sole: 2.4, cielo: 0.45 },
  argilla: { nome: "Argilla", modo: "argilla", sfondo: ["#f5f7fb", "#e4e9f2", "#c9d1de"], griglia: [0xa9b3c4, 0xd5dce8], sole: 2.6, cielo: 0.9 },
  dollhouse: { nome: "Dollhouse 1,30 m", dollhouse: true, sfondo: ["#1b2440", "#2a3658", "#0b1020"], griglia: [0x5b6b8c, 0x2c3652], sole: 2.4, cielo: 0.45 },
  "iso-dollhouse": { nome: "Isometrico dollhouse", dollhouse: true, iso: true, sfondo: ["#1b2440", "#2a3658", "#0b1020"], griglia: [0x5b6b8c, 0x2c3652], sole: 2.4, cielo: 0.45 },
  vetro: { nome: "Vetro (contorni)", modo: "vetro", contorni: 0x0f172a, sfondo: ["#1b2440", "#2a3658", "#0b1020"], griglia: [0x5b6b8c, 0x2c3652], sole: 2.4, cielo: 0.45 },
  "vetro-dollhouse": { nome: "Vetro + dollhouse", modo: "vetro", dollhouse: true, contorni: 0x0f172a, sfondo: ["#1b2440", "#2a3658", "#0b1020"], griglia: [0x5b6b8c, 0x2c3652], sole: 2.4, cielo: 0.45 },
  "ultra-glass": { nome: "Ultra glass", modo: "ultra", sfondo: ["#1b2440", "#2a3658", "#0b1020"], griglia: [0x5b6b8c, 0x2c3652], sole: 2.4, cielo: 0.45 },
  blueprint: { nome: "Blueprint", modo: "blueprint", contorni: 0xffffff, sfondo: ["#0a2a66", "#0f3d8f", "#082049"], griglia: [0x6fa8ff, 0x2f5fb8], sole: 0, cielo: 1.1, ombre: false, piano: 0 },
  notte: { nome: "Notte", modo: "notte", sfondo: ["#05070d", "#0c1222", "#02030a"], griglia: [0x2a3550, 0x141b2e], sole: 0.35, cielo: 0.18 },
  neon: { nome: "Neon", modo: "neon", contorni: "neon", sfondo: ["#06070d", "#0b1024", "#020208"], griglia: [0x233a66, 0x101a33], sole: 0.6, cielo: 0.25 },
};

function gradienteSfondo(colori) {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, colori[0]);
  g.addColorStop(0.55, colori[1]);
  g.addColorStop(1, colori[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createViewer(container) {
  let livello = "medio";
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  container.appendChild(renderer.domElement);
  const sovra = creaSovrimpressione(container);
  let misureOn = false;
  const rilievo = texturaRilievo();

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x1b2440, 70, 170);
  const sfondi = new Map();
  function sfondoPer(id) {
    const cfg = STILI[id];
    const chiave = cfg.sfondo.join();
    if (!sfondi.has(chiave)) sfondi.set(chiave, gradienteSfondo(cfg.sfondo));
    return sfondi.get(chiave);
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  preparaAmbiente(renderer);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);
  const TARGET = new THREE.Vector3(11, 1.2, 7);
  const POSIZIONE_LIBERA = new THREE.Vector3(20, 26, 30);
  camera.position.copy(POSIZIONE_LIBERA);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(TARGET);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;

  const sole = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sole.position.set(22, 40, 14);
  sole.castShadow = true;
  sole.shadow.bias = -0.0004;
  sole.shadow.normalBias = 0.02;
  sole.shadow.radius = 3;
  Object.assign(sole.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 160 });
  scene.add(sole);
  const cielo = new THREE.HemisphereLight(0xdfe8ff, 0x2b3142, 0.45);
  scene.add(cielo);

  const griglia = new THREE.GridHelper(80, 80, 0x5b6b8c, 0x2c3652);
  griglia.position.y = 0.001;
  griglia.material.transparent = true;
  griglia.material.opacity = 0.55;
  scene.add(griglia);

  // Piano di appoggio: solo ombra e clic.
  const piano = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.28 }));
  piano.rotation.x = -Math.PI / 2;
  piano.receiveShadow = true;
  scene.add(piano);

  const texParquet = parquet();
  const texIntonaco = intonaco();
  const texMarmo = marmo();
  const taglio = [new THREE.Plane(new THREE.Vector3(0, -1, 0), TAGLIO_DOLLHOUSE_MM * MM_TO_M)];

  let stileId = "solido";
  let cfg = STILI.solido;
  let ultime = [];
  let gruppo = new THREE.Group();
  scene.add(gruppo);
  let pickHandler = null;
  let hoverHandler = null;
  let richiesta = true;
  let frame = 0;
  let fpsMisura = { t: performance.now(), n: 0, fps: 0 };
  let vistaIso = false;

  const clip = () => (cfg.dollhouse ? taglio : null);

  function materialeUltra(kind) {
    const tinta = kind === "pavimento" ? 0xe8efff : kind === "arredo" ? 0xffffff : 0xdfeaff;
    const alta = livello === "alto";
    return new THREE.MeshPhysicalMaterial({
      clippingPlanes: clip(), clipShadows: !!cfg.dollhouse, color: tinta, roughness: 0.06, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.05, ior: 1.45,
      transparent: !alta, opacity: alta ? 1 : 0.2, transmission: alta ? 0.92 : 0, thickness: alta ? 0.25 : 0,
      depthWrite: false, envMapIntensity: 1.4,
    });
  }

  function materialeBlueprint() {
    return new THREE.MeshBasicMaterial({ clippingPlanes: clip(), color: 0x1e5fd6, transparent: true, opacity: 0.2, depthWrite: false });
  }

  function materialeNeon(kind) {
    return new THREE.MeshStandardMaterial({
      clippingPlanes: clip(), color: kind === "pavimento" ? 0x101a36 : 0x0b1024,
      roughness: 0.7, transparent: true, opacity: kind === "vetro" ? 0.12 : 0.3, depthWrite: false,
    });
  }

  function materialeNotte(kind) {
    switch (kind) {
      case "vetro":
        return new THREE.MeshStandardMaterial({ clippingPlanes: clip(), color: 0xffd9a0, emissive: 0xffb24d, emissiveIntensity: 1.3, transparent: true, opacity: 0.7, depthWrite: false });
      case "pavimento":
        return new THREE.MeshStandardMaterial({ clippingPlanes: clip(), map: texParquet, color: 0x6b5a48, roughness: 0.6 });
      case "arredo":
        return new THREE.MeshStandardMaterial({ clippingPlanes: clip(), color: 0x2a2f3c, roughness: 0.8 });
      default:
        return new THREE.MeshStandardMaterial({ clippingPlanes: clip(), color: 0x343a4c, emissive: 0x1f1408, emissiveIntensity: 0.4, roughness: 0.9 });
    }
  }

  function materialeArgilla() {
    return new THREE.MeshStandardMaterial({ clippingPlanes: clip(), clipShadows: !!cfg.dollhouse, color: 0xf2efe9, roughness: 1, metalness: 0 });
  }

  // Materiali standard (solido, dollhouse, vetro)
  function materialeStandard(kind) {
    const base = { clippingPlanes: clip(), clipShadows: !!cfg.dollhouse };
    switch (kind) {
      case "vetro":
        return new THREE.MeshPhysicalMaterial({ ...base, color: 0xbfe6f7, transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0, clearcoat: 1, depthWrite: false });
      case "pavimento":
        return new THREE.MeshStandardMaterial({ ...base, map: texParquet, roughness: 0.55 });
      case "telaio":
        return new THREE.MeshStandardMaterial({ ...base, color: 0x2c323b, roughness: 0.4, metalness: 0.3 });
      case "vetro_fume":
        return new THREE.MeshPhysicalMaterial({ ...base, color: 0x2b2d31, transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0, clearcoat: 0.6, depthWrite: false });
      case "telaio_scrigno":
      case "binario":
        return new THREE.MeshStandardMaterial({ ...base, color: 0x1c1f24, roughness: 0.3, metalness: 0.6 });
      case "telaio_legno":
        return new THREE.MeshStandardMaterial({ ...base, color: 0x6b4a2e, roughness: 0.7, metalness: 0 });
      case "anta_legno":
        return new THREE.MeshStandardMaterial({ ...base, color: 0x8b5e3c, map: texParquet, roughness: 0.6, metalness: 0 });
      case "anta":
        return new THREE.MeshStandardMaterial({ ...base, color: 0x3b4450, roughness: 0.45, metalness: 0.2 });
      case "maniglia":
        return new THREE.MeshStandardMaterial({ ...base, color: 0xd0d5dc, roughness: 0.25, metalness: 0.9 });
      case "arredo":
        return new THREE.MeshStandardMaterial({ ...base, color: 0xffffff, roughness: 0.7 });
      default:
        return new THREE.MeshStandardMaterial({
          ...base, color: 0xf6f4ef, map: texIntonaco, roughness: 0.92,
          transparent: cfg.modo === "vetro", opacity: cfg.modo === "vetro" ? 0.4 : 1, depthWrite: cfg.modo !== "vetro",
        });
    }
  }

  function materialeGruppo(kind) {
    if (cfg.modo === "realistico") {
      return materialeRealistico(kind, { clip: clip(), texParquet, texIntonaco, rilievo, alta: livello === "alto" });
    }
    switch (cfg.modo) {
      case "ultra": return materialeUltra(kind);
      case "blueprint": return materialeBlueprint();
      case "neon": return materialeNeon(kind);
      case "notte": return materialeNotte(kind);
      case "argilla": return materialeArgilla();
      default: return materialeStandard(kind);
    }
  }

  // Colore dei contorni per tipo di elemento (solo stili con contorni)
  function coloreContorno(kind, base) {
    if (cfg.contorni === "neon") {
      if (kind === "vetro") return 0xffc44d;
      if (kind.startsWith("muro")) return 0x3ddcf7;
      return 0x9bd6ff;
    }
    return base;
  }

  const unitaria = new THREE.BoxGeometry(1, 1, 1);
  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scala = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const colore = new THREE.Color();
  const asseY = new THREE.Vector3(0, 1, 0);

  let post = null;
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    post?.dimensiona(w, h);
    richiesta = true;
  }

  // Rendering su richiesta: si disegna solo se qualcosa e' cambiato.
  function ciclo() {
    frame = requestAnimationFrame(ciclo);
    const inMoto = passoVolo();
    const cambiata = inMoto || controls.update();
    if (!richiesta && !cambiata) return;
    richiesta = false;
    if (post) post.disegna();
    else renderer.render(scene, camera);
    if (misureOn) aggiornaMisure();
    fpsMisura.n++;
    const ora = performance.now();
    if (ora - fpsMisura.t >= 1000) {
      fpsMisura.fps = Math.round((fpsMisura.n * 1000) / (ora - fpsMisura.t));
      fpsMisura.n = 0;
      fpsMisura.t = ora;
    }
  }
  controls.addEventListener("change", () => { richiesta = true; });
  window.addEventListener("resize", resize);

  function applicaLivello(nome) {
    livello = nome === "auto" ? qualitaAutomatica(renderer) : nome;
    const q = QUALITA[livello] ?? QUALITA.medio;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.dpr));
    sole.shadow.mapSize.set(q.ombre, q.ombre);
    if (sole.shadow.map) { sole.shadow.map.dispose(); sole.shadow.map = null; }
    scene.environment = q.ambiente ? ambiente : null;
    scene.environmentIntensity = 0.55;
    scene.fog.near = q.nebbia ? 70 : 500;
    post ??= creaPost(renderer, scene, camera);
    post.imposta(livello);
    resize();
    if (dettagli) setDettagli(ultimiDettagli);
    richiesta = true;
  }

  // Vista isometrica: prospettiva a campo stretto, quasi ortogonale. Vista libera: ritorna alla prospettiva.
  function applicaVista() {
    if (cfg.iso && !vistaIso) vistaIso = true;
    else if (!cfg.iso && vistaIso) vistaIso = false;
    if (vistaIso) {
      camera.fov = 9;
      camera.position.copy(TARGET).add(new THREE.Vector3(1, 0.9, 1).normalize().multiplyScalar(260));
    } else {
      camera.fov = 42;
      camera.position.copy(POSIZIONE_LIBERA);
    }
    controls.target.copy(TARGET);
    camera.updateProjectionMatrix();
    controls.update();
    richiesta = true;
  }

  // Applica lo stile: sfondo, griglia, luci, piano delle ombre, poi ridisegna il modello.
  function applicaStile(id) {
    stileId = id in STILI ? id : "solido";
    cfg = STILI[stileId];
    scene.background = sfondoPer(stileId);
    scene.fog.color.set(cfg.sfondo[1]);
    griglia.material.color.set(cfg.griglia[0]);
    griglia.material.opacity = cfg.modo === "blueprint" ? 0.8 : 0.55;
    sole.intensity = cfg.sole;
    renderer.toneMappingExposure = cfg.modo === "realistico" ? 1.12 : 1.05;
    cielo.intensity = cfg.cielo;
    sole.castShadow = cfg.ombre !== false;
    piano.material.opacity = cfg.piano ?? 0.28;
    applicaVista();
    setBoxes(ultime);
    if (typeof setDettagli === "function" && dettagli) setDettagli(ultimiDettagli);
  }

  // Clic senza trascinamento: punto del piano in mm + elemento colpito.
  const raycaster = new THREE.Raycaster();
  const puntatore = new THREE.Vector2();
  function puntatoreDa(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    puntatore.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    puntatore.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(puntatore, camera);
  }
  function colpito() {
    const hits = raycaster.intersectObjects([...gruppo.children.filter((o) => o.isInstancedMesh), dettagli, fantasma].filter(Boolean), true)
      .filter((h) => !h.object.userData.fantasma);
    if (!hits.length) return null;
    const h = hits[0];
    if (h.object.isInstancedMesh) {
      const b = h.object.userData.scatole[h.instanceId];
      return b ? { ...b, point: h.point } : null;
    }
    const u = h.object.userData;
    return u?.kind ? { id: u.id, kind: u.kind, wall: u.wall ?? null, vano: u.vano ?? null, point: h.point } : null;
  }
  let inizio = null;
  renderer.domElement.addEventListener("pointerdown", (ev) => { inizio = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener("pointerup", (ev) => {
    if (!inizio || !pickHandler) return;
    const dist = Math.hypot(ev.clientX - inizio[0], ev.clientY - inizio[1]);
    inizio = null;
    if (dist > 5) return;
    puntatoreDa(ev);
    const hit = colpito();
    const piani = raycaster.intersectObject(piano, false);
    const punto = hit ? hit.point : piani[0] ? piani[0].point : null;
    if (!punto) return;
    pickHandler({
      mm: [Math.round(punto.x / MM_TO_M), Math.round(punto.z / MM_TO_M)],
      id: hit ? hit.id : null,
      kind: hit ? hit.kind : null,
      wall: hit ? hit.wall : null,
      vano: hit ? hit.vano ?? null : null,
    });
  });
  // Doppio clic: scheda dell'elemento colpito (o del punto sul piano)
  let doppioHandler = null;
  renderer.domElement.addEventListener("dblclick", (ev) => {
    if (!doppioHandler) return;
    puntatoreDa(ev);
    const hit = colpito();
    const piani = raycaster.intersectObject(piano, false);
    const punto = hit ? hit.point : piani[0] ? piani[0].point : null;
    doppioHandler({
      mm: punto ? [Math.round(punto.x / MM_TO_M), Math.round(punto.z / MM_TO_M)] : null,
      id: hit ? hit.id : null,
      kind: hit ? hit.kind : null,
      wall: hit ? hit.wall : null,
      vano: hit ? hit.vano ?? null : null,
    });
  });
  function setDoppioClicHandler(fn) { doppioHandler = fn; }

  // Evidenziazione di una stanza: poligono interno in mm
  let evidenza = null;
  function setEvidenza(poly) {
    if (evidenza) { scene.remove(evidenza); evidenza.geometry.dispose(); evidenza.material.dispose(); evidenza = null; }
    if (poly && poly.length >= 3) {
      const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x * MM_TO_M, -y * MM_TO_M)));
      evidenza = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color: 0xffc44d, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide })
      );
      evidenza.rotation.x = -Math.PI / 2;
      evidenza.position.y = 0.012;
      evidenza.renderOrder = 5;
      scene.add(evidenza);
    }
    richiesta = true;
  }

  // Evidenziazione al passaggio del mouse (infissi e arredi): riquadro dorato attorno al modello
  let evidenziato = null;
  let contornoHover = null;
  let contornoSel = null;
  let selezioneId = null;
  const radiceDettaglio = (o) => { while (o && o.parent && o.parent !== dettagli) o = o.parent; return o?.parent === dettagli ? o : null; };
  function aggiornaHover(ev) {
    if (inVolo) return;
    puntatoreDa(ev);
    const hits = raycaster.intersectObject(dettagli, true);
    const g = hits.length ? radiceDettaglio(hits[0].object) : null;
    if (g === evidenziato) return;
    evidenziato = g;
    if (contornoHover) { scene.remove(contornoHover); contornoHover.geometry.dispose(); contornoHover = null; }
    if (g && g.userData.id !== selezioneId) {
      contornoHover = new THREE.BoxHelper(g, 0xffc44d);
      contornoHover.material.depthTest = false;
      contornoHover.renderOrder = 10;
      scene.add(contornoHover);
    }
    renderer.domElement.style.cursor = g ? "pointer" : "";
    richiesta = true;
  }
  function setSelezione(id) {
    selezioneId = id;
    if (contornoSel) { scene.remove(contornoSel); contornoSel.geometry.dispose(); contornoSel = null; }
    const g = id ? dettagli.children.find((c) => c.userData.id === id) : null;
    if (g) {
      contornoSel = new THREE.BoxHelper(g, 0x3ddcf7);
      contornoSel.material.depthTest = false;
      contornoSel.renderOrder = 11;
      scene.add(contornoSel);
    }
    richiesta = true;
  }

  renderer.domElement.addEventListener("pointermove", (ev) => {
    if (!ev.buttons) aggiornaHover(ev);
    if (!hoverHandler) return;
    puntatoreDa(ev);
    const piani = raycaster.intersectObject(piano, false);
    if (!piani.length) return hoverHandler(null);
    hoverHandler([Math.round(piani[0].point.x / MM_TO_M), Math.round(piani[0].point.z / MM_TO_M)]);
  });

  // boxes in mm. Piano (x, y) -> scena (x, z); altezza cz -> scena y.
  function setBoxes(boxes) {
    ultime = boxes;
    scene.remove(gruppo);
    gruppo.traverse((o) => {
      // la geometria unitaria e' condivisa: si libera solo materiale e contorni
      if (o.isInstancedMesh || o.isLineSegments) {
        if (o.isLineSegments) o.geometry.dispose();
        if (o.material) o.material.dispose();
      }
    });
    gruppo = new THREE.Group();

    // una InstancedMesh per tipo di elemento
    const gruppi = new Map();
    for (const b of boxes) {
      const k = b.kind.startsWith("muro") ? "muro" : b.kind;
      if (!gruppi.has(k)) gruppi.set(k, []);
      gruppi.get(k).push(b);
    }
    const perColore = new Map(); // colore contorno -> scatole
    for (const [kind, lista] of gruppi) {
      const mesh = new THREE.InstancedMesh(unitaria, materialeGruppo(kind), lista.length);
      mesh.castShadow = kind !== "vetro" && cfg.ombre !== false;
      mesh.receiveShadow = true;
      mesh.userData = { kind, scatole: lista.map((b) => ({ id: b.id, kind: b.kind, wall: b.wall })) };
      const coloriArredo = cfg.modo !== "argilla";
      lista.forEach((b, i) => {
        scala.set(b.L * MM_TO_M, b.H * MM_TO_M, b.D * MM_TO_M);
        pos.set(b.cx * MM_TO_M, b.cz * MM_TO_M, b.cy * MM_TO_M);
        quat.setFromAxisAngle(asseY, -b.ang);
        mat4.compose(pos, quat, scala);
        mesh.setMatrixAt(i, mat4);
        if (coloriArredo && (kind === "arredo" || (kind === "pavimento" && b.colore && cfg.modo !== "notte"))) {
          colore.setRGB(b.colore[0] / 255, b.colore[1] / 255, b.colore[2] / 255);
          if (kind === "pavimento") colore.set(0xffffff);
          mesh.setColorAt(i, colore);
        }
        if (cfg.contorni) {
          const c = coloreContorno(kind, cfg.contorni);
          if (!perColore.has(c)) perColore.set(c, []);
          perColore.get(c).push(b);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      gruppo.add(mesh);
    }

    // contorni: una LineSegments per colore, con i 12 spigoli di ogni scatola
    for (const [colore, lista] of perColore) {
      const pts = [];
      const v = new THREE.Vector3();
      const corners = [];
      const idx = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
      for (const b of lista) {
        const hx = (b.L * MM_TO_M) / 2, hy = (b.H * MM_TO_M) / 2, hz = (b.D * MM_TO_M) / 2;
        corners.length = 0;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push([sx * hx, sy * hy, sz * hz]);
        const q = new THREE.Quaternion().setFromAxisAngle(asseY, -b.ang);
        for (const [i, j] of idx) {
          for (const c of [corners[i], corners[j]]) {
            v.set(c[0], c[1], c[2]).applyQuaternion(q).add(new THREE.Vector3(b.cx * MM_TO_M, b.cz * MM_TO_M, b.cy * MM_TO_M));
            pts.push(v.x, v.y, v.z);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const neon = cfg.contorni === "neon";
      const mat = new THREE.LineBasicMaterial({
        color: colore, transparent: true, opacity: neon ? 0.95 : cfg.modo === "blueprint" ? 0.85 : 0.5,
        blending: neon ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false,
        clippingPlanes: clip(),
      });
      gruppo.add(new THREE.LineSegments(geo, mat));
    }
    scene.add(gruppo);
    richiesta = true;
  }

  function setStile(id) { applicaStile(id); }

  // Modelli dettagliati: [{ tipo: "infisso", parti, op, wall } | { tipo: "arredo", parti, a }]
  let dettagli = new THREE.Group();
  scene.add(dettagli);
  let ultimiDettagli = [];
  function sostitutoStile() {
    switch (cfg.modo) {
      case "argilla": return () => materialeArgilla();
      case "blueprint": return () => materialeBlueprint();
      case "neon": return (p) => materialeNeon(p.mat === "vetro" ? "vetro" : "altro");
      case "ultra": return (p) => materialeUltra(p.mat === "tessuto" ? "arredo" : "muro");
      default: return null;
    }
  }
  function setDettagli(lista) {
    ultimiDettagli = lista;
    scene.remove(dettagli);
    dettagli = new THREE.Group();
    const opz = { clip: clip(), alta: livello === "alto" };
    const sost = sostitutoStile();
    for (const d of lista) {
      const g = d.tipo === "infisso" ? gruppoInfisso(d.parti, d.op, d.wall, opz, sost) : gruppoArredo(d.parti, d.a, opz, sost);
      if (cfg.ombre === false) g.traverse((m) => { m.castShadow = false; });
      dettagli.add(g);
    }
    scene.add(dettagli);
    evidenziato = null;
    if (contornoHover) { scene.remove(contornoHover); contornoHover = null; }
    setSelezione(selezioneId);
    richiesta = true;
  }

  // Fantasma: arredo in posizionamento (verde se libero, rosso se tocca muri o altri arredi)
  let fantasma = null;
  function setFantasma(parti, a, collide = false) {
    if (fantasma) { scene.remove(fantasma); fantasma = null; }
    if (parti && a) {
      const mat = new THREE.MeshBasicMaterial({ color: collide ? 0xff5f6d : 0x58e6a0, transparent: true, opacity: 0.45, depthWrite: false });
      fantasma = gruppoArredo(parti, a, {}, () => mat);
      fantasma.traverse((m) => { m.userData = { ...m.userData, fantasma: true }; m.castShadow = false; });
      scene.add(fantasma);
    }
    richiesta = true;
  }

  // Volo della camera: posizione e bersaglio in mm del piano ([x, y, quota])
  let inVolo = false;
  let volo = null;
  function volaA(dest, ms = 900) {
    const da = { p: camera.position.clone(), t: controls.target.clone() };
    const a = {
      p: new THREE.Vector3(dest.camera[0] * MM_TO_M, dest.camera[2] * MM_TO_M, dest.camera[1] * MM_TO_M),
      t: new THREE.Vector3(dest.bersaglio[0] * MM_TO_M, dest.bersaglio[2] * MM_TO_M, dest.bersaglio[1] * MM_TO_M),
    };
    volo = { da, a, t0: performance.now(), ms };
    inVolo = true;
    controls.enabled = false;
  }
  function passoVolo() {
    if (!volo) return false;
    const k = Math.min(1, (performance.now() - volo.t0) / volo.ms);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(volo.da.p, volo.a.p, e);
    controls.target.lerpVectors(volo.da.t, volo.a.t, e);
    camera.lookAt(controls.target);
    if (k >= 1) { volo = null; inVolo = false; controls.enabled = true; }
    return true;
  }
  function vistaAttuale() {
    return {
      camera: [camera.position.x / MM_TO_M, camera.position.z / MM_TO_M, camera.position.y / MM_TO_M],
      bersaglio: [controls.target.x / MM_TO_M, controls.target.z / MM_TO_M, controls.target.y / MM_TO_M],
    };
  }
  // Punto del pavimento sotto il puntatore (mm) e oggetto colpito, per trascinare gli arredi
  function pianoDaEvento(ev) {
    puntatoreDa(ev);
    const h = raycaster.intersectObject(piano, false)[0];
    return h ? [Math.round(h.point.x / MM_TO_M), Math.round(h.point.z / MM_TO_M)] : null;
  }
  function oggettoDaEvento(ev) {
    puntatoreDa(ev);
    return colpito();
  }

  // Misure in sovrimpressione: etichette in mm sul modello
  function aggiornaMisure() {
    sovra.aggiorna(proiettore(camera, MM_TO_M, container.clientWidth, container.clientHeight), container.clientWidth, container.clientHeight);
  }
  function setMisure(lista) { sovra.imposta(lista); richiesta = true; if (misureOn) aggiornaMisure(); }
  function setMisureVisibili(v) { misureOn = !!v; sovra.visibile(misureOn); richiesta = true; if (misureOn) aggiornaMisure(); }

  function setPickHandler(fn) { pickHandler = fn; }
  function setHoverHandler(fn) { hoverHandler = fn; }
  function statistiche() {
    let triangoli = 0;
    let chiamate = 0;
    gruppo.traverse((o) => {
      if (o.isInstancedMesh) { chiamate++; triangoli += o.count * 12; }
    });
    return { livello, stile: stileId, fps: fpsMisura.fps, chiamate, triangoli, scatole: ultime.length };
  }

  applicaLivello("auto");
  applicaStile("solido");
  resize();
  ciclo();

  return {
    setBoxes, setStile, setPickHandler, setHoverHandler, setQualita: applicaLivello, setMisure, setMisureVisibili,
    setDoppioClicHandler, setEvidenza, setMisureScala: (v) => { sovra.scala(v); richiesta = true; },
    setDettagli, setFantasma, setSelezione, volaA, vistaAttuale, pianoDaEvento, oggettoDaEvento,
    inVolo: () => inVolo, ridisegna: () => { richiesta = true; },
    domElement: renderer.domElement,
    statistiche, camera, controls, dispose: () => cancelAnimationFrame(frame),
  };
}
