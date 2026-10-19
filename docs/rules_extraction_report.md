# Report di estrazione delle regole — DM 246/1987 + DM 25/01/2019 (punto 9-bis)

Stato: **APPROVATO dall'ingegnere** per R1–R7 (approvazione ricevuta dall'utente il 2026-10-19). R8–R11 sono estratti e **in attesa di approvazione**. Finché questo report non è approvato, le regole in `rules/dm246_gsa.json` sono marcate `stato: "in_attesa_approvazione"` e il motore lo dichiara in ogni output.

Fonti (hash in `sources/MANIFEST.md`):
- F2 — DM 25/01/2019, GU n. 30 del 05/02/2019 (`sources/gu_2019_30.pdf`).
- F1/F3 — DM 16/05/1987 n. 246, testo coordinato VVF (`sources/vvf_coord_246_1987.pdf`).

Le citazioni sono testuali; l'interpretazione è una traduzione in regola codificata e va approvata.

## Stato dell'estrazione

| Parte | Stato |
|---|---|
| Campo di applicazione e Tabella A (tipi a–e) | estratta, da approvare |
| Attribuzione LP 0–3 e incremento per attività comunicanti (9-bis.2) | estratta, da approvare |
| Termini per gli edifici esistenti (art. 3 DM 2019) | estratta, da approvare |
| Definizione di altezza antincendi (DM 30/11/1983, p. 1.1) | estratta (R8), in attesa di approvazione |
| Misure gestionali per LP 0–3 (9-bis.3.1–3.4, tabelle 0–3) | **titoli estratti, contenuti da codificare** |
| Attività 77, 74, 49 (DPR 151/2011 all. I) | estratte (R9–R10), in attesa di approvazione |
| Attività 75 (autorimesse) | soglia estratta (R11), categorie di dettaglio da estrarre |
| Percorso Codice / RTV V.14 (S.5) | **non estratto** — fuori dalla v1 |

## R1 — Campo di applicazione (DM 246/1987, punto 1.0 e 1.1)
Citazione: «Le presenti norme hanno per oggetto i criteri di sicurezza antincendi da applicare agli edifici destinati a civile abitazione, con altezza antincendi uguale o superiore a 12 m.»
Interpretazione: edifici residenziali con h ≥ 12 m. Sotto 12 m la norma non si applica (la verifica di altre attività resta da fare).
Applicazione agli edifici esistenti (punto 1.1): si applica di norma a nuove costruzioni e alle ristrutturazioni con modifiche sostanziali (oltre il 50% dei solai o rifacimento strutturale), come da testo; le soglie precise sono nel punto 1.1 e vanno rilette con l'ingegnere.

## R2 — Classificazione per altezza, Tabella A (DM 246/1987, punto 2.0)
Citazione (Tabella A, colonna «Tipo di edificio» e «Altezza antincendi»):
- a: «Da 12 m a 24 m»
- b: «Da oltre 24 m a 32 m»
- c: «Da oltre 32 m a 54 m»
- d: «Da oltre 54 m a 80 m»
- e: «Oltre 80 m»

Interpretazione codificata (in millimetri interi):
- h < 12000 → fuori campo.
- 12000 ≤ h ≤ 24000 → tipo a (il limite 24000 è incluso, come da «Da 12 m a 24 m»).
- 24000 < h ≤ 32000 → tipo b; 32000 < h ≤ 54000 → tipo c; 54000 < h ≤ 80000 → tipo d; h > 80000 → tipo e.

**Avviso di disomogeneità.** Il punto 9-bis.3.1 scrive «L.P.0 (12 m ≤ h < 24 m)» mentre la Tabella A include 24 m nel tipo a. Per h esattamente 24,00 m il motore applica la Tabella A (tipo a, LP 0) e segnala il conflitto testuale. Va confermato dall'ingegnere.

