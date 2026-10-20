// Scheda GSA (Gestione della Sicurezza Antincendio, DM 2/9/2021): dati inseriti dall'utente, risultato solo
// dopo il pulsante "Calcola GSA". Ogni obbligo mostra l'articolo o l'allegato del decreto.
import { calcolaGSA, LIVELLO3, PLANIMETRIA_ELEMENTI, PIANO_CONTENUTI, GSA_FONTE } from "../core/gsa-incendio.js?v=v20261020bk";
import { classificaRischio, verificaEsodo, CRITERI_ELEVATO, CRITERI_MEDIO, CRITERI_BASSO, RIDUZIONI, FONTE_1998, RIF_ESODO } from "../core/rischio-incendio.js?v=v20261020bk";
import { calcolaGsaDaCivico, autocompletaIndirizzo } from "../core/altimetria-civico.js?v=v20261020bk";

function el(tag, cls, testo) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (testo !== undefined) e.textContent = testo;
  return e;
}

// Stato iniziale: nessun valore, nessun risultato
export function datiGSAIniziali() {
  return {
    lavoratori: "",
    aperto_pubblico: false,
    pubblico_contemporaneo: "",
    soggettaCPI: "",          // "si" | "no" | "" (non so)
    cantiereFiamme: false,
    attivita_complessa: false,
    livello3: [],
    data_corso_addetti: "",
    data_ultima_esercitazione: "",
    planimetria_elementi: [],
    piano_contenuti: [],
    doc_vr: "",
    doc_piano: "",
    doc_attestati: "",
    doc_registro: "",
    doc_informazione: "",
    // DM 10/3/1998, punto 1.4.4: criteri del livello di rischio
    criteri: [],
    riduzioni: [],
    // DM 10/3/1998, punti 3.3-3.5: vie di uscita del piano
    esodo: { distanzaDueVie_m: "", distanzaUnaVia_m: "", affollamento: "", numeroUscite: "", larghezzaUscite_m: "", pubblico: false, assistenza: false, materialiInfiammabili: false, areaRiposo: false },
  };
}

// Dal modulo al motore: testo vuoto = dato non noto (null), "si"/"no" = booleano
function verso(d) {
  const tri = (v) => (v === "si" ? true : v === "no" ? false : null);
  const num = (v) => (v === "" || v === null ? undefined : Number(v));
  return {
    lavoratori: num(d.lavoratori),
    aperto_pubblico: d.aperto_pubblico,
    pubblico_contemporaneo: num(d.pubblico_contemporaneo),
    soggettaCPI: d.soggettaCPI === "" ? undefined : d.soggettaCPI === "si",
    cantiereFiamme: d.cantiereFiamme,
    attivita_complessa: d.attivita_complessa,
    livello3: d.livello3,
    data_corso_addetti: d.data_corso_addetti || null,
    data_ultima_esercitazione: d.data_ultima_esercitazione || null,
    planimetria_elementi: d.planimetria_elementi,
    piano_contenuti: d.piano_contenuti,
    doc_vr: tri(d.doc_vr),
    doc_piano: tri(d.doc_piano),
    doc_attestati: tri(d.doc_attestati),
    doc_registro: tri(d.doc_registro),
    doc_informazione: tri(d.doc_informazione),
  };
}

function numOpt(v) { return v === "" || v === null || v === undefined ? undefined : Number(v); }

// Calcolo completo: obblighi GSA (DM 2/9/2021) + rischio e vie di uscita (DM 10/3/1998)
function calcolaTutto(d) {
  const base = calcolaGSA(verso(d));
  const rischio = classificaRischio(Object.fromEntries(d.criteri.map((c) => [c, true]).concat(d.riduzioni.map((r) => [`riduzione_${r}`, true]))));
  const e = d.esodo;
  const livello = rischio.livelloFinale;
  const esodo = verificaEsodo({
    livello,
    distanzaDueVie_m: numOpt(e.distanzaDueVie_m),
    distanzaUnaVia_m: numOpt(e.distanzaUnaVia_m),
    affollamento: numOpt(e.affollamento),
    numeroUscite: numOpt(e.numeroUscite),
    larghezzaUscite_m: numOpt(e.larghezzaUscite_m),
    pubblico: e.pubblico, assistenza: e.assistenza, materialiInfiammabili: e.materialiInfiammabili, areaRiposo: e.areaRiposo,
  });
  const mancanti = [...base.mancanti];
  if (!d.criteri.length) mancanti.push("criteri del livello di rischio (punto 1.4.4): selezionare almeno uno, oppure dichiarare che non ne ricorre alcuno");
  mancanti.push(...esodo.mancanti.map((m) => `vie di uscita: ${m}`));
  return { base, rischio, esodo, mancanti, completo: mancanti.length === 0 };
}

