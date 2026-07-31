/* ============================================================
   Belépési pont: minden esemény-bekötés + indítás egy helyen.
   ============================================================ */
import { state, S, nextStatus, hasOwnedComponent } from "./state.js";
import { SUPABASE_ANON_KEY } from "./supabase.js";
import { renderAll, renderList, renderChips, renderTabs, applyPickerMode, syncHeadHeight } from "./render.js";
import { upsertMyStatus, applyAutoPrice } from "./personal.js";
import { priceForm } from "./price-edit.js";
import { itemForm, seriesForm, listsForm } from "./admin-forms.js";
import { usersForm } from "./admin-users.js";
import { downloadTemplate, handleUpload } from "./excel.js";
import { err } from "./modal.js";
import { showApp, loginWithPassword, registerWithPassword, logout, initSession } from "./auth.js";

/* ---- fülsáv / szűrők / keresés ---- */
document.getElementById("tabtoggle").addEventListener("click",()=>{ state.tabsOpen=!state.tabsOpen; renderTabs(); applyPickerMode(); syncHeadHeight(); });
document.getElementById("tabnow").addEventListener("click",()=>{ state.tabsOpen=!state.tabsOpen; renderTabs(); applyPickerMode(); syncHeadHeight(); });
document.getElementById("tabs").addEventListener("click",e=>{const b=e.target.closest(".tab");if(!b)return; state.activeIdx=+b.dataset.i; state.costVisible=false; state.costBasis="eredeti"; state.openIssue=null; state.tabsOpen=false; window.scrollTo({top:0}); renderAll();});
document.getElementById("chips").addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b)return; state.filter=b.dataset.f; state.openIssue=null; renderChips(); renderList();});
document.getElementById("search").addEventListener("input",e=>{state.query=e.target.value.trim(); state.openIssue=null; renderList();});

/* ---- lista: jelölés, darabszám-léptető, szerkesztés, képsáv ---- */
document.getElementById("list").addEventListener("click",async e=>{
  const exp=e.target.closest(".expander");
  if(exp){ const n=+exp.dataset.exp; state.openIssue=(state.openIssue===n)?null:n; renderList(); return; }

  // Saját beszerzési adat szerkesztése (mindenkinek) — a panel ✎ ikonja
  const pe=e.target.closest("[data-editprice]");
  if(pe){ const it=S().items.find(x=>x.n===+pe.dataset.editprice); if(it) priceForm(it); return; }

  // +/− darabszám-léptető (a lenyíló panelben)
  const st=e.target.closest(".pstepbtn");
  if(st){
    const it=S().items.find(x=>x.n===+st.dataset.n); const t=st.dataset.t;
    const comp=it&&it.comps[t]; if(!comp||!comp.id) return;
    const prevOwned=hasOwnedComponent(it,S());
    const prevDb=(comp.db==null?1:comp.db), prevStatus=comp.status;
    let nextDb = prevDb + (st.dataset.step==="+" ? 1 : -1);
    if(nextDb<0) nextDb=0;
    // 0-nál automatikusan „hiányzik”, 1 fölé emelve automatikusan „megvan”
    let nextSt=prevStatus;
    if(nextDb===0) nextSt="hianyzik";
    else if(prevDb===0 || prevStatus!=="megvan") nextSt="megvan";
    comp.db=nextDb; comp.status=nextSt; renderAll();
    const error=await upsertMyStatus(comp.id,{db:nextDb,status:nextSt});
    if(error){ comp.db=prevDb; comp.status=prevStatus; renderAll(); alert("Mentés sikertelen: "+error.message); return; }
    await applyAutoPrice(it, S(), prevOwned); renderAll();
    return;
  }

  const ed=e.target.closest("[data-edit]");
  if(ed){ const it=S().items.find(x=>x.n===+ed.dataset.edit); if(it) itemForm(it); return; }
  const mk=e.target.closest(".mark"); if(!mk||mk.disabled) return;
  const it=S().items.find(x=>x.n===+mk.dataset.n); const t=mk.dataset.t;
  const comp=it.comps[t]; if(!comp||!comp.id) return;
  const prevOwned=hasOwnedComponent(it,S());
  const prev=comp.status, prevDb=(comp.db==null?1:comp.db);
  const next=nextStatus(prev);                                   // jelöletlenre nem tér vissza
  // „megvan”-ra váltáskor a számláló mindig 1-ről indul (onnan lehet +/− gombbal emelni)
  const nextDb = (next==="megvan") ? Math.max(1, prevDb===0?1:prevDb) : prevDb;
  comp.status=next; comp.db=nextDb; renderAll();                 // optimista frissítés
  const error=await upsertMyStatus(comp.id,{status:next,db:nextDb});
  if(error){ comp.status=prev; comp.db=prevDb; renderAll(); alert("Mentés sikertelen: "+error.message); return; }
  await applyAutoPrice(it, S(), prevOwned); renderAll();         // B2: auto fizetett ár kitöltés/nullázás
});

