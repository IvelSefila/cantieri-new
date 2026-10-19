// Test DXF: file sintetici costruiti nel test (nessun disegno reale del progetto nel repository).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDxf } from "../src/io/dxf.js";
import { dxfToPlan } from "../src/io/toPlan.js";
import { buildModel } from "../src/core/build.js";
import { validatePlan, wallLengthMm } from "../src/core/model.js";

// Costruisce un DXF ASCII: righe "codice" / "valore".
function dxf({ insunits = 6, entita }) {
  const r = [];
  const add = (c, v) => r.push(String(c), String(v));
  add(0, "SECTION"); add(2, "HEADER");
  add(9, "$INSUNITS"); add(70, insunits);
  add(0, "ENDSEC");
  add(0, "SECTION"); add(2, "ENTITIES");
  for (const e of entita) e(add);
  add(0, "ENDSEC"); add(0, "EOF");
  return r.join("\n") + "\n";
}

const linea = (layer, x1, y1, x2, y2) => (add) => {
  add(0, "LINE"); add(8, layer); add(10, x1); add(20, y1); add(11, x2); add(21, y2);
};
const lwpoly = (layer, pts, chiusa) => (add) => {
  add(0, "LWPOLYLINE"); add(8, layer); add(90, pts.length); add(70, chiusa ? 1 : 0);
  for (const [x, y] of pts) { add(10, x); add(20, y); }
};
const poly = (layer, pts, chiusa) => (add) => {
  add(0, "POLYLINE"); add(8, layer); add(70, chiusa ? 1 : 0); add(10, 0); add(20, 0);
  for (const [x, y] of pts) { add(0, "VERTEX"); add(8, layer); add(10, x); add(20, y); }
  add(0, "SEQEND");
};

const RETTANGOLO = [[0, 0], [22, 0], [22, 14], [0, 14]];

test("LWPOLYLINE chiusa con punto di chiusura duplicato: un solo contorno da 4 vertici", () => {
  const txt = dxf({ entita: [lwpoly("PERIM", [...RETTANGOLO, [0, 0]], true)] });
  const p = parseDxf(txt);
  assert.equal(p.entities.length, 1);
  assert.equal(p.entities[0].punti.length, 4);
  assert.equal(p.entities[0].chiusa, true);
});

test("POLYLINE vecchio stile (VERTEX/SEQEND) letta come contorno, senza coordinate dell'intestazione", () => {
  const txt = dxf({ entita: [poly("PERIM", RETTANGOLO, true)] });
  const p = parseDxf(txt);
  assert.equal(p.entities.length, 1);
  assert.deepEqual(p.entities[0].punti, RETTANGOLO);
});

test("asse: il perimetro resta sulle coordinate del DXF, in mm interi", () => {
  const txt = dxf({ entita: [lwpoly("PERIM", RETTANGOLO, true)] });
  const { plan, check } = dxfToPlan(parseDxf(txt), { riferimento: "asse", spessoreDefault: 280 });
  assert.equal(check.ok, true, check.errors.join("; "));
  assert.equal(plan.walls.length, 4);
  const coords = plan.walls.flatMap((w) => [...w.a, ...w.b]);
  assert.ok(coords.every(Number.isInteger));
  assert.ok(coords.includes(22000) && coords.includes(14000));
});

test("faccia esterna: il contorno si sposta di t/2 verso l'interno, angoli chiusi (miter)", () => {
  const txt = dxf({ entita: [lwpoly("PERIM", RETTANGOLO, true)] });
  const { plan } = dxfToPlan(parseDxf(txt), { riferimento: "faccia_esterna", spessoreDefault: 280 });
  const xs = plan.walls.flatMap((w) => [w.a[0], w.b[0]]);
  const ys = plan.walls.flatMap((w) => [w.a[1], w.b[1]]);
  assert.equal(Math.min(...xs), 140);
  assert.equal(Math.max(...xs), 21860);
  assert.equal(Math.min(...ys), 140);
  assert.equal(Math.max(...ys), 13860);
  // i muri si toccano agli angoli: ogni estremo coincide con l'estremo di un altro muro
  for (const w of plan.walls) {
    const tocca = plan.walls.some((o) => o !== w && ((o.a[0] === w.a[0] && o.a[1] === w.a[1]) || (o.b[0] === w.a[0] && o.b[1] === w.a[1])));
    assert.ok(tocca, `angolo non chiuso in ${w.id}`);
  }
});

test("unita' mm (INSUNITS 4): nessuna conversione", () => {
  const mm = [[0, 0], [22000, 0], [22000, 14000], [0, 14000]];
  const { plan } = dxfToPlan(parseDxf(dxf({ insunits: 4, entita: [lwpoly("PERIM", mm, true)] })), { riferimento: "asse", spessoreDefault: 280 });
  assert.ok(plan.walls.some((w) => w.a[0] === 22000 && w.a[1] === 0));
});

test("valori non interi in mm: arrotondati e contati nel report, mai in silenzio", () => {
  // 0.0005 m = 0.5 mm: non intero
  const txt = dxf({ entita: [linea("SPINE", 0.0005, 0, 10, 0)] });
  const { plan, report } = dxfToPlan(parseDxf(txt), { riferimento: "asse", spessoreDefault: 250 });
  assert.ok(report.arrotondamenti >= 1);
  assert.ok(report.scostamento_max_mm >= 0.4);
  assert.ok(plan.walls.every((w) => Number.isInteger(w.a[0]) && Number.isInteger(w.b[0])));
});

test("layer con spessore dispari: rifiutato con avviso, nessun muro generato", () => {
  const txt = dxf({ entita: [linea("PARI", 0, 0, 5, 0), linea("DISPARI", 0, 1, 5, 1)] });
  const { plan, report } = dxfToPlan(parseDxf(txt), { riferimento: "asse", spessori: { DISPARI: 151 } });
  assert.equal(plan.walls.length, 1);
  assert.ok(report.avvisi.some((a) => a.includes("DISPARI")));
});

test("flusso completo: DXF -> piano -> modello con muri interi e nessun vano", () => {
  const txt = dxf({
    entita: [
      lwpoly("PERIM", RETTANGOLO, true),
      linea("SPINE", 9.625, 0, 9.625, 14),
    ],
  });
  const { plan, check } = dxfToPlan(parseDxf(txt), { riferimento: "faccia_esterna", spessori: { SPINE: 250 }, spessoreDefault: 280 });
  assert.equal(check.ok, true, check.errors.join("; "));
  const res = buildModel(plan, { items: [] });
  assert.equal(res.ok, true);
  const L = plan.walls.map((w) => wallLengthMm(w));
  assert.ok(L.every(Number.isInteger));
  assert.ok(res.boxes.length >= plan.walls.length);
});
