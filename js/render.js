/* ============================================================
   Megjelenítés: fülek, hero, szűrők, lista, tapadó fejléc.
   ============================================================ */
import { state, S, COMP_TYPES, todayISO, fmtDate, fmtFt, esc, pad, listName, issueState, hasOwnedComponent } from "./state.js";
import { stats } from "./data.js";
import { showSeriesChangePopup, showIssueChangePopup, showCollectedChanges } from "./changes.js";
import { isStaff } from "./permissions.js";
import { publicUrl, proposedPath } from "./component-images.js";

function setAccent(){ document.documentElement.style.setProperty("--accent",S().accent); }

export function renderTabs(){
  const cur=S();
  const now=document.getElementById("tabnow");
  if(cur){ now.textContent=cur.display||cur.sorozat; now.style.setProperty("--tabc",cur.accent); }
  else { now.textContent="—"; }
  const tog=document.getElementById("tabtoggle");
  tog.textContent = `Sorozatok (${state.SERIES.length}) ` + (state.tabsOpen?"▴":"▾");
  tog.setAttribute("aria-expanded", state.tabsOpen);
  const el=document.getElementById("tabs");
  el.hidden = !state.tabsOpen;
  el.innerHTML=state.SERIES.map((s,i)=>`
    <button class="tab" role="tab" data-i="${i}" aria-selected="${i===state.activeIdx}" style="--tabc:${s.accent}">
      <span class="lbl">${esc(s.display||s.sorozat)}</span>${s.anyChanged?'<span class="chgdot" title="Változás történt">!</span>':""}</button>`).join("");
}

export function renderHero(){
  const s=S(), st=stats(state.activeIdx);
  const bars=s.components.map(t=>{ const p=st.perType[t], pct=p.total?Math.round(p.owned/p.total*100):0;
    return `<div class="prog"><div class="lab"><span>${COMP_TYPES[t]||t}</span><b>${p.owned}/${p.total} · ${pct}%</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>`; }).join("");
  const bottom=st.next
    ? `<div class="stat wide"><div class="k">Következő megjelenés</div><div class="v" style="font-size:14px">${fmtDate(st.next.date)}</div><div class="sub">#${st.next.n} · ${esc(st.next.name||"még nincs cím")}</div></div>`
    : `<div class="stat wide"><div class="k">Beszerzendő szám</div><div class="v">${st.beszerzendo} db</div><div class="sub">hiányzó vagy még jelöletlen</div></div>`;
  const closed = !st.hasFuture ? `<span class="closedtag">lezárt sorozat</span>` : "";
  const fizetettBasis = state.costBasis==="fizetett";
  const total = fizetettBasis ? st.fizetettTotal : st.eredetiTotal;
  const unknown = fizetettBasis ? st.fizetettUnknown : st.eredetiUnknown;
  const basisLabel = fizetettBasis ? "Összeg — fizetett ár alapján" : "Összeg — eredeti ár alapján";
  const unknownBadge = unknown ? `<span class="unknownbadge">+ nem ismert</span>` : "";
  const costBox = state.costVisible
    ? `<div class="stat wide"><div class="k">${basisLabel}</div><div class="v">${fmtFt(total)||"0 Ft"}${unknownBadge}</div>
         <div class="basisrow">
           <button class="basisbtn" data-basis="eredeti" aria-pressed="${!fizetettBasis}">Eredeti ár</button>
           <button class="basisbtn" data-basis="fizetett" aria-pressed="${fizetettBasis}">Fizetett ár</button>
         </div>
         <button class="costbtn" id="costToggle">elrejt</button></div>`
    : `<div class="stat"><div class="k">Összeg</div>
         <button class="costbtn show" id="costToggle">összeg megjelenítése</button></div>`;
  document.getElementById("hero").innerHTML=`
    <div class="kiado">${esc(s.kiado?listName("kiado",s.kiado):"")}${s.changed?`<button class="chgbtn" id="heroChgBtn" title="Mi változott?">!</button>`:""}</div>
    <div class="name display">${esc(s.sorozat)}${closed}</div>
    ${bars}
    <div class="stats">
      ${costBox}
      <div class="stat"><div class="k">Komponensek/szám</div><div class="v">${s.components.map(t=>COMP_TYPES[t]||t).join(" + ")||"—"}</div></div>
      ${bottom}
    </div>`;
  const cb=document.getElementById("costToggle");
  if(cb) cb.onclick=()=>{ state.costVisible=!state.costVisible; renderHero(); };
  document.querySelectorAll(".basisbtn").forEach(b=>{ b.onclick=()=>{ state.costBasis=b.dataset.basis; renderHero(); }; });
  const hcb=document.getElementById("heroChgBtn");
  if(hcb) hcb.onclick=()=>showSeriesChangePopup(s);
}