## R3 — Altezza antincendi (DM 30/11/1983, p. 1.1)
Citazione nel DM 246/1987: «altezza ai fini antincendi (come definita dal DM 30.11.1983)».
**Non ancora estratta.** Nel motore l'altezza è l'input dell'utente, con quote in mm e stato del dato. La formula h = quota apertura di riferimento − quota piano esterno di riferimento è la regola di progetto del PRD, non ancora verificata sul testo del 1983.
Chiarimento richiamato nel testo VVF: nota 2 al punto 1.0, chiarimento prot. P558/4122 sott. 67 del 24/03/2004 (sul piano da cui misurare). Da scaricare e leggere.

## R4 — Attribuzione dei livelli di prestazione (DM 25/01/2019, punto 9-bis.2)
Citazione: «L.P. 0 → per edifici di tipo a) (altezza antincendi da 12 m a 24 m); L.P. 1 → per edifici di tipo b) e c) (altezza antincendi oltre 24 m a 54 m); L.P. 2 → per edifici di tipo d) (altezza antincendi oltre 54 m fino a 80); L.P. 3 → per edifici di tipo e) (altezza antincendi oltre 80 m).»
Interpretazione: a→LP0, b e c→LP1, d→LP2, e→LP3.

## R5 — Incremento per attività comunicanti (DM 25/01/2019, punto 9-bis.2)
Citazione: «Per gli edifici di altezza antincendi superiore a 24 m, qualora siano presenti attività ricomprese in allegato I al D.P.R. 151/2011, e comunicanti con l'edificio stesso ma ad esso non pertinenti e funzionali, dovrà essere adottato un livello di prestazione superiore, indipendentemente dal tipo di comunicazione.»
Nota 1 del testo: «attività pertinenti e funzionali all'edificio si intendono, ad esempio, impianti produzione calore, autorimesse, gruppi elettrogeni ecc.»
Interpretazione: se h > 24000 e c'è almeno un'attività soggetta al DPR 151/2011, comunicante e non pertinente → LP + 1. Il testo dice «un livello superiore»: il motore applica +1 con tetto LP 3 (il tetto non è scritto: da confermare).
Se un attributo (soggetta, comunicante, pertinente) è «da verificare», il risultato è INDETERMINATO con i due scenari.

## R6 — Termini per gli edifici esistenti (DM 25/01/2019, art. 3)
Citazione (art. 3 comma 1, come riportata in nota 18 del testo VVF): «a. due anni dalla data di entrata in vigore del presente decreto per le disposizioni riguardanti l'installazione, ove prevista, degli impianti di segnalazione manuale di allarme incendio e dei sistemi di allarme vocale per scopi di emergenza; b. un anno dalla data di entrata in vigore del presente decreto per le restanti disposizioni.»
Il termine b è stato rinviato di sei mesi dall'art. 63-bis del DL 104/2020, convertito dalla L. 126/2020 (nota 18).
Entrata in vigore (art. 3 comma 3): «il novantesimo giorno successivo alla data di pubblicazione» → **6 maggio 2019** (GU 5/2/2019).
Interpretazione: le scadenze sono date di legge calcolate; il motore le mostra con l'avviso «da verificare con i rinvii in vigore».

## R7 — Misure gestionali per LP (DM 25/01/2019, punto 9-bis.3)
Titoli estratti: 9-bis.3.1 «L.P.0 (12 m ≤ h < 24 m)», 9-bis.3.2 «L.P.1 (24 m < h ≤ 54 m)», 9-bis.3.3 «L.P. 2 (54m < h ≤ 80 m)», 9-bis.3.4 «L.P. 3 (oltre 80 m)». Ogni livello richiama quello precedente («Tutti gli adempimenti del livello di prestazione 1 ed in aggiunta…»).
LP0 — citazione (estratto): «il responsabile dell'attività … identifica le misure standard da attuare in caso d'incendio; fornisce informazione agli occupanti …; espone un foglio informativo … numeri telefonici … istruzioni per garantire l'esodo …; mantiene in efficienza i sistemi … effettuando verifiche di controllo ed interventi di manutenzione.» Misure in caso d'incendio: istruzioni per la chiamata di soccorso, messa in sicurezza di apparecchiature, istruzioni per l'esodo, divieto di usare gli ascensori per l'evacuazione salvo ascensori antincendio (DM 15/9/2005).
Nota 0 (LP0): in attività con promiscuità di vie d'esodo le pianificazioni devono tener conto delle attività limitrofe; planimetrie per gli occupanti.

