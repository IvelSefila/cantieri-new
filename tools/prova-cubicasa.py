"""Prova offline dei pesi ufficiali CubiCasa5K, senza integrazione nell'app.
Richiede torch CPU, numpy, Pillow, OpenCV. Codice upstream e pesi esterni.
"""
import argparse,sys,time,json,hashlib,subprocess
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw
import cv2
import torch
import torch.nn.functional as F

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--repo',required=True);p.add_argument('--weights',required=True)
p.add_argument('--image',required=True);p.add_argument('--output',required=True)
p.add_argument('--size',type=int,default=512)
a=p.parse_args();repo=Path(a.repo).resolve();out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
if a.size<256 or a.size%256 or a.size>1024:raise ValueError('size deve essere multiplo di 256, da 256 a 1024')
sys.path.insert(0,str(repo))
from floortrans.models.hg_furukawa_original import hg_furukawa_original

torch.set_num_threads(4)
model=hg_furukawa_original(n_classes=51)
model.conv4_=torch.nn.Conv2d(256,44,bias=True,kernel_size=1)
model.upsample=torch.nn.ConvTranspose2d(44,44,kernel_size=4,stride=4)
# Non eseguire oggetti Python arbitrari contenuti nel checkpoint.
checkpoint=torch.load(a.weights,map_location='cpu',weights_only=True)
model.load_state_dict(checkpoint['model_state'],strict=True);model.eval()
print('Checkpoint ufficiale caricato, CPU',flush=True)
original=Image.open(a.image).convert('RGB');w,h=original.size
k=min(a.size/w,a.size/h);rw,rh=round(w*k),round(h*k)
canvas=Image.new('RGB',(a.size,a.size),'white');canvas.paste(original.resize((rw,rh)),(0,0))
x=torch.from_numpy(np.asarray(canvas).copy()).permute(2,0,1).float().unsqueeze(0)/127.5-1
pred=[];start=time.perf_counter()
with torch.inference_mode():
 for turns in range(4):
  t=time.perf_counter();y=model(torch.rot90(x,turns,(-2,-1)))
  # Si usano solo le classi semantiche, non le heatmap direzionali.
  y=torch.rot90(y[:,21:],-turns,(-2,-1))
  pred.append(y)
  print(f'Rotazione {turns*90}: {time.perf_counter()-t:.2f}s',flush=True)
 y=torch.stack(pred).mean(0)[:,:,:rh,:rw]
 y=F.interpolate(y,size=(h,w),mode='bilinear',align_corners=True)[0]
 rooms=y[:12].argmax(0).numpy().astype('uint8');icons=y[12:].argmax(0).numpy().astype('uint8')
elapsed=time.perf_counter()-start
Image.fromarray(rooms).save(out/'classi-stanze.png');Image.fromarray(icons).save(out/'classi-oggetti.png')
wall=(rooms==2);door=(icons==2);window=(icons==1)
for name,mask in [('muri',wall),('porte',door),('finestre',window)]:Image.fromarray(mask.astype('uint8')*255).save(out/f'{name}.png')
base=np.asarray(original).copy();color=base.copy()
for mask,rgb in [(wall,(230,90,0)),(door,(0,180,50)),(window,(0,120,255))]:color[mask]=rgb
mixed=(base*.35+color*.65).astype('uint8')
visual=Image.new('RGB',(w*2,h+40),'white');visual.paste(original,(0,40));visual.paste(Image.fromarray(mixed),(w,40))
d=ImageDraw.Draw(visual);d.text((10,10),'Originale',fill='black');d.text((w+10,10),'CubiCasa: muri arancio / porte verdi / finestre blu',fill='black')
visual.save(out/'confronto.png')
report={'upstream_commit':subprocess.check_output(['git','-C',str(repo),'rev-parse','HEAD'],text=True).strip(),
 'sha256_image':hashlib.sha256(Path(a.image).read_bytes()).hexdigest(),'sha256_weights':hashlib.sha256(Path(a.weights).read_bytes()).hexdigest(),
 'torch':torch.__version__,'device':'cpu','size':a.size,'rotazioni':4,'seconds':elapsed,'pixel':{},'componenti':{},
 'limiti':'Singola immagine senza annotazioni ground truth: componenti e pixel non sono accuratezza; nessun modello 3D generato.',
 'licenza':'Upstream CC BY-NC 4.0; prova isolata, non distribuzione nel prodotto.'}
for name,mask in [('muri',wall),('porte',door),('finestre',window)]:
 n,_,stats,_=cv2.connectedComponentsWithStats(mask.astype('uint8'),8)
 report['pixel'][name]=int(mask.sum());report['componenti'][name]=int(sum(stats[i,cv2.CC_STAT_AREA]>=6 for i in range(1,n)))
(out/'risultati.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2),flush=True)
