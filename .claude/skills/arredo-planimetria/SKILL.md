---
name: arredo-planimetria
description: Usare quando si arreda, si inseriscono finestre o si classificano le stanze di una planimetria in Cantieri new. Vale per qualsiasi planimetria: decide la funzione di ogni stanza, il raggruppamento in alloggi, dove mettere i pezzi (testata del letto a Nord, armadi sui muri giusti) e le finestre secondo DM 5/7/1975.
---

# Arredo e finestre per qualsiasi planimetria (Cantieri new)

## Quando si applica
- "Arreda tutto", "Inserisci finestre", finiture o nuova planimetria importata da DXF.
- Ogni planimetria, non solo quella di prova: nessun dato specifico (nomi di stanze, numeri) va scritto nel codice.

## Passi, nell'ordine
1. **Alloggi**: le stanze collegate da porte interne formano un alloggio (`src/core/alloggi.js`). Se ce ne sono più di uno, l'utente ne sceglie uno.
2. **Funzione di ogni stanza**: la planimetria non porta etichette. Si parte dal suggerimento (`src/core/funzioni-stanze.js`: ripostiglio ≤2,5 m², disimpegno snello ≤4 m², bagno ≤6,5 m², soggiorno la più grande, camera o cucina il resto). L'utente conferma o corregge ogni stanza prima di arredare. Una scelta confermata prevale sempre sul suggerimento.
3. **Pezzi per funzione** (`ARREDO_PER_FUNZIONE_ELENCO`): soggiorno, cucina, camera, bagno, disimpegno, ripostiglio. Mai un pezzo di una funzione in una stanza di altra funzione.
4. **Posizione per regola** (`src/core/arredo-intelligente.js`, `REGOLE_ARREDO`):
   - letto: testata contro il muro a Nord se c'è, altrimenti muro interno, mai davanti a finestre o porte;
   - comodini: accanto al letto; armadio e cassettiera: su muro libero, preferibilmente a Nord/Est/Ovest, non davanti a finestre;
   - scrivania: sul muro con finestra; divano: muro interno o non a Sud, tavolino davanti, TV opposta;
   - cucina: lungo un muro; frigorifero accanto; tavolo al centro con sedie;
   - bagno: sanitari su muro interno (condotti vicini), mai davanti alla porta.
   L'orientamento dei muri viene da `orientamentoDaGeometria` (Nord in alto = 0°; cambiare `nordGradi` se il Nord non è in alto).
5. **Finestre** (`src/core/automatismi.js`, `infissiAutomatici`): secondo DM 5/7/1975 (`sources/dm_1975_05_07.txt`):
   - art. 5: superficie apribile ≥ 1/8 della superficie del pavimento per camere, soggiorno, cucina;
   - art. 2 c. 4: finestra apribile per letto, soggiorno e cucina;
   - art. 5: il bagno è esente dalla luce naturale; senza finestra si segnala la ventilazione meccanica (art. 6);
   - art. 1: altezza interna 2,70 m (2,40 m per bagni, disimpegni, ripostigli). Sotto, si segnala.
   Preferenza energetica: Sud, poi Est/Ovest, poi Nord.
6. **Avvisi in sovrimpressione**: ogni pezzo o finestra non presente nella planimetria va elencato nel pannello, con la norma o la regola applicata.

## Cosa non fare
- Non posare pezzi "a caso" o solo per dimensione: ogni pezzo ha una funzione e una regola.
- Non inventare il Nord: se non è confermato, dichiararlo (stato "presunto").
- Non mettere finestre su muri che non sono facciate (`latoEsterno` = nessuno o interno).
- Non ignorare un pezzo che non entra: va segnalato, non forzato.

## Verifica prima di dichiarare fatto
- `npm test` verde (`tests/automatismi.test.mjs`).
- Su una planimetria con almeno due alloggi: si arreda solo l'alloggio scelto; il letto ha la testata sul muro previsto; ogni stanza abitabile ha il suo 1/8.
- Il pannello mostra i pezzi aggiunti e gli avvisi.

## File
- `src/core/alloggi.js` — alloggi
- `src/core/funzioni-stanze.js` — funzioni e liste pezzi
- `src/core/arredo-intelligente.js` — regole e posizionamento
- `src/core/automatismi.js` — finiture, finestre, norme
- `src/app.js` — flusso "Arreda tutto" (scelta alloggio, conferma funzioni)
- `sources/dm_1975_05_07.txt` — norma sorgente
