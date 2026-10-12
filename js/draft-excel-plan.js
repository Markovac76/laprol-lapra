/* ============================================================
   Oda-vissza sablon — TISZTA logika (nincs DOM, nincs hálózat, nincs xlsx),
   hogy Node-ban is tesztelhető legyen. A draft-excel.js hívja.

   Elv (a tulajdonos döntése): a tétel azonossága az AZONOSÍTÓBAN van
   (rejtett oszlop az Excelben), nem a névben és nem a lapszámban. A lapszám
   tiszta sorrend-szám, a sablon az irányadó rá. Sosem párosítunk csendben:
   azonosító nélküli sornál a név/dátum alapú találat csak JAVASLAT,
   megerősítéssel.
   ============================================================ */

export const normName = s => String(s==null ? "" : s).trim().toLowerCase().replace(/\s+/g," ");

// Kis, gyors, függőség-nélküli hash (cyrb53) — a draft tartalmának ujjlenyomatához.
function cyrb53(str, seed=0){
  let h1=0xdeadbeef^seed, h2=0x41c6ce57^seed;
  for(let i=0,ch;i<str.length;i++){ ch=str.charCodeAt(i); h1=Math.imul(h1^ch,2654435761); h2=Math.imul(h2^ch,1597334677); }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(16);
}

// A draft TARTALMÁNAK ujjlenyomata (azonosítók + mezők). Ha a sablon letöltése
// óta bármi változott (akár visszaváltoztatva is mást jelent: új állapot),
// az ujjlenyomat eltér — így a feltöltés figyelmeztethet az elavult fájlra.
// Migráció nélkül: a draft-soroknak nincs időbélyegük.
export function draftFingerprint(items){
  const byId=(a,b)=> a.id<b.id ? -1 : a.id>b.id ? 1 : 0;
  const rows = items.slice().sort(byId).map(it=>[
    it.id, it.lapszam, it.cim||"", it.megjelenes||"", it.eredeti_ar==null?"":it.eredeti_ar, it.deleted?1:0, it.source_issue_id||"",
    (it.comps||[]).slice().sort(byId).map(c=>{
      const row=[c.id, c.tipus, c.azonosito||"", c.azonosito_tipus||"", c.megnevezes||"", c.source_component_id||"", c.deleted?1:0];
      // a típus saját mezői (adatok) — csak ha van bennük érték, így a korábban letöltött sablonok ujjlenyomata érvényes marad
      const ak=Object.keys(c.adatok||{}).sort();
      if(ak.length) row.push(ak.map(k=>[k, c.adatok[k]]));
      return row;
    }),
  ]);
  return cyrb53(JSON.stringify(rows));
}

// Egy típuson belül a komponensek determinisztikus sorrendje (példány-csoportok).
export function compsOf(item, tipus){
  // a törölt-jelölésű komponens nem szerepel a sablonban (a draft-szerkesztőben visszavonható)
  return (item.comps||[]).filter(c=>c.tipus===tipus && !c.deleted).sort((a,b)=>
    String(a.megnevezes||"").localeCompare(String(b.megnevezes||""),"hu")
    || String(a.azonosito||"").localeCompare(String(b.azonosito||""))
    || (a.id<b.id ? -1 : a.id>b.id ? 1 : 0));
}

