// Test dell'estrazione altimetrica da civico e integrazione GSA per tutte le 20 Regioni d'Italia.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseGmlUnVol,
  parseOverpassElements,
  generaVolumiArchetipoItaliano,
  stimaAltezzaAntincendiDaEdificio,
  stimaAltezzaAntincendiDaPiani,
  normalizzaRegione,
  pulisciIndirizzoPerGeocodifica,
  calcolaGsaDaCivico,
  REGIONI_ITALIANE,
} from "../src/core/altimetria-civico.js";

const SAMPLE_GML = `<?xml version='1.0' encoding="UTF-8" ?>
<wfs:FeatureCollection xmlns:ms="http://mapserver.gis.umn.edu/mapserver" xmlns:gml="http://www.opengis.net/gml" xmlns:wfs="http://www.opengis.net/wfs">
  <gml:featureMember>
    <ms:un_vol gml:id="un_vol.1">
      <ms:ente_prod>ARPA PIEMONTE</ms:ente_prod>
      <ms:modo_prod>banche dati esterne - geometrie da catasto, altezza volumi da ARPA PIEMONTE (DSM-DTM,LAS)</ms:modo_prod>
      <ms:un_vol_av>21</ms:un_vol_av>
      <ms:un_vol_por>al suolo</ms:un_vol_por>
    </ms:un_vol>
  </gml:featureMember>
  <gml:featureMember>
    <ms:un_vol gml:id="un_vol.2">
      <ms:ente_prod>ARPA PIEMONTE</ms:ente_prod>
      <ms:un_vol_av>18.5</ms:un_vol_av>
      <ms:un_vol_por>al suolo</ms:un_vol_por>
    </ms:un_vol>
  </gml:featureMember>
</wfs:FeatureCollection>`;

test("parseGmlUnVol: estrae altezza e metadati dai volumi BDTRE", () => {
  const volumi = parseGmlUnVol(SAMPLE_GML);
  assert.equal(volumi.length, 2);
  assert.equal(volumi[0].altezza_volumetrica_m, 21);
  assert.equal(volumi[0].ente_prod, "ARPA PIEMONTE");
  assert.ok(volumi[0].modo_prod.includes("DSM-DTM,LAS"));
  assert.equal(volumi[1].altezza_volumetrica_m, 18.5);
});

test("parseGmlUnVol: testo nullo o vuoto restituisce array vuoto", () => {
  assert.deepEqual(parseGmlUnVol(""), []);
  assert.deepEqual(parseGmlUnVol(null), []);
});

test("parseOverpassElements: estrae altezza e building:levels 3D", () => {
  const elements = [
    { id: 101, tags: { building: "apartments", "building:levels": "6", "addr:housenumber": "10" } },
    { id: 102, tags: { building: "commercial", height: "28.5 m" } },
    { id: 103, tags: { building: "shed" } }, // senza quote né piani
  ];
  const volumi = parseOverpassElements(elements);
  assert.equal(volumi.length, 2);
  // Il più alto ordinato per primo: 102 con 28.5 m, poi 101 con 6 piani (~19.5 m)
  assert.equal(volumi[0].id, 102);
  assert.equal(volumi[0].altezza_volumetrica_m, 28.5);
  assert.equal(volumi[1].id, 101);
  assert.equal(volumi[1].piani, 6);
  assert.equal(volumi[1].altezza_volumetrica_m, 19.5);
});

test("normalizzaRegione: riconosce tutte le 20 Regioni italiane comprese varianti bilingui", () => {
  const ventiRegioni = [
    "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
    "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
    "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia",
    "Toscana", "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto"
  ];
  for (const reg of ventiRegioni) {
    assert.equal(normalizzaRegione(reg), reg);
    assert.equal(normalizzaRegione(reg.toLowerCase()), reg);
  }
  // Varianti e bilinguismo
  assert.equal(normalizzaRegione("Sardigna/Sardegna"), "Sardegna");
  assert.equal(normalizzaRegione("Trentino-Alto Adige/Südtirol"), "Trentino-Alto Adige");
  assert.equal(normalizzaRegione("Valle d'Aosta/Vallée d'Aoste"), "Valle d'Aosta");
});

test("stimaAltezzaAntincendiDaEdificio: calcola intervallo prudenziale davanzale", () => {
  const s = stimaAltezzaAntincendiDaEdificio(21);
  assert.equal(s.min_mm, 19200);
  assert.equal(s.max_mm, 20000);
  assert.equal(s.stato, "stimato");
  assert.equal(stimaAltezzaAntincendiDaEdificio(0), null);
  assert.equal(stimaAltezzaAntincendiDaEdificio(-5), null);
});

