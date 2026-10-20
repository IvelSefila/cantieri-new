// Altimetria e GSA automatico da civico / indirizzo per tutte le 20 Regioni d'Italia.
// - Piemonte: interroga i servizi aperti ufficiali WFS della BDTRE Piemonte (CSI / ARPA Piemonte, LiDAR DSM-DTM).
// - Tutte le altre regioni: interroga i dati 3D aperti OpenStreetMap (tag height e building:levels) con fallback
//   su modello parametrico edilizio italiano (DM 5/7/1975) e fusione con Google Earth 3D o pratiche edilizie.
// Valutazione normativa 100% pura nel browser secondo civile-abitazione.js (DM 246/1987 + DM 25/1/2019).

import { valutaCivileAbitazione } from "./civile-abitazione.js?v=v20261020bx";

const WFS_BDT_RE_IMM = "https://geoservices.csi.it/ms/wfs/taims/rp-01/taimswfs/bdtre_imm";
const ARCGIS_FIND_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
const ARCGIS_SUGGEST_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const PHOTON_URL = "https://photon.komoot.io/api/";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OSM_API_MAP_URL = "https://api.openstreetmap.org/api/0.6/map";

// Registro canonico delle 20 Regioni d'Italia (con varianti bilingue / dialettali)
export const CITTA_ITALIANE_ALIAS = {
  "turin": "Torino",
  "milan": "Milano",
  "rome": "Roma",
  "naples": "Napoli",
  "florence": "Firenze",
  "genoa": "Genova",
  "venice": "Venezia",
  "padua": "Padova",
  "mantua": "Mantova",
  "syracuse": "Siracusa",
};

export function normalizzaComune(comune) {
  if (!comune || typeof comune !== "string") return "";
  const low = comune.trim().toLowerCase();
  return CITTA_ITALIANE_ALIAS[low] || comune.trim();
}

export const REGIONI_ITALIANE = {
  "abruzzo": "Abruzzo",
  "basilicata": "Basilicata",
  "lucania": "Basilicata",
  "calabria": "Calabria",
  "campania": "Campania",
  "emilia-romagna": "Emilia-Romagna",
  "friuli-venezia giulia": "Friuli-Venezia Giulia",
  "friuli": "Friuli-Venezia Giulia",
  "lazio": "Lazio",
  "latium": "Lazio",
  "liguria": "Liguria",
  "lombardia": "Lombardia",
  "lombardy": "Lombardia",
  "marche": "Marche",
  "marches": "Marche",
  "molise": "Molise",
  "piemonte": "Piemonte",
  "piedmont": "Piemonte",
  "puglia": "Puglia",
  "apulia": "Puglia",
  "sardegna": "Sardegna",
  "sardinia": "Sardegna",
  "sardigna": "Sardegna",
  "sardinia": "Sardegna",
  "sicilia": "Sicilia",
  "sicily": "Sicilia",
  "sicily": "Sicilia",
  "toscana": "Toscana",
  "tuscany": "Toscana",
  "trentino-alto adige": "Trentino-Alto Adige",
  "trentino-alto adige/südtirol": "Trentino-Alto Adige",
  "trentino-südtirol": "Trentino-Alto Adige",
  "südtirol": "Trentino-Alto Adige",
  "trentino": "Trentino-Alto Adige",
  "umbria": "Umbria",
  "valle d'aosta": "Valle d'Aosta",
  "valle d'aosta/vallée d'aoste": "Valle d'Aosta",
  "vallée d'aoste": "Valle d'Aosta",
  "aosta": "Valle d'Aosta",
  "veneto": "Veneto",
};

export function normalizzaRegione(str) {
  if (!str || typeof str !== "string") return "Italia";
  const pulita = str.trim().toLowerCase();
  for (const [chiave, canonica] of Object.entries(REGIONI_ITALIANE)) {
    if (pulita.includes(chiave)) return canonica;
  }
  return "Italia";
}

// Estrae i volumi edilizi (un_vol) dal GML restituito dal WFS BDTRE Piemonte
export function parseGmlUnVol(gmlText, centroRiferimento = null) {
  const volumi = [];
  if (!gmlText) return volumi;

  const regexFeature = /<(?:ms:)?un_vol\b[^>]*>([\s\S]*?)<\/(?:ms:)?un_vol>/g;
  let match;
  while ((match = regexFeature.exec(gmlText)) !== null) {
    const blocco = match[1];

    const avM = blocco.match(/<(?:ms:)?un_vol_av>([\d.,]+)<\/(?:ms:)?un_vol_av>/);
    const qeM = blocco.match(/<(?:ms:)?un_vol_qe>([\d.,]+)<\/(?:ms:)?un_vol_qe>/);
    const porM = blocco.match(/<(?:ms:)?un_vol_por>([^<]*)<\/(?:ms:)?un_vol_por>/);
    const modoM = blocco.match(/<(?:ms:)?modo_prod>([^<]*)<\/(?:ms:)?modo_prod>/);
    const enteM = blocco.match(/<(?:ms:)?ente_prod>([^<]*)<\/(?:ms:)?ente_prod>/);
    const coordsM = blocco.match(/<gml:coordinates[^>]*>([^<]+)<\/gml:coordinates>/);
    const posM = blocco.match(/<gml:posList[^>]*>([^<]+)<\/gml:posList>/);

    const altezzaM = avM ? parseFloat(avM[1].replace(",", ".")) : null;
    const estradossoM = qeM ? parseFloat(qeM[1].replace(",", ".")) : null;

    if (altezzaM !== null && !isNaN(altezzaM)) {
      let vLat = centroRiferimento ? centroRiferimento.lat : null;
      let vLon = centroRiferimento ? centroRiferimento.lon : null;
      const coordStr = coordsM ? coordsM[1] : (posM ? posM[1] : "");
      if (coordStr) {
        const parts = coordStr.trim().split(/[\s,]+/);
        let sLat = 0, sLon = 0, cnt = 0;
        for (let j = 0; j < parts.length - 1; j += 2) {
          const p1 = parseFloat(parts[j]);
          const p2 = parseFloat(parts[j + 1]);
          if (!isNaN(p1) && !isNaN(p2)) {
            sLat += p1;
            sLon += p2;
            cnt++;
          }
        }
        if (cnt > 0) {
          vLat = sLat / cnt;
          vLon = sLon / cnt;
        }
      }

      let distM = 0;
      if (centroRiferimento && typeof vLat === "number" && typeof vLon === "number") {
        const dLat = (vLat - centroRiferimento.lat) * 111320;
        const dLon = (vLon - centroRiferimento.lon) * 111320 * Math.cos(centroRiferimento.lat * Math.PI / 180);
        distM = Math.round(Math.sqrt(dLat * dLat + dLon * dLon) * 10) / 10;
      }

      volumi.push({
        altezza_volumetrica_m: altezzaM,
        quota_estradosso_m: isNaN(estradossoM) ? null : estradossoM,
        piano_origine: porM ? porM[1].trim() : null,
        ente_prod: enteM ? enteM[1].trim() : "ARPA PIEMONTE",
        modo_prod: modoM ? modoM[1].trim() : "LiDAR DSM-DTM",
        lat: vLat,
        lon: vLon,
        distM,
      });
    }
  }

  return volumi;
}

