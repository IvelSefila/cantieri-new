# Casa indicativa da immagine — release 20261021h

Obiettivo: ottenere dalla planimetria raster un modello locale navigabile con pareti, pavimenti e serramenti, anche senza quote reali.

## Percorso implementato
Planimetrie → immagine/PDF → Genera casa 3D indicativa con porte e finestre. Il pulsante usa il riconoscimento esistente, attiva la scala stimata, applica i rilevamenti, genera il modello e lo salva nella raccolta. La scelta OFF della scala stimata mantiene il percorso con calibrazione e seconda quota.

La scala usa l'ipotesi di porta larga 900 mm soltanto con almeno tre simboli ad arco concordanti e punteggio >= 0.75; simboli inferiti o esclusi non sono usati. Altrimenti resta la stima dallo spessore mediano dei muri. Ingombro limitato a 4–30 m. Nessuna quota misurata: banner e metadati persistenti lo dichiarano.

Nella modalità stimata, l'opzione Monta porte e finestre dimostrative assegna alle aperture i modelli già presenti nel catalogo locale: porta filomuro bianca, finestra PVC, scorrevole PVC. Non riconosce marca o prodotto dalla fotografia. L'opzione è disattivabile. Pavimenti e contorni derivano dal motore esistente. Nessun nuovo modello ML, servizio esterno o download di componenti.

## Prova sull'originale dell'utente
`Downloads/images.png`, SHA256 247eac0059f218e8c7b729e38729f87a73a0b702c2e15dd2d547ec6b7610a18b. Edge reale, rete esterna bloccata: 30 muri, 25 aperture candidate (17 porte e 8 finestre), 11 pavimenti; 25 aperture con infisso montato, controllate dal costruttore 3D sul progetto esportato. Generazione con il nuovo pulsante, esportazione JSON e metadati di stima/finiture dimostrative verificati. Ingresso e uscita dalla prima persona provati. Zero errori JS e zero richieste esterne nel run finale. Originale ed evidenze rimangono privati in scratch/casa-finiture. Anche nella scheda utente sulla porta 8765 il PNG è stato caricato e il modello generato/salvato.

La prova ha trovato InvalidStateError su setPointerCapture in prima persona durante pointer lock: non si richiede più la cattura aggiuntiva quando il canvas possiede già il blocco del puntatore.

## Limiti visibili
Il conteggio dei candidati non misura l'accuratezza. Restano aperture false/mancanti, partizioni da rivedere, stanze unite e una regione molto piccola. Scale e ascensore non sono ricostruiti semanticamente; terrazzi, impianti, arredi e destinazioni d'uso non sono riconosciuti. Porte e finestre hanno misure/altezze dimostrative; il modello non è una ricostruzione architettonica certificata. La forma segue la foto e non deve coincidere con l'esempio AR-02, che rappresenta un'altra disposizione.

## Verifica riproducibile
`python tools/prova-pianta-reale.py --image C:/Users/fabri/Downloads/images.png --output scratch/casa-finiture`

Suite Node: 314/314 PASS, comprese le condizioni negative per la scala da simboli porta.
