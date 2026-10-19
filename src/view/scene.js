// Vista Three.js. Riceve scatole in millimetri dal core e le converte in metri SOLO per la resa.
// Stili: solido, vetro (semi-trasparente con contorni), dollhouse (taglio a 1,30 m), vetro+dollhouse.
// Clic: restituisce il punto del piano in mm e l'eventuale elemento colpito (per modifica e selezione).
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { parquet, intonaco, marmo } from "./materials.js";

const MM_TO_M = 0.001;
const TAGLIO_DOLLHOUSE_MM = 1300;

export function createViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0xe9edf2);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
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
  Object.assign(sole.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 1, far: 120 });
  sole.shadow.bias = -0.0004;
  sole.shadow.normalBias = 0.02;
  sole.shadow.radius = 4;
  scene.add(sole);
  scene.add(new THREE.HemisphereLight(0xf5f8ff, 0x7a7f88, 0.35));

  const griglia = new THREE.GridHelper(60, 60, 0xb8c0ca, 0xd6dce4);
  griglia.position.y = -0.002;
  griglia.material.transparent = true;
  griglia.material.opacity = 0.5;
  scene.add(griglia);

  // Piano di lavoro: riceve i clic sul pavimento e mostra solo l'ombra.
  const piano = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.ShadowMaterial({ opacity: 0.12 }));
  piano.rotation.x = -Math.PI / 2;
  piano.position.y = -0.001;
  piano.receiveShadow = true;
  scene.add(piano);

  const texParquet = parquet();
  const texIntonaco = intonaco();
  const texMarmo = marmo();
  const taglio = [new THREE.Plane(new THREE.Vector3(0, -1, 0), TAGLIO_DOLLHOUSE_MM * MM_TO_M)];

  let stile = { vetro: false, dollhouse: false };
  let gruppo = new THREE.Group();
  scene.add(gruppo);
  let pickHandler = null;
  let ultime = [];

  const cache = new Map();
  // Materiale per tipo, colore e stile. Il colore e' un numero esadecimale (0xRRGGBB) oppure undefined.
  function materiale(kind, hex) {
    const chiave = `${kind}|${hex ?? ""}|${stile.vetro}|${stile.dollhouse}`;
    if (cache.has(chiave)) return cache.get(chiave);
    const base = { clippingPlanes: stile.dollhouse ? taglio : null, clipShadows: stile.dollhouse };
    let m;
    if (kind === "vetro") {
      m = new THREE.MeshStandardMaterial({ ...base, color: 0xbfe6f7, transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false });
    } else if (kind === "pavimento") {
      m = new THREE.MeshStandardMaterial({ ...base, color: hex ?? 0xffffff, map: hex === undefined ? texParquet : null, roughness: 0.55 });
    } else if (kind === "marmo") {
      m = new THREE.MeshStandardMaterial({ ...base, map: texMarmo, roughness: 0.25 });
    } else if (kind === "telaio") {
      m = new THREE.MeshStandardMaterial({ ...base, color: 0x2c323b, roughness: 0.4, metalness: 0.3 });
    } else if (kind === "anta") {
      m = new THREE.MeshStandardMaterial({ ...base, color: 0x3b4450, roughness: 0.45, metalness: 0.2 });
    } else if (kind === "maniglia") {
      m = new THREE.MeshStandardMaterial({ ...base, color: 0xd0d5dc, roughness: 0.25, metalness: 0.9 });
    } else if (kind === "arredo") {
      m = new THREE.MeshStandardMaterial({ ...base, color: hex ?? 0xcccccc, roughness: 0.7 });
    } else {
      // muri: in stile vetro diventano semi-trasparenti, con contorni a vista
      m = new THREE.MeshStandardMaterial({
        ...base, color: 0xf6f4ef, map: texIntonaco, roughness: 0.92,
        transparent: stile.vetro, opacity: stile.vetro ? 0.42 : 1, depthWrite: !stile.vetro,
      });
    }
    cache.set(chiave, m);
    return m;
  }

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

  // Clic senza trascinamento: punto del piano in mm + elemento colpito.
  const raycaster = new THREE.Raycaster();
  const puntatore = new THREE.Vector2();
  let inizio = null;
  renderer.domElement.addEventListener("pointerdown", (ev) => { inizio = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener("pointerup", (ev) => {
    if (!inizio || !pickHandler) return;
    const dist = Math.hypot(ev.clientX - inizio[0], ev.clientY - inizio[1]);
    inizio = null;
    if (dist > 5) return; // era una rotazione della vista
    const r = renderer.domElement.getBoundingClientRect();
    puntatore.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    puntatore.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(puntatore, camera);
    const hits = raycaster.intersectObjects(gruppo.children, false).filter((h) => h.object.userData && h.object.userData.id);
    const piani = raycaster.intersectObject(piano, false);
    const colpito = hits[0];
    const punto = colpito ? colpito.point : piani[0] ? piani[0].point : null;
    if (!punto) return;
    pickHandler({
      mm: [Math.round(punto.x / MM_TO_M), Math.round(punto.z / MM_TO_M)],
      id: colpito ? colpito.object.userData.id : null,
      kind: colpito ? colpito.object.userData.kind : null,
      wall: colpito ? colpito.object.userData.wall : null,
    });
  });

  // boxes: scatole in mm. Piano (x, y) -> scena (x, z); altezza cz -> scena y.
  function setBoxes(boxes) {
    ultime = boxes;
    scene.remove(gruppo);
    gruppo.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    gruppo = new THREE.Group();
    for (const b of boxes) {
      const geo = new THREE.BoxGeometry(b.L * MM_TO_M, b.H * MM_TO_M, b.D * MM_TO_M);
      const hex = b.colore ? (b.colore[0] << 16) | (b.colore[1] << 8) | b.colore[2] : undefined;
      const m = new THREE.Mesh(geo, materiale(b.kind, hex));
      m.position.set(b.cx * MM_TO_M, b.cz * MM_TO_M, b.cy * MM_TO_M);
      m.rotation.y = -b.ang;
      m.castShadow = true;
      m.receiveShadow = true;
      m.userData = { id: b.id, wall: b.wall, kind: b.kind };
      gruppo.add(m);
      if (stile.vetro && b.kind !== "vetro") {
        const bordi = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({ color: 0x1f2937, transparent: true, opacity: 0.55, clippingPlanes: stile.dollhouse ? taglio : null })
        );
        bordi.position.copy(m.position);
        bordi.rotation.copy(m.rotation);
        gruppo.add(bordi);
      }
    }
    scene.add(gruppo);
  }

  // Stile: "solido" | "vetro" | "dollhouse" | "vetro-dollhouse".
  function setStile(nome) {
    stile = { vetro: nome.includes("vetro"), dollhouse: nome.includes("dollhouse") };
    cache.clear();
    setBoxes(ultime);
  }

  function setPickHandler(fn) { pickHandler = fn; }

  return { setBoxes, setStile, setPickHandler, camera, controls };
}
