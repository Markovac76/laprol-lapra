/* ============================================================
   Excel: sablon letöltése + kitöltött fájl feltöltése (csak asztali/tablet).
   Hibatűrő dátum- és szám-felismerés (magyar hónapnevek, ezres tagolás).

   Sorozatkezelés-összehangolás (v1.6): a törzsadat-mezők (cím/dátum/eredeti
   ár/azonosító) egy MEGLÉVŐ tételen mostantól egy szerkesztési draftba
   kerülnek, a szokásos publikálás-folyamaton (diff/verzió/felkiáltójel)
   mennek át — nem íródnak felül közvetlenül és észrevétlenül. ÚJ tétel
   törzsadata továbbra is közvetlenül jön létre (nincs mit megvédeni,
   senkinek nincs még adata rajta). A személyes rétegek (fizetett ár,
   komponens-státusz) MINDIG közvetlenek, függetlenül új/meglévő tételtől —
   ezek sosem mennek a draft-on át. (Mellékes javítás: korábban a
   komponens-státusz a holt `components.status` oszlopba íródott, a
   személyes `member_status` helyett — ez itt is javítva.)
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, S, COMP_TYPES, esc } from "./state.js";
import { openModal, closeModal, err } from "./modal.js";
import { reload } from "./data.js";
import { upsertMyIssueData, upsertMyStatus } from "./personal.js";
import { seedNewIssueSeen } from "./changes.js";

let _xlsx=null;
async function xlsx(){ if(!_xlsx) _xlsx=await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm"); return _xlsx; }
// A draft-excel.js (11. pont — sablon-alapú tömeges tétel-feltöltés a
// javaslat-/draft-szerkesztő flow-ban) ugyanezt a betöltőt és a dátum-/
// szám-felismerést hasznosítja újra, hogy ne legyen két külön implementáció.
export const loadXlsx = xlsx;

const HU_MONTHS={jan:1,január:1,febr:2,február:2,márc:3,március:3,ápr:4,április:4,
  máj:5,május:5,jún:6,június:6,júl:7,július:7,aug:8,augusztus:8,
  szept:9,szeptember:9,okt:10,október:10,nov:11,november:11,dec:12,december:12};

function isoDate(y,mo,d){ y=parseInt(y); mo=parseInt(mo); d=parseInt(d);
  if(!y||mo<1||mo>12||d<1||d>31) return null;
  return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }

export function coerceDate(v){
  if(v==null||v==="") return null;
  if(v instanceof Date && !isNaN(v)) return new Date(v.getTime()-v.getTimezoneOffset()*60000).toISOString().slice(0,10);
  let s=String(v).trim(); if(!s) return null;
  // ÉÉÉÉ-HH-NN / ÉÉÉÉ.HH.NN / ÉÉÉÉ/HH/NN
  let m=s.match(/^(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})\.?$/);
  if(m) return isoDate(m[1],m[2],m[3]);
  // Excel-féle, magyar hónapnévvel/szóközzel tördelt alak: "2025- aug- 26", "2025 augusztus 26."
  m=s.toLowerCase().match(/^(\d{4})[.\-\s]+([a-záéíóöőúüű]+)\.?[.\-\s]+(\d{1,2})\.?$/i);
  if(m){ const mo=HU_MONTHS[m[2].replace(/\.$/,"")]; if(mo) return isoDate(m[1],mo,m[3]); }
  return null;  // felismerhetetlen formátum → nem dob hibát, csak üresen marad
}

export function parseHuNumber(v){
  if(v==null || v==="") return null;
  if(typeof v==="number") return Math.round(v);
  let s=String(v).trim(); if(!s) return null;
  const neg=s.startsWith("-");
  // "1.490,50" vagy "1490,50" alakú tizedes vessző esetén kezeljük tizedesként
  const m=s.match(/^-?\d{1,3}(?:[ .]\d{3})*,(\d{1,2})$/);
  if(m){ const num=parseFloat(s.replace(/[ .]/g,"").replace(",",".")); return Math.round(num); }
  // egyébként minden nem-számjegyet eltávolítunk (ezres pont/vessző/szóköz mind eltűnik)
  const digits=s.replace(/[^\d]/g,"");
  if(!digits) return null;
  return (neg?-1:1)*parseInt(digits,10);
}

function normStatus(v){ if(!v) return undefined; const t=String(v).trim().toLowerCase().replace(/\s+/g,"");
  if(t==="megvan")return"megvan"; if(t==="hianyzik"||t==="hiányzik"||t==="hiany"||t==="hiány")return"hianyzik";
  if(t==="nemkell")return"nemkell"; return undefined; }

// 3 oszlop / típus: státusz, azonosító, megnevezés. A Megnevezés — ha egy
// típusból már több példány is van a Számon — kizárólag az ELSŐ (elsődleges)
// példányra vonatkozik; a 2., 3. stb. példány felvitele/elnevezése Excel-lel
// nem támogatott, csak kézzel a szerkesztőben.
function tmplHead(s){ const h=["lapszám","cím","dátum (Excel dátum, pl. 2026.03.15)","eredeti ár (csak szám)","fizetett ár – személyes (csak szám)"];
  s.components.forEach(t=>{ h.push((COMP_TYPES[t]||t)+" státusz (megvan/hianyzik/nemkell)"); h.push((COMP_TYPES[t]||t)+" azonosító"); h.push((COMP_TYPES[t]||t)+" megnevezés"); }); return h; }

export async function downloadTemplate(){
  const s=S();
  if(!s){ alert("Előbb hozz létre egy sorozatot (+ Új sorozat), utána tudsz hozzá sablont letölteni."); return; }
  try{
    const X=await xlsx(), head=tmplHead(s);
    // valódi Excel dátum- és szám-típusú példacellák, hogy Excel a helyes formátumot ajánlja fel
    const ex1=[1,"Példa – írd át vagy töröld", new Date(2026,2,15), 2490, ""];
    s.components.forEach(()=>{ ex1.push("megvan"); ex1.push(""); ex1.push(""); });
    const ex2=[2,"Másik példa", new Date(2026,3,15), 1490, 1490];
    s.components.forEach(()=>{ ex2.push(""); ex2.push(""); ex2.push(""); });
    const ws=X.utils.aoa_to_sheet([head,ex1,ex2], {cellDates:true});
    ws["!cols"]=head.map(h=>({wch:Math.max(14,h.length+2)}));
    // pénz-oszlopok (D, E) explicit szám-formátum
    ["D2","E2","D3","E3"].forEach(ref=>{ if(ws[ref]) ws[ref].z='#,##0" Ft"'; });
    if(ws["C2"]) ws["C2"].z="yyyy-mm-dd"; if(ws["C3"]) ws["C3"].z="yyyy-mm-dd";
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Sorozat");
    X.writeFile(wb,`laprol-lapra-sablon-${(s.display||s.sorozat).replace(/\s+/g,"-")}.xlsx`);
  }catch(e){ err(e); }
}

export async function handleUpload(file){
  const s=S();
  if(!s){ alert("Előbb hozz létre egy sorozatot (+ Új sorozat), utána tudsz hozzá Excelt feltölteni."); return; }
  let plan=[], dateWarnings=[];
  try{
    const X=await xlsx(); const wb=X.read(await file.arrayBuffer(),{cellDates:true});
    const aoa=X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,defval:""});
    let bad=0;
    for(const row of aoa){
      if(!row||!row.length) continue;
      const n=parseInt(String(row[0]).trim()); if(isNaN(n)){ bad++; continue; }
      const name=String(row[1]??"").trim(), date=coerceDate(row[2]);
      if(row[2] && String(row[2]).trim() && !date) dateWarnings.push(n);
      const er=parseHuNumber(row[3]), fiz=parseHuNumber(row[4]);
      const p={}; if(name) p.cim=name; if(date) p.megjelenes=date;   // TÖRZSADAT (issues → új: közvetlen, meglévő: draft)
      if(er!=null) p.eredeti_ar=er;
      const pi={}; if(fiz!=null) pi.fizetett_ar=fiz;                 // SZEMÉLYES (member_issue_data) — mindig közvetlen
      const comps=[];
      for(let ci=0; ci<s.components.length; ci++){
        const t=s.components[ci];
        const st=normStatus(row[5+ci*3]); const az=String(row[6+ci*3]??"").trim(); const mn=String(row[7+ci*3]??"").trim();
        // status: SZEMÉLYES (member_status) — mindig közvetlen. azonosito/megnevezés: TÖRZSADAT (components).
        comps.push({t, status:st, azonosito: az||null, megnevezes: mn||null});
      }
      const existing=s.items.find(x=>x.n===n);
      plan.push({n, p, pi, comps, isNew:!existing});
    }
  }catch(e){ err(e); return; }

  if(!plan.length){ alert("Nem találtam feldolgozható sort a fájlban."); return; }
  const added=plan.filter(x=>x.isNew).length, updated=plan.length-added;
  const warnBlock = dateWarnings.length
    ? `<p class="msub" style="color:#f0cd8a">⚠ ${dateWarnings.length} sor dátuma nem volt felismerhető (#${dateWarnings.slice(0,8).join(", #")}${dateWarnings.length>8?"…":""}) — ezeknél a dátum üresen marad, a többi mező feltöltődik.</p>`
    : "";
  const draftNote = updated>0
    ? `<p class="msub">A ${updated} meglévő szám törzsadat-módosítása (cím/dátum/ár/azonosító) egy <b>szerkesztési draftba</b> kerül a Karbantartásban — csak publikálás után lesz élő, addig átnézhető. A saját jelöléseid és fizetett áraid MINDIG azonnal frissülnek, draft nélkül.</p>`
    : "";
  openModal(`<h2>Feltöltés megerősítése</h2>
    <p class="msub">Ez a fájl a <b>„${esc(s.sorozat)}”</b> sorozatba kerül.</p>
    ${warnBlock}
    <div class="example" style="font-size:13px">
${plan.length} sor feldolgozva a fájlból:
  • ${added} új szám jön létre (azonnal élő)
  • ${updated} meglévő szám — törzsadata draftba, személyes adata azonnal frissül
${plan.slice(0,5).map(x=>`  #${x.n}${x.p.cim?" – "+x.p.cim:""}${x.isNew?" (új)":" (frissül)"}`).join("\n")}${plan.length>5?"\n  …":""}
</div>
    ${draftNote}
    <p class="msub" style="margin-top:10px">Ha ez nem a várt sorozat vagy a szám nem stimmel, inkább <b>Mégse</b>, és ellenőrizd, melyik fület nyitottad meg feltöltés előtt.</p>
    <div class="modrow"><button class="btn ghost" onclick="closeModal()">Mégse</button><button class="btn" id="up-confirm">Feltöltés a(z) „${esc(s.display||s.sorozat)}” sorozatba</button></div>`);

  document.getElementById("up-confirm").onclick=async ()=>{
    closeModal();
    try{
      // A draftot csak akkor hozzuk létre/claim-eljük, ha ténylegesen kell —
      // egy tisztán státusz-only import (nincs törzsadat-mező egy sorban sem)
      // ne hagyjon üres, zavaró tételt a Karbantartás pool-jában.
      let draftId=null;

      let ins=0, draftUpd=0;
      for(const item of plan){
        if(item.isNew){
          const {data,error}=await supabase.from("issues").insert({...item.p, series_id:s.id, lapszam:item.n}).select().single();
          if(error) throw error; const issueId=data.id;
          if(Object.keys(item.pi).length){ const pierr=await upsertMyIssueData(issueId, {...item.pi, ar_auto:false}); if(pierr) throw pierr; }
          for(const c of item.comps){
            const cpayload={}; if(c.azonosito) cpayload.azonosito=c.azonosito; if(c.megnevezes) cpayload.megnevezes=c.megnevezes;
            const {data:cd,error:cerr}=await supabase.from("components").insert({...cpayload, issue_id:issueId, tipus:c.t}).select().single();
            if(cerr) throw cerr;
            if(c.status!==undefined){ const serr=await upsertMyStatus(cd.id, {status:c.status}); if(serr) throw serr; }
          }
          await seedNewIssueSeen(issueId);
          ins++;
        } else {
          const liveIssue = s.items.find(x=>x.n===item.n);
          // Személyes réteg: mindig azonnal, draft nélkül.
          if(Object.keys(item.pi).length){ const pierr=await upsertMyIssueData(liveIssue.id, {...item.pi, ar_auto:false}); if(pierr) throw pierr; }
          for(const c of item.comps){
            if(c.status===undefined) continue;
            const liveComp=(liveIssue.comps[c.t]||[])[0]; if(!liveComp||!liveComp.id) continue;
            const serr=await upsertMyStatus(liveComp.id, {status:c.status}); if(serr) throw serr;
          }
          // Törzsadat: a szerkesztési draftba (csak most, ha tényleg kell — létrehozás/claim lazy).
          const hasMasterChange = Object.keys(item.p).length>0 || item.comps.some(c=>c.azonosito||c.megnevezes);
          if(hasMasterChange){
            if(!draftId) draftId = await findOrCreateEditDraft(s);
            await upsertDraftIssue(draftId, liveIssue, item.p, item.comps);
            draftUpd++;
          }
        }
      }
      await reload();
      const msg = draftUpd>0
        ? `Feltöltve.\nÚj szám (azonnal élő): ${ins}\nMeglévő szám törzsadat-módosítása (${draftUpd} db) egy szerkesztési draftba került a Karbantartásban — nézd át és publikáld, ha jó.\nA saját jelöléseid/áraid azonnal frissültek.`
        : `Feltöltve.\nÚj szám: ${ins}\nA saját jelöléseid/áraid a meglévő számokon azonnal frissültek.`;
      alert(msg);
    }catch(e){ err(e); }
  };
}

// Megkeresi vagy létrehozza az "edit" típusú draftot ehhez a sorozathoz —
// ugyanaz a claim-elv, mint a Karbantartás "Szerkesztés indítása" gombjánál.
async function findOrCreateEditDraft(s){
  const { data: existing, error } = await supabase.from("draft_series")
    .select("*").eq("source_series_id", s.id).eq("pool_type","edit").maybeSingle();
  if(error) throw error;
  if(existing){
    if(existing.pool_status==="ready"){
      throw new Error("Ez a sorozat már publikálásra vár a Karbantartásban — előbb intézd el ott, mielőtt Excel-importot indítasz.");
    }
    if(existing.claimed_by && existing.claimed_by!==state.myId){
      throw new Error("Valaki már szerkeszti ezt a sorozatot a Karbantartásban — fejezze be előbb, vagy engedje el a foglalást.");
    }
    if(!existing.claimed_by){
      const {error:uerr}=await supabase.from("draft_series")
        .update({pool_status:"claimed", claimed_by:state.myId, claimed_at:new Date().toISOString()}).eq("id",existing.id);
      if(uerr) throw uerr;
    }
    return existing.id;
  }
  const { data: created, error: cerr } = await supabase.from("draft_series").insert({
    pool_type:"edit", pool_status:"claimed", source_series_id:s.id,
    submitted_by: state.myId, claimed_by: state.myId, claimed_at: new Date().toISOString(),
    kiado:s.kiado, kategoria:s.kategoria, megnevezes:s.sorozat, megjelenites:s.display, szin:s.accent, components:s.components,
  }).select().single();
  if(cerr) throw cerr;
  return created.id;
}

// Egy meglévő élő tétel törzsadat-módosítása a draftban — insert vagy update
// a draft_issues/draft_components sorokon, source_*_id-vel az élőre mutatva.
async function upsertDraftIssue(draftId, liveIssue, masterFields, comps){
  const { data: existingDI, error } = await supabase.from("draft_issues")
    .select("*").eq("draft_series_id", draftId).eq("source_issue_id", liveIssue.id).maybeSingle();
  if(error) throw error;

  const payload = {
    lapszam: liveIssue.n,
    cim: masterFields.cim ?? liveIssue.name,
    megjelenes: masterFields.megjelenes ?? liveIssue.date,
    eredeti_ar: masterFields.eredeti_ar ?? liveIssue.eredeti_ar,
  };
  let draftIssueId;
  if(existingDI){
    const {error:uerr}=await supabase.from("draft_issues").update(payload).eq("id",existingDI.id); if(uerr) throw uerr;
    draftIssueId=existingDI.id;
  } else {
    const {data,error:ierr}=await supabase.from("draft_issues")
      .insert({draft_series_id:draftId, source_issue_id:liveIssue.id, ...payload}).select().single();
    if(ierr) throw ierr; draftIssueId=data.id;
  }

  for(const c of comps){
    if(!c.azonosito && !c.megnevezes) continue;
    // Excel-lel csak az ELSŐDLEGES (első) példány azonosítója/megnevezése
    // állítható — egy 2., 3. példány felvitele/átnevezése csak kézzel, a
    // Karbantartás draft-szerkesztőjében megy (lásd tmplHead megjegyzése).
    const liveComp=(liveIssue.comps[c.t]||[])[0]; if(!liveComp||!liveComp.id) continue;
    const { data: existingDC, error: dcerr } = await supabase.from("draft_components")
      .select("*").eq("draft_issue_id", draftIssueId).eq("source_component_id", liveComp.id).maybeSingle();
    if(dcerr) throw dcerr;
    const cpayload = { azonosito_tipus: liveComp.azonosito_tipus||null,
      azonosito: c.azonosito || liveComp.azonosito || null,
      megnevezes: c.megnevezes || liveComp.megnevezes || null, tipus: c.t };
    if(existingDC){ const {error:ucerr}=await supabase.from("draft_components").update(cpayload).eq("id",existingDC.id); if(ucerr) throw ucerr; }
    else { const {error:icerr}=await supabase.from("draft_components").insert({draft_issue_id:draftIssueId, source_component_id:liveComp.id, ...cpayload}); if(icerr) throw icerr; }
  }
}
