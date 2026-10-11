// A sorozat-modell tesztje: a TÖRÖLT komponens sehol nem jelenik meg (számlálók, haladás, szín, összeg),
// a változatlan adatokon minden azonos. Futtatás: node scripts/tests/model.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
const { buildSeriesModel } = await import("../../js/model.js");
const st = await import("../../js/state.js");
const { computeTotals } = await import("../../js/totals.js");
const src = fs.readFileSync(new URL("../../js/data.js", import.meta.url), "utf8");
const a = src.indexOf("export function stats(si){"), b = src.indexOf("\n}\n", a) + 3;
const mkStats = state => new Function("state", "isFutureDate", "issueState", "compsOfType", "computeTotals",
  src.slice(a, b).replace("export function stats", "function stats") + "\nreturn stats;")(state, st.isFutureDate, st.issueState, st.compsOfType, computeTotals);

const series = [{ id: "s1", megnevezes: "Lego", megjelenites: "Lego", components: ["magazin", "lego"], component_template: [], version: 1 }];
const issues = [1, 2, 3].map(n => ({ id: "i" + n, series_id: "s1", lapszam: n, cim: "C" + n, megjelenes: "2020-01-0" + n, eredeti_ar: 1000, version: 1, is_deleted: false }));
const mk = (id, issue_id, tipus, o = {}) => ({ id, issue_id, tipus, is_main: tipus === "magazin", is_deleted: false, version: 1, created_at: "2026-01-01T00:00:00Z", ...o });
const comps = [
  mk("m1", "i1", "magazin"), mk("l1", "i1", "lego"),
  mk("m2", "i2", "magazin"), mk("l2", "i2", "lego"),
  mk("m3", "i3", "magazin"), mk("l3", "i3", "lego"),
];
const myStatus = { m1: { status: "megvan", db: 1 }, l1: { status: "megvan", db: 1 }, m2: { status: "megvan", db: 1 }, l2: { status: "hianyzik", db: 1 }, m3: { status: null, db: 1 }, l3: { status: null, db: 1 } };
const build = rows => buildSeriesModel({ series, issues, comps: rows, myStatus, myIssue: { i1: { fizetett_ar: 900, besz_menny: 1 }, i2: { fizetett_ar: 800, besz_menny: 1 } }, selectedIds: new Set(["s1"]) });
const snapshot = rows => {
  const state = { SERIES: build(rows) };
  const stats = mkStats(state)(0), s = state.SERIES[0];
  return {
    n: s.items.flatMap(i => Object.values(i.comps).flat()).length,
    colors: s.items.map(i => st.issueState(i, s)).join(","),
    progress: Object.entries(stats.perType).map(([t, p]) => `${t}=${p.owned}/${p.total}`).join(" "),
    total: `E${stats.eredetiTotal} F${stats.fizetettTotal}`,
    ids: s.items.flatMap(i => Object.values(i.comps).flat().map(c => c.id)),
  };
};

// 1) alap
const base = snapshot(comps);
assert.equal(base.n, 6); assert.equal(base.colors, "megvan,reszleges,"); assert.equal(base.progress, "magazin=2/3 lego=1/3"); assert.equal(base.total, "E2000 F1700");

// 2) a TÖRÖLT komponens (l1, a #1 lego-ja, megvan) eltűnik mindenhonnan; a többi változatlan
const del = snapshot(comps.map(c => c.id === "l1" ? { ...c, is_deleted: true } : c));
assert.equal(del.n, 5); assert(!del.ids.includes("l1"), "a törölt komponens nincs a modellben");
assert.equal(del.progress, "magazin=2/3 lego=0/2", "a lego nevezője: csak az ilyen komponenst tartalmazó Számok");
assert.equal(del.colors, "megvan,reszleges,", "a #1 színe a megmaradt magazinból jön (a számító lego hiányában az összes komponens)");
assert.equal(del.total, base.total, "az összeg a Számokra számol (a magazin megvan)");

// 3) ha a #1 egyetlen megvan-komponensét töröljük, az összegből is kiesik
const only = snapshot(comps.filter(c => c.id !== "l1").map(c => c.id === "m1" ? { ...c, is_deleted: true } : c));
assert.equal(only.total, "E1000 F800");
assert.equal(only.n, 4);

// 4) a személyes adat (myStatus) a törölt komponensre megmarad az adatokban, csak a modellből kimarad
assert.equal(myStatus.l1.status, "megvan");

// 5) a törölt-jelölés nélküli sorok bármilyen sorrendben ugyanazt adják
assert.deepEqual(snapshot([...comps].reverse()).colors, base.colors);
console.log("OK — a sorozat-modell tesztjei átmentek (törölt komponens kiszűrve)");
