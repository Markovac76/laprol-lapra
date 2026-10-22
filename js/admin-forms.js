/* ============================================================
   Karbantartás — űrlapok: tétel, listatár, sorozat-kód számláló.
   (A sorozat-szintű létrehozás/szerkesztés a Karbantartás pool-on át megy —
    lásd karbantartas.js + series-proposal.js. A felhasználó-kezelés külön
    modulban: admin-users.js.)
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, S, esc, pad, opts, capFirst, slugify, sortEgyebLast, typeLabel } from "./state.js";
import { openModal, closeModal, err, friendlyError, sheet, guarded } from "./modal.js";
import { showMessage, askConfirm } from "./dialog.js";
import { reload } from "./data.js";
import { typeFieldsHtml, readTypeFields, wireTypeFields } from "./draft-items.js";
import { typeDef, defaultIdType, buildLiveIssuePayload } from "./type-defs.js";
import { initialComponents } from "./component-template.js";

/* ---- Új szám létrehozása (staff-only) ----
   Csak ÚJ tétel felvitelére való — meglévő publikált tétel törzsadat-
   szerkesztése/törlése mostantól kizárólag a Karbantartás draft/
   publikálás-folyamatán megy át (lásd karbantartas.js/draft-items.js);
   a meglévő tétel SAJÁT adatait (státusz/darabszám/jegyzet/ár) pedig a
   mindenki számára elérhető "Saját adatlap" kezeli (my-data.js). Új
   tételnél nincs mit védeni (senkinek nincs még adata rajta), ezért ez
   közvetlenül írhat törzsadatot — ugyanaz az elv, mint az Excel-importnál. */
let itemFormSeq=0;

