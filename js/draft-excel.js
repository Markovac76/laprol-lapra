/* ============================================================
   Sablon-alapú tömeges tétel-kezelés draftokhoz — ODA-VISSZA sablon.

   Két helyen használjuk (közös mechanizmus): a Karbantartás draft-
   szerkesztőjében (staff) és az "Új sorozat javaslása" köztes lépésében
   (a beküldő, a staff átvétele előtt).

   A staff-út elvei (a tulajdonos döntései):
   • A letöltött sablon a draft AKTUÁLIS állapotát tükrözi, rejtett Szám- és
     komponens-azonosító oszlopokkal. A tétel azonossága az azonosító, nem a
     név és nem a lapszám — a lapszám tiszta sorrend-szám.
   • Azonosítós sor = a meglévő draft-tétel frissítése (átszámozás, átnevezés
     biztonságos); azonosító nélküli sor = új tétel. Név/dátum alapú
     párosítást csak JAVASOLUNK, megerősítéssel, soha nem automatikusan.
   • A fájlból hiányzó tételek MARADNAK; csak külön jóváhagyásra jelöljük
     őket töröltnek. Feltöltés sosem töröl csendben.
   • Üres cella nem töröl semmit. Közös adat — személyes adat nincs benne.
   • Az előnézet a publikálás UTÁNI állapotot veti össze (draft + élő);
     ütközés esetén a feltöltés le van tiltva (az ellenőrzés az SQL-ben él:
     draft_lapszam_conflicts — ugyanaz, mint a "Kész" és a publikálás).
   • Elavulás elleni védelem: a sablon a draft tartalmának ujjlenyomatát
     hordozza; ha a draft azóta változott, megerősítést kérünk.
   ============================================================ */
import { supabase } from "./supabase.js";
import { COMP_TYPES, esc, listName } from "./state.js";
import { loadXlsx, coerceDate, parseHuNumber } from "./excel.js";
import { guarded, sheet } from "./modal.js";
import { fetchDraftItems } from "./draft-items.js";
import { templateModel, resolveColumns, rowsFromAoa, planUpload, buildPayload, draftFingerprint } from "./draft-excel-plan.js";

const typeLabel = t => listName("komponens", t) || COMP_TYPES[t] || t;

// A rejtett #draftUpl file-inputot nyitja meg — közös mindkét hívó helynek.
export function pickDraftExcelFile(onFile){
  const inp=document.getElementById("draftUpl");
  inp.onchange=function(){ const f=this.files&&this.files[0]; this.value=""; if(f) onFile(f); };
  inp.click();
}

/* ---------------- letöltés ---------------- */
// opts: { draftSeriesId, items } — ha van, a sablon a draft aktuális tartalmát
// tükrözi (oda-vissza); ha nincs (új javaslat), üres sablon példasorokkal.
export async function downloadDraftTemplate(components, seriesName, opts={}){
  const X=await loadXlsx();
  const items=opts.items||[];
  const M=templateModel(items, components, typeLabel);
  const ci=m=>M.colmap.find(c=>c.m===m).i;
  const toDate=s=>{ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s||""); return m ? new Date(+m[1], +m[2]-1, +m[3]) : ""; };

  const aoa=[M.header];
  if(items.length){
    M.rows.forEach(r=>{ const x=r.slice(); x[ci("datum")]=toDate(x[ci("datum")]); aoa.push(x); });
  } else {
    const ex=(n,cim,d,ar)=>{ const r=new Array(M.header.length).fill(""); r[ci("lapszam")]=n; r[ci("cim")]=cim; r[ci("datum")]=d; r[ci("ar")]=ar; return r; };
    aoa.push(ex(1,"Példa – írd át vagy töröld",new Date(2026,2,15),2490), ex(2,"Másik példa",new Date(2026,3,15),1490));
  }
  const ws=X.utils.aoa_to_sheet(aoa,{cellDates:true});
  ws["!cols"]=M.header.map((h,i)=>({wch:Math.max(14,Math.min(34,h.length+2)), hidden:M.hiddenCols.includes(i)}));
  for(let r=1;r<aoa.length;r++){
    const dc=ws[X.utils.encode_cell({r,c:ci("datum")})]; if(dc && dc.t==="d") dc.z="yyyy-mm-dd";
    const pc=ws[X.utils.encode_cell({r,c:ci("ar")})];    if(pc && pc.t==="n") pc.z='#,##0" Ft"';
  }

  const meta=[["kulcs","érték"],
    ["sablon_verzio","2"],
    ["draft_id", opts.draftSeriesId||""],
    ["ujjlenyomat", opts.draftSeriesId ? draftFingerprint(items) : ""],
    ["letoltve", new Date().toISOString()],
    ["oszlopok", JSON.stringify(M.colmap)]];
  const wm=X.utils.aoa_to_sheet(meta);
  const wb=X.utils.book_new();
  X.utils.book_append_sheet(wb,ws,"Sorozat");
  X.utils.book_append_sheet(wb,wm,"Meta");
  wb.Workbook={Sheets:[{Hidden:0},{Hidden:1}]};   // a Meta lap rejtett (a véletlen szerkesztés ellen)
  X.writeFile(wb,`laprol-lapra-sablon-${(seriesName||"sorozat").replace(/\s+/g,"-")}.xlsx`);
}

