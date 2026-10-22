// Az app saját üzenetablakának tiszta (DOM nélküli) része: a soros végrehajtó (makeSerialQueue).
// Futtatás: node scripts/tests/dialog.test.mjs
import assert from "node:assert/strict";
const { makeSerialQueue } = await import("../../js/dialog.js");

const log = [];
let release = [];                                  // a „bezárást” kívülről indítjuk
const run = item => new Promise(res => { log.push("nyit:" + item); release.push(() => { log.push("zár:" + item); res(item); }); });
const enqueue = makeSerialQueue(run);

const p1 = enqueue("A"), p2 = enqueue("B"), p3 = enqueue("C");
await Promise.resolve(); await Promise.resolve();
assert.deepEqual(log, ["nyit:A"], "egyszerre csak az első ablak van nyitva");
release.shift()();
assert.equal(await p1, "A", "az első Promise a bezáráskor teljesül");
await Promise.resolve(); await Promise.resolve();
assert.deepEqual(log, ["nyit:A", "zár:A", "nyit:B"], "a második csak az első bezárása után nyílik");
release.shift()(); await p2; await Promise.resolve(); await Promise.resolve();
release.shift()(); await p3;
assert.deepEqual(log, ["nyit:A", "zár:A", "nyit:B", "zár:B", "nyit:C", "zár:C"], "a sorrend a beérkezés sorrendje");

// Ha egy megjelenítés hibát dob, a sor nem akad el.
const q2 = makeSerialQueue(item => item === "rossz" ? Promise.reject(new Error("x")) : Promise.resolve(item));
await assert.rejects(q2("rossz"));
assert.equal(await q2("jó"), "jó", "egy hibás elem után a következő is megjelenik");
console.log("OK — a soros üzenetablak-sor tesztjei átmentek (4 eset)");
