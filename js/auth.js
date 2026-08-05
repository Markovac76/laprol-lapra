/* ============================================================
   Bejelentkezés / munkamenet.
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, esc } from "./state.js";
import { loadData } from "./data.js";
import { renderTabs, renderAll } from "./render.js";
import { isStaff } from "./permissions.js";
import { openModal, forceCloseModal } from "./modal.js";

// Force-törlésre jelölt, de a userben még aktívan kiválasztott sorozat(ok) —
// kötelezően nyugtázandó jelzés MINDEN belépéskor, amíg a türelmi idő fut
// (spec 2.6). Háttérre kattintva nem zárható, csak az "Értem" gombbal.
function showForceDeleteWarning(list){
  const rows = list.map(s=>{
    const days = s.fdGraceEnd ? Math.max(0, Math.ceil((new Date(s.fdGraceEnd)-new Date())/86400000)) : null;
    return `<div class="userrow"><div class="uinfo"><div class="uname">${esc(s.display||s.sorozat)}</div>
      <div class="unote">${days!=null && days>0 ? `${days} nap van hátra` : "a türelmi idő lejárt, hamarosan véglegesen törlődhet"}</div></div></div>`;
  }).join("");
  openModal(`<h2>Törlésre jelölt sorozat(ok)</h2>
    <p class="msub">A tulajdonos törlést kezdeményezett az alábbi, nálad jelenleg is kiválasztott sorozato(ko)n. A türelmi idő letelte után véglegesen törlődnek, minden hozzájuk tartozó saját adatoddal együtt — ha meg akarod tartani a jelöléseidet, érdemes időben leválasztanod (📚 Sorozataim).</p>
    ${rows}
    <div class="modrow"><button class="btn" id="fdw-ok">Értem</button></div>`, {locked:true});
  document.getElementById("fdw-ok").onclick=()=>forceCloseModal();
}

export async function showApp(){
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").style.display="block";
  // Ki vagyok + szerep/állapot (members). Letiltott fiók → azonnali kiléptetés, olvasásig sem jut.
  const { data: u } = await supabase.auth.getUser();
  state.myId = u?.user?.id || null;
  const { data: m } = await supabase.from("members").select("role,status").eq("user_id", state.myId).maybeSingle();
  state.role   = m?.role   || "user";
  state.status = m?.status || "active";
  if(state.status === "disabled"){ await supabase.auth.signOut(); showGate("A fiókod fel van függesztve."); return; }
  try{
    await loadData();
    const staff = isStaff();
    document.getElementById("admToggle").style.display = staff ? "" : "none";
    document.getElementById("usersBtn").style.display  = staff ? "" : "none";
    document.getElementById("kbToggle").style.display  = staff ? "" : "none";
    renderTabs(); renderAll();
    const pendingDelete = state.SERIES.filter(s=>s.fdRequestedAt);
    if(pendingDelete.length) showForceDeleteWarning(pendingDelete);
  }
  catch(e){ document.getElementById("list").innerHTML=`<div class="empty-state">Hiba a betöltéskor: ${esc(e.message||e)}</div>`; }
}

export function showGate(msg){
  document.getElementById("app").style.display="none";
  document.getElementById("gate").classList.remove("hidden");
  document.documentElement.style.removeProperty("--accent");   // ne ragadjon rá az utolsó sorozat színe
  if(msg){ const e=document.getElementById("g-err"); if(e){ e.style.color=""; e.textContent=msg; } }
}

export function loginWithPassword(email,password){ return supabase.auth.signInWithPassword({email,password}); }
export function registerWithPassword(email,password){ return supabase.auth.signUp({email,password}); }
export async function logout(){ await supabase.auth.signOut(); showGate(); }

export async function initSession(){ const {data}=await supabase.auth.getSession(); if(data.session) showApp(); }
