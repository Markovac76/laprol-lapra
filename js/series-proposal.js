/* ============================================================
   "Új javaslat" — bárki (nem csak staff) javasolhat egy vadonatúj
   sorozatot. A javaslat a draft_series poolba kerül, "Beérkezett"
   állapotban — onnantól a Karbantartás (staff) viszi tovább.
   Ez NEM hozza létre közvetlenül a live sorozatot — az egyetlen út
   ehhez a pool-on át vezet (2.4).
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, DISPLAY_MAX, PAL12, PAL_FAMILIES, esc, opts } from "./state.js";
import { openModal, closeModal, err, sheet } from "./modal.js";
import { downloadDraftTemplate, pickDraftExcelFile, confirmDraftUpload, bulkInsertDraftItemsAsProposer } from "./draft-excel.js";

// Köztes lépés a javaslat beküldése és a "Köszönjük" képernyő között —
// itt (nem kötelezően) tömegesen felvihetők a Számok egy sablon-Excellel,
// hogy ne kelljen a staff-nak egyesével pótolnia, vagy a beküldőnek
// egyáltalán ne is legyen módja rá (11. pont).
function renderProposalIntermediate(draftId, comps, nm){
  openModal(`<h2>Javaslat rögzítve</h2>
    <p class="msub">„${esc(nm)}” bekerült a feldolgozásra váró listába. Ha van kész listád a Számokról, itt (nem kötelező) tömegesen is felviheted egy sablon-Excellel — így a staffnak nem kell egyesével pótolnia.</p>
    <div class="modrow"><button class="btn ghost" id="pi-tmpl">⬇ Sablon letöltése</button>
      <button class="btn ghost" id="pi-tmplup">⬆ Kitöltött sablon feltöltése</button></div>
    <div class="modrow"><button class="btn" id="pi-done">Kész</button></div>`);
  document.getElementById("pi-tmpl").onclick=()=>downloadDraftTemplate(comps, nm);
  document.getElementById("pi-tmplup").onclick=()=>{
    pickDraftExcelFile(file=>confirmDraftUpload(openModal, err, file, draftId, comps,
      ()=>renderProposalIntermediate(draftId, comps, nm), bulkInsertDraftItemsAsProposer));
  };
  document.getElementById("pi-done").onclick=()=>{
    openModal(`<h2>Köszönjük!</h2><p class="msub">A javaslatod bekerült a feldolgozásra váró listába.</p>
      <div class="modrow"><button class="btn" onclick="closeModal()">Rendben</button></div>`);
  };
}

export function proposeSeriesForm(){
  let color = PAL12[0];
  let comps = ["magazin"];
  const compList = (state.LISTS.komponens||[{ertek:"magazin",nev:"Magazin"},{ertek:"modell",nev:"Modell"},{ertek:"konyv",nev:"Könyv"},{ertek:"egyeb",nev:"Egyéb"}]);

  openModal(`<h2>Új sorozat javaslása</h2>
    <p class="msub">A javaslat a feldolgozásra váró listába kerül — a staff nézi át, mielőtt élesbe kerülne.</p>
    <div class="field"><label>Kiadó</label><select id="p-kiado"><option value="">—</option>${opts("kiado","")}</select></div>
    <div class="field"><label>Megnevezés (teljes név)</label><input id="p-name" placeholder="pl. Star Wars űrhajók"></div>
    <div class="field"><label>Megjelenítendő név a fülön (max ${DISPLAY_MAX}) — <span id="p-count">0/${DISPLAY_MAX}</span></label>
      <input id="p-display" maxlength="${DISPLAY_MAX}"></div>
    <div class="field"><label>Komponensek (miből áll egy szám)</label><div class="compchecks" id="p-comps">
      ${compList.map(o=>`<button type="button" class="compcheck" data-t="${esc(o.ertek)}" aria-pressed="${comps.includes(o.ertek)}">${esc(o.nev)}</button>`).join("")}</div></div>
    <div class="field"><label>Szín</label>
      <div id="p-sw">${PAL_FAMILIES.map(f=>`
        <div class="swfam"><span class="swfam-nev">${f.nev}</span>
          <div class="swatches">${f.szinek.map(c=>`<button type="button" class="swatch" data-c="${c}" style="background:${c}" aria-pressed="${c===color}"></button>`).join("")}</div>
        </div>`).join("")}</div></div>
    <div class="modrow"><button class="btn ghost" onclick="closeModal()">Mégse</button><button class="btn" id="p-save">Javaslat beküldése</button></div>`);

  const dEl=document.getElementById("p-display"), cEl=document.getElementById("p-count");
  dEl.addEventListener("input",()=>cEl.textContent=`${dEl.value.length}/${DISPLAY_MAX}`);
  document.getElementById("p-comps").addEventListener("click",e=>{ const b=e.target.closest(".compcheck"); if(!b) return;
    const t=b.dataset.t; if(comps.includes(t)) comps=comps.filter(x=>x!==t); else comps.push(t);
    b.setAttribute("aria-pressed", comps.includes(t)); });
  document.getElementById("p-sw").addEventListener("click",e=>{ const b=e.target.closest(".swatch"); if(!b) return;
    color=b.dataset.c; sheet.querySelectorAll("#p-sw .swatch").forEach(x=>x.setAttribute("aria-pressed", x===b)); });

  document.getElementById("p-save").onclick=async ()=>{
    const nm=document.getElementById("p-name").value.trim();
    if(!nm){ alert("A megnevezés kötelező."); return; }
    if(!comps.length){ alert("Legalább egy komponens kell."); return; }
    const disp=(dEl.value.trim()||nm).slice(0,DISPLAY_MAX);
    try{
      // Az id-t a kliens generálja és küldi be — a draft_series SELECT-
      // szabálya staff-only (a Karbantartás felület csak nekik való), egy
      // sima .select()-es visszaolvasás egy nem-staff beküldőnél RLS-hibát
      // dobna (Postgres az INSERT...RETURNING kimenetét is a SELECT-
      // szabályon engedi át, és elutasítás esetén hibát ad, nem üres sort).
      const newId = crypto.randomUUID();
      const { error } = await supabase.from("draft_series").insert({
        id: newId, pool_type:"new", pool_status:"incoming", submitted_by: state.myId,
        kiado: document.getElementById("p-kiado").value||null,
        megnevezes: nm, megjelenites: disp, szin: color, components: comps,
      });
      if(error) throw error;
      renderProposalIntermediate(newId, comps, nm);
    }catch(e){ err(e); }
  };
}
