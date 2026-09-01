/* ============================================================
   Karbantartás — űrlapok: tétel, listatár, sorozat-kód számláló.
   (A sorozat-szintű létrehozás/szerkesztés a Karbantartás pool-on át megy —
    lásd karbantartas.js + series-proposal.js. A felhasználó-kezelés külön
    modulban: admin-users.js.)
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, S, COMP_TYPES, esc, pad, opts } from "./state.js";
import { openModal, closeModal, err, sheet } from "./modal.js";
import { reload } from "./data.js";
import { upsertMyStatus, upsertMyIssueData } from "./personal.js";
import { seedNewIssueSeen } from "./changes.js";

/* ---- Új szám létrehozása (staff-only) ----
   Csak ÚJ tétel felvitelére való — meglévő publikált tétel törzsadat-
   szerkesztése/törlése mostantól kizárólag a Karbantartás draft/
   publikálás-folyamatán megy át (lásd karbantartas.js/draft-items.js);
   a meglévő tétel SAJÁT adatait (státusz/darabszám/jegyzet/ár) pedig a
   mindenki számára elérhető "Saját adatlap" kezeli (my-data.js). Új
   tételnél nincs mit védeni (senkinek nincs még adata rajta), ezért ez
   közvetlenül írhat törzsadatot — ugyanaz az elv, mint az Excel-importnál. */
let itemFormSeq=0;

