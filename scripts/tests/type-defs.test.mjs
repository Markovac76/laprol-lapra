// Típusleírás, sorozat-azonosítók és a sablon típus-mezőinek tesztje. Futtatás: node scripts/tests/type-defs.test.mjs
import assert from "node:assert/strict";
const T = await import("../../js/type-defs.js");
const P = await import("../../js/draft-excel-plan.js");

const KOZOS = [{ key:"kep", kind:"kep", label:"Kép" }, { key:"db", kind:"egesz", label:"Darabszám", szemelyes:true }, { key:"jegyzet", kind:"szoveg", label:"Jegyzet", szemelyes:true }];
const DEFS = {
  magazin: { tipus:"magazin", csalad:"kiadvany", azonosito_mod:"valaszthato", azonosito_tipusok:["isbn","issn"], default_azonosito_tipus:null,
    fields:[{ key:"azonosito_tipus", kind:"lista", label:"Azonosító típusa", szint:"opcionalis" }, { key:"azonosito", kind:"szoveg", label:"Azonosító", szint:"opcionalis" }, { key:"megnevezes", kind:"szoveg", label:"Megnevezés", szint:"opcionalis" }, ...KOZOS] },
  konyv: { tipus:"konyv", csalad:"kiadvany", azonosito_mod:"valaszthato", azonosito_tipusok:["isbn","issn"], default_azonosito_tipus:"isbn",
    fields:[{ key:"azonosito", kind:"szoveg", label:"Azonosító", szint:"opcionalis" }, { key:"megnevezes", kind:"szoveg", label:"Megnevezés", szint:"opcionalis" }, ...KOZOS] },
  lego: { tipus:"lego", azonosito_mod:"fix", azonosito_tipusok:["lego_kd"], default_azonosito_tipus:"lego_kd",
    fields:[{ key:"azonosito", kind:"szoveg", label:"Lego-kód", szint:"opcionalis" }, { key:"megnevezes", kind:"szoveg", label:"Megnevezés", szint:"opcionalis" }, ...KOZOS] },
  krtya: { tipus:"krtya", azonosito_mod:"fix", azonosito_tipusok:["kartya_kod"], default_azonosito_tipus:"kartya_kod",
    fields:[{ key:"gyarto", kind:"szoveg", label:"Gyártó", szint:"opcionalis" }, { key:"gyujtemeny", kind:"szoveg", label:"Gyűjtemény", szint:"kotelezo" }, { key:"szeria", kind:"szoveg", label:"Széria", szint:"opcionalis" },
      { key:"kiadas_eve", kind:"egesz", label:"Kiadás éve", szint:"opcionalis" }, { key:"sorozatvaltozat", kind:"szoveg", label:"Sorozatváltozat", szint:"opcionalis" },
      { key:"azonosito", kind:"szoveg", label:"Kód", szint:"kotelezo" }, { key:"megnevezes", kind:"szoveg", label:"Név", szint:"kotelezo" }, ...KOZOS] },
  figura: { tipus:"figura", azonosito_mod:"nincs", azonosito_tipusok:[], fields:[{ key:"megnevezes", kind:"szoveg", label:"Név", szint:"kotelezo" }, ...KOZOS] },
  modell: { tipus:"modell", azonosito_mod:"nincs", azonosito_tipusok:[], fields:[{ key:"megnevezes", kind:"szoveg", label:"Név", szint:"opcionalis", potlas:"szam_cime" }, ...KOZOS] },
};
const d = t => T.typeDef(DEFS, t);

// --- azonosító-szabály, mezők
assert.deepEqual(T.idMode(d("lego")), { mode:"fix", types:["lego_kd"] });
assert.deepEqual(T.idMode(d("ismeretlen")), { mode:"szabad", types:[] });
assert.deepEqual(T.masterFields(d("krtya")).map(f=>f.label), ["Gyártó","Gyűjtemény","Széria","Kiadás éve","Sorozatváltozat","Kód","Név"]);
assert.deepEqual(T.extraFields(d("krtya")).map(f=>f.key), ["gyarto","gyujtemeny","szeria","kiadas_eve","sorozatvaltozat"]);
assert.deepEqual(T.extraFields(d("lego")), []);
assert.deepEqual(T.masterFields(null).map(f=>f.key), ["megnevezes","azonosito"]);   // típusleírás nélkül a régi mezők
assert.equal(T.fieldOf(d("magazin"), "azonosito_tipus"), null);                    // az azonosító-típus nem külön mező

