/* ============================================================
   Sorozat-modell: a nyers sorokból (series / issues / components + a saját
   státusz és szám-adat) az app működő adatmodellje. TISZTA függvény (nincs
   DOM/hálózat) — scripts/tests/model.test.mjs.

   FONTOS: a TÖRÖLT (is_deleted) komponens itt kiszűrődik, ezért sehol nem
   jelenik meg (számlálók, haladásjelzők, színezés, összeg, sor, panel,
   státuszgombok, Gyors Excel, felkiáltójel-logika, Saját adatlap) — egyetlen
   szűrési pont. A személyes adatok (member_status) az adatbázisban megmaradnak.
   ============================================================ */
import { PAL_FALLBACK, allComps } from "./state.js";

export function buildSeriesModel({ series, issues, comps, myStatus = {}, myIssue = {}, selectedIds, seenOf = () => 0, pendingByComp = {}, pendingBySeries = {} }){
  const byS={}, byI={};
  // A fülsáv csak a SAJÁT, bepipált sorozatokból épül (member_series.is_selected) — nem az összesből.
  const out = series.filter(r=>selectedIds.has(r.id)).map(r=>{ const o={id:r.id,kiado:r.kiado,kategoria:r.kategoria||null,sorozat:r.megnevezes,display:r.megjelenites,accent:r.szin||PAL_FALLBACK,components:r.components||[],template:Array.isArray(r.component_template)?r.component_template:[],kodSzam:r.kod_szam||null,version:r.version||1,changed:(r.version||1)>seenOf("series",r.id),
      borito_url:r.borito_url||null, borito_upload_enabled:!!r.borito_upload_enabled, pendingBorito:pendingBySeries[r.id]||null,
      fdRequestedAt:r.force_delete_requested_at||null, fdGraceEnd:r.force_delete_grace_end||null, items:[]}; byS[r.id]=o; return o; });
  issues.forEach(r=>{ const mi=myIssue[r.id]||{}; const o={id:r.id,n:r.lapszam,name:r.cim,date:r.megjelenes,
      eredeti_ar:r.eredeti_ar, version:r.version||1, ownChanged:(r.version||1)>seenOf("issue",r.id), deleted:!!r.is_deleted,
      fizetett_ar:(mi.fizetett_ar==null?null:mi.fizetett_ar),besz_menny:(mi.besz_menny==null?1:mi.besz_menny),besz_datum:mi.besz_datum||null,forras:mi.forras||null,ar_auto:(mi.ar_auto==null?true:mi.ar_auto),
      comps:{}}; byI[r.id]=o; const ser=byS[r.series_id]; if(ser) ser.items.push(o); });
  // it.comps[tipus] TÖMB — egy típusból több, egyedi Megnevezésű példány is
  // lehet egy Számon (a "Megnevezés" mező bevezetése óta), ezért itt push,
  // nem felülírás. A típuson belüli sorrend created_at szerint stabil.
  comps.forEach(r=>{ const it=byI[r.issue_id]; if(!it) return;
    if(r.is_deleted) return;   // TÖRÖLT komponens: sehol nem jelenik meg (számlálók, haladás, szín, összeg, sor, panel, gombok, Excel, felkiáltójel)
    const my=myStatus[r.id]||{status:null,db:1,jegyzet:null};
    const comp={id:r.id,tipus:r.tipus,is_main:!!r.is_main,status:my.status,azonosito:r.azonosito,azonosito_tipus:r.azonosito_tipus,megnevezes:r.megnevezes||null,note:my.jegyzet,kep_url:r.kep_url,db:my.db,
      created_at:r.created_at,
      version:r.version||1,changed:(r.version||1)>seenOf("component",r.id),
      upload_enabled:!!r.upload_enabled, pending:pendingByComp[r.id]||null};
    (it.comps[r.tipus]=it.comps[r.tipus]||[]).push(comp);
  });
  out.forEach(x=>{ x.items.sort((a,b)=>a.n-b.n);
    x.items.forEach(it=>{
      Object.values(it.comps).forEach(arr=>arr.sort((a,b)=>(a.created_at||"").localeCompare(b.created_at||"")));
      it.changed = it.ownChanged || allComps(it).some(c=>c.changed);
    });
    x.anyChanged = x.changed || x.items.some(it=>it.changed);
  });
  return out;
}