/* ---------------- beolvasás ---------------- */
function legacyColmap(components){
  const cm=[{i:0,h:"",m:"lapszam"},{i:1,h:"",m:"cim"},{i:2,h:"",m:"datum"},{i:3,h:"",m:"ar"}];
  components.forEach((t,ci)=>{ cm.push({i:4+ci*2,h:"",m:"azonosito",t,k:1}); cm.push({i:5+ci*2,h:"",m:"megnevezes",t,k:1}); });
  return cm;
}

// Kitöltött sablon beolvasása — NEM ír adatbázisba, csak feldolgozott sorokat
// ad vissza. legacy=true: a régi (azonosító nélküli) elrendezés.
export async function parseDraftExcel(file, components){
  const X=await loadXlsx();
  const wb=X.read(await file.arrayBuffer(),{cellDates:true});
  const main=wb.SheetNames.find(n=>n!=="Meta") || wb.SheetNames[0];
  const aoa=X.utils.sheet_to_json(wb.Sheets[main],{header:1,raw:false,defval:""});
  const meta={};
  if(wb.Sheets["Meta"]){
    X.utils.sheet_to_json(wb.Sheets["Meta"],{header:1,raw:false,defval:""}).forEach(r=>{ if(r[0]) meta[String(r[0]).trim()]=String(r[1]==null?"":r[1]); });
  }
  let colmap=null;
  if(meta.oszlopok){ try{ colmap=JSON.parse(meta.oszlopok); }catch(_){ colmap=null; } }
  const legacy=!colmap;
  if(legacy) colmap=legacyColmap(components);
  const cols=resolveColumns(aoa[0]||[], colmap);
  const r=rowsFromAoa(aoa, cols, {date:coerceDate, number:parseHuNumber});
  return {...r, meta, legacy};
}

/* ---------------- a beküldő útja (staff átvétel előtt, RPC) ---------------- */
// A draft_issues/draft_components RLS-e staff-only, ezért ez egy SECURITY
// DEFINER RPC-n megy át, saját tulajdonos-/állapot-ellenőrzéssel. Itt minden
// sor új tétel (a beküldőnek nincs mit párosítani); a lapszámok ütközését a
// függvény kihagyással kezeli.
export async function bulkInsertDraftItemsAsProposer(draftSeriesId, rows){
  const { data, error } = await supabase.rpc("propose_bulk_issues", {
    p_draft_id: draftSeriesId,
    p_rows: rows.map(r=>({ lapszam:r.lapszam, cim:r.cim, megjelenes:r.megjelenes, eredeti_ar:r.eredeti_ar,
      comps:(r.comps||[]).map(c=>({tipus:c.tipus, azonosito:c.azonosito, megnevezes:c.megnevezes})) })),
  });
  if(error) throw error;
  return { inserted: data.inserted, skipped: data.skipped };
}

