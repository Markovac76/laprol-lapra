/* ============================================================
   Draft tételek (szám + komponens) egy claim-elt draft_series-en
   belül — a Karbantartás "Szerkesztés" nézetének beágyazott listája.
   Csak törzsadat-mezők — nincs személyes réteg, a draft publikálás
   előtti állapot, még senkinek nincs rajta saját adata.

   Egy típusból TÖBB, egyedi Megnevezésű példány is felvehető (pl. két
   különböző Lego-csomag) — ezért a `comps` mindig FLAT tömb (nem
   típusonkénti map), soha nem dedupelünk típus szerint.
   ============================================================ */
import { supabase, fetchAllRows } from "./supabase.js";
import { state, COMP_TYPES, esc, fmtDate, listName } from "./state.js";
import { openModal, sheet, err, guarded } from "./modal.js";
import { initialComponents } from "./component-template.js";
import { typeDef, idMode, masterFields, extraFields, isRequired, defaultIdType } from "./type-defs.js";

const typeLabel = t => listName("komponens", t) || COMP_TYPES[t] || t;

export async function fetchDraftItems(draftSeriesId){
  const { data: issues, error: ie } = await fetchAllRows(()=>supabase.from("draft_issues")
    .select("*").eq("draft_series_id", draftSeriesId).order("lapszam"));
  if(ie) throw ie;
  const issueIds = (issues||[]).map(x=>x.id);
  let comps=[];
  if(issueIds.length){
    // A "több azonos típusú komponens" funkció óta ez könnyebben átlépheti a
    // 1000-es alapértelmezett Supabase-limitet egy nagy sorozat draftjánál.
    const { data, error: ce } = await fetchAllRows(()=>supabase.from("draft_components").select("*").in("draft_issue_id", issueIds));
    if(ce) throw ce;
    comps = data||[];
  }
  return (issues||[]).map(it=>({...it, comps: comps.filter(c=>c.draft_issue_id===it.id)}));
}

export function renderDraftItemsList(items){
  if(!items.length) return `<p class="msub">Még nincs szám a draftban.</p>`;
  return items.map(it=>{
    const compsTxt = (it.comps||[]).map(c=>
      `${c.deleted?"<s>":""}${typeLabel(c.tipus)}${c.megnevezes?" — "+esc(c.megnevezes):""}${c.azonosito?": "+esc(c.azonosito):""}${c.deleted?" (törölve)</s>":""}`
    ).join(" · ");
    return `<div class="userrow"><div class="uinfo">
        <div class="uname">#${it.lapszam}${it.cim?" – "+esc(it.cim):""}</div>
        <div class="unote">${it.megjelenes?fmtDate(it.megjelenes):"nincs dátum"}${it.eredeti_ar!=null?" · "+it.eredeti_ar+" Ft":""}</div>
        <div class="unote">${compsTxt}</div>
        ${it.deleted?'<div class="unote" style="color:#f3b6b6">🗑️ törlésre jelölve publikáláskor</div>':""}
      </div>
      <div class="uactions"><button data-diedit="${it.id}">Szerkesztés</button></div>
    </div>`;
  }).join("");
}

let tmpSeq=0;
const keyOf = c => c.id || c._tmpKey;
const idTypeName = v => listName("azonosito", v) || v;
const REQ = `<span class="reqmark" title="Kötelező">*</span>`;

