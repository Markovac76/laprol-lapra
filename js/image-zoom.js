/* ============================================================
   Teljes képernyős képnagyítás — a lenyitott Szám-sor nagy képeire
   (.imgpanel → .imgbox img). Saját elem, NEM a #modal (az alulról nyíló
   lap; annak zárolása és az Újratöltés-ellenőrzés a #modal.open-re épül).
   A már betöltött kép címét mutatja: nincs Supabase-hívás, nincs új adat.
   Bezárás: koppintás bárhová (a képre is), a ✕ gomb, Esc. A böngésző
   „vissza” gombjához nem nyúl (nincs history-kezelés).
   ============================================================ */
let el = null, img = null, cap = null, closeBtn = null, prevFocus = null;

function build(){
  el = document.createElement("div");
  el.className = "imgzoom";
  el.hidden = true;
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-label", "Képnagyítás");
  el.innerHTML = `<button type="button" class="imgzoom-x" aria-label="Bezárás">✕</button>
    <figure class="imgzoom-fig"><img alt=""><figcaption></figcaption></figure>`;
  img = el.querySelector("img");
  cap = el.querySelector("figcaption");
  closeBtn = el.querySelector(".imgzoom-x");
  // Koppintás bárhová — a háttérre, a képre, a feliratra és a ✕-re is — bezár.
  el.addEventListener("click", e => { e.stopPropagation(); closeImageZoom(); });
  document.body.appendChild(el);
}

function onKey(e){
  if(e.key === "Escape"){ e.preventDefault(); closeImageZoom(); }
}

export function openImageZoom(src, caption){
  if(!src) return;
  if(!el) build();
  prevFocus = document.activeElement;
  img.src = src;
  img.alt = caption || "";
  cap.textContent = caption || "";
  cap.hidden = !caption;
  el.hidden = false;
  document.addEventListener("keydown", onKey);
  closeBtn.focus();
}

export function closeImageZoom(){
  if(!el || el.hidden) return;
  el.hidden = true;
  document.removeEventListener("keydown", onKey);
  if(prevFocus && typeof prevFocus.focus === "function" && document.contains(prevFocus)) prevFocus.focus();
  prevFocus = null;
}
