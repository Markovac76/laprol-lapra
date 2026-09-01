/* ============================================================
   "Újdonságok" — egyszerű, lapozás nélküli lista a mindenkit érintő,
   láthatóan megjelenő változásokról. A tartalom a changelog-content.js-ben
   él, ez a fájl csak a megjelenítés (ugyanaz a minta, mint help.js-nél).
   ============================================================ */
import { esc, fmtDate } from "./state.js";
import { openModal } from "./modal.js";
import { CHANGELOG } from "./changelog-content.js";

export function changelogForm(){
  const items = CHANGELOG.map(e=>`
    <div class="helpqa">
      <div class="helpq">${fmtDate(e.date)}</div>
      <div class="helpa"><p>${esc(e.text)}</p></div>
    </div>`).join("") || `<p class="msub">Még nincs bejegyzés.</p>`;
  openModal(`<h2>Újdonságok</h2>
    <div id="changelog-body" style="margin-top:12px">${items}</div>
    <div class="modrow"><button class="btn" onclick="closeModal()">Bezár</button></div>`);
}
