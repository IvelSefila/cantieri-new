# Planimetrie locali e generazione browser — 20 ottobre 2026

Implementazione locale su base Git `e3efbd9b82a90fd1c13cd70db172290f70b622b2`, senza commit o pubblicazione. Le correzioni dell'audit precedente sono preservate.

## Funzionamento

Aggiornamento 21 ottobre: è disponibile un primo [motore automatico per muri da immagini](RASTER_AUTOMATICO_2026-10-21.md), locale e sperimentale. Non richiede il ricalco dei tratti riconosciuti; occorre confermare la scala e controllare i candidati. Porte e finestre non sono classificate automaticamente.

La nuova voce **Planimetrie** è presente nel menu desktop e mobile, anche in modalità Semplice. Riunisce:

- scelta dal PC di JSON, DXF ASCII, PDF, PNG, JPG/JPEG e WebP;
- raccolta IndexedDB persistente di progetti e tavole originali;
- apertura del modello salvato o della tavola originale per una nuova elaborazione;
- salvataggio del progetto corrente con un nome ed esempi AR-02 e bilocale 6 × 4 m.

Il modello passa dalla stessa validazione e costruzione usata dall'editor. JSON e DXF mantengono il percorso diretto; per i DXF sono selezionabili assi o filo esterno, unità da `$INSUNITS` e spessore del muro. Il riferimento è determinante: 6000 × 4000 mm al filo esterno, con muri da 200 mm, diventa 5800 × 3800 mm agli assi e conserva l'ingombro esterno iniziale.

PDF.js 5.4.624 era già incluso nel progetto ed è riusato localmente, anche come worker. Il documento viene letto con File API e rasterizzato nel browser, senza invio HTTP. La lettura dei segmenti avviene prima del rendering, perché PDF.js trasforma poi i path in Path2D; la cache per pagina permette di tornarvi senza perdere i segmenti. Sono applicate trasformazioni grafiche, matrici dei form e rotazione della pagina.

I segmenti rettilinei di path con tratto possono essere selezionati come **assi dei muri**. I riempimenti e le curve vengono esclusi. Il software non attribuisce automaticamente un significato edilizio a tutte le linee di un PDF. Se la tavola ha le due facce dei muri, va tracciata la mezzeria; selezionarle entrambe creerebbe due muri distinti. Spessori, altezze, porte e finestre vanno confermati o inseriti.

Una scansione senza segmenti rimane utilizzabile mediante calibrazione e tracciamento. La generazione richiede una quota di controllo compatibile con la scala; dopo la calibrazione manuale il controllo deve avere una direzione diversa. La nuova calibrazione richiede di annullare prima i muri tracciati, così non cambia la scala lasciando in memoria geometria misurata con la scala precedente.

La provenienza raster resta classificata come stima anche dopo salvataggio, esportazione e recupero. Una quota compatibile verifica soltanto quella distanza entro la risoluzione di selezione indicata.

## Prove eseguite

Tavole sintetiche dichiarate, con quote note e riproducibili; non sono nuovi rilievi di edifici reali. Fixture in `tests/fixtures/planimetrie`, generate da `tools/genera-fixture-planimetrie.py`. ReportLab e Pillow servono solo a rigenerare le fixture, non alla conversione del prodotto.

| Tavola e percorso | Lunghezze di riferimento | Risultato |
|---|---|---|
| Rettangolo JSON e DXF in metri | 6000 / 4000 / 6000 / 4000 mm | Scarto 0 mm |
| Pianta a L JSON e DXF in mm | 8000 / 3000 / 4000 / 3000 / 4000 / 6000 mm | Scarto 0 mm |
| DXF con riferimento filo esterno | Ingombro 6000 × 4000 mm, spessore 200 mm | Ingombro conservato |
| PDF vettoriale, pagina 1 | Rettangolo, scala 1:100 | Scarto 0 mm |
| PDF vettoriale, pagina 2 ruotata 90° | Pianta a L, scala 1:100 | Scarto 0 mm |
| PDF scansione e immagini PNG/JPG/WebP | Rettangolo 8000 × 4000 mm, originale 10 mm/pixel | Tracciamento con zoom, scarto massimo entro 10 mm |

