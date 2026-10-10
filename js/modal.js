/* ============================================================
   Megosztott modál-primitívek és általános visszajelzés.
   ============================================================ */
export const modal = document.getElementById("modal");
export const sheet = document.getElementById("sheet");

// "locked" — a force-törlés kötelezően nyugtázandó felugró ablakához (2.6):
// háttérre kattintva NEM zárható be, csak a saját OK gombjával.
let locked=false;
export function openModal(html, opts={}){ sheet.innerHTML=html; modal.classList.add("open"); locked=!!opts.locked; }
export function closeModal(){ if(locked) return; modal.classList.remove("open"); }
export function forceCloseModal(){ locked=false; modal.classList.remove("open"); }

// A modál-HTML-ekben van inline onclick="closeModal()", ezért globálisan is elérhető kell legyen.
window.closeModal = closeModal;

modal.addEventListener("click",e=>{ if(e.target===modal) closeModal(); });

// A nyers adatbázis-hibákat (Postgres/PostgREST) érthető, magyar szövegre
// fordítja. Az SQL-függvényeink saját `raise exception` üzenetei (P0001)
// már magyarok és érthetők — azokat változatlanul átengedi.
export function friendlyError(e){
  const code = e && e.code;
  const msg = (e && e.message) || String(e);
  if(code==="23P01" || /exclusion constraint/i.test(msg))
    return "Ez a lapszám már foglalt ebben a sorozatban egy másik, nem törölt Számnál.";
  if(code==="23505" || /duplicate key value/i.test(msg))
    return "Ez az érték már szerepel — nem hoztam létre még egyszer.";
  if(code==="42501" || /row-level security/i.test(msg))
    return "Ehhez a művelethez nincs jogosultságod (vagy a fiókod nem aktív).";
  if(code==="23503" || /foreign key constraint/i.test(msg))
    return "A művelet olyan elemre hivatkozik, ami közben megszűnt — frissítsd az oldalt, és próbáld újra.";
  return msg;
}
export function err(e){ console.error(e); alert("Hiba: "+friendlyError(e)); }

// Egységes "mentés közben" védelem minden mentő/beszúró kezelőhöz (12. pont):
// futás alatt a gomb le van tiltva, és az ismételt kattintás/koppintás
// (dupla kattintás, lassú hálózaton újra-koppintás) nem indít második
// futást. Delegált kezelőnél (nincs egy konkrét gomb) is véd, mert a
// "fut már" jelzés a burkolón belül él, nem a DOM-on.
//   x.onclick = guarded(async ()=>{ ... });
export function guarded(fn){
  let running = false;
  return async function(ev){
    if(running) return;
    running = true;
    const btn = ev && ev.currentTarget;            // await ELŐTT kell kiolvasni
    const canDisable = !!(btn && "disabled" in btn);
    if(canDisable) btn.disabled = true;
    try{ return await fn.call(this, ev); }
    finally{
      running = false;
      if(canDisable && btn.isConnected) btn.disabled = false;
    }
  };
}
