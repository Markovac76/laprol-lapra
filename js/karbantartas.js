/* ============================================================
   Karbantartás — sorozat-életciklus (staff-only).
   Három fül: Aktív sorozatok / Munka sorozatok (a pool) / Publikálatlan.
   A draft_series a sorozat-szintű mezőket hordozza; a szám/komponens-szintű
   tételek a draft_issues/draft_components táblákban élnek (draft-items.js).
   A "Publikálás" a publish_draft_series(uuid) SQL-függvényt hívja — a teljes
   diff/verzióemelés/change_log egy tranzakcióban fut a szerveren.
   ============================================================ */
import { supabase, fetchAllRows } from "./supabase.js";
import { state, esc, listName, opts, fmtDate, DISPLAY_MAX, PAL12, PAL_FAMILIES } from "./state.js";
import { openModal, err, sheet, guarded } from "./modal.js";
import { reload } from "./data.js";
import { isStaff, isOwnerRole } from "./permissions.js";
import { fetchDraftItems, renderDraftItemsList, draftItemForm } from "./draft-items.js";
import { downloadDraftTemplate, pickDraftExcelFile, confirmDraftUpload } from "./draft-excel.js";
import { diffDraft, diffSummaryText } from "./draft-diff.js";
import { controlsHtml, wireControls, filterSeries, sortSeries, loadSort, loadLastChanged } from "./series-list.js";
import { defaultTemplate, hasTemplate, templateError, templateTypes, ID_RULES, TEMPLATE_SOFT_MAX, addType, removeType, setMain, move, setField } from "./component-template.js";

let currentTab = "aktiv";
// Szám-darabszámok a Munka sorozatok listához (karbantartasForm tölti): {draft: {draftId: N}, live: {seriesId: M}}
let kbCounts = { draft:{}, live:{} };
// Aktív sorozatok: keresés + rendezés (közös komponens: series-list.js)
let listQuery = "";
let listSort = loadSort();
let lastMap = null;   // legutóbbi módosítás sorozatonként (lustán töltődik)

function nameOf(members, uid){
  if(!uid) return "—";
  const m=members.find(x=>x.user_id===uid);
  return (m && m.display_name) || (uid.slice(0,8)+"…");
}

export async function karbantartasForm(){
  lastMap = null;
  listSort = loadSort();   // a közös (megjegyzett) rendezés — a Sorozataim ablakban is állítható
  openModal(`<h2>Karbantartás</h2><p class="msub">Betöltés…</p>`);
  const [{data:series,error:se},{data:drafts,error:de},{data:memberSeries,error:mse},{data:members,error:mee},{data:dIssues,error:die},{data:lIssues,error:lie}] = await Promise.all([
    supabase.from("series").select("*").order("sort_order"),
    supabase.from("draft_series").select("*").order("created_at"),
    // member_series/members: MINDEN userre vonatkozik (nem csak a sajátodra)
    // — lapozva, mert (userek × követett sorozatok) szorzattal nő, nem a
    // sajátod méretével.
    fetchAllRows(()=>supabase.from("member_series").select("series_id,is_selected"), ["user_id","series_id"]),
    fetchAllRows(()=>supabase.from("members").select("user_id,display_name"), "user_id"),
    // Szám-darabszámok a függő listákhoz (C): a draftok nem törölt Számai és az élő nem törölt Számok.
    fetchAllRows(()=>supabase.from("draft_issues").select("draft_series_id,deleted")),
    fetchAllRows(()=>supabase.from("issues").select("series_id,is_deleted")),
  ]);
  if(se||de||mse||mee||die||lie){ err(se||de||mse||mee||die||lie); return; }
  kbCounts = { draft:{}, live:{} };
  (dIssues||[]).forEach(r=>{ if(!r.deleted) kbCounts.draft[r.draft_series_id]=(kbCounts.draft[r.draft_series_id]||0)+1; });
  (lIssues||[]).forEach(r=>{ if(!r.is_deleted) kbCounts.live[r.series_id]=(kbCounts.live[r.series_id]||0)+1; });
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
  const bindActions = () => sheet.querySelectorAll("#kb-body [data-act]").forEach(b=>{
    b.onclick=guarded(()=>handleAction(b.dataset.act, b.dataset.id, series, drafts));
  });
  bindActions();

  if(currentTab==="aktiv"){
    const refresh = () => { const box=document.getElementById("kb-aktiv-list"); if(box){ box.innerHTML = aktivRows(series,drafts,memberSeries); bindActions(); } };
    const ensureLast = async () => { if(listSort==="modositva" && !lastMap){ try{ lastMap = await loadLastChanged(true); }catch(_){ lastMap = {}; } } };
    wireControls(sheet, "kbl", async ({query, sort})=>{ listQuery=query; listSort=sort; await ensureLast(); refresh(); });
    // visszaállított "legutóbb módosított" választásnál a lista a betöltés után frissül
    if(listSort==="modositva" && !lastMap) ensureLast().then(refresh);
  }
}

