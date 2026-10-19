// Materiali: texture procedurali subito visibili; quando arrivano le foto CC0 (assets/tex, Poly Haven) sostituiscono
// l'immagine della stessa texture, senza ricreare i materiali. Licenze in assets/tex/CREDITI.md.
import * as THREE from "three";

let alCaricamento = () => {};
export function onTexturaCaricata(fn) { alCaricamento = fn; }
const caricatore = new THREE.TextureLoader();
// Collega il file a una texture gia' creata: stessa istanza, nuova immagine
function fotoSu(tex, file) {
  if (!file) return tex;
  caricatore.load(`assets/tex/${file}`, (t) => {
    tex.image = t.image;
    tex.needsUpdate = true;
    alCaricamento();
  }, undefined, () => { /* file assente: resta la texture procedurale */ });
  return tex;
}

// Texture fotografica da assets/tex per materiali di arredo (stessa logica di fotoSu, texture nuova)
export function fotoFile(file, { lineare = false } = {}) {
  const t = caricatore.load(`assets/tex/${file}`, () => alCaricamento(), undefined, () => { /* file assente: nessuna mappa */ });
  if (!lineare) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

// Generatore pseudo-casuale deterministico (stessa scena = stessa grana, sempre).
function rng(seme) {
  let s = seme >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function tela(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext("2d") };
}

function texturaDa(c, ripeti) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(ripeti[0], ripeti[1]);
  t.anisotropy = 8;
  return t;
}

// Mappa delle normali dalla mappa dei rilievi (filtro Sobel): dona profondita' alle doghe e all'intonaco.
export function normaleDaRilievo(c, forza = 2) {
  const w = c.width, h = c.height;
  const src = c.getContext("2d").getImageData(0, 0, w, h).data;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  const img = ctx.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * forza, ny = -dy * forza, nz = 1;
    const l = Math.hypot(nx, ny, nz);
    const i = (y * w + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255;
    img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Parquet a doghe: doghe di larghezza fissa, tonalita' diversa per ogni doga, venature.
export function parquet(base = [200, 164, 118]) {
  const { c, ctx } = tela(1024, 1024);
  const r = rng(7);
  const doga = 128; // 4 doghe per 512 px
  for (let y = 0; y < 1024; y += 128) {
    for (let x = 0; x < 1024; x += doga) {
      const k = 1 + (r() - 0.5) * 0.12;
      const [R, G, B] = base.map((v) => Math.min(255, Math.round(v * k)));
      ctx.fillStyle = `rgb(${R},${G},${B})`;
      ctx.fillRect(x, y, doga, 128);
    }
  }
  // venature e giunti
  for (let i = 0; i < 1400; i++) {
    const x = r() * 1024;
    const y = r() * 1024;
    ctx.strokeStyle = `rgba(90,60,30,${0.05 + r() * 0.08})`;
    ctx.lineWidth = 0.6 + r() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 20 + r() * 60, y + (r() - 0.5) * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(60,40,20,0.35)";
  for (let y = 0; y < 1024; y += 128) ctx.fillRect(0, y, 1024, 2);
  for (let x = 0; x < 1024; x += doga) ctx.fillRect(x, 0, 2, 1024);
  // rilievo delle giunture: fessure scure leggermente incassate
  const rilievo = tela(1024, 1024);
  rilievo.ctx.fillStyle = "#808080";
  rilievo.ctx.fillRect(0, 0, 1024, 1024);
  rilievo.ctx.fillStyle = "#606060";
  for (let y = 0; y < 1024; y += 128) rilievo.ctx.fillRect(0, y, 1024, 3);
  for (let x = 0; x < 1024; x += doga) rilievo.ctx.fillRect(x, 0, 3, 1024);
  const t = texturaDa(c, [4, 4]);
  t.userData.normalMap = normaleDaRilievo(rilievo.c, 3);
  t.userData.normalMap.repeat.set(4, 4);
  fotoSu(t, "parquet_colore.webp");
  fotoSu(t.userData.normalMap, "parquet_normale.webp");
  t.userData.roughnessMap = fotoSu(texturaDa(c, [4, 4]), "parquet_rugosita.webp");
  return t;
}

// Intonaco chiaro con grana leggera.
export function intonaco(base = [246, 244, 239]) {
  const { c, ctx } = tela(512, 512);
  const r = rng(11);
  const img = ctx.createImageData(512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 10;
    img.data[i] = Math.min(255, base[0] + n);
    img.data[i + 1] = Math.min(255, base[1] + n);
    img.data[i + 2] = Math.min(255, base[2] + n);
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = texturaDa(c, [2, 2]);
  t.userData.normalMap = normaleDaRilievo(c, 1.5);
  t.userData.normalMap.repeat.set(2, 2);
  // solo la normale della foto: il colore resta bianco (la foto e' troppo calda per le pareti)
  fotoSu(t.userData.normalMap, "intonaco_normale.webp");
  return t;
}

// Marmo: fondo chiaro con venature grigie.
export function marmo() {
  const { c, ctx } = tela(512, 512);
  const r = rng(3);
  ctx.fillStyle = "#f3f2ee";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) {
    ctx.strokeStyle = `rgba(120,120,115,${0.08 + r() * 0.12})`;
    ctx.lineWidth = 1 + r() * 2;
    ctx.beginPath();
    let x = r() * 512;
    let y = r() * 512;
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += (r() - 0.5) * 90;
      y += (r() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return fotoSu(texturaDa(c, [1, 1]), "marmo_colore.webp");
}
