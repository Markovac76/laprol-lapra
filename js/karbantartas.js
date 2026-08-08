/* ============================================================
   Karbantartás — sorozat-életciklus (staff-only).
   Három fül: Aktív sorozatok / Munka sorozatok (a pool) / Publikálatlan.
   A draft_series a sorozat-szintű mezőket hordozza; a szám/komponens-szintű
   tételek a draft_issues/draft_components táblákban élnek (draft-items.js).
   A "Publikálás" a publish_draft_series(uuid) SQL-függvényt hívja — a teljes
   diff/verzióemelés/change_log egy tranzakcióban fut a szerveren.
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, esc, listName, opts, fmtDate, DISPLAY_MAX, PAL12, PAL_FAMILIES } from "./state.js";
import { openModal, err, sheet } from "./modal.js";
import { reload } from "./data.js";
import { isStaff, isOwnerRole } from "./permissions.js";
import { fetchDraftItems, renderDraftItemsList, draftItemForm } from "./draft-items.js";

let currentTab = "aktiv";

function nameOf(members, uid){
  if(!uid) return "—";
  const m=members.find(x=>x.user_id===uid);
  return (m && m.display_name) || (uid.slice(0,8)+"…");
}

export async function karbantartasForm(){
  openModal(`<h2>Karbantartás</h2><p class="msub">Betöltés…</p>`);
  const [{data:series,error:se},{data:drafts,error:de},{data:memberSeries,error:mse},{data:members,error:mee}] = await Promise.all([
    supabase.from("series").select("*").order("sort_order"),
    supabase.from("draft_series").select("*").order("created_at"),
    supabase.from("member_series").select("series_id,is_selected"),
    supabase.from("members").select("user_id,display_name"),
  ]);
  if(se||de||mse||mee){ err(se||de||mse||mee); return; }
  renderMain(series||[], drafts||[], memberSeries||[], members||[]);
}

function renderMain(series, drafts, memberSeries, members){
  const poolCount = drafts.filter(d=>d.pool_status==="incoming"||d.pool_status==="claimed").length;
  const body = currentTab==="aktiv" ? renderAktiv(series,drafts,memberSeries)
    : currentTab==="munka" ? renderMunka(drafts,members)
    : renderPublikalatlan(series,memberSeries);
  openModal(`<h2>Karbantartás</h2>
    <p class="msub">Sorozatok életciklusa — javaslatok, szerkesztések, publikálás.</p>
    <div class="statrow" id="kb-tabs">
      <button type="button" data-tab="aktiv" aria-pressed="${currentTab==="aktiv"}">Aktív sorozatok</button>
      <button type="button" data-tab="munka" aria-pressed="${currentTab==="munka"}">Munka sorozatok (${poolCount}/20)</button>
      <button type="button" data-tab="publikalatlan" aria-pressed="${currentTab==="publikalatlan"}">Publikálatlan</button>
    </div>
    <div id="kb-body" style="margin-top:12px">${body}</div>
    <div class="modrow"><button class="btn" onclick="closeModal()">Bezár</button></div>`);

  document.getElementById("kb-tabs").addEventListener("click",e=>{
    const b=e.target.closest("button[data-tab]"); if(!b) return;
    currentTab=b.dataset.tab; renderMain(series,drafts,memberSeries,members);
  });
  sheet.querySelectorAll("#kb-body [data-act]").forEach(b=>{
    b.onclick=()=>handleAction(b.dataset.act, b.dataset.id, series, drafts);
  });
}

/* ---- Aktív sorozatok ---- */
function renderAktiv(series, drafts, memberSeries){
  const active = series.filter(s=>s.lifecycle==="active");
  const editingSourceIds = new Set(drafts.filter(d=>d.pool_type==="edit").map(d=>d.source_series_id));
  const rows = active.map(s=>{
    const cnt = memberSeries.filter(m=>m.series_id===s.id && m.is_selected).length;
    const since = s.created_at ? fmtDate(s.created_at.slice(0,10)) : "—";
    const inProgress = editingSourceIds.has(s.id);
    const deleteMarked = !!s.force_delete_requested_at;
    return `<div class="userrow"><div class="uinfo">
        <div class="uname">${esc(s.megjelenites||s.megnevezes)}${s.kiado?` <span class="sc-kiado">· ${esc(listName("kiado",s.kiado))}</span>`:""}</div>
        <div class="unote">${cnt} aktív felhasználó · aktív ${since} óta</div>
        ${deleteMarked?`<div class="unote" style="color:#f3b6b6">🗑️ törlésre jelölve — szerkesztés letiltva</div>`:""}
      </div>
      <div class="uactions">
        ${deleteMarked ? `<span class="unote">nem szerkeszthető</span>`
          : inProgress ? `<span class="unote">szerkesztés már folyamatban</span>`
          : `<button data-act="startedit" data-id="${s.id}">Szerkesztés indítása</button>`}
        <button class="danger" data-act="unpublish" data-id="${s.id}">Publikálatlanná tétel</button>
      </div></div>`;
  }).join("");
  return rows || `<p class="msub">Nincs aktív sorozat.</p>`;
}

