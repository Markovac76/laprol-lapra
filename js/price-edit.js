/* ============================================================
   Személyes beszerzési adat szerkesztése — MINDENKINEK (nem csak staff).
   Csak a saját member_issue_data sorát írja; a törzsadatot (issues) SOHA.
   A lenyíló panel ✎ ikonjáról nyílik. A kézi mentés ar_auto=false-t állít,
   így a jelölés-visszavonáskori auto-nullázás ezt megőrzi.
   ============================================================ */
import { state, esc, opts } from "./state.js";
import { openModal, closeModal, err } from "./modal.js";
import { reload } from "./data.js";
import { upsertMyIssueData } from "./personal.js";

export function priceForm(it){
  const unknown = it.fizetett_ar==null;
  openModal(`<h2>Saját beszerzési adatok</h2>
    <p class="msub">#${it.n} · ${esc(it.name||"nincs cím")}</p>
    <div class="field">
      <label>Fizetett ár (Ft)</label>
      <label class="ckrow"><input type="checkbox" id="pf-unknown" ${unknown?"checked":""}> nem ismert</label>
      <input id="pf-ar" type="number" min="0" step="1" value="${it.fizetett_ar??""}" ${unknown?"disabled":""} placeholder="pl. 5990">
    </div>
    <div class="grid2">
      <div class="field"><label>Beszerzési mennyiség (db)</label><input id="pf-menny" type="number" min="1" value="${it.besz_menny??1}"></div>
      <div class="field"><label>Beszerzés dátuma</label><input id="pf-datum" type="date" value="${it.besz_datum||""}"></div>
    </div>
    <div class="field"><label>Beszerzés forrása</label><select id="pf-forras"><option value="">—</option>${opts("forras",it.forras)}</select></div>
    <div class="modrow"><button class="btn ghost" onclick="closeModal()">Mégse</button><button class="btn" id="pf-save">Mentés</button></div>`);

  const chk=document.getElementById("pf-unknown"), arIn=document.getElementById("pf-ar");
  chk.onchange=()=>{ arIn.disabled=chk.checked; if(chk.checked) arIn.value=""; else arIn.focus(); };

  document.getElementById("pf-save").onclick=async ()=>{
    const ar = chk.checked ? null : Math.max(0, parseInt(arIn.value)||0);
    const menny = Math.max(1, parseInt(document.getElementById("pf-menny").value)||1);
    const datum = document.getElementById("pf-datum").value||null;
    const forras = document.getElementById("pf-forras").value||null;
    try{
      const e=await upsertMyIssueData(it.id, {
        fizetett_ar: ar, beszerzesi_mennyiseg: menny, beszerzes_datuma: datum, forras, ar_auto: false
      });
      if(e) throw e;
      closeModal(); await reload();
    }catch(ex){ err(ex); }
  };
}
