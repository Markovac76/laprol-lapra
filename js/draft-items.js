/* ============================================================
   Draft tételek (szám + komponens) egy claim-elt draft_series-en
   belül — a Karbantartás "Szerkesztés" nézetének beágyazott listája.
   Csak törzsadat-mezők — nincs személyes réteg, a draft publikálás
   előtti állapot, még senkinek nincs rajta saját adata.
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, COMP_TYPES, esc, fmtDate, opts, listName } from "./state.js";
import { openModal, err } from "./modal.js";

const typeLabel = t => listName("komponens", t) || COMP_TYPES[t] || t;
// A deklarált (sorozat-szintű) típusok ÉS a tételen ténylegesen meglévő,
// esetleg átsorolt komponensek típusainak uniója — hogy egy már átsorolt
// komponens ne "tűnjön el" a szerkesztőből.
const compSlots = (it, components) => Array.from(new Set([...components, ...((it&&it.comps)||[]).map(c=>c.tipus)]));
// Átsorolásnál csak olyan célt kínálunk fel, amit a tétel MÁS komponense
// még nem foglal — két azonos típusú komponens ugyanazon a tételen
// összeütközne (a második "eltűnne", mert az élő adat típusonként egy
// komponenst vár tételenként).
const retypeOptions = (it, ownType) => {
  const usedElsewhere = new Set((it.comps||[]).filter(c=>c.tipus!==ownType).map(c=>c.tipus));
  return (state.LISTS.komponens||[]).filter(o=>o.ertek===ownType || !usedElsewhere.has(o.ertek));
};

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
    const compsTxt = compSlots(it, components).map(t=>{
      const c=it.comps.find(x=>x.tipus===t);
      return `${typeLabel(t)}${c&&c.azonosito?": "+esc(c.azonosito):""}`;
    }).join(" · ");
    return `<div class="userrow"><div class="uinfo">
        <div class="uname">#${it.lapszam}${it.cim?" – "+esc(it.cim):""}</div>
        <div class="unote">${it.megjelenes?fmtDate(it.megjelenes):"nincs dátum"}${it.eredeti_ar!=null?" · "+it.eredeti_ar+" Ft":""}</div>
        <div class="unote">${compsTxt}</div>
        ${it.deleted?'<div class="unote" style="color:#f3b6b6">🗑️ törlésre jelölve publikáláskor</div>':""}
      </div>
      <div class="uactions"><button data-diedit="${it.id}">Szerkesztés</button></div>
    </div>`;
  }).join("");
}

export function draftItemForm(draftSeriesId, existing, components, onDone){
  const it = existing || {lapszam:"", cim:"", megjelenes:"", eredeti_ar:"", comps:[]};
  const slots = existing ? compSlots(it, components) : components;
  const compBlocks = slots.map(t=>{
    const c=(it.comps||[]).find(x=>x.tipus===t)||{};
    const canRetype = !!(existing && c.id);
    const typeOpts = canRetype ? retypeOptions(it,t).map(o=>`<option value="${esc(o.ertek)}"${o.ertek===t?" selected":""}>${esc(o.nev)}</option>`).join("") : "";
    return `<div class="compedit">
      <h4>${esc(typeLabel(t))}</h4>
      ${canRetype?`<div class="field"><label>Típus (utólagos átsorolás)</label><select id="di-type-${t}">${typeOpts}</select></div>`:""}
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
    ${existing&&existing.source_issue_id?`<label class="ckrow" style="margin-top:10px"><input type="checkbox" id="di-deleted" ${it.deleted?"checked":""}> Ezt a Számot törlöm a sorozatból (publikáláskor)</label>`:""}
    <div class="modrow"><button class="btn ghost" id="di-back">Vissza</button><button class="btn" id="di-save">Mentés</button></div>
    ${existing?`<div class="modrow"><button class="btn danger" id="di-del">Szám törlése a draftból</button></div>`:""}`);

  document.getElementById("di-back").onclick=()=>onDone();
  document.getElementById("di-save").onclick=async ()=>{
    const v=id=>{const e=document.getElementById(id);return e?e.value.trim():"";};
    const n=parseInt(v("di-n")); if(isNaN(n)){alert("A lapszám kötelező.");return;}
    const delCk=document.getElementById("di-deleted");
    const master={ draft_series_id:draftSeriesId, lapszam:n, cim:v("di-name")||null, megjelenes:v("di-date")||null,
      eredeti_ar:v("di-eredeti")?parseInt(v("di-eredeti")):null, deleted: delCk ? delCk.checked : false };
    const chosenTipusok = slots.map(t=>{ const sel=document.getElementById("di-type-"+t); return sel?sel.value:t; });
    if(new Set(chosenTipusok).size !== chosenTipusok.length){
      alert("Két komponens nem sorolható ugyanarra a típusra ezen a Számon."); return;
    }
    try{
      let draftIssueId = existing?existing.id:null;
      if(existing){ const {error}=await supabase.from("draft_issues").update(master).eq("id",existing.id); if(error) throw error; }
      else { const {data,error}=await supabase.from("draft_issues").insert(master).select().single(); if(error) throw error; draftIssueId=data.id; }
      const newComponents = components.slice();
      for(let i=0;i<slots.length;i++){
        const t=slots[i], newTipus=chosenTipusok[i];
        if(!newComponents.includes(newTipus)) newComponents.push(newTipus);
        const cmaster={ tipus:newTipus, azonosito_tipus: document.getElementById("di-ct-"+t).value||null, azonosito: document.getElementById("di-cid-"+t).value.trim()||null };
        const cur=(it.comps||[]).find(x=>x.tipus===t);
        if(cur){ const {error}=await supabase.from("draft_components").update(cmaster).eq("id",cur.id); if(error) throw error; }
        else { const {error}=await supabase.from("draft_components").insert({...cmaster, draft_issue_id:draftIssueId, source_component_id:null}); if(error) throw error; }
      }
      // Ha egy átsorolás olyan típusra váltott, ami még nincs a sorozat
      // komponens-listáján, azt fel kell venni oda is — enélkül a
      // publikálás után az élő felület sehol nem jelenítené meg (minden
      // megjelenítés a sorozat deklarált komponens-listáján iterál).
      if(newComponents.length!==components.length){
        const {error}=await supabase.from("draft_series").update({components:newComponents}).eq("id",draftSeriesId);
        if(error) throw error;
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
