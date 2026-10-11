/* ============================================================
   "Sorozataim" — a felhasználó kiválasztja, mely publikált sorozatokat
   szeretné a saját fülsávjában látni (member_series réteg — 2.3).
   Minden bejelentkezett usernek elérhető, staffnak is.
   ============================================================ */
import { supabase, fetchAllRows } from "./supabase.js";
import { state, esc, listName } from "./state.js";
import { openModal, err, sheet, guarded } from "./modal.js";
import { reload } from "./data.js";
import { proposeSeriesForm } from "./series-proposal.js";
import { controlsHtml, wireControls, filterSeries, sortSeries, loadSort, loadCounts, loadLastChanged } from "./series-list.js";

// keresés + rendezés (közös komponens: series-list.js — ugyanaz, mint a Karbantartás Aktív fülén)
let listQuery = "";
let listSort = loadSort();
let msMeta = { counts:{}, last:null };

export async function mySeriesForm(){
  listSort = loadSort();   // a közös (megjegyzett) rendezés — a Karbantartásban is állítható
  openModal(`<h2>Sorozataim</h2><p class="msub">Betöltés…</p>`);
  const [{data:series,error:se},{data:mine,error:me}] = await Promise.all([
    supabase.from("series").select("id,megnevezes,megjelenites,kiado,lifecycle,force_delete_requested_at,created_at").order("sort_order"),
    supabase.from("member_series").select("*").eq("user_id",state.myId),
  ]);
  if(se||me){ err(se||me); return; }
  msMeta = { counts:{}, last:null };
  try{ msMeta.counts = await loadCounts(); }catch(_){ /* a Számok száma szerinti rendezés nélkül is működik */ }
  if(listSort==="modositva"){ try{ msMeta.last = await loadLastChanged(true); }catch(_){ msMeta.last = {}; } }
  render(series||[], mine||[]);
}

