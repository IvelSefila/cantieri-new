// Gestione della Sicurezza Antincendio (GSA) nei luoghi di lavoro: DM 2 settembre 2021 (GU n. 237 del 4/10/2021),
// attuazione dell'art. 46 comma 3 del D.Lgs. 81/2008. Funzioni pure: ogni obbligo cita articolo o allegato.
// Il motore dice cosa e' obbligatorio, cosa manca e quando scadono corsi ed esercitazioni. Non valuta il rischio:
// il livello di rischio e l'elenco delle attivita' di livello 2 e 3 devono essere indicati dal datore di lavoro.

export const GSA_FONTE = {
  documento: "DM 2 settembre 2021, Criteri per la gestione dei luoghi di lavoro in sicurezza antincendio",
  gazzetta: "GU Serie generale n. 237 del 4 ottobre 2021",
  entrataInVigore: "un anno dopo la pubblicazione: dal 4 ottobre 2022",
  url: "https://www.vigilfuoco.it/sites/default/files/Comando%20Perugia/Formazione/2021_09_02%20-%20Decreto%20gestione%20sicurezza%20luoghi%20di%20lavoro%20e%20formazione.pdf",
};

// Allegato I, par. 1.2: argomenti dell'informazione e della formazione antincendio dei lavoratori
export const INFORMAZIONE_ARGOMENTI = [
  "rischi di incendio e di esplosione legati all'attivita'",
  "rischi legati alle specifiche mansioni",
  "misure di prevenzione e protezione adottate nel luogo di lavoro",
  "ubicazione delle vie d'esodo",
  "procedure da adottare in caso di incendio (azioni, allarme, evacuazione, chiamata dei vigili del fuoco)",
  "nominativi dei lavoratori incaricati di prevenzione incendi, lotta antincendio, gestione emergenze e primo soccorso",
  "nominativo del responsabile del servizio di prevenzione e protezione",
];

// Allegato II, par. 2.2 n. 3: elementi che la planimetria del piano di emergenza deve riportare
export const PLANIMETRIA_ELEMENTI = [
  { id: "distribuzione", testo: "caratteristiche distributive, destinazione delle aree, vie di esodo, compartimentazioni antincendio" },
  { id: "sistemi_antincendio", testo: "ubicazione dei sistemi di sicurezza antincendio, attrezzature e impianti di estinzione" },
  { id: "allarmi", testo: "ubicazione degli allarmi e della centrale di controllo" },
  { id: "interruttori", testo: "ubicazione dell'interruttore generale elettrico, delle valvole di intercettazione di acqua, gas e fluidi combustibili" },
  { id: "rischio_specifico", testo: "ubicazione dei locali a rischio specifico" },
  { id: "primo_soccorso", testo: "ubicazione dei presidi e ausili di primo soccorso" },
  { id: "ascensori", testo: "indicazione dei soli ascensori utilizzabili in caso di incendio" },
];

// Allegato II, par. 2.1 e 2.2 n. 1-2: contenuti scritti del piano di emergenza
export const PIANO_CONTENUTI = [
  { id: "azioni", testo: "azioni che i lavoratori devono mettere in atto in caso di incendio (all. II 2.1 n. 1 a)" },
  { id: "evacuazione", testo: "procedure per l'evacuazione dei lavoratori e delle altre persone presenti (all. II 2.1 n. 1 b)" },
  { id: "vigili_fuoco", testo: "disposizioni per chiedere l'intervento dei vigili del fuoco e fornire le informazioni all'arrivo (all. II 2.1 n. 1 c)" },
  { id: "esigenze_speciali", testo: "misure per assistere le persone con esigenze speciali (all. II 2.1 n. 1 d)" },
  { id: "addetti_numero", testo: "numero di addetti al servizio antincendio, congruo con turni e assenze (all. II 2.1 n. 2)" },
  { id: "compiti", testo: "compiti del personale di servizio e dei responsabili in caso di incendio (all. II 2.2 n. 2 a, b)" },
  { id: "informazione_personale", testo: "provvedimenti per informare tutto il personale sulle procedure (all. II 2.2 n. 2 c)" },
  { id: "rischi_particolari", testo: "misure per i lavoratori esposti a rischi particolari e per le aree ad elevato rischio (all. II 2.2 n. 2 d, e)" },
  { id: "chiamata_vvf", testo: "procedure per la chiamata dei vigili del fuoco e l'assistenza durante l'intervento (all. II 2.2 n. 2 f)" },
];

