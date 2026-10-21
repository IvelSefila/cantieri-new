"""Tavole sintetiche con quote note, riproducibili; non sono rilievi reali.
Richiede Pillow e ReportLab nell'ambiente di authoring, non nell'applicazione.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

OUT = Path(__file__).resolve().parents[1] / 'tests/fixtures/planimetrie'
OUT.mkdir(parents=True, exist_ok=True)
RECT = [[0, 0], [6000, 0], [6000, 4000], [0, 4000]]
ELLE = [[0, 0], [8000, 0], [8000, 3000], [4000, 3000], [4000, 6000], [0, 6000]]

def plan(points, name):
    return dict(schema=1, unit='mm', name=name, altezza_muri=2800,
                walls=[dict(id=f'w{i}', a=a, b=points[(i+1) % len(points)], t=200) for i, a in enumerate(points)], openings=[])

for name, points in [('rettangolo', RECT), ('elle', ELLE)]:
    (OUT / f'{name}.json').write_text(json.dumps(plan(points, name)), encoding='utf-8')
    # Una polilinea in metri, una in millimetri: verifica $INSUNITS.
    unit, divisor = (6, 1000) if name == 'rettangolo' else (4, 1)
    pairs = [(0, 'SECTION'), (2, 'HEADER'), (9, '$INSUNITS'), (70, unit), (0, 'ENDSEC'),
             (0, 'SECTION'), (2, 'ENTITIES'), (0, 'LWPOLYLINE'), (8, 'MURI'), (90, len(points)), (70, 1)]
    for x, y in points:
        pairs.extend([(10, x/divisor), (20, y/divisor)])
    pairs.extend([(0, 'ENDSEC'), (0, 'EOF')])
    (OUT / f'{name}.dxf').write_text('\n'.join(str(v) for p in pairs for v in p)+'\n', encoding='ascii')

pages = []
c = canvas.Canvas(str(OUT / 'vettoriale.pdf'), pagesize=(595.276, 841.89), invariant=1)
for points, rotation in [(RECT, 0), (ELLE, 90)]:
    c.setPageRotation(rotation)
    c.setFont('Helvetica', 11)
    top=530 if rotation else 760
    c.drawString(40, top, 'TAVOLA SINTETICA - assi muri - scala 1:100')
    c.drawString(40, top-20, 'Quote reali in mm: ' + ' / '.join(str(int(((a[0]-points[(i+1)%len(points)][0])**2+(a[1]-points[(i+1)%len(points)][1])**2)**.5)) for i,a in enumerate(points)))
    # Traslazione e scala nel content stream, verificate dalla pipeline PDF.
    c.saveState(); c.translate(70, 120); c.scale(72/25.4/100, 72/25.4/100)
    c.setLineWidth(25)
    p = c.beginPath(); p.moveTo(*points[0])
    for q in points[1:]: p.lineTo(*q)
    p.close(); c.drawPath(p, stroke=1, fill=0); c.restoreState()
    pages.append(dict(rotation=rotation, points_pdf=[[70+x*72/25.4/100, 120+y*72/25.4/100] for x,y in points], lengths=[round(((a[0]-points[(i+1)%len(points)][0])**2+(a[1]-points[(i+1)%len(points)][1])**2)**.5) for i,a in enumerate(points)]))
    c.showPage()
c.save()

im = Image.new('RGB', (1000, 700), 'white'); d = ImageDraw.Draw(im)
d.text((100, 35), 'TAVOLA SINTETICA - assi 8000 x 4000 mm', fill='black')
d.line([(100,100), (900,100), (900,500), (100,500), (100,100)], fill='black', width=2)
for ext in ['png', 'jpg', 'webp']: im.save(OUT / f'scansione.{ext}')
c = canvas.Canvas(str(OUT / 'scansione.pdf'), pagesize=(595.276, 841.89), invariant=1)
c.drawImage(ImageReader(im), 40, 200, width=500, height=350)
c.showPage(); c.save()
(OUT / 'invalido.pdf').write_bytes(b'Questo non e un PDF valido')
(OUT / 'manifest.json').write_text(json.dumps(dict(pdf=pages, raster_points=[[100,100],[900,100],[900,500],[100,500]], raster_lengths=[8000,4000,8000,4000], raster_pdf_points=[[90,500],[490,500],[490,300],[90,300]]), indent=2), encoding='utf-8')
print(f'Fixture create in {OUT}')
