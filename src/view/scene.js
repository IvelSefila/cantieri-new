// Vista Three.js ottimizzata. Il modello in mm viene reso con poche chiamate di disegno:
//  - una InstancedMesh per tipo di elemento (muri, vetri, arredi...) invece di una mesh per scatola;
//  - rendering su richiesta: nessun frame se la scena e' ferma;
//  - livelli di qualita' rilevati dal dispositivo (basso / medio / alto), cambiabili dall'utente.
// Clic e hover restituiscono il punto del piano in mm e l'elemento colpito (instanceId -> scatola).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { parquet, intonaco, marmo } from "./materials.js";

const MM_TO_M = 0.001;
const TAGLIO_DOLLHOUSE_MM = 1300;

// Livelli di qualita'. "auto" sceglie in base a core, memoria e capacita' della GPU.
export const QUALITA = {
  basso: { dpr: 1, ombre: 512, ambiente: false, antialias: false, nebbia: true },
  medio: { dpr: 1.5, ombre: 1024, ambiente: true, antialias: true, nebbia: true },
  alto: { dpr: 2, ombre: 2048, ambiente: true, antialias: true, nebbia: true },
};

export function qualitaAutomatica(gl, navigatore = globalThis.navigator) {
  const core = navigatore?.hardwareConcurrency ?? 4;
  const memoria = navigatore?.deviceMemory ?? 4;
  const texture = gl?.capabilities?.maxTextureSize ?? 4096;
  if (core <= 4 || memoria <= 4 || texture < 8192) return "basso";
  if (core <= 8 || memoria <= 8) return "medio";
  return "alto";
}

