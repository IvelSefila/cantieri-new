# Blocco importazione DXF

Riprodotto localmente su `Downloads/floorplan.dxf` (circa 1,1 MB):
lettura sul thread UI, conversione indiscriminata delle linee di annotazione,
e suddivisione iterativa delle intersezioni nel calcolo delle stanze.
Le iterazioni sui frammenti amplificavano errori numerici delle diagonali.

## Intervento

Parser, conversione, validazione e controllo delle stanze in worker locale,
annullamento e timeout 20 secondi. Limite preventivo 500 segmenti muro e
20000 tratti alle intersezioni; nessuna applicazione parziale del progetto.
Filtro visibile WALL/MURI, disattivabile; esclusioni riportate nel risultato.
Intersezioni calcolate una volta sui segmenti originali, tolleranza 1e-6 mm
per coincidenze numeriche e aggancio dei risultati quasi interi agli interi.
Scelta manuale delle unità prevalente sull'header, con avviso esplicito.

## Prove

`tools/prova-dxf-browser.py C:/Users/fabri/Downloads/floorplan.dxf`:
Edge reale, 253 segmenti con filtro WALL/MURI, modello applicato e salvato,
nessun errore JavaScript. Prova con unità pollici impostate esplicitamente:
è un'ipotesi di collaudo, non una certificazione dell'unità originale.
L'header dichiara mm e il disegno ha ingombro 796×564 in coordinate originali:
serve verificare una quota nota. Il test esercita anche 100000 LINE nel worker,
timer UI che continua a scattare, rifiuto oltre limite, abort del worker e
recupero dei controlli del form dopo errore. Evidenze private in
`scratch/dxf-browser/`.

Questa correzione riguarda il blocco e il controllo della complessità.
Non riconosce automaticamente i due fili della parete come un unico asse,
né interpreta porte/blocchi INSERT: il risultato geometrico va verificato.

## Aggiornamento interfaccia e scala

Riprodotto nella scheda browser già aperta: prima del cambio URL era ancora
caricata una vecchia interfaccia. Nuovi identificativi dei moduli forzano il
caricamento della revisione corrente; il server aggiornato risponde no-store
e non usa 304 condizionali per HTML e src. La nuova policy richiede il riavvio
del server già in esecuzione; il riavvio automatico è stato rifiutato dagli
strumenti, quindi non viene dichiarato eseguito.

Con unità automatiche, floorplan.dxf ora segnala subito ingombro 796×564 mm
incompatibile con lo spessore richiesto, prima del calcolo delle stanze.
Lo stato è collocato sotto il selettore file; gli avvisi lunghi sono raccolti
in dettagli apribili. Nella scheda dell'utente la prova con pollici espliciti
ha generato e salvato il modello. Le unità restano un'ipotesi da verificare.
Prove aggiornate: 307 test Node, 5 test server e prova DXF browser sulla
porta reale 8765, con recupero da errore e annullamento.


## Importazione automatica e inquadratura (release 20261021d)
Il file reale floorplan.dxf ora genera 253 segmenti con unità automatiche dall'header, senza scelta manuale dei pollici. Le coordinate rimangono in mm dichiarati dal file. Se l'ingombro è incompatibile con lo spessore predefinito, solo lo spessore aggiunto e l'altezza di visualizzazione vengono ridotti proporzionalmente e segnalati nel rapporto. Non è una deduzione delle dimensioni reali della casa.
Il caricamento inquadra ora il modello dopo la ricostruzione; la prova screenshot ha rivelato che prima il modello piccolo risultava quasi invisibile. Limite minimo del raggio camera ridotto a 5 cm.
Verifica Edge reale con file originale: generazione e salvataggio, screenshot ispezionato, zero errori JS, annullamento e stress 100000 LINE con timer UI attivo. Node: 307/307 PASS. Restano limiti su doppi fili, blocchi INSERT e aperture; non certificata fedeltà architettonica completa.