// Az elemek a TÍPUSLEÍRÁS szerinti mezőket kapják — ugyanaz a kód és ugyanazok a szabályok, mint a
// Karbantartás draft-szerkesztőjében (draft-items.js: typeFieldsHtml). A mentés EGYETLEN szerver-hívás
// (create_live_issue): egy tranzakció, a típusszabályok ellenőrzésével, a fő elem beállításával; hiba
// esetén semmi nem mentődik, a hibák egyszerre jelennek meg az űrlapon, a beírt adat megmarad.
// Egy típusból itt is felvehető TÖBB példány (a "+ Még egy X" gombbal).
export function itemForm(){
  const s=S();
  const nextN = s.items.reduce((m,x)=>Math.max(m,x.n||0),0)+1;
  const scode=pad(S().kodSzam||(state.activeIdx+1),3);
  const tmpl = Array.isArray(s.template) ? s.template : [];
  const newInst = (t, o={}) => ({ tipus:t, key:"i"+(itemFormSeq++), status:null, db:1, jegyzet:"", adatok:{},
    azonosito_tipus: defaultIdType(typeDef(state.TYPEDEFS, t), tmpl.find(e=>e.tipus===t)) || "",
    azonosito:"", megnevezes:(tmpl.find(e=>e.tipus===t)||{}).default_megnevezes||"", ...o });
  let master = {n:nextN, name:"", date:"", eredeti_ar:"", fizetett_ar:"", besz_menny:1, besz_datum:"", forras:""};
  // Kiindulás: a sorozat sablonjának KÖTELEZŐ típusai (sablon nélkül a sorozat komponens-listája).
  const startTypes = tmpl.length ? initialComponents(tmpl).map(c=>c.tipus) : s.components.slice();
  let instances = startTypes.map(t=>newInst(t));
  // A választható típusok sorrendje: a sorozat típusai (a sablon szerint), a nem kötelezők is hozzáadhatók.
  const seriesTypes = tmpl.length ? tmpl.map(e=>e.tipus) : s.components.slice();
  // FŐ ELEM (★): a sablon fő típusa, ennek hiányában magazin, könyv, első — megegyezik a szerver szabályával.
  const pickMain = () => { const mt=(tmpl.find(e=>e.main)||{}).tipus;
    const m = instances.find(i=>i.tipus===mt) || instances.find(i=>i.tipus==="magazin") || instances.find(i=>i.tipus==="konyv") || instances[0];
    return m ? m.key : null; };
  let mainKey = pickMain();
  let errText = "";

  function syncFromDom(){
    const v=id=>{const e=document.getElementById(id);return e?e.value:null;};
    master = { n:v("f-n"), name:v("f-name"), date:v("f-date"), eredeti_ar:v("f-eredeti"),
      fizetett_ar:v("f-fizetett"), besz_menny:v("f-menny"), besz_datum:v("f-fdatum"), forras:v("f-forras") };
    const mr=sheet.querySelector('input[name="f-main"]:checked'); if(mr) mainKey=mr.value;
    instances.forEach(inst=>{
      const row=sheet.querySelector(`.statrow[data-stat="${inst.key}"]`);
      const pressed=row?row.querySelector('button[aria-pressed="true"]'):null;
      inst.status = pressed?(pressed.dataset.v||null):null;
      inst.db = v("cdb-"+inst.key); inst.jegyzet=v("cn-"+inst.key);
      readTypeFields(inst, inst.key);
    });
  }

  function draw(){
    const byType={}; instances.forEach(i=>{ (byType[i.tipus]=byType[i.tipus]||[]).push(i); });
    if(!instances.some(i=>i.key===mainKey)) mainKey = pickMain();
    let ci=0;
    const compBlocks = seriesTypes.map(t=>{
      const list=byType[t]||[];
      const blocks=list.map((inst,idx)=>{
        ci++;
        return `<div class="compedit">
          <h4>${esc(typeLabel(t))}${list.length>1?` #${idx+1}`:""}</h4>
          <div class="kod">${scode}-${pad(master.n||nextN,4)}-${pad(ci,2)}</div>
          ${typeFieldsHtml(inst, inst.key, t, list.length>1)}
          ${instances.length>1
            ? `<label class="ckrow" style="margin-top:6px"><input type="radio" name="f-main" value="${esc(inst.key)}" ${inst.key===mainKey?"checked":""}> ★ Fő elem <span style="color:var(--faint);font-weight:400">— a sorban az első helyen áll</span></label>`
            : `<div class="fieldnote">★ Ez a Szám egyetlen eleme, ezért ez a fő elem.</div>`}
          <div class="msub" style="margin:10px 0 4px;color:var(--accent);filter:brightness(1.2);font-weight:600">Saját jelölés — csak a tiéd (nem kötelező)</div>
          <div class="statrow" data-stat="${inst.key}">
            <button type="button" data-v="megvan" aria-pressed="${inst.status==="megvan"}">megvan</button>
            <button type="button" data-v="hianyzik" aria-pressed="${inst.status==="hianyzik"}">hiány</button>
            <button type="button" data-v="nemkell" aria-pressed="${inst.status==="nemkell"}">nem kell</button>
            <button type="button" data-v="" aria-pressed="${!inst.status}">jelöletlen</button>
          </div>
          <div class="grid2" style="margin-top:8px">
            <div class="field"><label>Darabszám (db)</label><input id="cdb-${inst.key}" type="number" min="0" value="${esc(inst.db??1)}"></div>
            <div class="field"><label>Jegyzet</label><input id="cn-${inst.key}" value="${esc(inst.jegyzet||"")}"></div>
          </div>
          ${list.length>1?`<button type="button" class="btn danger" data-removeinst="${inst.key}">Ez a példány törlése</button>`:""}
        </div>`;
      }).join("");
      return blocks + `<button type="button" class="btn ghost" data-addinst="${esc(t)}">+ ${list.length?"Még egy ":""}${esc(typeLabel(t))} hozzáadása</button>`;
    }).join("");

    openModal(`<h2>Új szám</h2>
      <p class="msub">${esc(s.sorozat)} — az új Szám mentéskor azonnal élő lesz.</p>
      <div class="formerr" id="f-err"${errText?"":" hidden"}>${esc(errText)}</div>
      <div class="grid2">
        <div class="field"><label>Lapszám</label><input id="f-n" type="number" value="${esc(master.n??"")}"></div>
        <div class="field"><label>Megjelenés dátuma</label><input id="f-date" type="date" value="${esc(master.date||"")}"></div>
      </div>
      <div class="field"><label>Cím</label><input id="f-name" value="${esc(master.name||"")}"></div>
      <div class="field"><label>Eredeti ár (Ft) <span style="color:var(--faint);font-weight:400">— a megjelenéskori/újságos ár (közös törzsadat)</span></label>
        <input id="f-eredeti" type="number" value="${esc(master.eredeti_ar??"")}"></div>
      <div class="msub" style="margin:14px 0 2px;color:var(--accent);filter:brightness(1.2);font-weight:600">Személyes beszerzés — csak a tiéd (nem kötelező)</div>
      <div class="grid2">
        <div class="field"><label>Fizetett ár (Ft)</label><input id="f-fizetett" type="number" value="${esc(master.fizetett_ar??"")}"></div>
        <div class="field"><label>Beszerzési mennyiség (db) <span style="color:var(--faint);font-weight:400">— hány db-ot vettél</span></label>
          <input id="f-menny" type="number" min="1" value="${esc(master.besz_menny??1)}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label>Beszerzés dátuma</label><input id="f-fdatum" type="date" value="${esc(master.besz_datum||"")}"></div>
        <div class="field"><label>Beszerzés forrása</label><select id="f-forras"><option value="">—</option>${opts("forras",master.forras)}</select></div>
      </div>
      ${compBlocks}
      <div class="modrow"><button class="btn ghost" onclick="closeModal()">Mégse</button><button class="btn" id="f-save">Létrehozás</button></div>`);

    wireTypeFields(sheet);
    // státusz-gombok
    sheet.querySelectorAll(".statrow").forEach(row=>{
      row.addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return;
        row.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", x===b)); });
    });
    sheet.querySelectorAll("[data-addinst]").forEach(b=>{
      b.onclick=()=>{ syncFromDom(); instances.push(newInst(b.dataset.addinst)); draw(); };
    });
    sheet.querySelectorAll("[data-removeinst]").forEach(b=>{
      b.onclick=()=>{ syncFromDom(); instances=instances.filter(i=>i.key!==b.dataset.removeinst); draw(); };
    });

    document.getElementById("f-save").onclick=guarded(async ()=>{
      syncFromDom();
      if(!/^-?\d+$/.test(String(master.n||"").trim())){ errText="A lapszám kötelező, és egész szám kell legyen."; draw(); showErr(); return; }
      const { issue, personal } = buildLiveIssuePayload(master, instances, mainKey);
      try{
        // EGY Szám = EGY hívás: a Szám, az elemei, a fő elem, a feliratkozók „látott” sorai és (ha megadtad)
        // a saját jelöléseid egy tranzakcióban jönnek létre — vagy semmi.
        const { error } = await supabase.rpc("create_live_issue", { p_series_id: s.id, p_issue: issue, p_personal: personal });
        if(error) throw error;
        closeModal(); await reload();
      }catch(e){
        console.error(e);
        errText = friendlyError(e);      // a szerver több soros, magyar üzenete — az űrlapon, a beírt adat megmarad
        draw(); showErr();
      }
    });
  }
  function showErr(){ const el=document.getElementById("f-err"); if(el) el.scrollIntoView({block:"start"}); }

  draw();
}

/* ---- Listatár bővítése + átnevezése ---- */
// A listák KÖZÖSEK (mindenki ugyanazt látja; a lists.user_id csak a létrehozó).
// Az értékekre a sorozatok/komponensek az `ertek` (azonosító) szöveggel
// hivatkoznak — az átnevezés ezért csak a megjelenített nevet (`megjelenites`)
// írja át, hivatkozást nem kell javítani, és az azonosító nem változik.
const LIST_TITLES={kiado:"Kiadó",komponens:"Komponens-típus",azonosito:"Azonosító típusa",forras:"Beszerzés forrása",kategoria:"Kategória (témakör)"};
const normName=x=>String(x||"").trim().toLowerCase().replace(/\s+/g," ");

export function listsForm(){
  const grps=Object.keys(LIST_TITLES).map(t=>`
    <div class="listgrp"><h4>${LIST_TITLES[t]}</h4>
      <div class="vals">${(state.LISTS[t]||[]).map(o=>`<span class="val">${esc(o.nev)}<button type="button" class="valedit" data-rename="${t}" data-e="${esc(o.ertek)}" title="Átnevezés" aria-label="Átnevezés: ${esc(o.nev)}">✎</button>${o.ertek==="egyeb"?"":`<button type="button" class="valdel" data-del="${t}" data-e="${esc(o.ertek)}" title="Törlés" aria-label="Törlés: ${esc(o.nev)}">🗑</button>`}</span>`).join("")||'<span class="val">—</span>'}</div>
      <div class="addrow"><input id="nl-${t}" placeholder="új érték neve"><button data-add="${t}">+</button></div>
    </div>`).join("");
  openModal(`<h2>Listák</h2><p class="msub">Itt bővítheted a választható értékeket, a ✎ ikonnal átnevezheted (csak a megjelenített név változik, a már használt értékek nem), a 🗑 ikonnal törölheted őket — de csak azt, ami sehol nincs használatban. Rögzítés közben nem lehet bővíteni — így a listák nem híznak el.</p>
    ${grps}
    <div class="modrow"><button class="btn" onclick="closeModal()">Kész</button></div>`);
  // FONTOS (12. pont): a gombokra KÖZVETLENÜL kötünk, nem a tartós #sheet
  // elemre. A korábbi `sheet.addEventListener` minden listsForm()-hívásnál
  // (és minden sikeres hozzáadás után újra) egy ÚJABB figyelőt halmozott,
  // így egy kattintásra N párhuzamos beszúrás indult. Az itteni gombok minden
  // megnyitáskor újrajönnek létre, az onclick-hozzárendelés pedig idempotens.
  sheet.querySelectorAll("[data-add]").forEach(b=>{
    b.onclick=guarded(async ()=>{
      const t=b.dataset.add, inp=document.getElementById("nl-"+t);
      const nev=capFirst(inp.value); if(!nev) return;               // első betű automatikusan nagybetű (11. pont)
      const ertek=slugify(nev);                                      // ékezet nélküli azonosító (11. pont)
      if(!ertek){ showMessage("Adj meg érvényes nevet.", { title:"Figyelem" }); return; }
      // Érthető duplikátum-üzenet (kis/nagybetűre és szóközre érzéketlenül).
      if((state.LISTS[t]||[]).some(o=>normName(o.nev)===normName(nev) || o.ertek.toLowerCase()===ertek)){
        showMessage("Ez az érték már szerepel a listában.", { title:"Figyelem" }); return;
      }
      try{
        const so=(state.LISTS[t]||[]).length+1;
        const {error}=await supabase.from("lists").insert({tipus:t, ertek, megjelenites:nev, sort_order:so});
        if(error) throw error;
        // Az "Egyéb" a megjelenítésben mindig utolsó marad (13. pont).
        state.LISTS[t]=sortEgyebLast([...(state.LISTS[t]||[]), {ertek,nev}]);
        inp.value=""; listsForm();
      }catch(e){ err(e); }
    });
  });

  // Átnevezés: a chip helyén egy beviteli mező jelenik meg (Enter = mentés, Esc = mégse).
  sheet.querySelectorAll("[data-rename]").forEach(b=>{
    b.onclick=()=>{
      const t=b.dataset.rename, e=b.dataset.e, chip=b.closest(".val");
      const cur=(state.LISTS[t]||[]).find(o=>o.ertek===e); if(!cur) return;
      chip.innerHTML=`<input class="valinput" value="${esc(cur.nev)}" maxlength="60" aria-label="Új név">
        <button type="button" class="valsave" title="Mentés">✓</button><button type="button" class="valcancel" title="Mégse">✕</button>`;
      const inp=chip.querySelector(".valinput"), save=chip.querySelector(".valsave");
      inp.focus(); inp.select();
      chip.querySelector(".valcancel").onclick=()=>listsForm();
      inp.onkeydown=ev=>{ if(ev.key==="Enter"){ ev.preventDefault(); save.click(); } else if(ev.key==="Escape") listsForm(); };
      save.onclick=guarded(async ()=>{
        const nev=capFirst(inp.value);
        if(!nev){ showMessage("Adj meg nevet.", { title:"Figyelem" }); return; }
        if(nev===cur.nev){ listsForm(); return; }
        if((state.LISTS[t]||[]).some(o=>o.ertek!==e && normName(o.nev)===normName(nev))){
          showMessage("Ez a név már szerepel a listában.", { title:"Figyelem" }); return;
        }
        try{
          // Közvetlen módosítás (nem megy a draft/verzió-folyamaton át); a hivatkozások
          // az azonosítóra mutatnak, ezért nem kell őket átírni.
          const {data,error}=await supabase.from("lists").update({megjelenites:nev}).eq("tipus",t).eq("ertek",e).select();
          if(error) throw error;
          if(!data || !data.length){ showMessage("Ez a lista-elem már nem található — frissítsd az oldalt."); return; }
          await reload();            // a fülek, választók az új nevet mutassák
        }catch(e2){ err(e2); return; }
        listsForm();
      });
    };
  });

  // Törlés: csak a használatlan, nem védett érték. A szerver dönt (delete_list_value), és ha nem törölhető,
  // megmondja, hol van használatban / miért védett — az üzenet a szokásos hibaablakban jelenik meg.
  sheet.querySelectorAll("[data-del]").forEach(b=>{
    b.onclick=guarded(async ()=>{
      const t=b.dataset.del, e=b.dataset.e;
      const cur=(state.LISTS[t]||[]).find(o=>o.ertek===e); if(!cur) return;
      if(!(await askConfirm(`Törlöd a(z) „${cur.nev}” értéket a(z) „${LIST_TITLES[t]}” listából?\n\nCsak akkor törlődik, ha sehol nincs használatban (ha igen, az üzenet megmondja, hol). Később újra felveheted.`, { title:"Törlöd az értéket?", okLabel:"Törlöm", danger:true }))) return;
      try{
        const {error}=await supabase.rpc("delete_list_value",{p_tipus:t, p_ertek:e});
        if(error) throw error;
        await reload();            // a választók és a fülek se mutassák tovább
      }catch(e2){ err(e2); return; }
      listsForm();
    });
  });
}
