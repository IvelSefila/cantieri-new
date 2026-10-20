// Modulo antincendio: superficie lorda per ambito e piano, affollamento, controlli e rapporto.
// Funzioni pure. Nessun parametro di legge è scritto nel codice: le densità di affollamento
// e le destinazioni vanno inserite dal professionista, con il riferimento della tabella ufficiale.
// Definizione usata (DM 3 agosto 2015, Allegato I): superficie in pianta entro il perimetro interno
// delle pareti che delimitano l'ambito; per ambiti multipiano si sommano le superfici di tutti i piani.
import { stanze } from "./rooms.js?v=v20261020by";
import { validatePlan } from "./model.js?v=v20261020by";
import { voceDensita } from "./normativa.js?v=v20261020by";

export const RIFERIMENTO = "DM 3 agosto 2015 (Codice di prevenzione incendi), Allegato I, Tabella S.4-12 (densità di affollamento) (testo coordinato vigente)";

// Piani: [{ piano: "P0", nome, plan }]. Ambiti: { [stanzaId]: { ambito, piano } }
// Per ogni stanza del piano si indica l'ambito di appartenenza (per default la stanza è un ambito a se').
export function superficiePerAmbito(piani, assegnazioni = {}) {
  const ambiti = new Map();
  const problemi = [];
  for (const { piano, plan } of piani) {
    const v = validatePlan(plan);
    if (!v.ok) problemi.push({ tipo: "piano_non_valido", piano, dettagli: v.errors });
    for (const s of stanze(plan.walls || [])) {
      const chiave = `${piano}:${s.id}`;
      const ass = assegnazioni[chiave] || {};
      const ambito = ass.ambito || `${piano}:${s.id}`;
      // attività (codice della Tabella S.4-12) fornisce densità e riferimento ufficiale; densità esplicita prevale
      const voce = ass.attivita ? voceDensita(ass.attivita) : null;
      if (ass.attivita && !voce) problemi.push({ tipo: "attivita_sconosciuta", ambito, attivita: ass.attivita });
      const densita = ass.densita ?? voce?.densitaPersoneM2 ?? null;
      const riferimentoDensita = ass.riferimentoDensita || (voce ? `Tabella S.4-12: ${voce.attivita}` : null);
      if (!ambiti.has(ambito)) ambiti.set(ambito, { ambito, superficieMm2: 0, stanze: [], piani: new Set(), destinazione: ass.destinazione || null, densita: null, riferimentoDensita: null });
      const a = ambiti.get(ambito);
      a.superficieMm2 += s.superficieMm2;
      a.stanze.push(chiave);
      a.piani.add(piano);
      // destinazione e densità devono essere coerenti per tutto l'ambito
      if (ass.destinazione && a.destinazione && a.destinazione !== ass.destinazione) problemi.push({ tipo: "destinazione_incoerente", ambito });
      if (ass.destinazione) a.destinazione = ass.destinazione;
      if (densita !== null) {
        if (a.densita !== null && a.densita !== densita) problemi.push({ tipo: "densita_incoerente", ambito });
        a.densita = densita;
        a.riferimentoDensita = riferimentoDensita || a.riferimentoDensita;
      }
    }
  }
  const risultato = [...ambiti.values()].map((a) => {
    const m2 = a.superficieMm2 / 1e6;
    const mancanti = [];
    if (!a.destinazione) mancanti.push("destinazione d'uso");
    if (a.densita === null) mancanti.push("densità di affollamento (Tabella S.4-12)");
    if (a.densita !== null && !a.riferimentoDensita) mancanti.push("riferimento della densità");
    return {
      ambito: a.ambito,
      destinazione: a.destinazione,
      piani: [...a.piani],
      superficieLordaMm2: a.superficieMm2,
      superficieLordaM2: m2,
      densitaPersoneM2: a.densita,
      riferimentoDensita: a.riferimentoDensita,
      affollamento: a.densita === null ? null : Math.ceil(m2 * a.densita),
      stanze: a.stanze,
      mancanti,
    };
  });
  return { ambiti: risultato, problemi };
}

// Superficie lorda totale per piano (somma delle stanze del piano, in mm2 esatti)
export function superficiePerPiano(piani) {
  return piani.map(({ piano, plan }) => ({
    piano,
    superficieLordaMm2: stanze(plan.walls || []).reduce((s, x) => s + x.superficieMm2, 0),
  }));
}

// Controllo quote: confronta le quote scritte in planimetria con la lunghezza dei muri del modello.
// quote: [{ muro, mm }] inserite dal professionista leggendo il disegno.
export function controlloQuote(plan, quote, tolleranzaMm = 0) {
  const esiti = [];
  for (const q of quote) {
    const w = (plan.walls || []).find((x) => x.id === q.muro);
    if (!w) { esiti.push({ muro: q.muro, esito: "muro_inesistente" }); continue; }
    const L = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const scarto = Math.abs(L - q.mm);
    esiti.push({ muro: q.muro, quotaMm: q.mm, modelloMm: Math.round(L * 1000) / 1000, scartoMm: Math.round(scarto * 1000) / 1000, esito: scarto <= tolleranzaMm ? "ok" : "discrepanza" });
  }
  return esiti;
}

// Rapporto completo per il professionista: dati, controlli, documenti da allegare.
export function rapportoAntincendio(piani, assegnazioni = {}, quote = [], autore = null) {
  const ambiti = superficiePerAmbito(piani, assegnazioni);
  const totaleLordo = ambiti.ambiti.reduce((s, a) => s + a.superficieLordaMm2, 0);
  const totaleAffollamento = ambiti.ambiti.every((a) => a.affollamento !== null)
    ? ambiti.ambiti.reduce((s, a) => s + a.affollamento, 0) : null;
  const incompleti = ambiti.ambiti.filter((a) => a.mancanti.length).map((a) => ({ ambito: a.ambito, mancanti: a.mancanti }));
  return {
    riferimento: RIFERIMENTO,
    generatoIl: new Date().toISOString(),
    autore,
    piani: superficiePerPiano(piani),
    superficieLordaTotaleMm2: totaleLordo,
    superficieLordaTotaleM2: totaleLordo / 1e6,
    affollamentoTotale: totaleAffollamento,
    ambiti: ambiti.ambiti,
    controlliQuote: quote.length ? controlloQuote(piani[0].plan, quote) : [],
    problemi: ambiti.problemi,
    incompleti,
    avvertenza: "Calcolo di supporto. Il parere di conformità è del professionista abilitato, che verifica densità, destinazioni e documenti.",
    documentiDaAllegare: DOCUMENTI_NECESSARI,
  };
}

export const DOCUMENTI_NECESSARI = [
  "Planimetrie quotate di ogni piano (stato di fatto), con scala e quote in mm: fonte preferita il progetto esecutivo o l'ultimo titolo edilizio con planimetria allegata",
  "Sezioni verticali quotate (altezze di piano e altezza antincendio)",
  "Attestazione di agibilità o abitabilità e titoli edilizi (CILA, SCIA, permesso di costruire) con i grafici allegati",
  "Destinazione d'uso di ogni ambito e numero di occupanti previsto",
  "Planimetrie delle vie di esodo, uscite e percorsi, con larghezze delle porte",
  "Eventuale Certificato di prevenzione incendi (CPI) e pratiche precedenti, se presenti",
];
