/* ============================================================
   Típusleírás (component_type_defs) és sorozat-szintű azonosítók — tiszta
   segédfüggvények (nincs DOM/hálózat) — scripts/tests/type-defs.test.mjs.

   A típusleírás típusonként megadja:
     azonosito_mod      'fix' | 'valaszthato' | 'nincs' | 'szabad'
     azonosito_tipusok  a megengedett azonosító-típus(ok)
     fields             a mezők: {key, label, kind, szint?, potlas?}
   A szabályokat a szerver is kikényszeríti a „Kész”-nél (draft_type_field_issues);
   itt ugyanazok a szabályok állnak, hogy a felület előre jelezzen.
   ============================================================ */

const BUILTIN = new Set(["azonosito_tipus", "azonosito", "megnevezes", "kep", "db", "jegyzet"]);
const str = v => (v == null ? "" : String(v)).trim();

export const typeDef = (defs, tipus) => (defs && defs[tipus]) || null;

// Az azonosító-szabály: {mode, types}. Ismeretlen (a Listákban később felvett) típusnál 'szabad'.
export function idMode(def){
  const mode = (def && def.azonosito_mod) || "szabad";
  return { mode, types: (def && Array.isArray(def.azonosito_tipusok) ? def.azonosito_tipusok : []) };
}

// A szerkesztőben megjelenő törzsadat-mezők, a típusleírás sorrendjében. Az azonosító-típus
// nem külön mező (az azonosító mellett jelenik meg). Típusleírás nélkül a régi három mező.
export function masterFields(def){
  if(!def || !Array.isArray(def.fields)){
    return [{ key:"megnevezes", label:"Megnevezés", kind:"szoveg", szint:"opcionalis" },
            { key:"azonosito", label:"Azonosító", kind:"szoveg", szint:"opcionalis" }];
  }
  return def.fields.filter(f => f && !f.szemelyes && f.kind !== "kep" && f.key !== "azonosito_tipus");
}
// A típus saját mezői, amelyek a komponens `adatok` (jsonb) mezőjébe kerülnek (pl. Kártya: Gyűjtemény).
export const extraFields = def => masterFields(def).filter(f => !BUILTIN.has(f.key));
export const isRequired = f => !!f && f.szint === "kotelezo";
export const fieldOf = (def, key) => masterFields(def).find(f => f.key === key) || null;

// Új komponens azonosító-típusa: fix típusnál a rögzített; „nincs”-nél semmi; egyébként a
// sorozat sablonjának alapértéke, ennek hiányában a típusleírásé (a szerver: type_azonosito_tipus).
export function defaultIdType(def, templateEntry){
  const { mode, types } = idMode(def);
  if(mode === "fix") return types[0] || null;
  if(mode === "nincs") return null;
  return (templateEntry && templateEntry.default_azonosito_tipus) || (def && def.default_azonosito_tipus) || null;
}

// A komponens mezőértéke kulcs szerint (oszlop vagy az `adatok` kulcsa).
export function fieldValue(comp, key){
  if(key === "azonosito") return comp.azonosito;
  if(key === "megnevezes") return comp.megnevezes;
  return comp.adatok ? comp.adatok[key] : null;
}

// A típus szerinti hiányok egy komponensen (ugyanaz, amit a szerver a „Kész”-nél néz):
// [{kod:'mezo_hianyzik'|'azonosito_tipus', szoveg}]. `nameOf(ertek)` az azonosító-típus megjelenített neve.
export function componentIssues(def, comp, nameOf = x => x){
  const out = [];
  if(!def) return out;
  masterFields(def).filter(isRequired).forEach(f => {
    if(str(fieldValue(comp, f.key)) === "") out.push({ kod:"mezo_hianyzik", szoveg:`hiányzik: ${f.label}` });
  });
  const { mode, types } = idMode(def);
  if(str(comp.azonosito) !== ""){
    if(mode === "nincs") out.push({ kod:"azonosito_tipus", szoveg:"ennél a típusnál nincs külön azonosító (a név azonosít)" });
    else if((mode === "fix" || mode === "valaszthato") && !types.includes(comp.azonosito_tipus || ""))
      out.push({ kod:"azonosito_tipus", szoveg:`az azonosító típusa csak ${types.map(nameOf).join(" vagy ")} lehet` });
  }
  return out;
}

// A megjelenített név, ha a megnevezés üres és a típus neve pótolható (Modell: a Szám címe).
export function fallbackName(def, comp, issueTitle){
  if(str(comp && comp.megnevezes) !== "") return str(comp.megnevezes);
  const f = fieldOf(def, "megnevezes");
  return (f && f.potlas === "szam_cime" && str(issueTitle) !== "") ? str(issueTitle) : null;
}

