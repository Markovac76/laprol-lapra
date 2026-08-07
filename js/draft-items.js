/* ============================================================
   Draft tételek (szám + komponens) egy claim-elt draft_series-en
   belül — a Karbantartás "Szerkesztés" nézetének beágyazott listája.
   Csak törzsadat-mezők — nincs személyes réteg, a draft publikálás
   előtti állapot, még senkinek nincs rajta saját adata.
   ============================================================ */
import { supabase } from "./supabase.js";
import { COMP_TYPES, esc, fmtDate, opts } from "./state.js";
import { openModal, err } from "./modal.js";

export async function fetchDraftItems(draftSeriesId){
  const { data: issues, error: ie } = await supabase.from("draft_issues")
    .select("*").eq("draft_series_id", draftSeriesId).order("lapszam");
  if(ie) throw ie;
  const issueIds = (issues||[]).map(x=>x.id);
  let comps=[];
  if(issueIds.length){
    const { data, error: ce } = await supabase.from("draft_components").select("*").in("draft_issue_id", issueIds);
    if(ce) throw ce;
    comps = data||[];
  }
  return (issues||[]).map(it=>({...it, comps: comps.filter(c=>c.draft_issue_id===it.id)}));
}

export function renderDraftItemsList(items, components){
  if(!items.length) return `<p class="msub">Még nincs szám a draftban.</p>`;
  return items.map(it=>{
    const compsTxt = components.map(t=>{
      const c=it.comps.find(x=>x.tipus===t);
      return `${COMP_TYPES[t]||t}${c&&c.azonosito?": "+esc(c.azonosito):""}`;
    }).join(" · ");
    return `<div class="userrow"><div class="uinfo">
        <div class="uname">#${it.lapszam}${it.cim?" – "+esc(it.cim):""}</div>
        <div class="unote">${it.megjelenes?fmtDate(it.megjelenes):"nincs dátum"}${it.eredeti_ar!=null?" · "+it.eredeti_ar+" Ft":""}</div>
        <div class="unote">${compsTxt}</div>
      </div>
      <div class="uactions"><button data-diedit="${it.id}">Szerkesztés</button></div>
    </div>`;
  }).join("");
}

export function draftItemForm(draftSeriesId, existing, components, onDone){
  const it = existing || {lapszam:"", cim:"", megjelenes:"", eredeti_ar:"", comps:[]};
  const compBlocks = components.map(t=>{
    const c=(it.comps||[]).find(x=>x.tipus===t)||{};
    return `<div class="compedit">
      <h4>${COMP_TYPES[t]||t}</h4>
      <div class="grid2">
        <div class="field"><label>Azonosító típusa</label><select id="di-ct-${t}"><option value="">—</option>${opts("azonosito",c.azonosito_tipus)}</select></div>
        <div class="field"><label>Azonosító</label><input id="di-cid-${t}" value="${esc(c.azonosito||"")}"></div>
      </div>
    </div>`;
  }).join("");

  openModal(`<h2>${existing?"Szám szerkesztése (draft)":"Új szám (draft)"}</h2>
    <p class="msub">Munkaanyag — publikálásig senki más nem látja.</p>
    <div class="grid2">
      <div class="field"><label>Lapszám</label><input id="di-n" type="number" value="${it.lapszam}"></div>
      <div class="field"><label>Megjelenés dátuma</label><input id="di-date" type="date" value="${it.megjelenes||""}"></div>
    </div>
    <div class="field"><label>Cím</label><input id="di-name" value="${esc(it.cim||"")}"></div>
    <div class="field"><label>Eredeti ár (Ft)</label><input id="di-eredeti" type="number" value="${it.eredeti_ar??""}"></div>
    ${compBlocks}
    <div class="modrow"><button class="btn ghost" id="di-back">Vissza</button><button class="btn" id="di-save">Mentés</button></div>
    ${existing?`<div class="modrow"><button class="btn danger" id="di-del">Szám törlése a draftból</button></div>`:""}`);

  document.getElementById("di-back").onclick=()=>onDone();
  document.getElementById("di-save").onclick=async ()=>{
    const v=id=>{const e=document.getElementById(id);return e?e.value.trim():"";};
    const n=parseInt(v("di-n")); if(isNaN(n)){alert("A lapszám kötelező.");return;}
    const master={ draft_series_id:draftSeriesId, lapszam:n, cim:v("di-name")||null, megjelenes:v("di-date")||null,
      eredeti_ar:v("di-eredeti")?parseInt(v("di-eredeti")):null };
    try{
      let draftIssueId = existing?existing.id:null;
      if(existing){ const {error}=await supabase.from("draft_issues").update(master).eq("id",existing.id); if(error) throw error; }
      else { const {data,error}=await supabase.from("draft_issues").insert(master).select().single(); if(error) throw error; draftIssueId=data.id; }
      for(const t of components){
        const cmaster={ azonosito_tipus: document.getElementById("di-ct-"+t).value||null, azonosito: document.getElementById("di-cid-"+t).value.trim()||null };
        const cur=(it.comps||[]).find(x=>x.tipus===t);
        if(cur){ const {error}=await supabase.from("draft_components").update(cmaster).eq("id",cur.id); if(error) throw error; }
        else { const {error}=await supabase.from("draft_components").insert({...cmaster, draft_issue_id:draftIssueId, tipus:t, source_component_id:null}); if(error) throw error; }
      }
    }catch(e){ err(e); return; }
    onDone();
  };

  const delBtn=document.getElementById("di-del");
  if(delBtn) delBtn.onclick=async ()=>{
    const liveNote = existing.source_issue_id ? " Az élő számot ez NEM törli — csak azt jelenti, hogy publikáláskor nem frissül." : " Ez csak a munkaanyagot érinti, élő szám még nem tartozik hozzá.";
    if(!confirm(`Biztosan törlöd a #${existing.lapszam} számot a draftból?${liveNote}`)) return;
    try{ const {error}=await supabase.from("draft_issues").delete().eq("id",existing.id); if(error) throw error; }catch(e){ err(e); return; }
    onDone();
  };
}