// Egy komponens mezői a TÍPUSLEÍRÁS szerint (component_type_defs): a típus saját mezői
// (pl. Kártya: Gyártó, Gyűjtemény…), a név / megnevezés, és az azonosító a típus szabálya
// szerinti azonosító-típussal — fix típusnál nem szerkeszthető, a kiadvány családnál
// (Magazin, Könyv) ISBN / ISSN választó, „nincs” szabálynál (Figura, Modell) nincs azonosító.
function typeFieldsHtml(c, k, t, multi){
  const def = typeDef(state.TYPEDEFS, t);
  const { mode, types } = idMode(def);
  const fields = masterFields(def);
  const html = fields.map(f=>{
    const req = isRequired(f) ? " "+REQ : "";
    if(f.key==="megnevezes"){
      const hint = isRequired(f) ? ""
        : (f.potlas==="szam_cime" ? `— ha üres, a Szám címe számít névnek`
                                  : `— ha üres, "${esc(typeLabel(t))}${multi?" #N":""}" jelenik meg`);
      return `<div class="field"><label>${esc(f.label)}${req}${isRequired(f)?"":" (opcionális)"} <span style="color:var(--faint);font-weight:400">${hint}</span></label>
        <input id="di-name-${k}" value="${esc(c.megnevezes||"")}"${f.potlas==="szam_cime"?"":' placeholder="pl. Star Wars minifigura-csomag"'}></div>`;
    }
    if(f.key==="azonosito"){
      if(mode==="nincs") return "";
      let typeCell;
      if(mode==="fix"){
        typeCell = `<div class="field"><label>Azonosító típusa</label><input value="${esc(idTypeName(types[0]))}" disabled title="Ennél a típusnál rögzített"></div>`;
      } else {
        const allowed = mode==="valaszthato" ? (state.LISTS.azonosito||[]).filter(o=>types.includes(o.ertek)) : (state.LISTS.azonosito||[]);
        const cur = c.azonosito_tipus||"";
        const stray = cur && !allowed.some(o=>o.ertek===cur) ? `<option value="${esc(cur)}" selected>${esc(idTypeName(cur))} (itt nem megengedett)</option>` : "";
        typeCell = `<div class="field"><label>Azonosító típusa</label><select id="di-ct-${k}" data-deftype="${esc(mode==="valaszthato"?(def.default_azonosito_tipus||""):"")}">
          <option value="">${mode==="valaszthato"?"— válassz —":"—"}</option>${stray}${allowed.map(o=>`<option value="${esc(o.ertek)}"${o.ertek===cur?" selected":""}>${esc(o.nev)}</option>`).join("")}</select></div>`;
      }
      return `<div class="grid2">${typeCell}
        <div class="field"><label>${esc(f.label)}${req}</label><input id="di-cid-${k}" data-ct="di-ct-${k}" value="${esc(c.azonosito||"")}"></div></div>`;
    }
    const v = c.adatok && c.adatok[f.key]!=null ? c.adatok[f.key] : "";
    return `<!--x--><div class="field"><label>${esc(f.label)}${req}</label><input id="di-x-${esc(f.key)}-${k}"${f.kind==="egesz"?' type="number"':""} value="${esc(v)}"></div>`;
  }).reduce((acc, h)=>{     // a típus saját mezői kettesével egy sorba
    if(h.startsWith("<!--x-->")){ const last=acc[acc.length-1]; if(last && last.x && last.items.length<2) last.items.push(h); else acc.push({x:true, items:[h]}); }
    else acc.push({x:false, items:[h]});
    return acc;
  }, []).map(g=>g.x ? `<div class="grid2">${g.items.join("")}</div>` : g.items[0]).join("");
  const anyReq = fields.some(isRequired);
  return html + (anyReq ? `<div class="unote">${REQ} kötelező mező — új vagy módosított elemnél nélküle a „Kész” megáll.</div>` : "");
}

