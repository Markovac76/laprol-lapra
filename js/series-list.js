/* ============================================================
   Sorozat-lista keresés és rendezés — KÖZÖS komponens.
   Használja: Karbantartás › Aktív sorozatok, és a „Sorozataim” választó,
   hogy a két hely ne csússzon szét. A tiszta részek (normText, filterSeries,
   sortSeries, computeLastChanged) Node-ban tesztelhetők:
   scripts/tests/series-list.test.mjs

   - Keresés: névre (megjelenített + teljes név), kis- és nagybetű-,
     valamint ékezetfüggetlenül ("forma" megtalálja a "Formula"-t).
   - Rendezés: név szerint (magyar ABC: Intl.Collator("hu")), legutóbb
     módosított, Számok száma szerint.
   - "Legutóbb módosított": a sorozat LEGUTÓBBI TARTALMI VÁLTOZÁSÁNAK ideje:
     a change_log legfrissebb bejegyzése a sorozatra, vagy bármelyik Számára /
     komponensére (a változások csak publikáláson át érkeznek, tehát ez a
     legutóbbi publikálás, ami a sorozatot ténylegesen érintette; a csendes
     átszámozás is naplózódik). Ha nincs bejegyzés (még sosem módosult), a
     sorozat létrehozásának ideje.
   - A választás megmarad (localStorage, minden hozzáférés try/catch-ben:
     tárolás nélkül is működik).
   ============================================================ */
import { supabase, fetchAllRows } from "./supabase.js";
import { SORTS, loadSort, saveSort, normText, filterSeries, sortSeries, computeLastChanged } from "./series-sort.js";
export { SORTS, loadSort, saveSort, normText, filterSeries, sortSeries, computeLastChanged };

/* ---- adatbetöltés (hálózat) ---- */
let lastCache = null;
export async function loadCounts(){
  const { data, error } = await fetchAllRows(()=>supabase.from("issues").select("series_id,is_deleted"));
  if(error) throw error;
  const counts = {};
  (data||[]).forEach(r=>{ if(!r.is_deleted) counts[r.series_id] = (counts[r.series_id]||0) + 1; });
  return counts;
}
export async function loadLastChanged(force = false){
  if(lastCache && !force) return lastCache;
  const [ch, is, cs] = await Promise.all([
    fetchAllRows(()=>supabase.from("change_log").select("entity_type,entity_id,changed_at")),
    fetchAllRows(()=>supabase.from("issues").select("id,series_id")),
    fetchAllRows(()=>supabase.from("components").select("id,issue_id")),
  ]);
  const e = ch.error || is.error || cs.error; if(e) throw e;
  lastCache = computeLastChanged(ch.data||[], is.data||[], cs.data||[]);
  return lastCache;
}

/* ---- felület ---- */
export function controlsHtml(prefix, sort, query = ""){
  const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  return `<div class="slc">
    <input type="search" id="${prefix}-q" placeholder="Keresés a sorozatok között…" value="${esc(query)}" autocomplete="off">
    <select id="${prefix}-sort" aria-label="Rendezés">${SORTS.map(([v,l])=>`<option value="${v}"${v===sort?" selected":""}>${l}</option>`).join("")}</select>
  </div>`;
}
// onChange({query, sort}) — a hívó újrarajzolja a listát (a kereső fókusza megmarad).
export function wireControls(root, prefix, onChange){
  const q = root.querySelector(`#${prefix}-q`), s = root.querySelector(`#${prefix}-sort`);
  if(!q || !s) return;
  const fire = () => onChange({ query: q.value, sort: s.value });
  q.addEventListener("input", fire);
  s.addEventListener("change", ()=>{ saveSort(s.value); fire(); });
}
