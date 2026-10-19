// Test dell'estrazione altimetrica da civico e integrazione GSA con BDTRE Piemonte e Google Earth.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGmlUnVol, stimaAltezzaAntincendiDaEdificio, calcolaGsaDaCivico } from "../src/core/altimetria-civico.js";

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

test("stimaAltezzaAntincendiDaEdificio: calcola intervallo prudenziale davanzale", () => {
  // Edificio di 21 m: davanzale stimato tra 21 - 1.80 = 19.20 m e 21 - 1.00 = 20.00 m
  const s = stimaAltezzaAntincendiDaEdificio(21);
  assert.equal(s.min_mm, 19200);
  assert.equal(s.max_mm, 20000);
  assert.equal(s.stato, "stimato");
  assert.equal(stimaAltezzaAntincendiDaEdificio(0), null);
  assert.equal(stimaAltezzaAntincendiDaEdificio(-5), null);
});

test("calcolaGsaDaCivico (mock): edificio 21 m -> DETERMINATO Tipo a, LP 0", async () => {
  const mockFetch = async (url) => {
    if (url.includes("nominatim")) {
      return {
        ok: true,
        json: async () => [{ lat: "45.0688", lon: "7.6888", display_name: "Via Po 14, Torino, Piemonte" }],
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
  assert.equal(res.edificio_lidar.altezza_volumetrica_m, 21);
  assert.equal(res.valutazione_gsa.esito, "DETERMINATO");
  assert.equal(res.valutazione_gsa.tipo, "a");
  assert.equal(res.valutazione_gsa.lp_base, 0);
  assert.equal(res.valutazione_gsa.categoria_attivita_77.stato, "non_soggetta");
});

test("calcolaGsaDaCivico (mock mix): fusione LiDAR + Google Earth concordi", async () => {
  // Edificio 30 m da LiDAR ([28.20, 29.00] m) + Google Earth 28.5 m ([28.00, 29.00] m)
  const gml30 = `<ms:un_vol><ms:un_vol_av>30</ms:un_vol_av></ms:un_vol>`;
  const mockFetch = async (url) => {
    if (url.includes("nominatim")) {
      return {
        ok: true,
        json: async () => [{ lat: "45.0", lon: "7.6", display_name: "Corso Francia 50, Torino" }],
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
  // Edificio 21 m da LiDAR ([19.20, 20.00] m) vs Google Earth 27.0 m ([26.50, 27.50] m)
  const mockFetch = async (url) => {
    if (url.includes("nominatim")) {
      return { ok: true, json: async () => [{ lat: "45.0", lon: "7.6", display_name: "Test" }] };
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

test("pulisciIndirizzoPerGeocodifica: rimuove condominio, palazzo, scala e interno", async () => {
  const { pulisciIndirizzoPerGeocodifica } = await import("../src/core/altimetria-civico.js");
  const s = "strada suniglia 4 savigliano condominio orione palazzo a";
  assert.equal(pulisciIndirizzoPerGeocodifica(s), "strada suniglia 4 savigliano");
  assert.equal(pulisciIndirizzoPerGeocodifica("Via Roma 10 scala B int. 4 Torino"), "Via Roma 10 Torino");
});