/* ---- Munka sorozatok (a pool, három alcsoportban) ---- */
function renderMunka(drafts, members){
  const groups=[["incoming","Beérkezett"],["claimed","Munkaanyag / foglalva"],["ready","Publikálásra váró"]];
  return groups.map(([st,label])=>{
    const items=drafts.filter(d=>d.pool_status===st);
    const rows=items.map(d=>{
      const typeLabel = d.pool_type==="new" ? "Új javaslat" : `Szerkesztés: ${esc(d.megnevezes)}`;
      const who = `beküldte: ${esc(nameOf(members,d.submitted_by))} · ${fmtDate((d.created_at||"").slice(0,10))||""}`;
      let actions="";
      if(st==="incoming"){
        actions = `<button data-act="claim" data-id="${d.id}">Felveszem</button>`;
        if(d.submitted_by===state.myId || isStaff()) actions += `<button class="danger" data-act="delete" data-id="${d.id}">Törlés</button>`;
      } else if(st==="claimed"){
        actions = d.claimed_by===state.myId
          ? `<button data-act="edit" data-id="${d.id}">Szerkesztés</button>
             <button data-act="ready" data-id="${d.id}">Kész</button>
             <button data-act="release" data-id="${d.id}">Elengedem</button>`
          : `<span class="unote">🔒 ${esc(nameOf(members,d.claimed_by))} dolgozik rajta</span>`;
      } else if(st==="ready"){
        actions = `<button data-act="publish" data-id="${d.id}">Publikálás</button>`;
      }
      return `<div class="userrow"><div class="uinfo"><div class="uname">${typeLabel}</div><div class="unote">${who}</div></div>
        <div class="uactions">${actions}</div></div>`;
    }).join("") || `<p class="msub">Nincs elem.</p>`;
    return `<h4 class="poolgrp">${label} (${items.length})</h4>${rows}`;
  }).join("");
}

