/* ============================================================
   A publikálás előtti összefoglaló: mi változna egy draft publikálásakor.
   Tiszta függvény (nincs DOM/hálózat) — scripts/tests/draft-diff.test.mjs.

   A szabályok TÜKÖRKÉPE a publish_draft_series() SQL-függvénynek
   (laprol-lapra-lapszam-csendes.sql), hogy az összefoglaló és a tényleges
   publikálás ne különbözzön:
   - a draftból HIÁNYZÓ élő Szám változatlan marad;
   - törölt-jelölésű (deleted) élő párú tétel: "törölt" — ha az élő Szám már
     törölt, nincs változás; az új (élő pár nélküli), törölt-jelölésű tétel
     kimarad;
   - új (élő pár nélküli, nem törölt) tétel: "új";
   - élő párú tétel: cím / megjelenés / eredeti ár eltérése, vagy komponens
     változása (tipus / azonosito_tipus / azonosito / megnevezes) vagy új
     komponens → "módosult";
   - ha CSAK a lapszám tér el: "csak átszámozva" (csendes: nincs verzióemelés,
     nincs felkiáltójel; a change_log rögzíti).
   ============================================================ */
const same = (a, b) => (a == null ? null : String(a)) === (b == null ? null : String(b));

// draftItems: [{id, lapszam, cim, megjelenes, eredeti_ar, source_issue_id, deleted, comps:[{source_component_id, tipus, azonosito_tipus, azonosito, megnevezes}]}]
// liveIssues: [{id, lapszam, cim, megjelenes, eredeti_ar, is_deleted}]
// liveComps:  [{id, issue_id, tipus, azonosito_tipus, azonosito, megnevezes}]
export function diffDraft(draftItems, liveIssues = [], liveComps = []){
  const liveById = new Map(liveIssues.map(i => [i.id, i]));
  const compById = new Map(liveComps.map(c => [c.id, c]));
  const r = { uj: 0, modosult: 0, torolt: 0, csakAtszamozva: 0, valtozatlan: 0,
              ujLista: [], modosultLista: [], toroltLista: [], atszamozottLista: [] };
  for(const di of draftItems || []){
    if(di.source_issue_id){
      const live = liveById.get(di.source_issue_id);
      if(!live){ r.valtozatlan++; continue; }
      if(di.deleted){
        if(!live.is_deleted){ r.torolt++; r.toroltLista.push(di.lapszam); } else r.valtozatlan++;
        continue;
      }
      let changed = !same(di.cim, live.cim) || !same(di.megjelenes, live.megjelenes) || !same(di.eredeti_ar, live.eredeti_ar);
      for(const dc of di.comps || []){
        if(!dc.source_component_id){ changed = true; continue; }          // új komponens egy meglévő Számon
        const lc = compById.get(dc.source_component_id);
        if(!lc) continue;
        if(!same(dc.tipus, lc.tipus) || !same(dc.azonosito_tipus, lc.azonosito_tipus) ||
           !same(dc.azonosito, lc.azonosito) || !same(dc.megnevezes, lc.megnevezes)) changed = true;
      }
      const lapszamChanged = !same(di.lapszam, live.lapszam);
      if(changed){ r.modosult++; r.modosultLista.push(di.lapszam); }
      else if(lapszamChanged){ r.csakAtszamozva++; r.atszamozottLista.push(di.lapszam); }
      else r.valtozatlan++;
    } else {
      if(di.deleted) continue;                                              // sosem publikált, törlésre jelölt: kimarad
      r.uj++; r.ujLista.push(di.lapszam);
    }
  }
  return r;
}

// Magyar összefoglaló szöveg: "3 új, 2 módosult, 1 törölt Szám (+ 4 csak átszámozva)".
export function diffSummaryText(d){
  const parts = [];
  if(d.uj) parts.push(`${d.uj} új`);
  if(d.modosult) parts.push(`${d.modosult} módosult`);
  if(d.torolt) parts.push(`${d.torolt} törölt`);
  let txt = parts.length ? parts.join(", ") + " Szám" : "nincs tartalmi változás";
  if(d.csakAtszamozva) txt += ` (+ ${d.csakAtszamozva} Számon csak a lapszám változik — csendes átszámozás, felkiáltójel nélkül)`;
  return txt;
}
