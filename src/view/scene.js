// Vista Three.js. Riceve scatole in millimetri dal core e le converte in metri SOLO per la resa.
// Il modello dati resta in mm interi: nessuna misura viene ricavata dalla scena.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MM_TO_M = 0.001;

const COLORI = {
  muro: 0xf5f3ee,
  muro_sotto: 0xe9e6df,
  muro_sopra: 0xe9e6df,
  telaio: 0x2c323b,
  anta: 0x3b4450,
  vetro: 0x9fd8f0,
  maniglia: 0xd0d5dc,
};

export function createViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xe9edf2);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
  camera.position.set(18, 22, 26);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(11, 1.2, 7);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9199, 1.0));
  const sole = new THREE.DirectionalLight(0xffffff, 0.9);
  sole.position.set(20, 40, 15);
  scene.add(sole);

  const griglia = new THREE.GridHelper(40, 40, 0xb0b8c2, 0xd0d6de);
  griglia.position.set(11, 0, 7);
  scene.add(griglia);

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

  // boxes: scatole del core, in mm. Piano (x, y) -> scena (x, z); altezza (cz) -> scena y.
  function setBoxes(boxes) {
    scene.remove(gruppo);
    gruppo.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    gruppo = new THREE.Group();
    const materiali = new Map();
    const mat = (kind) => {
      if (!materiali.has(kind)) {
        const trasparente = kind === "vetro";
        materiali.set(kind, new THREE.MeshStandardMaterial({
          color: COLORI[kind] ?? 0xffffff,
          transparent: trasparente,
          opacity: trasparente ? 0.35 : 1,
          roughness: 0.7,
        }));
      }
      return materiali.get(kind);
    };
    for (const b of boxes) {
      const geo = new THREE.BoxGeometry(b.L * MM_TO_M, b.H * MM_TO_M, b.D * MM_TO_M);
      const m = new THREE.Mesh(geo, mat(b.kind));
      m.position.set(b.cx * MM_TO_M, b.cz * MM_TO_M, b.cy * MM_TO_M);
      m.rotation.y = -b.ang;
      m.userData = { id: b.id, wall: b.wall, kind: b.kind };
      gruppo.add(m);
    }
    scene.add(gruppo);
  }

  return { setBoxes, camera, controls };
}