/* ---- Publikálatlan (+ force-törlés, owner-only) ---- */
function renderPublikalatlan(series, memberSeries){
  const owner = isOwnerRole();
  const list = series.filter(s=>s.lifecycle==="unpublished");
  const rows = list.map(s=>{
    const cnt = memberSeries.filter(m=>m.series_id===s.id && m.is_selected).length;
    const pending = !!s.force_delete_requested_at;
    const graceOver = pending && s.force_delete_grace_end && new Date(s.force_delete_grace_end) <= new Date();
    let badge = "";
    let actions = `<button data-act="republish" data-id="${s.id}">Újra publikálás</button>`;
    if(pending){
      const days = s.force_delete_grace_end ? Math.max(0, Math.ceil((new Date(s.force_delete_grace_end)-new Date())/86400000)) : null;
      // A türelmi idő kizárólag az aktív kiválasztók védelmére van — ha időközben
      // mindenki leválasztotta magát, a végleges törlés a hátralévő napoktól
      // függetlenül azonnal elérhető.
      const canFinalize = graceOver || cnt===0;
      const badgeText = graceOver ? "türelmi idő lejárt"
        : cnt===0 ? "nincs már aktív felhasználó — most már véglegesíthető"
        : (days!=null ? `${days} nap van hátra` : "");
      badge = `<div class="unote" style="color:#f3b6b6">🗑️ törlésre jelölve${badgeText?" — "+badgeText:""}</div>`;
      if(owner && canFinalize) actions += `<button class="danger" data-act="finalizedelete" data-id="${s.id}">Végleges törlés</button>`;
    } else if(owner){
      actions += cnt>0
        ? `<button class="danger" data-act="startdelete" data-id="${s.id}">Törlés indítása (${cnt} felhasználó érintett)</button>`
        : `<button class="danger" data-act="finalizedelete" data-id="${s.id}">Törlés</button>`;
    }
    return `<div class="userrow"><div class="uinfo"><div class="uname">${esc(s.megjelenites||s.megnevezes)}</div>
        <div class="unote">${cnt} aktív felhasználó még rajta van</div>${badge}</div>
      <div class="uactions">${actions}</div></div>`;
  }).join("");
  return rows || `<p class="msub">Nincs publikálatlan sorozat.</p>`;
}

/* ---- Akciók ---- */
async function handleAction(act, id, series, drafts){
  if(act==="startedit"){ const s=series.find(x=>x.id===id); if(s) await startEdit(s); return; }
  if(act==="unpublish"){ const s=series.find(x=>x.id===id); if(s) await unpublish(s); return; }
  if(act==="republish"){ const s=series.find(x=>x.id===id); if(s) await republish(s); return; }
  if(act==="startdelete"){ const s=series.find(x=>x.id===id); if(s) await startDelete(s); return; }
  if(act==="finalizedelete"){ const s=series.find(x=>x.id===id); if(s) await finalizeDelete(s); return; }
  const d=drafts.find(x=>x.id===id); if(!d) return;
  if(act==="claim")   return claim(d);
  if(act==="delete")  return deleteDraft(d);
  if(act==="edit")    return editDraftForm(d);
  if(act==="ready")   return markReady(d);
  if(act==="release") return release(d);
  if(act==="publish") return publish(d);
}

// Élő sorozat "Szerkesztés indítása": a draft_series létrehozása mellett a
// jelenlegi élő szám/komponens adatok MÁSOLATA is bekerül a draftba (tömeges
// insert, nem soronkénti — egy 200+ tételes sorozatnál ez percekig tartana
// soronként), hogy legyen mihez képest diffelni publikáláskor.
async function startEdit(s){
  try{
    const { data: draft, error } = await supabase.from("draft_series").insert({
      pool_type:"edit", pool_status:"claimed", source_series_id:s.id,
      submitted_by: state.myId, claimed_by: state.myId, claimed_at: new Date().toISOString(),
      kiado:s.kiado, megnevezes:s.megnevezes, megjelenites:s.megjelenites, szin:s.szin, components:s.components,
    }).select().single();
    if(error) throw error;

    const { data: liveIssues, error: ie } = await supabase.from("issues").select("*").eq("series_id", s.id);
    if(ie) throw ie;
    if(liveIssues && liveIssues.length){
      const issueIds = liveIssues.map(x=>x.id);
      const { data: liveComps, error: ce } = await supabase.from("components").select("*").in("issue_id", issueIds);
      if(ce) throw ce;

      const issuePayload = liveIssues.map(li=>({
        draft_series_id: draft.id, source_issue_id: li.id, lapszam: li.lapszam, cim: li.cim,
        megjelenes: li.megjelenes, eredeti_ar: li.eredeti_ar,
      }));
      const { data: newDraftIssues, error: dierr } = await supabase.from("draft_issues").insert(issuePayload).select();
      if(dierr) throw dierr;

      const map={}; newDraftIssues.forEach(di=>{ map[di.source_issue_id]=di.id; });
      const compPayload = (liveComps||[]).map(lc=>({
        draft_issue_id: map[lc.issue_id], source_component_id: lc.id, tipus: lc.tipus,
        azonosito_tipus: lc.azonosito_tipus, azonosito: lc.azonosito,
      }));
      if(compPayload.length){ const {error:dcerr}=await supabase.from("draft_components").insert(compPayload); if(dcerr) throw dcerr; }
    }
  }catch(e){ err(e); return; }
  currentTab="munka"; await karbantartasForm();
}