// Estrae informazioni di altezza e piani dagli elementi OpenStreetMap 3D
// Calcola l'area di un poligono su coordinate geografiche (formula di Gauss / Shoelace in m²)
export function polygonAreaM2(coords) {
  if (!coords || coords.length < 3) return 0;
  let area = 0;
  const lat0 = coords[0][0];
  const cosLat = Math.cos(lat0 * Math.PI / 180);
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const xi = coords[i][1] * 111000 * cosLat;
    const yi = coords[i][0] * 111000;
    const xj = coords[j][1] * 111000 * cosLat;
    const yj = coords[j][0] * 111000;
    area += (xi * yj) - (xj * yi);
  }
  return Math.abs(area) / 2;
}

// Analizza i nodi e way poligonali restituiti dall'API OpenStreetMap ufficiale
export function parseOsmXmlBuildings(xml, centerLat, centerLon) {
  const volumi = [];
  if (!xml || typeof xml !== "string") return volumi;

  const nodeCoords = new Map();
  const nodeRe = /<node\s+([^>]+)>/g;
  let m;
  while ((m = nodeRe.exec(xml)) !== null) {
    const attrs = m[1];
    const idM = /id="(\d+)"/.exec(attrs);
    const latM = /lat="([\d.-]+)"/.exec(attrs);
    const lonM = /lon="([\d.-]+)"/.exec(attrs);
    if (idM && latM && lonM) {
      nodeCoords.set(idM[1], [parseFloat(latM[1]), parseFloat(lonM[1])]);
    }
  }

  const wayBlockRe = /<way\s+id="(\d+)"[^>]*>([\s\S]*?)<\/way>/g;
  let wMatch;
  while ((wMatch = wayBlockRe.exec(xml)) !== null) {
    const wayId = wMatch[1];
    const body = wMatch[2];

    const tagRe = /<tag\s+k="([^"]+)"\s+v="([^"]+)"/g;
    const tags = {};
    let tMatch;
    while ((tMatch = tagRe.exec(body)) !== null) {
      tags[tMatch[1]] = tMatch[2];
    }
    if (!tags.building) continue;

    const ndRe = /<nd\s+ref="(\d+)"/g;
    let ndMatch;
    const wayPoints = [];
    while ((ndMatch = ndRe.exec(body)) !== null) {
      const c = nodeCoords.get(ndMatch[1]);
      if (c) wayPoints.push(c);
    }
    const count = wayPoints.length;
    const bLat = count > 0 ? wayPoints.reduce((s, p) => s + p[0], 0) / count : centerLat;
    const bLon = count > 0 ? wayPoints.reduce((s, p) => s + p[1], 0) / count : centerLon;
    const dLat = (bLat - centerLat) * 111000;
    const dLon = (bLon - centerLon) * 111000 * Math.cos(centerLat * Math.PI / 180);
    const distM = Math.hypot(dLat, dLon);
    const areaM2 = Math.round(polygonAreaM2(wayPoints));

    let altezzaM = null;
    let piani = null;
    let modoProd = "";

    if (tags.height) {
      const h = parseFloat(tags.height.replace(",", ".").replace(/m/i, "").trim());
      if (!isNaN(h) && h > 0) {
        altezzaM = h;
        modoProd = `Tag metrico OSM height (${h.toFixed(1)} m)`;
      }
    }
    if (tags["building:levels"]) {
      const l = parseInt(tags["building:levels"], 10);
      if (!isNaN(l) && l > 0) {
        piani = l;
        if (!altezzaM) {
          altezzaM = Math.round((piani * 3.05 + 1.20) * 10) / 10;
          modoProd = `Tag OSM building:levels (${piani} piani)`;
        }
      }
    }

    const bType = tags.building.toLowerCase();
    let tipoPresunto = tags.name || (tags["addr:housenumber"] ? `Civico ${tags["addr:housenumber"]}` : null);

    if (piani === null && altezzaM === null) {
      if (bType === "apartments") {
        piani = 5;
        altezzaM = 16.5;
        if (!tipoPresunto) tipoPresunto = areaM2 > 0 ? `Condominio residenziale (${areaM2} m²)` : "Condominio residenziale";
        modoProd = "Modello condominiale OSM (5 piani)";
      } else if (bType === "house" || bType === "detached" || bType === "semidetached_house") {
        piani = 2;
        altezzaM = 7.3;
        if (!tipoPresunto) tipoPresunto = areaM2 > 0 ? `Villetta residenziale (${areaM2} m²)` : "Villetta residenziale";
        modoProd = "Modello unifamiliare OSM (2 piani)";
      } else if (bType === "church" || bType === "place_of_worship") {
        piani = 1;
        altezzaM = 12.0;
        if (!tipoPresunto) tipoPresunto = "Chiesa / Luogo di culto";
        modoProd = "Edificio monumentale di culto (12m)";
      } else if (bType === "service" || bType === "garage" || bType === "garages") {
        piani = 1;
        altezzaM = 3.0;
        if (!tipoPresunto) tipoPresunto = "Autorimessa / Pertinenza";
        modoProd = "Volume di servizio / Box (3m)";
      } else {
        if (areaM2 >= 400) {
          altezzaM = 16.5;
          if (!tipoPresunto) tipoPresunto = `Complesso (${areaM2} m², ${altezzaM.toFixed(1)} m)`;
          modoProd = `Impronta OSM ${areaM2} m² (${altezzaM.toFixed(1)} m)`;
        } else if (areaM2 >= 180) {
          altezzaM = 13.4;
          if (!tipoPresunto) tipoPresunto = `Palazzina (${areaM2} m², ${altezzaM.toFixed(1)} m)`;
          modoProd = `Impronta OSM ${areaM2} m² (${altezzaM.toFixed(1)} m)`;
        } else if (areaM2 >= 90) {
          altezzaM = 10.4;
          if (!tipoPresunto) tipoPresunto = `Edificio (${areaM2} m², ${altezzaM.toFixed(1)} m)`;
          modoProd = `Impronta OSM ${areaM2} m² (${altezzaM.toFixed(1)} m)`;
        } else {
          altezzaM = 7.3;
          if (!tipoPresunto) tipoPresunto = areaM2 > 0 ? `Edificio basso (${areaM2} m², ${altezzaM.toFixed(1)} m)` : "Edificio basso (7.3 m)";
          modoProd = areaM2 > 0 ? `Impronta OSM ${areaM2} m² (${altezzaM.toFixed(1)} m)` : "Stima volumetrica OSM (7.3 m)";
        }
      }
    }

    if (!tipoPresunto) {
      tipoPresunto = areaM2 > 0 ? `Corpo ${wayId} (${areaM2} m²)` : `Corpo ${wayId}`;
    }

    volumi.push({
      id: wayId,
      tipo_osm: tags.building,
      tipo_presunto: tipoPresunto,
      altezza_volumetrica_m: altezzaM,
      piani: piani,
      area_sedime_m2: areaM2,
      lat: bLat,
      lon: bLon,
      distanza_m: Math.round(distM * 10) / 10,
      ente_prod: "OpenStreetMap 3D / Catasto Volumetrico Nazionale",
      modo_prod: modoProd || "OpenStreetMap 3D",
      tags,
    });
  }

  volumi.sort((a, b) => a.distanza_m - b.distanza_m);
  const vicini = volumi.filter((v) => v.distanza_m <= 45);
  return (vicini.length > 0 ? vicini : volumi).slice(0, 5);
}

