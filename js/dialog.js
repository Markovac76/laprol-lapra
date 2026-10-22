/* ============================================================
   Az app saját üzenet- és kérdésablaka (a böngésző szürke alert / confirm ablaka helyett).
   Saját elem, NEM a #modal: a hiba gyakran egy nyitott űrlap fölött jön
   (pl. mentési hiba), és a #modal cseréje elvinné a beírt adatot. Ez az
   ablak a #modal és a képnagyítás fölött jelenik meg, az alatta lévő
   űrlaphoz nem nyúl.
   - showMessage(text, { title }) → Promise, amely az ablak bezárásakor teljesül.
   - askConfirm(text, { title, okLabel, cancelLabel, danger }) → Promise<boolean>: igaz csak az
     OK gombra; Mégse, Esc, háttér: hamis. danger: az OK piros, a fókusz a Mégse gombon.
   - Az üzenetek és a kérdések közös SORBAN jelennek meg (nem csúsznak egymásra).
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

let el = null, titleEl = null, textEl = null, okBtn = null, cancelBtn = null, closeCurrent = null, prevFocus = null;

function build(){
  el = document.createElement("div");
  el.className = "appdlg";
  el.hidden = true;
  el.innerHTML = `<div class="appdlg-box" role="alertdialog" aria-modal="true" aria-labelledby="appdlg-t" aria-describedby="appdlg-x">
    <h3 class="appdlg-title" id="appdlg-t"></h3>
    <div class="appdlg-text" id="appdlg-x"></div>
    <div class="modrow"><button type="button" class="btn appdlg-cancel">Mégse</button><button type="button" class="btn appdlg-ok">Rendben</button></div></div>`;
  titleEl = el.querySelector(".appdlg-title");
  textEl = el.querySelector(".appdlg-text");
  okBtn = el.querySelector(".appdlg-ok");
  cancelBtn = el.querySelector(".appdlg-cancel");
  okBtn.addEventListener("click", e => { e.stopPropagation(); close(true); });
  cancelBtn.addEventListener("click", e => { e.stopPropagation(); close(false); });
  // Háttérre koppintás: csak a sötét háttér zár (megerősítésnél „Mégse”), az ablak belseje nem.
  el.addEventListener("click", e => { if(e.target === el) close(false); });
  document.body.appendChild(el);
}

// Esc: a capture fázisban fut, és elnyeli az eseményt, hogy az alatta lévő
// elemek (pl. a képnagyítás, egy szerkesztő mező) ne kapják meg. Megerősítésnél „Mégse”.
function onKey(e){
  if(e.key === "Escape"){ e.preventDefault(); e.stopPropagation(); close(false); }
}

function close(result){
  if(!closeCurrent) return;
  const done = closeCurrent; closeCurrent = null; done(result === true);
}

// Egy megjelenítés: kind = "message" (egy gomb, „Rendben”) vagy "confirm" (Mégse + OK).
// A két mód közti állapot (gombok, feliratok, piros szín, fókusz) minden megnyitáskor újra beáll.
function present({ kind, text, title, okLabel, cancelLabel, danger }){
  return new Promise(resolve => {
    if(!el) build();
    const ask = kind === "confirm";
    prevFocus = document.activeElement;
    titleEl.textContent = title;
    textEl.textContent = text;
    okBtn.textContent = ask ? okLabel : "Rendben";
    okBtn.classList.toggle("danger", ask && !!danger);
    cancelBtn.textContent = cancelLabel || "Mégse";
    cancelBtn.hidden = !ask;
    el.hidden = false;
    document.addEventListener("keydown", onKey, true);
    // Alapértelmezett fókusz: törlésnél a Mégse (egy véletlen Enter ne töröljön), különben az OK.
    (ask && danger ? cancelBtn : okBtn).focus();
    closeCurrent = ok => {
      el.hidden = true;
      document.removeEventListener("keydown", onKey, true);
      if(prevFocus && typeof prevFocus.focus === "function" && document.contains(prevFocus)) prevFocus.focus();
      prevFocus = null;
      resolve(ask ? ok : undefined);
    };
  });
}

// A hibaüzenetek és a megerősítő kérdések KÖZÖS sorban jelennek meg: egy kérdés
// nem csúszik rá egy nyitott hibaablakra, és fordítva.
const enqueue = makeSerialQueue(present);

export function showMessage(text, { title = "Hiba" } = {}){
  return enqueue({ kind: "message", text: String(text ?? ""), title });
}

// „Biztosan?” kérdés az app saját ablakában. Promise<boolean>: igaz CSAK az OK gombra;
// Mégse, Esc és a háttérre koppintás: hamis. `danger`: törlés — az OK piros, a fókusz a Mégse-n.
export function askConfirm(text, { title = "Biztosan?", okLabel = "Rendben", cancelLabel = "Mégse", danger = false } = {}){
  return enqueue({ kind: "confirm", text: String(text ?? ""), title, okLabel, cancelLabel, danger: !!danger });
}
