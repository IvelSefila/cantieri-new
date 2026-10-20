// Calcolo energetico di base: dispersioni (UNI EN 12831 semplificata), fabbisogno stagionale con gradi giorno,
// emettitori (radiatori), pompe di calore, condizionatori, fotovoltaico, solare termico per ACS.
// Ogni default è ESPLICITO in DEFAULT_ENERGIA con la sua fonte o la nota "da confermare".
// Il calcolo non nasconde i parametri: vengono restituiti nel risultato.
// Nessuna dipendenza esterna: stesse funzioni nel browser e nei test Node.
import { CLIMA_ROMA, INCLINATO_S36_KWH_M2, UNI10349_ROMA } from "./clima.js?v=v20261020bq";

export const DEFAULT_ENERGIA = {
  theta_int: 20,          // C, temperatura interna di progetto (UNI EN 12831)
  theta_ext_inv: UNI10349_ROMA.thetaProgettoInverno_C, // C, Roma 0,0 (UNI 10349:2016, vedi clima.js)
  theta_ext_est: UNI10349_ROMA.thetaProgettoEstate_C,  // C, Roma 33,8 (UNI 10349:2016, vedi clima.js)
  gg: CLIMA_ROMA.gradiGiorno, // gradi giorno, DPR 412/93 (Roma 1415)
  ricambi_h: 0.5,         // 1/h, ricambio d'aria (da confermare: 0,30 nella relazione ACCA, 0,50 nella Blumatica)
  Rsi: 0.13,              // m2K/W, resistenza superficiale interna (UNI EN ISO 6946)
  Rse: 0.04,              // m2K/W, resistenza superficiale esterna (UNI EN ISO 6946)
  eta_guadagni: 0.8,      // fattore di utilizzo dei guadagni solari invernali (metodo semplificato, da confermare)
  carnot_eff: 0.45,       // efficienza rispetto a Carnot delle pompe di calore reali (stima, da confermare con EN 14825)
  pr_fv: 1,               // resa FV già inclusa nei kWh/kWp PVGIS (perdite di sistema 14 %): nessun PR aggiuntivo
  n_radiatori: 1.3,       // esponente dell'emissione dei radiatori (EN 442)
  dt_norma: 50,           // K, salto termico di riferimento della potenza nominale (EN 442)
  l_acs_persona_giorno: 25, // litri/giorno a 40 C per persona (UNI TS 11300-2)
  theta_acs: 40,          // C, temperatura ACS di erogazione
  theta_acqua_fredda: 15, // C, temperatura acqua fredda di rete
  eta_solare_termico: 0.35, // rendimento medio annuo del collettore (stima, da confermare con la scheda del collettore)
};

const K = 273.15;

// Trasmittanza U (W/m2K) da stratigrafia: layers = [{ s_mm, lambda }] (lambda in W/mK).
// U = 1 / (Rsi + sum(s/lambda) + Rse). Nessun arrotondamento: il chiamante decide la precisione.
export function trasmittanza(layers, Rsi = DEFAULT_ENERGIA.Rsi, Rse = DEFAULT_ENERGIA.Rse) {
  const R = layers.reduce((s, l) => {
    if (!(l.s_mm > 0) || !(l.lambda > 0)) throw new Error(`strato non valido: ${JSON.stringify(l)}`);
    return s + (l.s_mm / 1000) / l.lambda;
  }, 0);
  return 1 / (Rsi + R + Rse);
}

// Ponti termici: tre modi, dal più preciso al meno preciso.
//  1) "psi": nodi [{ descrizione, psi_W_mK, l_m }] -> H_ponti = somma(psi x l). È il metodo richiesto dalla
//     UNI/TS 11300-1:2014 e dal DM 28/10/2025 (psi da calcolo UNI EN ISO 10211 o da atlante conforme UNI EN ISO 14683).
//     Il risultato è esatto rispetto ai dati inseriti.
//  2) "forfait": maggiorazione percentuale del prospetto 4 della UNI/TS 11300-1:2008 (dal 5 al 30 % secondo il tipo
//     di parete). Quel prospetto è stato ABROGATO dalla revisione 2014: qui serve solo come stima di confronto,
//     mai per la verifica di legge. Si applica alle pareti opache; se si inserisce una U media di tutto
//     l'involucro (finestre comprese) l'approssimazione è ancora maggiore.
//  3) nessun dato: H senza ponti termici, quindi dispersioni sottostimate. Il risultato è segnato incompleto.
// La vecchia maggiorazione fissa del 10 % non c'è più: era un valore di comodo senza base nella norma vigente.
export const PROSPETTO4_2008 = {
  cappotto_senza_aggetti: { nome: "Cappotto esterno senza aggetti/balconi, ponti termici corretti", percentuale: 5 },
  cappotto_con_aggetti: { nome: "Cappotto esterno con aggetti/balconi", percentuale: 15 },
  muratura_piena: { nome: "Parete omogenea in mattoni pieni o pietra (senza isolante)", percentuale: 5 },
  cassa_vuota: { nome: "Parete a cassa vuota con mattoni forati (senza isolante)", percentuale: 10 },
  cassa_vuota_isolata_corretta: { nome: "Cassa vuota con isolamento nell'intercapedine (ponte termico corretto)", percentuale: 10 },
  cassa_vuota_isolata_non_corretta: { nome: "Cassa vuota con isolamento nell'intercapedine (ponte termico non corretto)", percentuale: 20 },
  prefabbricato_isolante_interno: { nome: "Pannello prefabbricato in calcestruzzo con isolante interno", percentuale: 30 },
};

