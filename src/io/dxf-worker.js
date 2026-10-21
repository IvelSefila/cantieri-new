import {parseDxf} from './dxf.js?v=v20261021f';
import {dxfToPlan} from './toPlan.js?v=v20261021f';
import {preparaProgetto} from '../core/sessione.js?v=v20261021f';
import {stanze} from '../core/rooms.js?v=v20261021f';
self.onmessage=async({data:{file,opzioni}})=>{
  try {
    const result=dxfToPlan(parseDxf(await file.text(),opzioni),{...opzioni,nome:file.name});
    if(!result.check.ok||!result.plan.walls.length)throw Error(result.check.errors.join('; ')||'Il DXF non contiene segmenti supportati');
    // Verifica anche l'espansione delle intersezioni prima di applicare il
    // progetto sul thread principale. Il timeout può interrompere questa fase.
    stanze(result.plan.walls);
    self.postMessage({progetto:preparaProgetto(result.plan),report:result.report});
  }catch(e){self.postMessage({errore:e.message||String(e)});}
};
