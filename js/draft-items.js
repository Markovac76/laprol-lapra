/* ============================================================
   Draft tételek (szám + komponens) egy claim-elt draft_series-en
   belül — a Karbantartás "Szerkesztés" nézetének beágyazott listája.
   Csak törzsadat-mezők — nincs személyes réteg, a draft publikálás
   előtti állapot, még senkinek nincs rajta saját adata.

   Egy típusból TÖBB, egyedi Megnevezésű példány is felvehető (pl. két
   különböző Lego-csomag) — ezért a `comps` mindig FLAT tömb (nem
   típusonkénti map), soha nem dedupelünk típus szerint.
   ============================================================ */
import { supabase, fetchAllRows } from "./supabase.js";
import { state, COMP_TYPES, esc, fmtDate, opts, listName } from "./state.js";
import { openModal, err } from "./modal.js";

const typeLabel = t => listName("komponens", t) || COMP_TYPES[t] || t;

export async function fetchDraftItems(draftSeriesId){
  const { data: issues, error: ie } = await fetchAllRows(()=>supabase.from("draft_issues")
    .select("*").eq("draft_series_id", draftSeriesId).order("lapszam"));
  if(ie) throw ie;
  const issueIds = (issues||[]).map(x=>x.id);
  let comps=[];
  if(issueIds.length){
    // A "több azonos típusú komponens" funkció óta ez könnyebben átlépheti a
    // 1000-es alapértelmezett Supabase-limitet egy nagy sorozat draftjánál.
    const { data, error: ce } = await fetchAllRows(()=>supabase.from("draft_components").select("*").in("draft_issue_id", issueIds));
    if(ce) throw ce;
    comps = data||[];
  }
  return (issues||[]).map(it=>({...it, comps: comps.filter(c=>c.draft_issue_id===it.id)}));
}

