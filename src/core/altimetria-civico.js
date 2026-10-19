// Altimetria e GSA automatico da civico / indirizzo per la Regione Piemonte.
// Interroga i servizi aperti ufficiali WFS della BDTRE Piemonte (CSI / ARPA Piemonte, LiDAR DSM-DTM)
// e fonde i dati con Google Earth o pratiche edilizie secondo la logica conservativa di civile-abitazione.js.

import { valutaCivileAbitazione } from "./civile-abitazione.js";

const WFS_BDT_RE_IMM = "https://geoservices.csi.it/ms/wfs/taims/rp-01/taimswfs/bdtre_imm";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// Estrae i volumi edilizi (un_vol) dal GML restituito dal WFS
export function parseGmlUnVol(gmlText) {
  const volumi = [];
  if (!gmlText) return volumi;

  // Cerca ogni blocco un_vol (supporta namespace con o senza ms:)
  const regexFeature = /<(?:ms:)?un_vol\b[^>]*>([\s\S]*?)<\/(?:ms:)?un_vol>/g;
  let match;
  while ((match = regexFeature.exec(gmlText)) !== null) {
    const blocco = match[1];

    const avM = blocco.match(/<(?:ms:)?un_vol_av>([\d.,]+)<\/(?:ms:)?un_vol_av>/);
    const qeM = blocco.match(/<(?:ms:)?un_vol_qe>([\d.,]+)<\/(?:ms:)?un_vol_qe>/);
    const porM = blocco.match(/<(?:ms:)?un_vol_por>([^<]*)<\/(?:ms:)?un_vol_por>/);
    const modoM = blocco.match(/<(?:ms:)?modo_prod>([^<]*)<\/(?:ms:)?modo_prod>/);
    const enteM = blocco.match(/<(?:ms:)?ente_prod>([^<]*)<\/(?:ms:)?ente_prod>/);

    const altezzaM = avM ? parseFloat(avM[1].replace(",", ".")) : null;
    const estradossoM = qeM ? parseFloat(qeM[1].replace(",", ".")) : null;

    if (altezzaM !== null && !isNaN(altezzaM)) {
      volumi.push({
        altezza_volumetrica_m: altezzaM,
        quota_estradosso_m: isNaN(estradossoM) ? null : estradossoM,
        piano_origine: porM ? porM[1].trim() : null,
        ente_prod: enteM ? enteM[1].trim() : "ARPA PIEMONTE",
        modo_prod: modoM ? modoM[1].trim() : "LiDAR DSM-DTM",
      });
    }
  }

  return volumi;
}

// Stima l'altezza antincendi h (apertura più alta ultimo piano) a partire dall'altezza volumetrica dell'edificio
// Regola prudenziale: davanzale ultimo piano = altezza totale - parapetto/sotto-tetto (1.40 m ± 0.40 m)
export function stimaAltezzaAntincendiDaEdificio(altezzaVolumetricaM) {
  if (typeof altezzaVolumetricaM !== "number" || isNaN(altezzaVolumetricaM) || altezzaVolumetricaM <= 0) {
    return null;
  }
  const minM = Math.max(0, altezzaVolumetricaM - 1.80);
  const maxM = altezzaVolumetricaM - 1.00;
  return {
    fonte: "LiDAR BDTRE Piemonte (ARPA)",
    min_mm: Math.round(minM * 1000),
    max_mm: Math.round(maxM * 1000),
    stato: "stimato",
    altezza_volumetrica_m: altezzaVolumetricaM,
  };
}

// Geocodifica un indirizzo tramite Nominatim (OpenStreetMap)
export async function geocodificaIndirizzo(indirizzo, { fetchFn = fetch } = {}) {
  if (!indirizzo || typeof indirizzo !== "string" || !indirizzo.trim()) {
    return { ok: false, errore: "Indirizzo non valido o vuoto" };
  }

  let query = indirizzo.trim();
  // Se non e' specificata una regione o citta' piemontese, aiutiamo il geocoder
  if (!/(piemonte|torino|cuneo|alessandria|novara|asti|biella|vercelli|verbania)/i.test(query)) {
    query += ", Piemonte";
  }

  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
  try {
    const res = await fetchFn(url, { headers: { "User-Agent": "CantieriAI/1.0 (cantieri-new; antincendio-gsa)" } });
    if (!res.ok) return { ok: false, errore: `Errore geocoder HTTP ${res.status}` };
    const dati = await res.json();
    if (!Array.isArray(dati) || dati.length === 0) {
      return { ok: false, errore: `Nessun risultato trovato per '${indirizzo}'` };
    }
    const primo = dati[0];
    return {
      ok: true,
      lat: parseFloat(primo.lat),
      lon: parseFloat(primo.lon),
      display_name: primo.display_name,
    };
  } catch (err) {
    return { ok: false, errore: `Impossibile contattare il servizio geocodifica: ${err.message}` };
  }
}