// A tárolt azonosító / azonosító-típus megfelel-e a típus szabályának — a szerkesztő ebből jelzi a
// korábban (a régi űrlappal) hibásan bekerült adatot. Visszaad: null (rendben) vagy
// {kod:'tipus_elter'|'nincs_azonosito', szoveg}.
export function storedIdProblem(def, comp, nameOf = x => x){
  const { mode, types } = idMode(def);
  const az = str(comp && comp.azonosito), at = str(comp && comp.azonosito_tipus);
  if(mode === "nincs" && (az !== "" || at !== ""))
    return { kod:"nincs_azonosito", szoveg:"Ennél a típusnál nincs külön azonosító (a név azonosít) — a tárolt azonosító nem felel meg a típusnak. Töröld a mezőből." };
  if(mode === "fix" && at !== "" && at !== types[0])
    return { kod:"tipus_elter", szoveg:`A tárolt azonosító-típus („${nameOf(at)}”) nem felel meg a típusnak — itt csak „${nameOf(types[0])}” lehet. Állítsd át.` };
  if(mode === "valaszthato" && az !== "" && at === "")
    return { kod:"tipus_hianyzik", szoveg:`Az azonosítóhoz nincs megadva azonosító-típus — válaszd ki: ${types.map(nameOf).join(" vagy ")}.` };
  if(mode === "valaszthato" && at !== "" && !types.includes(at))
    return { kod:"tipus_elter", szoveg:`A tárolt azonosító-típus („${nameOf(at)}”) nem felel meg a típusnak — itt csak ${types.map(nameOf).join(" vagy ")} lehet. Állítsd át.` };
  return null;
}

// A munkaanyag Szám-listájában az elemek sorrendje: a fő elem (★) elöl, utána a sorozat
// komponens-sablonjának típus-sorrendje, a sablonban nem szereplő típusok a végén (ABC);
// típuson belül megnevezés, majd azonosító szerint — így a sorrend mindig ugyanaz.
export function orderComponents(comps, typeOrder = []){
  const pos = t => { const i = typeOrder.indexOf(t); return i < 0 ? typeOrder.length : i; };
  return (comps || []).slice().sort((a, b) =>
    (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0)
    || pos(a.tipus) - pos(b.tipus)
    || String(a.tipus).localeCompare(String(b.tipus))
    || str(a.megnevezes).localeCompare(str(b.megnevezes), "hu")
    || str(a.azonosito).localeCompare(str(b.azonosito))
    || String(a.id || "").localeCompare(String(b.id || "")));
}

// ---- Új Szám felvétele élő sorozatra: a create_live_issue szerver-függvény bemenete ----
// master:    {n, name, date, eredeti_ar, fizetett_ar, besz_menny, besz_datum, forras} (űrlap-értékek, szövegként is)
// instances: [{key, tipus, azonosito_tipus, azonosito, megnevezes, adatok, status, db, jegyzet}]
// mainKey:   a fő elemnek jelölt példány kulcsa (vagy null → a szerver a szokásos szabály szerint jelöl)
// A LÉTREHOZÓ SZEMÉLYES ADATA csak akkor megy el, ha ténylegesen megadott valamit:
//   • elemenként a status / db / jegyzet kulcs csak akkor, ha van státusz, VAGY a darabszám nem 1, VAGY van jegyzet
//     (az alapértelmezett 1 db önmagában nem számít megadott adatnak);
//   • a beszerzési adat (personal) null, ha nincs fizetett ár, a mennyiség 1, nincs dátum és nincs forrás —
//     az üres objektum sort hozna létre, és kikapcsolná az automatikus ár-kitöltést.
export function buildLiveIssuePayload(master, instances, mainKey = null){
  const int = v => { const t = str(v); return /^-?\d+$/.test(t) ? parseInt(t, 10) : null; };
  const comps = (instances || []).map(inst => {
    const c = { tipus: inst.tipus, azonosito_tipus: str(inst.azonosito_tipus) || null, azonosito: str(inst.azonosito) || null,
                megnevezes: str(inst.megnevezes) || null, is_main: mainKey != null && inst.key === mainKey };
    const adatok = {}; Object.entries(inst.adatok || {}).forEach(([k, v]) => { if(str(v) !== "") adatok[k] = v; });
    if(Object.keys(adatok).length) c.adatok = adatok;
    const status = str(inst.status) || null, db = int(inst.db), jegyzet = str(inst.jegyzet) || null;
    const dbv = db == null ? 1 : Math.max(0, db);
    if(status || dbv !== 1 || jegyzet){ c.status = status; c.db = dbv; c.jegyzet = jegyzet; }
    return c;
  });
  const fiz = int(master.fizetett_ar), menny = Math.max(1, int(master.besz_menny) || 1);
  const datum = str(master.besz_datum) || null, forras = str(master.forras) || null;
  const personal = (fiz != null || menny !== 1 || datum || forras)
    ? { fizetett_ar: fiz, beszerzesi_mennyiseg: menny, beszerzes_datuma: datum, forras } : null;
  return {
    issue: { lapszam: int(master.n), cim: str(master.name) || null, megjelenes: str(master.date) || null, eredeti_ar: int(master.eredeti_ar), comps },
    personal,
  };
}

