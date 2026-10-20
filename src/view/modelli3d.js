// Modelli 3D dettagliati: trasforma le PARTI (src/core/infissi3d.js, src/core/arredi.js) in mesh Three.js con
// materiali fisici e texture procedurali (legno, tessuto, inox spazzolato, pietra) o foto del catalogo CDI.
// Geometrie unitarie condivise: ogni parte e' una mesh scalata. Materiali in cache per chiave.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { marmo, fotoFile } from "./materials.js?v=v20261020bo";
import { LIBRERIA_3D, dimensioniArredo } from "../core/arredi.js?v=v20261020bo";

// Un glTF per url, caricato una sola volta e clonato per ogni arredo
const GLB = new Map();
function modelloGlb(url) {
  if (!GLB.has(url)) {
    GLB.set(url, new Promise((ok, ko) => new GLTFLoader().load(url, (g) => ok(g.scene), undefined, ko)));
  }
  return GLB.get(url);
}

const MM = 0.001;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CIL = new THREE.CylinderGeometry(1, 1, 1, 28);
const SFERA = new THREE.SphereGeometry(1, 24, 16);

function rng(seme) {
  let s = seme >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function canvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d") };
}

function tex(c, ripeti = [1, 1], srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ripeti[0], ripeti[1]);
  t.anisotropy = 8;
  return t;
}

