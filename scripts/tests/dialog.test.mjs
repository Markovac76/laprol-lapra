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
// D kör / 2: üzenet és megerősítő kérdés vegyesen, közös sorban. A kérdés megvárja a nyitott
// hibaablakot (nem csúszik rá), az eredménye (igen / nem) a saját Promise-án jön vissza.
const log2 = []; const rel2 = [];
const run2 = item => new Promise(res => { log2.push("nyit:" + item.kind); rel2.push(v => { log2.push("zár:" + item.kind); res(item.kind === "confirm" ? v === true : undefined); }); });
const q3 = makeSerialQueue(run2);
const m1 = q3({ kind: "message" }), c1 = q3({ kind: "confirm" }), m2 = q3({ kind: "message" }), c2 = q3({ kind: "confirm" });
await Promise.resolve(); await Promise.resolve();
assert.deepEqual(log2, ["nyit:message"], "a kérdés nem nyílik meg, amíg a hibaablak nyitva van");
rel2.shift()(); assert.equal(await m1, undefined);
await Promise.resolve(); await Promise.resolve();
assert.deepEqual(log2, ["nyit:message", "zár:message", "nyit:confirm"], "a hibaablak bezárása után jön a kérdés");
rel2.shift()(true); assert.equal(await c1, true, "OK → igaz");
await Promise.resolve(); await Promise.resolve();
rel2.shift()(); await m2; await Promise.resolve(); await Promise.resolve();
rel2.shift()(false); assert.equal(await c2, false, "Mégse / Esc / háttér → hamis");
assert.deepEqual(log2, ["nyit:message", "zár:message", "nyit:confirm", "zár:confirm", "nyit:message", "zár:message", "nyit:confirm", "zár:confirm"], "vegyes sorrend: a beérkezés sorrendje");
console.log("OK — a soros üzenetablak-sor tesztjei átmentek (5 eset, üzenet és kérdés vegyesen is)");
