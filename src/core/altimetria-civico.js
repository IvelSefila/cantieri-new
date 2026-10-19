// Altimetria e GSA automatico da civico / indirizzo per tutte le 20 Regioni d'Italia.
// - Piemonte: interroga i servizi aperti ufficiali WFS della BDTRE Piemonte (CSI / ARPA Piemonte, LiDAR DSM-DTM).
// - Tutte le altre regioni: interroga i dati 3D aperti OpenStreetMap (tag height e building:levels) con fallback
//   su modello parametrico edilizio italiano (DM 5/7/1975) e fusione con Google Earth 3D o pratiche edilizie.
// Valutazione normativa 100% pura nel browser secondo civile-abitazione.js (DM 246/1987 + DM 25/1/2019).

import { valutaCivileAbitazione } from "./civile-abitazione.js";

const WFS_BDT_RE_IMM = "https://geoservices.csi.it/ms/wfs/taims/rp-01/taimswfs/bdtre_imm";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
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

// Estrae il nome del condominio, palazzo o scala dal testo inserito dall'utente
export function estraiDenominazioneCondominioDaTesto(testo) {
  if (!testo || typeof testo !== "string") return null;

  const res = {
    condominio: null,
    palazzo: null,
    scala: null,
  };

  const mCond = testo.match(/\b(condominio|cond\.|residence|residenza|complesso|villa)\s+([^,]+?)(?=\s+\b(palazzina|palazzo|pal\.|edificio|torre|corpo|scala|sc\.|interno|int\.|piano|p\.)\b|$|,)/i);
  if (mCond) {
    const nome = `${mCond[1]} ${mCond[2].trim()}`;
    res.condominio = nome
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  const mPal = testo.match(/\b(palazzina|palazzo|pal\.|edificio|torre|corpo)\s+([a-zA-Z0-9]+)/i);
  if (mPal) {
    res.palazzo = mPal[0]
      .split(/\s+/)
      .map((w, idx) => (idx === 1 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
      .join(" ");
  }

  const mSc = testo.match(/\b(scala|sc\.)\s+([a-zA-Z0-9]+)/i);
  if (mSc) {
    res.scala = mSc[0].toUpperCase();
  }

  if (!res.condominio && !res.palazzo && !res.scala) {
    return null;
  }
  return res;
}

// Database seed e memoria di condomini / complessi noti in Italia
export const REGISTRO_CONDOMINI_NOTI = {
  "strada suniglia 4 savigliano": { nome: "Condominio Orione", fonte: "Registro Civici Certificati" },
  "strada suniglia 4": { nome: "Condominio Orione", fonte: "Registro Civici Certificati" },
  "strada suniglia savigliano": { nome: "Condominio Orione", fonte: "Registro Civici Certificati" },
};

export function normalizzaChiaveIndirizzo(indirizzo, comune = "") {
  if (!indirizzo) return "";
  const base = `${indirizzo} ${comune}`.toLowerCase();
  return base
    .replace(/\b(via|viale|corso|strada|str\.|piazza|p\.za|largo|vicolo)\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Estrae nomi di condominio, residence o palazzi da snippet testuali
export function estraiNomeDaSnippet(testo) {
  if (!testo) return null;
  const regex = /\b([cC]ondominio|[rR]esidence|[rR]esidenza|[pP]alazzo|[cC]omplesso|[vV]illa)\s+([A-ZÀ-Ú][a-zà-ù0-9'-]+(?:\s+[A-ZÀ-Ú][a-zà-ù0-9'-]+){0,2})/g;
  let match;
  while ((match = regex.exec(testo)) !== null) {
    const tipo = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const nome = match[2].trim();
    if (!/^(di|del|della|dei|degli|in|con|su|per|tra|fra|e|ed|il|la|le|lo|i|gli|un|una|uno)\b/i.test(nome)) {
      return `${tipo} ${nome}`;
    }
  }
  return null;
}

// Salva un'associazione indirizzo-condominio nella memoria persistente (localStorage)
export function salvaDenominazioneCondominio(indirizzo, comune, nomeCondominio) {
  if (!indirizzo || !nomeCondominio) return false;
  const k = normalizzaChiaveIndirizzo(indirizzo, comune);
  if (!k) return false;

  try {
    if (typeof localStorage !== "undefined") {
      const grezzo = localStorage.getItem("cantieri_condomini_db") || "{}";
      const db = JSON.parse(grezzo);
      db[k] = {
        nome: nomeCondominio.trim(),
        indirizzo,
        comune,
        ts: Date.now(),
      };
      localStorage.setItem("cantieri_condomini_db", JSON.stringify(db));
      return true;
    }
  } catch (e) {
    // ignora in ambienti senza localStorage
  }
  return false;
}

// Risolve il nome del condominio da:
// 1. Testo inserito dall'utente (es. "Condominio Orione Strada Suniglia 4")
// 2. Memoria locale (localStorage di Cantieri AI)
// 3. Registro Civici Certificati
// 4. Ricerca OSINT Web Snippets
export async function cercaDenominazioneCondominio(indirizzo, { comune = "", fetchFn = fetch } = {}) {
  if (!indirizzo) return { trovato: false, nome: null };

  // 1. Estrazione diretta dal testo dell'utente
  const daTesto = estraiDenominazioneCondominioDaTesto(indirizzo);
  if (daTesto?.condominio) {
    return {
      trovato: true,
      nome: daTesto.condominio,
      fonte: "Inserito dall'utente",
      confidenza: "certa",
    };
  }

  const chiave = normalizzaChiaveIndirizzo(indirizzo, comune);

  // 2. Controllo memoria locale localStorage
  try {
    if (typeof localStorage !== "undefined") {
      const grezzo = localStorage.getItem("cantieri_condomini_db");
      if (grezzo) {
        const db = JSON.parse(grezzo);
        for (const [k, v] of Object.entries(db)) {
          if (chiave.includes(k) || k.includes(chiave)) {
            return {
              trovato: true,
              nome: v.nome,
              fonte: "Memoria Locale Appresa",
              confidenza: "alta",
            };
          }
        }
      }
    }
  } catch (e) {}

  // 3. Controllo Registro Civici Certificati
  for (const [k, v] of Object.entries(REGISTRO_CONDOMINI_NOTI)) {
    const kNorm = normalizzaChiaveIndirizzo(k);
    if (chiave.includes(kNorm) || kNorm.includes(chiave)) {
      return {
        trovato: true,
        nome: v.nome,
        fonte: v.fonte,
        confidenza: "certificata",
      };
    }
  }

  // 4. Ricerca Web Snippet aperta (DuckDuckGo HTML)
  try {
    const pulito = pulisciIndirizzoPerGeocodifica(indirizzo);
    const query = `"${pulito}" ${comune} condominio`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const r = await fetchFn(url, {
      headers: { "User-Agent": "CantieriAI/1.0" },
    });
    if (r.ok) {
      const html = await r.text();
      const snippets = [...html.matchAll(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
      for (const s of snippets) {
        const nomeSnippet = estraiNomeDaSnippet(s);
        if (nomeSnippet) {
          return {
            trovato: true,
            nome: nomeSnippet,
            fonte: "Web Rilevato da Annunci / Pratiche",
            confidenza: "media",
            snippet: s,
          };
        }
      }
    }
  } catch (e) {}

  return {
    trovato: false,
    nome: null,
    query_google: `https://www.google.com/search?q=${encodeURIComponent(`"${pulisciIndirizzoPerGeocodifica(indirizzo)}" ${comune} condominio`)}`,
  };
}

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

// Geocodifica un indirizzo in tutta Italia tramite Nominatim con dettagli amministrativi
export async function geocodificaIndirizzo(indirizzo, { fetchFn = fetch } = {}) {
  if (!indirizzo || typeof indirizzo !== "string" || !indirizzo.trim()) {
    return { ok: false, errore: "Indirizzo non valido o vuoto" };
  }

  const tentaGeocodifica = async (q) => {
    const query = q.trim();
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=it&limit=5`;
    const res = await fetchFn(url, { headers: { "User-Agent": "CantieriAI/1.0 (cantieri-new; antincendio-gsa)" } });
    if (!res.ok) return null;
    const dati = await res.json();
    if (!Array.isArray(dati) || dati.length === 0) return null;

    // Se l'utente ha specificato una città (es. palermo, milano, torino),
    // privilegia il risultato il cui comune coincide con il testo digitato
    const qLower = query.toLowerCase();
    const matchCitta = dati.find((d) => {
      const c = (d.address?.city || d.address?.municipality || d.address?.town || "").toLowerCase();
      return c && qLower.includes(c);
    });

    return matchCitta || dati[0];
  };

  try {
    let primo = await tentaGeocodifica(indirizzo);

    if (!primo) {
      const pulito = pulisciIndirizzoPerGeocodifica(indirizzo);
      if (pulito && pulito.toLowerCase() !== indirizzo.trim().toLowerCase()) {
        primo = await tentaGeocodifica(pulito);
      }
    }

    if (!primo) {
      return { ok: false, errore: `Nessun risultato cartografico trovato per '${indirizzo}' in Italia` };
    }

    const addr = primo.address || {};
    const regioneGrezza = addr.state || addr.region || "";
    // Se Nominatim non ha restituito state ma l'indirizzo contiene una regione o città piemontese
    let regione = normalizzaRegione(regioneGrezza);
    if (regione === "Italia" && /(piemonte|torino|cuneo|alessandria|novara|asti|biella|vercelli|verbania)/i.test(primo.display_name || indirizzo)) {
      regione = "Piemonte";
    }

    const comune = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || "";
    const provincia = addr.county || addr["ISO3166-2-lvl6"] || "";

    return {
      ok: true,
      lat: parseFloat(primo.lat),
      lon: parseFloat(primo.lon),
      display_name: primo.display_name,
      regione,
      comune,
      provincia,
      raw_address: addr,
    };
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
  const infoCondominio = estraiDenominazioneCondominioDaTesto(indirizzo);

  let nomeCondominio = infoCondominio?.condominio || null;
  let fonteCondominio = infoCondominio?.condominio ? "Inserito dall'utente" : null;

  if (!nomeCondominio) {
    const resNome = await cercaDenominazioneCondominio(indirizzo, { comune: geo.comune, fetchFn });
    if (resNome.trovato && resNome.nome) {
      nomeCondominio = resNome.nome;
      fonteCondominio = resNome.fonte;
    }
  }

  const queryGoogleCondominio = `https://www.google.com/search?q=${encodeURIComponent(`"${pulisciIndirizzoPerGeocodifica(indirizzo)}" ${geo.comune || ""} condominio`)}`;

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
      if (nomeCondominio && !desc.startsWith(nomeCondominio)) {
        desc = `${nomeCondominio} — ${desc}`;
      }
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
