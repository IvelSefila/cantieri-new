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


## Secondo DXF reale: floor-plan-apartment (2).dxf (release 20261021f)
Il campione consigliato dal sito ha header mm, coordinate 12×9 e quote testuali 12000/9000. La conversione precedente arrotondava prematuramente le due facce distanti 0.20/0.25 unità, provocando muri sovrapposti.
Ora coppie LINE ortogonali dello stesso layer con estremi longitudinali coincidenti e un solo vicino compatibile diventano un asse e uno spessore. Le catene ambigue di parallele non vengono unite. Prima dell'abbinamento limite 1000 tratti, dopo 500, nel worker interrompibile.
Solo due quote testuali numeriche su layer DIM/QUOTE concordanti con entrambe le dimensioni possono correggere una scala automatica di fattore 10/100/1000; scelta manuale prevale. Correzione esplicita nel rapporto, nello stato UI e banner DIMENSIONI STIMATE persistito nel progetto. Non è interpretazione generale di DIMENSION o garanzia metrica.
Segmenti LINE su layer GLAZ/WINDOW/FINESTR coincidenti con gli assi generano finestre con larghezza da disegno e altezza/davanzale indicativi. Nessun riconoscimento dei simboli porta ARC in questa modifica.
Prova file reale in Edge: 8 muri (250 mm esterni, 200 mm interni), 4 vani finestra, 12×9 m dedotti dalle quote, generazione/salvataggio e screenshot ispezionato; zero errori JS, stress 100000 LINE reattivo e abort PASS. Suite Node 308/308 PASS. Originale e screenshot restano privati in scratch. Porte e pavimenti non generati; il campione stesso contiene pareti continue sotto i simboli porta e finestre che attraversano partizioni. Non dichiarare modello completo o fedele a una casa reale.


## Porte da simboli ARC + LINE (release 20261021g)
Aggiunta lettura separata degli archi su layer DOOR/PORT: gli archi non vengono estrusi come muri. Riconoscimento limitato a battenti ortogonali con arco a 90°, una sola anta radiale coerente, cardine entro lo spessore del muro, estremo chiuso sul muro, varco contenuto e senza sovrapposizioni. Più muri candidati, ante mancanti o simboli fuori muro non creano tagli. Altezza indicativa min(2100, 75% altezza muro), cardine conservato; non ricostruisce blocchi INSERT o porte scorrevoli.
Sul DXF reale floor-plan-apartment (2).dxf: 2 porte riconosciute, 2 simboli fuori muro da verificare. Varchi su A-WALL_007 offset 50 mm e A-WALL_008 offset 2200 mm, entrambi 850×2100 mm. Il primo lascia una mazzetta di 50 mm, segnalata dalla validazione esistente; non è una verifica di conformità.
Edge reale: generazione, persistenza del progetto con 8 muri e 6 vani (4 finestre + 2 porte), larghezze/altezze controllate nel JSON recuperabile, screenshot 3D ispezionato con taglio visibile, zero errori JS; abort e stress 100000 LINE con timer attivo PASS. Anche la scheda utente su porta 8765 è stata aggiornata e il file ricaricato: stato visibile 2 riconosciute/2 da verificare. Node 312/312 PASS, inclusi casi negativi di simbolo fuori muro, mancanza anta, muro ambiguo, sovrapposizione, arco diverso da 90° e muro invertito. Il risultato attuale crea i varchi; il montaggio di un'anta/catalogo resta separato. Non dichiarare riconosciute tutte e quattro le porte.
