/* ============================================================
   Sablon-alapú tömeges tétel-feltöltés draft-okhoz (11. pont).
   Közös mechanizmus az "Új sorozat javaslása" köztes lépéséhez ÉS a
   Karbantartás draft-szerkesztőjéhez — mindkettő ugyanide tölt fel
   (draft_issues/draft_components), csak más a kiindulópont (üres,
   ill. a sorozat már meglévő komponens-készlete). Nincs személyes
   réteg (a draft még nem élő, senkinek nincs rajta saját adata) —
   ezért egyszerűbb, mint a live excel.js (nincs ár/státusz oszlop).
   ============================================================ */
import { supabase } from "./supabase.js";
import { COMP_TYPES, esc, listName } from "./state.js";
import { loadXlsx, coerceDate, parseHuNumber } from "./excel.js";

const typeLabel = t => listName("komponens", t) || COMP_TYPES[t] || t;

function tmplHead(components){
  const h=["lapszám","cím","dátum (Excel dátum, pl. 2026.03.15)","eredeti ár (csak szám)"];
  components.forEach(t=>h.push(typeLabel(t)+" azonosító"));
  return h;
}

// A rejtett #draftUpl file-inputot nyitja meg — közös mindkét hívó
// helynek (series-proposal.js, karbantartas.js), hogy ne kelljen
// mindkettőben külön hidden inputot/onchange-bekötést tartani.
export function pickDraftExcelFile(onFile){
  const inp=document.getElementById("draftUpl");
  inp.onchange=function(){ const f=this.files&&this.files[0]; this.value=""; if(f) onFile(f); };
  inp.click();
}

export async function downloadDraftTemplate(components, seriesName){
  const X=await loadXlsx(), head=tmplHead(components);
  const ex1=[1,"Példa – írd át vagy töröld", new Date(2026,2,15), 2490]; components.forEach(()=>ex1.push(""));
  const ex2=[2,"Másik példa", new Date(2026,3,15), 1490]; components.forEach(()=>ex2.push(""));
  const ws=X.utils.aoa_to_sheet([head,ex1,ex2], {cellDates:true});
  ws["!cols"]=head.map(h=>({wch:Math.max(14,h.length+2)}));
  if(ws["D2"]) ws["D2"].z='#,##0" Ft"'; if(ws["D3"]) ws["D3"].z='#,##0" Ft"';
  if(ws["C2"]) ws["C2"].z="yyyy-mm-dd"; if(ws["C3"]) ws["C3"].z="yyyy-mm-dd";
  const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Sorozat");
  X.writeFile(wb,`laprol-lapra-sablon-${(seriesName||"sorozat").replace(/\s+/g,"-")}.xlsx`);
}

// Kitöltött sablon beolvasása — NEM ír adatbázisba, csak feldolgozott
// sorokat ad vissza (a hívó dönt a megerősítésről).
export async function parseDraftExcel(file, components){
  const X=await loadXlsx();
  const wb=X.read(await file.arrayBuffer(),{cellDates:true});
  const aoa=X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,defval:""});
  const rows=[], dateWarnings=[];
  for(const row of aoa){
    if(!row||!row.length) continue;
    const n=parseInt(String(row[0]).trim()); if(isNaN(n)) continue;
    const cim=String(row[1]??"").trim()||null;
    const megjelenes=coerceDate(row[2]);
    if(row[2] && String(row[2]).trim() && !megjelenes) dateWarnings.push(n);
    const eredeti_ar=parseHuNumber(row[3]);
    const comps=components.map((t,ci)=>({tipus:t, azonosito:String(row[4+ci]??"").trim()||null}));
    rows.push({lapszam:n, cim, megjelenes, eredeti_ar, comps});
  }
  return {rows, dateWarnings};
}