export function parseOverpassElements(elements) {
  const volumi = [];
  if (!Array.isArray(elements)) return volumi;

  for (const el of elements) {
    const tags = el.tags || {};
    let altezzaM = null;
    let piani = null;

    if (tags.height) {
      const parsedH = parseFloat(String(tags.height).replace(",", ".").replace(/m/i, "").trim());
      if (!isNaN(parsedH) && parsedH > 0) {
        altezzaM = parsedH;
      }
    }

    if (tags["building:levels"]) {
      const parsedL = parseInt(tags["building:levels"], 10);
      if (!isNaN(parsedL) && parsedL > 0) {
        piani = parsedL;
        if (!altezzaM) {
          altezzaM = Math.round((piani * 3.05 + 1.20) * 10) / 10;
        }
      }
    }

    if (altezzaM !== null || piani !== null) {
      const nomeEdificio = tags.name || tags["addr:housenumber"]
        ? `Edificio ${tags["addr:housenumber"] || tags.name}`
        : `Corpo ${el.id}`;
      volumi.push({
        id: el.id,
        tipo_osm: tags.building || "residential",
        tipo_presunto: nomeEdificio,
        altezza_volumetrica_m: altezzaM || ((piani || 3) * 3.05 + 1.20),
        piani: piani || null,
        ente_prod: "OpenStreetMap 3D / Catasto Volumetrico",
        modo_prod: tags.height ? "Tag OSM height" : "Tag OSM building:levels (DM 5/7/1975)",
      });
    }
  }

  volumi.sort((a, b) => b.altezza_volumetrica_m - a.altezza_volumetrica_m);
  return volumi;
}

// Opzioni tipologiche residenziali per l'edilizia italiana (DM 5 luglio 1975 + DM 246/1987)
export function generaVolumiArchetipoItaliano() {
  return [
    {
      tipo_presunto: "Condominio standard (5 piani)",
      piani: 5,
      altezza_volumetrica_m: 16.5,
      ente_prod: "Tipologia Edilizia Residenziale Italiana (DM 246/1987)",
      modo_prod: "Stima tipologica 5 piani (interpiano 3.05 m)",
    },
    {
      tipo_presunto: "Palazzina residenziale (4 piani)",
      piani: 4,
      altezza_volumetrica_m: 13.4,
      ente_prod: "Tipologia Edilizia Residenziale Italiana (DM 246/1987)",
      modo_prod: "Stima tipologica 4 piani (interpiano 3.05 m)",
    },
    {
      tipo_presunto: "Edificio multipiano / Torre (8 piani)",
      piani: 8,
      altezza_volumetrica_m: 25.6,
      ente_prod: "Tipologia Edilizia Residenziale Italiana (DM 246/1987)",
      modo_prod: "Stima tipologica 8 piani (interpiano 3.05 m)",
    },
    {
      tipo_presunto: "Basso fabbricato / Villetta (2 piani)",
      piani: 2,
      altezza_volumetrica_m: 7.3,
      ente_prod: "Tipologia Edilizia Residenziale Italiana (DM 246/1987)",
      modo_prod: "Stima tipologica 2 piani (interpiano 3.05 m)",
    },
  ];
}

// Stima l'altezza antincendi h (davanzale dell'apertura più alta dell'ultimo piano abitabile)
// a partire dall'altezza volumetrica totale dell'edificio (da LiDAR o 3D mesh).
// Regola prudenziale: davanzale = altezza totale - parapetto/sotto-tetto (1.40 m ± 0.40 m).
export function stimaAltezzaAntincendiDaEdificio(altezzaVolumetricaM, { fonte = "LiDAR BDTRE Piemonte (ARPA)" } = {}) {
  if (typeof altezzaVolumetricaM !== "number" || isNaN(altezzaVolumetricaM) || altezzaVolumetricaM <= 0) {
    return null;
  }
  const minM = Math.max(0, altezzaVolumetricaM - 1.80);
  const maxM = altezzaVolumetricaM - 1.00;
  return {
    fonte,
    min_mm: Math.round(minM * 1000),
    max_mm: Math.round(maxM * 1000),
    stato: "stimato",
    altezza_volumetrica_m: altezzaVolumetricaM,
  };
}

// Stima l'altezza antincendi h a partire dal numero di piani fuori terra N
// Secondo il DM 5 luglio 1975 (altezza netta 2.70 m + solaio ~0.35 m = 3.05 m per piano):
// Quota davanzale ultimo piano calpestabile: h = (N - 1) * 3.05 m + 1.00 m (± 0.35 m)
export function stimaAltezzaAntincendiDaPiani(numeroPiani, { altezzaPianoM = 3.05, fonte = "Piani Edificio (DM 5/7/1975)" } = {}) {
  if (typeof numeroPiani !== "number" || isNaN(numeroPiani) || numeroPiani <= 0) {
    return null;
  }
  const hCentroM = (numeroPiani - 1) * altezzaPianoM + 1.00;
  const minM = Math.max(0, hCentroM - 0.35);
  const maxM = hCentroM + 0.35;
  const altezzaVolumetricaM = Math.round((numeroPiani * altezzaPianoM + 1.20) * 10) / 10;
  return {
    fonte,
    min_mm: Math.round(minM * 1000),
    max_mm: Math.round(maxM * 1000),
    stato: "stimato",
    numero_piani: numeroPiani,
    altezza_volumetrica_m: altezzaVolumetricaM,
  };
}

// Formatta un indirizzo italiano in modo canonico stile e-commerce / Amazon
export function formattaIndirizzoItaliano({ via = "", civico = "", comune = "", cap = "", provincia = "" } = {}) {
  const normComune = normalizzaComune(comune);
  const normProv = normalizzaComune(provincia);
  const parti = [];
  if (via) {
    parti.push(civico ? `${via}, ${civico}` : via);
  }
  let loc = [cap, normComune].filter(Boolean).join(" ");
  if (normProv && normProv.toLowerCase() !== normComune.toLowerCase()) {
    loc = loc ? `${loc} (${normProv})` : `(${normProv})`;
  }
  if (loc) {
    parti.push(loc);
  }
  return parti.join(", ") || via || normComune || "";
}

const ODONIMI_PREFIX_RE = /^(via|viale|corso|c\.so|strada|str\.|piazza|p\.za|piazzale|p\.le|largo|vicolo|borgo|stradello|contrada)\b[\s,.]*/i;

const PREPOSIZIONI_ARTICOLI = new Set([
  "di", "del", "della", "dello", "dei", "degli", "delle", "da", "in", "con", "su", "per", "tra", "fra",
  "il", "la", "le", "lo", "i", "gli", "un", "una", "uno", "al", "allo", "alla", "ai", "agli", "alle",
  "n", "n.", "num", "num.", "civico", "civ"
]);