/* ---------- sablon-modell (a letöltéshez) ---------- */
// Egy lap, típusonként "példány-csoportokkal": csoportonként azonosító,
// megnevezés + rejtett komponens-ID. A csoportok száma típusonként a draftban
// lévő legtöbb példány (legalább 1). Rejtett Szám-ID oszlop a végén.
// infoOf(tipus) → {noId, extra:[{key,label,kind}]}: a típusleírás szerint — „noId” típusnál (Figura,
// Modell) nincs azonosító-oszlop; az `extra` a típus saját mezői (pl. Kártya: Gyűjtemény), ezek a
// megnevezés után kapnak oszlopot, és a komponens `adatok` mezőjébe kerülnek.
export function templateModel(items, components, labelOf, infoOf = () => ({ noId:false, extra:[] })){
  const types=[...components];
  items.forEach(it=>(it.comps||[]).forEach(c=>{ if(!c.deleted && !types.includes(c.tipus)) types.push(c.tipus); }));
  const sorted=items.slice().sort((a,b)=>(a.lapszam-b.lapszam)
    || String(a.cim||"").localeCompare(String(b.cim||""),"hu") || (a.id<b.id ? -1 : 1));

  const groups={};
  types.forEach(t=>{ groups[t]=Math.max(1, ...sorted.map(it=>compsOf(it,t).length)); });

  const header=[], colmap=[];
  const push=(h,m,extra={})=>{ colmap.push({i:header.length,h,m,...extra}); header.push(h); };
  push("lapszám","lapszam");
  push("cím","cim");
  push("dátum (Excel dátum, pl. 2026.03.15)","datum");
  push("eredeti ár (csak szám)","ar");
  push("törlésre jelölve (igen)","torolt");
  types.forEach(t=>{
    for(let k=1;k<=groups[t];k++){
      const L=labelOf(t), info=infoOf(t)||{};
      if(!info.noId) push(`${L} #${k} azonosító`,"azonosito",{t,k});
      push(`${L} #${k} megnevezés`,"megnevezes",{t,k});
      (info.extra||[]).forEach(f=>push(`${L} #${k} ${f.label}`,"adat",{t,k,key:f.key,kind:f.kind}));
      push(`${L} #${k} komponens-ID (ne módosítsd)`,"komp_id",{t,k});
    }
  });
  push("Szám-ID (ne módosítsd)","szam_id");
  const hiddenCols=colmap.filter(c=>c.m==="komp_id"||c.m==="szam_id").map(c=>c.i);

  const colIdx=(m,t,k)=>{ const c=colmap.find(c=>c.m===m && (t===undefined || (c.t===t && c.k===k))); return c ? c.i : -1; };
  const rows=sorted.map(it=>{
    const r=new Array(header.length).fill("");
    r[colIdx("lapszam")]=it.lapszam; r[colIdx("cim")]=it.cim||""; r[colIdx("datum")]=it.megjelenes||"";
    r[colIdx("ar")]=it.eredeti_ar==null?"":it.eredeti_ar; r[colIdx("torolt")]=it.deleted?"igen":"";
    r[colIdx("szam_id")]=it.id;
    types.forEach(t=>compsOf(it,t).forEach((c,idx)=>{
      const k=idx+1;
      const ai=colIdx("azonosito",t,k); if(ai>=0) r[ai]=c.azonosito||"";
      r[colIdx("megnevezes",t,k)]=c.megnevezes||""; r[colIdx("komp_id",t,k)]=c.id;
      colmap.filter(x=>x.m==="adat" && x.t===t && x.k===k).forEach(x=>{ const v=(c.adatok||{})[x.key]; r[x.i]= v==null ? "" : v; });
    }));
    return r;
  });
  return {header, colmap, rows, hiddenCols, types, groups};
}

/* ---------- beolvasás (a már kiolvasott cellákból) ---------- */
// Az oszlopot a FEJLÉC-szöveg alapján keressük meg (az átrendezés/beszúrás
// ellen), ha nincs, a letöltéskori pozícióra esünk vissza.
export function resolveColumns(headerRow, colmap){
  const byHeader=new Map();
  headerRow.forEach((h,i)=>{ const k=String(h==null?"":h).trim(); if(k && !byHeader.has(k)) byHeader.set(k,i); });
  return colmap.map(c=>({...c, idx: byHeader.has(c.h) ? byHeader.get(c.h) : c.i}));
}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IGEN=/^(igen|i|x|1|true|yes)$/i;

// parsers: {date(cell)->"YYYY-MM-DD"|null, number(cell)->int|null}
export function rowsFromAoa(aoa, cols, parsers){
  const rows=[], skipped=[], dateWarnings=[];
  const cell=(r,m,t,k)=>{ const c=cols.find(c=>c.m===m && (t===undefined || (c.t===t && c.k===k))); return c ? r[c.idx] : undefined; };
  const str=v=>String(v==null?"":v).trim();
  const groupKeys=[];
  cols.forEach(c=>{ if(c.t!==undefined && !groupKeys.some(g=>g.t===c.t && g.k===c.k)) groupKeys.push({t:c.t,k:c.k}); });

  for(let ri=1; ri<aoa.length; ri++){
    const r=aoa[ri]; if(!r) continue;
    if(!r.some(v=>str(v)!=="")) continue;            // teljesen üres sor
    const rowNo=ri+1;
    const n=parseInt(str(cell(r,"lapszam")));
    if(isNaN(n)){ skipped.push({rowNo, ok:"nincs érvényes lapszám"}); continue; }
    const rawId=str(cell(r,"szam_id"));
    if(rawId && !UUID.test(rawId)){ skipped.push({rowNo, ok:"érvénytelen Szám-azonosító"}); continue; }

    const rawDate=cell(r,"datum");
    const megjelenes=parsers.date(rawDate);
    if(str(rawDate)!=="" && !megjelenes) dateWarnings.push(n);

    const comps=[];
    groupKeys.forEach(({t,k})=>{
      const id=str(cell(r,"komp_id",t,k)), az=str(cell(r,"azonosito",t,k)), nev=str(cell(r,"megnevezes",t,k));
      // a típus saját mezői (adatok): csak a nem üres cellák; egész típusnál szám, ha annak olvasható
      const adatok={};
      cols.filter(c=>c.m==="adat" && c.t===t && c.k===k).forEach(c=>{
        const v=str(r[c.idx]); if(v==="") return;
        adatok[c.key] = c.kind==="egesz" && /^-?\d+$/.test(v) ? parseInt(v,10) : v;
      });
      const hasAdat=Object.keys(adatok).length>0;
      if(!id && !az && !nev && !hasAdat) return;
      comps.push({tipus:t, k, id: (id && UUID.test(id)) ? id : null, badId: !!id && !UUID.test(id), azonosito:az||null, megnevezes:nev||null, adatok: hasAdat ? adatok : null});
    });
    rows.push({
      rowNo, lapszam:n, cim:str(cell(r,"cim"))||null, megjelenes, eredeti_ar:parsers.number(cell(r,"ar")),
      torolt: IGEN.test(str(cell(r,"torolt"))), szamId: rawId||null, comps,
    });
  }
  return {rows, skipped, dateWarnings};
}

