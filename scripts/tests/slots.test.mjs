// A Szám-sor elem-helyeinek tesztje (fő elem, sorrend, +N, címkék). Futtatás: node scripts/tests/slots.test.mjs
import assert from "node:assert/strict";
const { issueSlots, orderedComps, mainEntry, state } = await import("../../js/state.js");
state.LISTS = { komponens: [{ ertek:"figura", nev:"Figura" }, { ertek:"lego", nev:"Lego" }, { ertek:"krtya", nev:"Kártya" }] };

let n = 0;
const C = (o = {}) => ({ id: "c" + (++n), status: null, db: 1, megnevezes: null, is_main: false, ...o });
const it = comps => ({ n: 1, comps });

// 1) Mancs Őrjárat: könyv + figura → a könyv a fő elem (nincs magazin), 2 elem, nincs +N
{
  const s = { components: ["konyv", "figura"] };
  const r = issueSlots(it({ konyv: [C()], figura: [C()] }), s);
  assert.deepEqual(r.shown.map(x => x.t), ["konyv", "figura"]);
  assert.equal(r.shown[0].isMain, true); assert.equal(r.shown[1].isMain, false);
  assert.equal(r.extra, 0);
  assert.deepEqual(r.shown.map(x => x.label), ["Könyv", "Figura"]);
}
// 2) Lego Star Wars: magazin + lego → magazin az első
{
  const s = { components: ["magazin", "lego"] };
  const r = issueSlots(it({ lego: [C()], magazin: [C()] }), s);
  assert.equal(r.shown[0].t, "magazin"); assert.equal(r.shown[0].isMain, true);
}
// 3) Autós Legendák: 1 elem (könyv) = fő elem
{
  const r = issueSlots(it({ konyv: [C()] }), { components: ["konyv"] });
  assert.equal(r.shown.length, 1); assert.equal(r.shown[0].isMain, true); assert.equal(r.extra, 0);
}
// 4) 5 elem: az első három látszik, +2; a fő elem az első akkor is, ha a típus-sorrendben hátul áll
{
  const s = { components: ["figura", "karta", "magazin", "poszter", "matrica"] };
  const r = issueSlots(it({ figura: [C()], karta: [C()], magazin: [C()], poszter: [C()], matrica: [C()] }), s);
  assert.equal(r.all.length, 5); assert.equal(r.shown.length, 3); assert.equal(r.extra, 2);
  assert.equal(r.shown[0].t, "magazin", "magazin fő elem, előre kerül");
  assert.deepEqual(r.shown.slice(1).map(x => x.t), ["figura", "karta"]);
}
// 5) a jelölt (is_main) elem erősebb a tartalék szabálynál
{
  const s = { components: ["magazin", "lego"] };
  const lego = C({ is_main: true });
  const r = issueSlots(it({ magazin: [C()], lego: [lego] }), s);
  assert.equal(r.shown[0].t, "lego"); assert.equal(r.shown[0].c, lego);
}
// 6) két magazin: az első (létrehozási sorrend) a fő elem; azonos típusnál "Típus #N", megnevezéssel a megnevezés
{
  const m1 = C(), m2 = C({ megnevezes: "Különkiadás" });
  const r = issueSlots(it({ magazin: [m1, m2] }), { components: ["magazin"] });
  assert.equal(r.shown[0].c, m1); assert.equal(r.shown[0].label, "Magazin #1");
  assert.equal(r.shown[1].label, "Különkiadás");
}
// 7) nem deklarált típus (pl. Limited Edition kártya) is megjelenik, a deklaráltak után
{
  const s = { components: ["magazin", "lego"] };
  const r = issueSlots(it({ magazin: [C()], lego: [C()], krtya: [C({ megnevezes: "Limited Ed." })] }), s);
  assert.deepEqual(r.all.map(x => x.t), ["magazin", "lego", "krtya"]);
  assert.equal(r.all[2].label, "Limited Ed.");
}
// 8) a régi (legacy) pozíció — a komponens-kód alapja — nem függ a fő elem előre vételétől
{
  const s = { components: ["figura", "magazin"] };
  const r = issueSlots(it({ figura: [C()], magazin: [C()] }), s);
  assert.equal(r.shown[0].t, "magazin"); assert.equal(r.shown[0].legacyIdx, 2);
  assert.equal(r.shown[1].t, "figura");  assert.equal(r.shown[1].legacyIdx, 1);
}
// 9) komponens nélküli Szám: nincs hely, nincs hiba
{
  const r = issueSlots(it({}), { components: ["konyv"] });
  assert.equal(r.shown.length, 0); assert.equal(r.extra, 0);
}
// 10) mainEntry: üres lista → null
assert.equal(mainEntry([]), null);
console.log("OK — a Szám-sor elem-helyeinek tesztjei átmentek (10 csoport)");
