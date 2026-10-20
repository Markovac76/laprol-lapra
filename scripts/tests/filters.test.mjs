// A „Jelöletlen” szűrő tiszta függvényének (issueHasUnmarked) tesztje. Futtatás: node scripts/tests/filters.test.mjs
import assert from "node:assert/strict";
const RealDate = Date;
let FIXED = RealDate.parse("2026-10-20T12:00:00+02:00");           // a „ma” rögzítve: 2026-10-20 (helyi idő)
globalThis.Date = class extends RealDate {
  constructor(...a){ if(a.length) super(...a); else super(FIXED); }
  static now(){ return FIXED; }
};
const { issueHasUnmarked } = await import("../../js/state.js");
const s = { components: ["magazin", "figura"] };
const C = (status, o = {}) => ({ id: Math.random().toString(36).slice(2), status, ...o });
const it = (comps, date = "2026-10-01") => ({ n: 1, date, comps });
let n = 0; const ok = (v, exp, msg) => { assert.equal(v, exp, msg); n++; };

ok(issueHasUnmarked(it({ magazin: [C("megvan")], figura: [C("nemkell")] }), s), false, "minden elem megjelölve → hamis");
ok(issueHasUnmarked(it({ magazin: [C(null)] }), s), true, "egyetlen, jelöletlen elem → igaz");
ok(issueHasUnmarked(it({ magazin: [C("megvan")], figura: [C("hianyzik"), C(undefined)] }), s), true, "több elemből egy jelöletlen → igaz");
ok(issueHasUnmarked(it({ magazin: [C(null)] }, "2026-10-21"), s), false, "jövőbeli (holnapi) dátumú Szám jelöletlennel → hamis");
ok(issueHasUnmarked(it({ magazin: [C(null)] }, "2026-10-20"), s), true, "mai dátumú, jelöletlen Szám → igaz (a mai Szám megjelent)");
ok(issueHasUnmarked(it({ magazin: [C("megvan")], figura: [C(null, { is_deleted: true })] }), s), false, "törölt, jelöletlen komponens → nem számít");
ok(issueHasUnmarked(it({}), s), false, "nincs komponens → hamis");
ok(issueHasUnmarked(it(undefined), s), false, "nincs comps mező → hamis");
ok(issueHasUnmarked(it({ magazin: [C("megvan")], egyeb: [C(null)] }), s), true, "a sablonon kívüli (külön hozzáadott) típusú jelöletlen elem is számít");
ok(issueHasUnmarked(it({ magazin: [C(null)] }, null), s), true, "dátum nélküli, jelöletlen Szám → igaz (megjelentnek számít)");
console.log(`OK — a Jelöletlen szűrő ${n} esete átment`);