export function renderDraftItemsList(items){
  if(!items.length) return `<p class="msub">Még nincs szám a draftban.</p>`;
  return items.map(it=>{
    const compsTxt = (it.comps||[]).map(c=>
      `${typeLabel(c.tipus)}${c.megnevezes?" — "+esc(c.megnevezes):""}${c.azonosito?": "+esc(c.azonosito):""}`
    ).join(" · ");
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

let tmpSeq=0;
const keyOf = c => c.id || c._tmpKey;

export function draftItemForm(draftSeriesId, existing, components, onDone){
  // Munka-másolat: a `comps` itt egy FLAT tömb (session-only, még nem mentett
  // "+ Még egy X" példányokkal bővíthető) — csak Mentéskor kerül a DB-be.
  let comps = existing ? (existing.comps||[]).map(c=>({...c}))
    : components.map(t=>({tipus:t, azonosito_tipus:null, azonosito:"", megnevezes:"", _tmpKey:"tmp"+(tmpSeq++)}));
  let master = { lapszam: existing?existing.lapszam:"", cim: existing?(existing.cim||""):"", megjelenes: existing?(existing.megjelenes||""):"",
    eredeti_ar: existing&&existing.eredeti_ar!=null?existing.eredeti_ar:"", deleted: existing?!!existing.deleted:false };

  function syncFromDom(){
    const v=id=>{const e=document.getElementById(id); return e?e.value:null;};
    if(document.getElementById("di-n")!=null){
      master.lapszam=v("di-n"); master.cim=v("di-name"); master.megjelenes=v("di-date"); master.eredeti_ar=v("di-eredeti");
      const delCk=document.getElementById("di-deleted"); if(delCk) master.deleted=delCk.checked;
    }
    comps.forEach(c=>{
      const k=keyOf(c);
      const nameEl=document.getElementById("di-name-"+k); if(nameEl) c.megnevezes=nameEl.value;
      const idtEl=document.getElementById("di-ct-"+k); if(idtEl) c.azonosito_tipus=idtEl.value;
      const idEl=document.getElementById("di-cid-"+k); if(idEl) c.azonosito=idEl.value;
      const typeEl=document.getElementById("di-type-"+k); if(typeEl) c.tipus=typeEl.value;
    });
  }

  function draw(){
    const byType={}; comps.forEach(c=>{ (byType[c.tipus]=byType[c.tipus]||[]).push(c); });
    // Megjelenő típus-sorrend: a deklarált komponens-lista, majd bármi extra
    // (pl. átsorolással bekerült) típus a végén.
    const slotTypes = Array.from(new Set([...components, ...comps.map(c=>c.tipus)]));
    const compBlocks = slotTypes.map(t=>{
      const list=byType[t]||[];
      const blocks=list.map((c,idx)=>{
        const k=keyOf(c);
        const canRetype = !!c.id;   // csak már mentett (élő párral vagy anélkül perzisztált) példány sorolható át
        const typeOpts = canRetype ? (state.LISTS.komponens||[]).map(o=>`<option value="${esc(o.ertek)}"${o.ertek===c.tipus?" selected":""}>${esc(o.nev)}</option>`).join("") : "";
        return `<div class="compedit">
          <h4>${esc(typeLabel(t))}${list.length>1?` #${idx+1}`:""}</h4>
          ${canRetype?`<div class="field"><label>Típus (utólagos átsorolás)</label><select id="di-type-${k}">${typeOpts}</select></div>`:""}
          <div class="field"><label>Megnevezés (opcionális) <span style="color:var(--faint);font-weight:400">— ha üres, "${esc(typeLabel(t))}${list.length>1?" #N":""}" jelenik meg</span></label>
            <input id="di-name-${k}" value="${esc(c.megnevezes||"")}" placeholder="pl. Star Wars minifigura-csomag"></div>
          <div class="grid2">
            <div class="field"><label>Azonosító típusa</label><select id="di-ct-${k}"><option value="">—</option>${opts("azonosito",c.azonosito_tipus)}</select></div>
            <div class="field"><label>Azonosító</label><input id="di-cid-${k}" value="${esc(c.azonosito||"")}"></div>
          </div>
          ${list.length>1?`<button type="button" class="btn ghost" data-removecomp="${k}">Ez a példány törlése</button>`:""}
        </div>`;
      }).join("");
      return blocks + `<button type="button" class="btn ghost" data-addcomp="${esc(t)}">+ Még egy ${esc(typeLabel(t))} hozzáadása</button>`;
    }).join("");

    openModal(`<h2>${existing?"Szám szerkesztése (draft)":"Új szám (draft)"}</h2>
      <p class="msub">Munkaanyag — publikálásig senki más nem látja.</p>
      <div class="grid2">
        <div class="field"><label>Lapszám</label><input id="di-n" type="number" value="${master.lapszam}"></div>
        <div class="field"><label>Megjelenés dátuma</label><input id="di-date" type="date" value="${master.megjelenes||""}"></div>
      </div>
      <div class="field"><label>Cím</label><input id="di-name" value="${esc(master.cim||"")}"></div>
      <div class="field"><label>Eredeti ár (Ft)</label><input id="di-eredeti" type="number" value="${master.eredeti_ar??""}"></div>
      ${compBlocks}
      ${existing&&existing.source_issue_id?`<label class="ckrow" style="margin-top:10px"><input type="checkbox" id="di-deleted" ${master.deleted?"checked":""}> Ezt a Számot törlöm a sorozatból (publikáláskor)</label>`:""}
      <div class="modrow"><button class="btn ghost" id="di-back">Vissza</button><button class="btn" id="di-save">Mentés</button></div>
      ${existing?`<div class="modrow"><button class="btn danger" id="di-del">Szám törlése a draftból</button></div>`:""}`);

    document.getElementById("di-back").onclick=()=>onDone();

    document.querySelectorAll("[data-addcomp]").forEach(b=>{
      b.onclick=()=>{ syncFromDom(); comps.push({tipus:b.dataset.addcomp, azonosito_tipus:null, azonosito:"", megnevezes:"", _tmpKey:"tmp"+(tmpSeq++)}); draw(); };
    });
    document.querySelectorAll("[data-removecomp]").forEach(b=>{
      b.onclick=async ()=>{
        syncFromDom();
        const k=b.dataset.removecomp, c=comps.find(x=>keyOf(x)===k);
        if(!c) return;
        if(c.id){
          if(!confirm("Törlöd ezt a példányt a draftból?")) return;
          try{ const {error}=await supabase.from("draft_components").delete().eq("id",c.id); if(error) throw error; }
          catch(e){ err(e); return; }
        }
        comps = comps.filter(x=>x!==c); draw();
      };
    });

    document.getElementById("di-save").onclick=async ()=>{
      syncFromDom();
      const n=parseInt(master.lapszam); if(isNaN(n)){alert("A lapszám kötelező.");return;}
      const masterPayload={ draft_series_id:draftSeriesId, lapszam:n, cim:(master.cim||"").trim()||null, megjelenes:master.megjelenes||null,
        eredeti_ar:master.eredeti_ar?parseInt(master.eredeti_ar):null, deleted: !!master.deleted };
      try{
        let draftIssueId = existing?existing.id:null;
        if(existing){ const {error}=await supabase.from("draft_issues").update(masterPayload).eq("id",existing.id); if(error) throw error; }
        else { const {data,error}=await supabase.from("draft_issues").insert(masterPayload).select().single(); if(error) throw error; draftIssueId=data.id; }

        const newComponents = components.slice();
        for(const c of comps){
          if(!newComponents.includes(c.tipus)) newComponents.push(c.tipus);
          const cpayload={ tipus:c.tipus, azonosito_tipus:(c.azonosito_tipus||"").trim()||null, azonosito:(c.azonosito||"").trim()||null, megnevezes:(c.megnevezes||"").trim()||null };
          if(c.id){ const {error}=await supabase.from("draft_components").update(cpayload).eq("id",c.id); if(error) throw error; }
          else { const {error}=await supabase.from("draft_components").insert({...cpayload, draft_issue_id:draftIssueId, source_component_id:null}); if(error) throw error; }
        }
        // Ha egy átsorolás/új példány olyan típust hozott be, ami még nincs a
        // sorozat komponens-listáján, azt fel kell venni oda is — enélkül a
        // publikálás után az élő felület sehol nem jelenítené meg.
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

  draw();
}