// A Gyors Excel egy ÚJ sora → a create_live_issue bemenete. item: {n, p:{cim, megjelenes, eredeti_ar},
// pi:{fizetett_ar?}, comps:[{t, status, azonosito, megnevezes}]}. A sorozat minden komponens-típusából egy
// elem (mint eddig); a személyes státusz csak akkor megy el, ha a cellában volt érték; a beszerzési adat
// csak akkor, ha volt fizetett ár. A fő elemet a szerver jelöli a szokásos szabály szerint.
export function excelRowToLiveIssue(item){
  const comps = (item.comps || []).map(c => {
    const o = { tipus: c.t, azonosito: c.azonosito || null, megnevezes: c.megnevezes || null };
    if(c.status !== undefined && c.status !== null) o.status = c.status;
    return o;
  });
  const personal = (item.pi && item.pi.fizetett_ar != null) ? { fizetett_ar: item.pi.fizetett_ar } : null;
  const p = item.p || {};
  return { issue: { lapszam: item.n, cim: p.cim || null, megjelenes: p.megjelenes || null,
                    eredeti_ar: p.eredeti_ar == null ? null : p.eredeti_ar, comps }, personal };
}

// ---- Sorozat-szintű azonosítók (series.azonositok): [{tipus:'isbn'|'issn', ertek}] legfeljebb 2 ----
export const SERIES_ID_TYPES = [["isbn", "ISBN"], ["issn", "ISSN"]];
export const SERIES_ID_MAX = 2;
const norm = v => str(v).replace(/[\s-]+/g, "").toUpperCase();

// Az űrlap sorai → tárolt lista (az üres sorok kimaradnak, az érték szóközei levágva).
export function cleanSeriesIds(rows){
  return (rows || []).map(r => ({ tipus: str(r && r.tipus), ertek: str(r && r.ertek) }))
    .filter(r => r.tipus !== "" || r.ertek !== "");
}
// Hibaszöveg vagy null (a szerver series_azonositok_error függvényével azonos szabályok).
export function seriesIdsError(list){
  if(!Array.isArray(list)) return "a sorozat-azonosítók listája hibás formátumú";
  if(list.length > SERIES_ID_MAX) return "legfeljebb két sorozat-azonosító adható meg";
  const seen = new Set();
  for(const e of list){
    if(!e || !SERIES_ID_TYPES.some(([v]) => v === e.tipus)) return "a sorozat-azonosító típusa csak ISBN vagy ISSN lehet — válaszd ki a típust";
    if(str(e.ertek) === "") return "a sorozat-azonosító értéke nem lehet üres";
    const v = norm(e.ertek);
    if(e.tipus === "issn" && !/^[0-9]{7}[0-9X]$/.test(v)) return `az ISSN 8 jegyű (pl. 1234-5678) — ez nem az: ${e.ertek}`;
    if(e.tipus === "isbn" && !/^([0-9]{9}[0-9X]|[0-9]{13})$/.test(v)) return `az ISBN 10 vagy 13 jegyű (pl. 978-963-12-3456-7) — ez nem az: ${e.ertek}`;
    const k = e.tipus + ":" + v;
    if(seen.has(k)) return "ugyanaz a sorozat-azonosító kétszer szerepel";
    seen.add(k);
  }
  return null;
}
// Megjelenítés: "ISSN 3103-4152 · ISBN 978-…" (üres listánál üres szöveg).
export function formatSeriesIds(list){
  return (Array.isArray(list) ? list : []).filter(e => e && str(e.ertek) !== "")
    .map(e => `${(SERIES_ID_TYPES.find(([v]) => v === e.tipus) || [0, str(e.tipus).toUpperCase()])[1]} ${str(e.ertek)}`).join(" · ");
}
