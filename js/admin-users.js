/* ============================================================
   Karbantartás — felhasználó-kezelés (members).
   - Staff (admin+owner) látja a listát és letilthat/visszaengedhet
     SIMA felhasználót.
   - Admin-jogot kiosztani/visszavonni CSAK a tulajdonos tud.
   - A tulajdonos sora védett; magadra nem hatsz.
   - MOST CSAK LETILTÁS épül (visszafordítható) — valódi fiók-törlés
     (admin API / Edge Function) tudatosan később.
   Az RLS + a members-trigger szerver-oldalon is kikényszeríti ezeket.
   ============================================================ */
import { supabase, fetchAllRows } from "./supabase.js";
import { state, esc } from "./state.js";
import { openModal, err, sheet } from "./modal.js";
import { isOwnerRole } from "./permissions.js";

function roleBadge(role,status){
  if(status==="disabled") return `<span class="rolebadge disabled">letiltva</span>`;
  const txt = role==="owner"?"tulajdonos":role==="admin"?"admin":"felhasználó";
  return `<span class="rolebadge ${role}">${txt}</span>`;
}

function rowActions(m){
  if(m.role==="owner")           return `<span class="unote">védett</span>`;
  if(m.user_id===state.myId)     return `<span class="unote">te</span>`;
  const owner=isOwnerRole(), disabled=m.status==="disabled", btns=[];
  // Letiltás/visszaengedés: 'user' sort bármelyik staff; 'admin' sort csak owner
  if(m.role==="user" || (m.role==="admin" && owner)){
    btns.push(disabled
      ? `<button data-act="enable" data-id="${m.user_id}">Visszaengedés</button>`
      : `<button class="danger" data-act="disable" data-id="${m.user_id}">Letiltás</button>`);
  }
  // Admin-jog: csak a tulajdonos
  if(owner){
    if(m.role==="user")       btns.push(`<button data-act="promote" data-id="${m.user_id}">Admin-jog megadása</button>`);
    else if(m.role==="admin") btns.push(`<button data-act="demote" data-id="${m.user_id}">Admin-jog visszavonása</button>`);
  }
  return btns.join("") || `<span class="unote">—</span>`;
}

export async function usersForm(){
  openModal(`<h2>Felhasználók</h2><p class="msub">Betöltés…</p>`);
  const { data, error } = await fetchAllRows(()=>supabase.from("members").select("*").order("created_at"));
  if(error){ err(error); return; }
  render(data||[]);
}

function render(members){
  const rows = members.map(m=>{
    const name = m.display_name || (m.user_id.slice(0,8)+"…");
    return `<div class="userrow">
      <div class="uinfo"><div class="uname">${esc(name)}</div><div class="urole">${roleBadge(m.role,m.status)}</div></div>
      <div class="uactions">${rowActions(m)}</div>
    </div>`;
  }).join("");
  openModal(`<h2>Felhasználók</h2>
    <p class="msub">A letiltás visszafordítható. Admin csak sima felhasználót kezelhet; admin-jogot csak a tulajdonos oszthat.</p>
    ${rows||'<p class="msub">Nincs felhasználó.</p>'}
    <div class="modrow"><button class="btn" onclick="closeModal()">Kész</button></div>`);
  sheet.querySelectorAll("[data-act]").forEach(b=>{ b.onclick=()=>handleAction(b.dataset.act, b.dataset.id, members); });
}

async function handleAction(act, id, members){
  const m=members.find(x=>x.user_id===id); if(!m) return;
  const name=m.display_name || (id.slice(0,8)+"…");
  try{
    if(act==="disable"){ if(!confirm(`Letiltod ezt a fiókot: ${name}? (visszafordítható)`)) return;
      const {error}=await supabase.from("members").update({status:"disabled"}).eq("user_id",id); if(error) throw error; }
    else if(act==="enable"){
      const {error}=await supabase.from("members").update({status:"active"}).eq("user_id",id); if(error) throw error; }
    else if(act==="promote"){ if(!confirm(`${name} kap admin jogot?`)) return;
      const {error}=await supabase.from("members").update({role:"admin"}).eq("user_id",id); if(error) throw error; }
    else if(act==="demote"){ if(!confirm(`${name} admin jogát visszavonod?`)) return;
      const {error}=await supabase.from("members").update({role:"user"}).eq("user_id",id); if(error) throw error; }
    await usersForm();   // frissítés a szerverről
  }catch(e){ err(e); }
}
