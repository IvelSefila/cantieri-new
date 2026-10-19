# Piano di miglioramento: motore planimetria → 3D

Data: 2026-10-19. Stato: proposta. Nessun codice scritto con questo piano.
Base di confronto: progetto attuale su GitHub Pages (`ivelsefila.github.io/cantieri-new`).

## 1. Cosa fanno i programmi professionali (fonti)

Ricerca svolta con ricerche web (non lettura completa dei siti: i dati sono da riassunti e pagine di confronto; da verificare prima di decisioni contrattuali).

| Programma | Cosa fa bene | Fonte |
|---|---|---|
| Sweet Home 3D | Vista 2D e 3D aggiornate insieme; libreria di mobili importabile (OBJ/ZIP); gratuito e open source. Il dato viene dal sito del suo sviluppatore, quindi non neutrale. | [confronto con Planner 5D](https://www.sweethome3d.com/blog/sweet-home-3d-vs-planner5d-comparison/) |
| Planner 5D | Catalogo molto ampio (oltre 5000 oggetti, secondo fonti di confronto); mostra 2D o 3D alla volta. | [confronto TechJockey](https://www.techjockey.com/compare/planner-5d1-vs-sweet-home-3d) |
| RoomSketcher | Editing drag-and-drop, libreria grande, "Magic Layout" per arredare una stanza in un clic. Limiti: poche opzioni di arredo e materiali, bug occasionali (da recensioni aggregate). | [confronto SaaSworthy](https://www.saasworthy.com/compare/floorplanner-vs-roomsketcher-vs-sweet-home-3d-vs-roomle?pIds=4241,6120,6125,6129) |
| Floorplanner | Pochi dati affidabili nella ricerca; non tirare conclusioni. | [confronto SaaSworthy](https://www.saasworthy.com/compare/floorplanner-vs-roomsketcher-vs-sweet-home-3d-vs-roomle?pIds=4241,6120,6125,6129) |
| openPlan3D (MIT) | Editor 2D/3D in SvelteKit e Three.js: muri a clic con snap e vincoli d'angolo, porte e finestre, scale, stanze rilevate automaticamente, catalogo mobili, camminata in prima persona. Stato dati locale. | [repo](https://github.com/laanlabs/openPlan3D) · [riassunto architettura](https://deepwiki.com/laanlabs/openPlan3D) |
| openPlan3D fork (saz-io) | Aggiunge export PDF e DXF (jsPDF, dxf-writer). | [repo fork](https://github.com/saz-io/openPlan3D) |
| FloorPlan-3D-OpenSource | Editor 2D SVG e 3D in Vue 3 e Three.js, tutto nel browser, import ed export di progetti. | [repo](https://github.com/ecy88214/FloorPlan-3D-OpenSource) |
| That Open / web-ifc | Lettura e scrittura IFC nel browser via WASM, collegato a Three.js; misure, piani di sezione, generazione 2D. Il viewer storico è deprecato a favore dei componenti. | [web-ifc-viewer](https://github.com/ThatOpen/web-ifc-viewer) · [organizzazione](https://github.com/ThatOpen) |

Conclusioni dal confronto:
- Il riferimento per l'editing è la **vista 2D e 3D sincronizzate** (Sweet Home 3D). Noi abbiamo solo la 3D.
- Gli editor open source (openPlan3D) fanno **snap, vincoli d'angolo, stanze rilevate**: noi non abbiamo un grafo di muri né le stanze.
- Lo standard di scambio professionale è **IFC** (That Open). Noi esportiamo solo JSON e GLB.

## 2. Confronto con il nostro motore

| Area | Stato attuale | Riferimento | Gap |
|---|---|---|---|
| Muri | segmenti indipendenti, si sovrappongono agli angoli | grafo di muri con giunti (openPlan3D) | giunti non risolti, misure agli angoli approssimate |
| Snap | griglia 1–100 mm | snap a vertici, angoli 0/45/90 (openPlan3D) | nessun aggancio a punti esistenti |
| Vista 2D | assente | 2D e 3D sincronizzate (Sweet Home 3D) | impossibile verificare quote a colpo d'occhio |
| Quote | assenti | quote di linea nella 2D | nessuna misura visibile in mm |
| Stanze | assenti (mq solo per geometria grezza) | stanze rilevate dai muri (openPlan3D) | superfici per stanza non esatte |
| Vani | piazzati al clic, larghezza digitata | trascinamento lungo il muro (Sweet Home 3D) | posizione meno controllata |
| Arredi | 12 tipi procedurali + 56 di esempio | catalogo con import OBJ/GLB (Sweet Home 3D) | non si importano modelli propri |
| Undo | Ctrl+Z su snapshot, 60 passi | comandi con storia | nessun redo, nessun salvataggio |
| Persistenza | nessuna (solo download JSON) | salvataggio locale (openPlan3D) | perdita dati al refresh |
| Import | JSON, DXF (muri), tracciamento su immagine | DXF, IFC | nessun IFC, DXF senza vani |
| Export | JSON, GLB (non ancora), nessun PDF/DXF | PDF/DXF (fork openPlan3D), IFC (web-ifc) | nessuna documentazione stampabile |
| Precisione | interi in mm nel modello, arrotondamenti contati | IFC e CAD usano mm/m con tolleranze | nessun controllo di tolleranza fra muri |
| Test | 38 test Node + prova browser manuale | test automatici di UI | nessun test di regressione visiva |

## 3. Miglioramenti proposti (in ordine di impatto)

**Fase A – Precisione e coerenza del modello** (fondamenta)
1. **Grafo di muri con giunti**: ogni nodo ha più muri; il calcolo dei giunti (miter) evita sovrapposizioni agli angoli. Criterio: area di intersezione fra muri adiacenti = 0 mm², test automatico.
2. **Stanze dal grafo**: rilevamento dei cicli chiusi dei muri; superficie di ogni stanza in mm² interi. Criterio: il totale delle stanze coincide con la superficie interna (test).
3. **Snap avanzato**: a vertici esistenti, a 0/45/90 gradi, con lunghezza mostrata in mm durante il disegno. Criterio: nessun punto fuori griglia salvo richiesta esplicita.
4. **Tolleranze**: segnalazione di muri quasi allineati (scarto < 1 mm) e di vani troppo vicini agli angoli (già in parte).

**Fase B – Vista 2D e quote** (quello che fanno i programmi professionali)
5. **Vista 2D in SVG** della pianta con la stessa sorgente dati: muri, vani, stanze, arredi.
6. **Quote di linea** in mm sulla 2D (lunghezze muri, larghezze vani, dimensioni stanze). Criterio: ogni quota generata = misura del modello (test).
7. **Sincronizzazione 2D/3D**: la modifica in una vista si vede nell'altra.

**Fase C – Editing professionale**
8. **Vani trascinabili** lungo il muro (come Sweet Home 3D), con offset vincolato dalla mazzetta minima.
9. **Comandi con redo**: ogni azione è un comando con `esegui` e `annulla`; redo incluso.
10. **Salvataggio locale** (IndexedDB) con ripristino all'avvio; export JSON resta.
11. **Catalogo arredi estendibile**: import di GLB/OBJ propri, categorie, ricerca.

**Fase D – Scambio e documentazione**
12. **Export DXF** del piano (muri, vani, quote) per CAD.
13. **Export PDF/SVG** della tavola con cartiglio e scala 1:100 (dimensioni esatte in mm).
14. **Export IFC** di base (muri, vani, stanze) con web-ifc: solo dopo la fase A, perché IFC richiede gerarchia e coerenza.

**Fase E – Resa visiva**
15. **Stili**: solido, vetro (già), dollhouse (già), vista isometrica e a pianta. Possibile aggiunta di luci e ombre morbide già presenti.
16. **Camminata** in prima persona (come openPlan3D).
17. **Materiali** procedurali estesi (già parquet, intonaco, marmo): aggiungere tessuti e vetro con riflesso.

## 4. Architettura consigliata

- Mantenere la separazione: `core/` puro (dati, misure, validazione), `view/` (Three.js), `ui/` (DOM). Già presente.
- Introdurre un **gestore comandi** (`esegui`, `annulla`, `ripeti`) che sostituisce lo snapshot attuale.
- Versione dello schema nel file (già `schema: 1`) e migrazioni esplicite.
- Test di proprietà (es. con `fast-check`) per giunti, stanze e snap, oltre ai test di esempio.

## 5. Decisioni da prendere

1. Priorità: fase A+B (precisione e 2D) prima della resa visiva?
2. IFC: lo vogliamo davvero nel medio termine, o basta DXF+PDF per i professionisti?
3. Catalogo arredi: solo procedurale, o si importano modelli reali (con diritti verificati)?
4. Persistenza: solo locale, o serve un account (con server)? Oggi il sito è statico e nessun dato esce dal browser.

## 6. Fasi e stime grezze

| Fase | Contenuto | Stima |
|---|---|---|
| A | grafo muri, stanze, snap, tolleranze | 2–3 settimane di lavoro |
| B | 2D SVG, quote, sincronizzazione | 2 settimane |
| C | vani trascinabili, redo, salvataggio, catalogo | 2–3 settimane |
| D | DXF, PDF, IFC base | 2 settimane (IFC escluso se rimandato) |
| E | stili aggiuntivi, camminata, materiali | 1–2 settimane |

Stime di massima per un solo sviluppatore; da rivedere dopo la fase A.
