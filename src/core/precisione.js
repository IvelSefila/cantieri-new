// Affidabilità di ogni motore: per ciascun calcolo dice se il risultato è esatto, esatto sui dati inseriti,
// una stima o incompleto, PERCHE', cosa serve per arrivare al 100 % e quali documenti servono.
// Funzione pura: riceve un contesto con lo stato del progetto e dei dati inseriti.

export const STATI = {
  esatto: { etichetta: "ESATTO", spiegazione: "Il calcolo segue la norma e usa solo dati certi." },
  dati: { etichetta: "ESATTO SUI DATI INSERITI", spiegazione: "La formula è quella della norma. Il risultato è giusto se sono giusti i dati che hai inserito o caricato." },
  stima: { etichetta: "STIMA", spiegazione: "Il risultato usa un metodo semplificato o un dato non ufficiale. Serve per orientarsi, non per una pratica." },
  incompleto: { etichetta: "MANCANO DATI", spiegazione: "Il calcolo non è completo. Sotto trovi cosa manca." },
};

// Perché c'era la maggiorazione del 10 % per i ponti termici (testo mostrato nel sito)
export const NOTA_PONTI_10 = "La maggiorazione fissa del 10 % è stata tolta. Era un valore di comodo inserito nella prima versione del motore " +
  "per non sottostimare le dispersioni quando mancano i dati dei ponti termici. Viene dalla vecchia UNI/TS 11300-1:2008 (prospetto 4), " +
  "che ammetteva maggiorazioni dal 5 % al 30 % secondo il tipo di parete (10 % per la parete a cassa vuota). La revisione 2014 della " +
  "UNI/TS 11300-1 ha abrogato le maggiorazioni percentuali, e il DM 28/10/2025 chiede il calcolo esplicito dei ponti termici. " +
  "Oggi il motore usa: i valori psi x lunghezza che inserisci (metodo corretto), oppure la percentuale del prospetto 4 solo come stima " +
  "dichiarata, oppure nessuna maggiorazione con l'avviso che le dispersioni sono sottostimate.";

const doc = (nome, presente = null) => ({ nome, presente });

