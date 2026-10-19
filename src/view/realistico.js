// Stile "Fotorealistico": materiali fisici (PBR) con texture procedurali, rilievo delle pareti,
// vetri con trasmissione reale, luce solare calda e cielo diurno. Nessuna immagine esterna.
import * as THREE from "three";

// Rumore deterministico su canvas: base per la mappa di rilievo (bump) dell'intonaco.
function rumore(size, seme, intensita) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  let s = seme >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * intensita;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}

export function texturaRilievo() {
  return rumore(512, 19, 46);
}

// Materiale fisico per tipo di elemento. "alta" abilita la trasmissione reale dei vetri.
export function materialeRealistico(kind, { clip, texParquet, texIntonaco, rilievo, alta }) {
  const base = { clippingPlanes: clip, clipShadows: !!clip };
  switch (kind) {
    case "vetro":
      return alta
        ? new THREE.MeshPhysicalMaterial({ ...base, color: 0xffffff, roughness: 0.02, metalness: 0, transmission: 0.95, thickness: 0.02, ior: 1.5, specularIntensity: 1, depthWrite: true })
        : new THREE.MeshPhysicalMaterial({ ...base, color: 0xdff3ff, transparent: true, opacity: 0.35, roughness: 0.03, metalness: 0, depthWrite: false });
    case "pavimento":
      return new THREE.MeshStandardMaterial({ ...base, map: texParquet, roughness: 0.42, metalness: 0, envMapIntensity: 0.9 });
    case "telaio":
    case "telaio_legno":
    case "anta":
    case "anta_legno":
      return new THREE.MeshStandardMaterial({ ...base, color: kind.includes("legno") ? 0xb98a5c : 0xf1efe9, roughness: 0.38, metalness: 0.05 });
    case "telaio_scrigno":
    case "binario":
      return new THREE.MeshStandardMaterial({ ...base, color: 0x2a2e35, roughness: 0.3, metalness: 0.7 });
    case "vetro_fume":
      return new THREE.MeshPhysicalMaterial({ ...base, color: 0x3a3d42, roughness: 0.05, transmission: alta ? 0.6 : 0, transparent: !alta, opacity: alta ? 1 : 0.6, thickness: 0.02, depthWrite: !alta });
    case "maniglia":
      return new THREE.MeshStandardMaterial({ ...base, color: 0xc7ccd4, roughness: 0.22, metalness: 1 });
    case "arredo":
      return new THREE.MeshStandardMaterial({ ...base, color: 0xffffff, roughness: 0.65, metalness: 0 });
    default: // muri: intonaco con rilievo leggero
      return new THREE.MeshStandardMaterial({
        ...base, color: 0xf4f0e8, map: texIntonaco, bumpMap: rilievo, bumpScale: 0.6, roughness: 0.9, metalness: 0,
      });
  }
}
