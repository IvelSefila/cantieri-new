# Cantieri — motore planimetria → modello 3D (prototipo)

Motore puro browser: dalla scheda **Planimetrie** carichi JSON, DXF, PDF, PNG, JPG o WebP e riapri i progetti salvati sul browser. JSON e DXF producono direttamente il modello; PDF e immagini richiedono conferma della scala e selezione o tracciamento dei muri. Il motore valida il piano in **millimetri interi**, costruisce i muri con i vani e monta gli infissi del catalogo CDI generati a codice. Sullo stesso progetto calcola superfici, antincendio, GSA / Asol,est, H'T, fabbisogni energetici, fotovoltaico e solare termico.

**Ogni risultato dichiara quanto è affidabile** (esatto, esatto sui dati inseriti, stima, mancano dati), perché, cosa serve per arrivare al 100 % e quali documenti mancano: scheda **Affidabilità** del sito e [docs/AFFIDABILITA.md](docs/AFFIDABILITA.md).

**Pagina pubblica:** https://ivelsefila.github.io/cantieri-new/

## Principi

- **Precisione al millimetro**: il modello dati accetta solo interi in mm. Nessun arrotondamento nascosto; dove un valore non è intero (muri obliqui) il motore lo segnala.
- **Geometria e documenti locali**: modello, JSON, DXF e PDF sono elaborati nel browser. La ricerca di un indirizzo invia il testo ai geocoder esterni; la cartografia richiede i servizi geografici indicati sotto.
- **Leggero**: nessun framework; Three.js 0.160.0 e PDF.js 5.4.624 inclusi localmente. Nessun servizio esterno per convertire le tavole.
- **Separazione**: `src/core` è puro JavaScript senza Three.js; `src/view` è solo la resa.

## Struttura