// --- alap azonosító-típus új komponensnél
assert.equal(T.defaultIdType(d("lego"), { default_azonosito_tipus:"egyeb" }), "lego_kd");   // a fix típus felülírja a sablont
assert.equal(T.defaultIdType(d("konyv"), null), "isbn");
assert.equal(T.defaultIdType(d("konyv"), { default_azonosito_tipus:"issn" }), "issn");
assert.equal(T.defaultIdType(d("magazin"), null), null);
assert.equal(T.defaultIdType(d("figura"), { default_azonosito_tipus:"isbn" }), null);
assert.equal(T.defaultIdType(null, { default_azonosito_tipus:"vonalkod" }), "vonalkod");

// --- típus szerinti hiányok (a szerver draft_type_field_issues szabályai)
const name = v => ({ isbn:"ISBN", issn:"ISSN", kartya_kod:"Kártyakód" }[v] || v);
assert.deepEqual(T.componentIssues(d("krtya"), { megnevezes:"X" }, name).map(x=>x.szoveg), ["hiányzik: Gyűjtemény", "hiányzik: Kód"]);
assert.deepEqual(T.componentIssues(d("krtya"), { megnevezes:"X", azonosito:"LE1", azonosito_tipus:"egyeb", adatok:{ gyujtemeny:"G" } }, name).map(x=>x.szoveg), ["az azonosító típusa csak Kártyakód lehet"]);
assert.deepEqual(T.componentIssues(d("krtya"), { megnevezes:"X", azonosito:"LE1", azonosito_tipus:"kartya_kod", adatok:{ gyujtemeny:"G" } }, name), []);
assert.deepEqual(T.componentIssues(d("magazin"), { azonosito:"1234-5678" }, name).map(x=>x.szoveg), ["az azonosító típusa csak ISBN vagy ISSN lehet"]);
assert.deepEqual(T.componentIssues(d("magazin"), { azonosito:"", azonosito_tipus:null }, name), []);        // üres azonosítónál a típus nem számít
assert.deepEqual(T.componentIssues(d("figura"), { megnevezes:" " }, name).map(x=>x.kod), ["mezo_hianyzik"]);
assert.deepEqual(T.componentIssues(d("figura"), { megnevezes:"Chase", azonosito:"F1" }, name).map(x=>x.kod), ["azonosito_tipus"]);
assert.deepEqual(T.componentIssues(null, { azonosito:"x" }, name), []);

// --- a Modell neve: üres megnevezésnél a Szám címe
assert.equal(T.fallbackName(d("modell"), { megnevezes:null }, "Dodge Charger R/T (1970)"), "Dodge Charger R/T (1970)");
assert.equal(T.fallbackName(d("modell"), { megnevezes:"Saját név" }, "Cím"), "Saját név");
assert.equal(T.fallbackName(d("figura"), { megnevezes:"" }, "Cím"), null);
assert.equal(T.fallbackName(d("modell"), { megnevezes:"" }, ""), null);

// --- sorozat-azonosítók
assert.equal(T.seriesIdsError([]), null);
assert.equal(T.seriesIdsError([{ tipus:"issn", ertek:"3103-4152" }, { tipus:"isbn", ertek:"978-88-334-2749-2" }]), null);
assert.equal(T.seriesIdsError([{ tipus:"isbn", ertek:"963123456X" }]), null);
for (const bad of [[{ tipus:"issn", ertek:"1" }, { tipus:"issn", ertek:"2" }, { tipus:"issn", ertek:"3" }], [{ tipus:"vonalkod", ertek:"1" }], [{ tipus:"", ertek:"3103-4152" }],
  [{ tipus:"issn", ertek:"" }], [{ tipus:"issn", ertek:"12345" }], [{ tipus:"isbn", ertek:"978-88-334" }], [{ tipus:"issn", ertek:"3103-4152" }, { tipus:"issn", ertek:"31034152" }]])
  assert.equal(typeof T.seriesIdsError(bad), "string", JSON.stringify(bad));
assert.deepEqual(T.cleanSeriesIds([{ tipus:"issn", ertek:" 3103-4152 " }, { tipus:"", ertek:"" }, null]), [{ tipus:"issn", ertek:"3103-4152" }]);
assert.equal(T.formatSeriesIds([{ tipus:"issn", ertek:"3103-4152" }, { tipus:"isbn", ertek:"978-88-334-2749-2" }]), "ISSN 3103-4152 · ISBN 978-88-334-2749-2");
assert.equal(T.formatSeriesIds(null), "");