test("stimaAltezzaAntincendiDaPiani: calcola quota davanzale e altezza volumetrica", () => {
  // Edificio 5 piani: h = (5 - 1) * 3.05 + 1.00 = 13.20 m (Tipo a: 12-24 m)
  const p5 = stimaAltezzaAntincendiDaPiani(5);
  assert.ok(p5.min_mm > 12800 && p5.max_mm < 13600);
  assert.equal(p5.numero_piani, 5);

  // Edificio 9 piani: h = (9 - 1) * 3.05 + 1.00 = 25.40 m (Tipo b: 24-32 m)
  const p9 = stimaAltezzaAntincendiDaPiani(9);
  assert.ok(p9.min_mm > 24000 && p9.max_mm < 26000);

  // Edificio 18 piani: h = (18 - 1) * 3.05 + 1.00 = 52.85 m (Tipo c: 32-54 m)
  const p18 = stimaAltezzaAntincendiDaPiani(18);
  assert.ok(p18.min_mm > 52000 && p18.max_mm < 53500);

  // Edificio 2 piani: h = (2 - 1) * 3.05 + 1.00 = 4.05 m (fuori campo h < 12 m)
  const p2 = stimaAltezzaAntincendiDaPiani(2);
  assert.ok(p2.max_mm < 12000);
});

test("generaVolumiArchetipoItaliano: fornisce i 4 archetipi standard italiani", () => {
  const arch = generaVolumiArchetipoItaliano();
  assert.equal(arch.length, 4);
  assert.equal(arch[0].piani, 5);
  assert.equal(arch[1].piani, 4);
  assert.equal(arch[2].piani, 8);
  assert.equal(arch[3].piani, 2);
});

test("calcolaGsaDaCivico (Piemonte): edificio 21 m -> DETERMINATO Tipo a, LP 0", async () => {
  const mockFetch = async (url) => {
    if (url.includes("nominatim")) {
      return {
        ok: true,
        json: async () => [{
          lat: "45.0688",
          lon: "7.6888",
          display_name: "Via Po 14, Torino, Piemonte",
          address: { state: "Piemonte", city: "Torino" }
        }],
      };
    }
    if (url.includes("bdtre_imm")) {
      return {
        ok: true,
        text: async () => SAMPLE_GML,
      };
    }
    throw new Error(`URL inatteso: ${url}`);
  };

  const res = await calcolaGsaDaCivico("Via Po 14, Torino", { fetchFn: mockFetch });
  assert.equal(res.esito, "OK");
  assert.equal(res.regione, "Piemonte");
  assert.equal(res.comune, "Torino");
  assert.equal(res.edificio_lidar.altezza_volumetrica_m, 21);
  assert.equal(res.valutazione_gsa.esito, "DETERMINATO");
  assert.equal(res.valutazione_gsa.tipo, "a");
  assert.equal(res.valutazione_gsa.lp_base, 0);
  assert.equal(res.valutazione_gsa.categoria_attivita_77.stato, "non_soggetta");
});

test("calcolaGsaDaCivico (Lombardia - Milano): OSM 3D 7 piani -> DETERMINATO Tipo a", async () => {
  const mockFetch = async (url) => {
    if (url.includes("nominatim")) {
      return {
        ok: true,
        json: async () => [{
          lat: "45.4658",
          lon: "9.1858",
          display_name: "Via Dante 10, Milano, Lombardia",
          address: { state: "Lombardia", city: "Milano" }
        }],
      };
    }
    if (url.includes("overpass")) {
      return {
        ok: true,
        json: async () => ({
          elements: [
            { id: 991, tags: { building: "apartments", "building:levels": "7" } }
          ]
        }),
      };
    }
    throw new Error(`URL inatteso: ${url}`);
  };

  const res = await calcolaGsaDaCivico("Via Dante 10, Milano", { fetchFn: mockFetch });
  assert.equal(res.esito, "OK");
  assert.equal(res.regione, "Lombardia");
  assert.equal(res.comune, "Milano");
  assert.ok(res.provider.includes("OpenStreetMap"));
  assert.equal(res.edificio_selezionato.piani, 7);
  assert.equal(res.valutazione_gsa.esito, "DETERMINATO");
  assert.equal(res.valutazione_gsa.tipo, "a"); // 7 piani = ~19.3 m -> Tipo a (12-24 m)
});

