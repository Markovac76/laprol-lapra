/* ============================================================
   Adatbetöltés a Supabase-ből, statisztika, újratöltés.
   ============================================================ */
import { supabase, fetchAllRows } from "./supabase.js";
import { computeTotals } from "./totals.js";
import { buildSeriesModel } from "./model.js";
import { state, OWNER_UID, PAL_FALLBACK, isFutureDate, issueState, compsOfType, allComps, sortEgyebLast } from "./state.js";
import { renderAll } from "./render.js";
import { err } from "./modal.js";

export async function loadData(){
  document.getElementById("list").innerHTML=`<div class="loading">Adatok betöltése…</div>`;
  const { data: userData } = await supabase.auth.getUser();
  state.myId = userData?.user?.id || null;
  state.isOwner = state.myId === OWNER_UID;
  const [s,i,c,l,ms,mid,msel,msn,ip,td]=await Promise.all([
    fetchAllRows(()=>supabase.from("series").select("*").order("sort_order")),
    fetchAllRows(()=>supabase.from("issues").select("*")),
    fetchAllRows(()=>supabase.from("components").select("*")),
    supabase.from("lists").select("*").order("sort_order"),
    fetchAllRows(()=>supabase.from("member_status").select("*").eq("user_id",state.myId)),
    fetchAllRows(()=>supabase.from("member_issue_data").select("*").eq("user_id",state.myId)),
    supabase.from("member_series").select("series_id").eq("user_id",state.myId).eq("is_selected",true),
    fetchAllRows(()=>supabase.from("member_seen").select("*").eq("user_id",state.myId), ["entity_type","entity_id"]),
    supabase.from("image_proposals").select("*").eq("status","pending"),
    supabase.from("component_type_defs").select("*"),   // típusleírás (alapértelmezett azonosító-típus stb.); hiánya nem végzetes
  ]);
  if(s.error||i.error||c.error){ throw (s.error||i.error||c.error); }
  state.TYPEDEFS={};
  if(!td.error && td.data) td.data.forEach(r=>{ state.TYPEDEFS[r.tipus]=r; });
  state.LISTS={};
  if(!l.error && l.data) l.data.forEach(r=>{ (state.LISTS[r.tipus]=state.LISTS[r.tipus]||[]).push({ertek:r.ertek,nev:r.megjelenites||r.ertek}); });
  // "Egyéb" mindig az utolsó (13. pont) — minden legördülő/választó ezt a sorrendet használja.
  Object.keys(state.LISTS).forEach(k=>{ state.LISTS[k]=sortEgyebLast(state.LISTS[k]); });
  const myStatus={};
  if(!ms.error && ms.data) ms.data.forEach(r=>{ myStatus[r.component_id]={status:r.status,db:(r.db==null?1:r.db),jegyzet:r.jegyzet}; });
  const myIssue={};   // szám-szintű SZEMÉLYES adat (member_issue_data)
  if(!mid.error && mid.data) mid.data.forEach(r=>{ myIssue[r.issue_id]={fizetett_ar:r.fizetett_ar,besz_menny:(r.beszerzesi_mennyiseg==null?1:r.beszerzesi_mennyiseg),besz_datum:r.beszerzes_datuma,forras:r.forras,ar_auto:(r.ar_auto==null?true:r.ar_auto)}; });
  // Verziókövetés: "utoljára látott verzió" entitásonként — hiányzó sor = 0
  // (még sosem látta), ezt a kiválasztáskori seed_member_seen() előzi meg,
  // hogy ne jelezzen hamisan olyasmit, amit a user sosem látott másképp.
  const seenMap={};
  if(!msn.error && msn.data) msn.data.forEach(r=>{ seenMap[r.entity_type+":"+r.entity_id]=r.last_seen_version; });
  const seenOf=(type,id)=> seenMap[type+":"+id] ?? 0;
  // Függő képjavaslatok — komponensenként ÉS sorozat-szintű borítónként
  // (globálisan olvasható — mindenkinek látnia kell, hogy már fut-e
  // javaslat, mielőtt sajátot próbálna beküldeni). Az entity_type dönti el,
  // melyik map-be kerül (a másikban a hiányzó id-kulcs miatt nem zavarna
  // egyébként sem, de explicit szűrés a világosabb).
  const pendingByComp={}, pendingBySeries={};
  if(!ip.error && ip.data) ip.data.forEach(r=>{
    if(r.entity_type==="series") pendingBySeries[r.series_id]=r;
    else pendingByComp[r.component_id]=r;
  });
  // A fülsáv csak a SAJÁT, bepipált sorozatokból épül (member_series.is_selected) — nem az összesből.
  const selectedIds = new Set((msel.data||[]).map(r=>r.series_id));
  state.SERIES = buildSeriesModel({ series:s.data, issues:i.data, comps:c.data, myStatus, myIssue, selectedIds, seenOf, pendingByComp, pendingBySeries });
  if(state.activeIdx>=state.SERIES.length) state.activeIdx=0;
}

export function stats(si){
  const s=state.SERIES[si]; const activeItems=s.items.filter(it=>!it.deleted);
  // Haladásjelzők típusonként: nevező = azoknak a Számoknak a száma, amelyeken van legalább egy
  // ilyen típusú komponens; a deklarált típusok mellett a Számokon külön hozzáadott típusok is
  // (pl. egy Limited Edition kártya) saját jelzőt kapnak. A deklarált típusoknál ez ma az összes Szám.
  const extraTypes = new Set();
  activeItems.forEach(it=>Object.keys(it.comps||{}).forEach(t=>{ if(!s.components.includes(t) && compsOfType(it,t).length) extraTypes.add(t); }));
  const progTypes = s.components.concat([...extraTypes].sort());
  const perType={}; progTypes.forEach(t=>perType[t]={owned:0,total:0});
  // Az összeg mindkét nézete EGY közös számításból jön (totals.js): azok a Számok,
  // amelyeken ≥1 komponens megvan; szorzó a beszerzési mennyiség.
  const tot=computeTotals(activeItems);
  let beszerzendo=0, next=null, hasFuture=false;
  for(const it of activeItems){
    const future=isFutureDate(it.date);
    if(future) hasFuture=true;
    // Típusonkénti haladás: egy típus akkor "owned" egy Számon, ha MINDEN példánya megvan.
    for(const t of progTypes){ const inst=compsOfType(it,t);
      if(inst.length){ perType[t].total++; if(inst.every(c=>c.status==="megvan")) perType[t].owned++; } }
    // Beszerzendő: LAPSZÁM-szinten — ami megjelent, és se nem kész (zöld), se nem kihúzott (szürke)
    if(!future){ const istate=issueState(it,s); if(istate!=="megvan" && istate!=="nemkell") beszerzendo++; }
    const anyOpen=s.components.some(t=>compsOfType(it,t).some(c=>c.status!=="megvan"&&c.status!=="nemkell"));
    if(anyOpen && isFutureDate(it.date)){ if(!next||it.date<next.date) next=it; }   // a mai dátumú Szám már megjelent
  }
  return {perType,...tot,beszerzendo,next,hasFuture};
}

export async function reload(){
  const keep=state.activeIdx;
  try{ await loadData(); }catch(e){ err(e); return; }
  state.activeIdx = keep<state.SERIES.length?keep:0; state.openIssue=null; renderAll();
}