const FILTERS=[["mind","Mind"],["megvan","Megvan"],["hianyzik","Hiányzik"],["nemkell","Nem kell"],["varhato","Várható"]];
function issueHasStatus(it,s,stt){ return s.components.some(t=>it.comps[t]&&it.comps[t].status===stt); }

export function renderChips(){
  const s=S();
  const c=id=> id==="mind"?s.items.length : id==="varhato"?s.items.filter(it=>it.date&&it.date>=todayISO).length : s.items.filter(it=>issueHasStatus(it,s,id)).length;
  const fl=FILTERS.filter(([id])=>id!=="varhato"||c("varhato")>0);
  if(state.filter==="varhato"&&c("varhato")===0) state.filter="mind";
  const chgBtn = s.anyChanged ? `<button class="chip chgchip" id="collectedChgBtn" title="Összes változás ebben a sorozatban">!</button>` : "";
  document.getElementById("chips").innerHTML=fl.map(([id,l])=>`<button class="chip" data-f="${id}" aria-pressed="${state.filter===id}">${l}<span class="n">${c(id)}</span></button>`).join("")+chgBtn;
  const gb=document.getElementById("collectedChgBtn");
  if(gb) gb.onclick=()=>showCollectedChanges(s);
}

function matches(it){ const s=S();
  if(state.filter==="varhato"){ if(!(it.date&&it.date>=todayISO)) return false; }
  else if(state.filter!=="mind"){ if(!issueHasStatus(it,s,state.filter)) return false; }
  if(state.query){ const q=state.query.toLowerCase(); if(!((it.name&&it.name.toLowerCase().includes(q))||String(it.n)===q)) return false; }
  return true;
}

const ICONS={
  magazin:'<svg viewBox="0 0 24 24"><path d="M4 5h9v14H4z"/><path d="M13 7h7v12h-7"/><path d="M6 8h5M6 11h5M6 14h5"/></svg>',
  modell:'<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>',
  konyv:'<svg viewBox="0 0 24 24"><path d="M5 4h11a2 2 0 012 2v14H7a2 2 0 01-2-2z"/><path d="M5 17h13"/></svg>',
  egyeb:'<svg viewBox="0 0 24 24"><path d="M4 8h16v11H4z"/><path d="M4 8l2-4h12l2 4"/><path d="M12 4v15"/></svg>'
};
const MLAB={megvan:"megvan",hianyzik:"hiány",nemkell:"nem kell"};
const CHEV='<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>';