export function montaGSA(box) {
  const d = datiGSAIniziali();
  let risultato = null;
  let calcolatoCon = null;
  box.innerHTML = "";

  // ---- 0. Calcolo Automatico da Civico (LiDAR BDTRE Piemonte + Google Earth) ----
  const sezCivico = el("div", "blocco");
  sezCivico.style.cssText = "background: rgba(61, 220, 247, 0.05); border: 1px solid rgba(61, 220, 247, 0.25); border-radius: 12px; padding: 12px; margin-bottom: 16px;";

  const titCivico = el("h2", "", "Palazzi e Condomini d'Italia — Calcolo da Civico (Tutte le 20 Regioni)");
  titCivico.style.cssText = "color: var(--hud-ciano); font-size: 13px; margin: 0 0 4px;";
  const subCivico = el("div", "sub", "Inserisci qualsiasi indirizzo in Italia: interroga il LiDAR regionale BDTRE (Piemonte / ARPA) o i volumi 3D cartografici nazionali (OpenStreetMap 3D / Modello DM 5/7/1975) e calcola altezza antincendi e livello GSA (DM 246/1987 + DM 25/1/2019).");
  subCivico.style.cssText = "font-size: 11px; margin-bottom: 8px; color: var(--hud-muto);";

  const boxRicerca = el("div");
  boxRicerca.style.cssText = "position: relative; width: 100%; margin-bottom: 8px;";

  const inpIndirizzo = el("input");
  inpIndirizzo.type = "text";
  inpIndirizzo.placeholder = "Cerca indirizzo (es. Via Suniglia 4 Savigliano, Via Dante 10 Milano)...";
  inpIndirizzo.autocomplete = "off";
  inpIndirizzo.style.cssText = "width: 100%; box-sizing: border-box; padding: 7px 10px; font-size: 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(61,220,247,0.3); border-radius: 6px; color: #fff;";

  const listaSuggerimenti = el("div");
  listaSuggerimenti.style.cssText = "position: absolute; top: calc(100% + 2px); left: 0; right: 0; z-index: 100; background: rgba(14, 20, 36, 0.98); border: 1px solid rgba(61, 220, 247, 0.4); border-radius: 6px; box-shadow: 0 10px 25px rgba(0,0,0,0.6); max-height: 220px; overflow-y: auto; display: none;";

  boxRicerca.append(inpIndirizzo, listaSuggerimenti);

  let timerAuto = null;
  inpIndirizzo.oninput = () => {
    inpIndirizzo._selectedSugg = null;
    clearTimeout(timerAuto);
    const q = inpIndirizzo.value.trim();
    if (q.length < 3) {
      listaSuggerimenti.style.display = "none";
      listaSuggerimenti.innerHTML = "";
      return;
    }
    timerAuto = setTimeout(async () => {
      try {
        const suggerimenti = await autocompletaIndirizzo(q, { limit: 5 });
        listaSuggerimenti.innerHTML = "";
        if (!suggerimenti || suggerimenti.length === 0) {
          listaSuggerimenti.style.display = "none";
          return;
        }
        suggerimenti.forEach((sugg) => {
          const item = el("div");
          item.style.cssText = "padding: 8px 10px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 11.5px; line-height: 1.4; transition: background 0.15s; display: flex; align-items: center; gap: 8px;";

          const icona = el("span", "", "📍");
          icona.style.fontSize = "12px";

          const col = el("div");
          col.style.cssText = "flex: 1; overflow: hidden;";

          const rVia = el("div", "", sugg.via ? (sugg.civico ? `${sugg.via}, ${sugg.civico}` : sugg.via) : sugg.display_name);
          rVia.style.cssText = "font-weight: 600; color: #f2f4f8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";

          const rDettaglio = el("div", "hud-stat", [sugg.cap, sugg.comune, sugg.provincia ? `(${sugg.provincia})` : ""].filter(Boolean).join(" "));
          rDettaglio.style.cssText = "font-size: 10.5px; color: var(--hud-muto);";

          col.append(rVia, rDettaglio);
          item.append(icona, col);

          item.onmouseenter = () => { item.style.background = "rgba(61, 220, 247, 0.15)"; };
          item.onmouseleave = () => { item.style.background = "transparent"; };
          item.onmousedown = (e) => {
            e.preventDefault();
            inpIndirizzo.value = sugg.display_name;
            inpIndirizzo._selectedSugg = sugg;
            listaSuggerimenti.style.display = "none";
            btnCalcolaCivico.click();
          };
          listaSuggerimenti.append(item);
        });
        listaSuggerimenti.style.display = "block";
      } catch (e) {
        listaSuggerimenti.style.display = "none";
      }
    }, 200);
  };

  inpIndirizzo.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      listaSuggerimenti.style.display = "none";
      btnCalcolaCivico.click();
    } else if (e.key === "Escape") {
      listaSuggerimenti.style.display = "none";
    }
  };

  document.addEventListener("click", (e) => {
    if (!boxRicerca.contains(e.target)) {
      listaSuggerimenti.style.display = "none";
    }
  });

  const rowGe = el("div", "riga-azioni");
  rowGe.style.cssText = "display: flex; gap: 8px; align-items: center; margin-bottom: 8px;";
  const lblGe = el("span", "", "Google Earth (opz., m):");
  lblGe.style.cssText = "font-size: 11px; color: var(--hud-muto); white-space: nowrap;";
  const inpGe = el("input");
  inpGe.type = "number";
  inpGe.step = "0.1";
  inpGe.placeholder = "Quota davanzale (m)";
  inpGe.style.cssText = "width: 130px;";
  rowGe.append(lblGe, inpGe);

  const btnCalcolaCivico = el("button", "gsa-calcola", "Estrai Palazzo e Calcola GSA");
  btnCalcolaCivico.style.cssText = "width: 100%; background: var(--hud-ciano) !important; color: #0a0e18 !important; font-weight: 700; cursor: pointer;";

  const statoCivico = el("div", "hud-stat");
  statoCivico.id = "gsa-civico-stato";
  statoCivico.style.cssText = "margin-top: 6px; font-size: 11px;";
  const esitoCivico = el("div", "gsa-esito");
  esitoCivico.style.cssText = "margin-top: 8px;";

  btnCalcolaCivico.onclick = async () => {
    const txt = inpIndirizzo.value.trim();
    if (!txt) {
      statoCivico.textContent = "Inserisci un indirizzo valido (es. Via Po 14 Torino, Via Dante 10 Milano, Strada Suniglia 4 Savigliano).";
      statoCivico.style.color = "#ff7b86";
      return;
    }
    const suggPrecalcolato = (inpIndirizzo._selectedSugg && inpIndirizzo._selectedSugg.display_name === txt)
      ? { ...inpIndirizzo._selectedSugg, ok: true }
      : null;

    btnCalcolaCivico.disabled = true;
    statoCivico.style.color = "var(--hud-ciano)";
    statoCivico.textContent = suggPrecalcolato
      ? "1/2 Posizione certificata, acquisizione volumetria in corso…"
      : "1/2 Ricerca cartografica indirizzo in corso (Photon / OSM)…";
    esitoCivico.innerHTML = "";

    try {
      const valGe = inpGe.value.trim() ? parseFloat(inpGe.value.replace(",", ".")) : null;
      statoCivico.textContent = "2/2 Acquisizione volumetria (LiDAR BDTRE / OpenStreetMap 3D)…";
      const res = await calcolaGsaDaCivico(txt, { quota_google_earth_m: valGe, geo_precalcolata: suggPrecalcolato });

      if (res.esito !== "OK") {
        statoCivico.textContent = `Errore: ${res.errore}`;
        statoCivico.style.color = "#ff7b86";
        return;
      }

      statoCivico.textContent = `✓ Edificio individuato in ${res.regione}! (${res.provider})`;
      statoCivico.style.color = "#7ef2b5";

      function renderizzaCard(risposta) {
        esitoCivico.innerHTML = "";
        const gsa = risposta.valutazione_gsa;
        const card = el("div");
        card.style.cssText = "background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px; border: 1px solid rgba(255,255,255,0.1); font-size: 12px; line-height: 1.5;";

        const r1 = el("div", "", `Indirizzo: ${risposta.indirizzo_trovato}`);
        r1.style.fontWeight = "600";
        const r2 = el("div", "hud-stat", `Regione: ${risposta.regione}${risposta.comune ? ` (${risposta.comune})` : ""} • Coordinate: ${risposta.coordinate.lat.toFixed(5)}, ${risposta.coordinate.lon.toFixed(5)}`);
        const rProv = el("div", "hud-stat", `Fonte Dati: ${risposta.provider}`);
        rProv.style.cssText = "color: var(--hud-ciano); font-size: 11px; margin-bottom: 6px;";

        card.append(r1, r2, rProv);

        // Se è una stima tipologica (assenza LiDAR), offre la scelta del modello o piani
        if (risposta.fonte_tipologica) {
          const rTipo = el("div");
          rTipo.style.cssText = "margin: 8px 0; padding: 8px; background: rgba(61,220,247,0.06); border: 1px dashed rgba(61,220,247,0.3); border-radius: 6px;";
          rTipo.append(el("div", "hud-stat", `🏛 Rilievo 3D LiDAR non disponibile per questo civico. Seleziona la tipologia / piani per il calcolo:`));
          const btnGroup = el("div");
          btnGroup.style.cssText = "display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px;";
          risposta.volumi_rilevati.forEach((v) => {
            const b = el("button", "", v.tipo_presunto || `${v.altezza_m.toFixed(1)} m`);
            b.style.cssText = v.selezionato
              ? "background: var(--hud-ciano) !important; color: #0a0e18 !important; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px;"
              : "background: rgba(255,255,255,0.08); font-size: 11px; padding: 4px 8px; cursor: pointer; border-radius: 4px;";
            b.onclick = async () => {
              const rRicalcolo = await calcolaGsaDaCivico(txt, {
                quota_google_earth_m: valGe,
                indice_volume: v.indice,
                geo_precalcolata: risposta.geo_dati || { ...risposta.coordinate, regione: risposta.regione, comune: risposta.comune, provincia: risposta.provincia, display_name: risposta.indirizzo_trovato, ok: true }
              });
              renderizzaCard(rRicalcolo);
            };
            btnGroup.append(b);
          });
          rTipo.append(btnGroup);
          card.append(rTipo);
        } else if (risposta.volumi_rilevati && risposta.volumi_rilevati.length > 1) {
          // Corpi di fabbrica reali rilevati (LiDAR BDTRE o OpenStreetMap 3D Nazionale)
          const rMulti = el("div");
          rMulti.style.cssText = "margin: 8px 0; padding: 8px; background: rgba(61,220,247,0.06); border: 1px dashed rgba(61,220,247,0.3); border-radius: 6px;";
          const labelFonte = risposta.provider.includes("LiDAR") ? "LiDAR BDTRE" : "OpenStreetMap 3D";
          rMulti.append(el("div", "hud-stat", `🏢 Corpi di fabbrica rilevati da ${labelFonte} (${risposta.volumi_rilevati.length} edifici nel lotto/civico). Seleziona:`));
          const btnGroup = el("div");
          btnGroup.style.cssText = "display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px;";
          risposta.volumi_rilevati.forEach((v) => {
            const labelBtn = `${v.tipo_presunto || 'Palazzina'} (${v.altezza_m.toFixed(1)} m${v.piani ? `, ${v.piani}p` : ''})`;
            const b = el("button", "", labelBtn);
            b.style.cssText = v.selezionato
              ? "background: var(--hud-ciano) !important; color: #0a0e18 !important; font-weight: 700; font-size: 11px; padding: 4px 8px; border-radius: 4px;"
              : "background: rgba(255,255,255,0.08); font-size: 11px; padding: 4px 8px; cursor: pointer; border-radius: 4px;";
            b.onclick = async () => {
              const rRicalcolo = await calcolaGsaDaCivico(txt, {
                quota_google_earth_m: valGe,
                indice_volume: v.indice,
                geo_precalcolata: risposta.geo_dati || { ...risposta.coordinate, regione: risposta.regione, comune: risposta.comune, provincia: risposta.provincia, display_name: risposta.indirizzo_trovato, ok: true }
              });
              renderizzaCard(rRicalcolo);
            };
            btnGroup.append(b);
          });
          rMulti.append(btnGroup);
          card.append(rMulti);
        }

        // Barra rapida simulazione piani / override
        const rSimPiani = el("div");
        rSimPiani.style.cssText = "margin: 6px 0 8px 0; font-size: 11px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;";
        rSimPiani.append(el("span", "hud-stat", "Simula piani:"));
        [2, 3, 4, 5, 6, 8, 10, 15].forEach((pNum) => {
          const pb = el("button", "", `${pNum}p`);
          pb.style.cssText = "background: rgba(255,255,255,0.06); color: var(--hud-testo); border: 1px solid rgba(255,255,255,0.12); padding: 2px 6px; font-size: 10px; border-radius: 3px; cursor: pointer;";
          pb.onclick = async () => {
            const rOverride = await calcolaGsaDaCivico(txt, {
              quota_google_earth_m: valGe,
              numero_piani_override: pNum,
              geo_precalcolata: risposta.geo_dati || { ...risposta.coordinate, regione: risposta.regione, comune: risposta.comune, provincia: risposta.provincia, display_name: risposta.indirizzo_trovato, ok: true }
            });
            renderizzaCard(rOverride);
          };
          rSimPiani.append(pb);
        });
        card.append(rSimPiani);

        const r3 = el("div", "", `Altezza volumetrica corpo selezionato: ${risposta.edificio_lidar.altezza_volumetrica_m.toFixed(1)} m (${risposta.edificio_lidar.metodo || risposta.edificio_lidar.ente})`);
        r3.style.color = "var(--hud-ciano)";

        const alt = gsa.altezza;
        const hStr = alt.h_mm ? `${(alt.h_mm / 1000).toFixed(2)} m` : `[${(alt.h_min_mm / 1000).toFixed(2)}; ${(alt.h_max_mm / 1000).toFixed(2)}] m`;
        const r4 = el("div", "", `Altezza antincendi stimata (h): ${hStr} (${alt.stato})`);

        const badgeTipo = el("div");
        badgeTipo.style.cssText = "margin-top: 6px; padding: 6px; border-radius: 6px; background: rgba(61,220,247,0.12); border-left: 3px solid var(--hud-ciano);";

        if (gsa.esito === "FUORI_CAMPO") {
          badgeTipo.innerHTML = `<b>Esito: FUORI CAMPO (h < 12 m)</b><br>Questo corpo ha altezza antincendi sotto 12 m: DM 246/1987 non applicabile direttamente.`;
        } else if (gsa.esito === "DETERMINATO") {
          badgeTipo.innerHTML = `<b>Esito: DETERMINATO (${gsa.altezza.stato})</b><br>` +
            `• <b>Tipo edificio (DM 246/1987 Tab. A):</b> Tipo ${gsa.tipo?.toUpperCase()} (${gsa.tipo === "a" ? "12–24 m" : gsa.tipo === "b" ? "24–32 m" : gsa.tipo === "c" ? "32–54 m" : gsa.tipo === "d" ? "54–80 m" : ">80 m"})<br>` +
            `• <b>Livello di Prestazione (DM 25/01/2019):</b> <b>L.P. ${gsa.lp_finale}</b><br>` +
            `• <b>Attività 77 DPR 151/2011:</b> ${gsa.categoria_attivita_77.stato === "soggetta" ? `SOGGETTA (Classe ${gsa.categoria_attivita_77.classe})` : "NON SOGGETTA (h ≤ 24 m)"}`;
        } else {
          badgeTipo.innerHTML = `<b>Esito: INDETERMINATO (${gsa.motivo})</b><br>` +
            `Azione richiesta: ${gsa.azione || "Verificare con rilievo puntuale di dettaglio."}`;
        }

        card.append(r3, r4, badgeTipo);
        if (risposta.fonti_utilizzate.length > 1) {
          const rFonti = el("div", "hud-stat", `Fonti fuse: ${risposta.fonti_utilizzate.map((f) => f.fonte).join(" + ")}`);
          rFonti.style.marginTop = "4px";
          card.append(rFonti);
        }

        const vLat = risposta.edificio_lidar?.lat || risposta.coordinate.lat;
        const vLon = risposta.edificio_lidar?.lon || risposta.coordinate.lon;
        const altSlm = (risposta.edificio_lidar && risposta.edificio_lidar.quota_estradosso_m) || 320;
        const volCorrente = risposta.volumi_rilevati?.find((v) => v.selezionato);
        const etichettaBtn = volCorrente ? `↗ Inquadra ${volCorrente.tipo_presunto} in Google Earth 3D (Vista Frontale)` : "↗ Inquadra Palazzina in Google Earth 3D (Vista Frontale)";

        const linkGe = el("a", "", etichettaBtn);
        linkGe.href = `https://earth.google.com/web/@${vLat.toFixed(5)},${vLon.toFixed(5)},${altSlm}a,120d,45y,65t,0r`;
        linkGe.target = "_blank";
        linkGe.rel = "noopener noreferrer";
        linkGe.style.cssText = "display: inline-block; margin-top: 8px; color: var(--hud-ciano); font-size: 11px; text-decoration: none; border: 1px solid rgba(61,220,247,0.3); padding: 5px 12px; border-radius: 999px; background: rgba(61,220,247,0.06); font-weight: 600;";
        card.append(linkGe);

        esitoCivico.append(card);
      }

      renderizzaCard(res);
    } catch (err) {
      statoCivico.textContent = `Errore imprevisto: ${err.message}`;
      statoCivico.style.color = "#ff7b86";
    } finally {
      btnCalcolaCivico.disabled = false;
    }
  };

  sezCivico.append(titCivico, subCivico, boxRicerca, rowGe, btnCalcolaCivico, statoCivico, esitoCivico);
  box.append(sezCivico);

  const avviso = el("div", "riga info", "Inserisci i dati, poi premi Calcola GSA. Il calcolo segue il DM 2 settembre 2021 (GU n. 237 del 4/10/2021), in vigore dal 4/10/2022.");
  box.append(avviso);

  const form = el("div", "gsa-form");
  const campo = (etichetta, nodo) => { const l = el("label", "gsa-campo"); l.append(el("span", "", etichetta), nodo); form.append(l); return nodo; };
  const numero = (chiave, etichetta, min = 0) => {
    const i = el("input"); i.type = "number"; i.min = String(min); i.value = d[chiave];
    i.onchange = () => { d[chiave] = i.value; segna(); };
    return campo(etichetta, i);
  };
  const data = (chiave, etichetta) => {
    const i = el("input"); i.type = "date"; i.value = d[chiave];
    i.onchange = () => { d[chiave] = i.value; segna(); };
    return campo(etichetta, i);
  };
  const tri = (chiave, etichetta) => {
    const s = el("select");
    for (const [v, t] of [["", "non so"], ["si", "sì"], ["no", "no"]]) s.append(new Option(t, v, false, d[chiave] === v));
    s.onchange = () => { d[chiave] = s.value; segna(); };
    return campo(etichetta, s);
  };
  const check = (chiave, etichetta) => {
    const i = el("input"); i.type = "checkbox"; i.checked = !!d[chiave];
    i.onchange = () => { d[chiave] = i.checked; segna(); };
    const l = el("label", "gsa-check"); l.append(i, " " + etichetta); form.append(l);
  };
  const gruppo = (titolo, lista, chiave) => {
    form.append(el("div", "gsa-titolo", titolo));
    for (const [id, testo] of lista) {
      const l = el("label", "gsa-check");
      const i = el("input"); i.type = "checkbox"; i.checked = d[chiave].includes(id);
      i.onchange = () => { d[chiave] = i.checked ? [...d[chiave], id] : d[chiave].filter((x) => x !== id); segna(); };
      l.append(i, " " + testo); form.append(l);
    }
  };

  form.append(el("div", "gsa-titolo", "1. Luogo di lavoro"));
  numero("lavoratori", "Lavoratori occupati (numero)");
  check("aperto_pubblico", "Luogo aperto al pubblico");
  numero("pubblico_contemporaneo", "Persone del pubblico contemporaneamente presenti");
  tri("soggettaCPI", "Attività soggetta al DPR 151/2011 (allegato I)?");
  check("cantiereFiamme", "Cantiere con sostanze infiammabili e fiamme libere");
  check("attivita_complessa", "Edificio complesso o attività con più titolari");
  form.append(el("div", "gsa-titolo", "2. Attività di livello 3 (all. III 3.2.2), se presente"));
  gruppo("Seleziona solo le voci che si applicano:", Object.entries(LIVELLO3), "livello3");

  form.append(el("div", "gsa-titolo", "3. Addetti e formazione"));
  data("data_corso_addetti", "Data dell'ultimo corso degli addetti antincendio");
  data("data_ultima_esercitazione", "Data dell'ultima esercitazione antincendio");

  form.append(el("div", "gsa-titolo", "4. Elementi della planimetria del piano (all. II 2.2 n. 3)"));
  gruppo("Presenti nella planimetria:", PLANIMETRIA_ELEMENTI.map((e) => [e.id, e.testo]), "planimetria_elementi");
  form.append(el("div", "gsa-titolo", "5. Contenuti scritti del piano (all. II 2.1-2.2)"));
  gruppo("Presenti nel piano:", PIANO_CONTENUTI.map((e) => [e.id, e.testo]), "piano_contenuti");

  form.append(el("div", "gsa-titolo", "6. Rischio di incendio (DM 10/3/1998, punto 1.4.4)"));
  form.append(el("div", "gsa-nota", "Spunta i criteri che si applicano al luogo di lavoro. Il livello più alto vince."));
  gruppo("Rischio ELEVATO se:", CRITERI_ELEVATO.map((c) => [c.id, c.testo]), "criteri");
  gruppo("Rischio MEDIO se:", CRITERI_MEDIO.map((c) => [c.id, c.testo]), "criteri");
  gruppo("Rischio BASSO se:", CRITERI_BASSO.map((c) => [c.id, c.testo]), "criteri");
  gruppo("Riduzione del livello elevato (dichiarata dal professionista):", RIDUZIONI.map((c) => [c.id, c.testo]), "riduzioni");

  form.append(el("div", "gsa-titolo", "7. Vie di uscita del piano (DM 10/3/1998, punti 3.3-3.5)"));
  const es = d.esodo;
  const numE = (chiave, etichetta) => {
    const i = el("input"); i.type = "number"; i.min = "0"; i.step = "0.1"; i.value = es[chiave];
    i.onchange = () => { es[chiave] = i.value; segna(); };
    return campo(etichetta, i);
  };
  numE("distanzaDueVie_m", "Distanza massima all'uscita con due vie di uscita (m)");
  numE("distanzaUnaVia_m", "Percorso in una sola direzione fino al punto con due vie (m)");
  numE("affollamento", "Affollamento del piano (persone presenti)");
  numE("numeroUscite", "Numero di uscite di piano");
  numE("larghezzaUscite_m", "Larghezza complessiva delle uscite di piano (m)");
  for (const [k, t] of [["pubblico", "Frequentato dal pubblico"], ["assistenza", "Persone che necessitano di assistenza"], ["materialiInfiammabili", "Materiali infiammabili depositati o manipolati"], ["areaRiposo", "Area di riposo"]]) {
    const i = el("input"); i.type = "checkbox"; i.checked = !!es[k];
    i.onchange = () => { es[k] = i.checked; segna(); };
    const l = el("label", "gsa-check"); l.append(i, " " + t); form.append(l);
  }

  form.append(el("div", "gsa-titolo", "8. Documenti"));
  tri("doc_vr", "Documento di valutazione dei rischi con parte antincendio");
  tri("doc_piano", "Piano di emergenza con planimetria");
  tri("doc_attestati", "Attestati di formazione e aggiornamento degli addetti");
  tri("doc_registro", "Registro delle esercitazioni e dei controlli");
  tri("doc_informazione", "Attestazione della formazione antincendio dei lavoratori");
  box.append(form);

  const bottone = el("button", "gsa-calcola", "Calcola GSA");
  bottone.onclick = () => { risultato = calcolaTutto(d); calcolatoCon = JSON.stringify(d); disegna(); };
  const stale = el("div", "gsa-stale");
  const esito = el("div", "gsa-esito");
  box.append(bottone, stale, esito);

  function segna() {
    if (risultato) stale.textContent = "I dati sono cambiati: premi Calcola GSA per aggiornare il risultato.";
    if (risultato && JSON.stringify(d) !== calcolatoCon) { risultato = null; esito.innerHTML = ""; }
  }

  function disegna() {
    esito.innerHTML = "";
    stale.textContent = "";
    if (!risultato) return;
    const rs = risultato.rischio;
    esito.append(el("div", "gsa-titolo", "Rischio di incendio (DM 10/3/1998, punto 1.4.4)"));
    if (!rs.motivi.length) esito.append(el("div", "riga-risultato avviso", "Nessun criterio selezionato."));
    else {
      esito.append(el("div", "riga-risultato ok", `Livello di rischio: ${rs.livello.toUpperCase()}${rs.livelloFinale !== rs.livello ? ` → ridotto a ${rs.livelloFinale.toUpperCase()} (riduzione dichiarata)` : ""}`));
      for (const m of rs.motivi) esito.append(el("div", "riga-risultato", m));
    }
    for (const n of rs.note) esito.append(el("div", "riga-risultato avviso", n));
    esito.append(el("div", "gsa-titolo", "Vie di uscita (DM 10/3/1998, punti 3.3-3.5)"));
    for (const x of risultato.esodo.esiti) esito.append(el("div", `riga-risultato ${x.ok === true ? "ok" : x.ok === false ? "avviso" : ""}`, `${x.ok === true ? "✓ CONFORME" : x.ok === false ? "✗ NON CONFORME" : "— da verificare"}: ${x.testo} [${x.riferimento}]`));
    if (risultato.esodo.cauto) esito.append(el("div", "gsa-nota", "Limiti ridotti per pubblico, assistenza, riposo o materiali infiammabili (punto 3.4)."));
    const r = risultato.base;
    const rigo = (t, cls = "") => esito.append(el("div", `riga-risultato ${cls}`, t));
    rigo(`Livello dei corsi addetti (all. III, DM 2/9/2021): ${r.livello.livello}. ${r.livello.motivo}.`, "ok");
    const p = r.piano;
    rigo(p.obbligatorio ? `Piano di emergenza obbligatorio: ${p.motivi.join("; ")}.` : "Piano di emergenza non obbligatorio.", p.obbligatorio ? "ok" : "");
    if (p.misureSemplificate) rigo("Per questo esercizio è ammessa la forma semplificata (all. II par. 4).");
    if (!p.obbligatorio) rigo(p.senzaPiano);
    esito.append(el("div", "gsa-titolo", "Obblighi"));
    for (const o of r.obblighi) rigo(`${o.testo} [${o.riferimento}]`);
    esito.append(el("div", "gsa-titolo", "Corsi e scadenze"));
    rigo(`Corso addetti: formazione ${r.livello.corsi.formazione.sigla} (${r.livello.corsi.formazione.ore} ore); aggiornamento ${r.livello.corsi.aggiornamento.sigla} (${r.livello.corsi.aggiornamento.ore} ore) ogni 5 anni [art. 5, all. III].`);
    for (const s of r.scadenze) rigo(`Scadenza: ${s.testo} → ${s.data}`);
    if (r.planimetria) {
      esito.append(el("div", "gsa-titolo", "Planimetria del piano"));
      for (const e of r.planimetria) rigo(`${e.presente ? "✓" : "✗"} ${e.testo}`, e.presente ? "ok" : "avviso");
    }
    esito.append(el("div", "gsa-titolo", "Documenti"));
    for (const doc of r.documenti) {
      const stato = doc.presente === true ? "presente" : doc.presente === false ? "manca" : "da verificare";
      rigo(`${doc.obbligatorio ? "" : "(se previsto) "}${doc.nome}: ${stato} [${doc.riferimento}]`, doc.presente === true ? "ok" : doc.obbligatorio ? "avviso" : "");
    }
    if (risultato.mancanti.length) {
      esito.append(el("div", "gsa-titolo", `Per completare il calcolo (${risultato.mancanti.length})`));
      for (const m of risultato.mancanti) rigo(`• ${m}`, "avviso");
    } else rigo("Tutti i dati necessari sono inseriti.", "ok");
    const f = el("div", "gsa-fonte");
    f.append(el("span", "", "Fonti: "), Object.assign(el("a", "", GSA_FONTE.documento + ", " + GSA_FONTE.gazzetta), { href: GSA_FONTE.url, target: "_blank", rel: "noopener" }), document.createElement("br"), Object.assign(el("a", "", FONTE_1998.documento), { href: FONTE_1998.url, target: "_blank", rel: "noopener" }));
    esito.append(f);
  }
  return { calcola: () => bottone.click(), stato: () => ({ risultato: !!risultato }) };
}
