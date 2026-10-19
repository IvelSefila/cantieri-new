# Affidabilità dei calcoli

Documento generato da `src/core/precisione.js` con `node tools/genera-affidabilita.mjs`. Lo stesso contenuto è nella scheda **Affidabilità** del sito, aggiornato in tempo reale con i dati del progetto aperto.

Stati possibili:

- **ESATTO**: Il calcolo segue la norma e usa solo dati certi.
- **ESATTO SUI DATI INSERITI**: La formula è quella della norma. Il risultato è giusto se sono giusti i dati che hai inserito o caricato.
- **STIMA**: Il risultato usa un metodo semplificato o un dato non ufficiale. Serve per orientarsi, non per una pratica.
- **MANCANO DATI**: Il calcolo non è completo. Sotto trovi cosa manca.

Stato mostrato qui sotto: progetto senza dati inseriti (caso peggiore).

## Geometria e misure (muri, vani)

Stato senza dati: **MANCANO DATI**

Cosa serve per un risultato preciso al 100 %:

- Almeno un muro: apri un progetto, importa un DXF o disegna
- Quote del rilievo in sito o del progetto esecutivo, in mm

Documenti necessari:

- Planimetria quotata di ogni piano (DXF/DWG o PDF vettoriale)
- Sezioni quotate (altezze di piano)

## Stanze e superfici

Stato senza dati: **MANCANO DATI**

Cosa è approssimato e perché:

- **Superficie delle stanze**: Calcolata sul contorno interno dei muri, in mm2 esatti. Una stanza non chiusa da muri non viene contata.
- **Superficie utile**: È la somma delle stanze chiuse. Se nel disegno mancano chiusure (porte senza muro, vani aperti) la superficie utile risulta minore.

Cosa serve per un risultato preciso al 100 %:

- Tutte le stanze chiuse da muri nel disegno (nessun moncone)
- Verifica con le superfici dichiarate nella planimetria catastale o di progetto

Documenti necessari:

- Planimetria quotata
- Planimetria catastale (per il confronto delle superfici)

## Muri portanti / non portanti

Stato senza dati: **STIMA**

Cosa è approssimato e perché:

- **Portante si/no**: Presunto dal tipo indicato nel disegno e dallo spessore (>= 200 mm). Dal disegno non si vede cosa regge un muro.

Cosa serve per un risultato preciso al 100 %:

- Verifica di un ingegnere strutturista secondo NTC 2018

Documenti necessari:

- Progetto strutturale o relazione di calcolo depositata
- Certificato di collaudo statico
- Saggi e rilievo in sito (se mancano i documenti)

## Infissi e materiali (vista 3D)

Stato senza dati: **STIMA**

Cosa è approssimato e perché:

- **Telai, ante, maniglie**: Profili standard per la vista. Le misure del vano sono quelle del progetto; i profili non entrano nei calcoli.

Cosa serve per un risultato preciso al 100 %:

- Scheda tecnica del serramento scelto (dimensioni dei profili, Uw, ggl,n, FF)

Documenti necessari:

- Scheda tecnica del serramento

## GSA semplificato

Stato senza dati: **STIMA**

Cosa è approssimato e perché:

- **Asol = A x g x Fsh x Ff**: Formula di orientamento con g e frazione vetrata di default. Non è la verifica di legge: usa Asol,est.

Cosa serve per un risultato preciso al 100 %:

- Usare il calcolo Asol,est (DM 26/06/2015 aggiornato)

## Asol,est (verifica estiva, DM 26/06/2015 agg. 2025)

Stato senza dati: **MANCANO DATI**

Cosa è approssimato e perché:

- **Fsol,est**: Calcolato con i dati UNI 10349:2016 di Roma riportati da una relazione di software terzo (Blumatica). Formula del DM: luglio sull'esposizione / media annua orizzontale di Roma.
- **FF (frazione telaio)**: Valore 0,20 di default (UNI/TS 11300-1:2008 ammette 0,8 di area vetrata senza dati). Il valore vero è nella scheda del serramento.
- **Fsh,ob (ombreggiamento)**: Vale 1 se non indicato: nessuna ombra da balconi, edifici o alberi. È il caso peggiore (più sole).
- **Orientamento delle pareti**: Ricavato dal disegno con il Nord presunto in alto. Se il Nord è ruotato, Fsol,est cambia.
- **Pareti esterne**: Riconosciute dalla geometria: muro con una stanza da un solo lato, nel punto del vano. Se una stanza non è chiusa nel disegno, il riconoscimento può sbagliare.

