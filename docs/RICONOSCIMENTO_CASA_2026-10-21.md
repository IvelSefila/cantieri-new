# Riconoscimento locale della casa

Il motore cerca muri ortogonali, simboli di porte (anche doppi battenti e aperture a filo parete), finestre a linee parallele e contorni chiusi delle stanze. Lavora in un Web Worker nel browser, senza upload o API di riconoscimento esterne. Produce muri con varchi reali, parapetti/architravi e pavimenti poligonali, collegati al visualizzatore, alla passeggiata e alla raccolta IndexedDB.

## Componenti importati realmente utilizzati

* [OpenCV](https://github.com/opencv/opencv), runtime 4.13.0: conversione in grigio, soglie, morfologia, componenti connesse e contorni. Distribuzione ufficiale OpenCV.js copiata senza modifiche in `vendor/opencv/`. Licenza Apache-2.0, copyright e licenza Emscripten inclusi. Il sorgente del tag 4.13.0 corrisponde a `2e1f8da65e4f9fa1a98423e6ac223187438a4db8`.
* [Simplify.js](https://github.com/mourner/simplify-js), tag 1.2.4: semplificazione dei contorni dei pavimenti. Copiato senza modifiche in `vendor/simplify/`, licenza BSD-2-Clause inclusa.

Il manifest `vendor/riconoscimento-provenienza.json` riporta URL, licenze e SHA-256 dei byte inclusi. L'URL del build OpenCV ufficiale usa `4.x`: la copia nel repository e il relativo hash sono fissati, senza aggiornamenti o download automatici. Il runtime restituisce la versione effettiva nel rapporto esportato. Non sono inclusi pesi o dati CubiCasa5K, ne codice Planner 5D/Coohom. La logica che associa simboli e muri e originale Cantieri, non un modello neurale addestrato.

## Uso

1. Aprire Planimetrie e caricare PNG, JPG, WebP o PDF. L'analisi parte automaticamente, anche sul rendering dei PDF vettoriali; il percorso di selezione dei segmenti PDF resta disponibile.
2. Controllare i muri arancioni, le aperture verdi/blu e le stanze evidenziate. Il pannello permette di escludere aperture/stanze, correggere porta/finestra e dare un nome alle stanze. Dopo l'applicazione usare Annulla per tornare ai candidati, oppure modificare i vani nel progetto.
3. **Stima ON**: scala indicativa basata sullo spessore mediano ipotizzato di 250 mm, con ingombro maggiore limitato a 4-30 m. Nessuna quota reale necessaria. L'avviso rimane visibile anche nel progetto 3D e nei metadati JSON.
4. **Stima OFF**: calibrare una distanza nota e controllare una seconda quota indipendente. Tornando da ON a OFF si ripristinano geometria e verifica precedenti alla stima, senza deriva numerica. La verifica della scala non certifica il riconoscimento dei simboli o l'esattezza dell'originale.
5. Usare i rilevamenti e inviare al 3D. Aperture, pavimenti, nomi e provenienza vengono salvati insieme al modello. I nomi delle stanze sono disponibili nell'overlay e nel rapporto esportato.

Se il worker non riesce a partire, viene mostrato il motivo e rimane disponibile il precedente rilevatore dei soli muri. Cambio documento/pagina annulla il lavoro precedente. L'elaborazione e limitata a 1400 pixel sul lato maggiore e 30 secondi; l'annullamento termina il worker. Nessun allargamento della CSP del documento a `unsafe-eval`.

## Prove riproducibili

`npm run test:casa` esegue Edge/WebGL reale con tutte le richieste esterne bloccate. La tavola controllata contiene due stanze, una porta ad arco e una finestra a tre linee. Sono provati PNG, JPG, WebP, PDF scansito, rotazione di 90 gradi, fondo nero e trasparenza.

Il controllo attraversa upload, esecuzione OpenCV/Simplify, revisione del nome, scala ON/OFF, generazione dei varchi, pavimenti, esportazione, riapertura da IndexedDB e passeggiata. I varchi vengono controllati anche sulle scatole del modello: nessun pieno murario attraversa il loro centro. Un'immagine vuota non inventa elementi; una prova separata verifica l'annullamento del worker.

Evidenze: `docs/evidenze/riconoscimento-casa/risultati.json`, `rilevamenti.png`, `modello-3d.png`. Le fixture sono prodotte in `tests/fixtures/riconoscimento-casa/` dal test e non contengono dati dell'utente. La prova sui formati diversi usa lo stesso disegno, non sette case indipendenti.

Esito locale: **86/86** controlli del nuovo flusso, **14/14** del precedente percorso raster e dello switch, **299/299** test Node, **59/59** regressioni importazione planimetrie e **23/23** regressioni generali browser. Nessun errore JavaScript nelle prove browser. Le evidenze contengono gli hash dei sorgenti eseguiti. Modifiche locali: nessun commit o push in questa fase.

## Limiti espliciti

Questo e riconoscimento geometrico sperimentale, non riconoscimento universale della casa. I punteggi descrivono corrispondenze grafiche, non probabilita calibrate. Le interruzioni senza evidenza di un simbolo rimangono aperte e sono segnalate; non vengono trasformate automaticamente in porte. Muri sottilissimi/obliqui, mobili, testi, segni grigi, simboli non convenzionali e giunzioni mancanti possono produrre omissioni o falsi positivi. Il ritaglio dello screenshot dell'utente e stato provato separatamente come esplorazione: mostra riconoscimenti incompleti e falsi positivi; non esiste una misura di accuratezza annotata per quella casa.

Le stanze derivano dai contorni: non vengono riconosciuti automaticamente nomi/destinazioni d'uso, scale, impianti o arredi esistenti. I simboli dei battenti possono contribuire alla chiusura del contorno; il filtro scarta i piccoli settori dei battenti riconosciuti, ma altri simboli possono ancora sembrare stanze. I pavimenti vanno quindi controllati ed esclusi quando errati. Se vengono esclusi muri, i pavimenti automatici non vengono applicati per evitare contorni incoerenti.

Altezze di muri, aperture e davanzali sono valori predefiniti modificabili: non possono essere ricavati con certezza da una sola pianta. Nessuna certificazione metrica, edilizia o normativa deriva da questi risultati.

Sul ritaglio a bassa risoluzione della schermata utente, prova esplorativa separata: generati e salvati nel browser 38 muri, 8 aperture candidate (7 porte e 1 finestra) e 14 pavimenti. Il modello passa la validazione geometrica, ma mancano ancora aperture e tratti: questi numeri non misurano accuratezza. Immagine e screenshot della prova restano nella cartella temporanea del PC, fuori dal repository.