// A sorokat draft_issues/draft_components soraivá írja egy adott draft
// alá. Az ütköző (már meglévő lapszámú) sorokat kihagyja — nem írja
// felül csendben a már kézzel szerkesztett tételeket.
export async function bulkInsertDraftItems(draftSeriesId, rows){
  const { data: existing, error: eerr } = await supabase.from("draft_issues")
    .select("lapszam").eq("draft_series_id", draftSeriesId);
  if(eerr) throw eerr;
  const existingNums = new Set((existing||[]).map(r=>r.lapszam));
  let inserted=0, skipped=0;
  for(const row of rows){
    if(existingNums.has(row.lapszam)){ skipped++; continue; }
    const { data, error } = await supabase.from("draft_issues").insert({
      draft_series_id: draftSeriesId, lapszam: row.lapszam, cim: row.cim,
      megjelenes: row.megjelenes, eredeti_ar: row.eredeti_ar,
    }).select().single();
    if(error) throw error;
    if(row.comps.length){
      const payload = row.comps.map(c=>({ draft_issue_id:data.id, tipus:c.tipus, azonosito:c.azonosito, source_component_id:null }));
      const { error: cerr } = await supabase.from("draft_components").insert(payload);
      if(cerr) throw cerr;
    }
    existingNums.add(row.lapszam);
    inserted++;
  }
  return {inserted, skipped};
}

// Ugyanez, de a javaslat EREDETI beküldője hívja, MÉG A STAFF ÁLTALI
// ÁTVÉTEL ELŐTT ("Új sorozat javaslása" köztes lépése) — a draft_issues/
// draft_components RLS-e staff-only, ezért ez egy SECURITY DEFINER RPC-n
// megy át, ami saját tulajdonos-/állapot-ellenőrzést végez.
export async function bulkInsertDraftItemsAsProposer(draftSeriesId, rows){
  const { data, error } = await supabase.rpc("propose_bulk_issues", {
    p_draft_id: draftSeriesId,
    p_rows: rows.map(r=>({ lapszam:r.lapszam, cim:r.cim, megjelenes:r.megjelenes, eredeti_ar:r.eredeti_ar, comps:r.comps })),
  });
  if(error) throw error;
  return { inserted: data.inserted, skipped: data.skipped };
}

// Közös megerősítő-modal — a hívó adja meg a draftId-t/components-et és
// egy onDone callback-et (ami a hívó saját nézetét frissíti/tovább lép,
// és ezzel felülírja ezt a megerősítő tartalmat is).
// A `openModal`-t/`err`-t a hívó adja át, hogy ne kelljen körkörös
// importot bevezetni a modal.js és a karbantartas.js/series-proposal.js között.
// insertFn: melyik beszúró-mechanizmust használja — staffnál (Karbantartás,
// már claim-elt draft) a közvetlen táblaírás az alapértelmezett; a "Új
// sorozat javaslása" köztes lépése explicit bulkInsertDraftItemsAsProposer-t ad át.
export function confirmDraftUpload(openModal, err, file, draftSeriesId, components, onDone, insertFn = bulkInsertDraftItems){
  parseDraftExcel(file, components).then(({rows,dateWarnings})=>{
    if(!rows.length){ alert("Nem találtam feldolgozható sort a fájlban."); return; }
    const warnBlock = dateWarnings.length
      ? `<p class="msub" style="color:#f0cd8a">⚠ ${dateWarnings.length} sor dátuma nem volt felismerhető (#${dateWarnings.slice(0,8).join(", #")}${dateWarnings.length>8?"…":""}) — ezeknél a dátum üresen marad, a többi mező feltöltődik.</p>`
      : "";
    openModal(`<h2>Sablon feltöltésének megerősítése</h2>
      ${warnBlock}
      <div class="example" style="font-size:13px">
${rows.length} sor feldolgozva a fájlból:
${rows.slice(0,5).map(x=>`  #${x.lapszam}${x.cim?" – "+esc(x.cim):""}`).join("\n")}${rows.length>5?"\n  …":""}
</div>
      <p class="msub" style="margin-top:10px">A már meglévő (azonos lapszámú) tételeket a feltöltés kihagyja, nem írja felül.</p>
      <div class="modrow"><button class="btn ghost" id="du-cancel">Mégse</button><button class="btn" id="du-confirm">Feltöltés (${rows.length} tétel)</button></div>`);
    document.getElementById("du-cancel").onclick=()=>onDone();
    document.getElementById("du-confirm").onclick=async ()=>{
      try{
        const {inserted,skipped}=await insertFn(draftSeriesId, rows);
        alert(`Feltöltve: ${inserted} új tétel.${skipped?` (${skipped} kihagyva, mert már létezett ilyen lapszám.)`:""}`);
      }catch(e){ err(e); }
      onDone();
    };
  }).catch(err);
}
