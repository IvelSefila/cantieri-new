# Cantieri — motore planimetria → modello 3D (prototipo)

Motore puro browser: carichi una planimetria in JSON o DXF (misure in **millimetri interi**), il motore valida il piano, costruisce i muri con i vani e monta gli infissi del catalogo CDI generati a codice. Sullo stesso progetto calcola superfici, antincendio, GSA / Asol,est, H'T, fabbisogni energetici, fotovoltaico e solare termico.

**Ogni risultato dichiara quanto è affidabile** (esatto, esatto sui dati inseriti, stima, mancano dati), perché, cosa serve per arrivare al 100 % e quali documenti mancano: scheda **Affidabilità** del sito e [docs/AFFIDABILITA.md](docs/AFFIDABILITA.md).

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
src/core/rooms.js        stanze dal grafo dei muri, superficie interna in mm²
src/core/antincendio.js  superficie per ambito, affollamento (Tab. S.4-12), rapporto
src/core/gsa.js          GSA semplificato e Asol,est (DM 26/06/2015 aggiornato dal DM 28/10/2025)
src/core/limiti.js       limiti H'T (Tabelle 10 e 11 del DM 2025)
src/core/energia.js      dispersioni, ponti termici, carichi, pompa di calore, FV, solare termico
src/core/mensile.js      bilancio mensile UNI/TS 11300-1 (verificato su una relazione reale)
src/core/clima.js        dati climatici di Roma (UNI 10349:2016; PVGIS solo per picco estivo e FV)
src/core/pdfdati.js      lettura dei dati da una relazione ex Legge 10 in PDF
src/core/precisione.js   affidabilità di ogni motore, cosa serve per il 100 %, documenti
src/core/registro-norme.js  norme usate, stato della verifica e fonti
src/view/scene.js        vista Three.js
src/app.js               interfaccia
tests/                   test del motore (Node), stress test e back-test su relazioni reali
tools/genera-affidabilita.mjs  rigenera docs/AFFIDABILITA.md
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

- All'avvio si apre l'esempio AR-02 (solo muri e vani). **Nuovo progetto** parte vuoto.
- **Costruzione**: muro (2 clic), vano (clic su un muro), pavimento (2 clic su angoli opposti), arredo (clic, con rotazione a 90°), sposta, elimina. Griglia 1–100 mm, annulla con Ctrl+Z.
- **Stili** (scheda Vista): dal fotorealistico allo stilizzato; i dollhouse in fondo.
- **Doppio clic** su un elemento: scheda con i dati. Per i muri la classificazione portante / non portante è **presunta dal disegno**, non è una verifica strutturale.

## Vista 2D, stanze, aggancio

- **Vista 2D / 3D**: pianta in SVG generata dallo stesso progetto, con quote di ogni muro in mm e larghezza dei vani.
- **Stanze**: rilevate dal grafo dei muri (giunzioni automatiche e tratti spezzati); superficie interna in mm². Un muro che non chiude (moncone) viene tolto per intero e la stanza viene segnalata nella scheda Affidabilità.
- **Aggancio in costruzione**: vertici esistenti entro 150 mm, angoli 0/45/90 dal punto di partenza, poi griglia.

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

Controprove su documenti reali (in `tests/fixtures`):
- **Bilancio mensile UNI/TS 11300-1**: riproduce mese per mese la relazione Blumatica di Roma (riscaldamento 4552 kWh, raffrescamento giugno-settembre).
- **Dati UNI 10349:2016 di Roma**: flusso solare di 5 finestre per 12 mesi uguale a quello stampato nella relazione.
- **Limiti H'T**: uguali a quelli stampati nelle relazioni ACCA (0,58) e Blumatica (0,530).
- **Lettura PDF**: campi estratti da tre relazioni reali (Blumatica, ACCA TerMus, Blumatica Roma a due zone).

Stress test (`tests/stress.test.mjs`): migliaia di casi generati con seme fisso su stanze (area esatta con tramezzi e monconi), validazione, costruzione 3D, involucro e orientamento, Asol,est, energia e lettura dei numeri.

## Limiti del prototipo

L'elenco completo, motore per motore, è in [docs/AFFIDABILITA.md](docs/AFFIDABILITA.md). In breve:

- Infissi e porte sono generati a codice con dimensioni standard del tipo; non sono modelli fotografici CDI.
- Dati climatici solo per **Roma** (UNI 10349:2016 riportata da una relazione di software terzo). Per altri comuni servono i dati UNI 10349 del comune.
- Il fabbisogno annuo con i **gradi giorno** è una stima; il **bilancio mensile** usa le formule UNI/TS 11300-1 ma non calcola da solo la durata reale della stagione, il terreno e l'extraflusso.
- **Ponti termici**: si inseriscono come psi x lunghezza. Non c'è più la maggiorazione fissa del 10 % (vedi docs/AFFIDABILITA.md).
- Muri portanti: classificazione **presunta**; serve la documentazione strutturale.
- La planimetria di esempio è convertita da AR-02; contiene un moncone di muro nella stanza_002 (forse manca un muro).

## Modalità e qualità

- **Semplice**: controlli essenziali (progetto, costruzione, vista, stile). **Architetto**: aggiunge importazione DXF, tracciamento, elenco vani e statistiche di resa.
- **Qualità di resa**: automatica (sceglie in base a core, memoria e GPU), oppure basso / medio / alto. La scena si ridisegna solo quando cambia qualcosa.

## Nessuna connessione esterna

- Three.js è incluso nel sito (`vendor/three`), non viene caricato da internet.
- La pagina dichiara una politica di sicurezza (Content Security Policy) che consente solo file del sito: nessun server, nessun dato in uscita, nessun accesso alla rete locale.
- Verificato con tutte le richieste esterne bloccate: la pagina funziona e disegna il modello.