```
data/plan-ar02.json      planimetria di esempio (AR-02, piano tipo) in mm
data/cdi-catalog.json    27 modelli CDI
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
src/core/sessione.js     import/export e parametri tecnici del progetto
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

## Planimetrie in memoria e PDF

1. Apri **Planimetrie** nel menu e scegli un file dal PC, una voce **In memoria su questo browser** oppure un esempio. I modelli importati e i documenti PDF/immagine originali vengono conservati in IndexedDB. Puoi anche salvare una copia del progetto corrente con un nome.
2. Nel **PDF vettoriale** scegli la pagina; conferma la scala stampata con **Applica scala PDF**, oppure calibra una quota nota. Seleziona solo gli **assi dei muri**, escludendo quote e arredi. Curve e riempimenti non diventano muri. Un PDF con le due facce del muro non equivale a un disegno dei suoi assi: serve il tracciamento delle mezzerie.
3. In una **scansione PDF o immagine**, ingrandisci con Zoom, imposta la distanza reale e clicca **1. Calibra**, poi i due estremi della quota nota.
4. Inserisci una **seconda quota reale** e clicca **Verifica seconda quota**, poi i suoi estremi. Dopo la calibrazione manuale deve avere una direzione diversa dalla prima. Una misura incompatibile blocca la generazione.
5. PDF vettoriale: **Genera 3D dai segmenti selezionati**. Scansione/immagine: **2. Muro**, clic sui vertici; **3. Vano** aggiunge aperture, quindi **Invia al 3D**. Imposta spessori e altezze reali nei campi: non vengono dedotti dalle linee PDF.

**Misure:** nei test le lunghezze JSON/DXF/PDF vettoriali coincidono con le quote note. Scansioni, clic, deformazioni del foglio e griglia limitano la precisione: memorizzare mm interi non rende millimetrica una fotografia. Il programma mostra la risoluzione di selezione e salva nel JSON scala, quota di controllo e arrotondamenti. Il controllo di una quota non certifica ogni misura della tavola.

L'archivio appartiene al browser e all'origine del sito (indirizzo e porta): un altro profilo/porta non vede la stessa raccolta. La cancellazione dei dati del sito rimuove l'archivio. **Scarica progetto (JSON)** conserva una copia esportabile del modello. PDF e immagini: limite 50 MB; immagini fino a 20 megapixel. I PDF protetti da password non vengono sbloccati dall'app.

Procedura, risultati misurati e limiti: [docs/PLANIMETRIE.md](docs/PLANIMETRIE.md).

## Test

```bash
npm test
```

La suite include automaticamente tutti i file `tests/*.test.mjs`. Le prove reali, separate dalla suite offline:

```bash
python -m unittest discover -s tests -p test_server.py
python tools/prova-planimetrie.py
python tools/prova-browser.py --live
node tools/prova-civici-live.mjs
```

Le prove browser richiedono Playwright per Python e Microsoft Edge. Il campione contiene 23 indirizzi nelle 20 regioni: dimostra i risultati dei singoli casi, non la copertura di tutti i civici italiani. Evidenze e limiti: [docs/COLLAUDO_2026-10-20.md](docs/COLLAUDO_2026-10-20.md).

## Salvataggio e recupero

Il progetto viene salvato nel localStorage del browser e recuperato alla riapertura dalla stessa origine. Il JSON esportato conserva geometria, assegnazioni CDI, orientamento, parametri solari, energetici e scheda ambiti. Le origini diverse (es. porte locali diverse e GitHub Pages) hanno salvataggi distinti. Scaricare il JSON per trasferire o archiviare il lavoro; il recupero locale dipende dalla disponibilità dello spazio del browser.

Un'importazione non valida viene rifiutata prima di sostituire il progetto corrente. Nuovo progetto azzera anche i parametri tecnici della sessione precedente.

I test DXF e di tracciamento usano dati costruiti nel test, non disegni del progetto.

I test verificano: precisione al mm (pieni + vani = lunghezza del muro), nessuna scatola che attraversa un vano, perimetro chiuso, validazione dei dati errati, avvisi di mazzetta, infissi dentro il vano, catalogo e misure.

Controprove su documenti reali (in `tests/fixtures`):
- **Bilancio mensile UNI/TS 11300-1**: riproduce mese per mese la relazione Blumatica di Roma (riscaldamento 4552 kWh, raffrescamento giugno-settembre).
- **Dati UNI 10349:2016 di Roma**: flusso solare di 5 finestre per 12 mesi uguale a quello stampato nella relazione.
- **Limiti H'T**: uguali a quelli stampati nelle relazioni ACCA (0,58) e Blumatica (0,530).
- **Lettura PDF**: campi estratti da tre relazioni reali (Blumatica, ACCA TerMus, Blumatica Roma a due zone).

Stress test (`tests/stress.test.mjs`): migliaia di casi generati con seme fisso su stanze (area esatta con tramezzi e monconi), validazione, costruzione 3D, involucro e orientamento, Asol,est, energia e lettura dei numeri.

## Limiti del prototipo

Il [collaudo generale del 20 ottobre 2026](docs/DEBUG_GENERALE_2026-10-20.md) documenta le correzioni e le prove aggiornate. Per ripetere le regressioni browser: `npm run test:debug`. Nei DXF senza unità dichiarate, scegliere esplicitamente l'unità dal selettore di importazione prima di generare il modello.

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

## Altimetria da civico e connessioni esterne

- Three.js è incluso nel sito (`vendor/three`), non viene caricato da internet.
- JSON, DXF, PDF e geometria non richiedono servizi esterni per il percorso locale.
- L'autocomplete dopo tre caratteri e la ricerca civici interrogano ArcGIS, Photon o Nominatim. Le coordinate vengono usate per interrogare cartografia OSM e, in Piemonte, BDTRE. La CSP elenca gli host ammessi.
- **OSM non è LiDAR**: il risultato distingue tag height, livelli dichiarati e stime da tipologia/impronta. Una stima tipologica senza quota non determina automaticamente la classe antincendio. Il civico restituito da un provider non certifica da solo l'associazione al corpo edilizio.
- **Il progetto non integra un servizio LiDAR nazionale PST**. Una risposta OSM non dimostra copertura LiDAR. Le prove correnti confermano quote con metadati DSM-DTM/LAS BDTRE per i campioni piemontesi, non una copertura nazionale di misure.
- Il browser ha incontrato un blocco CORS sul WFS BDTRE diretto. Per il percorso locale completo avviare `npm start` (oppure `python tools/serve.py --port 8765`) e aprire [Cantieri locale](http://127.0.0.1:8765). Il server Python usa solo libreria standard, ascolta su loopback e offre un proxy limitato al WFS BDTRE con coordinate/raggio verificati. Non è un proxy generico.
- Su GitHub Pages il server Python non viene eseguito: il WFS diretto può restare bloccato e il sito ripiega sulla cartografia disponibile, dichiarandone la fonte. Nessuna nuova versione è pubblicata automaticamente da questi comandi.
- L'altezza volumetrica non misura la quota dell'apertura più alta dell'ultimo piano abitabile. La sua trasformazione rimane una stima provvisoria; il riferimento accessibile ai soccorsi deve essere verificato esplicitamente. I calcoli non attestano la conformità di una pratica.
