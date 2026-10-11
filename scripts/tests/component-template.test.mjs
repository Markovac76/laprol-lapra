// A komponens-sablon tiszta logikájának és a sablon szerinti színezésnek a tesztje.
// Futtatás: node scripts/tests/component-template.test.mjs
import assert from "node:assert/strict";
const T = await import("../../js/component-template.js");
const { issueState, colorTypeSets, state } = await import("../../js/state.js");

// --- alapértelmezett sablon = a mostani viselkedés
let d = T.defaultTemplate(["magazin", "lego"], { lego: { default_azonosito_tipus: "lego_kd" } });
assert.deepEqual(d.map(e => [e.tipus, e.main, e.required, e.id_rule, e.counts_for_color, e.default_azonosito_tipus]),
  [["magazin", true, true, "nincs", false, null], ["lego", false, true, "nincs", true, "lego_kd"]]);
assert.equal(T.templateError(d), null);
d = T.defaultTemplate(["konyv", "figura"]); assert.equal(d.find(e => e.main).tipus, "konyv");
d = T.defaultTemplate(["figura", "modell"]); assert.equal(d.find(e => e.main).tipus, "figura");
d = T.defaultTemplate(["magazin"]); assert.equal(d[0].counts_for_color, true, "csak magazin: számít");
assert.deepEqual(T.defaultTemplate([]), []);

// --- érvényesség
assert.match(T.templateError([]), /legalább 1/);
assert.match(T.templateError([{ tipus: "a", main: true }, { tipus: "a" }]), /kétszer/);
assert.match(T.templateError([{ tipus: "a" }]), /pontosan egy/);
assert.match(T.templateError([{ tipus: "a", main: true }, { tipus: "b", main: true }]), /pontosan egy/);
assert.match(T.templateError([{ tipus: "a", main: true, id_rule: "x" }]), /azonosító-szabály/);
assert.equal(T.templateError([{ tipus: "a", main: true }]), null);

// --- műveletek
let t = T.defaultTemplate(["magazin", "lego"]);
t = T.addType(t, "krtya"); assert.deepEqual(T.templateTypes(t), ["magazin", "lego", "krtya"]); assert.equal(T.templateError(t), null);
t = T.setMain(t, "lego"); assert.equal(t.find(e => e.main).tipus, "lego"); assert.equal(t.filter(e => e.main).length, 1);
t = T.removeType(t, "lego");                                  // a fő típus esett ki → tartalék szabály
assert.equal(t.find(e => e.main).tipus, "magazin"); assert.equal(T.templateError(t), null);
t = T.move(t, 1, -1); assert.deepEqual(T.templateTypes(t), ["krtya", "magazin"]);
t = T.move(t, 0, -1); assert.deepEqual(T.templateTypes(t), ["krtya", "magazin"], "szélen nem mozdul");
t = T.setField(t, "krtya", "id_rule", "kotelezo"); assert.equal(t.find(e => e.tipus === "krtya").id_rule, "kotelezo");

// --- új Szám kiinduló komponensei: csak a KÖTELEZŐk, alapértelmezésekkel, fő elem a sablon fő típusa
const tt = [{ tipus: "konyv", main: true, required: true, default_azonosito_tipus: "isbn" },
            { tipus: "figura", main: false, required: false, default_megnevezes: "Figura-csomag" },
            { tipus: "karta", main: false, required: true, default_megnevezes: "Limited" }];
const ic = T.initialComponents(tt);
assert.deepEqual(ic.map(c => [c.tipus, c.azonosito_tipus, c.megnevezes, c.is_main]), [["konyv", "isbn", "", true], ["karta", null, "Limited", false]]);

// --- színezés a sablon szerint
const comp = status => ({ status, db: 1 });
const it = comps => ({ date: "2020-01-01", comps });
// legacy (sablon nélkül): a magazin nem számít, csak a lego
assert.equal(issueState(it({ magazin: [comp("megvan")], lego: [comp("megvan")] }), { components: ["magazin", "lego"] }), "megvan");
assert.equal(issueState(it({ magazin: [comp("megvan")], lego: [comp("hianyzik")] }), { components: ["magazin", "lego"] }), "reszleges");
assert.equal(issueState(it({ magazin: [comp("hianyzik")], lego: [comp("hianyzik")] }), { components: ["magazin", "lego"] }), "hianyzik");
assert.equal(issueState(it({ magazin: [comp("megvan")], lego: [comp(null)] }), { components: ["magazin", "lego"] }), null);
// sablonnal: a "számít a színnél" jelző dönt
const s2 = { components: ["magazin", "lego"], template: T.setField(T.setField(T.defaultTemplate(["magazin", "lego"]), "magazin", "counts_for_color", true), "lego", "counts_for_color", false) };
assert.equal(issueState(it({ magazin: [comp("megvan")], lego: [comp("hianyzik")] }), s2), "megvan", "most a magazin számít, a lego nem");
assert.equal(issueState(it({ magazin: [comp("hianyzik")], lego: [comp("megvan")] }), s2), "reszleges");
// ha a Számon nincs a színnél számító komponens, az összes komponens a domináns
const s3 = { components: ["magazin", "lego"], template: T.defaultTemplate(["magazin", "lego"]) };
assert.equal(issueState(it({ magazin: [comp("megvan")] }), s3), "megvan");
assert.equal(issueState(it({ magazin: [comp("hianyzik")] }), s3), "hianyzik");
// nem deklarált típus (külön hozzáadott kártya) a színt NEM befolyásolja
assert.equal(issueState(it({ magazin: [comp("megvan")], lego: [comp("megvan")], krtya: [comp("hianyzik")] }), s3), "megvan");
// jövőbeli Szám semleges
assert.equal(issueState({ date: "2999-01-01", comps: { lego: [comp("megvan")] } }, s3), null);
// csak magazin: számít
assert.equal(issueState(it({ magazin: [comp("megvan")] }), { components: ["magazin"] }), "megvan");
const cs = colorTypeSets({ components: ["magazin", "lego"] });
assert.deepEqual([...cs.color], ["lego"]); assert.deepEqual([...cs.non], ["magazin"]);
console.log("OK — a komponens-sablon és a sablon szerinti színezés tesztjei átmentek");