Cosa serve per un risultato preciso al 100 %:

- ggl+sh del vetro con schermatura (scheda della schermatura, UNI EN ISO 52022-1)
- Direzione del Nord della planimetria (freccia del Nord)
- Scheda tecnica di ogni serramento (FF, ggl,n)
- Rilievo di aggetti e ostruzioni per Fsh,ob (luglio)

Documenti necessari:

- Schede tecniche dei serramenti
- Scheda della schermatura solare (ggl+sh)
- Rilievo fotografico/grafico di balconi e ostruzioni

## H'T (DM 2025, Tabelle 10 e 11)

Stato senza dati: **MANCANO DATI**

Cosa serve per un risultato preciso al 100 %:

- Trasmittanza U di ogni componente (stratigrafie, UNI EN ISO 6946) o U media dell'involucro
- Ponti termici: psi x lunghezza di ogni nodo (UNI EN ISO 10211 o atlante UNI EN ISO 14683)
- Superficie disperdente e volume lordi (misure esterne)
- Zona climatica del comune (DPR 412/93)

Documenti necessari:

- Stratigrafie di muri, solai, coperture
- Abaco o calcolo dei ponti termici
- Relazione ex Legge 10 (se esiste)

## Fabbisogno di riscaldamento e raffrescamento

Stato senza dati: **STIMA**

Cosa è approssimato e perché:

- **Metodo gradi giorno**: Stima annuale semplificata, non è il metodo della UNI/TS 11300-1.
- **Bilancio mensile**: Usa le formule della UNI/TS 11300-1 (verificate sulla relazione di Roma: 4552 kWh). Mancano nel motore: durata reale della stagione, terreno, extraflusso.
- **Carico estivo di picco**: Irradianza di picco da PVGIS (dato satellitare), non dalla UNI 10349-3.

Cosa serve per un risultato preciso al 100 %:

- H_tr per componente con terreno (UNI EN ISO 13370)
- Portate di ventilazione (UNI/TS 11300-1)
- Capacità termica interna (UNI EN ISO 13786)
- Asol mensile di ogni finestra (Fw e ombreggiamenti mensili)
- Apporti interni secondo UNI/TS 11300-1

Documenti necessari:

- Relazione ex Legge 10 o APE
- Stratigrafie
- Schede dei serramenti e delle schermature

## Pompa di calore, condizionatore, radiatori

Stato senza dati: **STIMA**

Cosa è approssimato e perché:

- **COP / EER**: Stimati con il ciclo di Carnot x 0,45. Il valore vero dipende dalla macchina.

Cosa serve per un risultato preciso al 100 %:

- SCOP / SEER della macchina scelta (EN 14825)
- Calcolo UNI/TS 11300-2/3/4 dei rendimenti

Documenti necessari:

- Scheda tecnica della pompa di calore / del condizionatore
- Scheda dei radiatori (potenza a dT 50 K, esponente n)

## Fotovoltaico

Stato senza dati: **STIMA**

Cosa è approssimato e perché:

- **Resa kWh/kWp**: PVGIS-SARAH3 per Roma a 36 gradi con perdite 14 %. Ombre locali e moduli reali non sono considerati.

Cosa serve per un risultato preciso al 100 %:

- Posizione, inclinazione e ombre reali del tetto
- Scheda dei moduli e dell'inverter
- Quota rinnovabile secondo UNI/TS 11300-5
- Obbligo FER: parametro K del D.Lgs. 199/2021 (testo vigente da verificare)

Documenti necessari:

- Pianta delle coperture con orientamento
- Schede di moduli e inverter

## Solare termico (acqua calda)

Stato senza dati: **STIMA**

Cosa è approssimato e perché:

