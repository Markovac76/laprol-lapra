/* ============================================================
   Bejelentkezés / munkamenet.
   ============================================================ */
import { supabase } from "./supabase.js";
import { esc } from "./state.js";
import { loadData } from "./data.js";
import { renderTabs, renderAll } from "./render.js";
import { isStaff } from "./permissions.js";

export async function showApp(){
  document.getElementById("gate").classList.add("hidden");
  document.getElementById("app").style.display="block";
  try{ await loadData(); document.getElementById("admToggle").style.display = isStaff() ? "" : "none"; renderTabs(); renderAll(); }
  catch(e){ document.getElementById("list").innerHTML=`<div class="empty-state">Hiba a betöltéskor: ${esc(e.message||e)}</div>`; }
}

export function showGate(){ document.getElementById("app").style.display="none"; document.getElementById("gate").classList.remove("hidden"); }

export function loginWithPassword(email,password){ return supabase.auth.signInWithPassword({email,password}); }
export function registerWithPassword(email,password){ return supabase.auth.signUp({email,password}); }
export async function logout(){ await supabase.auth.signOut(); showGate(); }

export async function initSession(){ const {data}=await supabase.auth.getSession(); if(data.session) showApp(); }