// --- oda-vissza sablon: a Kártya mezői oszlopként, Figuránál nincs azonosító-oszlop
const info = t => ({ noId: T.idMode(d(t)).mode === "nincs", extra: T.extraFields(d(t)).map(f => ({ key:f.key, label:f.label, kind:f.kind })) });
const U = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const items = [{ id:U(1), lapszam:29, cim:"2025. 5.szám", megjelenes:"2025-08-01", eredeti_ar:1999, comps:[
  { id:U(11), tipus:"magazin", azonosito:null, megnevezes:null, adatok:{} },
  { id:U(12), tipus:"krtya", azonosito:"LE19", azonosito_tipus:"kartya_kod", megnevezes:"Bo-Katan Kryze", adatok:{ gyujtemeny:"Régi" } },
  { id:U(13), tipus:"figura", azonosito:null, megnevezes:null, adatok:{} }] }];
const M = P.templateModel(items, ["magazin", "krtya", "figura"], t => ({ magazin:"Magazin", krtya:"Kártya", figura:"Figura" }[t]), info);
assert(M.header.includes("Kártya #1 Gyűjtemény") && M.header.includes("Kártya #1 Kiadás éve") && M.header.includes("Kártya #1 azonosító"));
assert(!M.header.includes("Figura #1 azonosító") && M.header.includes("Figura #1 megnevezés"));
assert.equal(M.rows[0][M.header.indexOf("Kártya #1 Gyűjtemény")], "Régi");
// módosítás az Excelben: Gyűjtemény átírva, Kiadás éve kitöltve, Széria üresen marad (üres cella nem töröl)
const aoa = [M.header, M.rows[0].slice()];
aoa[1][M.header.indexOf("Kártya #1 Gyűjtemény")] = "Új gyűjtemény";
aoa[1][M.header.indexOf("Kártya #1 Kiadás éve")] = "2025";
aoa[1][M.header.indexOf("Magazin #1 azonosító")] = "2568-2474";
const parsed = P.rowsFromAoa(aoa, P.resolveColumns(aoa[0], M.colmap), { date:x=>x||null, number:x=>(x===""?null:+x) });
const plan = P.planUpload({ rows:parsed.rows, items });
const kop = plan.ops[0].compOps.find(c => c.tipus === "krtya");
assert.deepEqual(kop.patch, { adatok:{ gyujtemeny:"Új gyűjtemény", kiadas_eve:2025 } });
const pay = P.buildPayload(plan);
assert.deepEqual(pay.items[0].comps.find(c => c.id === U(12)), { id:U(12), adatok:{ gyujtemeny:"Új gyűjtemény", kiadas_eve:2025 } });
// a Magazin azonosítót kap, de nincs azonosító-típusa → jelzés; a Könyvnél az alap (ISBN) miatt nincs
const allowedOf = t => { const m = T.idMode(d(t)); return m.mode === "fix" || m.mode === "valaszthato" ? m.types : null; };
const idTypeOf = (t, cur) => cur || T.defaultIdType(d(t), null);
assert.deepEqual(P.idTypeGaps(plan, idTypeOf, allowedOf), [{ lapszam:29, tipus:"magazin", k:1 }]);
// változatlan fájl → nincs változás; a régi (adatok nélküli) ujjlenyomat nem változik az üres adatok mezőtől
assert.equal(P.planUpload({ rows:P.rowsFromAoa([M.header, M.rows[0]], P.resolveColumns(M.header, M.colmap), { date:x=>x||null, number:x=>(x===""?null:+x) }).rows, items }).stats.frissul, 0);
const noAdat = JSON.parse(JSON.stringify(items)); noAdat[0].comps.forEach(c => { delete c.adatok; });
const emptyAdat = JSON.parse(JSON.stringify(items)); emptyAdat[0].comps.forEach(c => { c.adatok = {}; });
assert.equal(P.draftFingerprint(noAdat), P.draftFingerprint(emptyAdat));
assert.notEqual(P.draftFingerprint(items), P.draftFingerprint(emptyAdat));
console.log("OK — a típusleírás, a sorozat-azonosítók és a sablon típus-mezőinek tesztjei átmentek");
