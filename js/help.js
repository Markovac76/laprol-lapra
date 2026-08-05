/* ============================================================
   Súgó (❓) — beépített, kérdés–válasz formátumú dokumentáció.
   Két fül: Felhasználói (mindenkinek) / Adminisztrátori (staff-only,
   az owner-only elemek "(csak owner)" címkével jelölve, nem külön fülön).
   A tartalom a help-content.js-ben él, ez a fájl csak a megjelenítés.
   ============================================================ */
import { esc } from "./state.js";
import { openModal } from "./modal.js";
import { isStaff } from "./permissions.js";
import { HELP_CONTENT } from "./help-content.js";

let currentTab = "user";

export function helpForm(){
  currentTab = "user";
  render();
}

function render(){
  const staff = isStaff();
  const cats = currentTab==="admin" ? HELP_CONTENT.admin : HELP_CONTENT.user;

  const tabsHtml = `<div class="statrow" id="help-tabs">
      <button type="button" data-tab="user" aria-pressed="${currentTab==="user"}">Felhasználói</button>
      ${staff?`<button type="button" data-tab="admin" aria-pressed="${currentTab==="admin"}">Adminisztrátori</button>`:""}
    </div>`;

  const catsHtml = cats.map(cat=>`
    <details class="helpcat"${cat.open?" open":""}>
      <summary>${esc(cat.title)}</summary>
      <div class="helpitems">
        ${cat.items.length ? cat.items.map(it=>`
          <div class="helpqa">
            <div class="helpq">${esc(it.q)}${it.ownerOnly?' <span class="ownertag">(csak owner)</span>':""}</div>
            <div class="helpa">${it.a}</div>
          </div>`).join("") : `<p class="msub">Tartalom hamarosan.</p>`}
      </div>
    </details>`).join("");

  openModal(`<h2>Súgó</h2>
    ${tabsHtml}
    <div id="help-body" style="margin-top:12px">${catsHtml}</div>
    <div class="modrow"><button class="btn" onclick="closeModal()">Bezár</button></div>`);

  document.getElementById("help-tabs").addEventListener("click",e=>{
    const b=e.target.closest("button[data-tab]"); if(!b) return;
    currentTab=b.dataset.tab; render();
  });
}
