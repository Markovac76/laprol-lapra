/* ============================================================
   Belépési pont: minden esemény-bekötés + indítás egy helyen.
   ============================================================ */
import { state, S, nextStatus, hasOwnedComponent, findCompById, allComps } from "./state.js";
import { SUPABASE_ANON_KEY } from "./supabase.js";
import { renderAll, renderList, renderChips, renderTabs, applyPickerMode, syncHeadHeight } from "./render.js";
import { upsertMyStatus, applyAutoPrice } from "./personal.js";
import { myDataForm } from "./my-data.js";
import { itemForm, listsForm } from "./admin-forms.js";
import { usersForm } from "./admin-users.js";
import { mySeriesForm } from "./my-series.js";
import { karbantartasForm } from "./karbantartas.js";
import { helpForm } from "./help.js";
import { downloadTemplate, handleUpload } from "./excel.js";
import { showIssueChangePopup } from "./changes.js";
import { uploadLiveImage, proposeImage, approveProposal, rejectProposal, setUploadEnabled } from "./component-images.js";
import { reload } from "./data.js";
import { err } from "./modal.js";
import { showApp, loginWithPassword, registerWithPassword, logout, initSession } from "./auth.js";

let imgTarget=null;   // {componentId, mode:"upload"|"propose"} — a rejtett #imgUpl célja

/* ---- fülsáv / szűrők / keresés ---- */
document.getElementById("tabtoggle").addEventListener("click",()=>{ state.tabsOpen=!state.tabsOpen; renderTabs(); applyPickerMode(); syncHeadHeight(); });
document.getElementById("tabnow").addEventListener("click",()=>{ state.tabsOpen=!state.tabsOpen; renderTabs(); applyPickerMode(); syncHeadHeight(); });
document.getElementById("tabs").addEventListener("click",e=>{const b=e.target.closest(".tab");if(!b)return; state.activeIdx=+b.dataset.i; state.costVisible=false; state.costBasis="eredeti"; state.openIssue=null; state.tabsOpen=false; window.scrollTo({top:0}); renderAll();});
document.getElementById("chips").addEventListener("click",e=>{const b=e.target.closest(".chip");if(!b||b.id==="collectedChgBtn")return; state.filter=b.dataset.f; state.openIssue=null; renderChips(); renderList();});
document.getElementById("search").addEventListener("input",e=>{state.query=e.target.value.trim(); state.openIssue=null; renderList();});

/* ---- lista: jelölés, darabszám-léptető, szerkesztés, képsáv ---- */
document.getElementById("list").addEventListener("click",async e=>{
  const chg=e.target.closest("[data-changeissue]");
  if(chg){ const it=S().items.find(x=>x.n===+chg.dataset.changeissue); if(it) showIssueChangePopup(it, S()); return; }

  const exp=e.target.closest(".expander");
  if(exp){ const n=+exp.dataset.exp; state.openIssue=(state.openIssue===n)?null:n; renderList(); return; }

  // Saját adatlap (mindenkinek) — a panel ✎ ikonja
  const pe=e.target.closest("[data-mydata]");
  if(pe){ const it=S().items.find(x=>x.n===+pe.dataset.mydata); if(it) myDataForm(it); return; }

  // +/− darabszám-léptető (a lenyíló panelben)
  const st=e.target.closest(".pstepbtn");
  if(st){
    const it=S().items.find(x=>x.n===+st.dataset.n);
    const comp=it&&findCompById(it,st.dataset.cid); if(!comp||!comp.id) return;
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

  // Kép: staff közvetlen feltöltés/csere, vagy user javaslat — közös rejtett file-inputon át
  const iu=e.target.closest("[data-imgupload]"), ipr=e.target.closest("[data-imgpropose]");
  if(iu||ipr){
    imgTarget={ componentId: iu ? iu.dataset.imgupload : ipr.dataset.imgpropose, mode: iu?"upload":"propose" };
    document.getElementById("imgUpl").click(); return;
  }
  const ia=e.target.closest("[data-imgapprove]"), ir=e.target.closest("[data-imgreject]");
  if(ia||ir){
    const id = ia ? ia.dataset.imgapprove : ir.dataset.imgreject;
    const it=S().items.find(x=>allComps(x).some(c=>c.pending&&c.pending.id===id));
    const comp=it&&allComps(it).find(c=>c.pending&&c.pending.id===id);
    if(!comp) return;
    try{ ia ? await approveProposal(comp.pending) : await rejectProposal(comp.pending); await reload(); }
    catch(e2){ err(e2); }
    return;
  }
  const it2=e.target.closest("[data-imgtoggle]");
  if(it2){ try{ await setUploadEnabled(it2.dataset.imgtoggle, it2.dataset.current!=="1"); await reload(); }catch(e2){ err(e2); } return; }

  const mk=e.target.closest(".mark"); if(!mk||mk.disabled) return;
  const it=S().items.find(x=>x.n===+mk.dataset.n);
  // Több, egyedi Megnevezésű példány esetén a kompakt gomb nem cserélgethető
  // (melyiket?) — koppintásra inkább a panelt nyitja meg (mint az expander).
  if(mk.dataset.multi==="1"){ state.openIssue=(state.openIssue===it.n)?null:it.n; renderAll(); return; }
  const comp=findCompById(it,mk.dataset.cid); if(!comp||!comp.id) return;
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
document.getElementById("a-item").onclick=()=>{ if(!S()){ alert("Előbb válassz ki egy sorozatot a 📚 Sorozataim alatt (vagy javasolj újat)."); return; } itemForm(); };
document.getElementById("a-lists").onclick=listsForm;
document.getElementById("usersBtn").onclick=usersForm;
document.getElementById("mySeriesBtn").onclick=mySeriesForm;
document.getElementById("helpBtn").onclick=helpForm;
document.getElementById("kbToggle").onclick=karbantartasForm;
document.getElementById("a-template").onclick=downloadTemplate;
document.getElementById("a-upload").onclick=()=>document.getElementById("upl").click();
document.getElementById("upl").addEventListener("change",function(){ const f=this.files&&this.files[0]; if(f) handleUpload(f).catch(err); this.value=""; });
document.getElementById("imgUpl").addEventListener("change",async function(){
  const f=this.files&&this.files[0]; this.value="";
  if(!f||!imgTarget) return;
  const {componentId,mode}=imgTarget; imgTarget=null;
  try{
    if(mode==="upload") await uploadLiveImage(componentId,f);
    else await proposeImage(componentId,f);
    await reload();
  }catch(e){ err(e); }
});

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