// Egy típusból itt is felvehető TÖBB, egyedi Megnevezésű példány (pl. két
// különböző Lego-csomag) egyből, az első felviteléskor — a "+ Még egy X"
// gomb helyben ad hozzá egy újabb, üres blokkot, mentés előtt.
export function itemForm(){
  const s=S();
  const nextN = s.items.reduce((m,x)=>Math.max(m,x.n||0),0)+1;
  const scode=pad(S().kodSzam||(state.activeIdx+1),3);
  let master = {n:nextN, name:"", date:"", eredeti_ar:"", fizetett_ar:"", besz_menny:1, besz_datum:"", forras:""};
  let instances = s.components.map(t=>({tipus:t, key:"i"+(itemFormSeq++), status:null, db:1, azonosito_tipus:"", azonosito:"", megnevezes:"", jegyzet:""}));

  function syncFromDom(){
    const v=id=>{const e=document.getElementById(id);return e?e.value:null;};
    master = { n:v("f-n"), name:v("f-name"), date:v("f-date"), eredeti_ar:v("f-eredeti"),
      fizetett_ar:v("f-fizetett"), besz_menny:v("f-menny"), besz_datum:v("f-fdatum"), forras:v("f-forras") };
    instances.forEach(inst=>{
      const row=sheet.querySelector(`.statrow[data-stat="${inst.key}"]`);
      const pressed=row?row.querySelector('button[aria-pressed="true"]'):null;
      inst.status = pressed?(pressed.dataset.v||null):null;
      inst.db = v("cdb-"+inst.key); inst.azonosito_tipus=v("ct-"+inst.key); inst.azonosito=v("cid-"+inst.key);
      inst.megnevezes=v("cname-"+inst.key); inst.jegyzet=v("cn-"+inst.key);
    });
  }

  function draw(){
    const byType={}; instances.forEach(i=>{ (byType[i.tipus]=byType[i.tipus]||[]).push(i); });
    let ci=0;
    const compBlocks = s.components.map(t=>{
      const list=byType[t]||[];
      const blocks=list.map((inst,idx)=>{
        ci++;
        return `<div class="compedit">
          <h4>${COMP_TYPES[t]||t}${list.length>1?` #${idx+1}`:""}</h4>
          <div class="kod">${scode}-${pad(master.n||nextN,4)}-${pad(ci,2)}</div>
          <div class="field"><label>Megnevezés (opcionális) <span style="color:var(--faint);font-weight:400">— ha üres, "${COMP_TYPES[t]||t}${list.length>1?" #N":""}" jelenik meg</span></label>
            <input id="cname-${inst.key}" value="${esc(inst.megnevezes||"")}" placeholder="pl. Star Wars minifigura-csomag"></div>
          <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px">Státusz</label>
          <div class="statrow" data-stat="${inst.key}">
            <button type="button" data-v="megvan" aria-pressed="${inst.status==="megvan"}">megvan</button>
            <button type="button" data-v="hianyzik" aria-pressed="${inst.status==="hianyzik"}">hiány</button>
            <button type="button" data-v="nemkell" aria-pressed="${inst.status==="nemkell"}">nem kell</button>
            <button type="button" data-v="" aria-pressed="${!inst.status}">jelöletlen</button>
          </div>
          <div class="grid2" style="margin-top:8px">
            <div class="field"><label>Darabszám (db)</label><input id="cdb-${inst.key}" type="number" min="0" value="${inst.db??1}"></div>
            <div class="field"><label>Azonosító típusa</label>
              <select id="ct-${inst.key}"><option value="">—</option>${opts("azonosito",inst.azonosito_tipus)}</select></div>
          </div>
          <div class="field"><label>Azonosító</label><input id="cid-${inst.key}" value="${esc(inst.azonosito||"")}"></div>
          <div class="field"><label>Jegyzet</label><input id="cn-${inst.key}" value="${esc(inst.jegyzet||"")}"></div>
          ${list.length>1?`<button type="button" class="btn ghost" data-removeinst="${inst.key}">Ez a példány törlése</button>`:""}
        </div>`;
      }).join("");
      return blocks + `<button type="button" class="btn ghost" data-addinst="${esc(t)}">+ Még egy ${esc(COMP_TYPES[t]||t)} hozzáadása</button>`;
    }).join("");

    openModal(`<h2>Új szám</h2>
      <p class="msub">${esc(s.sorozat)}</p>
      <div class="grid2">
        <div class="field"><label>Lapszám</label><input id="f-n" type="number" value="${master.n}"></div>
        <div class="field"><label>Megjelenés dátuma</label><input id="f-date" type="date" value="${master.date||""}"></div>
      </div>
      <div class="field"><label>Cím</label><input id="f-name" value="${esc(master.name||"")}"></div>
      <div class="field"><label>Eredeti ár (Ft) <span style="color:var(--faint);font-weight:400">— a megjelenéskori/újságos ár (közös törzsadat)</span></label>
        <input id="f-eredeti" type="number" value="${master.eredeti_ar??""}"></div>
      <div class="msub" style="margin:14px 0 2px;color:var(--accent);filter:brightness(1.2);font-weight:600">Személyes beszerzés — csak a tiéd</div>
      <div class="grid2">
        <div class="field"><label>Fizetett ár (Ft)</label><input id="f-fizetett" type="number" value="${master.fizetett_ar??""}"></div>
        <div class="field"><label>Beszerzési mennyiség (db) <span style="color:var(--faint);font-weight:400">— hány db-ot vettél</span></label>
          <input id="f-menny" type="number" min="1" value="${master.besz_menny??1}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Beszerzés dátuma</label><input id="f-fdatum" type="date" value="${master.besz_datum||""}"></div>
        <div class="field"><label>Beszerzés forrása</label><select id="f-forras"><option value="">—</option>${opts("forras",master.forras)}</select></div>
      </div>
      ${compBlocks}
      <div class="modrow"><button class="btn ghost" onclick="closeModal()">Mégse</button><button class="btn" id="f-save">Létrehozás</button></div>`);

    // státusz-gombok
    sheet.querySelectorAll(".statrow").forEach(row=>{
      row.addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return;
        row.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", x===b)); });
    });
    sheet.querySelectorAll("[data-addinst]").forEach(b=>{
      b.onclick=()=>{ syncFromDom(); instances.push({tipus:b.dataset.addinst, key:"i"+(itemFormSeq++), status:null, db:1, azonosito_tipus:"", azonosito:"", megnevezes:"", jegyzet:""}); draw(); };
    });
    sheet.querySelectorAll("[data-removeinst]").forEach(b=>{
      b.onclick=()=>{ syncFromDom(); instances=instances.filter(i=>i.key!==b.dataset.removeinst); draw(); };
    });

    document.getElementById("f-save").onclick=async ()=>{
      syncFromDom();
      const n=parseInt(master.n); if(isNaN(n)){alert("A lapszám kötelező.");return;}
      const masterPayload={ lapszam:n, cim:(master.name||"").trim()||null, megjelenes:master.date||null,
        eredeti_ar:master.eredeti_ar?parseInt(master.eredeti_ar):null };
      const personal={ fizetett_ar:master.fizetett_ar?parseInt(master.fizetett_ar):null,
        beszerzesi_mennyiseg: Math.max(1, parseInt(master.besz_menny)||1),
        beszerzes_datuma:master.besz_datum||null, forras:master.forras||null, ar_auto:false };
      try{
        const {data,error}=await supabase.from("issues").insert({...masterPayload, series_id:s.id}).select().single();
        if(error) throw error;
        const issueId=data.id;
        const pierr=await upsertMyIssueData(issueId, personal); if(pierr) throw pierr;
        for(const inst of instances){
          const dbv=Math.max(0, parseInt(inst.db)||0);
          const cmaster={ azonosito_tipus:(inst.azonosito_tipus||"").trim()||null, azonosito:(inst.azonosito||"").trim()||null, megnevezes:(inst.megnevezes||"").trim()||null };
          const {data:cd,error:cerr}=await supabase.from("components").insert({...cmaster, issue_id:issueId, tipus:inst.tipus}).select().single();
          if(cerr) throw cerr;
          const merr=await upsertMyStatus(cd.id,{status:inst.status, db:dbv, jegyzet:(inst.jegyzet||"").trim()||null});
          if(merr) throw merr;
        }
        await seedNewIssueSeen(issueId);
        closeModal(); await reload();
      }catch(e){ err(e); }
    };
  }

  draw();
}

/* ---- Listatár bővítése ---- */
const LIST_TITLES={kiado:"Kiadó",komponens:"Komponens-típus",azonosito:"Azonosító típusa",forras:"Beszerzés forrása",kategoria:"Kategória (témakör)"};
export function listsForm(){
  const grps=Object.keys(LIST_TITLES).map(t=>`
    <div class="listgrp"><h4>${LIST_TITLES[t]}</h4>
      <div class="vals">${(state.LISTS[t]||[]).map(o=>`<span class="val">${esc(o.nev)}</span>`).join("")||'<span class="val">—</span>'}</div>
      <div class="addrow"><input id="nl-${t}" placeholder="új érték neve"><button data-add="${t}">+</button></div>
    </div>`).join("");
  openModal(`<h2>Listák</h2><p class="msub">Itt bővítheted a választható értékeket. Rögzítés közben nem lehet bővíteni — így a listák nem híznak el.</p>
    ${grps}
    <div class="modrow"><button class="btn" onclick="closeModal()">Kész</button></div>`);
  sheet.addEventListener("click",async e=>{
    const b=e.target.closest("[data-add]"); if(!b) return;
    const t=b.dataset.add, inp=document.getElementById("nl-"+t);
    const nev=inp.value.trim(); if(!nev) return;
    const ertek=nev.toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"");
    if(!ertek){ alert("Adj meg érvényes nevet."); return; }
    try{
      const so=(state.LISTS[t]||[]).length+1;
      const {error}=await supabase.from("lists").insert({tipus:t, ertek, megjelenites:nev, sort_order:so});
      if(error) throw error;
      (state.LISTS[t]=state.LISTS[t]||[]).push({ertek,nev}); inp.value=""; listsForm();
    }catch(e){ err(e); }
  });
}
