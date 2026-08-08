/* ============================================================
   "Saját adatlap" — MINDENKI (nem csak staff) számára egyformán
   elérhető, konszolidált személyes-adat panel egy Számhoz:
   komponensenként Státusz (+ reset jelöletlenre) / Darabszám / Jegyzet,
   Azonosító csak olvasva (törzsadat), és a szám-szintű saját beszerzés
   (Fizetett ár + mennyiség + dátum + forrás).
   Ez váltja fel a korábbi price-edit.js-t (csak ár) és a staff-only
   itemForm meglévő-tétel-szerkesztési útját — kizárólag a member_status/
   member_issue_data saját sorait írja, a törzsadatot SOHA.
   ============================================================ */
import { state, S, COMP_TYPES, esc, opts } from "./state.js";
import { openModal, closeModal, err, sheet } from "./modal.js";
import { reload } from "./data.js";
import { upsertMyStatus, upsertMyIssueData } from "./personal.js";

export function myDataForm(it){
  const s = S();
  const unknown = it.fizetett_ar==null;
  const compBlocks = s.components.map(t=>{
    const c = it.comps[t]||{};
    const st = c.status||null;
    return `<div class="compedit">
      <h4>${COMP_TYPES[t]||t}</h4>
      <div class="statrow" data-stat="${t}">
        <button type="button" data-v="megvan" aria-pressed="${st==="megvan"}">megvan</button>
        <button type="button" data-v="hianyzik" aria-pressed="${st==="hianyzik"}">hiány</button>
        <button type="button" data-v="nemkell" aria-pressed="${st==="nemkell"}">nem kell</button>
        <button type="button" data-v="" aria-pressed="${!st}">jelöletlen</button>
      </div>
      <div class="grid2" style="margin-top:8px">
        <div class="field"><label>Darabszám (db)</label><input id="md-db-${t}" type="number" min="0" value="${c.db==null?1:c.db}"></div>
        <div class="field"><label>Azonosító</label><input value="${esc(c.azonosito||"nincs")}" disabled></div>
      </div>
      <div class="field"><label>Jegyzet</label><input id="md-note-${t}" value="${esc(c.note||"")}"></div>
    </div>`;
  }).join("");

  openModal(`<h2>Saját adatlap</h2>
    <p class="msub">#${it.n}${it.name?" · "+esc(it.name):""}</p>
    ${compBlocks}
    <div class="msub" style="margin:14px 0 2px;color:var(--accent);filter:brightness(1.2);font-weight:600">Saját beszerzés — csak a tiéd</div>
    <div class="field">
      <label>Fizetett ár (Ft)</label>
      <label class="ckrow"><input type="checkbox" id="md-unknown" ${unknown?"checked":""}> nem ismert</label>
      <input id="md-ar" type="number" min="0" step="1" value="${it.fizetett_ar??""}" ${unknown?"disabled":""} placeholder="pl. 5990">
    </div>
    <div class="grid2">
      <div class="field"><label>Beszerzési mennyiség (db)</label><input id="md-menny" type="number" min="1" value="${it.besz_menny??1}"></div>
      <div class="field"><label>Beszerzés dátuma</label><input id="md-datum" type="date" value="${it.besz_datum||""}"></div>
    </div>
    <div class="field"><label>Beszerzés forrása</label><select id="md-forras"><option value="">—</option>${opts("forras",it.forras)}</select></div>
    <div class="modrow"><button class="btn ghost" onclick="closeModal()">Mégse</button><button class="btn" id="md-save">Mentés</button></div>`);

  sheet.querySelectorAll(".statrow").forEach(row=>{
    row.addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return;
      row.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed", x===b)); });
  });
  const chk=document.getElementById("md-unknown"), arIn=document.getElementById("md-ar");
  chk.onchange=()=>{ arIn.disabled=chk.checked; if(chk.checked) arIn.value=""; else arIn.focus(); };

  document.getElementById("md-save").onclick=async ()=>{
    try{
      for(const t of s.components){
        const comp=it.comps[t]; if(!comp||!comp.id) continue;
        const row=sheet.querySelector(`.statrow[data-stat="${t}"]`);
        const pressed=row?row.querySelector('button[aria-pressed="true"]'):null;
        const stat=pressed?(pressed.dataset.v||null):null;
        const dbv=Math.max(0, parseInt(document.getElementById("md-db-"+t).value)||0);
        const note=document.getElementById("md-note-"+t).value.trim()||null;
        const merr=await upsertMyStatus(comp.id, {status:stat, db:dbv, jegyzet:note});
        if(merr) throw merr;
      }
      const ar = chk.checked ? null : Math.max(0, parseInt(arIn.value)||0);
      const menny = Math.max(1, parseInt(document.getElementById("md-menny").value)||1);
      const datum = document.getElementById("md-datum").value||null;
      const forras = document.getElementById("md-forras").value||null;
      const pierr = await upsertMyIssueData(it.id, { fizetett_ar: ar, beszerzesi_mennyiseg: menny, beszerzes_datuma: datum, forras, ar_auto: false });
      if(pierr) throw pierr;
      closeModal(); await reload();
    }catch(e){ err(e); }
  };
}
