// Az Összeg-kártya közös számításának tesztje (js/totals.js). Futtatás: node scripts/tests/totals.test.mjs
import assert from "node:assert/strict";
const { computeTotals } = await import("../../js/totals.js");

let n = 0;
const comp = (status, db = 1) => ({ id: "c" + (++n), status, db });
const issue = (o) => ({ id: "i" + (++n), deleted: false, eredeti_ar: null, fizetett_ar: null, besz_menny: 1, comps: {}, ...o });

// 1) részleges birtoklás (a magazin megvan, a lego nem): bekerül MINDKÉT nézetbe
{
  const t = computeTotals([issue({ eredeti_ar: 1999, fizetett_ar: 1999, comps: { magazin: [comp("megvan")], lego: [comp(null)] } })]);
  assert.equal(t.eredetiTotal, 1999); assert.equal(t.fizetettTotal, 1999);
  assert.equal(t.eredetiCount, 1); assert.equal(t.fizetettCount, 1); assert.equal(t.includedCount, 1);
}
// 2) semmi sincs meg (hiányzik / nem kell / jelöletlen): nem kerül be
{
  const t = computeTotals([
    issue({ eredeti_ar: 1000, fizetett_ar: 1000, comps: { magazin: [comp("hianyzik")], lego: [comp(null)] } }),
    issue({ eredeti_ar: 2000, fizetett_ar: 2000, comps: { magazin: [comp("nemkell")] } }),
    issue({ eredeti_ar: 3000, comps: {} }),
  ]);
  assert.equal(t.eredetiTotal, 0); assert.equal(t.fizetettTotal, 0); assert.equal(t.includedCount, 0);
  assert.equal(t.eredetiUnknown, false); assert.equal(t.fizetettUnknown, false);
}
// 3) több lego jelölve (komponens-db = 3), beszerzési mennyiség 1: EGYSZERES ár (a Lego SW #39 esete)
{
  const t = computeTotals([issue({ eredeti_ar: 1999, fizetett_ar: 1999, besz_menny: 1,
    comps: { magazin: [comp("megvan")], lego: [comp("megvan", 3)] } })]);
  assert.equal(t.eredetiTotal, 1999, "nem 5 997");
  assert.equal(t.fizetettTotal, 1999);
}
// 3b) két lego-példány, mindkettő megvan: továbbra is egyszeres ár (a #40 esete)
{
  const t = computeTotals([issue({ eredeti_ar: 2499, fizetett_ar: 2499, comps: { magazin: [comp("megvan")], lego: [comp("megvan", 2), comp("megvan", 2)] } })]);
  assert.equal(t.eredetiTotal, 2499); assert.equal(t.fizetettTotal, 2499);
}
// 4) beszerzési mennyiség 2: kétszeres ár MINDKÉT nézetben
{
  const t = computeTotals([issue({ eredeti_ar: 1500, fizetett_ar: 1200, besz_menny: 2, comps: { magazin: [comp("megvan")] } })]);
  assert.equal(t.eredetiTotal, 3000); assert.equal(t.fizetettTotal, 2400);
}
// 5) hiányzó ár: kimarad a Ft-összegből, a jelző be van kapcsolva, a count csak az ismert árúakat számolja
{
  const t = computeTotals([
    issue({ eredeti_ar: 1000, fizetett_ar: 900, comps: { magazin: [comp("megvan")] } }),
    issue({ eredeti_ar: null, fizetett_ar: 800, comps: { magazin: [comp("megvan")] } }),
    issue({ eredeti_ar: 700, fizetett_ar: null, comps: { magazin: [comp("megvan")] } }),
  ]);
  assert.equal(t.eredetiTotal, 1700); assert.equal(t.fizetettTotal, 1700);
  assert.equal(t.eredetiUnknown, true); assert.equal(t.fizetettUnknown, true);
  assert.equal(t.eredetiCount, 2); assert.equal(t.fizetettCount, 2); assert.equal(t.includedCount, 3);
}
// 6) törölt Szám: nem számít
{
  const t = computeTotals([issue({ deleted: true, eredeti_ar: 5000, fizetett_ar: 5000, comps: { magazin: [comp("megvan")] } })]);
  assert.equal(t.eredetiTotal, 0); assert.equal(t.fizetettTotal, 0); assert.equal(t.includedCount, 0);
}
// 7) hiányzó beszerzési mennyiség (null/undefined/0) = 1
{
  for (const besz of [null, undefined, 0]) {
    const t = computeTotals([issue({ eredeti_ar: 1000, fizetett_ar: 1000, besz_menny: besz, comps: { magazin: [comp("megvan")] } })]);
    assert.equal(t.eredetiTotal, 1000); assert.equal(t.fizetettTotal, 1000);
  }
}
// 8) a Lego Star Wars alakja: 39 magazin megvan (1 999 Ft), 3 lego megvan → a két nézet AZONOS halmazt összegez
{
  const items = [];
  for (let i = 1; i <= 42; i++) {
    const magOwned = i <= 39;
    items.push(issue({ eredeti_ar: 2000, fizetett_ar: magOwned ? 2000 : null,
      comps: { magazin: [comp(magOwned ? "megvan" : null)], lego: [comp(i >= 37 && i <= 39 ? "megvan" : null)] } }));
  }
  const t = computeTotals(items);
  assert.equal(t.includedCount, 39);
  assert.equal(t.eredetiTotal, 39 * 2000); assert.equal(t.fizetettTotal, 39 * 2000);
  assert.equal(t.eredetiTotal, t.fizetettTotal, "egyező halmaz → összehasonlítható");
}
// 9) üres lista
{
  const t = computeTotals([]);
  assert.deepEqual([t.eredetiTotal, t.fizetettTotal, t.includedCount], [0, 0, 0]);
}
console.log("OK — az összeg-függvény tesztjei átmentek (9 csoport)");
