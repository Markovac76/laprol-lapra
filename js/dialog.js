/* ============================================================
   Az app saját üzenetablaka (a böngésző szürke alert-ablaka helyett).
   Saját elem, NEM a #modal: a hiba gyakran egy nyitott űrlap fölött jön
   (pl. mentési hiba), és a #modal cseréje elvinné a beírt adatot. Ez az
   ablak a #modal és a képnagyítás fölött jelenik meg, az alatta lévő
   űrlaphoz nem nyúl.
   - showMessage(text, { title }) → Promise, amely az ablak bezárásakor teljesül.
   - Egymás után érkező üzenetek SORBAN jelennek meg (nem csúsznak egymásra).
   - Hozzáférhetőség: role="alertdialog", aria-modal; megnyitáskor a fókusz a
     „Rendben” gombra kerül, bezáráskor visszaáll az előző elemre. Bezárás: a
     gomb, az Esc, a háttérre koppintás.
   - A szöveg textContent-ként kerül be (nem HTML), a sortörések megmaradnak.
   Nincs hálózati hívás, nincs függőség.
   ============================================================ */

// Tiszta (DOM nélküli) rész: soros végrehajtó. A run(item) Promise-t ad; a következő
// elem csak az előző Promise teljesülése (vagy hibája) után indul. Gépi próba: dialog.test.mjs.
export function makeSerialQueue(run){
  let tail = Promise.resolve();
  return item => {
    const p = tail.then(() => run(item));
    tail = p.catch(() => {});
    return p;
  };
}

let el = null, titleEl = null, textEl = null, okBtn = null, closeCurrent = null, prevFocus = null;

function build(){
  el = document.createElement("div");
  el.className = "appdlg";
  el.hidden = true;
  el.innerHTML = `<div class="appdlg-box" role="alertdialog" aria-modal="true" aria-labelledby="appdlg-t" aria-describedby="appdlg-x">
    <h3 class="appdlg-title" id="appdlg-t"></h3>
    <div class="appdlg-text" id="appdlg-x"></div>
    <div class="modrow"><button type="button" class="btn appdlg-ok">Rendben</button></div></div>`;
  titleEl = el.querySelector(".appdlg-title");
  textEl = el.querySelector(".appdlg-text");
  okBtn = el.querySelector(".appdlg-ok");
  okBtn.addEventListener("click", e => { e.stopPropagation(); close(); });
  // Háttérre koppintás: csak a sötét háttér zár, az ablak belseje nem.
  el.addEventListener("click", e => { if(e.target === el) close(); });
  document.body.appendChild(el);
}

// Esc: a capture fázisban fut, és elnyeli az eseményt, hogy az alatta lévő
// elemek (pl. a képnagyítás, egy szerkesztő mező) ne kapják meg.
function onKey(e){
  if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); close(); }
}

function close(){
  if(!closeCurrent) return;
  const done = closeCurrent; closeCurrent = null; done();
}

function present({ text, title }){
  return new Promise(resolve => {
    if(!el) build();
    prevFocus = document.activeElement;
    titleEl.textContent = title;
    textEl.textContent = text;
    el.hidden = false;
    document.addEventListener("keydown", onKey, true);
    okBtn.focus();
    closeCurrent = () => {
      el.hidden = true;
      document.removeEventListener("keydown", onKey, true);
      if(prevFocus && typeof prevFocus.focus === "function" && document.contains(prevFocus)) prevFocus.focus();
      prevFocus = null;
      resolve();
    };
  });
}

const enqueue = makeSerialQueue(present);

export function showMessage(text, { title = "Hiba" } = {}){
  return enqueue({ text: String(text ?? ""), title });
}