// Allegato III, par. 3.2.2: attivita' di livello 3 (elenco ministeriale)
export const LIVELLO3 = {
  stabilimenti_soglia: "stabilimenti di soglia inferiore o superiore (D.Lgs. 105/2015)",
  esplosivi: "fabbriche e depositi di esplosivi",
  centrali_termoelettriche: "centrali termoelettriche",
  estrazione_oli_gas: "impianti di estrazione di oli minerali e gas combustibili",
  nucleare: "impianti e laboratori nucleari",
  depositi_combustibili_20000: "depositi al chiuso di materiali combustibili con superficie superiore a 20.000 m2",
  commerciali_10000: "attivita' commerciali ed espositive con superficie aperta al pubblico superiore a 10.000 m2",
  stazioni_5000: "aerostazioni, stazioni ferroviarie e marittime con superficie coperta accessibile al pubblico superiore a 5.000 m2; metropolitane",
  interporti_20000: "interporti con superficie superiore a 20.000 m2",
  alberghi_200: "alberghi con oltre 200 posti letto",
  sanitarie: "strutture sanitarie con ricovero, case di riposo per anziani",
  scuole_1000: "scuole di ogni ordine e grado con oltre 1.000 persone presenti",
  uffici_1000: "uffici con oltre 1.000 persone presenti",
  cantieri_gallerie: "cantieri in sotterraneo per gallerie, caverne, pozzi di lunghezza superiore a 50 m",
  cantieri_esplosivi: "cantieri temporanei o mobili ove si impiegano esplosivi",
  rifiuti: "stabilimenti di stoccaggio o trattamento di rifiuti (esclusi gli inerti)",
};

// Allegato III, par. 3.2.5-3.2.6: durata dei corsi per livello di rischio (ore, verifica di apprendimento compresa)
export const CORSI = {
  1: { formazione: { ore: 4, sigla: "1-FOR" }, aggiornamento: { ore: 2, sigla: "1-AGG" } },
  2: { formazione: { ore: 8, sigla: "2-FOR" }, aggiornamento: { ore: 5, sigla: "2-AGG" } },
  3: { formazione: { ore: 16, sigla: "3-FOR" }, aggiornamento: { ore: 8, sigla: "3-AGG" } },
};
export const ANNI_AGGIORNAMENTO = 5; // art. 5 comma 5

// Livello di rischio (Allegato III, 3.2.1-3.2.4): 3 se l'attivita' e' nell'elenco di livello 3; 2 se soggetta al
// DPR 151/2011 all. I o cantiere con fiamme libere; 1 altrimenti.
export function livelloRischio({ livello3 = [], soggettaCPI = false, cantiereFiamme = false } = {}) {
  if (livello3.length) return { livello: 3, motivo: `attivita' di livello 3: ${livello3.map((k) => LIVELLO3[k] ?? k).join("; ")}` };
  if (soggettaCPI || cantiereFiamme) return { livello: 2, motivo: soggettaCPI ? "attivita' soggetta al DPR 151/2011 (allegato I)" : "cantiere con sostanze infiammabili e fiamme libere" };
  return { livello: 1, motivo: "attivita' non compresa nei livelli 2 e 3" };
}

// Obbligo di piano di emergenza (art. 2 comma 2) e misure semplificate (all. II par. 4)
export function obbligoPiano({ lavoratori = 0, aperto_pubblico = false, pubblico_contemporaneo = 0, soggettaCPI = false, attivita_complessa = false } = {}) {
  const motivi = [];
  if (lavoratori >= 10) motivi.push(`almeno dieci lavoratori occupati (sono ${lavoratori})`);
  if (aperto_pubblico && pubblico_contemporaneo > 50) motivi.push(`luogo aperto al pubblico con piu' di cinquanta persone contemporanee (sono ${pubblico_contemporaneo})`);
  if (soggettaCPI) motivi.push("attivita' compresa nell'allegato I del DPR 151/2011");
  const obbligatorio = motivi.length > 0;
  // all. II par. 4: per esercizi aperti al pubblico con meno di 10 lavoratori e piu' di 50 persone, esclusi CPI ed edifici complessi
  const semplificate = aperto_pubblico && lavoratori < 10 && pubblico_contemporaneo > 50 && !attivita_complessa && !soggettaCPI;
  return {
    obbligatorio,
    motivi,
    riferimento: "DM 2/9/2021, art. 2 comma 2",
    misureSemplificate: semplificate,
    senzaPiano: obbligatorio ? null : "le misure organizzative e gestionali vanno nel documento di valutazione dei rischi (art. 2 comma 4)",
  };
}