- **Rendimento del collettore**: Rendimento medio annuo 0,35 di stima. Orientamento non sud approssimato con il rapporto delle rese FV.

Cosa serve per un risultato preciso al 100 %:

- Dati del collettore (ISO 9806: eta0, a1, a2)
- Metodo della UNI/TS 11300-4

Documenti necessari:

- Scheda tecnica del collettore e dell'accumulo

## Antincendio (superfici e affollamento)

Stato senza dati: **MANCANO DATI**

Cosa è approssimato e perché:

- **Densità di affollamento**: Dalla Tabella S.4-12 del testo coordinato ufficiale (VVF, in vigore dal 1/1/2023, rev. 00). Verificare eventuali aggiornamenti.
- **Nomi delle stanze nella scheda ambiti**: Le stanze sono numerate dal motore (stanza_001...). Se modifichi i muri la numerazione può cambiare: ricontrolla la scheda ambiti dopo ogni modifica.

Cosa serve per un risultato preciso al 100 %:

- Scheda ambiti: destinazione e attività di ogni stanza
- Contorno dell'ambito se comprende più stanze

Documenti necessari:

- Scheda ambiti (JSON)
- Planimetrie delle vie di esodo
- Titoli edilizi e agibilità
- CPI e pratiche precedenti (se presenti)

## Lettura della relazione in PDF

Stato senza dati: **MANCANO DATI**

Cosa è approssimato e perché:

- **Campi estratti**: Solo PDF con testo selezionabile. Ogni valore trovato cita la riga di origine: controllalo nel campo.

Cosa serve per un risultato preciso al 100 %:

- PDF con testo (non scansione)
- Controllo dei campi trovati

Documenti necessari:

- Relazione tecnica ex Legge 10 in PDF

## Dati climatici

Stato senza dati: **ESATTO SUI DATI INSERITI**

Cosa è approssimato e perché:

- **UNI 10349:2016 Roma**: Valori della norma riportati da una relazione di software terzo, non letti sulla norma (a pagamento).
- **PVGIS**: Usato solo per il picco estivo e il fotovoltaico: dato satellitare, non di legge.

Cosa serve per un risultato preciso al 100 %:

- UNI 10349-1:2016 (prospetti del comune)

Documenti necessari:

- UNI 10349-1:2016 (acquisto UNI)

## Perché non c'è più la maggiorazione del 10 % sui ponti termici

La maggiorazione fissa del 10 % è stata tolta. Era un valore di comodo inserito nella prima versione del motore per non sottostimare le dispersioni quando mancano i dati dei ponti termici. Viene dalla vecchia UNI/TS 11300-1:2008 (prospetto 4), che ammetteva maggiorazioni dal 5 % al 30 % secondo il tipo di parete (10 % per la parete a cassa vuota). La revisione 2014 della UNI/TS 11300-1 ha abrogato le maggiorazioni percentuali, e il DM 28/10/2025 chiede il calcolo esplicito dei ponti termici. Oggi il motore usa: i valori psi x lunghezza che inserisci (metodo corretto), oppure la percentuale del prospetto 4 solo come stima dichiarata, oppure nessuna maggiorazione con l'avviso che le dispersioni sono sottostimate.

## Norme e fonti (verifica del 2026-10-19)

