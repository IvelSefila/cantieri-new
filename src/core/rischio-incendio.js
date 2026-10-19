// Calcolo del rischio di incendio e delle vie di uscita secondo il DM 10 marzo 1998 (Criteri generali di sicurezza
// antincendio), testo coordinato Vigili del Fuoco. Funzioni pure: ogni esito cita il punto del decreto.
// Il calcolo applica i criteri scritti nel decreto; le scelte di giudizio (es. riduzione del livello) sono
// dichiarate come tali e il professionista le conferma.

export const FONTE_1998 = {
  documento: "DM 10 marzo 1998, Criteri generali di sicurezza antincendio e per la gestione dell'emergenza nei luoghi di lavoro",
  url: "https://www.vigilfuoco.it/sites/default/files/2023-05/COORD_DM_10_03_1998.pdf",
  nota: "Le lettere a) e f) dell'art. 4 e gli artt. 5-7 sono stati sostituiti dai DM 1/9/2021 e 2/9/2021 (formazione e gestione); "
    + "i criteri di classificazione (punto 1.4.4) e di esodo (punto 3.3-3.5) sono quelli del testo coordinato.",
};

// Punto 1.4.4: criteri per il livello di rischio. Ogni criterio cita la frase del decreto.
export const CRITERI_ELEVATO = [
  { id: "altamente_infiammabili", testo: "uso di sostanze altamente infiammabili, o di fiamme libere, o produzione di notevole calore in presenza di materiali combustibili" },
  { id: "chimiche_reattive", testo: "deposito o manipolazione di sostanze chimiche che possono produrre reazioni esotermiche, gas o vapori infiammabili, o reagire con altre sostanze combustibili" },
  { id: "esplosivi", testo: "deposito o manipolazione di sostanze esplosive o altamente infiammabili" },
  { id: "materiali_combustibili", testo: "notevole quantita' di materiali combustibili facilmente incendiabili" },
  { id: "edificio_legno", testo: "edifici interamente realizzati con strutture in legno" },
  { id: "evacuazione_difficile", testo: "affollamento, stato dei luoghi o limitazioni motorie delle persone presenti rendono difficoltosa l'evacuazione" },
];
export const CRITERI_MEDIO = [
  { id: "infiammabili_condizioni", testo: "presenza di sostanze infiammabili e/o condizioni locali o di esercizio che possono favorire lo sviluppo di incendi, con propagazione limitata" },
];
export const CRITERI_BASSO = [
  { id: "bassa_infiammabilita", testo: "sostanze a basso tasso di infiammabilita' e condizioni che offrono scarse possibilita' di sviluppo di incendi, con propagazione limitata" },
];
// Riduzioni previste dal punto 1.4.4 (lettere a, b, c del testo elevato): il livello puo' essere ridotto se
export const RIDUZIONI = [
  { id: "separazione", testo: "l'area a rischio elevato e' separata dal resto del luogo con elementi resistenti al fuoco (lett. a)" },
  { id: "gestione_vie", testo: "il processo e' gestito accuratamente e le vie di esodo sono protette dall'incendio (lett. b)" },
  { id: "protezione_attiva", testo: "luogo grande o complesso con protezione attiva: spegnimento automatico, rivelazione automatica o estrazione fumi (lett. c)" },
];

// Classificazione del luogo di lavoro (o di una sua parte). d: risposte booleane ai criteri.
export function classificaRischio(d = {}) {
  const elevati = CRITERI_ELEVATO.filter((c) => d[c.id]);
  const medi = CRITERI_MEDIO.filter((c) => d[c.id]);
  const basso = CRITERI_BASSO.filter((c) => d[c.id]);
  let livello;
  let motivi;
  if (elevati.length) { livello = "elevato"; motivi = elevati.map((c) => `${c.testo} (punto 1.4.4, lett. C)`); }
  else if (medi.length) { livello = "medio"; motivi = medi.map((c) => `${c.testo} (punto 1.4.4, lett. B)`); }
  else { livello = "basso"; motivi = basso.length ? basso.map((c) => `${c.testo} (punto 1.4.4, lett. A)`) : []; }
  const riduzioni = RIDUZIONI.filter((r) => d[`riduzione_${r.id}`]);
  let livelloFinale = livello;
  const note = [];
  if (livello === "elevato" && riduzioni.length && !elevati.some((c) => ["esplosivi", "altamente_infiammabili", "chimiche_reattive"].includes(c.id))) {
    livelloFinale = "medio";
    note.push(`Riduzione dichiarata: ${riduzioni.map((r) => r.testo).join("; ")}. Il decreto la consente, ma va motivata dal professionista.`);
  }
  if (!motivi.length) {
    note.push("Nessun criterio selezionato: il livello non e' determinato. Rispondere a tutti i criteri.");
  }
  return { livello, livelloFinale, motivi, riduzioni: riduzioni.map((r) => r.id), note, riferimento: "DM 10/3/1998, punto 1.4.4" };
}

