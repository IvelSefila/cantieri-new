# Prova reale CubiCasa5K su planimetria raster

Inferenza eseguita il 21 ottobre 2026 sulla PNG originale dell'utente (640 × 479), senza riaddestramento, upload o uso della GPU. Nessuna modifica al motore dell'applicazione.

## Provenienza

- Codice ufficiale: https://github.com/CubiCasa/CubiCasa5k, commit `c34440266665a11f4484eb06cd2e4b7d72ad76c1`.
- Pesi ufficiali collegati dal README: https://drive.google.com/file/d/1gRB7ez1e4H7a9Y09lLqRuna0luZO5VRK/view
- SHA256 pesi: `dd20b4e1bf1d670f2125107b079df06958b1ccd36e49a464ab739aeb00b8e7a2` (208651193 byte).
- SHA256 immagine: `247eac0059f218e8c7b729e38729f87a73a0b702c2e15dd2d547ec6b7610a18b`.
- Licenza upstream CC BY-NC 4.0: https://github.com/CubiCasa/CubiCasa5k/blob/master/LICENSE. La prova non autorizza l'integrazione commerciale; codice e pesi non sono distribuiti in questo repository.

## Metodo e risultati

Python 3.12, PyTorch 2.14.1+cpu, NumPy 2.5.3, Pillow 12.3.0, OpenCV 5.0.0. Ambiente virtuale privato con accesso ai pacchetti di sistema; torch installato solo nella venv dall'indice CPU ufficiale. Quattro thread CPU. Checkpoint caricato con `weights_only=True` e verifica stretta delle chiavi del modello.

Ridimensionamento con proporzioni conservate e padding bianco, normalizzazione RGB in [-1,1], media dei logits semantici su quattro rotazioni, rimozione padding e ritorno alla risoluzione originale. Le heatmap direzionali non sono utilizzate. Output: maschere muri/porte/finestre e confronto visivo affiancato.

| Input quadrato | Tempo quattro rotazioni | Componenti muro | Componenti porta | Componenti finestra |
| --- | ---: | ---: | ---: | ---: |
| 512 px | 3,49 s | 44 | 10 | 6 |
| 768 px | 6,75 s | 14 | 18 | 11 |

I tempi escludono caricamento modello e scrittura output. Le componenti con almeno sei pixel NON equivalgono a elementi architettonici correttamente riconosciuti. Non esistono annotazioni di riferimento per misurare accuratezza su questa immagine.

Ispezione visiva: a 768 pixel i muri seguono buona parte della pianta e sono rilevati più simboli delle aperture rispetto a 512. Restano omissioni, frammenti e aperture da verificare. Nessun confronto quantitativo con il motore OpenCV esistente; nessuna prova di superiorità universale. Non sono stati generati un modello 3D, serramenti o un percorso browser con questo modello neurale. Occorre ancora convertire le maschere in geometria coerente, associare le aperture ai muri e verificare la topologia prima dell'integrazione.

## Riproduzione

Preparare una venv Python 3.12 separata. Installare torch CPU dall'indice `https://download.pytorch.org/whl/cpu` e numpy, Pillow, opencv-python. Clonare il repository ufficiale alla revisione sopra e scaricare i pesi dal link ufficiale, verificandone l'hash. Lo script importa direttamente l'architettura per evitare il caricamento iniziale di un checkpoint ausiliario assente.

```powershell
& .\scratch\cubicasa-prova\.venv\Scripts\python.exe tools/prova-cubicasa.py --repo scratch/cubicasa-prova/repo --weights scratch/cubicasa-prova/model_best_val_loss_var.pkl --image 'C:/Users/fabri/Downloads/images.png' --output scratch/cubicasa-prova/risultati-768 --size 768
```

Le prove e gli output originali rimangono privati in `scratch/cubicasa-prova/`: sottocartelle `risultati` e `risultati-768`, ciascuna con `risultati.json`, `confronto.png` e maschere. Nessuna immagine personale, peso o clone upstream viene committato.