/* ---------- terv: párosítás, osztályozás, payload ---------- */
// confirmSuggest: Set(rowNo) — a felhasználó által jóváhagyott név-javaslatok
// deleteMissing:  Set(draft_issues.id) — a fájlból hiányzók közül a kifejezetten
//                 törlésre jelöltek (alapból SEMMI nem törlődik)
// newIds: Map(rowNo -> uuid) — az új sorok azonosítója (a hívó generálja, hogy
//                 az újrapróbálás idempotens legyen)
export function planUpload({rows, items, confirmSuggest=new Set(), deleteMissing=new Set(), newIds=new Map()}){
  const byId=new Map(items.map(i=>[i.id,i]));
  const used=new Set();
  const matched=[], fresh=[], unknownIds=[];

  // ---- AZONOSÍTÓ-HIBÁK (BLOKKOLÓ — a feltöltés le van tiltva) ----
  // Egy lemásolt sor (vagy két sorba másolt azonosító) kétértelművé tenné, melyik
  // sor frissítse a tételt/komponenst — ilyenkor nem találgatunk, és semmit
  // nem alkalmazunk.
  const errors={dupSzam:[], dupComp:[], foreignComp:[]};
  const bySzam=new Map();
  rows.forEach(r=>{ if(r.szamId){ if(!bySzam.has(r.szamId)) bySzam.set(r.szamId,[]); bySzam.get(r.szamId).push(r); } });
  const dupSzamIds=new Set();
  bySzam.forEach((rs,id)=>{ if(rs.length>1){
    dupSzamIds.add(id);
    errors.dupSzam.push({id, rows:rs.map(r=>r.rowNo), cim:rs[0].cim, lapszamok:rs.map(r=>r.lapszam)});
  }});
  const compOwner=new Map();
  items.forEach(it=>(it.comps||[]).forEach(c=>compOwner.set(c.id,it)));
  const byComp=new Map();
  rows.forEach(r=>r.comps.forEach(g=>{ if(g.id){ if(!byComp.has(g.id)) byComp.set(g.id,[]); byComp.get(g.id).push({rowNo:r.rowNo, tipus:g.tipus, k:g.k}); } }));
  byComp.forEach((uses,id)=>{ if(uses.length>1) errors.dupComp.push({id, uses}); });
  rows.forEach(r=>{
    const it=r.szamId ? byId.get(r.szamId) : null; if(!it) return;
    r.comps.forEach(g=>{
      if(!g.id) return;
      const owner=compOwner.get(g.id);
      if(owner && owner.id!==it.id) errors.foreignComp.push({rowNo:r.rowNo, tipus:g.tipus, k:g.k, owner});
    });
  });

  rows.forEach(row=>{
    if(row.szamId){
      if(dupSzamIds.has(row.szamId)) return;          // kétértelmű — blokkolva, nem párosítjuk
      const it=byId.get(row.szamId);
      if(!it){ unknownIds.push(row); return; }
      used.add(it.id); matched.push({row, item:it, how:"id"});
    } else fresh.push(row);
  });

  // Azonosító nélküli sorok: név (+ dátum) alapú JAVASLAT — csak megerősítéssel párosul.
  const suggestions=[], newRows=[];
  fresh.forEach(row=>{
    const nm=normName(row.cim);
    let pick=null, ambiguous=false;
    if(nm){
      let cand=items.filter(it=>!used.has(it.id) && !it.deleted && normName(it.cim)===nm);
      if(cand.length>1 && row.megjelenes) cand=cand.filter(it=>it.megjelenes===row.megjelenes);
      if(cand.length===1) pick=cand[0]; else if(cand.length>1) ambiguous=true;
    }
    if(pick){
      suggestions.push({row, item:pick});
      if(confirmSuggest.has(row.rowNo)){ used.add(pick.id); matched.push({row, item:pick, how:"javaslat"}); return; }
    }
    newRows.push({row, ambiguous});
  });

  const warnings={unknownIds, unknownComps:[], newMarkedDeleted:[], sameName:[]};

  // Meglévő tételek módosításai (csak NEM ÜRES, eltérő értékek — üres cella nem töröl).
  const ops=matched.map(({row,item,how})=>{
    const patch={};
    if(row.lapszam!==item.lapszam) patch.lapszam=row.lapszam;
    if(row.cim!=null && row.cim!==(item.cim||null)) patch.cim=row.cim;
    if(row.megjelenes!=null && row.megjelenes!==item.megjelenes) patch.megjelenes=row.megjelenes;
    if(row.eredeti_ar!=null && row.eredeti_ar!==item.eredeti_ar) patch.eredeti_ar=row.eredeti_ar;
    const wasDeleted=!!item.deleted;
    if(row.torolt && !wasDeleted) patch.deleted=true;
    if(!row.torolt && wasDeleted) patch.deleted=false;      // visszaállítás: ugyanazzal az azonosítóval újra feltöltve

    const compOps=[];
    row.comps.forEach(g=>{
      if(g.badId){ warnings.unknownComps.push({row, g}); return; }
      let comp=null;
      if(g.id){
        comp=(item.comps||[]).find(c=>c.id===g.id);
        if(!comp){ warnings.unknownComps.push({row, g}); return; }
      } else if(how==="javaslat"){
        comp=compsOf(item,g.tipus)[g.k-1] || null;            // azonosító nélküli (javasolt) párosításnál pozíció szerint
      }
      if(comp){
        const cp={};
        if(g.azonosito!=null && g.azonosito!==(comp.azonosito||null)) cp.azonosito=g.azonosito;
        if(g.megnevezes!=null && g.megnevezes!==(comp.megnevezes||null)) cp.megnevezes=g.megnevezes;
        if(g.adatok){   // csak az eltérő, nem üres kulcsok (üres cella nem töröl)
          const ch={}; Object.keys(g.adatok).forEach(key=>{ if(String(g.adatok[key])!==String((comp.adatok||{})[key]??"")) ch[key]=g.adatok[key]; });
          if(Object.keys(ch).length) cp.adatok=ch;
        }
        if(Object.keys(cp).length) compOps.push({id:comp.id, tipus:comp.tipus, k:g.k, from:comp, patch:cp});
      } else if(g.azonosito!=null || g.megnevezes!=null || g.adatok){
        const np={azonosito:g.azonosito, megnevezes:g.megnevezes}; if(g.adatok) np.adatok=g.adatok;
        compOps.push({id:null, tipus:g.tipus, k:g.k, patch:np, isNew:true});
      }
    });
    const lapszamChange = patch.lapszam!==undefined;
    const hasChange = Object.keys(patch).length>0 || compOps.length>0;
    return {row, item, how, patch, compOps, lapszamChange, hasChange, restore: patch.deleted===false, markDeleted: patch.deleted===true};
  });

  // Új sorok
  const creates=[];
  newRows.forEach(({row, ambiguous})=>{
    if(row.torolt){ warnings.newMarkedDeleted.push(row); return; }
    creates.push({
      row, ambiguous, newId:newIds.get(row.rowNo)||null,
      comps: row.comps.filter(g=>g.azonosito!=null||g.megnevezes!=null||g.adatok).map(g=>({tipus:g.tipus, azonosito:g.azonosito, megnevezes:g.megnevezes, ...(g.adatok?{adatok:g.adatok}:{})})),
    });
  });

  // A fájlból HIÁNYZÓ (nem törölt, nem párosított) draft-tételek: alapból MARADNAK.
  // (a kétértelmű, ismétlődő azonosítójú tétel nem "hiányzik" — kétszer szerepel a fájlban)
  const missing=items.filter(it=>!used.has(it.id) && !dupSzamIds.has(it.id) && !it.deleted);
  const deleteIds=missing.filter(it=>deleteMissing.has(it.id)).map(it=>it.id);

  // Azonos nevű tételek a végállapotban — csak FIGYELMEZTETÉS (a kiadó két "1. számot" is kiadhat).
  const finalNames=[];
  items.forEach(it=>{
    if(it.deleted && !ops.some(o=>o.item.id===it.id && o.restore)) return;
    if(deleteIds.includes(it.id)) return;
    const op=ops.find(o=>o.item.id===it.id);
    if(op && op.markDeleted) return;
    finalNames.push({cim: op && op.patch.cim!==undefined ? op.patch.cim : it.cim, lapszam: op && op.patch.lapszam!==undefined ? op.patch.lapszam : it.lapszam});
  });
  creates.forEach(c=>finalNames.push({cim:c.row.cim, lapszam:c.row.lapszam}));
  const nameMap=new Map();
  finalNames.forEach(x=>{ const k=normName(x.cim); if(!k) return; (nameMap.get(k)||nameMap.set(k,[]).get(k)).push(x); });
  nameMap.forEach((v,k)=>{ if(v.length>1) warnings.sameName.push({cim:v[0].cim, lapszamok:v.map(x=>x.lapszam)}); });

  // Hipotetikus változtatások az SQL-oldali ütközés-ellenőrzésnek (draft_lapszam_conflicts).
  const changes=[];
  ops.forEach(o=>{
    const ch={id:o.item.id};
    if(o.patch.lapszam!==undefined) ch.lapszam=o.patch.lapszam;
    if(o.patch.cim!==undefined) ch.cim=o.patch.cim;
    if(o.patch.deleted!==undefined) ch.deleted=o.patch.deleted;
    if(Object.keys(ch).length>1) changes.push(ch);
  });
  creates.forEach(c=>changes.push({id:null, lapszam:c.row.lapszam, cim:c.row.cim||""}));
  deleteIds.forEach(id=>changes.push({id, deleted:true}));

  const stats={
    uj: creates.length,
    frissul: ops.filter(o=>o.hasChange).length,
    lapszamValtozik: ops.filter(o=>o.lapszamChange).length,
    valtozatlan: ops.filter(o=>!o.hasChange).length,
    hianyzik: missing.length, torlesreJelolt: deleteIds.length,
    visszaall: ops.filter(o=>o.restore).length,
  };
  const blocked = errors.dupSzam.length>0 || errors.dupComp.length>0 || errors.foreignComp.length>0;
  return {ops, creates, suggestions, missing, deleteIds, warnings, errors, blocked, changes, stats, matchedIds:[...used]};
}