// Kép feltöltés/csere/javaslás vezérlők egy komponensen — a szerep (staff/user)
// és a jelenlegi állapot (van-e függő javaslat, van-e már élő kép) dönti el.
function imageControlsHtml(c, componentId){
  const staff = isStaff();
  if(c.pending){
    if(staff){
      const thumb = publicUrl(proposedPath(componentId, c.pending.id));
      return `<div class="imgctrl pending">
        <img class="imgthumb" src="${esc(thumb)}" alt="Javasolt kép">
        <div class="modrow"><button class="btn" data-imgapprove="${c.pending.id}">Elfogad</button><button class="btn danger" data-imgreject="${c.pending.id}">Elutasít</button></div>
      </div>`;
    }
    const mine = c.pending.proposed_by===state.myId;
    return `<div class="unote">${mine?"A javaslatod":"Javaslat"} elbírálás alatt.</div>`;
  }
  if(staff){
    const toggle = c.kep_url ? `<button class="imgtogglebtn" data-imgtoggle="${componentId}" data-current="${c.upload_enabled?1:0}">${c.upload_enabled?"🔓 userek javasolhatnak":"🔒 userek nem javasolhatnak"}</button>` : "";
    return `<div class="imgctrl"><button class="imgbtn" data-imgupload="${componentId}">Kép feltöltése/csere</button>${toggle}</div>`;
  }
  if(c.upload_enabled || !c.kep_url){
    return `<div class="imgctrl"><button class="imgbtn" data-imgpropose="${componentId}">${c.kep_url?"Csere javaslása":"Kép javaslása"}</button></div>`;
  }
  return "";
}

export function renderListHead(){
  const s=S();
  document.getElementById("listhead").innerHTML =
    `<span class="lh-left">szám</span>` +
    s.components.map(t=>`<span class="lh-c">${COMP_TYPES[t]||t}</span>`).join("") +
    `<span style="width:34px"></span>`;
}