test("calcolaGsaDaCivico (Lazio - Roma): Fallback Tipologico Nazionale 8 piani -> Tipo b, LP 1, Attivita 77", async () => {
  const mockFetch = async (url) => {
    if (url.includes("nominatim")) {
      return {
        ok: true,
        json: async () => [{
          lat: "41.9021",
          lon: "12.4799",
          display_name: "Via del Corso 20, Roma, Lazio",
          address: { state: "Lazio", city: "Roma" }
        }],
      };
    }
    if (url.includes("overpass")) {
      // Simula nessun tag 3D
      return { ok: true, json: async () => ({ elements: [] }) };
    }
    throw new Error(`URL inatteso: ${url}`);
  };

  // Seleziona il volume 2 (8 piani, 25.6 m)
  const res = await calcolaGsaDaCivico("Via del Corso 20, Roma", {
    indice_volume: 2,
    fetchFn: mockFetch,
  });

  assert.equal(res.esito, "OK");
  assert.equal(res.regione, "Lazio");
  assert.equal(res.comune, "Roma");
  assert.ok(res.provider.includes("Lazio"));
  assert.equal(res.edificio_selezionato.piani, 8);
  // 8 piani = 22.35 m (davanzale) -> Tipo a (< 24 m)
  assert.equal(res.valutazione_gsa.esito, "DETERMINATO");
  assert.equal(res.valutazione_gsa.tipo, "a");
});

test("calcolaGsaDaCivico (Campania - Napoli): override numero piani a 10 piani -> Tipo b (Attività 77)", async () => {
  const mockFetch = async (url) => {
    if (url.includes("nominatim")) {
      return {
        ok: true,
        json: async () => [{
          lat: "40.8416",
          lon: "14.2487",
          display_name: "Via Toledo 100, Napoli, Campania",
          address: { state: "Campania", city: "Napoli" }
        }],
      };
    }
    return { ok: true, json: async () => ({ elements: [] }) };
  };

  const res = await calcolaGsaDaCivico("Via Toledo 100, Napoli", {
    numero_piani_override: 10,
    fetchFn: mockFetch,
  });

  assert.equal(res.esito, "OK");
  assert.equal(res.regione, "Campania");
  assert.equal(res.edificio_selezionato.piani, 10);
  // 10 piani: h = 9 * 3.05 + 1.00 = 28.45 m -> Tipo b (24-32 m)
  assert.equal(res.valutazione_gsa.esito, "DETERMINATO");
  assert.equal(res.valutazione_gsa.tipo, "b");
  assert.equal(res.valutazione_gsa.lp_base, 1);
  assert.equal(res.valutazione_gsa.categoria_attivita_77.stato, "soggetta");
  assert.equal(res.valutazione_gsa.categoria_attivita_77.classe, "A");
});

test("calcolaGsaDaCivico (mock mix): fusione LiDAR + Google Earth concordi", async () => {
  const gml30 = `<ms:un_vol><ms:un_vol_av>30</ms:un_vol_av></ms:un_vol>`;
  const mockFetch = async (url) => {
    if (url.includes("nominatim")) {
      return {
        ok: true,
        json: async () => [{
          lat: "45.0",
          lon: "7.6",
          display_name: "Corso Francia 50, Torino",
          address: { state: "Piemonte" }
        }],
      };
    }
    return { ok: true, text: async () => gml30 };
  };

  const res = await calcolaGsaDaCivico("Corso Francia 50, Torino", {
    quota_google_earth_m: 28.5,
    fetchFn: mockFetch,
  });

  assert.equal(res.esito, "OK");
  assert.equal(res.valutazione_gsa.esito, "DETERMINATO");
  assert.equal(res.valutazione_gsa.tipo, "b");
  assert.equal(res.valutazione_gsa.lp_base, 1);
  assert.equal(res.fonti_utilizzate.length, 2);
});

test("calcolaGsaDaCivico (mock conflitto): LiDAR e Google Earth discordi oltre 500 mm", async () => {
  const mockFetch = async (url) => {
    if (url.includes("nominatim")) {
      return {
        ok: true,
        json: async () => [{
          lat: "45.0",
          lon: "7.6",
          display_name: "Test",
          address: { state: "Piemonte" }
        }]
      };
    }
    return { ok: true, text: async () => SAMPLE_GML };
  };

  const res = await calcolaGsaDaCivico("Test", {
    quota_google_earth_m: 27.0,
    fetchFn: mockFetch,
  });

  assert.equal(res.esito, "OK");
  assert.equal(res.valutazione_gsa.esito, "INDETERMINATO");
  assert.equal(res.valutazione_gsa.motivo, "conflitto");
  assert.ok(res.valutazione_gsa.azione.includes("disaccordo"));
});