/* ---- Aktív sorozatok ---- */
function renderAktiv(series, drafts, memberSeries){
  return controlsHtml("kbl", listSort, listQuery) + `<div id="kb-aktiv-list">${aktivRows(series, drafts, memberSeries)}</div>`;
}

function aktivRows(series, drafts, memberSeries){
  const active = sortSeries(filterSeries(series.filter(s=>s.lifecycle==="active"), listQuery), listSort, { counts: kbCounts.live, last: lastMap });
  const editingSourceIds = new Set(drafts.filter(d=>d.pool_type==="edit").map(d=>d.source_series_id));
  const rows = active.map(s=>{
    const cnt = memberSeries.filter(m=>m.series_id===s.id && m.is_selected).length;
    const since = s.created_at ? fmtDate(s.created_at.slice(0,10)) : "—";
    const inProgress = editingSourceIds.has(s.id);
    const deleteMarked = !!s.force_delete_requested_at;
    return `<div class="userrow"><div class="uinfo">
        <div class="uname">${esc(s.megjelenites||s.megnevezes)}${s.kiado?` <span class="sc-kiado">· ${esc(listName("kiado",s.kiado))}</span>`:""}${s.kategoria?` <span class="sc-kiado">· ${esc(listName("kategoria",s.kategoria))}</span>`:""}</div>
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
  return rows || `<p class="msub">${listQuery.trim() ? "Nincs a keresésnek megfelelő sorozat." : "Nincs aktív sorozat."}</p>`;
}

/* ---- Munka sorozatok (a pool, három alcsoportban) ---- */
function renderMunka(drafts, members){
  const groups=[["incoming","Beérkezett"],["claimed","Munkaanyag / foglalva"],["ready","Publikálásra váró"]];
  return groups.map(([st,label])=>{
    const items=drafts.filter(d=>d.pool_status===st);
    const rows=items.map(d=>{
      const typeLabel = d.pool_type==="new" ? `Új javaslat: ${esc(d.megnevezes)}` : `Szerkesztés: ${esc(d.megnevezes)}`;
      const who = `beküldte: ${esc(nameOf(members,d.submitted_by))} · ${fmtDate((d.created_at||"").slice(0,10))||""}`;
      // Szám-darabszám: a draft nem törölt Számai; szerkesztési draftnál az élő szám is.
      const nDraft = kbCounts.draft[d.id]||0;
      const szamTxt = d.pool_type==="edit" && d.source_series_id
        ? `${nDraft} Szám, élőben: ${kbCounts.live[d.source_series_id]||0}`
        : `${nDraft} Szám`;
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
        // Visszaút a "Kész" után: a lefoglaló és az owner adhatja vissza (a DB is ezt kényszeríti ki).
        if(d.claimed_by===state.myId || isOwnerRole()){
          actions += `<button data-act="returnedit" data-id="${d.id}">Visszaadás szerkesztésre</button>`;
        }
      }
      return `<div class="userrow"><div class="uinfo"><div class="uname">${typeLabel} <span class="sc-kiado">· ${szamTxt}</span></div><div class="unote">${who}</div></div>
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
  if(act==="returnedit") return returnToEdit(d);
}

// Élő sorozat "Szerkesztés indítása": EGY szerver-oldali tranzakció
// (start_edit_draft) létrehozza a draftot, lefoglalja a hívónak, és átmásolja
// a jelenlegi élő NEM törölt Számokat/komponenseket (hogy legyen mihez képest
// diffelni publikáláskor). Nincs félig másolt draft; egy élő sorozathoz
// legfeljebb egy szerkesztési draft tartozhat; csak aktív sorozaton indítható —
// a függvény érthető üzenettel utasítja vissza a többit.
async function startEdit(s){
  try{
    const { error } = await supabase.rpc("start_edit_draft", { p_series_id: s.id });
    if(error) throw error;
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
  document.getElementById("fd-go").onclick=guarded(async ()=>{
    const v=document.getElementById("fd-confirm").value.trim();
    if(v!==s.megnevezes){ alert("A begépelt név nem egyezik pontosan."); return; }
    await doFinalize(s.id, v);
  });
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

// "Kész": DB-oldali függvény (mark_draft_ready) — a publikálás UTÁNI állapotot
// szimulálja, és lapszám-ütközés / hiányzó komponens / kötelező azonosító esetén érthető
// üzenettel megtagadja (blokkoló ellenőrzések: kivétel). Előtte a draft_ready_warnings
// NEM blokkoló figyelmeztetései (ajánlott azonosító hiánya, duplikált azonosító) egy
// megerősítő ablakban jelennek meg, "Mégis Kész" gombbal.
async function markReady(d){
  // Új sorozatnál a komponens-sablon (fő elem) kötelezően megadandó — a kliens kényszeríti ki
  // (az adatbázis üres sablonnál az alapértelmezettet használja, hogy a régi út ne törjön el).
  if(d.pool_type==="new" && !hasTemplate(d.component_template)){
    alert("Új sorozatnál előbb add meg a komponens-sablont (fő elem, típusok): nyisd meg a Szerkesztést, állítsd be a „Komponens-sablon” szakaszt, és mentsd a mezőket.");
    return;
  }
  let warns = [];
  try{
    const { data, error } = await supabase.rpc("draft_ready_warnings", { p_draft_id: d.id });
    if(error) throw error;
    warns = data || [];
  }catch(e){ warns = []; }          // a figyelmeztetés hibája nem akadályozza a "Kész"-et
  if(!warns.length){ await doMarkReady(d); return; }
  const items = warns.map(w=>{
    const det = Array.isArray(w.tetelek) && w.tetelek.length
      ? `<ul class="warnlist">${w.tetelek.map(t=>`<li><b>${esc(listName("komponens", t.tipus))}</b> „${esc((t.azonosito||"").trim())}”: ${(t.helyek||[]).map(esc).join(", ")}</li>`).join("")}</ul>` : "";
    return `<li>${esc(w.szoveg)}${det}</li>`;
  }).join("");
  openModal(`<h2>Figyelmeztetések a „Kész” előtt</h2>
    <p class="msub">Ezek nem akadályozzák a „Kész”-et, de érdemes átnézni:</p>
    <ul class="warnlist">${items}</ul>
    <div class="modrow"><button class="btn ghost" id="rw-cancel">Mégse</button><button class="btn" id="rw-ok">Mégis Kész</button></div>`);
  document.getElementById("rw-cancel").onclick=()=>karbantartasForm();
  document.getElementById("rw-ok").onclick=guarded(()=>doMarkReady(d));
}
async function doMarkReady(d){
  try{
    const { error } = await supabase.rpc("mark_draft_ready", { p_draft_id: d.id });
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
  const what = d.pool_type==="new" ? `az új „${esc(d.megnevezes)}” sorozatot` : `a(z) „${esc(d.megnevezes)}” szerkesztését`;
  // Összefoglaló a publikálás előtt: mi változna (ugyanazok a szabályok, mint a
  // publish_draft_series-ben — js/draft-diff.js). Ha az összefoglaló nem készíthető
  // el, a publikálás ettől még elérhető (a szerver-oldali függvény a mérvadó).
  openModal(`<h2>Publikálás</h2><p class="msub">Az összefoglaló készül…</p>`);
  let summary = "";
  try{
    const items = await fetchDraftItems(d.id);
    let liveIssues=[], liveComps=[];
    if(d.pool_type==="edit" && d.source_series_id){
      const { data:li, error:lie } = await fetchAllRows(()=>supabase.from("issues").select("id,lapszam,cim,megjelenes,eredeti_ar,is_deleted").eq("series_id", d.source_series_id));
      if(lie) throw lie;
      liveIssues = li||[];
      const ids = liveIssues.map(x=>x.id);
      if(ids.length){
        const { data:lc, error:lce } = await fetchAllRows(()=>supabase.from("components").select("id,issue_id,tipus,azonosito_tipus,azonosito,megnevezes,is_deleted").in("issue_id", ids));
        if(lce) throw lce;
        liveComps = lc||[];
      }
    }
    summary = diffSummaryText(diffDraft(items, liveIssues, liveComps));
  }catch(e){ summary = ""; }
  openModal(`<h2>Publikálás</h2>
    <p class="msub">Publikálod ${what}? Azonnal élesbe kerül, és mindenkinek látszik, akit érint.</p>
    ${summary?`<div class="example" style="font-size:13px"><b>Változások:</b> ${esc(summary)}</div>`:`<p class="msub" style="color:#f0cd8a">Az összefoglaló most nem készíthető el — a publikálás ettől még elérhető.</p>`}
    <div class="modrow"><button class="btn ghost" id="pub-cancel">Mégse</button><button class="btn" id="pub-ok">Publikálás</button></div>`);
  document.getElementById("pub-cancel").onclick=()=>karbantartasForm();
  document.getElementById("pub-ok").onclick=guarded(async ()=>{
    try{
      const { error } = await supabase.rpc("publish_draft_series", { p_draft_id: d.id });
      if(error) throw error;
      await reload();
    }catch(e){ showPublishError(d, e); return; }
    await karbantartasForm();
  });
}

// Sikertelen publikálás után nem nyers hibaüzenet-ablak: az ok mellett a
// javasolt következő lépés (Visszaadás szerkesztésre) is egy kattintásra van.
// A publikálás egy tranzakció, hiba esetén teljesen visszagördül — az élő
// sorozat és a munkaanyag is érintetlen.
function showPublishError(d, e){
  const canReturn = d.claimed_by===state.myId || isOwnerRole();
  openModal(`<h2>A publikálás nem sikerült</h2>
    <p class="msub" style="white-space:pre-wrap">${esc(e.message||String(e))}</p>
    <p class="msub">Az élő sorozat nem változott, a munkaanyag érintetlen.</p>
    <div class="modrow">
      <button class="btn ghost" id="pe-close">Bezár</button>
      ${canReturn?`<button class="btn" id="pe-return">Visszaadás szerkesztésre</button>`:""}
    </div>`);
  document.getElementById("pe-close").onclick=()=>karbantartasForm();
  const rb=document.getElementById("pe-return");
  if(rb) rb.onclick=()=>returnToEdit(d, true);
}

// "Publikálásra váró" → vissza "Munkaanyag"-ba. A tartalom, a lefoglalás és
// az élő sorozat érintetlen; a jogosultságot és a tiltásokat (force-törlés
// türelmi ideje, közben futó publikálás) az SQL-függvény kényszeríti ki.
async function returnToEdit(d, skipConfirm){
  if(!skipConfirm && !confirm(`Visszaadod szerkesztésre a(z) „${d.megnevezes}” munkaanyagot? A tartalma érintetlen marad, az élő sorozat nem változik, értesítés nincs.`)) return;
  try{
    const { error } = await supabase.rpc("return_draft_to_edit", { p_draft_id: d.id });
    if(error) throw error;
  }catch(e){ err(e); }
  await karbantartasForm();
}

/* ---- Draft mezőinek + tételeinek szerkesztése (a claim-elő sajátja) ---- */
async function editDraftForm(d){
  let color = d.szin || PAL12[0];
  // A sorozat komponens-sablonja (új Számok kiindulása). Ha a draftnak még nincs, az alapértelmezett
  // (a mostani komponens-listából) — a mentés írja be.
  let tmpl = hasTemplate(d.component_template) ? d.component_template.map(e=>({...e}))
           : defaultTemplate(d.components, state.TYPEDEFS);
  const compList = (state.LISTS.komponens||[{ertek:"magazin",nev:"Magazin"},{ertek:"modell",nev:"Modell"},{ertek:"konyv",nev:"Könyv"},{ertek:"egyeb",nev:"Egyéb"}]);

  openModal(`<h2>${d.pool_type==="new"?"Új javaslat szerkesztése: "+esc(d.megnevezes):"Szerkesztés: "+esc(d.megnevezes)}</h2><p class="msub">Betöltés…</p>`);
  let items;
  try{ items = await fetchDraftItems(d.id); }catch(e){ err(e); return; }
  renderEditDraft(d, color, tmpl, compList, items);
}

// A komponens-sablon szerkesztője (rendezhető lista, beállítások típusonként).
function tmplEditorHtml(tmpl, compList){
  const name = t => (compList.find(o=>o.ertek===t)||{}).nev || listName("komponens", t) || t;
  const ruleOpts = cur => ID_RULES.map(([v,l])=>`<option value="${v}"${v===cur?" selected":""}>${l}</option>`).join("");
  const rows = tmpl.map((e,i)=>`<div class="tmplrow" data-t="${esc(e.tipus)}">
      <div class="tmplhead"><b>${esc(name(e.tipus))}</b>
        <span class="tmplbtns">
          <button type="button" class="btn ghost" data-mv="-1" ${i===0?"disabled":""} aria-label="Feljebb">▲</button>
          <button type="button" class="btn ghost" data-mv="1" ${i===tmpl.length-1?"disabled":""} aria-label="Lejjebb">▼</button>
          <button type="button" class="btn ghost" data-rm="1" ${tmpl.length<=1?"disabled":""} aria-label="Eltávolítás">✕</button>
        </span></div>
      <label class="ckrow"><input type="radio" name="tmpl-main" value="${esc(e.tipus)}" ${e.main?"checked":""}> ★ fő elem <span class="unote">— a sorban az első helyen áll</span></label>
      <label class="ckrow"><input type="checkbox" data-k="required" ${e.required!==false?"checked":""}> kötelező <span class="unote">— minden új Számnál létrejön egy (üres) példány</span></label>
      <label class="ckrow"><input type="checkbox" data-k="counts_for_color" ${e.counts_for_color!==false?"checked":""}> számít a Szám színébe</label>
      <div class="grid2">
        <div class="field"><label>Azonosító</label><select data-k="id_rule">${ruleOpts(e.id_rule||"nincs")}</select></div>
        <div class="field"><label>Alap azonosító-típus</label><select data-k="default_azonosito_tipus"><option value="">—</option>${opts("azonosito", e.default_azonosito_tipus)}</select></div>
      </div>
      <div class="field"><label>Alap megnevezés (opcionális)</label><input data-k="default_megnevezes" value="${esc(e.default_megnevezes||"")}"></div>
    </div>`).join("");
  const free = compList.filter(o=>!tmpl.some(e=>e.tipus===o.ertek));
  return `<p class="msub">A sorozat új Számai ebből indulnak. A meglévő Számokat és komponenseket NEM módosítja. A sor legfeljebb ${TEMPLATE_SOFT_MAX} elemet mutat.</p>
    ${rows}
    ${tmpl.length>TEMPLATE_SOFT_MAX?`<div class="unote" style="color:#f0cd8a">⚠ ${tmpl.length} típus van a sablonban — a sor csak az első ${TEMPLATE_SOFT_MAX} elemet mutatja, a többit „+N” jelzi.</div>`:""}
    ${free.length?`<div class="modrow"><select id="d-tmpl-add">${free.map(o=>`<option value="${esc(o.ertek)}">${esc(o.nev)}</option>`).join("")}</select>
      <button type="button" class="btn ghost" id="d-tmpl-addbtn">+ Típus hozzáadása</button></div>`:""}`;
}

function renderEditDraft(d, color, tmpl, compList, items){
  let comps = templateTypes(tmpl);   // a deklarált típusok listája = a sablon típusai (kompatibilitás)
  openModal(`<h2>${d.pool_type==="new"?"Új javaslat szerkesztése: "+esc(d.megnevezes):"Szerkesztés: "+esc(d.megnevezes)}</h2>
    <p class="msub">Munkaanyag — csak neked látszik, amíg nem publikálod.</p>
    <div class="field"><label>Kiadó</label><select id="d-kiado"><option value="">—</option>${opts("kiado",d.kiado)}</select></div>
    <div class="field"><label>Kategória (témakör)</label><select id="d-kategoria"><option value="">—</option>${opts("kategoria",d.kategoria)}</select></div>
    <div class="field"><label>Megnevezés (teljes név)</label><input id="d-name" value="${esc(d.megnevezes||"")}"></div>
    <div class="field"><label>Megjelenítendő név a fülön (max ${DISPLAY_MAX}) — <span id="d-count">${(d.megjelenites||"").length}/${DISPLAY_MAX}</span></label>
      <input id="d-display" maxlength="${DISPLAY_MAX}" value="${esc(d.megjelenites||"")}"></div>
    <div class="field"><label>Komponens-sablon (miből áll egy szám)</label><div id="d-tmpl-wrap">${tmplEditorHtml(tmpl, compList)}</div></div>
    <div class="field"><label>Szín</label>
      <div id="d-sw">${PAL_FAMILIES.map(f=>`<div class="swfam"><span class="swfam-nev">${f.nev}</span>
        <div class="swatches">${f.szinek.map(c=>`<button type="button" class="swatch" data-c="${c}" style="background:${c}" aria-pressed="${c===color}"></button>`).join("")}</div></div>`).join("")}</div></div>
    <div class="modrow"><button class="btn ghost" id="d-back">Vissza</button><button class="btn" id="d-save">Mezők mentése</button></div>
    <div class="msub" style="margin:16px 0 2px;color:var(--accent);filter:brightness(1.2);font-weight:600">Számok (${items.length})</div>
    <div id="d-items">${renderDraftItemsList(items)}</div>
    <div class="modrow"><button class="btn ghost" id="d-additem">+ Új szám</button>
      <button class="btn ghost" id="d-tmpl">⬇ Sablon</button>
      <button class="btn ghost" id="d-tmplup">⬆ Sablon feltöltése</button></div>`);

  const dEl=document.getElementById("d-display"), cEl=document.getElementById("d-count");
  dEl.addEventListener("input",()=>cEl.textContent=`${dEl.value.length}/${DISPLAY_MAX}`);

  // --- komponens-sablon szerkesztő (delegált kezelők, csak a szakasz rajzolódik újra) ---
  const wrap = document.getElementById("d-tmpl-wrap");
  const redraw = () => { comps = templateTypes(tmpl); wrap.innerHTML = tmplEditorHtml(tmpl, compList); };
  wrap.addEventListener("click", e=>{
    const row = e.target.closest(".tmplrow");
    const mv = e.target.closest("[data-mv]"), rm = e.target.closest("[data-rm]"), add = e.target.closest("#d-tmpl-addbtn");
    if(add){ const sel = document.getElementById("d-tmpl-add"); if(sel&&sel.value){ tmpl = addType(tmpl, sel.value, state.TYPEDEFS); redraw(); } return; }
    if(!row) return;
    const t = row.dataset.t, i = tmpl.findIndex(x=>x.tipus===t);
    if(mv){ tmpl = move(tmpl, i, +mv.dataset.mv); redraw(); }
    else if(rm){ tmpl = removeType(tmpl, t); redraw(); }
  });
  wrap.addEventListener("change", e=>{
    const row = e.target.closest(".tmplrow"); if(!row) return;
    const t = row.dataset.t;
    if(e.target.name==="tmpl-main"){ tmpl = setMain(tmpl, e.target.value); redraw(); return; }
    const k = e.target.dataset.k; if(!k) return;
    const v = e.target.type==="checkbox" ? e.target.checked : (e.target.value || (k==="id_rule" ? "nincs" : null));
    tmpl = setField(tmpl, t, k, v);
    if(k==="default_megnevezes") tmpl = setField(tmpl, t, k, e.target.value.trim() || null);
  });

  document.getElementById("d-sw").addEventListener("click",e=>{ const b=e.target.closest(".swatch"); if(!b) return;
    color=b.dataset.c; sheet.querySelectorAll("#d-sw .swatch").forEach(x=>x.setAttribute("aria-pressed", x===b)); });
  document.getElementById("d-back").onclick=()=>karbantartasForm();
  document.getElementById("d-save").onclick=guarded(async ()=>{
    const nm=document.getElementById("d-name").value.trim();
    if(!nm){ alert("A megnevezés kötelező."); return; }
    const terr = templateError(tmpl);
    if(terr){ alert("A komponens-sablon nem menthető: "+terr+"."); return; }
    comps = templateTypes(tmpl);
    const disp=(dEl.value.trim()||nm).slice(0,DISPLAY_MAX);
    try{
      const { error } = await supabase.from("draft_series").update({
        kiado: document.getElementById("d-kiado").value||null,
        kategoria: document.getElementById("d-kategoria").value||null,
        megnevezes: nm, megjelenites: disp, szin: color, components: comps, component_template: tmpl,
      }).eq("id", d.id);
      if(error) throw error;
    }catch(e){ err(e); return; }
    d = {...d, kiado:document.getElementById("d-kiado").value||null, kategoria:document.getElementById("d-kategoria").value||null, megnevezes:nm, megjelenites:disp, szin:color, components:comps, component_template:tmpl};
    await editDraftForm(d);
  });
  // Egy komponens-átsorolás / új típus a draft komponens-listáját érintheti (draft-items.js) —
  // a szerkesztőbe visszatérve ezért friss draft_series sort töltünk be, nem a bezáráskori `d`-t.
  const reopen = async ()=>{
    const { data:fresh } = await supabase.from("draft_series").select("*").eq("id",d.id).single();
    await editDraftForm(fresh||d);
  };
  document.getElementById("d-additem").onclick=()=>draftItemForm(d.id, null, comps, reopen, tmpl);
  sheet.querySelectorAll("#d-items [data-diedit]").forEach(b=>{
    b.onclick=()=>{ const it=items.find(x=>x.id===b.dataset.diedit); if(it) draftItemForm(d.id, it, comps, reopen, tmpl); };
  });
  document.getElementById("d-tmpl").onclick=()=>{
    if(!comps.length){ alert("Előbb adj hozzá legalább egy komponens-típust a sablonhoz."); return; }
    // Oda-vissza sablon: a draft AKTUÁLIS állapotát tölti le (rejtett azonosítókkal).
    fetchDraftItems(d.id)
      .then(items=>downloadDraftTemplate(comps, d.megnevezes, { draftSeriesId:d.id, items }))
      .catch(err);
  };
  document.getElementById("d-tmplup").onclick=()=>{
    if(!comps.length){ alert("Előbb adj hozzá legalább egy komponens-típust a sablonhoz."); return; }
    pickDraftExcelFile(file=>confirmDraftUpload(openModal, err, file, d.id, comps, reopen));
  };
}