// Dispersione per trasmissione: H_T (W/K) = somma(U x A x b) + H_ponti.
// elementi: [{ id, U, A_m2, tipo }]  tipo: "esterno" (b = 1), "non_riscaldato" (b = e.b, default 0,5)
// opzioni.ponti: { modo: "psi", nodi } | { modo: "forfait", tipo } | assente
export function dispersioneTrasmissione(elementi, opzioni = {}) {
  let H = 0;
  const righe = [];
  for (const e of elementi) {
    if (!(e.U > 0) || !(e.A_m2 > 0)) throw new Error(`elemento ${e.id}: U e A devono essere > 0`);
    const b = e.tipo === "non_riscaldato" ? (e.b ?? 0.5) : 1;
    const h = e.U * e.A_m2 * b;
    H += h;
    righe.push({ id: e.id, tipo: e.tipo ?? "esterno", U: e.U, A_m2: e.A_m2, b, H_W_K: h });
  }
  const ponti = opzioni.ponti;
  let H_ponti = 0;
  let info;
  if (ponti?.modo === "psi") {
    for (const n of ponti.nodi ?? []) {
      if (!Number.isFinite(n.psi_W_mK) || !(n.l_m > 0)) throw new Error(`ponte termico ${n.descrizione ?? ""}: psi e lunghezza non validi`);
      H_ponti += n.psi_W_mK * n.l_m;
    }
    info = { modo: "psi", precisione: "dati inseriti", nota: `${(ponti.nodi ?? []).length} nodi, somma psi x l` };
  } else if (ponti?.modo === "forfait") {
    const voce = PROSPETTO4_2008[ponti.tipo];
    if (!voce) throw new Error(`tipo di parete non valido per il prospetto 4: ${ponti.tipo}`);
    H_ponti = (H * voce.percentuale) / 100;
    info = { modo: "forfait", precisione: "stima (metodo abrogato nel 2014)", nota: `${voce.percentuale} % - ${voce.nome} (UNI/TS 11300-1:2008, prospetto 4)` };
  } else {
    info = { modo: "assenti", precisione: "mancante", nota: "ponti termici non inseriti: dispersioni sottostimate" };
  }
  return { righe, H_trasm_W_K: H, H_ponti_W_K: H_ponti, H_con_ponti_W_K: H + H_ponti, ponti: info };
}

// Ventilazione (W/K): 0,34 Wh/(m3K) * n * V  (UNI EN 12831, aria a densità standard)
export function dispersioneVentilazione(volume_m3, parametri = {}) {
  const p = { ...DEFAULT_ENERGIA, ...parametri };
  return 0.34 * p.ricambi_h * volume_m3;
}

// Carico termico di progetto (W): H_tot * (theta_int - theta_ext_inv)
export function caricoInvernale(H_trasm_con_ponti_W_K, volume_m3, parametri = {}) {
  const p = { ...DEFAULT_ENERGIA, ...parametri };
  const Hv = dispersioneVentilazione(volume_m3, p);
  const dT = p.theta_int - p.theta_ext_inv;
  return { H_ventilazione_W_K: Hv, H_tot_W_K: H_trasm_con_ponti_W_K + Hv, dT_K: dT, carico_W: (H_trasm_con_ponti_W_K + Hv) * dT };
}