// ctx: vedi app.js (contestoAffidabilita). Ogni campo mancante viene trattato come "non noto".
export function valutaMotori(ctx = {}) {
  const out = [];
  const g = ctx.geometria ?? {};
  const e = ctx.energia ?? {};
  const s = ctx.solare ?? {};
  const a = ctx.antincendio ?? {};
  const roma = ctx.localita === undefined || ctx.localita === "Roma";

  // 1. Geometria
  {
    const appr = [];
    const serve = [];
    let stato = "dati";
    if (g.origine === "immagine") {
      stato = "stima";
      appr.push({ dato: "Coordinate dei muri", perche: "Tracciate su un'immagine: la precisione dipende dalla scala di calibrazione e dalla precisione dei clic." });
      serve.push("Planimetria vettoriale quotata (DXF/DWG) o rilievo in sito");
    }
    if (g.origine === "esempio") appr.push({ dato: "Piano AR-02", perche: "Quote trascritte a mano dalla tavola cartacea: sono esatte rispetto alla trascrizione, non verificate in sito." });
    if (g.origine === "dxf" && g.arrotondamenti > 0) appr.push({ dato: "Coordinate DXF", perche: `${g.arrotondamenti} valori arrotondati al millimetro intero (scarto massimo ${g.scartoMax_mm ?? "?"} mm).` });
    if (g.muriObliqui > 0) appr.push({ dato: "Lunghezza dei muri obliqui", perche: `${g.muriObliqui} muri obliqui: la lunghezza non è un numero intero di mm ed è mostrata a 0,001 mm.` });
    if (g.origine === "disegnato") appr.push({ dato: "Muri disegnati", perche: "Punti agganciati alla griglia scelta: esatti come numeri, ma non derivano da un rilievo." });
    if (!g.muri) { stato = "incompleto"; serve.push("Almeno un muro: apri un progetto, importa un DXF o disegna"); }
    out.push({
      id: "geometria", nome: "Geometria e misure (muri, vani)", stato,
      approssimazioni: appr, perIl100: [...serve, "Quote del rilievo in sito o del progetto esecutivo, in mm"],
      documenti: [doc("Planimetria quotata di ogni piano (DXF/DWG o PDF vettoriale)", g.origine === "dxf" ? true : null), doc("Sezioni quotate (altezze di piano)")],
    });
  }

  // 2. Stanze e superfici
  const monconi = g.stanzeConMonconi ?? [];
  out.push({
    id: "stanze", nome: "Stanze e superfici", stato: !g.stanze ? "incompleto" : monconi.length ? "stima" : "dati",
    approssimazioni: [
      ...(monconi.length ? [{ dato: `Stanze ${monconi.join(", ")}`, perche: "Contengono muri che non chiudono (monconi): l'impronta del moncone è tolta, ma forse nel disegno manca un muro e due stanze risultano unite." }] : []),
      { dato: "Superficie delle stanze", perche: "Calcolata sul contorno interno dei muri, in mm2 esatti. Una stanza non chiusa da muri non viene contata." },
      { dato: "Superficie utile", perche: "È la somma delle stanze chiuse. Se nel disegno mancano chiusure (porte senza muro, vani aperti) la superficie utile risulta minore." },
    ],
    perIl100: ["Tutte le stanze chiuse da muri nel disegno (nessun moncone)", "Verifica con le superfici dichiarate nella planimetria catastale o di progetto"],
    documenti: [doc("Planimetria quotata"), doc("Planimetria catastale (per il confronto delle superfici)")],
  });

  // 3. Muri portanti
  out.push({
    id: "strutture", nome: "Muri portanti / non portanti", stato: "stima",
    approssimazioni: [{ dato: "Portante si/no", perche: "Presunto dal tipo indicato nel disegno e dallo spessore (>= 200 mm). Dal disegno non si vede cosa regge un muro." }],
    perIl100: ["Verifica di un ingegnere strutturista secondo NTC 2018"],
    documenti: [doc("Progetto strutturale o relazione di calcolo depositata"), doc("Certificato di collaudo statico"), doc("Saggi e rilievo in sito (se mancano i documenti)")],
  });

  // 4. Infissi in 3D
  out.push({
    id: "infissi", nome: "Infissi e materiali (vista 3D)", stato: "stima",
    approssimazioni: [{ dato: "Telai, ante, maniglie", perche: "Profili standard per la vista. Le misure del vano sono quelle del progetto; i profili non entrano nei calcoli." }],
    perIl100: ["Scheda tecnica del serramento scelto (dimensioni dei profili, Uw, ggl,n, FF)"],
    documenti: [doc("Scheda tecnica del serramento")],
  });

  // 5. GSA semplificato
  out.push({
    id: "gsa", nome: "GSA semplificato", stato: "stima",
    approssimazioni: [{ dato: "Asol = A x g x Fsh x Ff", perche: "Formula di orientamento con g e frazione vetrata di default. Non è la verifica di legge: usa Asol,est." }],
    perIl100: ["Usare il calcolo Asol,est (DM 26/06/2015 aggiornato)"],
    documenti: [],
  });

  // 6. Asol,est
  {
    const appr = [];
    const serve = [];
    let stato = "dati";
    if (!roma) { stato = "incompleto"; serve.push("Dati UNI 10349 del comune (irradianza di luglio per orientamento)"); }
    else appr.push({ dato: "Fsol,est", perche: "Calcolato con i dati UNI 10349:2016 di Roma riportati da una relazione di software terzo (Blumatica). Formula del DM: luglio sull'esposizione / media annua orizzontale di Roma." });
    if (!s.gglsh) { stato = "incompleto"; serve.push("ggl+sh del vetro con schermatura (scheda della schermatura, UNI EN ISO 52022-1)"); }
    if (s.FFdaScheda !== true) { if (stato === "dati") stato = "stima"; appr.push({ dato: "FF (frazione telaio)", perche: "Valore 0,20 di default (UNI/TS 11300-1:2008 ammette 0,8 di area vetrata senza dati). Il valore vero è nella scheda del serramento." }); }
    if (s.FshObDaRilievo !== true) appr.push({ dato: "Fsh,ob (ombreggiamento)", perche: "Vale 1 se non indicato: nessuna ombra da balconi, edifici o alberi. È il caso peggiore (più sole)." });
    if (s.vetriSenzaOrientamento > 0) { stato = "incompleto"; serve.push(`Orientamento di ${s.vetriSenzaOrientamento} pareti vetrate`); }
    if (s.nordConfermato !== true) { if (stato === "dati") stato = "stima"; appr.push({ dato: "Orientamento delle pareti", perche: "Ricavato dal disegno con il Nord presunto in alto. Se il Nord è ruotato, Fsol,est cambia." }); serve.push("Direzione del Nord della planimetria (freccia del Nord)"); }
    appr.push({ dato: "Pareti esterne", perche: "Riconosciute dalla geometria: muro con una stanza da un solo lato, nel punto del vano. Se una stanza non è chiusa nel disegno, il riconoscimento può sbagliare." });
    out.push({
      id: "asol", nome: "Asol,est (verifica estiva, DM 26/06/2015 agg. 2025)", stato, approssimazioni: appr,
      perIl100: [...serve, "Scheda tecnica di ogni serramento (FF, ggl,n)", "Rilievo di aggetti e ostruzioni per Fsh,ob (luglio)"],
      documenti: [doc("Schede tecniche dei serramenti"), doc("Scheda della schermatura solare (ggl+sh)"), doc("Rilievo fotografico/grafico di balconi e ostruzioni")],
    });
  }

  // 7. H'T
  {
    const appr = [];
    const serve = [];
    let stato = "dati";
    if (!e.U) { stato = "incompleto"; serve.push("Trasmittanza U di ogni componente (stratigrafie, UNI EN ISO 6946) o U media dell'involucro"); }
    else appr.push({ dato: "U media", perche: "Un solo valore per tutto l'involucro: il decreto chiede somma(U x A) componente per componente." });
    if (e.ponti === "forfait") { stato = stato === "incompleto" ? stato : "stima"; appr.push({ dato: "Ponti termici", perche: "Percentuale del prospetto 4 della UNI/TS 11300-1:2008, abrogato nel 2014: solo stima." }); }
    if (!e.ponti || e.ponti === "assenti") { stato = "incompleto"; serve.push("Ponti termici: psi x lunghezza di ogni nodo (UNI EN ISO 10211 o atlante UNI EN ISO 14683)"); }
    if (!e.superfici) { stato = "incompleto"; serve.push("Superficie disperdente e volume lordi (misure esterne)"); }
    out.push({
      id: "ht", nome: "H'T (DM 2025, Tabelle 10 e 11)", stato, approssimazioni: appr,
      perIl100: [...serve, "Zona climatica del comune (DPR 412/93)"],
      documenti: [doc("Stratigrafie di muri, solai, coperture"), doc("Abaco o calcolo dei ponti termici"), doc("Relazione ex Legge 10 (se esiste)", e.pdf ? true : null)],
    });
  }

  // 8. Riscaldamento e raffrescamento
  out.push({
    id: "fabbisogni", nome: "Fabbisogno di riscaldamento e raffrescamento", stato: e.mensileCompleto ? "dati" : "stima",
    approssimazioni: [
      { dato: "Metodo gradi giorno", perche: "Stima annuale semplificata, non è il metodo della UNI/TS 11300-1." },
      { dato: "Bilancio mensile", perche: "Usa le formule della UNI/TS 11300-1 (verificate sulla relazione di Roma: 4552 kWh). Mancano nel motore: durata reale della stagione, terreno, extraflusso." },
      { dato: "Carico estivo di picco", perche: "Irradianza di picco da PVGIS (dato satellitare), non dalla UNI 10349-3." },
    ],
    perIl100: ["H_tr per componente con terreno (UNI EN ISO 13370)", "Portate di ventilazione (UNI/TS 11300-1)", "Capacità termica interna (UNI EN ISO 13786)", "Asol mensile di ogni finestra (Fw e ombreggiamenti mensili)", "Apporti interni secondo UNI/TS 11300-1"],
    documenti: [doc("Relazione ex Legge 10 o APE", e.pdf ? true : null), doc("Stratigrafie"), doc("Schede dei serramenti e delle schermature")],
  });

  // 9. Impianti
  out.push({
    id: "impianti", nome: "Pompa di calore, condizionatore, radiatori", stato: "stima",
    approssimazioni: [{ dato: "COP / EER", perche: "Stimati con il ciclo di Carnot x 0,45. Il valore vero dipende dalla macchina." }],
    perIl100: ["SCOP / SEER della macchina scelta (EN 14825)", "Calcolo UNI/TS 11300-2/3/4 dei rendimenti"],
    documenti: [doc("Scheda tecnica della pompa di calore / del condizionatore"), doc("Scheda dei radiatori (potenza a dT 50 K, esponente n)")],
  });

  // 10. Fotovoltaico
  out.push({
    id: "fv", nome: "Fotovoltaico", stato: "stima",
    approssimazioni: [{ dato: "Resa kWh/kWp", perche: "PVGIS-SARAH3 per Roma a 36 gradi con perdite 14 %. Ombre locali e moduli reali non sono considerati." }],
    perIl100: ["Posizione, inclinazione e ombre reali del tetto", "Scheda dei moduli e dell'inverter", "Quota rinnovabile secondo UNI/TS 11300-5", "Obbligo FER: parametro K del D.Lgs. 199/2021 (testo vigente da verificare)"],
    documenti: [doc("Pianta delle coperture con orientamento"), doc("Schede di moduli e inverter")],
  });

  // 11. Solare termico
  out.push({
    id: "st", nome: "Solare termico (acqua calda)", stato: "stima",
    approssimazioni: [{ dato: "Rendimento del collettore", perche: "Rendimento medio annuo 0,35 di stima. Orientamento non sud approssimato con il rapporto delle rese FV." }],
    perIl100: ["Dati del collettore (ISO 9806: eta0, a1, a2)", "Metodo della UNI/TS 11300-4"],
    documenti: [doc("Scheda tecnica del collettore e dell'accumulo")],
  });

  // 12. Antincendio
  {
    const appr = [];
    let stato = a.schedaCaricata ? "dati" : "incompleto";
    if (a.ambitiMultiStanza > 0) { stato = stato === "incompleto" ? stato : "stima"; appr.push({ dato: "Superficie degli ambiti con più stanze", perche: "È la somma delle stanze: esclude lo spessore dei tramezzi interni all'ambito, che per il Codice fanno parte della superficie lorda." }); }
    appr.push({ dato: "Densità di affollamento", perche: "Dalla Tabella S.4-12 del testo coordinato ufficiale (VVF, in vigore dal 1/1/2023, rev. 00). Verificare eventuali aggiornamenti." });
    appr.push({ dato: "Nomi delle stanze nella scheda ambiti", perche: "Le stanze sono numerate dal motore (stanza_001...). Se modifichi i muri la numerazione può cambiare: ricontrolla la scheda ambiti dopo ogni modifica." });
    out.push({
      id: "antincendio", nome: "Antincendio (superfici e affollamento)", stato, approssimazioni: appr,
      perIl100: ["Scheda ambiti: destinazione e attività di ogni stanza", "Contorno dell'ambito se comprende più stanze"],
      documenti: [doc("Scheda ambiti (JSON)", a.schedaCaricata ? true : false), doc("Planimetrie delle vie di esodo"), doc("Titoli edilizi e agibilità"), doc("CPI e pratiche precedenti (se presenti)")],
    });
  }

  // 13. Lettura PDF
  out.push({
    id: "pdf", nome: "Lettura della relazione in PDF", stato: e.pdf ? "dati" : "incompleto",
    approssimazioni: [{ dato: "Campi estratti", perche: "Solo PDF con testo selezionabile. Ogni valore trovato cita la riga di origine: controllalo nel campo." }],
    perIl100: ["PDF con testo (non scansione)", "Controllo dei campi trovati"],
    documenti: [doc("Relazione tecnica ex Legge 10 in PDF", e.pdf ? true : false)],
  });

  // 14. Dati climatici
  out.push({
    id: "clima", nome: "Dati climatici", stato: roma ? "dati" : "incompleto",
    approssimazioni: [
      { dato: "UNI 10349:2016 Roma", perche: "Valori della norma riportati da una relazione di software terzo, non letti sulla norma (a pagamento)." },
      { dato: "PVGIS", perche: "Usato solo per il picco estivo e il fotovoltaico: dato satellitare, non di legge." },
    ],
    perIl100: ["UNI 10349-1:2016 (prospetti del comune)", roma ? "" : "Dati del comune del progetto"].filter(Boolean),
    documenti: [doc("UNI 10349-1:2016 (acquisto UNI)")],
  });

  return out;
}

export function riepilogo(motori) {
  const conta = { esatto: 0, dati: 0, stima: 0, incompleto: 0 };
  for (const m of motori) conta[m.stato]++;
  return conta;
}
