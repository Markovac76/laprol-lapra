/* ============================================================
   "Sorozataim" — a felhasználó kiválasztja, mely publikált sorozatokat
   szeretné a saját fülsávjában látni (member_series réteg — 2.3).
   Minden bejelentkezett usernek elérhető, staffnak is.
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, esc, listName } from "./state.js";
import { openModal, err, sheet } from "./modal.js";
import { reload } from "./data.js";

export async function mySeriesForm(){
  openModal(`<h2>Sorozataim</h2><p class="msub">Betöltés…</p>`);
  const [{data:series,error:se},{data:mine,error:me}] = await Promise.all([
    supabase.from("series").select("id,megnevezes,megjelenites,kiado").order("sort_order"),
    supabase.from("member_series").select("*").eq("user_id",state.myId),
  ]);
  if(se||me){ err(se||me); return; }
  render(series||[], mine||[]);
}

function render(series, mine){
  const byId={}; mine.forEach(m=>byId[m.series_id]=m);
  const rows = series.map(s=>{
    const m=byId[s.id];
    const selected = !!(m && m.is_selected);
    const blocked = !!(m && !m.is_selected && m.delete_count>=5);
    const dcount = m ? m.delete_count : 0;
    const note = blocked
      ? `<span class="unote" style="color:#f3b6b6">5/5 törlés — nem választható újra</span>`
      : (dcount>0 ? `<span class="unote">${dcount}/5 törlés felhasználva</span>` : "");
    return `<label class="serieschoice${blocked?" blocked":""}">
      <input type="checkbox" data-id="${s.id}" ${selected?"checked":""} ${blocked?"disabled":""}>
      <span class="sc-name">${esc(s.megjelenites||s.megnevezes)}${s.kiado?` <span class="sc-kiado">· ${esc(listName("kiado",s.kiado))}</span>`:""}</span>
      ${note}
    </label>`;
  }).join("");
  openModal(`<h2>Sorozataim</h2>
    <p class="msub">Válaszd ki, mely sorozatokat szeretnéd a fülsávodban látni.</p>
    ${rows||'<p class="msub">Nincs elérhető sorozat.</p>'}
    <div class="modrow"><button class="btn" onclick="closeModal()">Kész</button></div>`);
  sheet.querySelectorAll('input[type=checkbox][data-id]').forEach(cb=>{
    cb.onchange=()=>onToggle(cb, series, mine);
  });
}

async function onToggle(cb, series, mine){
  const id=cb.dataset.id;
  const m=mine.find(x=>x.series_id===id);
  if(cb.checked){
    try{
      const { error } = await supabase.from("member_series")
        .upsert({ user_id: state.myId, series_id: id, is_selected: true, selected_at: new Date().toISOString() }, { onConflict: "user_id,series_id" });
      if(error) throw error;
    }catch(e){ err(e); }
    await mySeriesForm(); await reload();
    return;
  }
  const s=series.find(x=>x.id===id);
  askDeselect(s, m, series, mine);
}

function askDeselect(s, m, series, mine){
  openModal(`<h2>Leválasztás</h2>
    <p class="msub">Leválasztod a(z) „${esc(s.megjelenites||s.megnevezes)}” sorozatot a fülsávodból.
      Mi legyen a hozzá tartozó saját adataiddal (jelölések, árak)?</p>
    <div class="modrow">
      <button class="btn ghost" id="ds-cancel">Mégse</button>
      <button class="btn" id="ds-keep">Megtartom</button>
    </div>
    <div class="modrow"><button class="btn danger" id="ds-delete">Törlöm a saját adataimat is</button></div>`);
  document.getElementById("ds-cancel").onclick=()=>render(series, mine);
  document.getElementById("ds-keep").onclick=()=>confirmDeselect(s.id, m, false);
  document.getElementById("ds-delete").onclick=()=>confirmDeselect(s.id, m, true);
}

async function confirmDeselect(seriesId, m, purge){
  try{
    const { error } = await supabase.from("member_series")
      .update({ is_selected:false, deselected_at:new Date().toISOString(), delete_count:(m?m.delete_count:0)+1 })
      .eq("user_id",state.myId).eq("series_id",seriesId);
    if(error) throw error;
    if(purge) await purgePersonalData(seriesId);
  }catch(e){ err(e); }
  await mySeriesForm(); await reload();
}

// Leválasztáskor "törlöm" választásra a saját member_status/member_issue_data
// sorok törlése erre a sorozatra nézve (a törzsadat, más userek adata érintetlen).
async function purgePersonalData(seriesId){
  const { data: issues } = await supabase.from("issues").select("id").eq("series_id", seriesId);
  const issueIds = (issues||[]).map(x=>x.id);
  if(!issueIds.length) return;
  const { data: comps } = await supabase.from("components").select("id").in("issue_id", issueIds);
  const compIds = (comps||[]).map(x=>x.id);
  if(compIds.length) await supabase.from("member_status").delete().eq("user_id",state.myId).in("component_id",compIds);
  await supabase.from("member_issue_data").delete().eq("user_id",state.myId).in("issue_id",issueIds);
}