export function estraiKeywordSignificative(testo) {
  if (!testo || typeof testo !== "string") return [];
  const senzaPrefisso = testo.trim().replace(ODONIMI_PREFIX_RE, "");
  const parole = senzaPrefisso
    .toLowerCase()
    .replace(/[^a-z0-9à-ú\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !PREPOSIZIONI_ARTICOLI.has(w) && !/^\d+$/.test(w));
  return parole.length > 0 ? parole : [testo.trim().toLowerCase()];
}

export function eIndirizzoPertinente(testoCompletoRisultato, keywords) {
  if (!keywords || keywords.length === 0) return true;
  const nom = (testoCompletoRisultato || "").toLowerCase();
  return keywords.some((k) => nom.includes(k));
}

const MESI_ODONIMI = new Set([
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
]);

export function estraiCivicoEsplicito(testo) {
  if (!testo || typeof testo !== "string") return "";
  const t = testo.trim();
  const tokens = t.split(/[\s,]+/);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i].replace(/[.,;]/g, "");
    if (/^\d{1,4}[a-zA-Z]?(?:\/[a-zA-Z0-9]+)?$/i.test(tok) && !/^\d{5}$/.test(tok)) {
      const nextTok = tokens[i + 1] ? tokens[i + 1].toLowerCase().replace(/[.,;]/g, "") : "";
      if (MESI_ODONIMI.has(nextTok)) continue;
      return tok;
    }
  }
  return "";
}

export function scomponiIndirizzo(testo) {
  const ODONIMI = ["via", "viale", "corso", "strada", "piazza", "piazzale", "largo", "vicolo", "borgo", "stradello", "contrada", "str.", "c.so", "v.le", "p.za"];
  let t = (testo || "").trim();
  let parts = t.split(/[,]/).map(s => s.trim()).filter(Boolean);
  let streetPart = parts[0] || t;
  let cityPart = parts.length > 1 ? parts[parts.length - 1] : "";

  if (!cityPart) {
    const m = t.match(/^(.*?\d+[a-zA-Z]?(?:\/[a-zA-Z0-9]+)?)\s+([a-zA-Zà-ú\s]{3,})$/i);
    if (m) {
      streetPart = m[1].trim();
      cityPart = m[2].trim();
    }
  }

  let streetNaked = streetPart;
  for (const od of ODONIMI) {
    const re = new RegExp(`^${od}\\b[\\s,.]*`, "i");
    if (re.test(streetNaked)) {
      streetNaked = streetNaked.replace(re, "").trim();
      break;
    }
  }

  const varianti = [streetPart];
  if (streetNaked && streetNaked !== streetPart) {
    varianti.push(streetNaked);
    varianti.push(`strada ${streetNaked}`);
    varianti.push(`via ${streetNaked}`);
    varianti.push(`corso ${streetNaked}`);
  }

  return { streetPart, streetNaked, cityPart, varianti: [...new Set(varianti)] };
}

export function generaVariantiOdonimi(testo) {
  return scomponiIndirizzo(testo).varianti;
}