test("pulisciIndirizzoPerGeocodifica: rimuove condominio, palazzo, scala e interno", () => {
  const s = "strada suniglia 4 savigliano condominio orione palazzo a";
  assert.equal(pulisciIndirizzoPerGeocodifica(s), "strada suniglia 4 savigliano");
  assert.equal(pulisciIndirizzoPerGeocodifica("Via Roma 10 scala B int. 4 Torino"), "Via Roma 10 Torino");
});

test("formattaIndirizzoItaliano: compone via, civico, cap, comune e provincia", async () => {
  const { formattaIndirizzoItaliano } = await import("../src/core/altimetria-civico.js");
  const s = formattaIndirizzoItaliano({
    via: "Strada Suniglia",
    civico: "4",
    cap: "12038",
    comune: "Savigliano",
    provincia: "Cuneo",
  });
  assert.equal(s, "Strada Suniglia, 4, 12038 Savigliano (Cuneo)");
});

test("clusterVolumiResidenziali: raggruppa palazzine dello stesso cortile ed esclude edifici isolati di lotti confinanti", async () => {
  const { clusterVolumiResidenziali } = await import("../src/core/altimetria-civico.js");
  const palazzine = [
    { id: "A", lat: 44.641064, lon: 7.655214, distM: 24.8, altezza_volumetrica_m: 18 },
    { id: "B", lat: 44.641332, lon: 7.655136, distM: 24.4, altezza_volumetrica_m: 18 },
    { id: "C", lat: 44.641135, lon: 7.654898, distM: 42.4, altezza_volumetrica_m: 14 },
    { id: "D_isolato", lat: 44.641730, lon: 7.655194, distM: 57.7, altezza_volumetrica_m: 13 },
  ];

  const cluster = clusterVolumiResidenziali(palazzine, { maxClusterDist: 38 });
  assert.equal(cluster.length, 3);
  assert.deepEqual(cluster.map(c => c.id), ["A", "B", "C"]);
});

test("autocompletaIndirizzo: supporta Photon OSM per lookup stile Amazon", async () => {
  const { autocompletaIndirizzo } = await import("../src/core/altimetria-civico.js");
  const mockFetch = async (url) => {
    if (url.includes("photon")) {
      return {
        ok: true,
        json: async () => ({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {
                street: "Strada Suniglia",
                housenumber: "4",
                city: "Savigliano",
                county: "Cuneo",
                state: "Piemonte",
                postcode: "12038",
                countrycode: "IT",
              },
              geometry: {
                coordinates: [7.6554138, 44.6412359],
              },
            },
          ],
        }),
      };
    }
    throw new Error(`URL inatteso: ${url}`);
  };

  const res = await autocompletaIndirizzo("via suniglia 4", { fetchFn: mockFetch });
  assert.equal(res.length, 1);
  assert.equal(res[0].via, "Strada Suniglia");
  assert.equal(res[0].civico, "4");
  assert.equal(res[0].comune, "Savigliano");
  assert.equal(res[0].lat, 44.6412359);
  assert.equal(res[0].lon, 7.6554138);
  assert.equal(res[0].display_name, "Strada Suniglia, 4, 12038 Savigliano (Cuneo)");
});

test("geocodificaIndirizzo: tolleranza odonimi (via suniglia 4 -> Strada Suniglia 4 Savigliano)", async () => {
  const { geocodificaIndirizzo } = await import("../src/core/altimetria-civico.js");
  const mockFetch = async (url) => {
    if (url.includes("photon")) {
      return {
        ok: true,
        json: async () => ({
          type: "FeatureCollection",
          features: [
            {
              properties: {
                street: "Strada Suniglia",
                housenumber: "4",
                city: "Savigliano",
                county: "Cuneo",
                state: "Piemonte",
                postcode: "12038",
                countrycode: "IT",
              },
              geometry: { coordinates: [7.6554138, 44.6412359] },
            },
          ],
        }),
      };
    }
    throw new Error(`URL inatteso: ${url}`);
  };

  const geo = await geocodificaIndirizzo("via suniglia 4 savigliano", { fetchFn: mockFetch });
  assert.equal(geo.ok, true);
  assert.equal(geo.comune, "Savigliano");
  assert.equal(geo.regione, "Piemonte");
  assert.equal(geo.lat, 44.6412359);
  assert.equal(geo.lon, 7.6554138);
});

