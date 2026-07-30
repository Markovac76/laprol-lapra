/* ============================================================
   Bejelentkezés / munkamenet.
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, esc } from "./state.js";
import { loadData } from "./data.js";
import { renderTabs, renderAll } from "./render.js";
import { isStaff } from "./permissions.js";

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
  try{ await loadData(); document.getElementById("admToggle").style.display = isStaff() ? "" : "none"; renderTabs(); renderAll(); }
  catch(e){ document.getElementById("list").innerHTML=`<div class="empty-state">Hiba a betöltéskor: ${esc(e.message||e)}</div>`; }
}

export function showGate(msg){
  document.getElementById("app").style.display="none";
  document.getElementById("gate").classList.remove("hidden");
  if(msg){ const e=document.getElementById("g-err"); if(e){ e.style.color=""; e.textContent=msg; } }
}

export function loginWithPassword(email,password){ return supabase.auth.signInWithPassword({email,password}); }
export function registerWithPassword(email,password){ return supabase.auth.signUp({email,password}); }
export async function logout(){ await supabase.auth.signOut(); showGate(); }

export async function initSession(){ const {data}=await supabase.auth.getSession(); if(data.session) showApp(); }
