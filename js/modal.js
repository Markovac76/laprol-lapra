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

export function err(e){ alert("Hiba: "+(e.message||e)); }
