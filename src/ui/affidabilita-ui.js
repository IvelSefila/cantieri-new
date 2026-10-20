// Scheda "Affidabilità": per ogni motore mostra lo stato (esatto, esatto sui dati, stima, mancano dati),
// cosa è approssimato e perché, cosa serve per il 100 % e quali documenti servono.
import { STATI, NOTA_PONTI_10, valutaMotori, riepilogo } from "../core/precisione.js?v=v20261020bv";
import { NORME, DATA_VERIFICA } from "../core/registro-norme.js?v=v20261020bv";

function el(tag, cls, testo) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (testo !== undefined) e.textContent = testo;
  return e;
}

export function renderAffidabilita(box, contesto) {
  const motori = valutaMotori(contesto);
  const conta = riepilogo(motori);
  box.innerHTML = "";

  const legenda = el("div", "aff-legenda");
  for (const [k, s] of Object.entries(STATI)) {
    const r = el("div", "aff-legenda-riga");
    r.append(el("span", `badge-stato ${k}`, s.etichetta), ` ${s.spiegazione} (${conta[k]})`);
    legenda.append(r);
  }
  box.append(legenda);

  for (const m of motori) {
    const card = el("div", `aff-card ${m.stato}`);
    const testa = el("div", "aff-testa");
    testa.append(el("span", "aff-nome", m.nome), el("span", `badge-stato ${m.stato}`, STATI[m.stato].etichetta));
    card.append(testa);
    if (m.approssimazioni.length) {
      card.append(el("div", "aff-titolo", "Cosa è approssimato e perché"));
      const ul = el("ul");
      for (const a of m.approssimazioni) {
        const li = el("li");
        li.append(el("b", "", `${a.dato}: `), a.perche);
        ul.append(li);
      }
      card.append(ul);
    }
    if (m.perIl100.length) {
      card.append(el("div", "aff-titolo", "Cosa serve per un risultato preciso al 100 %"));
      const ul = el("ul");
      for (const x of m.perIl100) ul.append(el("li", "", x));
      card.append(ul);
    }
    if (m.documenti.length) {
      card.append(el("div", "aff-titolo", "Documenti necessari"));
      const ul = el("ul", "aff-doc");
      for (const d of m.documenti) {
        const segno = d.presente === true ? "✓ presente" : d.presente === false ? "✗ manca" : "da fornire";
        const li = el("li", d.presente === true ? "ok" : d.presente === false ? "manca" : "");
        li.append(el("span", "aff-segno", `[${segno}] `), d.nome);
        ul.append(li);
      }
      card.append(ul);
    }
    box.append(card);
  }

  const ponti = el("details", "aff-card");
  ponti.append(el("summary", "", "Perché non c'è più la maggiorazione del 10 % sui ponti termici"), el("div", "riga info", NOTA_PONTI_10));
  box.append(ponti);

  const norme = el("details", "aff-card");
  norme.append(el("summary", "", `Norme e fonti (verifica del ${DATA_VERIFICA})`));
  const ul = el("ul");
  for (const n of Object.values(NORME)) {
    const li = el("li");
    li.append(el("b", "", `${n.titolo} `), `[${n.stato}] ${n.dettaglio}`);
    if (n.fonte) {
      const a = el("a", "", " fonte");
      a.href = n.fonte;
      a.target = "_blank";
      a.rel = "noopener";
      li.append(a);
    }
    ul.append(li);
  }
  norme.append(ul);
  box.append(norme);
  return motori;
}
