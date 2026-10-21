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