// Venatura del legno (grigio chiaro su bianco: si tinge con il colore del materiale)
const TEXTURE = {};
function legnoTex() {
  if (TEXTURE.legno) return TEXTURE.legno;
  const { c, ctx } = canvas(512, 1024);
  const r = rng(21);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 220; i++) {
    const x = r() * 512;
    ctx.strokeStyle = `rgba(80,55,30,${0.04 + r() * 0.1})`;
    ctx.lineWidth = 0.6 + r() * 2.4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= 1024; y += 64) ctx.lineTo(x + Math.sin(y / 90 + i) * (2 + r() * 6), y);
    ctx.stroke();
  }
  return (TEXTURE.legno = tex(c, [1, 1]));
}
function tessutoTex() {
  if (TEXTURE.tessuto) return TEXTURE.tessuto;
  const { c, ctx } = canvas(256, 256);
  const img = ctx.createImageData(256, 256);
  const r = rng(5);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const trama = ((x % 4 < 2) !== (y % 4 < 2) ? 14 : 0) + (r() - 0.5) * 18;
    const v = 230 + trama;
    const i = (y * 256 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (TEXTURE.tessuto = tex(c, [6, 6]));
}
function spazzolatoTex() {
  if (TEXTURE.spazzolato) return TEXTURE.spazzolato;
  const { c, ctx } = canvas(512, 64);
  const r = rng(9);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},255,0.05)`;
    ctx.fillRect(0, r() * 64, 512, 1);
  }
  return (TEXTURE.spazzolato = tex(c, [1, 4], false));
}

let AMBIENTE = null;
// Mappa d'ambiente per riflessi (vetri, inox, specchi): generata una volta con il renderer della scena
export function preparaAmbiente(renderer) {
  if (AMBIENTE || !renderer) return AMBIENTE;
  const pm = new THREE.PMREMGenerator(renderer);
  AMBIENTE = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  return AMBIENTE;
}

const caricatore = new THREE.TextureLoader();
const FOTO = new Map();
function foto(path) {
  if (!FOTO.has(path)) {
    const t = caricatore.load(path);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    FOTO.set(path, t);
  }
  return FOTO.get(path);
}

const CACHE = new Map();
function chiaro(hex) {
  const c = new THREE.Color(hex);
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

// Materiale per chiave. opzioni: { colore, clip (piani di taglio), alta (qualita' alta: trasmissione reale) }
export function materiale(chiave, { colore, clip = null, alta = false } = {}) {
  const k = `${chiave}|${colore ?? ""}|${clip ? "c" : ""}|${alta ? "a" : ""}`;
  if (CACHE.has(k)) return CACHE.get(k);
  const base = { clippingPlanes: clip, clipShadows: !!clip, envMap: AMBIENTE };
  let m;
  switch (chiave) {
    case "telaio": {
      const pvc = colore && chiaro(colore) > 0.8;
      m = new THREE.MeshStandardMaterial({ ...base, color: colore ?? "#3a3d42", roughness: pvc ? 0.38 : 0.42, metalness: pvc ? 0 : 0.35, envMapIntensity: 0.8 });
      break;
    }
    case "telaio_porta": m = new THREE.MeshStandardMaterial({ ...base, color: colore ?? "#2f3237", roughness: 0.45, metalness: 0.4 }); break;
    case "vetro":
      m = alta
        ? new THREE.MeshPhysicalMaterial({ ...base, color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 0.94, thickness: 0.02, ior: 1.5, envMapIntensity: 1.2 })
        : new THREE.MeshPhysicalMaterial({ ...base, color: 0xcfe8f3, transparent: true, opacity: 0.28, roughness: 0.03, metalness: 0.1, clearcoat: 1, depthWrite: false, envMapIntensity: 1.4 });
      break;
    case "vetro_satinato": m = new THREE.MeshPhysicalMaterial({ ...base, color: 0xeef3f4, transparent: true, opacity: 0.82, roughness: 0.55, metalness: 0, transmission: alta ? 0.5 : 0, depthWrite: true }); break;
    case "vetro_fume": m = new THREE.MeshPhysicalMaterial({ ...base, color: 0x2b2d31, transparent: true, opacity: 0.66, roughness: 0.06, clearcoat: 0.8, depthWrite: false }); break;
    case "vetro_nero": m = new THREE.MeshStandardMaterial({ ...base, color: 0x0b0c0e, roughness: 0.08, metalness: 0.3 }); break;
    case "veneziana": m = new THREE.MeshStandardMaterial({ ...base, color: 0xd9dcdf, roughness: 0.4, metalness: 0.5 }); break;
    case "inox": case "metallo":
      m = new THREE.MeshStandardMaterial({ ...base, color: colore ?? 0xc9ced6, roughness: 0.28, metalness: 1, roughnessMap: spazzolatoTex(), envMapIntensity: 1.1 });
      break;
    case "metallo_nero": m = new THREE.MeshStandardMaterial({ ...base, color: 0x1d1f23, roughness: 0.45, metalness: 0.7 }); break;
    case "nero": case "fuga": case "zoccolo": m = new THREE.MeshStandardMaterial({ ...base, color: 0x16181b, roughness: 0.7, metalness: 0.1 }); break;
    case "bianco_lucido": m = new THREE.MeshStandardMaterial({ ...base, color: 0xf6f6f4, roughness: 0.2, metalness: 0 }); break;
    case "pietra": case "piano_pietra": {
      const t = marmo();
      m = new THREE.MeshStandardMaterial({ ...base, map: t, roughness: 0.25, metalness: 0, envMapIntensity: 0.6 });
      break;
    }
    case "laccato": m = new THREE.MeshStandardMaterial({ ...base, color: colore ?? "#efede8", roughness: 0.35, metalness: 0, envMapIntensity: 0.6 }); break;
    case "rovere": case "legno": {
      const col = colore ?? "#b98a5c";
      const liscio = chiaro(col) > 0.82 || chiaro(col) < 0.06;
      // Rovere fotografico (Poly Haven CC0) senza tinta scelta; con tinta il colore moltiplica la foto
      m = liscio
        ? new THREE.MeshStandardMaterial({ ...base, color: col, roughness: 0.4 })
        : new THREE.MeshStandardMaterial({
          ...base, color: colore ? col : 0xffffff,
          map: fotoFile("rovere_colore.webp"), normalMap: fotoFile("rovere_normale.webp", { lineare: true }),
          roughnessMap: fotoFile("rovere_rugosita.webp", { lineare: true }), roughness: 0.55, metalness: 0,
        });
      break;
    }
    case "tessuto": case "cuscino": case "tappeto":
      // Lino fotografico (Poly Haven CC0); la tinta scelta moltiplica la foto
      m = new THREE.MeshStandardMaterial({
        ...base, color: colore ?? 0xffffff,
        map: fotoFile("lino_colore.webp"), normalMap: fotoFile("lino_normale.webp", { lineare: true }),
        roughness: 0.95, metalness: 0, envMap: null,
      });
      break;
    case "materasso": case "lenzuolo": case "cuscino_bianco":
      m = new THREE.MeshStandardMaterial({ ...base, color: chiave === "lenzuolo" ? 0xe9e4da : 0xf7f5f0, map: tessutoTex(), roughness: 0.9, envMap: null });
      break;
    case "ceramica": m = new THREE.MeshPhysicalMaterial({ ...base, color: 0xf8f8f6, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }); break;
    case "ceramica_scura": m = new THREE.MeshPhysicalMaterial({ ...base, color: 0xe6e8ea, roughness: 0.15, clearcoat: 1 }); break;
    case "specchio": m = new THREE.MeshStandardMaterial({ ...base, color: 0xffffff, roughness: 0.02, metalness: 1, envMapIntensity: 1.6 }); break;
    case "acqua": m = new THREE.MeshPhysicalMaterial({ ...base, color: 0x9fd2e6, transparent: true, opacity: 0.55, roughness: 0.05 }); break;
    case "vaso": m = new THREE.MeshStandardMaterial({ ...base, color: 0xa8583c, roughness: 0.8 }); break;
    case "foglie": m = new THREE.MeshStandardMaterial({ ...base, color: colore ?? 0x3f6b45, roughness: 0.75, flatShading: true }); break;
    case "paralume": m = new THREE.MeshStandardMaterial({ ...base, color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 0.9, roughness: 0.9 }); break;
    case "libro": m = new THREE.MeshStandardMaterial({ ...base, color: colore ?? "#8c3b3b", roughness: 0.8 }); break;
    default: m = new THREE.MeshStandardMaterial({ ...base, color: colore ?? 0xcccccc, roughness: 0.6 });
  }
  CACHE.set(k, m);
  return m;
}

// Materiali di una scatola con la foto del catalogo sulle facce +n e -n (anta delle porte d'ingresso)
function materialiFoto(parte, opz) {
  const k = `foto|${parte.texture}|${opz.clip ? "c" : ""}`;
  if (CACHE.has(k)) return CACHE.get(k);
  const fronte = foto(parte.texture);
  // retro: una texture caricata a parte (un clone fatto prima del caricamento resta senza immagine)
  const retro = caricatore.load(parte.texture);
  retro.colorSpace = THREE.SRGBColorSpace;
  retro.anisotropy = 8;
  retro.wrapS = THREE.RepeatWrapping;
  retro.repeat.x = -1;
  const lato = materiale("laccato", { colore: parte.colore, clip: opz.clip });
  const base = { clippingPlanes: opz.clip, clipShadows: !!opz.clip, roughness: 0.45, metalness: 0.15, envMap: AMBIENTE, envMapIntensity: 0.5 };
  const arr = [lato, lato, lato, lato, new THREE.MeshStandardMaterial({ ...base, map: fronte }), new THREE.MeshStandardMaterial({ ...base, map: retro })];
  CACHE.set(k, arr);
  return arr;
}

function meshParte(p, opz, sostituto, assi) {
  // assi: "infisso" (s, z, n) oppure "arredo" (x, z, y)
  let mesh;
  let mat = sostituto ? sostituto(p) : p.mat === "foto" ? materialiFoto(p, opz) : materiale(p.mat, { colore: p.colore, clip: opz.clip, alta: opz.alta });
  // esterno dal lato n negativo: la faccia con la foto giusta e' l'altra
  if (p.facciaEsternaNeg && Array.isArray(mat)) mat = [mat[0], mat[1], mat[2], mat[3], mat[5], mat[4]];
  if (p.forma === "box") {
    const [a0, a1, b0, b1] = assi === "infisso" ? [p.s0, p.s1, p.n0, p.n1] : [p.x0, p.x1, p.y0, p.y1];
    mesh = new THREE.Mesh(BOX, mat);
    mesh.scale.set(Math.max(1, a1 - a0) * MM, Math.max(1, p.z1 - p.z0) * MM, Math.max(1, b1 - b0) * MM);
    // anta specchiata: scala negativa sull'asse dell'anta, la foto e la maniglia si girano insieme
    if (p.specchio) mesh.scale.x *= -1;
    mesh.position.set(((a0 + a1) / 2) * MM, ((p.z0 + p.z1) / 2) * MM, ((b0 + b1) / 2) * MM);
  } else if (p.forma === "cil") {
    const [a, b] = assi === "infisso" ? [p.s, p.n] : [p.x, p.y];
    mesh = new THREE.Mesh(CIL, mat);
    mesh.scale.set(p.r * MM, (p.z1 - p.z0) * MM, p.r * MM);
    mesh.position.set(a * MM, ((p.z0 + p.z1) / 2) * MM, b * MM);
  } else if (p.forma === "cilN") {
    mesh = new THREE.Mesh(CIL, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.scale.set(p.r * MM, (p.n1 - p.n0) * MM, p.r * MM);
    mesh.position.set(p.s * MM, p.z * MM, ((p.n0 + p.n1) / 2) * MM);
  } else {
    mesh = new THREE.Mesh(SFERA, mat);
    mesh.scale.setScalar(p.r * MM);
    mesh.position.set(p.x * MM, p.z * MM, p.y * MM);
  }
  const trasparente = ["vetro", "vetro_fume", "vetro_satinato", "acqua"].includes(p.mat);
  mesh.castShadow = !trasparente;
  mesh.receiveShadow = true;
  return mesh;
}

// Gruppo di un infisso nel mondo: origine all'inizio del vano sull'asse del muro, assi (s, z, n)
export function gruppoInfisso(parti, op, wall, opz = {}, sostituto = null) {
  const L = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
  const ux = (wall.b[0] - wall.a[0]) / L, uy = (wall.b[1] - wall.a[1]) / L;
  const g = new THREE.Group();
  g.position.set((wall.a[0] + ux * op.offset) * MM, 0, (wall.a[1] + uy * op.offset) * MM);
  g.rotation.y = -Math.atan2(uy, ux);
  const dati = { kind: "infisso", id: `${op.id}:infisso`, vano: op.id, wall: wall.id };
  for (const p of parti) {
    const m = meshParte(p, opz, sostituto, "infisso");
    m.userData = { ...dati, ruolo: p.ruolo };
    g.add(m);
  }
  g.userData = dati;
  return g;
}

// Gruppo di un arredo: centro in pianta (x, y), rotazione in gradi (senso orario in pianta)
export function gruppoArredo(parti, a, opz = {}, sostituto = null) {
  const g = new THREE.Group();
  g.position.set(a.x * MM, 0, a.y * MM);
  g.rotation.y = -((a.rot ?? 0) * Math.PI) / 180;
  const dati = { kind: "arredo", id: a.id, tipo: a.tipo, wall: null };
  const segnaposti = [];
  for (const p of parti) {
    const m = meshParte(p, opz, sostituto, "arredo");
    m.userData = dati;
    g.add(m);
    segnaposti.push(m);
  }
  g.userData = dati;
  const def = LIBRERIA_3D[a.tipo];
  if (def?.modello) g.userData.pronto = collocaModello(g, def.modello, dimensioniArredo(a), segnaposti);
  return g;
}

// Modello glTF di un arredo: scalato sull'ingombro L x D x H del progetto e centrato in pianta; il segnaposto si nasconde al caricamento
function collocaModello(g, url, { L, D, H }, segnaposti) {
  return modelloGlb(url).then((scena) => {
    const obj = scena.clone(true);
    obj.updateMatrixWorld(true);
    const misura = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    obj.scale.set((L * MM) / misura.x, (H * MM) / misura.y, (D * MM) / misura.z);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    obj.position.set(-c.x, -box.min.y, -c.z);
    segnaposti.forEach((m) => { m.visible = false; });
    g.add(obj);
    g.userData.modelloCaricato = true;
  }).catch(() => { /* file assente: resta il segnaposto */ });
}

// Miniature 3D (per le schede del catalogo): un renderer fuori schermo con sfondo trasparente.
// La miniatura si fa solo quando il modello e le sue texture sono caricati, altrimenti verrebbe nera.
let RENDER_MINI = null;
const MINIATURE = new Map();
const ATTESA_MAX_MS = 8000;

// Attende che tutte le texture del gruppo abbiano l'immagine (le foto arrivano in modo asincrono)
function texturePronte(gruppo) {
  const mancanti = [];
  gruppo.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap"]) {
        const t = m?.[k];
        if (t && !t.image) mancanti.push(t);
      }
    }
  });
  return Promise.all(mancanti.map((t) => new Promise((ok) => {
    const inizio = performance.now();
    const controlla = () => (t.image || performance.now() - inizio > ATTESA_MAX_MS ? ok() : setTimeout(controlla, 80));
    controlla();
  })));
}

// Miniatura PNG con sfondo trasparente: la scheda la mostra dentro la sua forma. Ritorna Promise<string|null>.
// Le miniature si renderizzano una alla volta: la scena e' condivisa, altrimenti i modelli si sovrapporrebbero
let CODA_MINIATURE = Promise.resolve();
export function miniatura(chiave, costruisci, opzioni = {}) {
  if (MINIATURE.has(chiave)) return Promise.resolve(MINIATURE.get(chiave));
  const esito = CODA_MINIATURE.then(() => renderMiniatura(chiave, costruisci, opzioni));
  CODA_MINIATURE = esito.catch(() => null);
  return esito;
}

async function renderMiniatura(chiave, costruisci, { larghezza = 260, altezza = 260 } = {}) {
  if (MINIATURE.has(chiave)) return MINIATURE.get(chiave);
  try {
    if (!RENDER_MINI) {
      const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true });
      r.setSize(larghezza, altezza, false);
      r.setClearColor(0x000000, 0);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.1;
      const sc = new THREE.Scene();
      const pm = new THREE.PMREMGenerator(r);
      sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      // Luce neutra (niente tinta blu dal suolo): chiave dall'alto a sinistra, riempimento da destra
      sc.add(new THREE.HemisphereLight(0xffffff, 0x9a9ca3, 1.0));
      const sole = new THREE.DirectionalLight(0xffffff, 2.6);
      sole.position.set(-3, 5, 4);
      sc.add(sole);
      const riempi = new THREE.DirectionalLight(0xffffff, 0.9);
      riempi.position.set(4, 2, 2);
      sc.add(riempi);
      RENDER_MINI = { r, sc, cam: new THREE.PerspectiveCamera(28, larghezza / altezza, 0.01, 50) };
    }
    const { r, sc, cam } = RENDER_MINI;
    const g = costruisci();
    sc.add(g);
    if (g.userData.pronto) await g.userData.pronto;
    await texturePronte(g);
    // Metalli (inox, acciaio) riflettono solo l'ambiente, che in miniatura e' troppo scuro e li rende neri.
    // Si schiarisce il riflesso solo sulle copie dei materiali usate da questa miniatura, non su quelli della scena.
    const copie = [];
    g.traverse((o) => {
      if (!o.isMesh) return;
      const sost = [].concat(o.material).map((m) => {
        if (!m.isMeshStandardMaterial || !(m.metalness > 0.3)) return m;
        const c2 = m.clone();
        c2.envMapIntensity = (m.envMapIntensity ?? 1) * 2.4;
        copie.push(c2);
        return c2;
      });
      o.material = Array.isArray(o.material) ? sost : sost[0];
    });
    g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g);
    const c = bb.getCenter(new THREE.Vector3());
    const dim = bb.getSize(new THREE.Vector3()).length();
    cam.position.set(c.x + dim * 0.85, c.y + dim * 0.55, c.z + dim * 1.05);
    cam.lookAt(c);
    r.render(sc, cam);
    const url = r.domElement.toDataURL("image/png");
    sc.remove(g);
    copie.forEach((m) => m.dispose());
    MINIATURE.set(chiave, url);
    return url;
  } catch {
    return null;
  }
}
