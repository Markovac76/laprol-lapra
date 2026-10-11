// Sorozat-lista keresés/rendezés tesztje. Futtatás: node scripts/tests/series-list.test.mjs
import assert from "node:assert/strict";
const { normText, filterSeries, sortSeries, computeLastChanged, loadSort, saveSort, SORTS } = await import("../../js/series-sort.js");

const S = [
  { id: "1", megjelenites: "Forma 1", megnevezes: "Versenyautók - Forma 1", created_at: "2026-07-22T00:00:00Z" },
  { id: "2", megjelenites: "Mancs Őrjárat", megnevezes: "A Mancs Őrjárat küldetései", created_at: "2026-08-30T00:00:00Z" },
  { id: "3", megjelenites: "Lego Star Wars", megnevezes: "Lego Star Wars Magazin", created_at: "2026-08-11T00:00:00Z" },
  { id: "4", megjelenites: "Csodálatos Világ", megnevezes: "Csodálatos Világ", created_at: "2026-09-01T00:00:00Z" },
  { id: "5", megjelenites: "Zsiráf", megnevezes: "Zsiráf", created_at: "2026-09-02T00:00:00Z" },
  { id: "6", megjelenites: "Cirkusz", megnevezes: "Cirkusz", created_at: "2026-09-03T00:00:00Z" },
  { id: "7", megjelenites: "Dzsungel", megnevezes: "Dzsungel", created_at: "2026-09-04T00:00:00Z" },
];
// keresés: kis/nagybetű és ékezetfüggetlen, részleges
assert.deepEqual(filterSeries(S, "forma").map(s => s.id), ["1"]);
assert.deepEqual(filterSeries(S, "FORMA 1").map(s => s.id), ["1"]);
assert.deepEqual(filterSeries(S, "orjarat").map(s => s.id), ["2"], "ékezet nélkül is");
assert.deepEqual(filterSeries(S, "Örjárat").map(s => s.id), ["2"]);
assert.deepEqual(filterSeries(S, "csodalatos").map(s => s.id), ["4"]);
assert.deepEqual(filterSeries(S, "versenyauto").map(s => s.id), ["1"], "a teljes névre is keres");
assert.equal(filterSeries(S, "").length, 7); assert.equal(filterSeries(S, "   ").length, 7);
assert.equal(filterSeries(S, "nincs ilyen").length, 0);
assert.equal(normText("  Őrjárat  Ű "), "orjarat u");
// ABC: magyar sorrend (Cirkusz < Csodálatos < Dzsungel < Forma < Lego < Mancs < Zsiráf)
assert.deepEqual(sortSeries(S, "abc").map(s => s.megjelenites),
  ["Cirkusz", "Csodálatos Világ", "Dzsungel", "Forma 1", "Lego Star Wars", "Mancs Őrjárat", "Zsiráf"]);
// Számok száma szerint (csökkenő, döntetlennél ABC)
assert.deepEqual(sortSeries(S, "szamok", { counts: { "1": 60, "2": 20, "3": 42, "4": 60 } }).slice(0, 4).map(s => s.id), ["4", "1", "3", "2"]);
// legutóbb módosított (csökkenő; nincs bejegyzés → létrehozás ideje)
{
  const last = { "1": "2026-10-09T10:00:00Z", "3": "2026-10-10T12:00:00Z" };
  const r = sortSeries(S, "modositva", { last }).map(s => s.id);
  assert.deepEqual(r.slice(0, 2), ["3", "1"]);                       // a legfrissebb módosítások elöl
  assert.deepEqual(r.slice(2), ["7", "6", "5", "4", "2"]);           // a többi a létrehozás ideje szerint, újabb elöl
}
// computeLastChanged: sorozat / Szám / komponens szint
{
  const issues = [{ id: "i1", series_id: "1" }, { id: "i2", series_id: "3" }];
  const comps = [{ id: "c1", issue_id: "i1" }, { id: "c2", issue_id: "i2" }];
  const ch = [
    { entity_type: "issue", entity_id: "i1", changed_at: "2026-09-01T00:00:00Z" },
    { entity_type: "component", entity_id: "c1", changed_at: "2026-10-01T00:00:00Z" },
    { entity_type: "series", entity_id: "3", changed_at: "2026-09-15T00:00:00Z" },
    { entity_type: "component", entity_id: "c2", changed_at: "2026-09-20T00:00:00Z" },
    { entity_type: "issue", entity_id: "ismeretlen", changed_at: "2027-01-01T00:00:00Z" },
  ];
  assert.deepEqual(computeLastChanged(ch, issues, comps), { "1": "2026-10-01T00:00:00Z", "3": "2026-09-20T00:00:00Z" });
}
// megjegyzett választás: tárolás nélkül (localStorage hiányzik / hibát dob) is működik
assert.equal(loadSort(), "abc");
globalThis.localStorage = { getItem(){ throw new Error("blocked"); }, setItem(){ throw new Error("blocked"); } };
assert.equal(loadSort(), "abc"); saveSort("szamok");                     // nem dob
const mem = {}; globalThis.localStorage = { getItem: k => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } };
saveSort("modositva"); assert.equal(loadSort(), "modositva");
mem["laprol.serieslist.sort"] = "ervenytelen"; assert.equal(loadSort(), "abc");
assert.equal(SORTS.length, 3);
console.log("OK — a sorozat-lista keresés/rendezés tesztjei átmentek");