// Calcolo completo della GSA. Dati assenti: segnalati in `mancanti`, mai assunti.
export function calcolaGSA(d = {}) {
  const mancanti = [];
  if (d.lavoratori === undefined || d.lavoratori === null) mancanti.push("numero dei lavoratori occupati");
  if (d.aperto_pubblico && (d.pubblico_contemporaneo === undefined || d.pubblico_contemporaneo === null)) mancanti.push("numero massimo di persone contemporanee del pubblico");
  if (d.soggettaCPI === undefined) mancanti.push("l'attivita' e' compresa nel DPR 151/2011 allegato I (si'/no)");

  const lv = livelloRischio({ livello3: d.livello3 ?? [], soggettaCPI: !!d.soggettaCPI, cantiereFiamme: !!d.cantiereFiamme });
  const pi = obbligoPiano({ lavoratori: d.lavoratori ?? 0, aperto_pubblico: !!d.aperto_pubblico, pubblico_contemporaneo: d.pubblico_contemporaneo ?? 0, soggettaCPI: !!d.soggettaCPI, attivita_complessa: !!d.attivita_complessa });

  const obblighi = [
    { id: "informazione", testo: "informazione e formazione sui rischi di incendio di tutti i lavoratori, con gli argomenti dell'allegato I par. 1.2", riferimento: "DM 2/9/2021 art. 3, all. I 1.2" },
    { id: "addetti", testo: "designare gli addetti al servizio antincendio: il decreto non fissa un numero minimo, va stabilito con la valutazione dei rischi", riferimento: "art. 4 comma 1" },
    { id: "piano", testo: !pi.obbligatorio ? "misure gestionali nel documento di valutazione dei rischi" : pi.misureSemplificate ? "piano semplificato: planimetria e indicazioni schematiche (possibile per questo esercizio)" : "piano di emergenza scritto con planimetria completa", riferimento: pi.riferimento },
  ];

  const corso = CORSI[lv.livello];
  const scadenze = [];
  if (d.data_corso_addetti) {
    const scad = new Date(d.data_corso_addetti);
    scad.setFullYear(scad.getFullYear() + ANNI_AGGIORNAMENTO);
    scadenze.push({ id: "aggiornamento_addetti", data: scad.toISOString().slice(0, 10), testo: `aggiornamento degli addetti (${corso.aggiornamento.sigla}, ${corso.aggiornamento.ore} ore) entro 5 anni dal corso` });
  } else mancanti.push("data dell'ultimo corso degli addetti (per calcolare l'aggiornamento)");

  if (pi.obbligatorio) {
    if (d.data_ultima_esercitazione) {
      const scad = new Date(d.data_ultima_esercitazione);
      scad.setFullYear(scad.getFullYear() + 1);
      scadenze.push({ id: "esercitazione", data: scad.toISOString().slice(0, 10), testo: "esercitazione antincendio, almeno annuale (all. I par. 1.3 n. 1)" });
    } else mancanti.push("data dell'ultima esercitazione antincendio (obbligatoria con il piano di emergenza)");
  }

  const presenti = new Set(d.planimetria_elementi ?? []);
  const piano_contenuti = new Set(d.piano_contenuti ?? []);
  const planimetria = pi.obbligatorio ? PLANIMETRIA_ELEMENTI.map((e) => ({ ...e, presente: presenti.has(e.id) })) : null;
  const contenutiPiano = pi.obbligatorio ? PIANO_CONTENUTI.map((e) => ({ ...e, presente: piano_contenuti.has(e.id) })) : null;
  for (const e of planimetria ?? []) if (!e.presente) mancanti.push(`planimetria: ${e.testo}`);
  for (const e of contenutiPiano ?? []) if (!e.presente) mancanti.push(`piano di emergenza: ${e.testo}`);

  const documenti = [
    { nome: "Documento di valutazione dei rischi con la parte antincendio", presente: d.doc_vr ?? null, obbligatorio: true, riferimento: "art. 2 comma 4" },
    { nome: "Piano di emergenza con planimetria", presente: d.doc_piano ?? null, obbligatorio: pi.obbligatorio, riferimento: "art. 2 comma 2, all. II" },
    { nome: "Attestati di formazione e aggiornamento degli addetti", presente: d.doc_attestati ?? null, obbligatorio: true, riferimento: "art. 5" },
    { nome: "Registro delle esercitazioni e dei controlli", presente: d.doc_registro ?? null, obbligatorio: pi.obbligatorio, riferimento: "all. I par. 1.3 n. 7" },
    { nome: "Attestazione della formazione antincendio dei lavoratori", presente: d.doc_informazione ?? null, obbligatorio: true, riferimento: "all. I par. 1.2" },
  ];
  for (const doc of documenti) if (doc.obbligatorio && doc.presente === null) mancanti.push(`documento: ${doc.nome}`);

  return {
    fonte: GSA_FONTE,
    livello: { ...lv, corsi: corso },
    piano: pi,
    obblighi,
    scadenze,
    planimetria,
    contenutiPiano,
    documenti,
    mancanti,
    completo: mancanti.length === 0,
  };
}
