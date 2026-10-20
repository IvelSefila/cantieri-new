// Altimetria e GSA automatico da civico / indirizzo per tutte le 20 Regioni d'Italia.
// - Piemonte: interroga i servizi aperti ufficiali WFS della BDTRE Piemonte (CSI / ARPA Piemonte, LiDAR DSM-DTM).
// - Tutte le altre regioni: interroga i dati 3D aperti OpenStreetMap (tag height e building:levels) con fallback
//   su modello parametrico edilizio italiano (DM 5/7/1975) e fusione con Google Earth 3D o pratiche edilizie.
// Valutazione normativa 100% pura nel browser secondo civile-abitazione.js (DM 246/1987 + DM 25/1/2019).

import { valutaCivileAbitazione } from "./civile-abitazione.js";

const WFS_BDT_RE_IMM = "https://geoservices.csi.it/ms/wfs/taims/rp-01/taimswfs/bdtre_imm";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const PHOTON_URL = "https://photon.komoot.io/api/";
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Registro canonico delle 20 Regioni d'Italia (con varianti bilingue / dialettali)
export const REGIONI_ITALIANE = {
  "abruzzo": "Abruzzo",
  "basilicata": "Basilicata",
  "calabria": "Calabria",
  "campania": "Campania",
  "emilia-romagna": "Emilia-Romagna",
  "friuli-venezia giulia": "Friuli-Venezia Giulia",
  "lazio": "Lazio",
  "liguria": "Liguria",
  "lombardia": "Lombardia",
  "marche": "Marche",
  "molise": "Molise",
  "piemonte": "Piemonte",
  "puglia": "Puglia",
  "sardegna": "Sardegna",
  "sardigna": "Sardegna",
  "sardinia": "Sardegna",
  "sicilia": "Sicilia",
  "sicily": "Sicilia",
  "toscana": "Toscana",
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
  return str.trim();
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
        piani: piani || (altezzaM ? Math.max(1, Math.round((altezzaM - 1.20) / 3.05)) : null),
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
  const parti = [];
  if (via) {
    parti.push(civico ? `${via}, ${civico}` : via);
  }
  let loc = [cap, comune].filter(Boolean).join(" ");
  if (provincia && provincia.toLowerCase() !== comune.toLowerCase()) {
    loc = loc ? `${loc} (${provincia})` : `(${provincia})`;
  }
  if (loc) {
    parti.push(loc);
  }
  return parti.join(", ") || via || comune || "";
}

const STOPWORDS_INDIRIZZO = new Set([
  "via", "viale", "corso", "strada", "piazza", "piazzale", "largo", "vicolo", "borgo", "stradello", "contrada",
  "di", "del", "della", "dello", "dei", "degli", "delle", "da", "in", "con", "su", "per", "tra", "fra",
  "il", "la", "le", "lo", "i", "gli", "un", "una", "uno", "al", "allo", "alla", "ai", "agli", "alle",
  "n", "n.", "num", "num.", "civico", "civ"
]);

