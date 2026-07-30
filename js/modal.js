/* ============================================================
   Megosztott modál-primitívek és általános visszajelzés.
   ============================================================ */
export const modal = document.getElementById("modal");
export const sheet = document.getElementById("sheet");

export function openModal(html){ sheet.innerHTML=html; modal.classList.add("open"); }
export function closeModal(){ modal.classList.remove("open"); }

// A modál-HTML-ekben van inline onclick="closeModal()", ezért globálisan is elérhető kell legyen.
window.closeModal = closeModal;

modal.addEventListener("click",e=>{ if(e.target===modal) closeModal(); });

export function err(e){ alert("Hiba: "+(e.message||e)); }
