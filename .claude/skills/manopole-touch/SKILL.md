---
name: manopole-touch
description: Usare quando si lavora sui comandi touch di Cantieri new sul telefono: manopole virtuali, prima persona, tocco sulla scena, versioni dei file nel browser del telefono.
---

# Manopole e tocco sul telefono (Cantieri new)

## Cosa fa il sistema
- **Manopola sinistra** (muove): il pallino manda solo i tasti W A S D. Non tocca mai lo sguardo.
- **Manopola destra** (guarda): il pallino manda lo sguardo (`setStickPasseggiata(null, v)`), su/giù e sinistra/destra.
- **Trascinare sulla scena** con il dito guarda intorno (il trascinamento del mouse, gia' esistente).
- Le manopole sono piccole (112 px, pallino 44 px, raggio 38 px) e appaiono solo in prima persona su schermo tattile.

## Regole apprese (non rifare gli stessi errori)
1. **Il pallino parte dal centro e segue il dito di quanto ti sposti**, non alla posizione assoluta del dito. Con la posizione assoluta il pallino saltava e si bloccava.
2. **Eventi di tocco nativi** (`touchstart`, `touchmove`, `touchend` con `identifier`) per le manopole: sono quelli che funzionano sui telefoni. Il rilascio si cerca tra `e.touches` (tutti i tocchi attivi), non solo tra `changedTouches`, altrimenti il rilascio si perde e la manopola resta ferma.
3. **Una manopola non deve mai cambiare cio' che cambia l'altra.** La sinistra usa i tasti, la destra lo sguardo. Se un valore dello sguardo resta acceso, la visuale sale da sola.
4. **Non bloccare il tocco con `pointer-events:none` sulla scena** a meno che serva davvero: ha tolto anche il trascinamento per guardare.
5. **Non dare la colpa alla cache** senza prova. Prima verificare con un test riproducibile, poi con il telefono.

## Cache del browser del telefono
- `index.html` carica `src/app.js?v=...` e i fogli `src/ui/*.css?v=...`: cambiare il numero a ogni rilascio.
- I moduli importati da `app.js` (scena, prima persona) **non hanno versione**: il telefono puo' tenere una copia vecchia per qualche minuto. Per una correzione urgente, mettere la parte necessaria in `app.js`, che e' sempre aggiornato.

## Come verificare
- `npm test` deve restare verde (246).
- Nel browser con `resize_window` preset `mobile` e `touchstart`/`touchmove` sintetici (`new Touch(...)`, `new TouchEvent(...)`) sulla manopola, leggendo `style.transform` del pallino.
- Un test sintetico NON replica il tocco reale: dichiarare sempre cosa e' stato verificato e cosa no.

## File
- `src/app.js`: funzione `manopola`, `montaManopole`, `allineaTastiMovimento`, `aggiornaPrimaPersona`
- `src/view/scene.js`: `setStickPasseggiata`
- `src/view/passeggiata-view.js`: `setStick`, `aggiorna` (uso di `stick.move` e `stick.look`), trascinamento del mouse
- `src/ui/hud.css`: regole `@media (max-width: 700px)` e `body.pp-on`

## Stato verificato (2026-10-20)
- Codice attuale: `cdbd28c` (sinistra solo W A S D) con manopole piccole (`1fa24a8`, versione `v20261020l`).
- Sul telefono l'utente ha riportato che ora funziona. Non so quale modifica l'abbia risolto: nell'ultimo passo non ho cambiato codice, e nel test sintetico la manopola sinistra non cambia ne' `pitch` ne' `yaw`. Quindi la causa non e' confermata.
- Il rilascio forzato dei valori (`touchend` che azzera movimento e sguardo, commit `4fbf393`) non e' nel codice attuale: e' stato tolto riportando i sorgenti a `cdbd28c`.
- Per la prossima volta: se la visuale gira sul telefono, prima raccogliere i valori reali (tasti attivi, `stick.move`, `stick.look`, `pitch`, `yaw`) con un riquadro di debug sul telefono, poi correggere.