export function estraiKeywordSignificative(testo) {
  if (!testo || typeof testo !== "string") return [];
  return testo
    .toLowerCase()
    .replace(/[^a-z0-9à-ú\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS_INDIRIZZO.has(w) && !/^\d+$/.test(w));
}

export function eIndirizzoPertinente(nomeRisultato, keywords) {
  if (!keywords || keywords.length === 0) return true;
  const nom = (nomeRisultato || "").toLowerCase();
  return keywords.some((k) => nom.includes(k));
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
export async function autocompletaIndirizzo(testo, { fetchFn = fetch, limit = 5 } = {}) {
  if (!testo || typeof testo !== "string" || testo.trim().length < 3) {
    return [];
  }

  const kw = estraiKeywordSignificative(testo);
  const { streetPart, streetNaked, cityPart, varianti } = scomponiIndirizzo(testo);
  const risultati = [];
  const visti = new Set();

  function aggiungi(cand) {
    if (!cand || typeof cand.lat !== "number" || typeof cand.lon !== "number") return;
    const road = cand.via || cand.display_name || "";
    // Filtro pertinenza: scarta se la via trovata non contiene i termini cercati (es. 'Via Mellea' per 'suniglia')
    if (kw.length > 0 && !eIndirizzoPertinente(road, kw)) {
      return;
    }
    const k = `${cand.lat.toFixed(5)}_${cand.lon.toFixed(5)}`;
    if (visti.has(k)) return;
    visti.add(k);
    risultati.push(cand);
  }

  // 1. Prova prima con Photon se risponde (timeout brevissimo per non bloccare)
  try {
    const pUrl = `${PHOTON_URL}?q=${encodeURIComponent(testo)}&limit=${limit * 2}`;
    const res = await Promise.race([
      fetchFn(pUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 800))
    ]);
    if (res && res.ok) {
      const data = await res.json();
      for (const feat of (data.features || [])) {
        const p = feat.properties || {};
        if (p.countrycode && p.countrycode !== "IT") continue;

        const via = p.street || p.name || "";
        if (kw.length > 0 && !eIndirizzoPertinente(via, kw)) continue;

        const civico = p.housenumber || "";
        const comune = p.city || p.town || p.district || p.locality || "";
        const provincia = p.county || "";
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

  // 2. Nominatim con interrogazioni strutturate (tolleranza odonimi via/strada/corso)
  if (risultati.length < limit) {
    const candUrls = [];
    if (cityPart) {
      candUrls.push(`${NOMINATIM_URL}?street=${encodeURIComponent(streetNaked)}&city=${encodeURIComponent(cityPart)}&format=json&addressdetails=1&countrycodes=it&limit=${limit}`);
      candUrls.push(`${NOMINATIM_URL}?street=${encodeURIComponent(streetPart)}&city=${encodeURIComponent(cityPart)}&format=json&addressdetails=1&countrycodes=it&limit=${limit}`);
    }
    for (const v of varianti) {
      candUrls.push(`${NOMINATIM_URL}?street=${encodeURIComponent(v)}&format=json&addressdetails=1&countrycodes=it&limit=${limit}`);
    }
    candUrls.push(`${NOMINATIM_URL}?q=${encodeURIComponent(testo)}&format=json&addressdetails=1&countrycodes=it&limit=${limit}`);

    for (const url of candUrls) {
      try {
        const res = await fetchFn(url, { headers: { "User-Agent": "CantieriAI/1.0 (cantieri-new; autocomplete)" } });
        if (res && res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            for (const d of data) {
              const addr = d.address || {};
              const road = addr.road || addr.pedestrian || addr.footway || d.name || "";
              const displayRaw = d.display_name || "";
              if (kw.length > 0 && !eIndirizzoPertinente(road || displayRaw, kw)) {
                continue;
              }

              const via = road || streetPart;
              const civico = addr.house_number || "";
              const comune = addr.city || addr.town || addr.village || addr.municipality || "";
              const provincia = addr.county || "";
              const cap = addr.postcode || "";
              const regione = normalizzaRegione(addr.state || "");
              const display = formattaIndirizzoItaliano({ via, civico, comune, cap, provincia }) || displayRaw;

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
      if (risultati.length >= limit) break;
    }
  }

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
export async function geocodificaIndirizzo(indirizzo, { fetchFn = fetch } = {}) {
  if (!indirizzo || typeof indirizzo !== "string" || !indirizzo.trim()) {
    return { ok: false, errore: "Indirizzo non valido o vuoto" };
  }

  const kw = estraiKeywordSignificative(indirizzo);
  const { streetPart, streetNaked, cityPart, varianti } = scomponiIndirizzo(indirizzo);

  // 1. Prova prima con Photon se attivo
  try {
    const pUrl = `${PHOTON_URL}?q=${encodeURIComponent(indirizzo)}&limit=5`;
    const res = await Promise.race([
      fetchFn(pUrl),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 800))
    ]);
    if (res && res.ok) {
      const data = await res.json();
      for (const feat of (data.features || [])) {
        const p = feat.properties || {};
        if (p.countrycode && p.countrycode !== "IT") continue;

        const via = p.street || p.name || "";
        if (kw.length > 0 && !eIndirizzoPertinente(via, kw)) continue;

        const civico = p.housenumber || "";
        const comune = p.city || p.town || p.district || p.locality || "";
        const provincia = p.county || "";
        const cap = p.postcode || "";
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
          regione,
          provider: "Photon OSM",
          raw_address: p,
        };
      }
    }
  } catch (e) {}

  // 2. Fallback su Nominatim con ricerche strutturate e libere
  try {
    const candUrls = [];
    if (cityPart) {
      candUrls.push(`${NOMINATIM_URL}?street=${encodeURIComponent(streetNaked)}&city=${encodeURIComponent(cityPart)}&format=json&addressdetails=1&countrycodes=it&limit=5`);
      candUrls.push(`${NOMINATIM_URL}?street=${encodeURIComponent(streetPart)}&city=${encodeURIComponent(cityPart)}&format=json&addressdetails=1&countrycodes=it&limit=5`);
    }
    for (const v of varianti) {
      candUrls.push(`${NOMINATIM_URL}?street=${encodeURIComponent(v)}&format=json&addressdetails=1&countrycodes=it&limit=5`);
    }
    candUrls.push(`${NOMINATIM_URL}?q=${encodeURIComponent(indirizzo)}&format=json&addressdetails=1&countrycodes=it&limit=5`);

    const pulito = pulisciIndirizzoPerGeocodifica(indirizzo);
    if (pulito && pulito.toLowerCase() !== indirizzo.trim().toLowerCase()) {
      candUrls.push(`${NOMINATIM_URL}?q=${encodeURIComponent(pulito)}&format=json&addressdetails=1&countrycodes=it&limit=5`);
    }

    for (const url of candUrls) {
      try {
        const res = await fetchFn(url, { headers: { "User-Agent": "CantieriAI/1.0 (cantieri-new; antincendio-gsa)" } });
        if (!res || !res.ok) continue;
        const dati = await res.json();
        if (!Array.isArray(dati) || dati.length === 0) continue;

        for (const primo of dati) {
          const addr = primo.address || {};
          const road = addr.road || addr.pedestrian || addr.footway || primo.name || "";
          const displayRaw = primo.display_name || "";

          // Filtro pertinenza obbligatorio
          if (kw.length > 0 && !eIndirizzoPertinente(road || displayRaw, kw)) {
            continue;
          }

          const regioneGrezza = addr.state || addr.region || "";
          let regione = normalizzaRegione(regioneGrezza);
          if (regione === "Italia" && /(piemonte|torino|cuneo|alessandria|novara|asti|biella|vercelli|verbania)/i.test(displayRaw || indirizzo)) {
            regione = "Piemonte";
          }

          const comune = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || "";
          const provincia = addr.county || addr["ISO3166-2-lvl6"] || "";
          const via = road || streetPart;
          const civico = addr.house_number || "";

          return {
            ok: true,
            lat: parseFloat(primo.lat),
            lon: parseFloat(primo.lon),
            display_name: formattaIndirizzoItaliano({ via, civico, comune, cap: addr.postcode, provincia }) || displayRaw,
            via,
            civico,
            regione,
            comune,
            provincia,
            provider: "Nominatim OSM",
            raw_address: addr,
          };
        }
      } catch (e) {}
    }

    return { ok: false, errore: `Nessun risultato cartografico trovato per '${indirizzo}' in Italia` };
  } catch (err) {
    return { ok: false, errore: `Impossibile contattare il servizio geocodifica: ${err.message}` };
  }
}

// Interroga il servizio WFS BDTRE della Regione Piemonte per un punto lat/lon
export async function interrogaLiDARPiemonte(lat, lon, { fetchFn = fetch, raggioGradi = 0.0006 } = {}) {
  const minLat = (lat - raggioGradi).toFixed(6);
  const maxLat = (lat + raggioGradi).toFixed(6);
  const minLon = (lon - raggioGradi).toFixed(6);
  const maxLon = (lon + raggioGradi).toFixed(6);

  const url = `${WFS_BDT_RE_IMM}?service=WFS&version=1.1.0&request=GetFeature&typename=un_vol&maxfeatures=25&srsname=EPSG:4326&bbox=${minLat},${minLon},${maxLat},${maxLon},EPSG:4326`;

  try {
    const res = await fetchFn(url);
    if (!res.ok) return { ok: false, errore: `Errore WFS BDTRE HTTP ${res.status}` };
    const gml = await res.text();
    let volumi = parseGmlUnVol(gml, { lat, lon });
    if (volumi.length === 0) {
      return { ok: false, errore: "Nessun volume edilizio (un_vol) censito per queste coordinate nella BDTRE Piemonte", rawGml: gml };
    }

    // Filtra per pertinenza entro 62 m dal civico (cattura palazzine arretrate ed esclude lotti distanti)
    const pertinenti = volumi.filter((v) => !v.distM || v.distM <= 62);
    if (pertinenti.length > 0) {
      volumi = pertinenti;
    }

    // Ordina per altezza decrescente (palazzine principali in testa)
    volumi.sort((a, b) => b.altezza_volumetrica_m - a.altezza_volumetrica_m);

    // Mantieni solo le palazzine distinte (≥10 m) appartenenti al cluster coeso del complesso
    const palazzineGrezze = volumi.filter((v) => v.altezza_volumetrica_m >= 10);
    const palazzine = clusterVolumiResidenziali(palazzineGrezze, { maxClusterDist: 38 });

    // Assegna tipo presunto e denominazione descrittiva ordinata (Palazzina A, B, C...)
    let countPalazzine = 0;
    palazzine.forEach((v) => {
      countPalazzine++;
      const h = v.altezza_volumetrica_m;
      const pianiStimati = Math.max(3, Math.round((h - 1.2) / 3.05));
      v.tipo_presunto = `Palazzina ${String.fromCharCode(64 + countPalazzine)} (${h.toFixed(1)} m, ~${pianiStimati} piani)`;
      v.piani = pianiStimati;
    });

    const pertinenze = volumi.filter((v) => v.altezza_volumetrica_m >= 5 && v.altezza_volumetrica_m < 10);
    pertinenze.forEach((v) => {
      v.tipo_presunto = `Fabbricato Basso / Pertinenza (${v.altezza_volumetrica_m.toFixed(1)} m)`;
      v.piani = 2;
    });

    const box = volumi.filter((v) => v.altezza_volumetrica_m < 5);
    box.forEach((v) => {
      v.tipo_presunto = `Box Auto / Accessorio (${v.altezza_volumetrica_m.toFixed(1)} m)`;
      v.piani = 1;
    });

    const compatti = [...palazzine];
    if (pertinenze.length > 0) compatti.push(pertinenze[0]);
    if (box.length > 0) compatti.push(box[0]);
    volumi = compatti;

    return { ok: true, volumi, volumePrincipale: volumi[0] };
  } catch (err) {
    return { ok: false, errore: `Impossibile interrogare il geoportale Piemonte: ${err.message}` };
  }
}

// Interroga OpenStreetMap Overpass (copertura 100% dei comuni italiani) per estrarre volumi e livelli 3D
export async function interrogaOSMNazionale(lat, lon, { fetchFn = fetch, timeoutMs = 2500 } = {}) {
  const query = `[out:json][timeout:5];(way["building"](around:35,${lat},${lon});relation["building"](around:35,${lat},${lon}););out tags;`;
  const url = `${OVERPASS_URL}?data=${encodeURIComponent(query)}`;

  try {
    let signal;
    let timerId;
    if (typeof AbortController !== "undefined") {
      const controller = new AbortController();
      timerId = setTimeout(() => controller.abort(), timeoutMs);
      signal = controller.signal;
    }

    const res = await fetchFn(url, {
      headers: { "User-Agent": "CantieriAI/1.0 (antincendio-gsa)" },
      signal,
    });
    if (timerId) clearTimeout(timerId);

    if (!res.ok) {
      return { ok: false, errore: `Overpass HTTP ${res.status}` };
    }
    const data = await res.json();
    const volumi = parseOverpassElements(data.elements);
    if (!volumi.length) {
      return { ok: false, errore: "Nessun volume o livello censito nei tag OSM per queste coordinate" };
    }
    return { ok: true, volumi, volumePrincipale: volumi[0] };
  } catch (err) {
    return { ok: false, errore: `OSM Overpass non disponibile: ${err.message}` };
  }
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
    fetchFn = fetch,
  } = opzioni;

  // 1. Geocodifica nazionale
  const geo = await geocodificaIndirizzo(indirizzo, { fetchFn });
  if (!geo.ok) return { esito: "ERRORE", errore: geo.errore };

  let volumi = [];
  let provider = "";
  let volumeScelto = null;

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
    const osm = await interrogaOSMNazionale(geo.lat, geo.lon, { fetchFn, timeoutMs: 2500 });
    if (osm.ok && osm.volumi?.length > 0) {
      volumi = osm.volumi;
      provider = "OpenStreetMap 3D / Catasto Volumetrico";
    }
  }

  // 4. Se ancora nessun volume cartografico è disponibile, applica la stima tipologica italiana
  if (volumi.length === 0) {
    volumi = generaVolumiArchetipoItaliano();
    provider = `Stima Tipologica Edilizia (${geo.regione})`;
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
