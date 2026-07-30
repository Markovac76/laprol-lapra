/* ============================================================
   Adatbetöltés a Supabase-ből, statisztika, újratöltés.
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, OWNER_UID, PAL_FALLBACK, todayISO, issueState, hasOwnedComponent } from "./state.js";
import { renderAll } from "./render.js";
import { err } from "./modal.js";

export async function loadData(){
  document.getElementById("list").innerHTML=`<div class="loading">Adatok betöltése…</div>`;
  const { data: userData } = await supabase.auth.getUser();
  state.myId = userData?.user?.id || null;
  state.isOwner = state.myId === OWNER_UID;
  const [s,i,c,l,ms,mid]=await Promise.all([
    supabase.from("series").select("*").order("sort_order"),
    supabase.from("issues").select("*"),
    supabase.from("components").select("*"),
    supabase.from("lists").select("*").order("sort_order"),
    supabase.from("member_status").select("*").eq("user_id",state.myId),
    supabase.from("member_issue_data").select("*").eq("user_id",state.myId),
  ]);
  if(s.error||i.error||c.error){ throw (s.error||i.error||c.error); }
  state.LISTS={};
  if(!l.error && l.data) l.data.forEach(r=>{ (state.LISTS[r.tipus]=state.LISTS[r.tipus]||[]).push({ertek:r.ertek,nev:r.megjelenites||r.ertek}); });
  const myStatus={};
  if(!ms.error && ms.data) ms.data.forEach(r=>{ myStatus[r.component_id]={status:r.status,db:(r.db==null?1:r.db),jegyzet:r.jegyzet}; });
  const myIssue={};   // szám-szintű SZEMÉLYES adat (member_issue_data)
  if(!mid.error && mid.data) mid.data.forEach(r=>{ myIssue[r.issue_id]={fizetett_ar:r.fizetett_ar,besz_menny:(r.beszerzesi_mennyiseg==null?1:r.beszerzesi_mennyiseg),besz_datum:r.beszerzes_datuma,forras:r.forras}; });
  const byS={}, byI={};
  state.SERIES = s.data.map(r=>{ const o={id:r.id,kiado:r.kiado,sorozat:r.megnevezes,display:r.megjelenites,accent:r.szin||PAL_FALLBACK,components:r.components||[],kodSzam:r.kod_szam||null,items:[]}; byS[r.id]=o; return o; });
  i.data.forEach(r=>{ const mi=myIssue[r.id]||{}; const o={id:r.id,n:r.lapszam,name:r.cim,date:r.megjelenes,
      eredeti_ar:r.eredeti_ar,
      fizetett_ar:(mi.fizetett_ar==null?null:mi.fizetett_ar),besz_menny:(mi.besz_menny==null?1:mi.besz_menny),besz_datum:mi.besz_datum||null,forras:mi.forras||null,
      comps:{}}; byI[r.id]=o; const ser=byS[r.series_id]; if(ser) ser.items.push(o); });
  c.data.forEach(r=>{ const it=byI[r.issue_id]; if(!it) return;
    const my=myStatus[r.id]||{status:null,db:1,jegyzet:null};
    it.comps[r.tipus]={id:r.id,status:my.status,azonosito:r.azonosito,azonosito_tipus:r.azonosito_tipus,note:my.jegyzet,kep_url:r.kep_url,db:my.db};
  });
  state.SERIES.forEach(x=>x.items.sort((a,b)=>a.n-b.n));
  if(state.activeIdx>=state.SERIES.length) state.activeIdx=0;
}

// A "Eredeti ár alapján" nézet referencia-komponense: magazin → könyv → első típus.
export function refComponentType(s){
  return s.components.includes("magazin") ? "magazin"
       : s.components.includes("konyv")   ? "konyv"
       : (s.components[0]||null);
}

export function stats(si){
  const s=state.SERIES[si]; const perType={}; s.components.forEach(t=>perType[t]={owned:0,total:s.items.length});
  const refType=refComponentType(s);
  let eredetiTotal=0, fizetettTotal=0, beszerzendo=0, next=null, hasFuture=false;
  for(const it of s.items){
    const future=it.date&&it.date>todayISO;
    if(future) hasFuture=true;
    // Eredeti ár alapján: eredeti ár × a referencia-komponens AKTUÁLIS darabszáma, CSAK ha 'megvan'
    if(it.eredeti_ar!=null && refType){
      const rc=it.comps[refType];
      if(rc && rc.status==="megvan") eredetiTotal += it.eredeti_ar * (rc.db||1);
    }
    // Fizetett ár alapján: Σ (fizetett ár × beszerzési mennyiség) — CSAK ahol legalább
    // egy komponens 'megvan' (különben semmi nem lett ténylegesen megvéve)
    if(it.fizetett_ar!=null && hasOwnedComponent(it,s)) fizetettTotal += it.fizetett_ar * (it.besz_menny||1);
    for(const t of s.components){ const st=it.comps[t]?it.comps[t].status:null;
      if(st==="megvan") perType[t].owned++; }
    // Beszerzendő: LAPSZÁM-szinten — ami megjelent, és se nem kész (zöld), se nem kihúzott (szürke)
    if(!future){ const istate=issueState(it,s); if(istate!=="megvan" && istate!=="nemkell") beszerzendo++; }
    const anyOpen=s.components.some(t=>{const st=it.comps[t]?it.comps[t].status:null; return st!=="megvan"&&st!=="nemkell";});
    if(anyOpen && it.date && it.date>=todayISO){ if(!next||it.date<next.date) next=it; }
  }
  return {perType,eredetiTotal,fizetettTotal,beszerzendo,next,hasFuture};
}

export async function reload(){
  const keep=state.activeIdx;
  try{ await loadData(); }catch(e){ err(e); return; }
  state.activeIdx = keep<state.SERIES.length?keep:0; state.openIssue=null; renderAll();
}
