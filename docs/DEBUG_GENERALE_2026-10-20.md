# Debug generale — 20 ottobre 2026

Correzioni e collaudo eseguiti sul progetto locale, con modifiche preesistenti conservate. Nessun commit, push o rilascio effettuato.

## Priorità risolte

| Priorità | Problema | Correzione verificata |
|---|---|---|
| P1 | JSON malformati, identificatori ambigui e proprietà ereditate potevano superare i controlli | Validazione prima delle mutazioni; identificatori distinti, tipi e riferimenti verificati, schede ambiti importate atomicamente |
| P1 | Scelta infissi separata dal progetto e dall'annullamento | Scelta nel modello esportabile; Ctrl+Z ripristina anche l'infisso; metadati espliciti collegano i vani alle mesh |
| P1 | Dati GSA persi al refresh o trasferiti al progetto successivo | Salvataggio, ripristino e azzeramento coerenti; numeri negativi bloccati; risposte civico obsolete invalidate |
| P1 | DXF senza unità interpretati implicitamente in metri; flag dei vertici confusi con quelli della polilinea | Conferma esplicita delle unità mancanti; parser corretto; curve, mesh e geometrie non supportate escluse con avviso |
| P1 | Cambio pagina PDF e tracciamento potevano conservare riferimenti precedenti o esportare senza verifica | Azzeramento immediato della pagina precedente; medesime verifiche per generazione ed esportazione; provenienza conservata |
| P1 | Fallimento IndexedDB poteva lasciare record parziali o impedire l'uso della tavola | Abort della transazione; avviso esplicito e tavola utilizzabile. Guasto QuotaExceededError provato sul vero IndexedDB |
| P2 | Scorciatoie dell'editor interferivano con i dialoghi | Gestione del focus e sospensione dei comandi sotto i dialoghi; Tab verificato nel browser |
| P2 | Import PDF energetico senza pulizia garantita e protezione dalle risposte tardive | Limite file, distruzione del documento in finally, invalidazione al cambio progetto e richiesta di ricalcolo |

La prova browser copre i percorsi indicati nelle evidenze; il ramo di risposta tardiva del PDF energetico è protetto nel codice ma non dispone di una prova browser dedicata.

## Risultati riproducibili

| Comando | Esito |
|---|---|
| `npm test` | 290/290, zero fallimenti e zero test saltati |
| `npm run test:debug` | 23/23, zero errori JavaScript; rete esterna bloccata |
| `npm run test:planimetrie` | 59/59, inclusi PDF vettoriali e scansioni, immagini, DXF, raccolta locale e verifica geometria 3D |
| `python tools/prova-browser.py --live` | 14/14 verifiche UI e 23 ricerche reali nelle 20 regioni |
| `python -m unittest discover -s tests -p test_server.py` | 4/4 |
| `node --check` su tutti i moduli di src | 60/60 |
| `git diff --check` | PASS; soli avvisi Git sulla conversione LF/CRLF |

Gli hash dei sorgenti contenuti nei tre rapporti browser corrispondono ai file correnti al termine del collaudo.

Evidenze: [regressioni prima delle correzioni](evidenze/debug-generale/regressioni-prima.txt), [suite Node](evidenze/debug-generale/test-node.txt), [regressioni browser](evidenze/debug-generale/browser.json), [planimetrie](evidenze/planimetrie/risultati.json), [browser e civici reali](evidenze/browser.json), [schermata desktop](evidenze/debug-generale/desktop.png), [schermata mobile](evidenze/debug-generale/mobile.png).

## Limiti confermati

Le 23 ricerche hanno restituito 3 risultati BDTRE piemontesi, 18 OSM e 2 stime tipologiche (Campania e Puglia). Il progetto non integra un servizio LiDAR nazionale: OSM e stime non vengono presentati come misure LiDAR. Le prove campionarie non certificano tutti i civici italiani né l'associazione esatta fra civico ed edificio.

Le misure sintetiche PDF vettoriali, JSON e DXF hanno scarto 0 mm nei casi verificati; scansioni PDF 8 mm e immagini 2 mm su originali da 10 mm/pixel. Servono quote affidabili e verifica indipendente della scala: non si dichiara riconoscimento perfetto di PDF arbitrari. La raccolta resta locale al browser; esportare i modelli per conservarne una copia.

I calcoli edilizi, energetici e antincendio mantengono i limiti descritti in [AFFIDABILITA](AFFIDABILITA.md): queste prove non attestano conformità normativa o assenza universale di difetti.

Riferimenti tecnici del parser DXF: documentazione ufficiale Autodesk [POLYLINE](https://help.autodesk.com/cloudhelp/2020/ENU/AutoCAD-DXF/files/GUID-ABF6B778-BE20-4B49-9B58-A94E64CEFFF3.htm), [VERTEX](https://help.autodesk.com/cloudhelp/2024/ENU/AutoCAD-DXF/files/GUID-0741E831-599E-4CBF-91E1-8ADBCFD6556D.htm), [LWPOLYLINE](https://help.autodesk.com/cloudhelp/2020/ENU/AutoCAD-DXF/files/GUID-748FC305-F3F2-4F74-825A-61F04D757A50.htm).
