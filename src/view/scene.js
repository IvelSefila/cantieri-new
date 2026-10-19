// Vista Three.js. Riceve scatole in millimetri dal core e le converte in metri SOLO per la resa.
// Il modello dati resta in mm interi: nessuna misura viene ricavata dalla scena.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { parquet, intonaco, marmo } from "./materials.js";

const MM_TO_M = 0.001;

const COLORI = {
  muro: 0xf6f4ef,
  muro_sotto: 0xeeebe4,
  muro_sopra: 0xeeebe4,
  telaio: 0x2c323b,
  anta: 0x3b4450,
  vetro: 0xbfe6f7,
  maniglia: 0xd0d5dc,
  basamento: 0x39414d,
};

export function createViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0xe9edf2);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  // Luce ambiente da ambiente studio: ombre morbide e riflessi realistici sulle superfici.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
  camera.position.set(20, 26, 30);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(11, 1.2, 7);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;

  const sole = new THREE.DirectionalLight(0xfff4e6, 2.2);
  sole.position.set(22, 40, 14);
  sole.castShadow = true;
  sole.shadow.mapSize.set(2048, 2048);
  sole.shadow.camera.left = -28;
  sole.shadow.camera.right = 28;
  sole.shadow.camera.top = 28;
  sole.shadow.camera.bottom = -28;
  sole.shadow.camera.near = 1;
  sole.shadow.camera.far = 120;
  sole.shadow.bias = -0.0004;
  sole.shadow.normalBias = 0.02;
  sole.shadow.radius = 4;
  scene.add(sole);
  scene.add(new THREE.HemisphereLight(0xf5f8ff, 0x7a7f88, 0.35));

  const texParquet = parquet();
  const texIntonaco = intonaco();
  const texMarmo = marmo();
  const materiali = {
    muro: new THREE.MeshStandardMaterial({ map: texIntonaco, color: COLORI.muro, roughness: 0.92 }),
    pavimento: new THREE.MeshStandardMaterial({ map: texParquet, roughness: 0.55 }),
    basamento: new THREE.MeshStandardMaterial({ color: COLORI.basamento, roughness: 0.8 }),
    vetro: new THREE.MeshStandardMaterial({ color: COLORI.vetro, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0, depthWrite: false }),
    telaio: new THREE.MeshStandardMaterial({ color: COLORI.telaio, roughness: 0.4, metalness: 0.3 }),
    anta: new THREE.MeshStandardMaterial({ color: COLORI.anta, roughness: 0.45, metalness: 0.2 }),
    maniglia: new THREE.MeshStandardMaterial({ color: COLORI.maniglia, roughness: 0.25, metalness: 0.9 }),
    marmo: new THREE.MeshStandardMaterial({ map: texMarmo, roughness: 0.25 }),
  };

  const griglia = new THREE.GridHelper(60, 60, 0xb8c0ca, 0xd6dce4);
  griglia.position.y = -0.002;
  griglia.material.transparent = true;
  griglia.material.opacity = 0.5;
  scene.add(griglia);

  // Basamento: piano di appoggio del palazzo, riceve le ombre.
  const piano = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 1 }));
  piano.rotation.x = -Math.PI / 2;
  piano.position.y = -0.003;
  piano.receiveShadow = true;
  scene.add(piano);

  let gruppo = new THREE.Group();
  scene.add(gruppo);

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  function materialeDi(kind, colore) {
    if (kind === "vetro") return materiali.vetro;
    if (kind === "telaio") return materiali.telaio;
    if (kind === "anta") return materiali.anta;
    if (kind === "maniglia") return materiali.maniglia;
    if (kind === "pavimento") return materiali.pavimento;
    if (kind === "marmo") return materiali.marmo;
    if (kind === "arredo") {
      const key = `arredo:${colore}`;
      if (!materiali[key]) materiali[key] = new THREE.MeshStandardMaterial({ color: colore, roughness: 0.7 });
      return materiali[key];
    }
    return materiali.muro;
  }

  // boxes: scatole del core, in mm. Piano (x, y) -> scena (x, z); altezza (cz) -> scena y.
  // Il pavimento del palazzo e' una lastra unica sotto i muri, con il parquet procedurale.
  function setBoxes(boxes, opzioni = {}) {
    scene.remove(gruppo);
    gruppo.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    gruppo = new THREE.Group();

    if (boxes.length) {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const b of boxes) {
        if (b.kind !== "muro" && b.kind !== "muro_sopra" && b.kind !== "muro_sotto") continue;
        // ingombro orientato: meta' lunghezza lungo il muro, meta' spessore sulla normale
        const c = Math.abs(Math.cos(b.ang));
        const s = Math.abs(Math.sin(b.ang));
        const ex = (c * b.L + s * b.D) / 2;
        const ey = (s * b.L + c * b.D) / 2;
        x0 = Math.min(x0, b.cx - ex); x1 = Math.max(x1, b.cx + ex);
        y0 = Math.min(y0, b.cy - ey); y1 = Math.max(y1, b.cy + ey);
      }
      if (isFinite(x0)) {
        const w = (x1 - x0) * MM_TO_M;
        const d = (y1 - y0) * MM_TO_M;
        const lastra = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), materiali.basamento);
        lastra.position.set(((x0 + x1) / 2) * MM_TO_M, -0.06, ((y0 + y1) / 2) * MM_TO_M);
        lastra.receiveShadow = true;
        gruppo.add(lastra);
        const pav = new THREE.Mesh(new THREE.PlaneGeometry(w, d), materiali.pavimento);
        pav.rotation.x = -Math.PI / 2;
        pav.position.set(((x0 + x1) / 2) * MM_TO_M, 0.004, ((y0 + y1) / 2) * MM_TO_M);
        pav.receiveShadow = true;
        gruppo.add(pav);
      }
    }

    for (const b of boxes) {
      const geo = new THREE.BoxGeometry(b.L * MM_TO_M, b.H * MM_TO_M, b.D * MM_TO_M);
      const hex = b.colore ? (b.colore[0] << 16) | (b.colore[1] << 8) | b.colore[2] : undefined;
      const m = new THREE.Mesh(geo, materialeDi(b.kind, hex));
      m.position.set(b.cx * MM_TO_M, b.cz * MM_TO_M, b.cy * MM_TO_M);
      m.rotation.y = -b.ang;
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData = { id: b.id, wall: b.wall, kind: b.kind };
      gruppo.add(m);
    }
    scene.add(gruppo);
  }

  return { setBoxes, camera, controls };
}
