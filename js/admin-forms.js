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

/* ---- Új szám létrehozása (staff-only) ----
   Csak ÚJ tétel felvitelére való — meglévő publikált tétel törzsadat-
   szerkesztése/törlése mostantól kizárólag a Karbantartás draft/
   publikálás-folyamatán megy át (lásd karbantartas.js/draft-items.js);
   a meglévő tétel SAJÁT adatait (státusz/darabszám/jegyzet/ár) pedig a
   mindenki számára elérhető "Saját adatlap" kezeli (my-data.js). Új
   tételnél nincs mit védeni (senkinek nincs még adata rajta), ezért ez
   közvetlenül írhat törzsadatot — ugyanaz az elv, mint az Excel-importnál. */
export function itemForm(){
  const s=S();
  const nextN = s.items.reduce((m,x)=>Math.max(m,x.n||0),0)+1;
  const it = {n:nextN,name:"",date:"",eredeti_ar:"",fizetett_ar:"",besz_menny:1,besz_datum:"",forras:"",comps:{}};
  const scode=pad(S().kodSzam||(state.activeIdx+1),3);
  const compBlocks = s.components.map((t,ci)=>{
    return `<div class="compedit">
      <h4>${COMP_TYPES[t]||t}</h4>
      <div class="kod">${scode}-${pad(nextN,4)}-${pad(ci+1,2)}</div>
      <label style="display:block;font-size:12px;color:var(--muted);margin-bottom:4px">Státusz</label>
      <div class="statrow" data-stat="${t}">
        <button type="button" data-v="megvan" aria-pressed="false">megvan</button>
        <button type="button" data-v="hianyzik" aria-pressed="false">hiány</button>
        <button type="button" data-v="nemkell" aria-pressed="false">nem kell</button>
        <button type="button" data-v="" aria-pressed="true">jelöletlen</button>
      </div>
      <div class="grid2" style="margin-top:8px">
        <div class="field"><label>Darabszám (db)</label><input id="cdb-${t}" type="number" min="0" value="1"></div>
        <div class="field"><label>Azonosító típusa</label>
          <select id="ct-${t}"><option value="">—</option>${opts("azonosito","")}</select></div>
      </div>
      <div class="field"><label>Azonosító</label><input id="cid-${t}" value=""></div>
      <div class="field"><label>Jegyzet</label><input id="cn-${t}" value=""></div>
    </div>`;
  }).join("");

  openModal(`<h2>Új szám</h2>
    <p class="msub">${esc(s.sorozat)}</p>
    <div class="grid2">
      <div class="field"><label>Lapszám</label><input id="f-n" type="number" value="${it.n}"></div>
      <div class="field"><label>Megjelenés dátuma</label><input id="f-date" type="date" value=""></div>
    </div>
    <div class="field"><label>Cím</label><input id="f-name" value=""></div>
    <div class="field"><label>Eredeti ár (Ft) <span style="color:var(--faint);font-weight:400">— a megjelenéskori/újságos ár (közös törzsadat)</span></label>
      <input id="f-eredeti" type="number" value=""></div>
    <div class="msub" style="margin:14px 0 2px;color:var(--accent);filter:brightness(1.2);font-weight:600">Személyes beszerzés — csak a tiéd</div>
    <div class="grid2">
      <div class="field"><label>Fizetett ár (Ft)</label><input id="f-fizetett" type="number" value=""></div>
      <div class="field"><label>Beszerzési mennyiség (db) <span style="color:var(--faint);font-weight:400">— hány db-ot vettél</span></label>
        <input id="f-menny" type="number" min="1" value="1"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Beszerzés dátuma</label><input id="f-fdatum" type="date" value=""></div>
      <div class="field"><label>Beszerzés forrása</label><select id="f-forras"><option value="">—</option>${opts("forras","")}</select></div>
    </div>
    ${compBlocks}
    <div class="modrow"><button class="btn ghost" onclick="closeModal()">Mégse</button><button class="btn" id="f-save">Létrehozás</button></div>`);

  // státusz-gombok
  sheet.querySelectorAll(".statrow").forEach(row=>{
    row.addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return;
      row.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", x===b)); });
  });

  document.getElementById("f-save").onclick=async ()=>{
    const v=id=>{const e=document.getElementById(id);return e?e.value.trim():"";};
    const n=parseInt(v("f-n")); if(isNaN(n)){alert("A lapszám kötelező.");return;}
    const master={ lapszam:n, cim:v("f-name")||null, megjelenes:v("f-date")||null,
      eredeti_ar:v("f-eredeti")?parseInt(v("f-eredeti")):null };
    const personal={ fizetett_ar:v("f-fizetett")?parseInt(v("f-fizetett")):null,
      beszerzesi_mennyiseg: Math.max(1, parseInt(v("f-menny"))||1),
      beszerzes_datuma:v("f-fdatum")||null, forras:v("f-forras")||null, ar_auto:false };
    try{
      const {data,error}=await supabase.from("issues").insert({...master, series_id:s.id}).select().single();
      if(error) throw error;
      const issueId=data.id;
      const pierr=await upsertMyIssueData(issueId, personal); if(pierr) throw pierr;
      for(let ci=0; ci<s.components.length; ci++){
        const t=s.components[ci];
        const row=sheet.querySelector(`.statrow[data-stat="${t}"]`);
        const pressed=row?row.querySelector('button[aria-pressed="true"]'):null;
        const stat=pressed?(pressed.dataset.v||null):null;
        const dbv=Math.max(0, parseInt(v("cdb-"+t))||0);
        const cmaster={ azonosito_tipus:v("ct-"+t)||null, azonosito:v("cid-"+t)||null };
        const {data:cd,error:cerr}=await supabase.from("components").insert({...cmaster, issue_id:issueId, tipus:t}).select().single();
        if(cerr) throw cerr;
        const merr=await upsertMyStatus(cd.id,{status:stat, db:dbv, jegyzet:v("cn-"+t)||null});
        if(merr) throw merr;
      }
      closeModal(); await reload();
    }catch(e){ err(e); }
  };
}

/* ---- Listatár bővítése ---- */
const LIST_TITLES={kiado:"Kiadó",komponens:"Komponens-típus",azonosito:"Azonosító típusa",forras:"Beszerzés forrása"};
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