// Limiti di esodo (punto 3.3 lett. c ed e; punto 3.4): distanza massima dal punto piu' lontano all'uscita.
// Valori in metri, come intervalli del decreto. Il limite cautelativo e' il minimo; quello ordinario il massimo.
export const LIMITI_ESODO = {
  elevato: { percorsoDueVie: [15, 30], percorsoUnaVia: [6, 15], tempoDueVieMin: 1, tempoUnaViaSec: 30 },
  medio: { percorsoDueVie: [30, 45], percorsoUnaVia: [9, 30], tempoDueVieMin: 3, tempoUnaViaSec: 60 },
  basso: { percorsoDueVie: [45, 60], percorsoUnaVia: [12, 45], tempoDueVieMin: 5, tempoUnaViaSec: 180 },
};
export const RIF_ESODO = "DM 10/3/1998, punto 3.3 lett. c) ed e); punto 3.4";

// Verifica dell'esodo per un piano. u: { livello, affollamento, distanzaDueVie_m, distanzaUnaVia_m, numeroUscite,
// larghezzaUscite_m, pubblico (bool), assistenza (bool), materialiInfiammabili (bool), areaRiposo (bool), vieAlternative (bool) }
export function verificaEsodo(u = {}) {
  const esiti = [];
  const mancanti = [];
  const lim = LIMITI_ESODO[u.livello];
  if (!lim) return { esiti, mancanti: ["livello di rischio del piano"], riferimento: RIF_ESODO };
  // punto 3.4: lunghezze al valore piu' basso se frequentato da pubblico, persone assistite, riposo o materiali infiammabili
  const cauto = !!(u.pubblico || u.assistenza || u.areaRiposo || u.materialiInfiammabili);
  const pick = (r) => (cauto ? r[0] : r[1]);
  if (u.distanzaDueVie_m === undefined || u.distanzaDueVie_m === null) mancanti.push("distanza massima dal punto piu' lontano all'uscita, con due vie di uscita (m)");
  else esiti.push({ id: "percorso_due_vie", ok: u.distanzaDueVie_m <= pick(lim.percorsoDueVie), valore: u.distanzaDueVie_m, limite: pick(lim.percorsoDueVie), testo: `percorso con due vie di uscita: ${u.distanzaDueVie_m} m, limite ${pick(lim.percorsoDueVie)} m`, riferimento: "punto 3.3 lett. c)" });
  if (u.distanzaUnaVia_m === undefined || u.distanzaUnaVia_m === null) mancanti.push("percorso in un'unica direzione fino al punto con due vie di uscita (m)");
  else esiti.push({ id: "percorso_una_via", ok: u.distanzaUnaVia_m <= pick(lim.percorsoUnaVia), valore: u.distanzaUnaVia_m, limite: pick(lim.percorsoUnaVia), testo: `percorso in una sola direzione: ${u.distanzaUnaVia_m} m, limite ${pick(lim.percorsoUnaVia)} m`, riferimento: "punto 3.3 lett. e)" });
  if (u.affollamento === undefined || u.affollamento === null) mancanti.push("affollamento del piano (persone presenti)");
  if (u.numeroUscite === undefined || u.numeroUscite === null) mancanti.push("numero di uscite di piano");
  else {
    const piu50 = (u.affollamento ?? 0) > 50;
    const dueUscite = u.livello === "elevato" || piu50;
    if (dueUscite && u.numeroUscite < 2) esiti.push({ id: "uscite_numero", ok: false, valore: u.numeroUscite, limite: 2, testo: `servono almeno due uscite (${piu50 ? "affollamento superiore a 50" : "rischio elevato"})`, riferimento: "punto 3.5 lett. a) e b)" });
    else esiti.push({ id: "uscite_numero", ok: true, valore: u.numeroUscite, testo: `${u.numeroUscite} uscite di piano`, riferimento: "punto 3.5" });
  }
  // Larghezza: formula del punto 3.5 per rischio medio o basso (modulo 0,60 m, 50 persone per modulo, minimo 0,80 m)
  if (u.livello !== "elevato" && u.affollamento !== undefined && u.affollamento !== null) {
    const moduli = Math.ceil((u.affollamento || 0) / 50);
    const richiesta = Math.round(Math.max(moduli * 60, u.affollamento > 0 ? 80 : 0)) / 100; // centimetri interi, poi metri
    if (u.larghezzaUscite_m === undefined || u.larghezzaUscite_m === null) mancanti.push("larghezza complessiva delle uscite di piano (m)");
    else esiti.push({ id: "larghezza_uscite", ok: u.larghezzaUscite_m + 1e-9 >= richiesta, valore: u.larghezzaUscite_m, limite: richiesta, testo: `larghezza uscite ${u.larghezzaUscite_m} m, richiesta ${richiesta.toFixed(2).replace(".", ",")} m (L = A/50 x 0,60 m, arrotondato al modulo)`, riferimento: "punto 3.5 (formula per rischio medio o basso)" });
  } else if (u.livello === "elevato") {
    esiti.push({ id: "larghezza_uscite", ok: null, testo: "larghezza delle uscite per rischio elevato: il decreto non fornisce una formula, verifica del professionista", riferimento: "punto 3.5" });
  }
  return { esiti, mancanti, cauto, riferimento: RIF_ESODO };
}