Il test controlla sia il JSON esportato dal percorso UI, sia le **mesh realmente presenti nella scena Three.js** tramite il suo evento nativo per strumenti di sviluppo. La differenza ammessa per lunghezze, spessori, altezze e posizioni della mesh rispetto al modello è 0,02 mm. Non viene aggiunto alcun accesso di debug al prodotto.

Altri controlli: scala 1:200 errata rifiutata, ritorno alle pagine PDF senza perdita di segmenti, nuova verifica dopo cambio pagina, archivio e originali recuperabili, refresh, PDF corrotto senza sostituzione del modello, salvataggio manuale, provenienza della scansione dopo recupero, layout mobile, zero errori JavaScript. Tutte le richieste esterne sono bloccate durante il collaudo; il report pretende zero richieste esterne e zero mutazioni HTTP.

La suite Node comprende nove nuovi test su formati, input invalidi, unità DXF, trasformazioni PDF, curve escluse, chiusura dei path, scala fisica e arrotondamenti dichiarati. La verifica UI generale viene eseguita separatamente.

Esito finale: **275/275 test Node**, **59/59 verifiche browser delle planimetrie**, **9/9 verifiche UI generali**, **4/4 test del server**. Sul raster finale: PDF 8 mm di scarto massimo, PNG/JPG/WebP 2 mm, con zoom 4 e tolleranza di prova 10 mm (risoluzione della scansione originale). Sui vettori lo scarto delle lunghezze è 0 mm. Il report riporta anche gli errori numerici delle trasformazioni 3D, entro la soglia di 0,02 mm.

## Evidenze e riproduzione

- [risultati.json](evidenze/planimetrie/risultati.json): esito di ogni controllo, scarti misurati, richieste e hash dei sorgenti e delle tavole.
- [Raccolta desktop](evidenze/planimetrie/raccolta-planimetrie.png), [mobile](evidenze/planimetrie/raccolta-mobile.png).
- [PDF vettoriale](evidenze/planimetrie/pdf-vettoriale-ruotato.png), [modello a L dal PDF](evidenze/planimetrie/modello-pdf-elle.png), [PDF scansione](evidenze/planimetrie/pdf-scansione.png).
- I JSON esportati durante le prove si trovano accanto al report.

```powershell
npm test
python tools/prova-planimetrie.py
python tools/prova-browser.py
python -m unittest discover -s tests -p test_server.py
```

Edge e Playwright Python sono necessari solo ai collaudi automatici. L'app si avvia con `npm start` su `http://127.0.0.1:8765`.

## Limiti effettivi

Il supporto dei formati non equivale al riconoscimento automatico perfetto di qualsiasi planimetria: una linea può essere una quota, un mobile, un asse o il bordo di un muro. Nessun OCR o riconoscimento semantico automatico viene dichiarato. Le pagine di un PDF sono importabili singolarmente; non sono combinate automaticamente come piani sovrapposti.

Per ottenere misure affidabili servono riferimenti quotati e la corretta interpretazione degli assi. La precisione di scansioni e fotografie dipende dalla risoluzione originale, dallo zoom di selezione, dalla griglia e dalla deformazione. Lo scarto del raster non viene presentato come esattezza al millimetro. Le prove su tavole sintetiche non certificano tavole dell'utente non ancora fornite.

L'archivio è locale al profilo del browser e all'origine, senza sincronizzazione; la cancellazione dei dati del sito lo elimina. Un JSON esportato conserva il modello e le verifiche, ma non incorpora il file PDF originale. Il file originale resta nella raccolta IndexedDB. File oltre 50 MB e immagini oltre 20 megapixel vengono rifiutati; PDF con password non sbloccati.
## Riconoscimento casa locale

Per muri, porte, finestre, stanze e switch scala ON/OFF vedere [il rapporto del motore locale](RICONOSCIMENTO_CASA_2026-10-21.md). Usa OpenCV e Simplify.js inclusi nel progetto, senza servizi di riconoscimento esterni.
