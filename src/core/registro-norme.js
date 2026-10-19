// Registro delle norme usate dai motori, con la fonte verificata e la data della verifica.
// Stato: "testo letto" = verificato sul testo ufficiale; "citata" = nominata nel testo ufficiale letto,
// edizione non verificata; "non verificata" = da controllare. Le edizioni UNI sono a pagamento:
// il registro non sostituisce il catalogo UNI.

export const DATA_VERIFICA = "2026-10-19";
const GU_2025 = "https://www.gazzettaufficiale.it/eli/gu/2025/12/05/283/sg/pdf";

export const NORME = {
  dm_requisiti_2015_2025: {
    titolo: "DM 26 giugno 2015 (requisiti minimi e metodi di calcolo), come aggiornato dal DM 28 ottobre 2025",
    stato: "testo letto",
    dettaglio: "GU n. 283 del 5 dicembre 2025. Art. 11: in vigore dopo 180 giorni, dal 3 giugno 2026. Allegato 1 sostituito. Asol,est (Tab. 12: 0,030 E.1, 0,040 altri) e Fsol,est con la stessa formula.",
    fonte: GU_2025,
    usatoDa: ["gsa.js (Asol,est)", "limiti.js (H'T)"],
  },
  uni_ts_11300_1: { titolo: "UNI/TS 11300-1 Fabbisogno di energia termica dell'edificio", stato: "citata", dettaglio: "Il DM 2025 la cita senza anno (edizione vigente, 2014 secondo le fonti tecniche). Formule del bilancio mensile lette sull'edizione 2008 (par. 15.1, prospetti 3, 4, 13, 14) e verificate con il back-test sulla relazione Blumatica di Roma calcolata con l'edizione vigente.", fonte: GU_2025, usatoDa: ["mensile.js (bilancio mensile)", "limiti.js (H'tr,adj)", "energia.js (prospetto 4, solo stima)"] },
  uni_ts_11300_2: { titolo: "UNI/TS 11300-2 Energia primaria e rendimenti per riscaldamento e ACS", stato: "citata", dettaglio: "Edizione vigente non verificata.", fonte: GU_2025, usatoDa: [] },
  uni_ts_11300_3: { titolo: "UNI/TS 11300-3 Energia primaria per la climatizzazione estiva", stato: "citata", dettaglio: "Edizione vigente non verificata.", fonte: GU_2025, usatoDa: [] },
  uni_ts_11300_4: { titolo: "UNI/TS 11300-4 Energie rinnovabili per riscaldamento e ACS", stato: "citata", dettaglio: "Edizione vigente non verificata. Il solare termico di energia.js non ne segue ancora il metodo.", fonte: GU_2025, usatoDa: ["energia.js (solare termico, semplificato)"] },
  uni_ts_11300_5: { titolo: "UNI/TS 11300-5 Energia primaria e quota da fonti rinnovabili", stato: "citata", dettaglio: "Aggiunta dal DM 2025 (art. 3). Non implementata.", fonte: GU_2025, usatoDa: [] },
  uni_ts_11300_6: { titolo: "UNI/TS 11300-6 Fabbisogno per ascensori, scale mobili e marciapiedi mobili", stato: "citata", dettaglio: "Aggiunta dal DM 2025 (art. 3). Non implementata.", fonte: GU_2025, usatoDa: [] },
  uni_10349_1: { titolo: "UNI 10349-1 Dati climatici: medie mensili e irradianza su superficie inclinata", stato: "citata", dettaglio: "Dato climatico di riferimento del DM 2025. Per Roma si usano i valori UNI 10349:2016 stampati nella relazione di esempio Blumatica (software terzo), non letti sulla norma. PVGIS resta solo per il picco estivo e il fotovoltaico.", fonte: "https://www.blumatica.it/documentazione/esempio_relazione_tecnica.pdf", usatoDa: ["clima.js (Roma)", "fsol.js (Fsol,est)", "mensile.js"] },
  uni_en_12831_1: { titolo: "UNI EN 12831-1 Carico termico di progetto, riscaldamento", stato: "citata", dettaglio: "Il motore usa una versione semplificata (energia.js).", fonte: GU_2025, usatoDa: ["energia.js (carico invernale semplificato)"] },
  uni_en_iso_52022_1: { titolo: "UNI EN ISO 52022-1 Proprietà solari di dispositivi di protezione solare (metodo semplificato)", stato: "citata", dettaglio: "Citata dal DM 2025 per le schermature. ggl+sh oggi si inserisce a mano, non si calcola con questa norma.", fonte: GU_2025, usatoDa: ["gsa.js (ggl+sh da inserire)"] },
  uni_en_iso_10211: { titolo: "UNI EN ISO 10211 Ponti termici: calcolo dettagliato", stato: "citata", dettaglio: "Obbligatoria dal DM 2025 per i nodi critici. Non implementata: energia.js usa una maggiorazione forfettaria del 10 %.", fonte: GU_2025, usatoDa: ["energia.js (ponti termici forfettari)"] },
  uni_en_iso_6946: { titolo: "UNI EN ISO 6946 Resistenza e trasmittanza termica dei componenti", stato: "citata", dettaglio: "Resistenze superficiali Rsi e Rse di trasmittanza().", fonte: GU_2025, usatoDa: ["energia.js (trasmittanza)"] },
  dm_cpi_2015: { titolo: "DM 3 agosto 2015, Codice di prevenzione incendi (CPI)", stato: "citata", dettaglio: "Ultima revisione consultata: HSE 21.0 (agosto 2025), che riassume DM 12/4/2019, DM 18/10/2019, DM 22/11/2022. Testo ufficiale non letto.", fonte: "https://certifico.com/component/acym/archive/631-dm-3-agosto-2015-codice-di-prevenzione-incendi-d-p-r-151-2011-attivita-soggette-pi-tabella-di-lettura-update-dicembre-2022", usatoDa: ["antincendio.js (densità di affollamento, Tab. S.4-12)"] },
  dlgs_192_2005: { titolo: "D.Lgs. 192/2005 (rendimento energetico nell'edilizia)", stato: "non verificata", dettaglio: "Base giuridica citata dal DM 2025. Modifiche successive non controllate.", fonte: "", usatoDa: [] },
  dlgs_199_2021: { titolo: "D.Lgs. 199/2021 (fonti rinnovabili)", stato: "non verificata", dettaglio: "Serve per la potenza FER minima (parametro K da inserire). Testo vigente non controllato.", fonte: "", usatoDa: ["energia.js (potenzaMinimaFER)"] },
};
