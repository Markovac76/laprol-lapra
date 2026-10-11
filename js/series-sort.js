/* ============================================================
   Sorozat-lista keresés/rendezés — TISZTA rész (nincs DOM/hálózat),
   Node-ban tesztelhető: scripts/tests/series-list.test.mjs.
   A leírás és a döntések: series-list.js.
   ============================================================ */
export const SORTS = [["abc","Név szerint (ABC)"],["modositva","Legutóbb módosított"],["szamok","Számok száma szerint"]];
const KEY = "laprol.serieslist.sort";

export function loadSort(){
  try{ const v = localStorage.getItem(KEY); if(SORTS.some(s=>s[0]===v)) return v; }catch(_){}
  return "abc";
}
export function saveSort(v){ try{ localStorage.setItem(KEY, v); }catch(_){} }

export const normText = s => String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const nameOf = s => s.megjelenites || s.megnevezes || "";
const collator = new Intl.Collator("hu", { sensitivity:"base", numeric:true });

export function filterSeries(list, query){
  const q = normText(query);
  if(!q) return list.slice();
  return list.filter(s => normText(s.megjelenites).includes(q) || normText(s.megnevezes).includes(q));
}

// meta: {counts: {seriesId: n}, last: {seriesId: ISO}|null}
export function sortSeries(list, sort, meta = {}){
  const counts = meta.counts || {}, last = meta.last || {};
  const lastOf = s => last[s.id] || s.created_at || "";
  const abc = (a, b) => collator.compare(nameOf(a), nameOf(b));
  const out = list.slice();
  if(sort === "modositva") out.sort((a, b) => (lastOf(a) < lastOf(b) ? 1 : lastOf(a) > lastOf(b) ? -1 : abc(a, b)));
  else if(sort === "szamok") out.sort((a, b) => ((counts[b.id]||0) - (counts[a.id]||0)) || abc(a, b));
  else out.sort(abc);
  return out;
}

// changeRows: [{entity_type, entity_id, changed_at}]; issues: [{id, series_id}]; comps: [{id, issue_id}]
export function computeLastChanged(changeRows, issues, comps){
  const issueSeries = new Map(issues.map(i => [i.id, i.series_id]));
  const compSeries = new Map(comps.map(c => [c.id, issueSeries.get(c.issue_id)]));
  const last = {};
  for(const r of changeRows){
    const sid = r.entity_type === "series" ? r.entity_id
              : r.entity_type === "issue" ? issueSeries.get(r.entity_id)
              : r.entity_type === "component" ? compSeries.get(r.entity_id) : null;
    if(sid && (!last[sid] || r.changed_at > last[sid])) last[sid] = r.changed_at;
  }
  return last;
}

