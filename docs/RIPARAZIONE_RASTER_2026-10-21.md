# Correzione riconoscimento della planimetria reale

La prova precedente dimostrava il funzionamento della pipeline su una tavola
sintetica, non la fedeltà della ricostruzione di case arbitrarie. La segnalazione
dell'utente ha mostrato perdite di pareti e aperture eccessive su una PNG reale.

## Correzioni

- Le bande corte dei pilastri non assorbono più quelle lunghe delle facciate.
- Le operazioni morfologiche preservano le coordinate anche con kernel pari.
- Sulle tavole con riempimento grigio viene usato il contesto interno/esterno
  per recuperare interruzioni e serramenti poco contrastati. Le ipotesi sono
  indicate nella revisione; non costituiscono riconoscimenti certi.
- Il materiale nero pieno divide o restringe le aperture candidate, preservando
  i pilastri. Collegamenti a T e angoli vengono raccordati lungo il proprio asse.
- Testi, sanitari e archi delle porte non vengono più usati come muri che
  delimitano i pavimenti. Sono filtrati alcuni tratti paralleli deboli duplicati.

## Prova reale locale

Originale PNG 640×479, SHA256
`247eac0059f218e8c7b729e38729f87a73a0b702c2e15dd2d547ec6b7610a18b`.
Eseguito `tools/prova-pianta-reale.py` sull'originale dell'utente:
worker → revisione → scala stimata → modello 3D → IndexedDB → esportazione JSON.
30 muri, 25 aperture candidate e 11 regioni di pavimento; nessun errore JS e
nessuna richiesta esterna. Originale, overlay e screenshot restano locali in
`scratch/pianta-reale/`. Il confronto visivo mostra facciate più continue e
parapetti conservati. Non è una misura di accuratezza: mancano annotazioni
complete indipendenti dell'originale.

## Regressioni eseguite

301/301 test Node, inclusi pilastro adiacente alla facciata e pilastro interno
al vano; browser riconoscimento 86/86, raster 14/14, planimetrie 59/59,
debug generale 23/23. Le varianti della suite di riconoscimento derivano dalla
stessa tavola sintetica e non equivalgono a case indipendenti.

## Limiti ancora aperti

Alcune aperture interne possono essere spurie o classificate male; regioni
collegate possono unire più stanze. Scale, ascensori, terrazzi e destinazioni
d'uso non sono interpretati semanticamente. Non viene eseguito OCR. La scala
automatica è indicativa e può produrre superfici molto diverse da quelle reali.
Questo intervento migliora il motore geometrico, non realizza ancora un
riconoscitore universale completo della casa.