// Guadagni solari invernali (kWh): sum Aw x (1 - FF) x g_gl,n x Fsh x I_inverno(orientamento).
// vetrati: [{ orientamento, Aw_m2, FF, g, Fsh? }]  g = trasmittanza SENZA schermo (g_gl,n), NON la superficie
// solare estiva Asol,est. Irradianza di default da CLIMA_ROMA (ottobre-aprile, piano verticale).
export function guadagniSolariInverno(vetrati, parametri = {}) {
  const irr = parametri.irraggiamentoInverno_kWh_m2 ?? CLIMA_ROMA.invernoVerticale_kWh_m2;
  return vetrati.reduce((s, v) => {
    const I = irr[v.orientamento];
    if (I === undefined) throw new Error(`orientamento non valido: ${v.orientamento}`);
    return s + v.Aw_m2 * (1 - v.FF) * v.g * (v.Fsh ?? 1) * I;
  }, 0);
}

// Fabbisogno termico netto di riscaldamento stagionale (kWh/anno), metodo dei gradi giorno:
//   Q_nd = 0,024 * GG * H_tot  -  eta * Q_solare_invernale
export function fabbisognoRiscaldamento(H_tot_W_K, vetrati = [], parametri = {}) {
  const p = { ...DEFAULT_ENERGIA, ...parametri };
  const Q_lorda = 0.024 * p.gg * H_tot_W_K;
  const Q_sol = guadagniSolariInverno(vetrati, p);
  const Q_gratuiti = p.eta_guadagni * Q_sol;
  return { Q_lorda_kWh: Q_lorda, Q_solare_kWh: Q_sol, Q_gratuiti_kWh: Q_gratuiti, Q_nd_kWh: Math.max(0, Q_lorda - Q_gratuiti) };
}

// Radiatori: potenza reale a un dato salto termico. P = P50 * (dT_m / 50)^n
// dT_m = (mandata + ritorno)/2 - temperatura ambiente.
export function potenzaRadiatore(P50_W, mandata_C, ritorno_C, parametri = {}) {
  const p = { ...DEFAULT_ENERGIA, ...parametri };
  const dTm = (mandata_C + ritorno_C) / 2 - p.theta_int;
  if (dTm <= 0) throw new Error("salto termico medio non positivo: temperatura acqua troppo bassa");
  return { dTm_K: dTm, P_W: P50_W * Math.pow(dTm / p.dt_norma, p.n_radiatori) };
}

// Potenza nominale P50 necessaria (W) per coprire il carico di progetto con radiatori a mandata/ritorno dati.
export function radiatoriNecessari(carico_W, mandata_C, ritorno_C, parametri = {}) {
  const p = { ...DEFAULT_ENERGIA, ...parametri };
  const dTm = (mandata_C + ritorno_C) / 2 - p.theta_int;
  if (dTm <= 0) throw new Error("salto termico medio non positivo");
  return carico_W / Math.pow(dTm / p.dt_norma, p.n_radiatori);
}

// COP di Carnot e COP reale stimato: COP = eta_c * Tcond / (Tcond - Tevap), temperature in K.
export function copPompaCalore(Tmandata_C, Testerna_C, parametri = {}) {
  const p = { ...DEFAULT_ENERGIA, ...parametri };
  const Tc = Tmandata_C + K;
  const Te = Testerna_C + K;
  if (Tc <= Te) throw new Error("temperatura di condensazione non superiore a quella di evaporazione");
  const cop_carnot = Tc / (Tc - Te);
  return { cop_carnot, cop_reale: p.carnot_eff * cop_carnot };
}

// Pompa di calore: potenza termica nominale >= carico di progetto; energia elettrica annua.
export function pompaDiCalore(carico_W, Q_nd_kWh, Tmandata_C, Testerna_C, parametri = {}) {
  const cop = copPompaCalore(Tmandata_C, Testerna_C, parametri);
  return {
    potenza_termica_kW: carico_W / 1000,
    COP_progetto: cop.cop_reale,
    energia_elettrica_kWh: Q_nd_kWh / cop.cop_reale,
    nota: "COP stimato come efficienza di Carnot; il SCOP stagionale va confermato con la scheda del costruttore (EN 14825).",
  };
}

