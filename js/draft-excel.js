/* ============================================================
   Sablon-alapú tömeges tétel-feltöltés draft-okhoz (11. pont).
   Közös mechanizmus az "Új sorozat javaslása" köztes lépéséhez ÉS a
   Karbantartás draft-szerkesztőjéhez — mindkettő ugyanide tölt fel
   (draft_issues/draft_components), csak más a kiindulópont (üres,
   ill. a sorozat már meglévő komponens-készlete). Nincs személyes
   réteg (a draft még nem élő, senkinek nincs rajta saját adata) —
   ezért egyszerűbb, mint a live excel.js (nincs ár/státusz oszlop).
   ============================================================ */
import { supabase, fetchAllRows } from "./supabase.js";
import { COMP_TYPES, esc, listName } from "./state.js";
import { loadXlsx, coerceDate, parseHuNumber } from "./excel.js";

const typeLabel = t => listName("komponens", t) || COMP_TYPES[t] || t;

// 2 oszlop / típus: azonosító, megnevezés — mindkettő az adott típus
// ELSŐDLEGES (első) példányára vonatkozik; 2., 3. példány felvitele Excel-lel
// nem támogatott, csak kézzel a szerkesztőben.
function tmplHead(components){
  const h=["lapszám","cím","dátum (Excel dátum, pl. 2026.03.15)","eredeti ár (csak szám)"];
  components.forEach(t=>{ h.push(typeLabel(t)+" azonosító"); h.push(typeLabel(t)+" megnevezés"); });
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
  const ex1=[1,"Példa – írd át vagy töröld", new Date(2026,2,15), 2490]; components.forEach(()=>{ ex1.push(""); ex1.push(""); });
  const ex2=[2,"Másik példa", new Date(2026,3,15), 1490]; components.forEach(()=>{ ex2.push(""); ex2.push(""); });
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
    const comps=components.map((t,ci)=>({tipus:t, azonosito:String(row[4+ci*2]??"").trim()||null, megnevezes:String(row[5+ci*2]??"").trim()||null}));
    rows.push({lapszam:n, cim, megjelenes, eredeti_ar, comps});
  }
  return {rows, dateWarnings};
}

// A sorokat draft_issues/draft_components soraivá írja egy adott draft
// alá. Új lapszám → új draft-tétel. MÁR a draftban lévő lapszám (egy
// "Szerkesztés" draftnál ez az összes élő Szám) → a draft-tétel mezői a
// feltöltött, NEM ÜRES értékekre frissülnek (üres cella nem töröl), így a
// tömeges javítás a szokásos diff/verzió/felkiáltójel-folyamaton át megy
// publikáláskor. A törlésre jelölt draft-tételt nem érinti (kihagyja).
async function loadDraftIndex(draftSeriesId){
  const { data: issues, error } = await supabase.from("draft_issues")
    .select("id,lapszam,cim,megjelenes,eredeti_ar,deleted").eq("draft_series_id", draftSeriesId);
  if(error) throw error;
  const ids=(issues||[]).map(x=>x.id);
  // Az .in() lista az URL-be kerül — sok (több száz) azonosítónál túl hosszú lenne, ezért darabolva kérjük le.
  let comps=[];
  for(let i=0;i<ids.length;i+=100){
    const chunk=ids.slice(i,i+100);
    const { data, error: ce } = await fetchAllRows(()=>supabase.from("draft_components")
      .select("id,draft_issue_id,tipus,azonosito,azonosito_tipus,megnevezes").in("draft_issue_id", chunk).order("id"));
    if(ce) throw ce; comps=comps.concat(data||[]);
  }
  const byNum=new Map((issues||[]).map(i=>[i.lapszam,{...i,comps:comps.filter(c=>c.draft_issue_id===i.id)}]));
  return byNum;
}

// Mi változna egy MEGLÉVŐ draft-tételen a sor alapján (csak nem üres, eltérő értékek).
function existingChanges(ex, row){
  const p={};
  if(row.cim!=null && row.cim!==ex.cim) p.cim=row.cim;
  if(row.megjelenes!=null && row.megjelenes!==ex.megjelenes) p.megjelenes=row.megjelenes;
  if(row.eredeti_ar!=null && row.eredeti_ar!==ex.eredeti_ar) p.eredeti_ar=row.eredeti_ar;
  const cc=[];
  for(const c of row.comps){
    if(c.azonosito==null && c.megnevezes==null) continue;
    const same=ex.comps.filter(x=>x.tipus===c.tipus);
    if(same.length>1) continue;   // több azonos típusú példány: nem találgatjuk, melyik az "elsődleges" — kihagyjuk
    const cur=same[0];
    if(!cur){ cc.push({insert:true, tipus:c.tipus, azonosito:c.azonosito, megnevezes:c.megnevezes}); continue; }
    const cp={};
    if(c.azonosito!=null && c.azonosito!==cur.azonosito) cp.azonosito=c.azonosito;
    if(c.megnevezes!=null && c.megnevezes!==cur.megnevezes) cp.megnevezes=c.megnevezes;
    if(Object.keys(cp).length) cc.push({id:cur.id, patch:cp});
  }
  return {p, cc, any: Object.keys(p).length>0 || cc.length>0};
}

