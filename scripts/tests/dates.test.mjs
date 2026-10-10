// Dátumkezelés tesztje (helyi nap, a mai dátumú Szám "megjelent"). Futtatás: node scripts/tests/dates.test.mjs
import assert from "node:assert/strict";
const RealDate = Date;
let FIXED = null;
globalThis.Date = class extends RealDate {
  constructor(...a){ if(a.length) super(...a); else super(FIXED); }
  static now(){ return FIXED; }
};
const { localISO, today, isFutureDate } = await import("../../js/state.js");
const at = iso => { FIXED = RealDate.parse(iso); };

// Magyar helyi idő (CEST, +02:00): 2026-10-11 00:37 = UTC 2026-10-10 22:37
at("2026-10-11T00:37:00+02:00");
assert.equal(new RealDate(FIXED).toISOString().slice(0,10), "2026-10-10", "a régi UTC-s érték 'tegnap' lenne");
assert.equal(today(), "2026-10-11", "a helyi dátum okt. 11.");
assert.equal(isFutureDate("2026-10-10"), false, "a tegnapi Szám megjelent");
assert.equal(isFutureDate("2026-10-11"), false, "a MAI dátumú Szám megjelent, nem várható");
assert.equal(isFutureDate("2026-10-12"), true, "a holnapi várható");
assert.equal(isFutureDate(null), false);
assert.equal(isFutureDate(""), false);

// a szűrő-számlálás az autós példán: #1 okt.3, #2 okt.10, #3 okt.17 ... (60 db)
const dates = ["2026-10-03","2026-10-10"]; for (let i=0;i<58;i++){ const d=new RealDate(Date.UTC(2026,9,17+7*i)); dates.push(d.toISOString().slice(0,10)); }
assert.equal(dates.filter(isFutureDate).length, 58, "Várható = 58, nem 59");
assert.equal(dates.length - dates.filter(isFutureDate).length, 2, "2 megjelent");

// éjfél előtt / után
at("2026-10-10T23:59:59+02:00"); assert.equal(today(), "2026-10-10");
at("2026-10-11T00:00:01+02:00"); assert.equal(today(), "2026-10-11");
// télre áttérés napja (CET, +01:00)
at("2026-12-31T23:30:00+01:00"); assert.equal(today(), "2026-12-31");
at("2027-01-01T00:30:00+01:00"); assert.equal(today(), "2027-01-01");
console.log("OK — minden dátum-teszt átment (TZ=" + (process.env.TZ||"rendszer") + ")");
