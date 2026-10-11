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
import { state, COMP_TYPES, esc, fmtDate, opts, listName } from "./state.js";
import { openModal, err, guarded } from "./modal.js";
import { initialComponents } from "./component-template.js";

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
      `${typeLabel(c.tipus)}${c.megnevezes?" — "+esc(c.megnevezes):""}${c.azonosito?": "+esc(c.azonosito):""}`
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
  // FŐ ELEM (★): egy Számon pontosan egy komponens. Kezdetben a jelölt (is_main), ennek
  // hiányában a tartalék szabály: magazin, könyv, első (megegyezik a szerver-oldalival).
  const pickMainKey = list => {
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
      const blocks=list.map((c,idx)=>{
        const k=keyOf(c);
        const canRetype = !!c.id;   // csak már mentett (élő párral vagy anélkül perzisztált) példány sorolható át
        const typeOpts = canRetype ? (state.LISTS.komponens||[]).map(o=>`<option value="${esc(o.ertek)}"${o.ertek===c.tipus?" selected":""}>${esc(o.nev)}</option>`).join("") : "";
        return `<div class="compedit">
          <h4>${esc(typeLabel(t))}${list.length>1?` #${idx+1}`:""}</h4>
          ${canRetype?`<div class="field"><label>Típus (utólagos átsorolás)</label><select id="di-type-${k}">${typeOpts}</select></div>`:""}
          <div class="field"><label>Megnevezés (opcionális) <span style="color:var(--faint);font-weight:400">— ha üres, "${esc(typeLabel(t))}${list.length>1?" #N":""}" jelenik meg</span></label>
            <input id="di-name-${k}" value="${esc(c.megnevezes||"")}" placeholder="pl. Star Wars minifigura-csomag"></div>
          <div class="grid2">
            <div class="field"><label>Azonosító típusa</label><select id="di-ct-${k}"><option value="">—</option>${opts("azonosito",c.azonosito_tipus)}</select></div>
            <div class="field"><label>Azonosító</label><input id="di-cid-${k}" value="${esc(c.azonosito||"")}"></div>
          </div>
          ${comps.length>1
            ? `<label class="ckrow" style="margin-top:6px"><input type="radio" name="di-main" value="${esc(k)}" ${k===mainKey?"checked":""}> ★ Fő elem <span style="color:var(--faint);font-weight:400">— a sorban az első helyen áll</span></label>`
            : `<div class="unote" style="margin-top:6px">★ Ez a Szám egyetlen eleme, ezért ez a fő elem.</div>`}
          ${list.length>1
            ? (k===mainKey
                ? `<button type="button" class="btn ghost" disabled title="Ez a fő elem. Előbb jelölj ki másikat fő elemnek.">Ez a példány törlése</button>
                   <div class="unote">Ez a fő elem. Előbb jelölj ki másikat fő elemnek.</div>`
                : `<button type="button" class="btn ghost" data-removecomp="${k}">Ez a példány törlése</button>`)
            : ""}
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
      const def = (te && te.default_azonosito_tipus) || ((state.TYPEDEFS||{})[t]||{}).default_azonosito_tipus || null;
      comps.push({tipus:t, azonosito_tipus:def, azonosito:"", megnevezes:(te&&te.default_megnevezes)||"", _tmpKey:"tmp"+(tmpSeq++)});
      draw();
    };
    document.querySelectorAll("[data-removecomp]").forEach(b=>{
      b.onclick=guarded(async ()=>{
        syncFromDom();
        const k=b.dataset.removecomp, c=comps.find(x=>keyOf(x)===k);
        if(!c) return;
        if(k===mainKey){ alert("Ez a fő elem. Előbb jelölj ki másikat fő elemnek."); return; }
        if(c.id){
          const liveComp = c.source_component_id
            ? "\n\nFIGYELEM: ez a példány az ÉLŐ sorozatban is létezik. A draftból való törlése az élő komponenst NEM törli — publikáláskor változatlanul megmarad (komponens törlése a sorozatból egyelőre nem támogatott)."
            : "";
          if(!confirm("Törlöd ezt a példányt a draftból?"+liveComp)) return;
          try{ const {error}=await supabase.from("draft_components").delete().eq("id",c.id); if(error) throw error; }
          catch(e){ err(e); return; }
        }
        comps = comps.filter(x=>x!==c); draw();
      });
    });

    document.getElementById("di-save").onclick=guarded(async ()=>{
      syncFromDom();
      const n=parseInt(master.lapszam); if(isNaN(n)){alert("A lapszám kötelező.");return;}
      const masterPayload={ draft_series_id:draftSeriesId, lapszam:n, cim:(master.cim||"").trim()||null, megjelenes:master.megjelenes||null,
        eredeti_ar:master.eredeti_ar?parseInt(master.eredeti_ar):null, deleted: !!master.deleted };
      try{
        let draftIssueId = savedIssueId;
        if(savedIssueId){ const {error}=await supabase.from("draft_issues").update(masterPayload).eq("id",savedIssueId); if(error) throw error; }
        else {
          const {error}=await supabase.from("draft_issues").insert({...masterPayload, id:newIssueId});
          if(error) throw error;
          draftIssueId=newIssueId; savedIssueId=newIssueId;
        }

        for(const c of comps){
          const cpayload={ tipus:c.tipus, azonosito_tipus:(c.azonosito_tipus||"").trim()||null, azonosito:(c.azonosito||"").trim()||null, megnevezes:(c.megnevezes||"").trim()||null };
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
        const mc = comps.find(x=>keyOf(x)===mainKey) || comps[0];
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