// Előnézet a megerősítő ablakhoz: hány új / hány frissülő / hány változatlan sor.
export async function previewDraftUpload(draftSeriesId, rows){
  const idx=await loadDraftIndex(draftSeriesId);
  let added=0, updated=0, unchanged=0, skipped=0;
  for(const row of rows){
    const ex=idx.get(row.lapszam);
    if(!ex){ added++; continue; }
    if(ex.deleted){ skipped++; continue; }
    existingChanges(ex,row).any ? updated++ : unchanged++;
  }
  return {added, updated, unchanged, skipped};
}

export async function bulkInsertDraftItems(draftSeriesId, rows){
  const idx=await loadDraftIndex(draftSeriesId);
  let inserted=0, updated=0, skipped=0;
  for(const row of rows){
    const ex=idx.get(row.lapszam);
    if(ex){
      if(ex.deleted){ skipped++; continue; }
      const ch=existingChanges(ex,row);
      if(!ch.any){ skipped++; continue; }
      if(Object.keys(ch.p).length){
        const { error } = await supabase.from("draft_issues").update(ch.p).eq("id", ex.id);
        if(error) throw error;
      }
      for(const c of ch.cc){
        const { error } = c.insert
          ? await supabase.from("draft_components").insert({ draft_issue_id:ex.id, tipus:c.tipus, azonosito:c.azonosito, megnevezes:c.megnevezes, source_component_id:null })
          : await supabase.from("draft_components").update(c.patch).eq("id", c.id);
        if(error) throw error;
      }
      updated++;
      continue;
    }
    const { data, error } = await supabase.from("draft_issues").insert({
      draft_series_id: draftSeriesId, lapszam: row.lapszam, cim: row.cim,
      megjelenes: row.megjelenes, eredeti_ar: row.eredeti_ar,
    }).select().single();
    if(error) throw error;
    if(row.comps.length){
      const payload = row.comps.map(c=>({ draft_issue_id:data.id, tipus:c.tipus, azonosito:c.azonosito, megnevezes:c.megnevezes, source_component_id:null }));
      const { error: cerr } = await supabase.from("draft_components").insert(payload);
      if(cerr) throw cerr;
    }
    idx.set(row.lapszam,{id:data.id,lapszam:row.lapszam,deleted:false,comps:[]});
    inserted++;
  }
  return {inserted, updated, skipped};
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
  const staffPath = insertFn===bulkInsertDraftItems;
  parseDraftExcel(file, components).then(async ({rows,dateWarnings})=>{
    if(!rows.length){ alert("Nem találtam feldolgozható sort a fájlban."); return; }
    const warnBlock = dateWarnings.length
      ? `<p class="msub" style="color:#f0cd8a">⚠ ${dateWarnings.length} sor dátuma nem volt felismerhető (#${dateWarnings.slice(0,8).join(", #")}${dateWarnings.length>8?"…":""}) — ezeknél a dátum üresen marad, a többi mező feltöltődik.</p>`
      : "";
    let note;
    if(staffPath){
      const pv=await previewDraftUpload(draftSeriesId, rows);
      note=`<p class="msub" style="margin-top:10px"><b>${pv.added}</b> új tétel jön létre a draftban, <b>${pv.updated}</b> már a draftban lévő tétel <b>frissül</b> a feltöltött (nem üres) értékekre — ezek publikáláskor a szokásos diff/verzió/felkiáltójel-folyamaton mennek át —, ${pv.unchanged} változatlan${pv.skipped?`, ${pv.skipped} törlésre jelölt, kihagyva`:""}. Üres cella nem töröl semmit.</p>`;
    } else {
      note=`<p class="msub" style="margin-top:10px">A már meglévő (azonos lapszámú) tételeket a feltöltés kihagyja, nem írja felül.</p>`;
    }
    openModal(`<h2>Sablon feltöltésének megerősítése</h2>
      ${warnBlock}
      <div class="example" style="font-size:13px">
${rows.length} sor feldolgozva a fájlból:
${rows.slice(0,5).map(x=>`  #${x.lapszam}${x.cim?" – "+esc(x.cim):""}`).join("\n")}${rows.length>5?"\n  …":""}
</div>
      ${note}
      <div class="modrow"><button class="btn ghost" id="du-cancel">Mégse</button><button class="btn" id="du-confirm">Feltöltés (${rows.length} tétel)</button></div>`);
    document.getElementById("du-cancel").onclick=()=>onDone();
    document.getElementById("du-confirm").onclick=async ()=>{
      try{
        const r=await insertFn(draftSeriesId, rows);
        const {inserted,skipped}=r, updated=r.updated||0;
        alert(`Feltöltve: ${inserted} új tétel${staffPath?`, ${updated} frissítve`:""}.${skipped?(staffPath?` (${skipped} változatlan/kihagyva.)`:` (${skipped} kihagyva, mert már létezett ilyen lapszám.)`):""}`);
      }catch(e){ err(e); }
      onDone();
    };
  }).catch(err);
}