function render(series, mine){
  const byId={}; mine.forEach(m=>byId[m.series_id]=m);
  // Publikálatlan sorozat csak akkor jelenik meg, ha valaha volt hozzá saját sorunk
  // (grandfather-hozzáférés) — brand new usernek egyáltalán nem választható.
  const visible = sortSeries(filterSeries(series.filter(s=>s.lifecycle!=="unpublished" || !!byId[s.id]), listQuery), listSort, msMeta);
  const rows = visible.map(s=>{
    const m=byId[s.id];
    const selected = !!(m && m.is_selected);
    const unpublishedBlocked = s.lifecycle==="unpublished" && !selected;
    const deleteMarkedBlocked = !!s.force_delete_requested_at && !selected;
    const blocked = unpublishedBlocked || deleteMarkedBlocked;
    const note = deleteMarkedBlocked
      ? `<span class="unote" style="color:#f3b6b6">törlésre jelölve — nem választható</span>`
      : unpublishedBlocked
      ? `<span class="unote" style="color:#f3b6b6">publikálatlan — nem választható újra</span>`
      : "";
    return `<label class="serieschoice${blocked?" blocked":""}">
      <input type="checkbox" data-id="${s.id}" ${selected?"checked":""} ${blocked?"disabled":""}>
      <span class="sc-name">${esc(s.megjelenites||s.megnevezes)}${s.kiado?` <span class="sc-kiado">· ${esc(listName("kiado",s.kiado))}</span>`:""}</span>
      ${note}
    </label>`;
  }).join("");
  openModal(`<h2>Sorozataim</h2>
    <p class="msub">Válaszd ki, mely sorozatokat szeretnéd a fülsávodban látni.</p>
    ${controlsHtml("msl", listSort, listQuery)}
    ${rows||`<p class="msub">${listQuery.trim() ? "Nincs a keresésnek megfelelő sorozat." : "Nincs elérhető sorozat."}</p>`}
    <div class="modrow"><button class="btn ghost" id="ms-propose">+ Új sorozat javaslása</button></div>
    <div class="modrow"><button class="btn" onclick="closeModal()">Kész</button></div>`);
  sheet.querySelectorAll('input[type=checkbox][data-id]').forEach(cb=>{
    cb.onchange=guarded(()=>onToggle(cb, series, mine));
  });
  document.getElementById("ms-propose").onclick=proposeSeriesForm;
  // keresés / rendezés: a lista újrarajzolódik (a kereső fókusza és szövege megmarad)
  wireControls(sheet, "msl", async ({query, sort})=>{
    const hadFocus = document.activeElement && document.activeElement.id==="msl-q";
    listQuery=query; listSort=sort;
    if(sort==="modositva" && !msMeta.last){ try{ msMeta.last = await loadLastChanged(true); }catch(_){ msMeta.last = {}; } }
    render(series, mine);
    if(hadFocus){ const q=document.getElementById("msl-q"); if(q){ q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  });
}

async function onToggle(cb, series, mine){
  const id=cb.dataset.id;
  if(cb.checked){
    try{
      const { error } = await supabase.from("member_series")
        .upsert({ user_id: state.myId, series_id: id, is_selected: true, selected_at: new Date().toISOString() }, { onConflict: "user_id,series_id" });
      if(error) throw error;
      // Baseline: a jelenlegi verzióra állítja a "látott" jelzőt minden tételen,
      // hogy ne jelezzen hamisan olyan változásra, amit sosem látott másképp.
      const { error: seenErr } = await supabase.rpc("seed_member_seen", { p_series_id: id });
      if(seenErr) throw seenErr;
    }catch(e){ err(e); }
    await mySeriesForm(); await reload();
    return;
  }
  const s=series.find(x=>x.id===id);
  askDeselect(s, series, mine);
}

function askDeselect(s, series, mine){
  openModal(`<h2>Leválasztás</h2>
    <p class="msub">Leválasztod a(z) „${esc(s.megjelenites||s.megnevezes)}” sorozatot a fülsávodból.
      Mi legyen a hozzá tartozó saját adataiddal (jelölések, árak)?</p>
    <div class="modrow">
      <button class="btn ghost" id="ds-cancel">Mégse</button>
      <button class="btn" id="ds-keep">Megtartom</button>
    </div>
    <div class="modrow"><button class="btn danger" id="ds-delete">Törlöm a saját adataimat is</button></div>`);
  document.getElementById("ds-cancel").onclick=()=>render(series, mine);
  document.getElementById("ds-keep").onclick=guarded(()=>confirmDeselect(s.id, false));
  document.getElementById("ds-delete").onclick=guarded(()=>confirmDeselect(s.id, true));
}

async function confirmDeselect(seriesId, purge){
  try{
    const { error } = await supabase.from("member_series")
      .update({ is_selected:false, deselected_at:new Date().toISOString() })
      .eq("user_id",state.myId).eq("series_id",seriesId);
    if(error) throw error;
    if(purge) await purgePersonalData(seriesId);
  }catch(e){ err(e); }
  await mySeriesForm(); await reload();
}

// Leválasztáskor "törlöm" választásra a saját member_status/member_issue_data
// sorok törlése erre a sorozatra nézve (a törzsadat, más userek adata érintetlen).
async function purgePersonalData(seriesId){
  const { data: issues } = await fetchAllRows(()=>supabase.from("issues").select("id").eq("series_id", seriesId));
  const issueIds = (issues||[]).map(x=>x.id);
  if(!issueIds.length) return;
  // A "több azonos típusú komponens" funkció óta ez könnyebben átlépheti a
  // 1000-es alapértelmezett Supabase-limitet egy nagy sorozatnál.
  const { data: comps } = await fetchAllRows(()=>supabase.from("components").select("id").in("issue_id", issueIds));
  const compIds = (comps||[]).map(x=>x.id);
  if(compIds.length) await supabase.from("member_status").delete().eq("user_id",state.myId).in("component_id",compIds);
  await supabase.from("member_issue_data").delete().eq("user_id",state.myId).in("issue_id",issueIds);
}