async function unpublish(s){
  if(!confirm(`Publikálatlanná teszed a(z) „${s.megnevezes}” sorozatot? A már kiválasztó felhasználók megtartják a hozzáférést, újak nem választhatják.`)) return;
  try{
    const { error } = await supabase.from("series").update({lifecycle:"unpublished"}).eq("id",s.id);
    if(error) throw error;
    await reload();
  }catch(e){ err(e); }
  await karbantartasForm();
}

async function republish(s){
  try{
    const { error } = await supabase.from("series").update({lifecycle:"active"}).eq("id",s.id);
    if(error) throw error;
    await reload();
  }catch(e){ err(e); }
  await karbantartasForm();
}

// Force-törlés indítása (owner-only, csak ha van még aktív kiválasztás —
// enélkül a finalizeDelete azonnal töröl). 14 napos türelmi idő; a DB-szintű
// védőháló ezalatt blokkolja a szerkesztés-indítást és az újra-kiválasztást.
async function startDelete(s){
  if(!confirm(`Elindítod a(z) „${s.megnevezes}” törlési folyamatát? 14 napos türelmi idő indul, ami alatt az érintett felhasználók minden belépéskor jelzést kapnak, és a sorozat nem szerkeszthető / nem választható be újra. A türelmi idő letelte után véglegesen törölhető.`)) return;
  try{
    const { error } = await supabase.rpc("start_force_delete", { p_series_id: s.id });
    if(error) throw error;
  }catch(e){ err(e); }
  await karbantartasForm();
}

// 0 aktív kiválasztásnál egyszerű megerősítés; türelmi idő letelte után a
// sorozat nevének pontos begépelése kötelező (a szerver is újra ellenőrzi).
async function finalizeDelete(s){
  if(!s.force_delete_requested_at){
    if(!confirm(`Biztosan véglegesen törlöd a(z) „${s.megnevezes}” sorozatot? Nincs rajta aktív kiválasztás — ez nem vonható vissza.`)) return;
    await doFinalize(s.id, null);
    return;
  }
  openModal(`<h2>Végleges törlés</h2>
    <p class="msub">Ez VÉGLEGESEN törli a(z) „${esc(s.megnevezes)}” sorozatot és MINDEN hozzá kapcsolódó, még meglévő felhasználói adatot. Nem vonható vissza. A megerősítéshez írd be pontosan a sorozat nevét:</p>
    <div class="field"><input id="fd-confirm" placeholder="${esc(s.megnevezes)}"></div>
    <div class="modrow"><button class="btn ghost" id="fd-cancel">Mégse</button><button class="btn danger" id="fd-go">Végleges törlés</button></div>`);
  document.getElementById("fd-cancel").onclick=()=>karbantartasForm();
  document.getElementById("fd-go").onclick=async ()=>{
    const v=document.getElementById("fd-confirm").value.trim();
    if(v!==s.megnevezes){ alert("A begépelt név nem egyezik pontosan."); return; }
    await doFinalize(s.id, v);
  };
}

