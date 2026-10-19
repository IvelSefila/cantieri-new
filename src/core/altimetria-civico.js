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

// Rimuove specificatori secondari (condominio, palazzo, scala, interno) che mandano in fallimento i geocoder
export function pulisciIndirizzoPerGeocodifica(testo) {
  if (!testo || typeof testo !== "string") return "";
  return testo
    .replace(/\b(condominio|cond\.)\s+[^,]+/gi, "")
    .replace(/\b(palazzo|pal\.|edificio|residence)\s+[a-zA-Z0-9]+/gi, "")
    .replace(/\b(scala|sc\.|sc)\s+[a-zA-Z0-9]+/gi, "")
    .replace(/\b(interno|int\.|piano|p\.)\s+[a-zA-Z0-9]+/gi, "")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

// Geocodifica un indirizzo tramite Nominatim (OpenStreetMap) con fallback intelligente
export async function geocodificaIndirizzo(indirizzo, { fetchFn = fetch } = {}) {
  if (!indirizzo || typeof indirizzo !== "string" || !indirizzo.trim()) {
    return { ok: false, errore: "Indirizzo non valido o vuoto" };
  }

  const tentaGeocodifica = async (q) => {
    let query = q.trim();
    if (!/(piemonte|torino|cuneo|alessandria|novara|asti|biella|vercelli|verbania)/i.test(query)) {
      query += ", Piemonte";
    }
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`;
    const res = await fetchFn(url, { headers: { "User-Agent": "CantieriAI/1.0 (cantieri-new; antincendio-gsa)" } });
    if (!res.ok) return null;
    const dati = await res.json();
    return Array.isArray(dati) && dati.length > 0 ? dati[0] : null;
  };

  try {
    // 1. Primo tentativo con la stringa digitata
    let primo = await tentaGeocodifica(indirizzo);

    // 2. Se non trova nulla, prova con l'indirizzo ripulito dai dettagli interni (condominio, palazzo, scala...)
    if (!primo) {
      const pulito = pulisciIndirizzoPerGeocodifica(indirizzo);
      if (pulito && pulito.toLowerCase() !== indirizzo.trim().toLowerCase()) {
        primo = await tentaGeocodifica(pulito);
      }
    }

    if (!primo) {
      return { ok: false, errore: `Nessun risultato cartografico trovato per '${indirizzo}'` };
    }

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
    indice_volume = 0,
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

  // 3. Selezione del volume (default: il più alto, ma selezionabile dall'utente)
  const idx = typeof indice_volume === "number" && indice_volume >= 0 && indice_volume < bdt.volumi.length ? indice_volume : 0;
  const volumeScelto = bdt.volumi[idx];

  // 4. Preparazione fonti per la fusione conservativa
  const fonti = [];

  // Fonte primaria: LiDAR BDTRE Piemonte sul volume scelto
  const stimaLidar = stimaAltezzaAntincendiDaEdificio(volumeScelto.altezza_volumetrica_m);
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

  // 5. Valutazione normativa con motore Cantieri civile-abitazione.js
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
      altezza_volumetrica_m: volumeScelto.altezza_volumetrica_m,
      ente: volumeScelto.ente_prod,
      metodo: volumeScelto.modo_prod,
      indice_selezionato: idx,
    },
    volumi_rilevati: bdt.volumi.map((v, i) => ({
      indice: i,
      altezza_m: v.altezza_volumetrica_m,
      tipo_presunto: v.altezza_volumetrica_m >= 12 ? "Corpo principale alto" : v.altezza_volumetrica_m >= 7 ? "Corpo secondario / basso" : "Box / accessorio",
      selezionato: i === idx,
    })),
    fonti_utilizzate: fonti,
    valutazione_gsa: valutazione,
  };
}