**Il contenuto di LP1, LP2, LP3 (tabelle 1–3) non è ancora codificato.** Il motore mostra per ogni LP il rinvio alla tabella e non calcola l'elenco delle misure fino all'approvazione.

## Cosa non fa il motore (v1)
- Non calcola l'altezza dal rilievo: la riceve in input con lo stato del dato.
- Non calcola la categoria dell'attività 77 (DPR 151/2011 all. I): output separato «non ancora estratta».
- Non calcola il percorso Codice / V.14.
- Non certifica nulla: ogni output riporta base normativa, dati, stato di verifica e avvertenze.

## R8 — Altezza antincendi (DM 30/11/1983, punto 1.1)
Citazione: «Altezza massima misurata dal livello inferiore dell'apertura più alta dell'ultimo piano abitabile e/o agibile, escluse quelle dei vani tecnici, al livello del piano esterno più basso.» (fonte: testo coordinato VVF, `sources/coord_1983.pdf`).
Interpretazione: h = quota dell'apertura più alta dell'ultimo piano abitabile/agibile (vani tecnici esclusi) − quota del piano esterno più basso. Il chiarimento P558/4122 del 24/03/2004 (nota 2 al DM 246/1987) precisa quale piano esterno considerare: il motore richiede che il piano di riferimento sia accessibile ai mezzi di soccorso (controllo già presente in R3).

## R9 — Attività 77 (DPR 151/2011 all. I, n. 77)
Citazione: «77 — 1 A: Edifici destinati ad uso civile, con altezza antincendio superiore a 24 m — Fino a 32 m; 2 B: … Oltre 32 m e fino a 54 m; 3 C: … Oltre 54 m.»
Interpretazione: attività soggetta solo se h > 24000 mm; classe A ≤ 32000, B ≤ 54000, C > 54000.

## R10 — Attività 74 e 49 (DPR 151/2011 all. I)
Citazione attività 74: «Impianti per la produzione di calore alimentati a combustibile solido, liquido o gassoso con potenzialità superiore a 116 kW»: A fino a 350 kW; B oltre 350 e fino a 700 kW; C oltre 700 kW.
Citazione attività 49: «Gruppi per la produzione di energia elettrica sussidiaria con motori endotermici ed impianti di cogenerazione di potenza complessiva superiore a 25 kW»: A fino a 350 kW; B oltre 350 e fino a 700 kW; C oltre 700 kW.
Nota: nel DM 246/1987 le attività pertinenti e funzionali (impianti di calore, autorimesse, gruppi elettrogeni) sono quelle che non comportano incremento (nota 1 al punto 9-bis.2): il motore usa la classificazione «pertinente» dichiarata dall'utente, non la deduce.

## R11 — Attività 75 (autorimesse)
Citazione: «Autorimesse pubbliche e private, parcheggi pluriplano e meccanizzati di superficie complessiva coperta superiore a 300 m2; locali … ».
Interpretazione: soglia 300 m² coperti. Le classi di dettaglio (A/B/C per superficie) sono nel testo ma la loro tabulazione non è ancora codificata: il motore segnala la classe come «da estrarre».

## Avvertenza
Le copie di DPR 151/2011 e DM 1983 usate sono da confrontare con la Gazzetta Ufficiale prima di un uso formale (vedi sources/MANIFEST.md).