async function doFinalize(seriesId, confirmName){
  try{
    const { error } = await supabase.rpc("finalize_delete_series", { p_series_id: seriesId, p_confirm_name: confirmName });
    if(error) throw error;
    await reload();
  }catch(e){ err(e); return; }
  await karbantartasForm();
}

async function claim(d){
  try{
    const { error } = await supabase.from("draft_series")
      .update({ pool_status:"claimed", claimed_by:state.myId, claimed_at:new Date().toISOString() })
      .eq("id", d.id).eq("pool_status","incoming");
    if(error) throw error;
  }catch(e){ err(e); }
  await karbantartasForm();
}

async function markReady(d){
  try{
    const { error } = await supabase.from("draft_series")
      .update({ pool_status:"ready", ready_at:new Date().toISOString() }).eq("id", d.id);
    if(error) throw error;
  }catch(e){ err(e); }
  await karbantartasForm();
}

async function release(d){
  try{
    const { error } = await supabase.from("draft_series")
      .update({ pool_status:"incoming", claimed_by:null, claimed_at:null }).eq("id", d.id);
    if(error) throw error;
  }catch(e){ err(e); }
  await karbantartasForm();
}

async function deleteDraft(d){
  if(!confirm(`Biztosan törlöd ezt a munkaanyagot: „${d.megnevezes}”?`)) return;
  try{
    const { error } = await supabase.from("draft_series").delete().eq("id", d.id);
    if(error) throw error;
  }catch(e){ err(e); }
  await karbantartasForm();
}

// Publikálás — a teljes diff/verzióemelés/change_log/élő-frissítés egy
// tranzakcióban fut a szerveren (publish_draft_series), hogy félbeszakadás
// (hálózati hiba, bezárt tab) ne hagyhasson inkonzisztens állapotot.
async function publish(d){
  const what = d.pool_type==="new" ? `az új „${d.megnevezes}” sorozatot` : `a(z) „${d.megnevezes}” szerkesztését`;
  if(!confirm(`Publikálod ${what}? Azonnal élesbe kerül, és mindenkinek látszik, akit érint.`)) return;
  try{
    const { error } = await supabase.rpc("publish_draft_series", { p_draft_id: d.id });
    if(error) throw error;
    await reload();
  }catch(e){ err(e); return; }
  await karbantartasForm();
}

/* ---- Draft mezőinek + tételeinek szerkesztése (a claim-elő sajátja) ---- */
async function editDraftForm(d){
  let color = d.szin || PAL12[0];
  let comps = (d.components||[]).slice();
  const compList = (state.LISTS.komponens||[{ertek:"magazin",nev:"Magazin"},{ertek:"modell",nev:"Modell"},{ertek:"konyv",nev:"Könyv"},{ertek:"egyeb",nev:"Egyéb"}]);

  openModal(`<h2>${d.pool_type==="new"?"Új javaslat szerkesztése":"Szerkesztés: "+esc(d.megnevezes)}</h2><p class="msub">Betöltés…</p>`);
  let items;
  try{ items = await fetchDraftItems(d.id); }catch(e){ err(e); return; }
  renderEditDraft(d, color, comps, compList, items);
}