function confirmProposerUpload(openModal, err, file, draftSeriesId, components, onDone, insertFn){
  parseDraftExcel(file, components).then(({rows,dateWarnings,skipped})=>{
    if(!rows.length){ alert("Nem találtam feldolgozható sort a fájlban."); return; }
    const warn=[];
    if(dateWarnings.length) warn.push(`⚠ ${dateWarnings.length} sor dátuma nem volt felismerhető (#${dateWarnings.slice(0,8).join(", #")}${dateWarnings.length>8?"…":""}) — ezeknél a dátum üresen marad.`);
    if(skipped.length) warn.push(`⚠ ${skipped.length} sort kihagytam (${skipped.slice(0,5).map(s=>`${s.rowNo}. sor: ${s.ok}`).join("; ")}${skipped.length>5?"…":""}).`);
    openModal(`<h2>Sablon feltöltésének megerősítése</h2>
      ${warn.map(w=>`<p class="msub" style="color:#f0cd8a">${esc(w)}</p>`).join("")}
      <div class="example" style="font-size:13px">
${rows.length} sor feldolgozva a fájlból:
${rows.slice(0,5).map(x=>`  #${x.lapszam}${x.cim?" – "+esc(x.cim):""}`).join("\n")}${rows.length>5?"\n  …":""}
</div>
      <p class="msub" style="margin-top:10px">A már meglévő (azonos lapszámú) tételeket a feltöltés kihagyja, nem írja felül.</p>
      <div class="modrow"><button class="btn ghost" id="du-cancel">Mégse</button><button class="btn" id="du-confirm">Feltöltés (${rows.length} tétel)</button></div>`);
    document.getElementById("du-cancel").onclick=()=>onDone();
    document.getElementById("du-confirm").onclick=guarded(async ()=>{
      try{
        const {inserted,skipped:sk}=await insertFn(draftSeriesId, rows);
        alert(`Feltöltve: ${inserted} új tétel.${sk?` (${sk} kihagyva, mert már létezett ilyen lapszám.)`:""}`);
      }catch(e){ err(e); }
      onDone();
    });
  }).catch(err);
}

/* ---------------- a staff útja: előnézet + alkalmazás ---------------- */
const MAXLIST=60;
const fmtItem=it=>`#${it.lapszam}${it.cim?" – "+esc(it.cim):""}`;
const typeName=(t,k)=>`${esc(typeLabel(t))} #${k}`;

function diffText(o){
  const p=o.patch, bits=[];
  if(p.lapszam!==undefined) bits.push(`lapszám: ${o.item.lapszam} → <b>${p.lapszam}</b>`);
  if(p.cim!==undefined) bits.push(`cím: „${esc(o.item.cim||"")}” → „${esc(p.cim)}”`);
  if(p.megjelenes!==undefined) bits.push(`dátum: ${esc(o.item.megjelenes||"—")} → ${esc(p.megjelenes)}`);
  if(p.eredeti_ar!==undefined) bits.push(`ár: ${o.item.eredeti_ar==null?"—":o.item.eredeti_ar} → ${p.eredeti_ar}`);
  if(p.deleted===true) bits.push(`törlésre jelölve`);
  if(p.deleted===false) bits.push(`törlés-jelölés visszavonva`);
  o.compOps.forEach(c=>{
    if(c.isNew) bits.push(`új komponens: ${typeName(c.tipus,c.k)}${c.patch.azonosito?` (${esc(c.patch.azonosito)})`:""}${c.patch.megnevezes?` „${esc(c.patch.megnevezes)}”`:""}`);
    else{
      const f=[];
      if(c.patch.azonosito!==undefined) f.push(`azonosító: ${esc(c.from.azonosito||"—")} → ${esc(c.patch.azonosito)}`);
      if(c.patch.megnevezes!==undefined) f.push(`megnevezés: ${esc(c.from.megnevezes||"—")} → ${esc(c.patch.megnevezes)}`);
      bits.push(`${typeName(c.tipus,c.k)}: ${f.join(", ")}`);
    }
  });
  return bits.join("; ");
}

async function confirmStaffUpload(openModal, err, file, draftId, components, onDone){
  const parsed=await parseDraftExcel(file, components);
  if(parsed.legacy){
    alert("Ez a fájl a régi sablon-formátumban van (nincsenek benne azonosító oszlopok), ezért biztonsági okból nem tölthető fel ide — a sorokat nem tudnám megbízhatóan a tételekhez párosítani.\n\nTöltsd le újra a ⬇ Sablon gombbal: az új sablon a draft jelenlegi állapotát tartalmazza, és azonosítókkal párosít.");
    return;
  }
  if(!parsed.rows.length){ alert("Nem találtam feldolgozható sort a fájlban."); return; }

  const items=await fetchDraftItems(draftId);
  const fpNow=draftFingerprint(items);
  const otherDraft=!!parsed.meta.draft_id && parsed.meta.draft_id!==draftId;
  const stale = otherDraft || !parsed.meta.ujjlenyomat || parsed.meta.ujjlenyomat!==fpNow;
  const newIds=new Map(parsed.rows.map(r=>[r.rowNo, crypto.randomUUID()]));
  const sel={confirm:new Set(), del:new Set(), staleAck:false};
  let plan=null, conflicts=[], conflictErr=null;

  async function recompute(){
    plan=planUpload({rows:parsed.rows, items, confirmSuggest:sel.confirm, deleteMissing:sel.del, newIds});
    conflictErr=null; conflicts=[];
    try{
      const { data, error } = await supabase.rpc("draft_lapszam_conflicts", { p_draft_id:draftId, p_changes:plan.changes });
      if(error) throw error;
      conflicts=data||[];
    }catch(e){ conflictErr=e; }
  }

  function render(keepScroll){
    const top=keepScroll ? sheet.scrollTop : 0;
    const s=plan.stats, w=plan.warnings;
    const list=(arr,fn)=>arr.slice(0,MAXLIST).map(fn).join("")+(arr.length>MAXLIST?`<div class="unote">… és még ${arr.length-MAXLIST}</div>`:"");
    const sec=(title,n,body,open)=>n?`<details ${open?"open":""} style="margin-top:8px"><summary style="cursor:pointer;font-weight:600">${title} (${n})</summary><div class="unote" style="margin:6px 0 0 4px;line-height:1.5">${body}</div></details>`:"";

    const staleBlock = stale ? `<div class="example" style="border-color:#f0cd8a;color:#f0cd8a;white-space:normal">
        ⚠ <b>Ez a fájl ${otherDraft?"másik munkaanyagból származik":"a munkaanyag egy régebbi állapotát tükrözi"}</b> — azóta a draft megváltozott (vagy nincs a fájlban ellenőrző jelzés). A feltöltés a fájl értékeit írná a mostani állapotra; a közben végzett kézi módosítások ott, ahol a fájl nem üres cellát tartalmaz, felülíródnak.
        <label class="ckrow" style="margin-top:8px"><input type="checkbox" id="du-stale"${sel.staleAck?" checked":""}> Tudomásul veszem, és így is folytatom</label></div>` : "";

    const conflictBlock = conflictErr
      ? `<div class="example" style="border-color:#f3b6b6;color:#f3b6b6;white-space:normal">Az ütközés-ellenőrzés nem futott le: ${esc(conflictErr.message||String(conflictErr))}</div>`
      : conflicts.length
        ? `<div class="example" style="border-color:#f3b6b6;color:#f3b6b6;white-space:normal"><b>⛔ Lapszám-ütközés — a feltöltés le van tiltva.</b> A publikálás után több nem törölt Szám ugyanazt a lapszámot kapná. A feltöltés nem tolja el csendben a meglévőket.${
            conflicts.map(c=>`<div style="margin-top:6px"><b>${c.lapszam}. lapszám:</b> ${c.tetelek.map(t=>`${esc(t.cim||"(cím nélkül)")} <i>[${t.eredet==="draft"?"a munkaanyagban":t.eredet==="új"?"új sor a fájlban":"az élő sorozatban, a munkaanyag nem érinti"}]</i>`).join(" · ")}</div>`).join("")
          }<div style="margin-top:8px">Javítsd a fájlt (vagy jelöld törlésre a fájlból hiányzó, ütköző tételt lent), majd töltsd fel újra.</div></div>`
        : "";

    // Azonosító-hibák: lemásolt sor / ismétlődő azonosító — BLOKKOL, és megmondja, mit kell tenni.
    const er=plan.errors;
    const errBlock = plan.blocked ? `<div class="example" style="border-color:#f3b6b6;color:#f3b6b6;white-space:normal"><b>⛔ Azonosító-hiba a fájlban — a feltöltés le van tiltva.</b> Egy rejtett azonosító kétszer szerepel, ezért nem lehet tudni, melyik sor melyik tételt frissítse (ez többnyire egy lemásolt sor). Semmi nem módosult.${
        er.dupSzam.map(x=>`<div style="margin-top:6px">Ugyanaz a <b>Szám-azonosító</b> ${x.rows.length} sorban szerepel: <b>${x.rows.map(n=>n+". sor").join(", ")}</b> (lapszám: ${x.lapszamok.join(", ")}${x.cim?`; „${esc(x.cim)}”`:""}).</div>`).join("")
      }${
        er.dupComp.map(x=>`<div style="margin-top:6px">Ugyanaz a <b>komponens-azonosító</b> ${x.uses.length} helyen szerepel: ${x.uses.map(u=>`${u.rowNo}. sor (${esc(typeLabel(u.tipus))} #${u.k})`).join(", ")}.</div>`).join("")
      }${
        er.foreignComp.map(x=>`<div style="margin-top:6px">A <b>${x.rowNo}. sor</b> ${esc(typeLabel(x.tipus))} #${x.k} komponens-azonosítója egy <b>másik tételhez</b> (#${x.owner.lapszam}${x.owner.cim?` „${esc(x.owner.cim)}”`:""}) tartozik.</div>`).join("")
      }<div style="margin-top:8px"><b>Teendő:</b> hagyd meg az eredeti sort, a lemásolt sorból pedig töröld a rejtett „Szám-ID” és „komponens-ID” cellákat (felfedheted a rejtett oszlopokat) — akkor új tételként jön létre. Vagy töröld a másolatot, és töltsd fel újra.</div></div>` : "";

    const summary=`<p class="msub" style="margin-top:8px"><b>${s.frissul}</b> tétel frissül${s.lapszamValtozik?` (ebből <b>${s.lapszamValtozik}</b> lapszáma változik)`:""} · <b>${s.uj}</b> új · ${s.valtozatlan} változatlan · <b>${s.hianyzik}</b> hiányzik a fájlból${s.torlesreJelolt?` (${s.torlesreJelolt} törlésre jelölve)`:" (mind marad)"}${s.visszaall?` · ${s.visszaall} visszaáll`:""}</p>`;

    const warnBits=[];
    if(w.unknownIds.length) warnBits.push(`<div>${w.unknownIds.length} sor ismeretlen Szám-azonosítóval — <b>kihagyva</b> (másik munkaanyagból való, vagy a tétel azóta megszűnt): ${w.unknownIds.slice(0,6).map(r=>`${r.rowNo}. sor (#${r.lapszam})`).join(", ")}${w.unknownIds.length>6?"…":""}</div>`);
    if(w.unknownComps.length) warnBits.push(`<div>${w.unknownComps.length} komponens-csoport ismeretlen azonosítóval — <b>kihagyva</b>.</div>`);
    if(w.newMarkedDeleted.length) warnBits.push(`<div>${w.newMarkedDeleted.length} új sor „törlésre jelölve” — kihagyva (nem hozom létre).</div>`);
    if(parsed.skipped.length) warnBits.push(`<div>${parsed.skipped.length} sor kihagyva: ${parsed.skipped.slice(0,5).map(x=>`${x.rowNo}. sor — ${x.ok}`).join("; ")}${parsed.skipped.length>5?"…":""}</div>`);
    if(parsed.dateWarnings.length) warnBits.push(`<div>${parsed.dateWarnings.length} sor dátuma nem felismerhető (#${parsed.dateWarnings.slice(0,8).join(", #")}) — ezeknél a dátum nem változik.</div>`);
    w.sameName.forEach(x=>warnBits.push(`<div>Azonos nevű tételek: „${esc(x.cim)}” — lapszám: ${x.lapszamok.join(", ")}. <i>(csak figyelmeztetés — a kiadó adhat ki azonos nevű számokat)</i></div>`));

    const renum=plan.ops.filter(o=>o.lapszamChange);
    const upd=plan.ops.filter(o=>o.hasChange && !o.lapszamChange);

    const suggBody=plan.suggestions.map(sg=>`<label class="ckrow" style="display:block;margin:4px 0"><input type="checkbox" data-sugg="${sg.row.rowNo}"${sel.confirm.has(sg.row.rowNo)?" checked":""}> A fájl <b>${sg.row.rowNo}. sora</b> (#${sg.row.lapszam} „${esc(sg.row.cim||"")}”) ugyanaz, mint a draft <b>#${sg.item.lapszam} „${esc(sg.item.cim||"")}”</b> tétele → frissítés (különben új tétel jön létre)</label>`).join("");
    const missBody=plan.missing.map(it=>`<label class="ckrow" style="display:block;margin:4px 0"><input type="checkbox" data-miss="${it.id}"${sel.del.has(it.id)?" checked":""}> ${fmtItem(it)} — <i>${it.source_issue_id?"élő Szám: publikáláskor törölt lesz":"új, még nem publikált tétel: törlődik a draftból"}</i></label>`).join("");

    const canGo = !plan.blocked && !conflictErr && !conflicts.length && (!stale || sel.staleAck)
      && (s.frissul + s.uj + s.torlesreJelolt) > 0;

    openModal(`<h2>Sablon feltöltésének előnézete</h2>
      <p class="msub">${parsed.rows.length} sor a fájlból. <b>Üres cella nem töröl semmit</b>, és a fájlból hiányzó tétel nem törlődik magától.</p>
      ${errBlock}${staleBlock}${conflictBlock}${summary}
      ${warnBits.length ? `<div class="example" style="white-space:normal;font-size:12.5px;margin-top:8px"><b>Figyelmeztetések</b>${warnBits.join("")}</div>` : ""}
      ${sec("Párosítási javaslatok — megerősítést kérnek",plan.suggestions.length,suggBody,true)}
      ${sec("Fájlból hiányzó tételek — alapból MARADNAK",plan.missing.length,
          `<div style="margin-bottom:6px">Csak a bejelölt tételek lesznek töröltnek jelölve.</div>${missBody}`,false)}
      ${sec("Lapszám változik",renum.length,list(renum,o=>{
          const rest=diffText({...o,patch:{...o.patch,lapszam:undefined}});
          return `<div>${esc(o.item.cim||"(cím nélkül)")}: #${o.item.lapszam} → <b>#${o.patch.lapszam}</b>${rest?` <i>— és: ${rest}</i>`:""}</div>`;
        }),false)}
      ${sec("Frissülő tételek",upd.length,list(upd,o=>`<div>${fmtItem(o.item)}: ${diffText(o)}</div>`),false)}
      ${sec("Új tételek",plan.creates.length,list(plan.creates,c=>`<div>#${c.row.lapszam}${c.row.cim?" – "+esc(c.row.cim):""}${c.ambiguous?" <i>(több azonos nevű meglévő tétel — nem javaslok párt)</i>":""}</div>`),false)}
      <div class="modrow" style="margin-top:14px"><button class="btn ghost" id="du-cancel">Mégse</button>
        <button class="btn" id="du-confirm"${canGo?"":" disabled"}>Feltöltés</button></div>`);

    document.getElementById("du-cancel").onclick=()=>onDone();
    const stBox=document.getElementById("du-stale");
    if(stBox) stBox.onchange=()=>{ sel.staleAck=stBox.checked; render(true); };
    sheet.querySelectorAll("[data-sugg]").forEach(cb=>{ cb.onchange=async ()=>{
      const k=+cb.dataset.sugg; cb.checked ? sel.confirm.add(k) : sel.confirm.delete(k);
      await recompute(); render(true); }; });
    sheet.querySelectorAll("[data-miss]").forEach(cb=>{ cb.onchange=async ()=>{
      cb.checked ? sel.del.add(cb.dataset.miss) : sel.del.delete(cb.dataset.miss);
      await recompute(); render(true); }; });
    document.getElementById("du-confirm").onclick=guarded(async ()=>{
      try{
        const { data, error } = await supabase.rpc("apply_draft_upload", { p_draft_id:draftId, p_payload:buildPayload(plan) });
        if(error) throw error;
        alert(`Feltöltve: ${data.uj} új tétel, ${data.frissitett} frissített tétel, ${data.uj_komponens} új és ${data.frissitett_komponens} frissített komponens${data.torolt?`, ${data.torolt} tétel törlésre jelölve/törölve`:""}.`);
      }catch(e){ err(e); }
      onDone();
    });
    if(keepScroll) sheet.scrollTop=top;
  }

  await recompute();
  render(false);
}

// Közös belépési pont. insertFn megadva → a beküldő egyszerű útja (RPC);
// nélküle → a staff előnézetes, azonosító-alapú útja.
export function confirmDraftUpload(openModal, err, file, draftSeriesId, components, onDone, insertFn=null){
  if(insertFn) return confirmProposerUpload(openModal, err, file, draftSeriesId, components, onDone, insertFn);
  return confirmStaffUpload(openModal, err, file, draftSeriesId, components, onDone).catch(err);
}
