/* ============================================================
   Változás-jelzés (felkiáltójel) — sorozat/szám/komponens
   mezőváltozásainak megjelenítése és nyugtázása (member_seen).
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, esc, COMP_TYPES } from "./state.js";
import { openModal, err } from "./modal.js";
import { reload } from "./data.js";

const FIELD_LABELS = {
  kiado:"Kiadó", megnevezes:"Megnevezés", megjelenites:"Megjelenítendő név", szin:"Szín", components:"Komponens-készlet",
  lapszam:"Lapszám", cim:"Cím", megjelenes:"Megjelenés dátuma", eredeti_ar:"Eredeti ár",
  azonosito_tipus:"Azonosító típusa", azonosito:"Azonosító",
};
const fieldLabel = f => FIELD_LABELS[f] || f;

async function fetchSeenMap(ids){
  if(!ids.length) return {};
  const { data, error } = await supabase.from("member_seen").select("entity_type,entity_id,last_seen_version")
    .eq("user_id", state.myId).in("entity_id", ids);
  if(error) throw error;
  const m={}; (data||[]).forEach(r=>{ m[r.entity_type+":"+r.entity_id]=r.last_seen_version; });
  return m;
}

async function fetchChangeLog(ids){
  if(!ids.length) return [];
  const { data, error } = await supabase.from("change_log").select("*").in("entity_id", ids).order("version");
  if(error) throw error;
  return data||[];
}

function unseenDiffsFor(rows, entityType, entityId, seenVersion){
  const unseen = rows.filter(r=>r.entity_type===entityType && r.entity_id===entityId && r.version>seenVersion);
  if(!unseen.length) return [];
  const byField={};
  unseen.forEach(r=>{ (byField[r.field_name]=byField[r.field_name]||[]).push(r); });
  return Object.keys(byField).map(f=>{
    const fr=byField[f]; const oldest=fr[0], current=fr.find(r=>r.is_current)||fr[fr.length-1];
    return { field:f, old:oldest.old_value, new:current.new_value };
  });
}

function diffHtml(diffs){
  if(!diffs.length) return "";
  return `<div class="example">` + diffs.map(d=>`${fieldLabel(d.field)}: ${esc(d.old??"—")} → ${esc(d.new??"—")}`).join("\n") + `</div>`;
}

async function markSeen(entityType, entityId, version){
  const { error } = await supabase.from("member_seen")
    .upsert({ user_id: state.myId, entity_type: entityType, entity_id: entityId, last_seen_version: version }, { onConflict: "user_id,entity_type,entity_id" });
  if(error) throw error;
}

function componentEntries(it){ return Object.entries(it.comps).filter(([,c])=>c.id); }

export async function showSeriesChangePopup(s){
  try{
    const seen = await fetchSeenMap([s.id]);
    const rows = await fetchChangeLog([s.id]);
    const diffs = unseenDiffsFor(rows, "series", s.id, seen["series:"+s.id] ?? 0);
    openModal(`<h2>Sorozat változásai</h2><p class="msub">„${esc(s.sorozat)}” — a törzsadat módosult.</p>
      ${diffHtml(diffs) || `<p class="msub">Nincs megjeleníthető változás.</p>`}
      <div class="modrow"><button class="btn ghost" onclick="closeModal()">Mégse</button><button class="btn" id="chg-ok">OK, nyugtázom</button></div>`);
    document.getElementById("chg-ok").onclick=async ()=>{
      try{ await markSeen("series", s.id, s.version); }catch(e){ err(e); return; }
      closeModal(); await reload();
    };
  }catch(e){ err(e); }
}

export async function showIssueChangePopup(it, s){
  try{
    const comps = componentEntries(it);
    const ids = [it.id, ...comps.map(([,c])=>c.id)];
    const seen = await fetchSeenMap(ids);
    const rows = await fetchChangeLog(ids);
    let blocks = diffHtml(unseenDiffsFor(rows, "issue", it.id, seen["issue:"+it.id] ?? 0));
    for(const [t,c] of comps){
      const d = unseenDiffsFor(rows, "component", c.id, seen["component:"+c.id] ?? 0);
      if(d.length) blocks += `<div class="msub" style="margin-top:8px;font-weight:600">${COMP_TYPES[t]||t}</div>${diffHtml(d)}`;
    }
    openModal(`<h2>#${it.n} változásai</h2><p class="msub">„${esc(s.sorozat)}” — ${it.name?esc(it.name):"ez a szám"} módosult.</p>
      ${blocks || `<p class="msub">Nincs megjeleníthető változás.</p>`}
      <div class="modrow"><button class="btn ghost" onclick="closeModal()">Mégse</button><button class="btn" id="chg-ok">OK, nyugtázom</button></div>`);
    document.getElementById("chg-ok").onclick=async ()=>{
      try{
        await markSeen("issue", it.id, it.version);
        for(const [,c] of comps) await markSeen("component", c.id, c.version);
      }catch(e){ err(e); return; }
      closeModal(); await reload();
    };
  }catch(e){ err(e); }
}

export async function showCollectedChanges(s){
  openModal(`<h2>Összes változás — ${esc(s.sorozat)}</h2><p class="msub">Betöltés…</p>`);
  try{
    const changedItems = s.items.filter(it=>it.changed);
    const allIds = [s.id];
    changedItems.forEach(it=>{ allIds.push(it.id); componentEntries(it).forEach(([,c])=>allIds.push(c.id)); });
    const seen = await fetchSeenMap(allIds);
    const rows = await fetchChangeLog(allIds);

    let html = "";
    if(s.changed){
      const d = unseenDiffsFor(rows, "series", s.id, seen["series:"+s.id] ?? 0);
      if(d.length) html += `<div class="msub" style="font-weight:600">Sorozat</div>${diffHtml(d)}`;
    }
    for(const it of changedItems){
      let block = diffHtml(unseenDiffsFor(rows, "issue", it.id, seen["issue:"+it.id] ?? 0));
      for(const [t,c] of componentEntries(it)){
        const d = unseenDiffsFor(rows, "component", c.id, seen["component:"+c.id] ?? 0);
        if(d.length) block += `<div class="msub" style="margin-top:4px">${COMP_TYPES[t]||t}</div>${diffHtml(d)}`;
      }
      if(block) html += `<div class="msub" style="font-weight:600;margin-top:10px">#${it.n}${it.name?" – "+esc(it.name):""}</div>${block}`;
    }
    if(!html) html = `<p class="msub">Nincs elfogadásra váró változás.</p>`;
    openModal(`<h2>Összes változás — ${esc(s.sorozat)}</h2>
      ${html}
      <div class="modrow"><button class="btn ghost" onclick="closeModal()">Bezár</button>
      ${s.anyChanged?`<button class="btn" id="chg-all">Mind elfogadom</button>`:""}</div>`);
    const allBtn=document.getElementById("chg-all");
    if(allBtn) allBtn.onclick=async ()=>{
      try{ const { error } = await supabase.rpc("seed_member_seen", { p_series_id: s.id }); if(error) throw error; }
      catch(e){ err(e); return; }
      closeModal(); await reload();
    };
  }catch(e){ err(e); }
}
