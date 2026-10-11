// A publikálás előtti összefoglaló tesztje (js/draft-diff.js). Futtatás: node scripts/tests/draft-diff.test.mjs
import assert from "node:assert/strict";
const { diffDraft, diffSummaryText } = await import("../../js/draft-diff.js");

const live = (id, lapszam, o = {}) => ({ id, lapszam, cim: "C" + lapszam, megjelenes: "2026-01-0" + (lapszam % 9 + 1), eredeti_ar: 1000, is_deleted: false, ...o });
const di = (src, lapszam, o = {}) => ({ id: "d" + lapszam + (src || "n"), source_issue_id: src, lapszam, cim: "C" + lapszam, megjelenes: "2026-01-0" + (lapszam % 9 + 1), eredeti_ar: 1000, deleted: false, comps: [], ...o });

const L = [live("a", 1), live("b", 2), live("c", 3), live("d", 4), live("e", 5, { is_deleted: true })];
const LC = [{ id: "ca", issue_id: "a", tipus: "konyv", azonosito_tipus: "isbn", azonosito: "978", megnevezes: null }];

// 1) változatlan draft (teljes másolat) → semmi sem változik
{
  const items = L.filter(i => !i.is_deleted).map(i => di(i.id, i.lapszam, { comps: i.id === "a" ? [{ source_component_id: "ca", tipus: "konyv", azonosito_tipus: "isbn", azonosito: "978", megnevezes: null }] : [] }));
  const r = diffDraft(items, L, LC);
  assert.deepEqual([r.uj, r.modosult, r.torolt, r.csakAtszamozva, r.valtozatlan], [0, 0, 0, 0, 4]);
  assert.equal(diffSummaryText(r), "nincs tartalmi változás");
}
// 2) vegyes: új, módosult (cím), törölt, csak átszámozott, komponens-módosítás, új komponens
{
  const items = [
    di("a", 1, { comps: [{ source_component_id: "ca", tipus: "konyv", azonosito_tipus: "isbn", azonosito: "979-NEW", megnevezes: null }] }), // komponens módosult
    di("b", 2, { cim: "Új cím" }),                                  // módosult
    di("c", 3, { deleted: true }),                                  // törölt
    di("d", 40, { cim: "C4" }),                                                  // csak a lapszám változik (4 → 40)
    di(null, 6),                                                    // új
    di(null, 7, { deleted: true }),                                 // új, de törlésre jelölt → kimarad
  ];
  const r = diffDraft(items, L, LC);
  assert.equal(r.uj, 1); assert.equal(r.modosult, 2); assert.equal(r.torolt, 1); assert.equal(r.csakAtszamozva, 1);
  assert.deepEqual(r.modosultLista.sort(), [1, 2]); assert.deepEqual(r.atszamozottLista, [40]); assert.deepEqual(r.ujLista, [6]);
  assert.equal(diffSummaryText(r), "1 új, 2 módosult, 1 törölt Szám (+ 1 Számon csak a lapszám változik — csendes átszámozás, felkiáltójel nélkül)");
}
// 3) lapszám ÉS tartalom változik → "módosult" (nem csendes)
{
  const r = diffDraft([di("a", 10, { cim: "Más" })], L, LC);
  assert.equal(r.modosult, 1); assert.equal(r.csakAtszamozva, 0);
}
// 4) a már törölt élő Szám törlésre jelölése nem változás; hiányzó élő Szám nem számít
{
  const r = diffDraft([di("e", 5, { deleted: true })], L, LC);
  assert.equal(r.torolt, 0); assert.equal(r.valtozatlan, 1);
  assert.equal(diffDraft([], L, LC).valtozatlan, 0);
}
// 5) új komponens egy meglévő Számon → módosult
{
  const r = diffDraft([di("b", 2, { comps: [{ source_component_id: null, tipus: "karta", azonosito: null, megnevezes: "Limited" }] })], L, LC);
  assert.equal(r.modosult, 1);
}
// 6) dátum / ár / null egyenlőség (IS DISTINCT FROM): null = null, "" ≠ null
{
  const r = diffDraft([di("b", 2, { megjelenes: null }), di("c", 3, { eredeti_ar: 1001 })], [live("b", 2, { megjelenes: null }), live("c", 3)], []);
  assert.equal(r.modosult, 1); assert.equal(r.valtozatlan, 1);
}
// 7) komponens törlése / visszaállítása: módosult (csendes), a törölt komponens egyéb mezői nem számítanak
{
  const LC2 = [{ id: "cx", issue_id: "b", tipus: "figura", azonosito_tipus: null, azonosito: null, megnevezes: null, is_deleted: false },
               { id: "cy", issue_id: "c", tipus: "figura", azonosito_tipus: null, azonosito: null, megnevezes: null, is_deleted: true }];
  let r = diffDraft([di("b", 2, { comps: [{ source_component_id: "cx", tipus: "figura", deleted: true }] })], L, LC2);
  assert.equal(r.modosult, 1);
  r = diffDraft([di("c", 3, { comps: [{ source_component_id: "cy", tipus: "figura", deleted: false }] })], L, LC2);
  assert.equal(r.modosult, 1, "visszaállítás");
  r = diffDraft([di("c", 3, { comps: [{ source_component_id: "cy", tipus: "figura", deleted: true, azonosito: "x" }] })], L, LC2);
  assert.equal(r.modosult, 0, "már törölt komponens törölt-jelölése nem változás");
}
console.log("OK — a publikálás-összefoglaló tesztjei átmentek (7 csoport)");
