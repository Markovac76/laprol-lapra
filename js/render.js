/* ============================================================
   Megjelenítés: fülek, hero, szűrők, lista, tapadó fejléc.
   ============================================================ */
import { state, S, COMP_TYPES, todayISO, fmtDate, fmtFt, esc, pad, listName, issueState, hasOwnedComponent, compsOfType, worstStatus } from "./state.js";
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

  // Csoportosítás kategória (témakör) szerint, a listatár sort_order-je
  // szerinti sorrendben — a kategória nélküli (vagy törölt kategóriájú)
  // sorozatok egy "Egyéb" csoportba kerülnek, a végén.
  const catOrder = (state.LISTS.kategoria||[]).map(o=>o.ertek);
  const groups = {}; const groupKeys = [];
  state.SERIES.forEach((s,i)=>{
    const key = (s.kategoria && catOrder.includes(s.kategoria)) ? s.kategoria : "__egyeb";
    if(!groups[key]){ groups[key]=[]; groupKeys.push(key); }
    groups[key].push(i);
  });
  groupKeys.sort((a,b)=>{
    const ia = a==="__egyeb" ? catOrder.length : catOrder.indexOf(a);
    const ib = b==="__egyeb" ? catOrder.length : catOrder.indexOf(b);
    return ia-ib;
  });

  el.innerHTML = groupKeys.map(key=>{
    const label = key==="__egyeb" ? "Egyéb" : listName("kategoria", key);
    const items = groups[key].map(i=>{ const s=state.SERIES[i];
      return `<button class="tab" role="tab" data-i="${i}" aria-selected="${i===state.activeIdx}" style="--tabc:${s.accent}">
        <span class="lbl">${esc(s.display||s.sorozat)}</span>${s.anyChanged?'<span class="chgdot" title="Változás történt">!</span>':""}</button>`;
    }).join("");
    return `<div class="tabgroup"><div class="tabgroup-label">${esc(label)}</div><div class="tabgroup-items">${items}</div></div>`;
  }).join("");
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
  // Sorozat-szintű borítókép (az 1-es szám előtti ingyenes bemutató-
  // füzethez) — tisztán vizuális/referencia mező, NEM Szám, sehol nem
  // számít bele darabszám/százalék-számításba. Ugyanaz a workflow, mint a
  // komponens-képeknél (imageControlsHtml, "series" típussal).
  const coverEntity = { kep_url: s.borito_url||null, upload_enabled: !!s.borito_upload_enabled, pending: s.pendingBorito||null };
  const coverImg = s.borito_url ? `<img src="${esc(s.borito_url)}" alt="Borítókép">` : `<span class="herocover-ph">📷</span>`;
  const heroCover = `<div class="herocoverwrap">
      <div class="herocover${s.borito_url?"":" empty"}">${coverImg}</div>
      ${imageControlsHtml("series", coverEntity, s.id)}
    </div>`;
  document.getElementById("hero").innerHTML=`
    <div class="herohead">
      ${heroCover}
      <div class="herotext">
        <div class="kiado">${esc(s.kiado?listName("kiado",s.kiado):"")}${s.changed?`<button class="chgbtn" id="heroChgBtn" title="Mi változott?">!</button>`:""}</div>
        <div class="name display">${esc(s.sorozat)}${closed}</div>
      </div>
    </div>
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
function issueHasStatus(it,s,stt){ return s.components.some(t=>compsOfType(it,t).some(c=>c.status===stt)); }

export function renderChips(){
  const s=S(); const activeItems=s.items.filter(it=>!it.deleted);
  const c=id=> id==="mind"?activeItems.length : id==="varhato"?activeItems.filter(it=>it.date&&it.date>=todayISO).length : activeItems.filter(it=>issueHasStatus(it,s,id)).length;
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

// Kép feltöltés/csere/javaslás vezérlők egy komponensen VAGY egy sorozat-
// szintű borítóképen (type: "component"|"series") — a szerep (staff/user)
// és a jelenlegi állapot (van-e függő javaslat, van-e már élő kép) dönti
// el, melyik gomb(ok) jelenjenek meg. `c` egységes alakú: {kep_url,
// upload_enabled, pending} — sorozat-borítónál a hívó adja át így
// leképezve (borito_url→kep_url stb.), hogy ez a függvény ne tudjon a
// mező-nevek eltéréséről.
function imageControlsHtml(type, c, entityId){
  const staff = isStaff();
  const t = type==="series" ? ` data-enttype="series"` : "";
  if(c.pending){
    if(staff){
      const thumb = publicUrl(proposedPath(type, entityId, c.pending.id));
      return `<div class="imgctrl pending">
        <img class="imgthumb" src="${esc(thumb)}" alt="Javasolt kép">
        <div class="modrow"><button class="btn" data-imgapprove="${c.pending.id}"${t}>Elfogad</button><button class="btn danger" data-imgreject="${c.pending.id}"${t}>Elutasít</button></div>
      </div>`;
    }
    const mine = c.pending.proposed_by===state.myId;
    return `<div class="unote">${mine?"A javaslatod":"Javaslat"} elbírálás alatt.</div>`;
  }
  if(staff){
    const toggle = c.kep_url ? `<button class="imgtogglebtn" data-imgtoggle="${entityId}"${t} data-current="${c.upload_enabled?1:0}">${c.upload_enabled?"🔓 userek javasolhatnak":"🔒 userek nem javasolhatnak"}</button>` : "";
    const del = c.kep_url ? `<button class="imgtogglebtn danger" data-imgdelete="${entityId}"${t}>🗑 Kép törlése</button>` : "";
    return `<div class="imgctrl"><button class="imgbtn" data-imgupload="${entityId}"${t}>Kép feltöltése/csere</button>${toggle}${del}</div>`;
  }
  if(c.upload_enabled || !c.kep_url){
    return `<div class="imgctrl"><button class="imgbtn" data-imgpropose="${entityId}"${t}>${c.kep_url?"Csere javaslása":"Kép javaslása"}</button></div>`;
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
  const s=S(), list=document.getElementById("list");
  // Törölt tétel a szűrőtől/kereséstől függetlenül mindig látszik, amíg el nem
  // fogadja a user a törlés-jelzést (a felkiáltójel innen nyitható) — utána
  // véglegesen eltűnik a nézetből.
  const items=s.items.filter(it=> it.deleted ? it.changed : matches(it));
  if(!items.length){ list.innerHTML=`<div class="empty-state">Nincs a szűrőnek megfelelő szám.</div>`; return; }
  const scode=pad(S().kodSzam||(state.activeIdx+1),3);
  list.innerHTML=items.map(it=>{
    if(it.deleted){
      return `<div class="issue issue-deleted"><div class="ihead">
        <div class="num">#${it.n}</div>
        <div class="rmain">
          <div class="ititle" style="text-decoration:line-through;color:var(--faint)">${esc(it.name||"nincs cím")}</div>
          <div class="imeta" style="color:#f3b6b6">Ez a szám törölve lett a sorozatból.</div>
        </div>
        <div class="marks"><button class="chgbtn" data-changeissue="${it.n}" title="Részletek / elfogadás">!</button></div>
      </div></div>`;
    }
    const future=it.date&&it.date>todayISO;
    const istate=issueState(it,s);
    const hasPendingImg = isStaff() && s.components.some(t=>compsOfType(it,t).some(c=>c.pending));
    const dateHtml=it.date?`<span class="${future?"future":""}">${fmtDate(it.date)}</span>`:`<span style="color:var(--faint)">nincs dátum</span>`;
    const dbTag=(it.besz_menny&&it.besz_menny>1)?`<span class="dbtag">${it.besz_menny} db</span>`:"";
    const eredetiLine = `<span class="money">eredeti ár ${it.eredeti_ar!=null?fmtFt(it.eredeti_ar):"nem ismert"}</span>`;
    const fizetveLine = hasOwnedComponent(it,s) ? `<span class="money">fizetve ${it.fizetett_ar!=null?fmtFt(it.fizetett_ar):"nem ismert"}</span>` : "";
    const moneyBlock = `<div class="imoney">${eredetiLine}${fizetveLine}</div>`;
    // A +/− léptetők a lenyíló panelbe kerültek; a listában csak a darabszám-kijelzés marad az ikonon.
    // Ha egy típusból egy Számon TÖBB, egyedi Megnevezésű példány van, a kompakt
    // gomb koppintással már nem cserélgethető (melyiket?) — helyette összesített,
    // "legrosszabb eset" jelvényt mutat, és a panelt nyitja meg a részletekhez.
    const marks=s.components.map(t=>{
      const inst=compsOfType(it,t); const multi=inst.length>1;
      const c=inst[0]||{status:null}; const cdb=(c.db==null?1:c.db);
      const stt = multi ? worstStatus(inst) : c.status;
      const showCnt = !multi && stt==="megvan" && cdb>1;
      const countTag = multi ? `<span class="cnt">×${inst.length}</span>` : (showCnt?`<span class="cnt">${cdb}</span>`:"");
      const title = multi
        ? `${COMP_TYPES[t]||t}: ${inst.length} példány — legrosszabb eset: ${stt?MLAB[stt]:"jelöletlen"}`
        : `${COMP_TYPES[t]||t}${stt?": "+stt:": jelöletlen"}${showCnt?" · "+cdb+" db":""}`;
      const idAttr = multi ? `data-multi="1"` : `data-cid="${c.id||""}"`;
      return `<button class="mark${stt?" m-"+stt:""}${(showCnt||multi)?" has-cnt":""}" data-n="${it.n}" data-t="${t}" ${idAttr} ${future?"disabled":""}
        title="${title}" aria-label="${COMP_TYPES[t]||t}">
        <span class="mrow">${ICONS[t]||ICONS.egyeb}${countTag}</span><span class="mlab">${multi?"részletek":(MLAB[stt]||"")}</span></button>`;
    }).join("");
    const open = state.openIssue===it.n;
    // A panel a Számon TÉNYLEGESEN meglévő komponens-PÉLDÁNYOKAT listázza (nem a
    // deklarált típusokat) — egy típusból több példány is saját kártyát kap, a
    // Megnevezésével (vagy "Típus #N" eséssel, ha nincs kitöltve és 1-nél több van).
    const flat = s.components.flatMap(t=>compsOfType(it,t).map(c=>({t,c})));
    const typeCounts={}; flat.forEach(({t})=>{ typeCounts[t]=(typeCounts[t]||0)+1; });
    const typeSeen={};
    const panel = open ? `<div class="imgpanel">` + flat.map(({t,c},ci)=>{
        const cdb=(c.db==null?1:c.db);
        typeSeen[t]=(typeSeen[t]||0)+1;
        const label = c.megnevezes ? esc(c.megnevezes) : (typeCounts[t]>1 ? `${COMP_TYPES[t]||t} #${typeSeen[t]}` : (COMP_TYPES[t]||t));
        const img=c.kep_url?`<img src="${esc(c.kep_url)}" alt="${COMP_TYPES[t]||t}">`:`nincs adat`;
        // Magazin/Könyv szinte mindig álló (portré) borító — ezeknél a doboz
        // magasabb/keskenyebb, hogy a teljes borító (cím, kiadói logó is)
        // beleférjen levágás nélkül. A többi típusnál a doboz alakja marad.
        const boxClass = (t==="magazin"||t==="konyv") ? "imgbox tall" : "imgbox";
        // A tényleges darabszám-állítás itt, a panelben — nagyobb, kényelmesen érinthető gombokkal.
        const pstep = !future ? `<div class="pstepper">
          <button class="pstepbtn" data-step="-" data-n="${it.n}" data-cid="${c.id}" aria-label="Kevesebb">−</button>
          <span class="pcount">${cdb} db</span>
          <button class="pstepbtn" data-step="+" data-n="${it.n}" data-cid="${c.id}" aria-label="Több">+</button></div>` : "";
        // Ugyanaz a .mark gomb/logika, mint a kompakt sorban — itt PÉLDÁNYONKÉNT
        // külön, mert a kompakt gomb 2+ példánynál a panelt nyitja (nem ciklizál).
        const statusBtn = !future ? `<button class="mark block${c.status?" m-"+c.status:""}" data-n="${it.n}" data-cid="${c.id}" aria-label="Státusz">
          <span class="mlab">${c.status?MLAB[c.status]:"jelöletlen"}</span></button>` : "";
        return `<div class="imgcard"><div class="${boxClass}">${img}</div>
          <div class="imgcap"><div class="cn">${label}</div>
          <div class="cc">${scode}-${pad(it.n,4)}-${pad(ci+1,2)}</div></div>${pstep}${statusBtn}
          ${c.id?imageControlsHtml("component",c,c.id):""}</div>`;
      }).join("") + `</div>
      <div class="panelmoney">
        <div class="pmrow"><span class="pmk">eredeti ár</span><span class="pmv">${it.eredeti_ar!=null?fmtFt(it.eredeti_ar):"nem ismert"}</span></div>
        <div class="pmrow"><span class="pmk">fizetve</span><span class="pmv">${it.fizetett_ar!=null?fmtFt(it.fizetett_ar):"nem ismert"}</span><button class="pmedit" data-mydata="${it.n}" title="Saját adatlap (státusz, darabszám, jegyzet, ár)">✎</button></div>
      </div>` : "";
    return `<div class="issue${istate?" i-"+istate:""}"><div class="ihead">
      <div class="num">#${it.n}${it.changed?`<button class="chgbtn onnum" data-changeissue="${it.n}" title="Mi változott?">!</button>`:""}</div>
      <div class="rmain">
        <div class="ititle ${it.name?"":"empty"}">${esc(it.name||"még nincs cím")}</div>
        <div class="imeta">${dateHtml}${dbTag}<span class="cid">${scode}-${pad(it.n,4)}</span></div>
        ${moneyBlock}
      </div>
      <div class="marks">${marks}
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
