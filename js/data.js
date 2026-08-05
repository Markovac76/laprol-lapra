/* ============================================================
   Adatbetöltés a Supabase-ből, statisztika, újratöltés.
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, OWNER_UID, PAL_FALLBACK, todayISO, issueState, dominantType, hasOwnedComponent } from "./state.js";
import { renderAll } from "./render.js";
import { err } from "./modal.js";

export async function loadData(){
  document.getElementById("list").innerHTML=`<div class="loading">Adatok betöltése…</div>`;
  const { data: userData } = await supabase.auth.getUser();
  state.myId = userData?.user?.id || null;
  state.isOwner = state.myId === OWNER_UID;
  const [s,i,c,l,ms,mid,msel,msn,ip]=await Promise.all([
    supabase.from("series").select("*").order("sort_order"),
    supabase.from("issues").select("*"),
    supabase.from("components").select("*"),
    supabase.from("lists").select("*").order("sort_order"),
    supabase.from("member_status").select("*").eq("user_id",state.myId),
    supabase.from("member_issue_data").select("*").eq("user_id",state.myId),
    supabase.from("member_series").select("series_id").eq("user_id",state.myId).eq("is_selected",true),
    supabase.from("member_seen").select("*").eq("user_id",state.myId),
    supabase.from("image_proposals").select("*").eq("status","pending"),
  ]);
  if(s.error||i.error||c.error){ throw (s.error||i.error||c.error); }
  state.LISTS={};
  if(!l.error && l.data) l.data.forEach(r=>{ (state.LISTS[r.tipus]=state.LISTS[r.tipus]||[]).push({ertek:r.ertek,nev:r.megjelenites||r.ertek}); });
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
  // Függő képjavaslatok komponensenként (globálisan olvasható — mindenkinek
  // látnia kell, hogy már fut-e javaslat, mielőtt sajátot próbálna beküldeni).
  const pendingByComp={};
  if(!ip.error && ip.data) ip.data.forEach(r=>{ pendingByComp[r.component_id]=r; });
  // A fülsáv csak a SAJÁT, bepipált sorozatokból épül (member_series.is_selected) — nem az összesből.
  const selectedIds = new Set((msel.data||[]).map(r=>r.series_id));
  const byS={}, byI={};
  state.SERIES = s.data.filter(r=>selectedIds.has(r.id)).map(r=>{ const o={id:r.id,kiado:r.kiado,sorozat:r.megnevezes,display:r.megjelenites,accent:r.szin||PAL_FALLBACK,components:r.components||[],kodSzam:r.kod_szam||null,version:r.version||1,changed:(r.version||1)>seenOf("series",r.id),items:[]}; byS[r.id]=o; return o; });
  i.data.forEach(r=>{ const mi=myIssue[r.id]||{}; const o={id:r.id,n:r.lapszam,name:r.cim,date:r.megjelenes,
      eredeti_ar:r.eredeti_ar, version:r.version||1, ownChanged:(r.version||1)>seenOf("issue",r.id),
      fizetett_ar:(mi.fizetett_ar==null?null:mi.fizetett_ar),besz_menny:(mi.besz_menny==null?1:mi.besz_menny),besz_datum:mi.besz_datum||null,forras:mi.forras||null,ar_auto:(mi.ar_auto==null?true:mi.ar_auto),
      comps:{}}; byI[r.id]=o; const ser=byS[r.series_id]; if(ser) ser.items.push(o); });
  c.data.forEach(r=>{ const it=byI[r.issue_id]; if(!it) return;
    const my=myStatus[r.id]||{status:null,db:1,jegyzet:null};
    it.comps[r.tipus]={id:r.id,status:my.status,azonosito:r.azonosito,azonosito_tipus:r.azonosito_tipus,note:my.jegyzet,kep_url:r.kep_url,db:my.db,
      version:r.version||1,changed:(r.version||1)>seenOf("component",r.id),
      upload_enabled:!!r.upload_enabled, pending:pendingByComp[r.id]||null};
  });
  state.SERIES.forEach(x=>{ x.items.sort((a,b)=>a.n-b.n);
    x.items.forEach(it=>{ it.changed = it.ownChanged || Object.values(it.comps).some(c=>c.changed); });
    x.anyChanged = x.changed || x.items.some(it=>it.changed);
  });
  if(state.activeIdx>=state.SERIES.length) state.activeIdx=0;
}

export function stats(si){
  const s=state.SERIES[si]; const perType={}; s.components.forEach(t=>perType[t]={owned:0,total:s.items.length});
  const dt=dominantType(s);   // a lapszám-színezéssel megegyező domináns komponens
  let eredetiTotal=0, fizetettTotal=0, eredetiUnknown=false, fizetettUnknown=false, beszerzendo=0, next=null, hasFuture=false;
  for(const it of s.items){
    const future=it.date&&it.date>todayISO;
    if(future) hasFuture=true;
    // Eredeti ár alapján: a DOMINÁNS komponens 'megvan' (= zöld lapszám) → beszámít; szorzó a domináns darabszáma.
    if(dt){
      const dc=it.comps[dt];
      if(dc && dc.status==="megvan"){
        if(it.eredeti_ar!=null) eredetiTotal += it.eredeti_ar * (dc.db||1);
        else eredetiUnknown=true;   // van bevont tétel, de "nem ismert" árral
      }
    }
    // Fizetett ár alapján: ≥1 komponens 'megvan' → beszámít; szorzó a beszerzési mennyiség.
    if(hasOwnedComponent(it,s)){
      if(it.fizetett_ar!=null) fizetettTotal += it.fizetett_ar * (it.besz_menny||1);
      else fizetettUnknown=true;
    }
    for(const t of s.components){ const st=it.comps[t]?it.comps[t].status:null;
      if(st==="megvan") perType[t].owned++; }
    // Beszerzendő: LAPSZÁM-szinten — ami megjelent, és se nem kész (zöld), se nem kihúzott (szürke)
    if(!future){ const istate=issueState(it,s); if(istate!=="megvan" && istate!=="nemkell") beszerzendo++; }
    const anyOpen=s.components.some(t=>{const st=it.comps[t]?it.comps[t].status:null; return st!=="megvan"&&st!=="nemkell";});
    if(anyOpen && it.date && it.date>=todayISO){ if(!next||it.date<next.date) next=it; }
  }
  return {perType,eredetiTotal,fizetettTotal,eredetiUnknown,fizetettUnknown,beszerzendo,next,hasFuture};
}

export async function reload(){
  const keep=state.activeIdx;
  try{ await loadData(); }catch(e){ err(e); return; }
  state.activeIdx = keep<state.SERIES.length?keep:0; state.openIssue=null; renderAll();
}
