// Fattore di correzione per l'irraggiamento incidente Fsol,est (DM 26/06/2015 come aggiornato dal DM 28/10/2025,
// Allegato 1, par. 2.2):
//   Fsol,est = irradianza media di LUGLIO, nella località e sull'esposizione / irradianza media ANNUA di Roma sul
//   piano orizzontale.
// Dati: UNI 10349:2016 di Roma (src/core/clima.js). Per una località diversa da Roma il numeratore cambia:
// servono i dati UNI 10349 di quel comune.
import { UNI10349_ROMA, irradianzaMedia_W_m2, irradianzaMediaAnnuaOrizzontale_W_m2 } from "./clima.js?v=v20261020bp";

const LUGLIO = 6;

export const FONTE_FSOL = UNI10349_ROMA.fonte;

// Fsol,est per orientamento (N, NE, E, SE, S, SO, O, NO) o "Oriz". Restituisce null se l'orientamento non esiste.
export function fsolEst(orientamento, dati = UNI10349_ROMA) {
  const luglio = irradianzaMedia_W_m2(orientamento, LUGLIO, dati);
  if (luglio === null) return null;
  return luglio / irradianzaMediaAnnuaOrizzontale_W_m2(UNI10349_ROMA);
}