// Azonosítót kapó komponensek, amelyeknek a feltöltés UTÁN sem lesz a típusuknak megfelelő
// azonosító-típusa (jellemzően Magazin: ISBN vagy ISSN — nincs alapérték, választani kell).
// idTypeOf(tipus, jelenlegi) → a feltöltés utáni azonosító-típus (a szerver szabálya szerint);
// allowedOf(tipus) → a megengedett típusok listája vagy null (nincs megkötés).
export function idTypeGaps(plan, idTypeOf, allowedOf){
  const out=[];
  const check=(lapszam, tipus, k, cur)=>{
    const allowed=allowedOf(tipus); if(!allowed) return;
    const after=idTypeOf(tipus, cur||null);
    if(!allowed.includes(after||"")) out.push({lapszam, tipus, k});
  };
  plan.ops.forEach(o=>o.compOps.forEach(c=>{
    if(c.patch.azonosito==null) return;
    check(o.patch.lapszam!==undefined ? o.patch.lapszam : o.item.lapszam, c.tipus, c.k, c.isNew ? null : c.from.azonosito_tipus);
  }));
  plan.creates.forEach(cr=>{ const seen={}; cr.comps.forEach(c=>{ seen[c.tipus]=(seen[c.tipus]||0)+1; if(c.azonosito!=null) check(cr.row.lapszam, c.tipus, seen[c.tipus], null); }); });
  return out;
}

// A tranzakciós SQL-függvény (apply_draft_upload) bemenete.
export function buildPayload(plan){
  const items=[];
  plan.ops.filter(o=>o.hasChange).forEach(o=>{
    const it={id:o.item.id, ...o.patch};
    if(o.compOps.length) it.comps=o.compOps.map(c=>c.id ? {id:c.id, ...c.patch} : {tipus:c.tipus, ...c.patch});
    items.push(it);
  });
  plan.creates.forEach(c=>{
    items.push({id:null, new_id:c.newId, lapszam:c.row.lapszam, cim:c.row.cim, megjelenes:c.row.megjelenes||null,
      eredeti_ar:c.row.eredeti_ar==null?null:c.row.eredeti_ar, comps:c.comps});
  });
  return {items, delete_ids:plan.deleteIds};
}
