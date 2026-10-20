// Vista frontale di un vano (porta, finestra, scorrevole): la camera si mette davanti al vano, perpendicolare al
// muro, con il vano nella parte SINISTRA dello schermo; a destra resta lo spazio per il pannello degli infissi.
// Funzione pura, in mm del piano: x, y in pianta, z = quota. La vista converte in metri.

// op: vano; wall: muro; camera: posizione attuale [x, y, z] (sceglie il lato del muro da cui guardare)
// opzioni: fovDeg (campo verticale), aspetto (larghezza/altezza), xSchermo (dove deve cadere il centro del vano, 0..1),
//          riempimento (frazione dell'altezza utile occupata dal vano)
export function inquadraturaFrontale(op, wall, camera, { fovDeg = 42, aspetto = 16 / 9, xSchermo = 0.3, riempimento = 0.62, distanzaMin = 1600 } = {}) {
  const L = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
  const ux = (wall.b[0] - wall.a[0]) / L, uy = (wall.b[1] - wall.a[1]) / L;
  const s = op.offset + op.width / 2;
  const C = [wall.a[0] + ux * s, wall.a[1] + uy * s, op.sill + op.height / 2];
  // normale verso il lato in cui si trova la camera
  let nx = -uy, ny = ux;
  if (camera && (camera[0] - C[0]) * nx + (camera[1] - C[1]) * ny < 0) { nx = -nx; ny = -ny; }
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  // distanza: il vano (con margine) deve stare nell'altezza utile e nella meta' sinistra dello schermo
  const hNec = (op.height * 1.15) / riempimento;
  const wNec = (op.width * 1.3) / (2 * xSchermo * aspetto);
  const d = Math.max(distanzaMin, Math.max(hNec, wNec) / (2 * tanV));
  // a destra sullo schermo: la camera guarda verso -n, destra = (ny, -nx) in pianta
  const rx = ny, ry = -nx;
  const mezzaLarghezza = d * tanV * aspetto;
  const delta = (0.5 - xSchermo) * 2 * mezzaLarghezza;
  const zOcchio = Math.max(1350, C[2]);
  return {
    centro: C,
    normale: [nx, ny],
    distanza: d,
    camera: [C[0] + nx * d + rx * delta, C[1] + ny * d + ry * delta, zOcchio],
    bersaglio: [C[0] + rx * delta, C[1] + ry * delta, zOcchio],
  };
}

// Posizione orizzontale (0..1) di un punto sullo schermo, con camera prospettica orizzontale (per i test)
export function xSulloSchermo(punto, inq, { fovDeg = 42, aspetto = 16 / 9 } = {}) {
  const [cx, cy] = inq.camera, [tx, ty] = inq.bersaglio;
  const fx = tx - cx, fy = ty - cy;
  const fl = Math.hypot(fx, fy);
  const f = [fx / fl, fy / fl];
  const r = [-f[1], f[0]]; // destra sullo schermo (in Three.js: avanti x alto, con y del piano = Z del mondo)
  const dx = punto[0] - cx, dy = punto[1] - cy;
  const avanti = dx * f[0] + dy * f[1];
  const lato = dx * r[0] + dy * r[1];
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  return 0.5 + lato / (avanti * tanV * aspetto) / 2;
}
