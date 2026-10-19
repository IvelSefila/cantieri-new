// Dati normativi del Codice di prevenzione incendi (DM 3 agosto 2015, Allegato I), copiati dal testo ufficiale.
// Fonte: Ministero dell'Interno - Dipartimento dei Vigili del Fuoco, "Testo coordinato dell'Allegato I del DM 3 agosto 2015",
// edizione in vigore dal 1 gennaio 2023, revisione 00, capitolo S.4 Esodo, pagina S.4-17.
// Il professionista verifica che l'edizione sia quella vigente alla data del progetto.
export const FONTE_NORMATIVA = {
  documento: "DM 3 agosto 2015, Allegato I - Codice di prevenzione incendi (testo coordinato)",
  edizione: "in vigore dal 1 gennaio 2023, revisione 00",
  url: "https://www.vigilfuoco.it/servizi-le-aziende-e-i-professionisti/prevenzione-incendi/testi-coordinati-di-prevenzione/codice-prevenzione-incendi",
};

// Tabella S.4-12: Densita' di affollamento per tipologia di attivita' (persone/m2).
// "codice" e' la chiave da usare nella scheda ambiti. I valori sono quelli stampati nella tabella:
// un valore puo' valere per piu' righe (cella unita).
export const DENSITA_S412 = [
  { codice: "spettacolo_aperto", attivita: "Ambiti all'aperto destinati ad attivita' di spettacolo o intrattenimento, delimitati e privi di posti a sedere", densitaPersoneM2: 2.0 },
  { codice: "spettacolo_chiuso_qf50", attivita: "Locali al chiuso di spettacolo o intrattenimento privi di posti a sedere e di arredi, con carico di incendio specifico qf <= 50 MJ/m2", densitaPersoneM2: 2.0 },
  { codice: "mostre", attivita: "Ambiti per mostre, esposizioni", densitaPersoneM2: 1.2 },
  { codice: "spettacolo_arredi_qf50", attivita: "Ambiti destinati ad attivita' di spettacolo o intrattenimento con presenza di arredi o con carico di incendio specifico qf > 50 MJ/m2", densitaPersoneM2: 1.2 },
  { codice: "ristorazione", attivita: "Ambiti adibiti a ristorazione", densitaPersoneM2: 0.7 },
  { codice: "scolastica_laboratori", attivita: "Ambiti adibiti ad attivita' scolastica e laboratori (senza posti a sedere)", densitaPersoneM2: 0.4 },
  { codice: "sale_attesa", attivita: "Sale d'attesa", densitaPersoneM2: 0.4 },
  { codice: "uffici", attivita: "Uffici", densitaPersoneM2: 0.4 },
  { codice: "vendita_alimentare_piccola", attivita: "Ambiti di vendita di piccole attivita' commerciali al dettaglio con settore alimentare o misto", densitaPersoneM2: 0.4 },
  { codice: "vendita_alimentare_media_grande", attivita: "Ambiti di vendita di medie e grandi attivita' commerciali al dettaglio con settore alimentare o misto", densitaPersoneM2: 0.2 },
  { codice: "vendita_non_alimentare", attivita: "Ambiti di vendita di attivita' commerciali al dettaglio senza settore alimentare", densitaPersoneM2: 0.2 },
  { codice: "biblioteche_archivi", attivita: "Sale di lettura di biblioteche, archivi", densitaPersoneM2: 0.2 },
  { codice: "ambulatori", attivita: "Ambulatori", densitaPersoneM2: 0.1 },
  { codice: "vendita_ingrosso", attivita: "Ambiti di vendita di attivita' commerciali all'ingrosso", densitaPersoneM2: 0.1 },
  { codice: "vendita_non_alimentare_specifica", attivita: "Ambiti di vendita di piccole attivita' commerciali al dettaglio con specifica gamma merceologica non alimentare", densitaPersoneM2: 0.1 },
  { codice: "civile_abitazione", attivita: "Civile abitazione", densitaPersoneM2: 0.05 },
];

// Voce della Tabella S.4-12 per codice, oppure null se il codice non esiste.
export function voceDensita(codice) {
  return DENSITA_S412.find((r) => r.codice === codice) || null;
}

// Tabella S.4-13: Criteri per tipologia di attivita' (quando il numero di occupanti non deriva dalla densita').
export const CRITERI_S413 = [
  { attivita: "Autorimesse pubbliche", criterio: "2 persone per veicolo parcato" },
  { attivita: "Autorimesse private", criterio: "1 persona per veicolo parcato" },
  { attivita: "Degenza", criterio: "1 degente e 2 accompagnatori per posto letto + addetti" },
  { attivita: "Ambiti con posti a sedere o posti letto (es. sale riunioni, aule scolastiche, dormitori)", criterio: "Numero posti + addetti" },
  { attivita: "Altri ambiti", criterio: "Numero massimo presenti (addetti + pubblico)" },
];