// Carico estivo di progetto (W): trasmissione e ventilazione con delta estivo + solare di picco + interni.
// vetrati: [{ orientamento, Aw_m2, FF, gglsh, Fsh_ob? }]  gglsh = trasmittanza con schermo in uso (luglio).
// interni: { persone, W_per_persona, W_apparecchi }
export function caricoEstivo(H_trasm_con_ponti_W_K, volume_m3, vetrati = [], interni = {}, parametri = {}) {
  const p = { ...DEFAULT_ENERGIA, ...parametri };
  const dT = p.theta_ext_est - p.theta_int;
  const Hv = dispersioneVentilazione(volume_m3, p);
  const trasm = (H_trasm_con_ponti_W_K + Hv) * dT;
  const picco = CLIMA_ROMA.estatePicco_W_m2;
  const solare = vetrati.reduce((s, v) => {
    const I = picco[v.orientamento];
    if (I === undefined) throw new Error(`orientamento non valido: ${v.orientamento}`);
    return s + v.Aw_m2 * (1 - v.FF) * v.gglsh * (v.Fsh_ob ?? 1) * I;
  }, 0);
  const persone = (interni.persone ?? 0) * (interni.W_per_persona ?? 80);
  const apparecchi = interni.W_apparecchi ?? 0;
  const totale = trasm + solare + persone + apparecchi;
  return { trasmissione_W: trasm, solare_W: solare, interni_W: persone + apparecchi, totale_W: totale };
}

// Condizionatore inverter: EER di progetto stimato come Carnot (T evaporazione = interno - 15 K, condensazione = esterno + 10 K).
export function eerCondizionatore(Testerna_C, Tinterna_C = DEFAULT_ENERGIA.theta_int, parametri = {}) {
  const p = { ...DEFAULT_ENERGIA, ...parametri };
  const Te = Tinterna_C - 15 + K;
  const Tc = Testerna_C + 10 + K;
  const cop_carnot = Te / (Tc - Te);
  return { EER_progetto: p.carnot_eff * cop_carnot };
}

// Fotovoltaico: kWp per coprire il fabbisogno elettrico annuo. La resa (kWh/kWp anno, perdite incluse) viene da
// PVGIS per l'orientamento scelto, oppure dal parametro esplicito resa_kWh_kWp.
export function fotovoltaico(E_fabbisogno_kWh, parametri = {}) {
  const p = { ...DEFAULT_ENERGIA, ...parametri };
  const resa = parametri.resa_kWh_kWp ?? (parametri.orientamento ? CLIMA_ROMA.resaFV_kWh_kWp[parametri.orientamento] : CLIMA_ROMA.resaFV_kWh_kWp.S);
  if (!(resa > 0)) throw new Error("resa FV non valida: indicare l'orientamento o resa_kWh_kWp");
  return {
    kWp_necessari: E_fabbisogno_kWh / (resa * p.pr_fv),
    resa_kWh_kWp: resa * p.pr_fv,
    nota: "Resa PVGIS-SARAH3 per Roma a 36 gradi di inclinazione. Per altre località inserire la resa PVGIS del sito.",
  };
}

// Solare termico per ACS: energia utile = A x eta x irradianza (36 gradi, sud). Fabbisogno ACS = persone x litri x
// 365 x cp x (theta_acs - theta_acqua_fredda). Frazione solare = min(1, utile / fabbisogno).
// L'orientamento diverso dal sud riduce l'irradianza con il rapporto delle rese PVGIS, come approssimazione.
export function solareTermico({ A_m2, persone, orientamento = "S" }, parametri = {}) {
  const p = { ...DEFAULT_ENERGIA, ...parametri };
  if (!(A_m2 > 0)) throw new Error("superficie collettori non valida");
  const fattoreOrient = CLIMA_ROMA.resaFV_kWh_kWp[orientamento] / CLIMA_ROMA.resaFV_kWh_kWp.S;
  const Q_utile = A_m2 * p.eta_solare_termico * INCLINATO_S36_KWH_M2 * fattoreOrient;
  const litri = (persone ?? 0) * p.l_acs_persona_giorno * 365;
  const Q_acs = litri * 4.186 * (p.theta_acs - p.theta_acqua_fredda) / 3600; // kWh/anno (kJ / 3600)
  return {
    Q_utile_kWh: Q_utile,
    Q_acs_kWh: Q_acs,
    frazione_solare: Q_acs > 0 ? Math.min(1, Q_utile / Q_acs) : null,
    nota: "Rendimento medio annuo stimato: da confermare con la scheda del collettore. Orientamento non sud approssimato.",
  };
}

// Verifica della potenza minima FER: P = S / K (S superficie in pianta, K parametro normativo).
// K NON è fissato qui: va inserito dopo verifica del testo vigente (D.Lgs 199/2021 e successive modifiche).
export function potenzaMinimaFER(S_pianta_m2, K_m2_per_kW) {
  if (!(K_m2_per_kW > 0)) return { calcolata: false, motivo: "parametro K non fornito: da verificare nel testo normativo vigente" };
  return { calcolata: true, P_minima_kW: S_pianta_m2 / K_m2_per_kW };
}
