// Geometria del tracciamento su immagine. Pura: nessun DOM.
// Un punto immagine (px) diventa un punto piano in mm INTERI con una calibrazione:
//   origine = un punto noto (px), scala = distanza nota in mm tra due punti.
// Il tracciamento e' isotropo (stessa scala in x e y): l'immagine non deve essere deformata.

// Calibrazione da: origine (px), secondo punto (px), distanza reale tra i due punti (mm).
export function makeCalibration(origine, secondo, distanzaMm) {
  if (!(distanzaMm > 0) || !Number.isFinite(distanzaMm)) throw new Error("distanza di calibrazione non valida");
  const dx = secondo[0] - origine[0];
  const dy = secondo[1] - origine[1];
  const distPx = Math.hypot(dx, dy);
  if (distPx < 1) throw new Error("i due punti di calibrazione coincidono");
  return { origine: [origine[0], origine[1]], mmPerPx: distanzaMm / distPx };
}

// Px -> mm. snapMm = 0 disattiva lo snap; altrimenti arrotonda alla griglia (mm interi).
export function pxToMm(pt, cal, snapMm = 0) {
  let x = (pt[0] - cal.origine[0]) * cal.mmPerPx;
  let y = (pt[1] - cal.origine[1]) * cal.mmPerPx;
  if (snapMm > 0) {
    x = Math.round(x / snapMm) * snapMm;
    y = Math.round(y / snapMm) * snapMm;
  }
  return [Math.round(x), Math.round(y)];
}

// Proiezione di un punto (mm) sull'asse di un muro a->b.
// Restituisce la distanza lungo il muro (offset da a, mm intero) e la distanza perpendicolare (mm).
export function proiettaSuMuro(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const rx = p[0] - a[0];
  const ry = p[1] - a[1];
  const along = rx * ux + ry * uy;
  const across = -rx * uy + ry * ux;
  return { offset: Math.round(along), distanza: Math.round(Math.abs(across)) };
}

// Muro piu' vicino a un punto: restituisce id, distanza perpendicolare e offset, o null.
export function muroPiuVicino(p, muri, tolleranzaMm) {
  let best = null;
  for (const w of muri) {
    const pr = proiettaSuMuro(p, w.a, w.b);
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const alongFull = pr.offset >= -tolleranzaMm && pr.offset <= L + tolleranzaMm;
    if (!alongFull) continue;
    if (!best || pr.distanza < best.distanza) best = { id: w.id, ...pr };
  }
  if (!best || best.distanza > tolleranzaMm) return null;
  return best;
}

// Vano da due clic sullo stesso muro: offset e larghezza interi in mm.
export function vanoDaClic(p1Mm, p2Mm, wall) {
  const s1 = proiettaSuMuro(p1Mm, wall.a, wall.b).offset;
  const s2 = proiettaSuMuro(p2Mm, wall.a, wall.b).offset;
  const offset = Math.min(s1, s2);
  const width = Math.abs(s2 - s1);
  return { offset, width };
}
