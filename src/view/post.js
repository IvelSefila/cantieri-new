// Post-elaborazione della vista: occlusione ambientale (SSAO) negli angoli, bagliori sui riflessi (bloom),
// uscita con tone mapping corretto. Attiva per qualita' media e alta; la qualita' bassa disegna direttamente.
// Tutto nel browser, nessuna risorsa esterna: moduli di three@0.160.0 in vendor/three/addons.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

// Parametri per livello di qualita'. Il bloom e' solo sul livello alto (costa un passaggio di sfocatura).
export const POST = {
  basso: { attivo: false },
  medio: { attivo: true, ssao: true, bloom: false, raggioAO: 0.35, forza: 0.6 },
  alto: { attivo: true, ssao: true, bloom: true, raggioAO: 0.5, forza: 0.9, sogliaBloom: 0.92, forzaBloom: 0.18 },
};

export function creaPost(renderer, scene, camera) {
  let composer = null;
  let ssao = null;
  let bloom = null;
  let livello = "basso";

  function costruisci() {
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w / renderer.getPixelRatio(), h / renderer.getPixelRatio());
    composer.addPass(new RenderPass(scene, camera));
    const p = POST[livello];
    ssao = new SSAOPass(scene, camera, w, h);
    ssao.kernelRadius = p.raggioAO * 16;
    ssao.minDistance = 0.001;
    ssao.maxDistance = 0.12;
    ssao.output = SSAOPass.OUTPUT.Default;
    ssao.enabled = !!p.ssao;
    composer.addPass(ssao);
    bloom = new UnrealBloomPass(new THREE.Vector2(w, h), p.forzaBloom ?? 0, 0.4, p.sogliaBloom ?? 1);
    bloom.enabled = !!p.bloom;
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  function imposta(nuovo) {
    livello = POST[nuovo] ? nuovo : "basso";
    composer = null;
    if (POST[livello].attivo) costruisci();
  }

  function dimensiona(w, h) {
    if (!composer) return;
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    ssao?.setSize(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  }

  return {
    attivo: () => !!composer,
    imposta,
    dimensiona,
    // Disegna la scena: con post-elaborazione passa dal compositore, altrimenti renderer diretto
    disegna() {
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
    livello: () => livello,
  };
}