- **DM 26 giugno 2015 (requisiti minimi e metodi di calcolo), come aggiornato dal DM 28 ottobre 2025** [testo letto]: GU n. 283 del 5 dicembre 2025. Art. 11: in vigore dopo 180 giorni, dal 3 giugno 2026. Allegato 1 sostituito. Asol,est (Tab. 12: 0,030 E.1, 0,040 altri) e Fsol,est con la stessa formula. ([fonte](https://www.gazzettaufficiale.it/eli/gu/2025/12/05/283/sg/pdf))
- **UNI/TS 11300-1 Fabbisogno di energia termica dell'edificio** [citata]: Il DM 2025 la cita senza anno (edizione vigente, 2014 secondo le fonti tecniche). Formule del bilancio mensile lette sull'edizione 2008 (par. 15.1, prospetti 3, 4, 13, 14) e verificate con il back-test sulla relazione Blumatica di Roma calcolata con l'edizione vigente. ([fonte](https://www.gazzettaufficiale.it/eli/gu/2025/12/05/283/sg/pdf))
- **UNI/TS 11300-2 Energia primaria e rendimenti per riscaldamento e ACS** [citata]: Edizione vigente non verificata. ([fonte](https://www.gazzettaufficiale.it/eli/gu/2025/12/05/283/sg/pdf))
- **UNI/TS 11300-3 Energia primaria per la climatizzazione estiva** [citata]: Edizione vigente non verificata. ([fonte](https://www.gazzettaufficiale.it/eli/gu/2025/12/05/283/sg/pdf))
- **UNI/TS 11300-4 Energie rinnovabili per riscaldamento e ACS** [citata]: Edizione vigente non verificata. Il solare termico di energia.js non ne segue ancora il metodo. ([fonte](https://www.gazzettaufficiale.it/eli/gu/2025/12/05/283/sg/pdf))
- **UNI/TS 11300-5 Energia primaria e quota da fonti rinnovabili** [citata]: Aggiunta dal DM 2025 (art. 3). Non implementata. ([fonte](https://www.gazzettaufficiale.it/eli/gu/2025/12/05/283/sg/pdf))
- **UNI/TS 11300-6 Fabbisogno per ascensori, scale mobili e marciapiedi mobili** [citata]: Aggiunta dal DM 2025 (art. 3). Non implementata. ([fonte](https://www.gazzettaufficiale.it/eli/gu/2025/12/05/283/sg/pdf))
- **UNI 10349-1 Dati climatici: medie mensili e irradianza su superficie inclinata** [citata]: Dato climatico di riferimento del DM 2025. Per Roma si usano i valori UNI 10349:2016 stampati nella relazione di esempio Blumatica (software terzo), non letti sulla norma. PVGIS resta solo per il picco estivo e il fotovoltaico. ([fonte](https://www.blumatica.it/documentazione/esempio_relazione_tecnica.pdf))
- **UNI EN 12831-1 Carico termico di progetto, riscaldamento** [citata]: Il motore usa una versione semplificata (energia.js). ([fonte](https://www.gazzettaufficiale.it/eli/gu/2025/12/05/283/sg/pdf))
- **UNI EN ISO 52022-1 Proprietà solari di dispositivi di protezione solare (metodo semplificato)** [citata]: Citata dal DM 2025 per le schermature. ggl+sh oggi si inserisce a mano, non si calcola con questa norma. ([fonte](https://www.gazzettaufficiale.it/eli/gu/2025/12/05/283/sg/pdf))
- **UNI EN ISO 10211 Ponti termici: calcolo dettagliato** [citata]: Obbligatoria dal DM 2025 per i nodi critici. Non implementata: energia.js usa una maggiorazione forfettaria del 10 %. ([fonte](https://www.gazzettaufficiale.it/eli/gu/2025/12/05/283/sg/pdf))
- **UNI EN ISO 6946 Resistenza e trasmittanza termica dei componenti** [citata]: Resistenze superficiali Rsi e Rse di trasmittanza(). ([fonte](https://www.gazzettaufficiale.it/eli/gu/2025/12/05/283/sg/pdf))
- **DM 3 agosto 2015, Codice di prevenzione incendi (CPI)** [citata]: Ultima revisione consultata: HSE 21.0 (agosto 2025), che riassume DM 12/4/2019, DM 18/10/2019, DM 22/11/2022. Testo ufficiale non letto. ([fonte](https://certifico.com/component/acym/archive/631-dm-3-agosto-2015-codice-di-prevenzione-incendi-d-p-r-151-2011-attivita-soggette-pi-tabella-di-lettura-update-dicembre-2022))
- **D.Lgs. 192/2005 (rendimento energetico nell'edilizia)** [non verificata]: Base giuridica citata dal DM 2025. Modifiche successive non controllate.
- **D.Lgs. 199/2021 (fonti rinnovabili)** [non verificata]: Serve per la potenza FER minima (parametro K da inserire). Testo vigente non controllato.
