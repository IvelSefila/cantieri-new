import { preparaProgetto } from '../core/sessione.js?v=v20261021a';

// I documenti originali sono separati dai metadati: l'elenco non carica tutti i PDF in RAM.
export function apriArchivio(factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!factory) return reject(new Error('Archivio locale non disponibile in questo browser'));
    const request = factory.open('cantieri.planimetrie', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('piante', { keyPath: 'id' });
      request.result.createObjectStore('documenti');
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Chiudi le altre schede Cantieri per aprire l’archivio'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      const transazione = (stores, modo, esegui) => new Promise((ok, no) => {
        const tx = db.transaction(stores, modo);
        let risultato;
        tx.oncomplete = () => ok(risultato);
        tx.onerror = () => no(tx.error);
        tx.onabort = () => no(tx.error || new Error('Salvataggio annullato'));
        try{esegui(tx, value => { risultato = value; });}
        catch(e){tx.abort();no(e);}
      });
      resolve({
        elenco: () => transazione(['piante'], 'readonly', (tx, done) => {
          const r = tx.objectStore('piante').getAll();
          r.onsuccess = () => done(r.result.sort((a,b) => b.modificato.localeCompare(a.modificato)));
        }),
        documento: id => transazione(['documenti'], 'readonly', (tx, done) => {
          const r = tx.objectStore('documenti').get(id);
          r.onsuccess = () => done(r.result);
        }),
        salva: voce => {
          const progetto = voce.progetto ? preparaProgetto(voce.progetto) : null;
          const record = { id: voce.id || crypto.randomUUID(), titolo: String(voce.titolo || 'Planimetria'), origine: voce.origine || 'json', modificato: new Date().toISOString(), progetto, haDocumento: !!voce.file || !!voce.haDocumento };
          return transazione(['piante', 'documenti'], 'readwrite', (tx, done) => {
            tx.objectStore('piante').put(record);
            if (voce.file) tx.objectStore('documenti').put(voce.file, record.id);
            done(record);
          });
        },
        chiudi: () => db.close(),
      });
    };
  });
}