function renderEditDraft(d, color, comps, compList, items){
  openModal(`<h2>${d.pool_type==="new"?"Új javaslat szerkesztése":"Szerkesztés: "+esc(d.megnevezes)}</h2>
    <p class="msub">Munkaanyag — csak neked látszik, amíg nem publikálod.</p>
    <div class="field"><label>Kiadó</label><select id="d-kiado"><option value="">—</option>${opts("kiado",d.kiado)}</select></div>
    <div class="field"><label>Megnevezés (teljes név)</label><input id="d-name" value="${esc(d.megnevezes||"")}"></div>
    <div class="field"><label>Megjelenítendő név a fülön (max ${DISPLAY_MAX}) — <span id="d-count">${(d.megjelenites||"").length}/${DISPLAY_MAX}</span></label>
      <input id="d-display" maxlength="${DISPLAY_MAX}" value="${esc(d.megjelenites||"")}"></div>
    <div class="field"><label>Komponensek (miből áll egy szám)</label><div class="compchecks" id="d-comps">
      ${compList.map(o=>`<button type="button" class="compcheck" data-t="${esc(o.ertek)}" aria-pressed="${comps.includes(o.ertek)}">${esc(o.nev)}</button>`).join("")}</div></div>
    <div class="field"><label>Szín</label>
      <div id="d-sw">${PAL_FAMILIES.map(f=>`<div class="swfam"><span class="swfam-nev">${f.nev}</span>
        <div class="swatches">${f.szinek.map(c=>`<button type="button" class="swatch" data-c="${c}" style="background:${c}" aria-pressed="${c===color}"></button>`).join("")}</div></div>`).join("")}</div></div>
    <div class="modrow"><button class="btn ghost" id="d-back">Vissza</button><button class="btn" id="d-save">Mezők mentése</button></div>
    <div class="msub" style="margin:16px 0 2px;color:var(--accent);filter:brightness(1.2);font-weight:600">Számok (${items.length})</div>
    <div id="d-items">${renderDraftItemsList(items, comps)}</div>
    <div class="modrow"><button class="btn ghost" id="d-additem">+ Új szám</button></div>`);

  const dEl=document.getElementById("d-display"), cEl=document.getElementById("d-count");
  dEl.addEventListener("input",()=>cEl.textContent=`${dEl.value.length}/${DISPLAY_MAX}`);
  document.getElementById("d-comps").addEventListener("click",e=>{ const b=e.target.closest(".compcheck"); if(!b) return;
    const t=b.dataset.t; if(comps.includes(t)) comps=comps.filter(x=>x!==t); else comps.push(t);
    b.setAttribute("aria-pressed", comps.includes(t)); });
  document.getElementById("d-sw").addEventListener("click",e=>{ const b=e.target.closest(".swatch"); if(!b) return;
    color=b.dataset.c; sheet.querySelectorAll("#d-sw .swatch").forEach(x=>x.setAttribute("aria-pressed", x===b)); });
  document.getElementById("d-back").onclick=()=>karbantartasForm();
  document.getElementById("d-save").onclick=async ()=>{
    const nm=document.getElementById("d-name").value.trim();
    if(!nm){ alert("A megnevezés kötelező."); return; }
    if(!comps.length){ alert("Legalább egy komponens kell."); return; }
    const disp=(dEl.value.trim()||nm).slice(0,DISPLAY_MAX);
    try{
      const { error } = await supabase.from("draft_series").update({
        kiado: document.getElementById("d-kiado").value||null,
        megnevezes: nm, megjelenites: disp, szin: color, components: comps,
      }).eq("id", d.id);
      if(error) throw error;
    }catch(e){ err(e); return; }
    d = {...d, kiado:document.getElementById("d-kiado").value||null, megnevezes:nm, megjelenites:disp, szin:color, components:comps};
    await editDraftForm(d);
  };
  // Egy komponens-átsorolás új típust adhat a sorozat komponens-listájához
  // (draft-items.js) — a szerkesztőbe visszatérve ezért friss draft_series
  // sort töltünk be, nem a bezáráskori (esetleg elavult) `d`-t.
  const reopen = async ()=>{
    const { data:fresh } = await supabase.from("draft_series").select("*").eq("id",d.id).single();
    await editDraftForm(fresh||d);
  };
  document.getElementById("d-additem").onclick=()=>draftItemForm(d.id, null, comps, reopen);
  sheet.querySelectorAll("#d-items [data-diedit]").forEach(b=>{
    b.onclick=()=>{ const it=items.find(x=>x.id===b.dataset.diedit); if(it) draftItemForm(d.id, it, comps, reopen); };
  });
}