export function renderList(){
  const s=S(), items=s.items.filter(matches), list=document.getElementById("list");
  if(!items.length){ list.innerHTML=`<div class="empty-state">Nincs a szűrőnek megfelelő szám.</div>`; return; }
  const scode=pad(S().kodSzam||(state.activeIdx+1),3);
  list.innerHTML=items.map(it=>{
    const future=it.date&&it.date>todayISO;
    const istate=issueState(it,s);
    const hasPendingImg = isStaff() && s.components.some(t=>it.comps[t] && it.comps[t].pending);
    const dateHtml=it.date?`<span class="${future?"future":""}">${fmtDate(it.date)}</span>`:`<span style="color:var(--faint)">nincs dátum</span>`;
    const dbTag=(it.besz_menny&&it.besz_menny>1)?`<span class="dbtag">${it.besz_menny} db</span>`:"";
    const eredetiLine = `<span class="money">eredeti ár ${it.eredeti_ar!=null?fmtFt(it.eredeti_ar):"nem ismert"}</span>`;
    const fizetveLine = hasOwnedComponent(it,s) ? `<span class="money">fizetve ${it.fizetett_ar!=null?fmtFt(it.fizetett_ar):"nem ismert"}</span>` : "";
    const moneyBlock = `<div class="imoney">${eredetiLine}${fizetveLine}</div>`;
    // A +/− léptetők a lenyíló panelbe kerültek; a listában csak a darabszám-kijelzés marad az ikonon.
    const marks=s.components.map(t=>{ const c=it.comps[t]||{status:null}; const stt=c.status; const cdb=(c.db==null?1:c.db);
      const showCnt = stt==="megvan" && cdb>1;
      return `<button class="mark${stt?" m-"+stt:""}${showCnt?" has-cnt":""}" data-n="${it.n}" data-t="${t}" ${future?"disabled":""}
        title="${COMP_TYPES[t]||t}${stt?": "+stt:": jelöletlen"}${showCnt?" · "+cdb+" db":""}" aria-label="${COMP_TYPES[t]||t}">
        <span class="mrow">${ICONS[t]||ICONS.egyeb}${showCnt?`<span class="cnt">${cdb}</span>`:""}</span><span class="mlab">${MLAB[stt]||""}</span></button>`;
    }).join("");
    const open = state.openIssue===it.n;
    const panel = open ? `<div class="imgpanel">` + s.components.map((t,ci)=>{
        const c=it.comps[t]||{};
        const cdb=(c.db==null?1:c.db);
        const img=c.kep_url?`<img src="${esc(c.kep_url)}" alt="${COMP_TYPES[t]||t}">`:`nincs adat`;
        // A tényleges darabszám-állítás itt, a panelben — nagyobb, kényelmesen érinthető gombokkal.
        const pstep = !future ? `<div class="pstepper">
          <button class="pstepbtn" data-step="-" data-n="${it.n}" data-t="${t}" aria-label="Kevesebb">−</button>
          <span class="pcount">${cdb} db</span>
          <button class="pstepbtn" data-step="+" data-n="${it.n}" data-t="${t}" aria-label="Több">+</button></div>` : "";
        return `<div class="imgcard"><div class="imgbox">${img}</div>
          <div class="imgcap"><div class="cn">${COMP_TYPES[t]||t}</div>
          <div class="cc">${scode}-${pad(it.n,4)}-${pad(ci+1,2)}</div></div>${pstep}
          ${c.id?imageControlsHtml(c,c.id):""}</div>`;
      }).join("") + `</div>
      <div class="panelmoney">
        <div class="pmrow"><span class="pmk">eredeti ár</span><span class="pmv">${it.eredeti_ar!=null?fmtFt(it.eredeti_ar):"nem ismert"}</span></div>
        <div class="pmrow"><span class="pmk">fizetve</span><span class="pmv">${it.fizetett_ar!=null?fmtFt(it.fizetett_ar):"nem ismert"}</span><button class="pmedit" data-editprice="${it.n}" title="Saját beszerzési adat szerkesztése">✎</button></div>
      </div>` : "";
    return `<div class="issue${istate?" i-"+istate:""}"><div class="ihead">
      <div class="num">#${it.n}${it.changed?`<button class="chgbtn onnum" data-changeissue="${it.n}" title="Mi változott?">!</button>`:""}</div>
      <div class="rmain">
        <div class="ititle ${it.name?"":"empty"}">${esc(it.name||"még nincs cím")}</div>
        <div class="imeta">${dateHtml}${dbTag}<span class="cid">${scode}-${pad(it.n,4)}</span></div>
        ${moneyBlock}
      </div>
      <div class="marks">${marks}
        ${state.adminMode?`<button class="rowedit" data-edit="${it.n}" title="Szerkesztés">✎</button>`:""}
        <button class="expander" data-exp="${it.n}" aria-expanded="${open}" aria-label="Képek">${CHEV}${hasPendingImg?'<span class="chgdot img" title="Függő képjavaslat">📷</span>':""}</button>
      </div>
    </div>${panel}</div>`;
  }).join("");
}

export function syncHeadHeight(){
  const h=document.querySelector("header.top");
  if(h) document.documentElement.style.setProperty("--headh", h.offsetHeight+"px");
}

export function renderAll(){
  if(!state.SERIES.length){ document.getElementById("hero").innerHTML=""; document.getElementById("chips").innerHTML=""; document.getElementById("listhead").innerHTML=""; document.getElementById("list").innerHTML=`<div class="empty-state">Még nincs kiválasztott sorozatod — nyisd meg a „📚 Sorozataim” gombot a fejlécben.</div>`; return; }
  setAccent(); renderTabs(); renderHero(); renderChips(); renderListHead(); renderList(); applyPickerMode(); syncHeadHeight();
}

// Sorozatválasztás közben a tétel-lista és a szűrők elrejtve — csak a választásra fókuszálunk.
export function applyPickerMode(){
  const hide = state.tabsOpen;
  ["listhead","list"].forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display = hide ? "none" : ""; });
  const ctrls=document.querySelector(".controls"); if(ctrls) ctrls.style.display = hide ? "none" : "";
  const hero=document.getElementById("hero"); if(hero) hero.style.display = hide ? "none" : "";
  const adm=document.getElementById("admbar");
  if(adm) adm.style.display = hide ? "none" : (state.adminMode ? "flex" : "none");
}
