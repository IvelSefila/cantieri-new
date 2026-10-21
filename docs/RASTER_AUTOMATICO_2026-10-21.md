# Motore locale di riconoscimento muri — 21 ottobre 2026

Implementato un primo percorso operativo immagine → analisi dei pixel → muri candidati → calibrazione → modello 3D → raccolta IndexedDB ed esportazione JSON. Non usa servizi esterni, modelli neurali o una geometria di esempio al posto dell'immagine.

## Uso

1. Caricare PNG/JPG/WebP nella scheda Planimetrie, oppure aprire una scansione PDF. Il riconoscimento parte automaticamente; sui PDF vettoriali resta disponibile la selezione dei segmenti originali.
2. I tratti riconosciuti appaiono arancioni. Calibrare due estremi di una distanza nota, inserendo la misura reale. Dopo la calibrazione, cliccare i candidati indesiderati per escluderli.
3. Premere **Usa i muri rilevati**: il modello metrico è costruito senza ricalcare i muri. Gli spessori derivano dai pixel alla scala confermata; l'altezza resta quella configurata, non viene dedotta dall'immagine.
4. Verificare una seconda quota indipendente, poi **Invia al 3D**. Il modello e la provenienza vengono salvati nella raccolta.

Il pulsante di riconoscimento permette di ripetere l'analisi. Per sostituire muri già tracciati occorre riaprire la tavola: il lavoro precedente non viene sovrascritto silenziosamente. Annulla rimuove l'applicazione automatica in un passo.

## Motore e limiti

`src/io/raster-muri.js` analizza luminanza e trasparenza, estrae tratti scuri orizzontali/verticali e aggrega le righe contigue in bande murarie. La lettura viene limitata a 1400 pixel sul lato maggiore; le coordinate e gli spessori sono riportati all'immagine originale prima della conversione metrica. La geometria passa la stessa validazione degli altri progetti.

È visione artificiale geometrica, **non un riconoscitore semantico completo**. Funziona soprattutto con piante dritte e contrastate. Quote, bordi, arredi e simboli possono essere falsi positivi; muri sottili, chiari, obliqui, curvi o discontinui possono mancare. Non riconosce OCR, etichette dei locali, simboli porta/finestra, altezza o spessore reale senza scala. I vuoti tra segmenti restano aperti: non si inventano porte per chiuderli. Le giunzioni devono essere controllate prima di affidarsi al rilevamento dei locali o ai calcoli tecnici.

Il ritaglio della schermata fornita dall'utente ha prodotto 43 tratti candidati, controllati visivamente in sovrimpressione. È una prova esplorativa su screenshot, non una misura di accuratezza né un collaudo sull'originale, che non è allegato alla chat come file separato. L'immagine dell'utente non è copiata nelle fixture del repository.

Per riconoscere affidabilmente anche simboli e muri complessi serve un successivo motore semantico con pesi, licenza e valutazione su tavole reali. La letteratura [CubiCasa5K](https://github.com/CubiCasa/CubiCasa5k) tratta questa classe di problema; non è stata integrata né viene dichiarata operativa. Il riferimento di base per l'estrazione geometrica delle linee è la [documentazione OpenCV](https://docs.opencv.org/4.10.0/dd/dd7/tutorial_morph_lines_detection.html); il codice attuale è JavaScript nativo, senza dipendenza OpenCV.

## Prove

- Suite Node: 293/293 PASS, comprese tre regressioni sul motore raster: rettangolo a quattro muri, bianco/nero/alpha, righe sottili e scala assente.
- `npm run test:raster`: 11/11 PASS in Edge/WebGL reale, rete esterna bloccata. Da una PNG sintetica ottiene quattro muri, senza clic di tracciamento, conferma calibrazione/seconda quota, genera il 3D e verifica archivio, JSON, spessori e provenienza. Non dichiara porte o finestre riconosciute.
- Suite planimetrie: 59/59 PASS, inclusi PDF vettoriali, scansioni e ricalco manuale.
- Regressioni browser generali: 23/23 PASS.

Il controllo della seconda quota usa un epsilon di 0,000001 mm esclusivamente sul confronto numerico: evita che l'errore floating point rifiuti una selezione esattamente al limite della risoluzione visualizzata. Non aumenta materialmente la tolleranza metrica.

Evidenze: [rapporto browser con hash](evidenze/raster-automatico/risultati.json), [modello esportato](evidenze/raster-automatico/modello.json), [riconoscimento](evidenze/raster-automatico/riconoscimento.png), [3D](evidenze/raster-automatico/modello-3d.png). Modifiche locali, non committate né pubblicate.


## Scala indicativa ON/OFF

Switch locale `Stima automatica misure`: OFF (predefinito) richiede calibrazione e seconda quota; ON stima mm/pixel dal tratto mediano ipotizzato di 250 mm, limitando l’ingombro maggiore a 4–30 m. Non deduce quote reali. Il JSON salva `dimensioni_stimate`, ipotesi e nessuna seconda quota verificata. Tornando a OFF si ripristina il tracciato precedente alla stima, scartando le modifiche fatte in modalità indicativa. Nessun provider esterno o nuovo codice di terzi importato. Questa modifica non introduce riconoscimento semantico di porte, finestre o stanze.

Prova Edge offline aggiornata: 14/14 controlli comprendenti ON senza quote, OFF con ripristino e modello stimato esportato dopo generazione e salvataggio reali.
