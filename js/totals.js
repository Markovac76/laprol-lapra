/* ============================================================
   Sorozat-összeg ("Összeg" kártya) — EGY közös számítás mindkét nézethez.
   Tiszta függvény (nincs DOM/hálózat), Node-ban tesztelhető:
   scripts/tests/totals.test.mjs

   Szabály (a tulajdonos döntése, "C változat", v1.23):
   - Mely Számok számítanak: a NEM törölt Számok, amelyeken LEGALÁBB EGY
     komponens `megvan` (a felhasználó saját állapota szerint).
   - Szorzó MINDKÉT nézetben a beszerzési mennyiség (member_issue_data.
     beszerzesi_mennyiseg; hiányzó érték = 1) — a komponens darabszáma (db)
     NEM szorzó. Az ár a Szám (a magazin) ára; a melléklet (pl. lego) külön
     ára nincs nyilvántartva.
   - "Eredeti ár alapján":  issues.eredeti_ar × beszerzési mennyiség
   - "Fizetett ár alapján": member_issue_data.fizetett_ar × beszerzési mennyiség
   Hiányzó (NULL) ár: kimarad a Ft-összegből, és az "unknown" jelző be van
   kapcsolva ("+ nem ismert"). A "count" a ténylegesen összegzett (ismert
   árú) Számok száma az adott nézetben.
   ============================================================ */
import { allComps } from "./state.js";

export function computeTotals(items){
  let eredetiTotal=0, fizetettTotal=0, eredetiCount=0, fizetettCount=0;
  let eredetiUnknown=false, fizetettUnknown=false, includedCount=0;
  for(const it of items||[]){
    if(it.deleted) continue;
    if(!allComps(it).some(c=>c.status==="megvan")) continue;   // ténylegesen megvett Szám
    includedCount++;
    const qty = it.besz_menny || 1;                            // beszerzési mennyiség (hiányzó = 1)
    if(it.eredeti_ar!=null){ eredetiTotal += it.eredeti_ar * qty; eredetiCount++; }
    else eredetiUnknown = true;
    if(it.fizetett_ar!=null){ fizetettTotal += it.fizetett_ar * qty; fizetettCount++; }
    else fizetettUnknown = true;
  }
  return { eredetiTotal, fizetettTotal, eredetiCount, fizetettCount, eredetiUnknown, fizetettUnknown, includedCount };
}