export function draftItemForm(draftSeriesId, existing, components, onDone, template = null){
  // Munka-másolat: a `comps` itt egy FLAT tömb (session-only, még nem mentett
  // "+ Még egy X" példányokkal bővíthető) — csak Mentéskor kerül a DB-be.
  let comps = existing ? (existing.comps||[]).map(c=>({...c}))
    : (Array.isArray(template) && template.length
        // ÚJ Szám: a sorozat komponens-sablonjának KÖTELEZŐ típusai, az alapértelmezett
        // azonosító-típussal / megnevezéssel; a fő elem a sablon fő típusa
        ? initialComponents(template).map(c=>({...c, _tmpKey:"tmp"+(tmpSeq++)}))
        : components.map(t=>({tipus:t, azonosito_tipus:null, azonosito:"", megnevezes:"", _tmpKey:"tmp"+(tmpSeq++)})));
  // Új tételnél az azonosítót az űrlap megnyitásakor generáljuk (nem kattintásonként):
  // egy dupla mentés így ugyanazzal az elsődleges kulccsal próbálkozik, és a
  // másodikat az adatbázis utasítja el — nem keletkezik két azonos tétel.
  const newIssueId = existing ? null : crypto.randomUUID();
  // A megnyitáskori azonosító / azonosító-típus: a típus szerinti szabályt (fix típus, ISBN / ISSN
  // választás) csak az ÚJ és az itt MÓDOSÍTOTT azonosítóra alkalmazzuk — a változatlan meglévő
  // komponenshez nem nyúlunk (különben a puszta mentés is módosítaná, és felkiáltójelet adna).
  comps.forEach(c=>{ if(c.id) c._orig = { az:(c.azonosito||"").trim(), at:(c.azonosito_tipus||"").trim() }; });
  // FŐ ELEM (★): egy Számon pontosan egy komponens. Kezdetben a jelölt (is_main), ennek
  // hiányában a tartalék szabály: magazin, könyv, első (megegyezik a szerver-oldalival).
  const pickMainKey = list0 => {
    const list = list0.filter(c=>!c.deleted);          // törölt komponens nem lehet fő elem
    const m = list.find(c=>c.is_main) || list.find(c=>c.tipus==="magazin") || list.find(c=>c.tipus==="konyv") || list[0];
    return m ? keyOf(m) : null;
  };
  let mainKey = pickMainKey(comps);
  let savedIssueId = existing ? existing.id : null;   // egy félbemaradt mentés újrapróbálásakor már nem beszúrás, hanem frissítés
  let master = { lapszam: existing?existing.lapszam:"", cim: existing?(existing.cim||""):"", megjelenes: existing?(existing.megjelenes||""):"",
    eredeti_ar: existing&&existing.eredeti_ar!=null?existing.eredeti_ar:"", deleted: existing?!!existing.deleted:false };

  function syncFromDom(){
    const v=id=>{const e=document.getElementById(id); return e?e.value:null;};
    if(document.getElementById("di-n")!=null){
      master.lapszam=v("di-n"); master.cim=v("di-name"); master.megjelenes=v("di-date"); master.eredeti_ar=v("di-eredeti");
      const delCk=document.getElementById("di-deleted"); if(delCk) master.deleted=delCk.checked;
    }
    const mainRadio = document.querySelector('input[name="di-main"]:checked');
    if(mainRadio) mainKey = mainRadio.value;
    comps.forEach(c=>{
      const k=keyOf(c);
      const nameEl=document.getElementById("di-name-"+k); if(nameEl) c.megnevezes=nameEl.value;
      const idtEl=document.getElementById("di-ct-"+k); if(idtEl) c.azonosito_tipus=idtEl.value;
      const idEl=document.getElementById("di-cid-"+k); if(idEl) c.azonosito=idEl.value;
      // a típus saját mezői (az `adatok`-ba): az üres érték kulcsa kimarad
      extraFields(typeDef(state.TYPEDEFS, c.tipus)).forEach(f=>{
        const el=document.getElementById(`di-x-${f.key}-${k}`); if(!el) return;
        const raw=el.value.trim(); const a={...(c.adatok||{})};
        if(raw==="") delete a[f.key];
        else a[f.key] = f.kind==="egesz" && /^-?\d+$/.test(raw) ? parseInt(raw,10) : raw;
        c.adatok=a;
      });
      const typeEl=document.getElementById("di-type-"+k); if(typeEl) c.tipus=typeEl.value;
    });
  }

  function draw(){
    const byType={}; comps.forEach(c=>{ (byType[c.tipus]=byType[c.tipus]||[]).push(c); });
    // Megjelenő típus-sorrend: a deklarált komponens-lista, majd bármi extra
    // (pl. átsorolással bekerült) típus a végén.
    const slotTypes = Array.from(new Set([...components, ...comps.map(c=>c.tipus)]));
    const compBlocks = slotTypes.map(t=>{
      const list=byType[t]||[];
      const activeInType = list.filter(x=>!x.deleted);
      const blocks=list.map((c,idx)=>{
        const k=keyOf(c);
        if(c.deleted){
          return `<div class="compedit compdeleted">
            <h4><s>${esc(typeLabel(t))}${c.megnevezes?" — "+esc(c.megnevezes):""}</s> <span class="unote">(törölve)</span></h4>
            <div class="unote">Publikáláskor eltűnik a Számról. A hozzá tartozó személyes jelölések megmaradnak, a törlés visszavonható.</div>
            <button type="button" class="btn ghost" data-restorecomp="${k}">Törlés visszavonása</button>
          </div>`;
        }
        const canRetype = !!c.id;   // csak már mentett (élő párral vagy anélkül perzisztált) példány sorolható át
        const typeOpts = canRetype ? (state.LISTS.komponens||[]).map(o=>`<option value="${esc(o.ertek)}"${o.ertek===c.tipus?" selected":""}>${esc(o.nev)}</option>`).join("") : "";
        return `<div class="compedit">
          <h4>${esc(typeLabel(t))}${activeInType.length>1?` #${idx+1}`:""}</h4>
          ${canRetype?`<div class="field"><label>Típus (utólagos átsorolás)</label><select id="di-type-${k}">${typeOpts}</select></div>`:""}
          ${typeFieldsHtml(c, k, t, list.length>1)}
          ${comps.filter(x=>!x.deleted).length>1
            ? `<label class="ckrow" style="margin-top:6px"><input type="radio" name="di-main" value="${esc(k)}" ${k===mainKey?"checked":""}> ★ Fő elem <span style="color:var(--faint);font-weight:400">— a sorban az első helyen áll</span></label>`
            : `<div class="unote" style="margin-top:6px">★ Ez a Szám egyetlen eleme, ezért ez a fő elem.</div>`}
          ${comps.filter(x=>!x.deleted).length>1
            ? (k===mainKey
                ? `<button type="button" class="btn ghost" disabled title="Ez a fő elem. Előbb jelölj ki másikat fő elemnek.">Ez a példány törlése</button>
                   <div class="unote">Ez a fő elem. Előbb jelölj ki másikat fő elemnek.</div>`
                : `<button type="button" class="btn ghost" data-removecomp="${k}">Ez a példány törlése</button>`)
            : `<div class="unote">Ez a Szám egyetlen eleme — csak a Számot lehet törölni.</div>`}
        </div>`;
      }).join("");
      return blocks;
    }).join("");
    // Más típusú elem hozzáadása: az ÖSSZES komponens-típus a Listákból (nem csak a sorozat
    // sablonjában szereplők). Az elem csak EZEN a Számon létezik: NEM kerül a sorozat sablonjába.
    const allTypes = (state.LISTS.komponens||[]).map(o=>o.ertek);
    const addOpts = Array.from(new Set([...components, ...allTypes]));
    const addRow = `<div class="addcomprow">
      <select id="di-addtype">${addOpts.map(t=>`<option value="${esc(t)}">${esc(typeLabel(t))}</option>`).join("")}</select>
      <button type="button" class="btn ghost" id="di-addcomp">+ Elem hozzáadása</button>
      <div class="unote">Csak ehhez a Számhoz kerül — a sorozat sablonját nem változtatja.</div></div>`;

    openModal(`<h2>${existing?"Szám szerkesztése (draft)":"Új szám (draft)"}</h2>
      <p class="msub">Munkaanyag — publikálásig senki más nem látja.</p>
      <div class="grid2">
        <div class="field"><label>Lapszám</label><input id="di-n" type="number" value="${master.lapszam}"></div>
        <div class="field"><label>Megjelenés dátuma</label><input id="di-date" type="date" value="${master.megjelenes||""}"></div>
      </div>
      <div class="field"><label>Cím</label><input id="di-name" value="${esc(master.cim||"")}"></div>
      <div class="field"><label>Eredeti ár (Ft)</label><input id="di-eredeti" type="number" value="${master.eredeti_ar??""}"></div>
      ${compBlocks}
      ${addRow}
      ${existing&&existing.source_issue_id?`<label class="ckrow" style="margin-top:10px"><input type="checkbox" id="di-deleted" ${master.deleted?"checked":""}> Ezt a Számot törlöm a sorozatból (publikáláskor)</label>`:""}
      <div class="modrow"><button class="btn ghost" id="di-back">Vissza</button><button class="btn" id="di-save">Mentés</button></div>
      ${existing?`<div class="modrow"><button class="btn danger" id="di-del">${
        existing.source_issue_id
          ? (existing.deleted ? "Törlésre jelölés visszavonása" : "Szám törlése a sorozatból (törlésre jelölés)")
          : "Szám törlése a draftból"}</button></div>`:""}`);

    document.getElementById("di-back").onclick=()=>onDone();

    document.getElementById("di-addcomp").onclick=()=>{
      syncFromDom();
      const t = document.getElementById("di-addtype").value;
      // alapértelmezett azonosító-típus: a sablon eleméé, ennek hiányában a típusleíráson (component_type_defs)
      const te = (Array.isArray(template)?template:[]).find(e=>e.tipus===t);
      const def = defaultIdType(typeDef(state.TYPEDEFS, t), te);
      comps.push({tipus:t, azonosito_tipus:def, azonosito:"", megnevezes:(te&&te.default_megnevezes)||"", adatok:{}, _tmpKey:"tmp"+(tmpSeq++)});
      draw();
    };
    // Utólagos átsorolásnál a mezők az új típus szerint rajzolódnak újra.
    sheet.querySelectorAll('select[id^="di-type-"]').forEach(s=>{ s.onchange=()=>{ syncFromDom(); draw(); }; });
    // Könyvnél (ahol a típusnak van alap azonosító-típusa) az azonosító beírásakor az ISBN előre megjelenik.
    sheet.querySelectorAll("input[data-ct]").forEach(inp=>{
      inp.addEventListener("input",()=>{
        const sel=document.getElementById(inp.dataset.ct);
        if(sel && !sel.value && sel.dataset.deftype && inp.value.trim()) sel.value=sel.dataset.deftype;
      });
    });
    document.querySelectorAll("[data-removecomp]").forEach(b=>{
      b.onclick=guarded(async ()=>{
        syncFromDom();
        const k=b.dataset.removecomp, c=comps.find(x=>keyOf(x)===k);
        if(!c) return;
        if(k===mainKey){ alert("Ez a fő elem. Előbb jelölj ki másikat fő elemnek."); return; }
        if(comps.filter(x=>!x.deleted).length<=1){ alert("Egy Számnak mindig marad legalább egy komponense — csak a Számot lehet törölni."); return; }
        if(c.id && c.source_component_id){
          // Élő párral rendelkező komponens: TÖRÖLT-JELÖLÉS (publikáláskor lesz törölt az élő komponens);
          // csendes, a személyes adatok megmaradnak, visszaállítható.
          if(!confirm("Törlöd ezt a komponenst a Számról?\n\nPublikáláskor eltűnik a Számról (csendesen, felkiáltójel nélkül). A hozzá tartozó személyes jelölések megmaradnak, és a törlés a publikálásig visszavonható.")) return;
          try{ const {error}=await supabase.from("draft_components").update({deleted:true, is_main:false}).eq("id",c.id); if(error) throw error; }
          catch(e){ err(e); return; }
          c.deleted = true; c.is_main = false;
        } else {
          // Csak a draftban létező (még sosem publikált) komponens: egyszerűen elhagyjuk.
          if(c.id){
            if(!confirm("Törlöd ezt a komponenst a draftból?")) return;
            try{ const {error}=await supabase.from("draft_components").delete().eq("id",c.id); if(error) throw error; }
            catch(e){ err(e); return; }
          }
          comps = comps.filter(x=>x!==c);
        }
        draw();
      });
    });
    document.querySelectorAll("[data-restorecomp]").forEach(b=>{
      b.onclick=guarded(async ()=>{
        syncFromDom();
        const k=b.dataset.restorecomp, c=comps.find(x=>keyOf(x)===k);
        if(!c || !c.id) return;
        try{ const {error}=await supabase.from("draft_components").update({deleted:false}).eq("id",c.id); if(error) throw error; }
        catch(e){ err(e); return; }
        c.deleted = false;
        draw();
      });
    });

    document.getElementById("di-save").onclick=guarded(async ()=>{
      syncFromDom();
      const n=parseInt(master.lapszam); if(isNaN(n)){alert("A lapszám kötelező.");return;}
      const masterPayload={ draft_series_id:draftSeriesId, lapszam:n, cim:(master.cim||"").trim()||null, megjelenes:master.megjelenes||null,
        eredeti_ar:master.eredeti_ar?parseInt(master.eredeti_ar):null, deleted: !!master.deleted };
      // Azonosító-típus a típus szabálya szerint — csak az új és az itt módosított azonosítóra:
      // fix típusnál a rögzített; Könyvnél üresen az alap (ISBN); Magazinnál választani kell.
      for(const c of comps){
        if(c.deleted) continue;
        const az=(c.azonosito||"").trim(), at=(c.azonosito_tipus||"").trim();
        if(!az || (c._orig && c._orig.az===az && c._orig.at===at)) continue;
        const def=typeDef(state.TYPEDEFS, c.tipus), { mode, types }=idMode(def);
        if(mode==="fix") c.azonosito_tipus=types[0];
        else if(mode==="valaszthato" && !types.includes(at)){
          if(!at && def.default_azonosito_tipus) c.azonosito_tipus=def.default_azonosito_tipus;
          else { alert(`${typeLabel(c.tipus)}: az azonosítóhoz válaszd ki az azonosító típusát — ${types.map(idTypeName).join(" vagy ")}.`); return; }
        }
      }
      try{
        let draftIssueId = savedIssueId;
        if(savedIssueId){ const {error}=await supabase.from("draft_issues").update(masterPayload).eq("id",savedIssueId); if(error) throw error; }
        else {
          const {error}=await supabase.from("draft_issues").insert({...masterPayload, id:newIssueId});
          if(error) throw error;
          draftIssueId=newIssueId; savedIssueId=newIssueId;
        }

        for(const c of comps){
          const cpayload={ tipus:c.tipus, azonosito_tipus:(c.azonosito_tipus||"").trim()||null, azonosito:(c.azonosito||"").trim()||null, megnevezes:(c.megnevezes||"").trim()||null, adatok:c.adatok||{} };
          if(c.id){ const {error}=await supabase.from("draft_components").update(cpayload).eq("id",c.id); if(error) throw error; }
          else {
            // Az új sor azonosítóját megjegyezzük: ha a mentés később elakad és
            // újrapróbálod, ez a példány frissül, nem szúródik be még egyszer.
            const {data:nc,error}=await supabase.from("draft_components").insert({...cpayload, draft_issue_id:draftIssueId, source_component_id:null}).select().single();
            if(error) throw error;
            c.id = nc.id;
          }
        }
        // Fő elem: pontosan egy. A sorrend számít (halasztott megszorítás, de a kérések külön
        // tranzakciók): előbb a többi lemondása, utána az új fő elem beállítása.
        const active = comps.filter(x=>!x.deleted);
        const mc = active.find(x=>keyOf(x)===mainKey) || active[0];
        if(mc && mc.id){
          const {error:e1}=await supabase.from("draft_components").update({is_main:false})
            .eq("draft_issue_id",draftIssueId).neq("id",mc.id).eq("is_main",true);
          if(e1) throw e1;
          const {error:e2}=await supabase.from("draft_components").update({is_main:true}).eq("id",mc.id);
          if(e2) throw e2;
        }
        // (A sorozat sablonjában nem szereplő típus csak ennek a Számnak a komponense marad:
        // a sorozat komponens-listájára / sablonjába NEM kerül.)
      }catch(e){ err(e); return; }
      onDone();
    });

    const delBtn=document.getElementById("di-del");
    if(delBtn) delBtn.onclick=guarded(async ()=>{
      if(existing.source_issue_id){
        // Élő párral rendelkező Szám: a draft-sort NEM töröljük fizikailag — egy
        // hiányzó draft-sor azt jelentené, hogy a publikálás nem nyúl az élő
        // Számhoz, az pedig ott maradna (és egy azonos lapszámú új tétellel
        // ütközne). Helyette törlésre jelöljük, így a publikálás soft-delete-eli
        // az élő párját, a felhasználók a szokásos felkiáltójelet kapják.
        const restore = !!existing.deleted;
        if(!restore && !confirm(`Törlésre jelölöd a #${existing.lapszam} számot?

Publikáláskor ez a Szám TÖRÖLT lesz az élő sorozatban (a felhasználók felkiáltójelet kapnak; a saját adataik a nyugtázáskor törlődnek). A jelölés a publikálásig bármikor visszavonható.`)) return;
        try{ const {error}=await supabase.from("draft_issues").update({deleted:!restore}).eq("id",existing.id); if(error) throw error; }catch(e){ err(e); return; }
      } else {
        if(!confirm(`Biztosan törlöd a #${existing.lapszam} számot a draftból?

Ez csak a munkaanyagot érinti, élő Szám még nem tartozik hozzá.`)) return;
        try{ const {error}=await supabase.from("draft_issues").delete().eq("id",existing.id); if(error) throw error; }catch(e){ err(e); return; }
      }
      onDone();
    });
  }

  draw();
}
