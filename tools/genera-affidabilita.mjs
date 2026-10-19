// Genera docs/AFFIDABILITA.md dal registro dei motori (src/core/precisione.js) e delle norme (registro-norme.js).
// Uso: node tools/genera-affidabilita.mjs
import { writeFileSync } from "node:fs";
import { valutaMotori, STATI, NOTA_PONTI_10 } from "../src/core/precisione.js";
import { NORME, DATA_VERIFICA } from "../src/core/registro-norme.js";

const righe = [];
righe.push("# Affidabilità dei calcoli", "");
righe.push("Documento generato da `src/core/precisione.js` con `node tools/genera-affidabilita.mjs`. Lo stesso contenuto è nella scheda **Affidabilità** del sito, aggiornato in tempo reale con i dati del progetto aperto.", "");
righe.push("Stati possibili:", "");
for (const s of Object.values(STATI)) righe.push(`- **${s.etichetta}**: ${s.spiegazione}`);
righe.push("", "Stato mostrato qui sotto: progetto senza dati inseriti (caso peggiore).", "");
for (const m of valutaMotori({})) {
  righe.push(`## ${m.nome}`, "", `Stato senza dati: **${STATI[m.stato].etichetta}**`, "");
  if (m.approssimazioni.length) {
    righe.push("Cosa è approssimato e perché:", "");
    for (const a of m.approssimazioni) righe.push(`- **${a.dato}**: ${a.perche}`);
    righe.push("");
  }
  righe.push("Cosa serve per un risultato preciso al 100 %:", "");
  for (const x of m.perIl100) righe.push(`- ${x}`);
  righe.push("");
  if (m.documenti.length) {
    righe.push("Documenti necessari:", "");
    for (const d of m.documenti) righe.push(`- ${d.nome}`);
    righe.push("");
  }
}
righe.push("## Perché non c'è più la maggiorazione del 10 % sui ponti termici", "", NOTA_PONTI_10, "");
righe.push(`## Norme e fonti (verifica del ${DATA_VERIFICA})`, "");
for (const n of Object.values(NORME)) righe.push(`- **${n.titolo}** [${n.stato}]: ${n.dettaglio}${n.fonte ? ` ([fonte](${n.fonte}))` : ""}`);
righe.push("");
writeFileSync(new URL("../docs/AFFIDABILITA.md", import.meta.url), righe.join("\n"), "utf-8");
console.log("docs/AFFIDABILITA.md scritto");