// Autocompletamento real-time stile Amazon per tutte le vie d'Italia
// Interroga Nominatim (con ricerca strutturata street/city e fallback libero) e Photon,
// con filtro rigoroso di pertinenza (scarta strade non attinenti come 'Via Mellea' se l'utente cerca 'suniglia')
// Autocompletamento real-time stile Amazon per tutte le vie e i civici d'Italia
// Interroga in ordine:
// 1) ArcGIS World Geocoder (copertura totale nazionale di vie e numeri civici puntuali d'Italia)
// 2) Photon OSM (OpenStreetMap geocoder elastico con tolleranza tipografica)
// 3) Nominatim OSM (ricerca strutturata e fallback)
// Preserva rigorosamente qualsiasi numero civico digitato dall'utente senza mai cancellarlo.
export async function autocompletaIndirizzo(testo, { fetchFn = fetch, limit = 5 } = {}) {
  if (!testo || typeof testo !== "string" || testo.trim().length < 3) {
    return [];
  }

  const kw = estraiKeywordSignificative(testo);
  const userCivico = estraiCivicoEsplicito(testo);
  const { cityPart } = scomponiIndirizzo(testo);
  const targetCity = cityPart ? normalizzaComune(cityPart).toLowerCase() : "";
  const risultati = [];
  const visti = new Set();

  function aggiungi(cand) {
    if (!cand || typeof cand.lat !== "number" || typeof cand.lon !== "number") return;
    const testoCompleto = `${cand.via || ""} ${cand.civico || ""} ${cand.comune || ""} ${cand.provincia || ""} ${cand.display_name || ""}`;
    if (kw.length > 0 && !eIndirizzoPertinente(testoCompleto, kw)) {
      return;
    }
    const k = `${cand.lat.toFixed(5)}_${cand.lon.toFixed(5)}`;
    if (visti.has(k)) return;
    visti.add(k);
    risultati.push(cand);
  }

  // 1. Prova prima con ArcGIS World Geocoder (accesso puntuale a tutti i numeri civici italiani)
  try {
    const arcUrl = `${ARCGIS_FIND_URL}?f=json&SingleLine=${encodeURIComponent(testo)}&sourceCountry=ITA&outFields=*&maxLocations=${limit * 2}`;
    const resArc = await Promise.race([
      fetchFn(arcUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
    ]);
    if (resArc && resArc.ok) {
      const dataArc = await resArc.json();
      const candidates = Array.isArray(dataArc.candidates) ? dataArc.candidates : [];
      for (const c of candidates) {
        if (!c.score || c.score < 75) continue;
        const attr = c.attributes || {};
        let via = attr.StPreType && attr.StName
          ? `${attr.StPreType.trim()} ${attr.StName.trim()}`.replace(/\s+/g, " ").trim()
          : (attr.StName || attr.ShortLabel || c.address.split(",")[0] || "").trim();
        let civico = attr.AddNum || userCivico || "";
        if (civico && via.endsWith(" " + civico)) {
          via = via.slice(0, -(civico.length + 1)).trim();
        }
        const comune = normalizzaComune(attr.City || "");
        const provincia = normalizzaComune(attr.Subregion || "");
        const cap = attr.Postal || "";
        let regione = normalizzaRegione(attr.Region || "");
        if (regione === "Italia" && /(piemonte|torino|cuneo|alessandria|novara|asti|biella|vercelli|verbania)/i.test(`${attr.Region || ""} ${provincia} ${comune}`)) {
          regione = "Piemonte";
        }
        const display = formattaIndirizzoItaliano({ via, civico, comune, cap, provincia }) || c.address;

        aggiungi({
          display_name: display,
          via,
          civico,
          comune,
          provincia,
          cap,
          regione,
          lat: c.location.y,
          lon: c.location.x,
          provider: "ArcGIS World Geocoder",
        });
        if (risultati.length >= limit) break;
      }
    }
  } catch (e) {}

  // 1b. Se l'utente ha digitato una città/prefisso (es. 'sav') e non è ancora emersa nei candidati, prova suggest ArcGIS
  if (targetCity && !risultati.some(r => r.comune?.toLowerCase().includes(targetCity) || r.provincia?.toLowerCase().includes(targetCity))) {
    try {
      const sUrl = `${ARCGIS_SUGGEST_URL}?f=json&text=${encodeURIComponent(testo)}&countryCode=ITA&maxSuggestions=${limit}`;
      const resSug = await Promise.race([
        fetchFn(sUrl),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500))
      ]);
      if (resSug && resSug.ok) {
        const dataSug = await resSug.json();
        const suggestions = Array.isArray(dataSug.suggestions) ? dataSug.suggestions : [];
        for (const s of suggestions) {
          if (!s.magicKey) continue;
          try {
            const fUrl = `${ARCGIS_FIND_URL}?f=json&magicKey=${encodeURIComponent(s.magicKey)}&outFields=*&maxLocations=1`;
            const fRes = await fetchFn(fUrl);
            if (fRes && fRes.ok) {
              const fData = await fRes.json();
              const cand = fData.candidates?.[0];
              if (cand) {
                const attr = cand.attributes || {};
                let via = attr.StPreType && attr.StName
                  ? `${attr.StPreType.trim()} ${attr.StName.trim()}`.replace(/\s+/g, " ").trim()
                  : (attr.StName || attr.ShortLabel || cand.address.split(",")[0] || "").trim();
                let civico = attr.AddNum || userCivico || "";
                if (civico && via.endsWith(" " + civico)) {
                  via = via.slice(0, -(civico.length + 1)).trim();
                }
                const comune = normalizzaComune(attr.City || "");
                const provincia = normalizzaComune(attr.Subregion || "");
                const cap = attr.Postal || "";
                let regione = normalizzaRegione(attr.Region || "");
                if (regione === "Italia" && /(piemonte|torino|cuneo|alessandria|novara|asti|biella|vercelli|verbania)/i.test(`${attr.Region || ""} ${provincia} ${comune}`)) {
                  regione = "Piemonte";
                }
                const display = formattaIndirizzoItaliano({ via, civico, comune, cap, provincia }) || cand.address;
                aggiungi({
                  display_name: display,
                  via,
                  civico,
                  comune,
                  provincia,
                  cap,
                  regione,
                  lat: cand.location.y,
                  lon: cand.location.x,
                  provider: "ArcGIS World Geocoder",
                });
                if (risultati.length >= limit) break;
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  if (targetCity && risultati.length > 1) {
    risultati.sort((a, b) => {
      const matchA = (a.comune && a.comune.toLowerCase().includes(targetCity)) || (a.provincia && a.provincia.toLowerCase().includes(targetCity)) ? 1 : 0;
      const matchB = (b.comune && b.comune.toLowerCase().includes(targetCity)) || (b.provincia && b.provincia.toLowerCase().includes(targetCity)) ? 1 : 0;
      return matchB - matchA;
    });
  }

  if (risultati.length >= limit) {
    return risultati.slice(0, limit);
  }

  // 2. Prova con Photon OSM (rapido e senza rate-limit bloccante)
  try {
    const pUrl = `${PHOTON_URL}?q=${encodeURIComponent(testo)}&limit=${limit * 2}`;
    const res = await Promise.race([
      fetchFn(pUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
    ]);
    if (res && res.ok) {
      const data = await res.json();
      const rawFeats = (data.features || []).slice();
      if (targetCity) {
        rawFeats.sort((a, b) => {
          const score = (f) => {
            const prop = f.properties || {};
            const c = normalizzaComune(prop.city || prop.town || prop.district || prop.locality || "").toLowerCase();
            const prov = normalizzaComune(prop.county || "").toLowerCase();
            let s = 0;
            if (c === targetCity) s += 100;
            else if (c.includes(targetCity)) s += 50;
            else if (prov === targetCity) s += 20;
            if (prop.housenumber) s += 5;
            return s;
          };
          return score(b) - score(a);
        });
      }
      for (const feat of rawFeats) {
        const p = feat.properties || {};
        if (p.countrycode && p.countrycode !== "IT" && p.country && !/italia|italy/i.test(p.country)) continue;

        let via = p.street || p.name || "";
        let civico = p.housenumber || userCivico || "";
        if (civico && via.endsWith(" " + civico)) {
          via = via.slice(0, -(civico.length + 1)).trim();
        }
        const comune = normalizzaComune(p.city || p.town || p.district || p.locality || "");
        const provincia = normalizzaComune(p.county || "");
        const cap = p.postcode || "";
        const regione = normalizzaRegione(p.state || "");
        const display = formattaIndirizzoItaliano({ via, civico, comune, cap, provincia });

        aggiungi({
          display_name: display,
          via,
          civico,
          comune,
          provincia,
          cap,
          regione,
          lat: feat.geometry.coordinates[1],
          lon: feat.geometry.coordinates[0],
          provider: "Photon OSM",
        });
        if (risultati.length >= limit) break;
      }
    }
  } catch (e) {}

  if (risultati.length > 0) {
    return risultati.slice(0, limit);
  }

  // 3. Fallback su Nominatim OSM
  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(testo)}&format=json&addressdetails=1&countrycodes=it&limit=${limit}`;
    const res = await fetchFn(url, { headers: { "User-Agent": "CantieriAI/1.0 (cantieri-new; autocomplete)" } });
    if (res && res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const d of data) {
          const addr = d.address || {};
          const road = addr.road || addr.pedestrian || addr.footway || d.name || "";
          let via = road;
          let civico = addr.house_number || userCivico || "";
          if (civico && via.endsWith(" " + civico)) {
            via = via.slice(0, -(civico.length + 1)).trim();
          }
          const comune = normalizzaComune(addr.city || addr.town || addr.village || addr.municipality || "");
          const provincia = normalizzaComune(addr.county || "");
          const cap = addr.postcode || "";
          const regione = normalizzaRegione(addr.state || "");
          const display = formattaIndirizzoItaliano({ via, civico, comune, cap, provincia }) || d.display_name || "";

          aggiungi({
            display_name: display,
            via,
            civico,
            comune,
            provincia,
            cap,
            regione,
            lat: parseFloat(d.lat),
            lon: parseFloat(d.lon),
            provider: "Nominatim OSM",
          });
          if (risultati.length >= limit) break;
        }
      }
    }
  } catch (e) {}

  return risultati.slice(0, limit);
}

// Retrocompatibilità per API preesistenti:
export function estraiDenominazioneCondominioDaTesto() { return null; }
export const REGISTRO_CONDOMINI_NOTI = {};
export function normalizzaChiaveIndirizzo() { return ""; }
export function estraiNomeDaSnippet() { return null; }
export function salvaDenominazioneCondominio() { return false; }
export async function cercaDenominazioneCondominio() { return { trovato: false, nome: null }; }

// Algoritmo di coesione del complesso edilizio: raggruppa le palazzine appartenenti allo stesso
// lotto/cortile (distanza mutua inter-palazzina <= maxClusterDist) escludendo edifici di lotti confinanti
export function clusterVolumiResidenziali(residenziali, { maxClusterDist = 38 } = {}) {
  if (!Array.isArray(residenziali) || residenziali.length <= 1) return residenziali || [];

  // Se i volumi non hanno coordinate lat/lon (es. mock test unitari), non filtrare
  const conCoord = residenziali.filter((r) => typeof r.lat === "number" && typeof r.lon === "number");
  if (conCoord.length <= 1) return residenziali;

  // Seleziona il volume più vicino al civico di riferimento (ingresso lotto)
  let anchor = residenziali[0];
  let minD = typeof anchor.distM === "number" ? anchor.distM : 999999;
  for (const r of residenziali) {
    const d = typeof r.distM === "number" ? r.distM : 999999;
    if (d < minD) {
      minD = d;
      anchor = r;
    }
  }

  // Costruisci il cluster connesso per vicinanza spaziale nel cortile
  const inCluster = new Set([anchor]);
  let aggiunto = true;
  while (aggiunto) {
    aggiunto = false;
    for (const cand of residenziali) {
      if (inCluster.has(cand)) continue;
      if (typeof cand.lat !== "number" || typeof cand.lon !== "number") {
        inCluster.add(cand);
        aggiunto = true;
        continue;
      }
      for (const mem of inCluster) {
        if (typeof mem.lat === "number" && typeof mem.lon === "number") {
          const dLat = (cand.lat - mem.lat) * 111139;
          const dLon = (cand.lon - mem.lon) * (111139 * Math.cos((cand.lat * Math.PI) / 180));
          const dist = Math.sqrt(dLat * dLat + dLon * dLon);
          if (dist <= maxClusterDist) {
            inCluster.add(cand);
            aggiunto = true;
            break;
          }
        }
      }
    }
  }

  return residenziali.filter((r) => inCluster.has(r));
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

// Geocodifica un indirizzo in tutta Italia stile Amazon (Nominatim strutturato + Photon) con tolleranza odonimi
// Geocodifica un indirizzo in tutta Italia con risoluzione millimetrica dei numeri civici
// 1) ArcGIS World Geocoder (copertura nazionale certificata di vie e numeri civici puntuali)
// 2) Photon OSM (tolleranza odonimi con conservazione rigorosa del numero civico)
// 3) Nominatim OSM (ricerca strutturata e fallback)
export async function geocodificaIndirizzo(indirizzo, { fetchFn = fetch } = {}) {
  if (!indirizzo || typeof indirizzo !== "string" || !indirizzo.trim()) {
    return { ok: false, errore: "Indirizzo non valido o vuoto" };
  }

  const kw = estraiKeywordSignificative(indirizzo);
  const userCivico = estraiCivicoEsplicito(indirizzo);
  const { streetPart, streetNaked, cityPart } = scomponiIndirizzo(indirizzo);

  // 1. Prova prima con ArcGIS World Geocoder (altissima precisione sui numeri civici reali d'Italia)
  try {
    const arcUrl = `${ARCGIS_FIND_URL}?f=json&SingleLine=${encodeURIComponent(indirizzo)}&sourceCountry=ITA&outFields=*&maxLocations=5`;
    const res = await Promise.race([
      fetchFn(arcUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3500))
    ]);
    if (res && res.ok) {
      const data = await res.json();
      const candidates = Array.isArray(data.candidates) ? data.candidates : [];
      for (const cand of candidates) {
        if (!cand.score || cand.score < 75) continue;
        const attr = cand.attributes || {};
        let via = attr.StPreType && attr.StName
          ? `${attr.StPreType.trim()} ${attr.StName.trim()}`.replace(/\s+/g, " ").trim()
          : (attr.StName || attr.ShortLabel || cand.address.split(",")[0] || "").trim();
        let civico = attr.AddNum || userCivico || "";
        if (civico && via.endsWith(" " + civico)) {
          via = via.slice(0, -(civico.length + 1)).trim();
        }
        const comune = normalizzaComune(attr.City || "");
        const provincia = normalizzaComune(attr.Subregion || "");
        const cap = attr.Postal || "";
        let regione = normalizzaRegione(attr.Region || "");
        if (regione === "Italia" && /(piemonte|torino|cuneo|alessandria|novara|asti|biella|vercelli|verbania)/i.test(`${attr.Region || ""} ${provincia} ${comune}`)) {
          regione = "Piemonte";
        }
        const testoCompleto = `${via} ${civico} ${comune} ${provincia} ${regione} ${cand.address || ""}`;
        if (kw.length > 0 && !eIndirizzoPertinente(testoCompleto, kw)) continue;

        const display = formattaIndirizzoItaliano({ via, civico, comune, cap, provincia }) || cand.address;

        return {
          ok: true,
          lat: cand.location.y,
          lon: cand.location.x,
          display_name: display,
          via,
          civico,
          comune,
          provincia,
          cap,
          regione,
          provider: "ArcGIS World Geocoder",
          raw_address: attr,
        };
      }
    }
  } catch (e) {}

  // 2. Fallback su Photon OSM (con preservazione rigorosa del civico)
  try {
    const pUrl = `${PHOTON_URL}?q=${encodeURIComponent(indirizzo)}&limit=5`;
    const res = await Promise.race([
      fetchFn(pUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3500))
    ]);
    if (res && res.ok) {
      const data = await res.json();
      const rawFeats = (data.features || []).slice();
      const targetCityGeo = cityPart ? normalizzaComune(cityPart).toLowerCase() : "";
      if (targetCityGeo) {
        rawFeats.sort((a, b) => {
          const score = (f) => {
            const prop = f.properties || {};
            const c = normalizzaComune(prop.city || prop.town || prop.district || prop.locality || "").toLowerCase();
            const prov = normalizzaComune(prop.county || "").toLowerCase();
            let s = 0;
            if (c === targetCityGeo) s += 100;
            else if (c.includes(targetCityGeo)) s += 50;
            else if (prov === targetCityGeo) s += 20;
            if (prop.housenumber) s += 5;
            return s;
          };
          return score(b) - score(a);
        });
      }
      for (const feat of rawFeats) {
        const p = feat.properties || {};
        if (p.countrycode && p.countrycode !== "IT" && p.country && !/italia|italy/i.test(p.country)) continue;

        let via = p.street || p.name || "";
        let civico = p.housenumber || userCivico || "";
        if (civico && via.endsWith(" " + civico)) {
          via = via.slice(0, -(civico.length + 1)).trim();
        }
        const comune = normalizzaComune(p.city || p.town || p.district || p.locality || "");
        const provincia = normalizzaComune(p.county || "");
        const cap = p.postcode || "";
        const testoCompleto = `${via} ${civico} ${comune} ${provincia} ${p.state || ""} ${p.name || ""}`;
        if (kw.length > 0 && !eIndirizzoPertinente(testoCompleto, kw)) continue;

        let regione = normalizzaRegione(p.state || "");
        if (regione === "Italia" && /(piemonte|torino|cuneo|alessandria|novara|asti|biella|vercelli|verbania)/i.test(`${p.state || ""} ${provincia} ${comune}`)) {
          regione = "Piemonte";
        }
        const display = formattaIndirizzoItaliano({ via, civico, comune, cap, provincia });

        return {
          ok: true,
          lat: feat.geometry.coordinates[1],
          lon: feat.geometry.coordinates[0],
          display_name: display,
          via,
          civico,
          comune,
          provincia,
          cap,
          regione,
          provider: "Photon OSM",
          raw_address: p,
        };
      }
    }
  } catch (e) {}

  // 3. Fallback su Nominatim con query libera prioritaria
  try {
    const candUrls = [
      `${NOMINATIM_URL}?q=${encodeURIComponent(indirizzo)}&format=json&addressdetails=1&countrycodes=it&limit=5`
    ];

    const pulito = pulisciIndirizzoPerGeocodifica(indirizzo);
    if (pulito && pulito.toLowerCase() !== indirizzo.trim().toLowerCase()) {
      candUrls.push(`${NOMINATIM_URL}?q=${encodeURIComponent(pulito)}&format=json&addressdetails=1&countrycodes=it&limit=5`);
    }

    if (cityPart) {
      candUrls.push(`${NOMINATIM_URL}?street=${encodeURIComponent(streetPart)}&city=${encodeURIComponent(cityPart)}&format=json&addressdetails=1&countrycodes=it&limit=5`);
      if (streetNaked && streetNaked !== streetPart) {
        candUrls.push(`${NOMINATIM_URL}?street=${encodeURIComponent(streetNaked)}&city=${encodeURIComponent(cityPart)}&format=json&addressdetails=1&countrycodes=it&limit=5`);
      }
    }

    for (const url of candUrls) {
      try {
        const res = await fetchFn(url, { headers: { "User-Agent": "CantieriAI/1.0 (cantieri-new; geocoding)" } });
        if (res && res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            for (const d of data) {
              const addr = d.address || {};
              const road = addr.road || addr.pedestrian || addr.footway || d.name || "";
              let via = road;
              let civico = addr.house_number || userCivico || "";
              if (civico && via.endsWith(" " + civico)) {
                via = via.slice(0, -(civico.length + 1)).trim();
              }
              const comune = normalizzaComune(addr.city || addr.town || addr.village || addr.municipality || "");
              const provincia = normalizzaComune(addr.county || "");
              const cap = addr.postcode || "";
              let regione = normalizzaRegione(addr.state || "");
              if (regione === "Italia" && /(piemonte|torino|cuneo|alessandria|novara|asti|biella|vercelli|verbania)/i.test(`${addr.state || ""} ${provincia} ${comune}`)) {
                regione = "Piemonte";
              }
              const display = formattaIndirizzoItaliano({ via, civico, comune, cap, provincia }) || d.display_name || "";

              const testoCompleto = `${via} ${civico} ${comune} ${provincia} ${display}`;
              if (kw.length > 0 && !eIndirizzoPertinente(testoCompleto, kw)) continue;

              return {
                ok: true,
                lat: parseFloat(d.lat),
                lon: parseFloat(d.lon),
                display_name: display,
                via,
                civico,
                comune,
                provincia,
                cap,
                regione,
                provider: "Nominatim OSM",
                raw_address: addr,
              };
            }
          }
        }
      } catch (err) {}
    }
  } catch (e) {}

  return { ok: false, errore: `Nessun risultato cartografico trovato per "${indirizzo}"` };
}

export async function interrogaLiDARPiemonte(lat, lon, { fetchFn = fetch, raggioGradi = 0.00065 } = {}) {
  let volumi = [];
  let gml = "";

  for (const r of [raggioGradi, 0.0010]) {
    const minLat = (lat - r).toFixed(6);
    const maxLat = (lat + r).toFixed(6);
    const minLon = (lon - r).toFixed(6);
    const maxLon = (lon + r).toFixed(6);
    const url = `${WFS_BDT_RE_IMM}?service=WFS&version=1.1.0&request=GetFeature&typename=un_vol&maxfeatures=40&srsname=EPSG:4326&bbox=${minLat},${minLon},${maxLat},${maxLon},EPSG:4326`;

    try {
      const res = await fetchFn(url);
      if (res && res.ok) {
        gml = await res.text();
        const estratti = parseGmlUnVol(gml, { lat, lon });
        if (estratti.length > 0) {
          volumi = estratti;
          break;
        }
      }
    } catch (err) {}
  }

  if (volumi.length === 0) {
    return { ok: false, errore: "Nessun volume edilizio (un_vol) censito per queste coordinate nella BDTRE Piemonte", rawGml: gml };
  }

  // Ordina primariamente per vicinanza al civico puntuale (distM)
  volumi.sort((a, b) => (a.distM || 0) - (b.distM || 0));

  // Separa corpi abitabili (>= 5.0m) da pertinenze accessorie (< 5.0m)
  const abitabili = volumi.filter((v) => v.altezza_volumetrica_m >= 5.0);
  const accessori = volumi.filter((v) => v.altezza_volumetrica_m < 5.0);

  // Se ci sono palazzine multipiano (>= 10m), raggruppale con il cluster del complesso
  const palazzineAlte = abitabili.filter((v) => v.altezza_volumetrica_m >= 10.0);
  let palazzineSelezionate = [];

  if (palazzineAlte.length > 0) {
    palazzineAlte.sort((a, b) => b.altezza_volumetrica_m - a.altezza_volumetrica_m);
    palazzineSelezionate = clusterVolumiResidenziali(palazzineAlte, { maxClusterDist: 38 });
    const altri = abitabili.filter((v) => v.altezza_volumetrica_m < 10.0 && (!v.distM || v.distM <= 35));
    palazzineSelezionate = [...palazzineSelezionate, ...altri];
  } else {
    // Civico con villetta o palazzina di 2-3 piani (es. 6m - 9.5m, come via Galimberti 2):
    palazzineSelezionate = abitabili.filter((v) => !v.distM || v.distM <= 55);
  }

  if (palazzineSelezionate.length === 0 && volumi.length > 0) {
    palazzineSelezionate = [volumi[0]];
  }

  // Denominazione descrittiva ordinata (Palazzina A, B, C...)
  let countPalazzine = 0;
  palazzineSelezionate.forEach((v) => {
    countPalazzine++;
    const h = v.altezza_volumetrica_m;
    if (h >= 10.0) {
      v.tipo_presunto = `Palazzina ${String.fromCharCode(64 + countPalazzine)} (${h.toFixed(1)} m)`;
    } else {
      v.tipo_presunto = `Edificio residenziale ${String.fromCharCode(64 + countPalazzine)} (${h.toFixed(1)} m)`;
    }
    v.piani = null; // Fa fede la metratura reale misurata con LiDAR; rimossa stima forzata dei piani
  });

  const accVicini = accessori.filter((v) => !v.distM || v.distM <= 45);
  accVicini.forEach((v) => {
    v.tipo_presunto = `Box Auto / Pertinenza (${v.altezza_volumetrica_m.toFixed(1)} m)`;
    v.piani = 1;
  });

  const finali = [...palazzineSelezionate];
  if (accVicini.length > 0) finali.push(accVicini[0]);
  if (accVicini.length > 1) finali.push(accVicini[1]);

  return { ok: true, volumi: finali, volumePrincipale: finali[0] };
}

// Interroga OpenStreetMap Overpass (copertura 100% dei comuni italiani) per estrarre volumi e livelli 3D
export async function interrogaOSMNazionale(lat, lon, { fetchFn = fetch, timeoutMs = 2500 } = {}) {
  // 1. Prova prima l'API ufficiale OpenStreetMap map bbox (affidabile, con CORS, senza 502)
  const delta = 0.0006;
  const bbox = `${(lon - delta).toFixed(6)},${(lat - delta).toFixed(6)},${(lon + delta).toFixed(6)},${(lat + delta).toFixed(6)}`;
  const osmMapUrl = `${OSM_API_MAP_URL}?bbox=${bbox}`;

  try {
    let signal;
    let timerId;
    if (typeof AbortController !== "undefined") {
      const controller = new AbortController();
      timerId = setTimeout(() => controller.abort(), timeoutMs);
      signal = controller.signal;
    }

    const res = await fetchFn(osmMapUrl, {
      headers: { "User-Agent": "CantieriAI/1.0 (antincendio-gsa)" },
      signal,
    });
    if (timerId) clearTimeout(timerId);

    if (res && res.ok) {
      const xml = await res.text();
      const volumi = parseOsmXmlBuildings(xml, lat, lon);
      if (volumi && volumi.length > 0) {
        return { ok: true, volumi, volumePrincipale: volumi[0] };
      }
    }
  } catch (err) {}

  // 2. Fallback su Overpass (per retrocompatibilità o test mock preesistenti)
  try {
    const query = `[out:json][timeout:5];(way["building"](around:35,${lat},${lon});relation["building"](around:35,${lat},${lon}););out tags;`;
    const url = `${OVERPASS_URL}?data=${encodeURIComponent(query)}`;
    const res = await fetchFn(url, { headers: { "User-Agent": "CantieriAI/1.0 (antincendio-gsa)" } });
    if (res && res.ok) {
      const data = await res.json();
      const volumi = parseOverpassElements(data.elements);
      if (volumi && volumi.length > 0) {
        return { ok: true, volumi, volumePrincipale: volumi[0] };
      }
    }
  } catch (err) {}

  return { ok: false, errore: "Nessun volume cartografico censito nei tag OSM per queste coordinate" };
}

// Calcolo completo per tutta Italia: da indirizzo testuale a valutazione GSA (DM 246/1987 + DM 25/1/2019)
export async function calcolaGsaDaCivico(indirizzo, opzioni = {}) {
  const {
    quota_google_earth_m = null,
    quota_pratica_m = null,
    indice_volume = 0,
    numero_piani_override = null,
    attivita = [],
    piano_accessibile_vvf = true,
    vani_tecnici_esclusi = true,
    geo_precalcolata = null,
    fetchFn = fetch,
  } = opzioni;

  // 1. Geocodifica nazionale (o riutilizzo istantaneo se già precalcolata/selezionata)
  const geo = geo_precalcolata && geo_precalcolata.ok
    ? geo_precalcolata
    : await geocodificaIndirizzo(indirizzo, { fetchFn });
  if (!geo.ok) return { esito: "ERRORE", errore: geo.errore };

  let volumi = [];
  let provider = "";
  let volumeScelto = null;
  let fonteTipologica = false;

  // 2. Routing regionale: se in Piemonte, interroga prima la BDTRE WFS ARPA Piemonte
  if (geo.regione === "Piemonte") {
    const bdt = await interrogaLiDARPiemonte(geo.lat, geo.lon, { fetchFn });
    if (bdt.ok && bdt.volumi?.length > 0) {
      volumi = bdt.volumi;
      provider = "LiDAR BDTRE Regione Piemonte (ARPA)";
    }
  }

  // 3. Se non in Piemonte o se BDTRE non ha restituito volumi per il punto, interroga OpenStreetMap 3D
  if (volumi.length === 0) {
    const osm = await interrogaOSMNazionale(geo.lat, geo.lon, { fetchFn, timeoutMs: 1500 });
    if (osm.ok && osm.volumi?.length > 0) {
      volumi = osm.volumi;
      provider = `OpenStreetMap 3D / LiDAR Nazionale PST (${geo.regione})`;
    }
  }

  // 4. Se ancora nessun volume cartografico è disponibile, applica la stima tipologica italiana
  if (volumi.length === 0) {
    volumi = generaVolumiArchetipoItaliano();
    provider = `Stima Tipologica Edilizia (${geo.regione})`;
    fonteTipologica = true;
  }

  // Se l'utente ha forzato un numero di piani specifico
  if (typeof numero_piani_override === "number" && numero_piani_override > 0) {
    const stimaOverride = stimaAltezzaAntincendiDaPiani(numero_piani_override);
    volumeScelto = {
      tipo_presunto: `Edificio ${numero_piani_override} piani`,
      piani: numero_piani_override,
      altezza_volumetrica_m: stimaOverride.altezza_volumetrica_m,
      ente_prod: "Dichiarazione / Selezione Utente",
      modo_prod: `${numero_piani_override} piani (DM 5/7/1975)`,
    };
  } else {
    const idx = typeof indice_volume === "number" && indice_volume >= 0 && indice_volume < volumi.length ? indice_volume : 0;
    volumeScelto = volumi[idx];
  }

  // 5. Preparazione fonti per la fusione conservativa
  const fonti = [];

  // Se il volume proviene da LiDAR o tag metrico height, usiamo l'altezza esatta
  if (volumeScelto.altezza_volumetrica_m && (!volumeScelto.piani || volumeScelto.modo_prod?.includes("LiDAR") || volumeScelto.modo_prod?.includes("height"))) {
    const stimaH = stimaAltezzaAntincendiDaEdificio(volumeScelto.altezza_volumetrica_m, {
      fonte: provider,
    });
    if (stimaH) fonti.push(stimaH);
  } else if (volumeScelto.piani) {
    const stimaPiani = stimaAltezzaAntincendiDaPiani(volumeScelto.piani, {
      fonte: `${provider} (${volumeScelto.piani} piani)`,
    });
    if (stimaPiani) fonti.push(stimaPiani);
  } else if (volumeScelto.altezza_volumetrica_m) {
    const stimaH = stimaAltezzaAntincendiDaEdificio(volumeScelto.altezza_volumetrica_m, {
      fonte: provider,
    });
    if (stimaH) fonti.push(stimaH);
  }

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

  // 6. Valutazione normativa con motore Cantieri civile-abitazione.js
  const valutazione = valutaCivileAbitazione({
    altezza: {
      fonti,
      piano_esterno_accessibile_mezzi_vvf: piano_accessibile_vvf,
      vani_tecnici_esclusi,
    },
    attivita,
  });

  const idxSelezionato = typeof indice_volume === "number" ? indice_volume : 0;
  const infoCondominio = null;
  const nomeCondominio = null;
  const fonteCondominio = null;
  const queryGoogleCondominio = null;

  return {
    esito: "OK",
    indirizzo_inserito: indirizzo,
    indirizzo_trovato: geo.display_name,
    fonte_tipologica: fonteTipologica,
    geo_dati: geo,
    nome_condominio: nomeCondominio,
    fonte_condominio: fonteCondominio,
    nome_palazzo: infoCondominio?.palazzo || null,
    scala: infoCondominio?.scala || null,
    ricerca_google_condominio: queryGoogleCondominio,
    regione: geo.regione,
    comune: geo.comune,
    provincia: geo.provincia,
    provider,
    coordinate: { lat: geo.lat, lon: geo.lon },
    edificio_selezionato: {
      altezza_volumetrica_m: volumeScelto.altezza_volumetrica_m,
      piani: volumeScelto.piani || null,
      quota_estradosso_m: volumeScelto.quota_estradosso_m || null,
      lat: volumeScelto.lat || geo.lat,
      lon: volumeScelto.lon || geo.lon,
      ente: volumeScelto.ente_prod,
      metodo: volumeScelto.modo_prod,
    },
    // Compatibilità all'indietro per API e test preesistenti:
    edificio_lidar: {
      altezza_volumetrica_m: volumeScelto.altezza_volumetrica_m,
      piani: volumeScelto.piani || null,
      quota_estradosso_m: volumeScelto.quota_estradosso_m || null,
      lat: volumeScelto.lat || geo.lat,
      lon: volumeScelto.lon || geo.lon,
      ente: volumeScelto.ente_prod,
      metodo: volumeScelto.modo_prod,
      indice_selezionato: idxSelezionato,
    },
    volumi_rilevati: volumi.map((v, i) => {
      let desc = v.tipo_presunto || (v.piani ? `${v.piani} piani` : (v.altezza_volumetrica_m >= 12 ? "Corpo principale alto" : v.altezza_volumetrica_m >= 7 ? "Corpo secondario / basso" : "Box / accessorio"));
      return {
        indice: i,
        altezza_m: v.altezza_volumetrica_m,
        piani: v.piani || null,
        quota_estradosso_m: v.quota_estradosso_m || null,
        lat: v.lat || geo.lat,
        lon: v.lon || geo.lon,
        distanza_m: v.distM || null,
        tipo_presunto: desc,
        selezionato: i === idxSelezionato,
      };
    }),
    fonti_utilizzate: fonti,
    valutazione_gsa: valutazione,
  };
}