// Interroga il servizio WFS BDTRE della Regione Piemonte per un punto lat/lon
export async function interrogaLiDARPiemonte(lat, lon, { fetchFn = fetch, raggioGradi = 0.0003 } = {}) {
  const minLat = (lat - raggioGradi).toFixed(6);
  const maxLat = (lat + raggioGradi).toFixed(6);
  const minLon = (lon - raggioGradi).toFixed(6);
  const maxLon = (lon + raggioGradi).toFixed(6);

  const url = `${WFS_BDT_RE_IMM}?service=WFS&version=1.1.0&request=GetFeature&typename=un_vol&maxfeatures=5&srsname=EPSG:4326&bbox=${minLat},${minLon},${maxLat},${maxLon},EPSG:4326`;

  try {
    const res = await fetchFn(url);
    if (!res.ok) return { ok: false, errore: `Errore WFS BDTRE HTTP ${res.status}` };
    const gml = await res.text();
    const volumi = parseGmlUnVol(gml);
    if (volumi.length === 0) {
      return { ok: false, errore: "Nessun volume edilizio (un_vol) censito per queste coordinate nella BDTRE Piemonte", rawGml: gml };
    }
    // Ordina per altezza decrescente (il corpo principale del palazzo e' solitamente il volume piu' alto)
    volumi.sort((a, b) => b.altezza_volumetrica_m - a.altezza_volumetrica_m);
    return { ok: true, volumi, volumePrincipale: volumi[0] };
  } catch (err) {
    return { ok: false, errore: `Impossibile interrogare il geoportale Piemonte: ${err.message}` };
  }
}

// Calcolo completo: da indirizzo testuale a valutazione GSA (DM 246/1987 + DM 25/1/2019)
export async function calcolaGsaDaCivico(indirizzo, opzioni = {}) {
  const {
    quota_google_earth_m = null,
    quota_pratica_m = null,
    attivita = [],
    piano_accessibile_vvf = true,
    vani_tecnici_esclusi = true,
    fetchFn = fetch,
  } = opzioni;

  // 1. Geocodifica
  const geo = await geocodificaIndirizzo(indirizzo, { fetchFn });
  if (!geo.ok) return { esito: "ERRORE", errore: geo.errore };

  // 2. Interrogazione WFS BDTRE Piemonte
  const bdt = await interrogaLiDARPiemonte(geo.lat, geo.lon, { fetchFn });
  if (!bdt.ok) {
    return {
      esito: "ERRORE",
      errore: bdt.errore,
      indirizzo_trovato: geo.display_name,
      coordinate: { lat: geo.lat, lon: geo.lon },
    };
  }

  // 3. Preparazione fonti per la fusione conservativa
  const fonti = [];

  // Fonte primaria: LiDAR BDTRE Piemonte
  const stimaLidar = stimaAltezzaAntincendiDaEdificio(bdt.volumePrincipale.altezza_volumetrica_m);
  if (stimaLidar) fonti.push(stimaLidar);

  // Fonte secondaria opzionale: Google Earth 3D (tolleranza tipica ± 0.50 m)
  if (typeof quota_google_earth_m === "number" && !isNaN(quota_google_earth_m) && quota_google_earth_m > 0) {
    fonti.push({
      fonte: "Google Earth 3D",
      min_mm: Math.round((quota_google_earth_m - 0.50) * 1000),
      max_mm: Math.round((quota_google_earth_m + 0.50) * 1000),
      stato: "stimato",
    });
  }

  // Fonte terziaria opzionale: Pratica edilizia (valore certo)
  if (typeof quota_pratica_m === "number" && !isNaN(quota_pratica_m) && quota_pratica_m > 0) {
    fonti.push({
      fonte: "Pratica Edilizia SUE",
      h_mm: Math.round(quota_pratica_m * 1000),
      stato: "verificato",
    });
  }

  // 4. Valutazione normativa con motore Cantieri civile-abitazione.js
  const valutazione = valutaCivileAbitazione({
    altezza: {
      fonti,
      piano_esterno_accessibile_mezzi_vvf: piano_accessibile_vvf,
      vani_tecnici_esclusi,
    },
    attivita,
  });

  return {
    esito: "OK",
    indirizzo_inserito: indirizzo,
    indirizzo_trovato: geo.display_name,
    coordinate: { lat: geo.lat, lon: geo.lon },
    edificio_lidar: {
      altezza_volumetrica_m: bdt.volumePrincipale.altezza_volumetrica_m,
      ente: bdt.volumePrincipale.ente_prod,
      metodo: bdt.volumePrincipale.modo_prod,
      altri_volumi_contigui: bdt.volumi.length - 1,
    },
    fonti_utilizzate: fonti,
    valutazione_gsa: valutazione,
  };
}