/* ---- karbantartó eszköztár ---- */
document.getElementById("admToggle").onclick=function(){ state.adminMode=!state.adminMode;
  this.setAttribute("aria-pressed",state.adminMode); this.classList.toggle("on",state.adminMode);
  renderList(); applyPickerMode(); };
document.getElementById("a-item").onclick=()=>{ if(!S()){ alert("Előbb hozz létre egy sorozatot (+ Új sorozat)."); return; } itemForm(null); };
document.getElementById("a-editseries").onclick=()=>{ if(!S()){ alert("Nincs sorozat, amit szerkeszteni lehetne."); return; } seriesForm(S()); };
document.getElementById("a-series").onclick=()=>seriesForm(null);
document.getElementById("a-lists").onclick=listsForm;
document.getElementById("usersBtn").onclick=usersForm;
document.getElementById("a-template").onclick=downloadTemplate;
document.getElementById("a-upload").onclick=()=>document.getElementById("upl").click();
document.getElementById("upl").addEventListener("change",function(){ const f=this.files&&this.files[0]; if(f) handleUpload(f).catch(err); this.value=""; });

/* ---- bejelentkezés ---- */
let registerMode=false;
const gSwitch=document.getElementById("g-switch");
gSwitch.onclick=(e)=>{
  e.preventDefault(); registerMode=!registerMode;
  document.getElementById("g-in").textContent = registerMode ? "Regisztráció" : "Belépés";
  gSwitch.textContent = registerMode ? "Van már fiókod? Lépj be" : "Regisztrálj";
  document.getElementById("g-err").textContent="";
};
document.getElementById("g-in").onclick=async ()=>{
  const btn=document.getElementById("g-in"), errEl=document.getElementById("g-err");
  errEl.textContent="";
  if(!SUPABASE_ANON_KEY){ errEl.textContent="Hiányzik a config.js fájl vagy az anon kulcs benne."; return; }
  const email=document.getElementById("g-email").value.trim();
  const password=document.getElementById("g-pass").value;
  if(registerMode){
    btn.disabled=true; btn.textContent="Regisztráció…";
    const {error}=await registerWithPassword(email,password);
    btn.disabled=false; btn.textContent="Regisztráció";
    if(error){ errEl.textContent="Regisztráció sikertelen: "+error.message; return; }
    errEl.style.color="#8ee9ad"; errEl.textContent="Sikeres regisztráció! Most jelentkezz be ugyanezzel az e-maillel/jelszóval.";
    registerMode=false; document.getElementById("g-in").textContent="Belépés";
    gSwitch.textContent="Regisztrálj"; return;
  }
  btn.disabled=true; btn.textContent="Belépés…";
  const {error}=await loginWithPassword(email,password);
  btn.disabled=false; btn.textContent="Belépés";
  if(error){ errEl.style.color=""; errEl.textContent="Hibás e-mail vagy jelszó."; return; }
  showApp();
};
document.getElementById("g-pass").addEventListener("keydown",e=>{ if(e.key==="Enter") document.getElementById("g-in").click(); });
document.getElementById("logout").onclick=logout;

/* ---- egyéb ---- */
window.addEventListener("resize",syncHeadHeight);

/* ---- indítás: van-e már munkamenet? ---- */
initSession();
