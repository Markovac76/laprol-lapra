// A haladásjelzők (stats().perType) tesztje: nevező = azok a Számok, amelyeken van ilyen típusú komponens;
// a Számokon külön hozzáadott típus saját jelzőt kap. Futtatás: node scripts/tests/progress.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
const st = await import("../../js/state.js");
const { computeTotals } = await import("../../js/totals.js");
const src = fs.readFileSync(new URL("../../js/data.js", import.meta.url), "utf8");
const a = src.indexOf("export function stats(si){"), b = src.indexOf("\n}\n", a) + 3;
const make = state => new Function("state", "isFutureDate", "issueState", "compsOfType", "computeTotals",
  src.slice(a, b).replace("export function stats", "function stats") + "\nreturn stats;")(state, st.isFutureDate, st.issueState, st.compsOfType, computeTotals);

let k = 0;
const C = (status) => ({ id: "c" + (++k), status, db: 1 });
const item = (n, comps) => ({ n, deleted: false, date: "2020-01-01", eredeti_ar: 100, fizetett_ar: null, besz_menny: 1, comps });
const series = items => ({ components: ["magazin", "lego"], template: [], items });

// 1) minden Számon van mindkét típus: a nevező az összes Szám (a mostani viselkedés)
let s = series([item(1, { magazin: [C("megvan")], lego: [C("megvan")] }), item(2, { magazin: [C("megvan")], lego: [C(null)] }), item(3, { magazin: [C(null)], lego: [C(null)] })]);
let p = make({ SERIES: [s] })(0).perType;
assert.deepEqual(p, { magazin: { owned: 2, total: 3 }, lego: { owned: 1, total: 3 } });

// 2) egy Számon NINCS lego komponens: a nevező csak azokat a Számokat számolja, amelyeken van
s = series([item(1, { magazin: [C("megvan")], lego: [C("megvan")] }), item(2, { magazin: [C("megvan")] })]);
p = make({ SERIES: [s] })(0).perType;
assert.deepEqual(p, { magazin: { owned: 2, total: 2 }, lego: { owned: 1, total: 1 } });

// 3) külön hozzáadott típus (kártya a #1-en): saját jelzőt kap, a deklaráltak számai nem változnak
s = series([item(1, { magazin: [C("megvan")], lego: [C("megvan")], krtya: [C("hianyzik")] }), item(2, { magazin: [C(null)], lego: [C(null)] })]);
p = make({ SERIES: [s] })(0).perType;
assert.deepEqual(Object.keys(p), ["magazin", "lego", "krtya"]);
assert.deepEqual(p.krtya, { owned: 0, total: 1 });
assert.deepEqual(p.magazin, { owned: 1, total: 2 });

// 4) a törölt Szám nem számít a nevezőbe
s = series([item(1, { magazin: [C("megvan")] }), { ...item(2, { magazin: [C("megvan")] }), deleted: true }]);
p = make({ SERIES: [s] })(0).perType;
assert.deepEqual(p.magazin, { owned: 1, total: 1 });

// 5) több példány egy típusból: csak akkor owned, ha MINDEGYIK megvan
s = series([item(1, { magazin: [C("megvan")], lego: [C("megvan"), C(null)] })]);
p = make({ SERIES: [s] })(0).perType;
assert.deepEqual(p.lego, { owned: 0, total: 1 });
console.log("OK — a haladásjelzők tesztjei átmentek");
