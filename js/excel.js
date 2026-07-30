/* ============================================================
   Excel: sablon letöltése + kitöltött fájl feltöltése (csak asztali/tablet).
   Hibatűrő dátum- és szám-felismerés (magyar hónapnevek, ezres tagolás).
   ============================================================ */
import { supabase } from "./supabase.js";
import { S, COMP_TYPES, esc } from "./state.js";
import { openModal, closeModal, err } from "./modal.js";
import { reload } from "./data.js";

let _xlsx=null;
async function xlsx(){ if(!_xlsx) _xlsx=await import("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm"); return _xlsx; }

const HU_MONTHS={jan:1,január:1,febr:2,február:2,márc:3,március:3,ápr:4,április:4,
  máj:5,május:5,jún:6,június:6,júl:7,július:7,aug:8,augusztus:8,
  szept:9,szeptember:9,okt:10,október:10,nov:11,november:11,dec:12,december:12};

function isoDate(y,mo,d){ y=parseInt(y); mo=parseInt(mo); d=parseInt(d);
  if(!y||mo<1||mo>12||d<1||d>31) return null;
  return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }

function coerceDate(v){
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

function parseHuNumber(v){
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

function tmplHead(s){ const h=["lapszám","cím","dátum (Excel dátum, pl. 2026.03.15)","fedélár (csak szám)","beszerzési ár (csak szám)"];
  s.components.forEach(t=>{ h.push((COMP_TYPES[t]||t)+" státusz (megvan/hianyzik/nemkell)"); h.push((COMP_TYPES[t]||t)+" azonosító"); }); return h; }

export async function downloadTemplate(){
  const s=S();
  if(!s){ alert("Előbb hozz létre egy sorozatot (+ Új sorozat), utána tudsz hozzá sablont letölteni."); return; }
  try{
    const X=await xlsx(), head=tmplHead(s);
    // valódi Excel dátum- és szám-típusú példacellák, hogy Excel a helyes formátumot ajánlja fel
    const ex1=[1,"Példa – írd át vagy töröld", new Date(2026,2,15), 2490, ""];
    s.components.forEach(()=>{ ex1.push("megvan"); ex1.push(""); });
    const ex2=[2,"Másik példa", new Date(2026,3,15), 1490, 1490];
    s.components.forEach(()=>{ ex2.push(""); ex2.push(""); });
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
      const fed=parseHuNumber(row[3]), fiz=parseHuNumber(row[4]);
      const p={}; if(name) p.cim=name; if(date) p.megjelenes=date;
      if(fed!=null) p.fedelar=fed; if(fiz!=null) p.beszerzesi_ar=fiz;
      const comps=[];
      for(let ci=0; ci<s.components.length; ci++){
        const t=s.components[ci];
        const st=normStatus(row[5+ci*2]); const az=String(row[6+ci*2]??"").trim();
        const cp={}; if(st!==undefined) cp.status=st; if(az) cp.azonosito=az;
        comps.push({t,cp});
      }
      const existing=s.items.find(x=>x.n===n);
      plan.push({n, p, comps, isNew:!existing});
    }
  }catch(e){ err(e); return; }

  if(!plan.length){ alert("Nem találtam feldolgozható sort a fájlban."); return; }
  const added=plan.filter(x=>x.isNew).length, updated=plan.length-added;
  const warnBlock = dateWarnings.length
    ? `<p class="msub" style="color:#f0cd8a">⚠ ${dateWarnings.length} sor dátuma nem volt felismerhető (#${dateWarnings.slice(0,8).join(", #")}${dateWarnings.length>8?"…":""}) — ezeknél a dátum üresen marad, a többi mező feltöltődik.</p>`
    : "";
  openModal(`<h2>Feltöltés megerősítése</h2>
    <p class="msub">Ez a fájl a <b>„${esc(s.sorozat)}”</b> sorozatba kerül.</p>
    ${warnBlock}
    <div class="example" style="font-size:13px">
${plan.length} sor feldolgozva a fájlból:
  • ${added} új tétel jön létre
  • ${updated} meglévő tétel frissül (felülíródik)
${plan.slice(0,5).map(x=>`  #${x.n}${x.p.cim?" – "+x.p.cim:""}${x.isNew?" (új)":" (frissül)"}`).join("\n")}${plan.length>5?"\n  …":""}
</div>
    <p class="msub" style="margin-top:10px">Ha ez nem a várt sorozat vagy a szám nem stimmel, inkább <b>Mégse</b>, és ellenőrizd, melyik fület nyitottad meg feltöltés előtt.</p>
    <div class="modrow"><button class="btn ghost" onclick="closeModal()">Mégse</button><button class="btn" id="up-confirm">Feltöltés a(z) „${esc(s.display||s.sorozat)}” sorozatba</button></div>`);

  document.getElementById("up-confirm").onclick=async ()=>{
    closeModal();
    try{
      let ins=0, upd=0;
      for(const item of plan){
        let it=s.items.find(x=>x.n===item.n), issueId;
        if(it){ issueId=it.id; if(Object.keys(item.p).length){ const {error}=await supabase.from("issues").update(item.p).eq("id",it.id); if(error) throw error; } upd++; }
        else { const {data,error}=await supabase.from("issues").insert({...item.p, series_id:s.id, lapszam:item.n}).select().single(); if(error) throw error; issueId=data.id; ins++; }
        for(const {t,cp} of item.comps){
          const cur=it?it.comps[t]:null;
          if(cur&&cur.id){ if(Object.keys(cp).length){ const {error}=await supabase.from("components").update(cp).eq("id",cur.id); if(error) throw error; } }
          else { const {error}=await supabase.from("components").insert({...cp, issue_id:issueId, tipus:t}); if(error) throw error; }
        }
      }
      await reload(); alert(`Feltöltve „${s.sorozat}” sorozatba.\nÚj: ${ins}, frissítve: ${upd}`);
    }catch(e){ err(e); }
  };
}