// Sfondo a gradiente verticale (texture su canvas, costo quasi nullo).
function sfondoGradiente() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#1b2440");
  g.addColorStop(0.55, "#2a3658");
  g.addColorStop(1, "#0b1020");
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

  const scene = new THREE.Scene();
  scene.background = sfondoGradiente();
  scene.fog = new THREE.Fog(0x1b2440, 70, 170);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
  camera.position.set(20, 26, 30);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(11, 1.2, 7);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;

  const sole = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sole.position.set(22, 40, 14);
  sole.castShadow = true;
  sole.shadow.bias = -0.0004;
  sole.shadow.normalBias = 0.02;
  sole.shadow.radius = 3;
  Object.assign(sole.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 120 });
  scene.add(sole);
  const cielo = new THREE.HemisphereLight(0xdfe8ff, 0x2b3142, 0.45);
  scene.add(cielo);

  // Griglia sfumata: visibile vicino al centro, dissolta lontano.
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

  let stile = { vetro: false, dollhouse: false, ultra: false };
  let ultime = [];
  let gruppo = new THREE.Group();
  scene.add(gruppo);
  let pickHandler = null;
  let hoverHandler = null;

  // Stile "Ultra glass": vetro lattiginoso senza contorni. Con qualita' alta usa la trasmissione reale.
  function materialeUltraGlass(kind) {
    const base = { clippingPlanes: stile.dollhouse ? taglio : null, clipShadows: stile.dollhouse };
    const tinta = kind === "pavimento" ? 0xe8efff : kind === "arredo" ? 0xffffff : 0xdfeaff;
    const alta = livello === "alto";
    return new THREE.MeshPhysicalMaterial({
      ...base,
      color: tinta,
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      ior: 1.45,
      transparent: !alta,
      opacity: alta ? 1 : 0.2,
      transmission: alta ? 0.92 : 0,
      thickness: alta ? 0.25 : 0,
      depthWrite: false,
      envMapIntensity: 1.4,
    });
  }

  // Materiale per gruppo di elementi.
  function materialeGruppo(kind) {
    if (stile.ultra) return materialeUltraGlass(kind);
    const base = { clippingPlanes: stile.dollhouse ? taglio : null, clipShadows: stile.dollhouse };
    switch (kind) {
      case "vetro":
        return new THREE.MeshPhysicalMaterial({ ...base, color: 0xbfe6f7, transparent: true, opacity: 0.22, roughness: 0.04, metalness: 0, clearcoat: 1, depthWrite: false });
      case "pavimento":
        return new THREE.MeshStandardMaterial({ ...base, map: texParquet, roughness: 0.55 });
      case "telaio":
        return new THREE.MeshStandardMaterial({ ...base, color: 0x2c323b, roughness: 0.4, metalness: 0.3 });
      case "anta":
        return new THREE.MeshStandardMaterial({ ...base, color: 0x3b4450, roughness: 0.45, metalness: 0.2 });
      case "maniglia":
        return new THREE.MeshStandardMaterial({ ...base, color: 0xd0d5dc, roughness: 0.25, metalness: 0.9 });
      case "arredo":
        return new THREE.MeshStandardMaterial({ ...base, color: 0xffffff, roughness: 0.7 });
      default: // muri
        return new THREE.MeshStandardMaterial({
          ...base, color: 0xf6f4ef, map: texIntonaco, roughness: 0.92,
          transparent: stile.vetro, opacity: stile.vetro ? 0.4 : 1, depthWrite: !stile.vetro,
        });
    }
  }

  const unitaria = new THREE.BoxGeometry(1, 1, 1);
  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scala = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const colore = new THREE.Color();

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    richiesta = true;
  }

  // Rendering su richiesta: si disegna solo se qualcosa e' cambiato (camera, modello, stile, resize).
  let richiesta = true;
  let frame = 0;
  let fpsMisura = { t: performance.now(), n: 0, fps: 0 };
  function ciclo() {
    frame = requestAnimationFrame(ciclo);
    const cambiata = controls.update();
    if (!richiesta && !cambiata) return;
    richiesta = false;
    renderer.render(scene, camera);
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
    livello = nome === "auto" ? qualitaAutomatica(renderer.getContext()) : nome;
    const q = QUALITA[livello] ?? QUALITA.medio;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.dpr));
    renderer.shadowMap.enabled = true;
    sole.shadow.mapSize.set(q.ombre, q.ombre);
    if (sole.shadow.map) { sole.shadow.map.dispose(); sole.shadow.map = null; }
    scene.environment = q.ambiente ? ambiente : null;
    scene.environmentIntensity = 0.55;
    scene.fog.near = q.nebbia ? 70 : 500;
    resize();
    richiesta = true;
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
    const hits = raycaster.intersectObjects(gruppo.children.filter((o) => o.isInstancedMesh), false);
    if (!hits.length) return null;
    const h = hits[0];
    const b = h.object.userData.scatole[h.instanceId];
    return b ? { ...b, point: h.point } : null;
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
    });
  });
  renderer.domElement.addEventListener("pointermove", (ev) => {
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

    // raggruppa per tipo: una InstancedMesh per gruppo
    const gruppi = new Map();
    for (const b of boxes) {
      const k = b.kind.startsWith("muro") ? "muro" : b.kind;
      if (!gruppi.has(k)) gruppi.set(k, []);
      gruppi.get(k).push(b);
    }
    const bordi = [];
    for (const [kind, lista] of gruppi) {
      const mesh = new THREE.InstancedMesh(unitaria, materialeGruppo(kind), lista.length);
      mesh.castShadow = kind !== "vetro";
      mesh.receiveShadow = true;
      mesh.userData = { kind, scatole: lista.map((b) => ({ id: b.id, kind: b.kind, wall: b.wall })) };
      lista.forEach((b, i) => {
        scala.set(b.L * MM_TO_M, b.H * MM_TO_M, b.D * MM_TO_M);
        pos.set(b.cx * MM_TO_M, b.cz * MM_TO_M, b.cy * MM_TO_M);
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -b.ang);
        mat4.compose(pos, quat, scala);
        mesh.setMatrixAt(i, mat4);
        if (kind === "arredo" || (kind === "pavimento" && b.colore)) {
          colore.setRGB(b.colore[0] / 255, b.colore[1] / 255, b.colore[2] / 255);
          if (kind === "pavimento") colore.set(0xffffff);
          mesh.setColorAt(i, colore);
        }
        if (stile.vetro && !stile.ultra && kind !== "vetro") bordi.push(b);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      gruppo.add(mesh);
    }

    // contorni per lo stile vetro: un'unica LineSegments con i 12 spigoli di ogni scatola
    if (bordi.length) {
      const pts = [];
      const v = new THREE.Vector3();
      const corners = [];
      for (const b of bordi) {
        const hx = (b.L * MM_TO_M) / 2, hy = (b.H * MM_TO_M) / 2, hz = (b.D * MM_TO_M) / 2;
        corners.length = 0;
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push([sx * hx, sy * hy, sz * hz]);
        const idx = [[0,1],[2,3],[4,5],[6,7],[0,2],[1,3],[4,6],[5,7],[0,4],[1,5],[2,6],[3,7]];
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -b.ang);
        for (const [i, j] of idx) {
          for (const c of [corners[i], corners[j]]) {
            v.set(c[0], c[1], c[2]).applyQuaternion(q).add(new THREE.Vector3(b.cx * MM_TO_M, b.cz * MM_TO_M, b.cy * MM_TO_M));
            pts.push(v.x, v.y, v.z);
          }
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      const lin = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.5, clippingPlanes: stile.dollhouse ? taglio : null }));
      gruppo.add(lin);
    }
    scene.add(gruppo);
    richiesta = true;
  }

  // Stile: "solido" | "vetro" | "dollhouse" | "vetro-dollhouse".
  function setStile(nome) {
    stile = { vetro: nome.includes("vetro"), dollhouse: nome.includes("dollhouse"), ultra: nome === "ultra-glass" };
    setBoxes(ultime);
  }

  function setPickHandler(fn) { pickHandler = fn; }
  function setHoverHandler(fn) { hoverHandler = fn; }
  function statistiche() {
    let triangoli = 0;
    let chiamate = 0;
    gruppo.traverse((o) => {
      if (o.isInstancedMesh) { chiamate++; triangoli += o.count * 12; }
    });
    return { livello, fps: fpsMisura.fps, chiamate, triangoli, scatole: ultime.length };
  }

  applicaLivello("auto");
  resize();
  ciclo();

  return {
    setBoxes, setStile, setPickHandler, setHoverHandler, setQualita: applicaLivello,
    statistiche, camera, controls, dispose: () => cancelAnimationFrame(frame),
  };
}
