# Cantieri — motore planimetria → modello 3D (prototipo)

Motore puro browser: carichi una planimetria in JSON (misure in **millimetri interi**), il motore valida il piano, costruisce i muri con i vani e monta gli infissi del catalogo CDI generati a codice.

**Pagina pubblica:** https://ivelsefila.github.io/cantieri-new/

## Principi

- **Precisione al millimetro**: il modello dati accetta solo interi in mm. Nessun arrotondamento nascosto; dove un valore non è intero (muri obliqui) il motore lo segnala.
- **Nessun server, nessun dato inviato**: tutto gira nel browser.
- **Leggero**: nessun framework; un solo import (Three.js, versione fissata 0.160.0).
- **Separazione**: `src/core` è puro JavaScript senza Three.js; `src/view` è solo la resa.

## Struttura

```
data/plan-ar02.json      planimetria di esempio (AR-02, piano tipo) in mm
data/cdi-catalog.json    19 modelli CDI (solo dati tecnici, senza prezzi né immagini)
src/core/model.js        formato del piano e validazione (interi, vani, mazzette)
src/core/build.js        piano -> scatole 3D in mm (muri tra i vani, infissi)
src/core/cdi.js          infissi procedurali: telaio, vetro, anta, maniglia
src/core/measure.js      lunghezze e superfici in aritmetica intera (mm, mm²)
src/view/scene.js        vista Three.js
src/app.js               interfaccia
tests/core.test.mjs      test del motore (Node)
```

## Formato planimetria (schema 1)

```json
{
  "schema": 1, "unit": "mm", "altezza_muri": 2800,
  "walls":    [{ "id": "w1", "a": [0, 0], "b": [5000, 0], "t": 280 }],
  "openings": [{ "id": "p1", "wall": "w1", "offset": 1000, "width": 900,
                 "height": 2100, "sill": 0, "type": "porta", "cdi": "porta-athens" }]
}
```

- `a`, `b`: estremi dell'asse del muro (mm interi). `t`: spessore (pari).
- `offset`: distanza del vano dal punto `a`, lungo il muro.
- `type`: `finestra`, `porta`, `scorrevole`. `cdi`: id del catalogo, oppure assente/`null` per vano aperto.

## Progetto vuoto e modalità costruzione

- Il progetto si apre **vuoto**: nessun muro, nessun pavimento, nessun arredo.
- **Costruzione**: muro (2 clic), vano (clic su un muro), pavimento (2 clic su angoli opposti), arredo (clic, con rotazione a 90°), sposta, elimina. Griglia 1–100 mm, annulla con Ctrl+Z.
- **Stili**: solido, vetro (muri semi-trasparenti con contorni), dollhouse (taglio a 1,30 m), vetro + dollhouse.
- L'esempio AR-02 si apre a richiesta; i suoi arredi si mostrano solo con la casella dedicata.

## Importazione DXF

- Pulsante **Importa DXF**: legge LINE, LWPOLYLINE e POLYLINE (ASCII). Le unità vengono da `$INSUNITS`.
- **Riferimento**: *asse del muro* (la linea è l'asse) oppure *filo esterno* (per il perimetro: il contorno viene spostato di t/2 verso l'interno, con angoli chiusi).
- **Spessore**: uno per tutti i muri importati (intero pari, in mm).
- Ogni arrotondamento a mm intero è contato e riportato; nessuna correzione silenziosa.
- I vani non vengono importati dal DXF: si aggiungono nel modello JSON.

## Tracciamento su immagine

1. Carica un'immagine (PNG/JPG). Imposta la **distanza di calibrazione** in mm, poi clicca **1. Calibra**: primo clic sull'origine, secondo clic su un punto di distanza nota.
2. **2. Muro**: due clic per ogni segmento. **3. Vano**: due clic sullo stesso muro (tipo, altezza, davanzale nei campi accanto).
3. **Invia al 3D** o **Esporta JSON**.
- Le coordinate sono interi in mm. Lo **zoom** non cambia la scala, ma permette di cliccare con più precisione.
- **Precisione reale = risoluzione dell'immagine**: con 20 mm per pixel nessun clic può essere più preciso di 20 mm. Per il millimetro serve una rasterizzazione ad alta risoluzione.

## Test

```bash
npm test
```

I test DXF e di tracciamento usano dati costruiti nel test, non disegni del progetto.

I test verificano: precisione al mm (pieni + vani = lunghezza del muro), nessuna scatola che attraversa un vano, perimetro chiuso, validazione dei dati errati, avvisi di mazzetta, infissi dentro il vano, catalogo e misure.

## Limiti del prototipo

- Infissi e porte sono generati a codice con dimensioni standard del tipo; non sono modelli fotografici CDI.
- Nessun calcolo di aeroilluminante o di normativa in questa versione.
- La planimetria di esempio è convertita da AR-02; le vetrate dei terrazzi sono centrate sul disegno (da confermare).
