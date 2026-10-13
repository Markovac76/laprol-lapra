// A verzióellenőrzés tiszta részeinek tesztje (judge, isBlocked), és a besorolási listák TELJESSÉGE a kódhoz képest:
// ha a kliens kódjában új .rpc("…") vagy Storage-hívás jelenik meg besorolás nélkül, ez a próba elbukik.
// Futtatás: node scripts/tests/version.test.mjs   (hálózat és adatbázis nélkül fut)
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const V = await import("../../js/version.js");
const JS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "js");
const B = "https://pelda.supabase.co";
let n = 0; const ok = (name, fn) => { fn(); n++; console.log("  ✔ " + name); };

// ---------- judge ----------
ok("judge: nincs futó verzió (helyi futtatás) → nincs jelzés", () => { assert.equal(V.judge("", { v: "abc" }), null); assert.equal(V.judge(undefined, { v: "abc" }), null); });
ok("judge: azonos verzió → nincs jelzés", () => assert.equal(V.judge("abc", { v: "abc" }), null));
ok("judge: eltérő verzió → régi, alapból „torzs” szinttel", () => assert.deepEqual(V.judge("abc", { v: "def" }), { v: "def", tilt: "torzs" }));
ok("judge: a tilt csak pontosan „minden” értékre lesz „minden”", () => {
  assert.equal(V.judge("a", { v: "b", tilt: "minden" }).tilt, "minden");
  for (const t of ["Minden", "MINDEN", "all", true, 1, null, undefined, ""]) assert.equal(V.judge("a", { v: "b", tilt: t }).tilt, "torzs");
});
ok("judge: hibás válasz (üres, hiányzó, nem szöveges verzió; nem objektum) → nincs jelzés", () => {
  for (const b of [null, undefined, "abc", 42, [], {}, { v: "" }, { v: "   " }, { v: 123 }, { v: null }, { verzio: "def" }]) assert.equal(V.judge("abc", b), null, JSON.stringify(b));
});
ok("judge: a verzió körüli szóköz nem számít eltérésnek", () => assert.equal(V.judge("abc", { v: " abc\n" }), null));

// ---------- isBlocked ----------
const blk = (m, p, t) => V.isBlocked(m, B + p, t);
ok("olvasás soha nem tiltott (tábla GET / HEAD), egyik szinten sem", () => {
  for (const t of ["torzs", "minden"]) for (const p of ["/rest/v1/series?select=*", "/rest/v1/draft_series?select=*", "/rest/v1/member_status?select=*", "/rest/v1/lists"])
    { assert.equal(blk("GET", p, t), false, p); assert.equal(blk("HEAD", p, t), false, p); }
});
ok("bejelentkezés, a belépés megújítása, kilépés soha nem tiltott", () => {
  for (const t of ["torzs", "minden"]) for (const p of ["/auth/v1/token?grant_type=password", "/auth/v1/token?grant_type=refresh_token", "/auth/v1/logout", "/auth/v1/signup", "/auth/v1/user"])
    for (const m of ["GET", "POST", "PUT"]) assert.equal(blk(m, p, t), false, m + " " + p);
});
ok("személyes táblák írása: „torzs” szinten megy, „minden” szinten tiltott", () => {
  for (const tab of V.SZEMELYES_TABLAK) for (const m of ["POST", "PATCH", "DELETE"]) {
    assert.equal(blk(m, `/rest/v1/${tab}?on_conflict=user_id`, "torzs"), false, m + " " + tab);
    assert.equal(blk(m, `/rest/v1/${tab}`, "minden"), true, m + " " + tab);
  }
});
ok("törzsadat-, munkaanyag-, Listák-, tag- és képjavaslat-tábla írása mindkét szinten tiltott", () => {
  for (const tab of ["series", "issues", "components", "lists", "change_log", "draft_series", "draft_issues", "draft_components", "members", "image_proposals", "ismeretlen_uj_tabla"])
    for (const m of ["POST", "PATCH", "PUT", "DELETE"]) for (const t of ["torzs", "minden"]) assert.equal(blk(m, `/rest/v1/${tab}?id=eq.1`, t), true, `${m} ${tab} ${t}`);
});
ok("olvasó függvényhívás (POST) soha nem tiltott", () => {
  for (const f of V.RPC_OLVASO) for (const t of ["torzs", "minden"]) assert.equal(blk("POST", `/rest/v1/rpc/${f}`, t), false, f);
});
ok("személyes függvényhívás: „torzs” szinten megy, „minden” szinten tiltott", () => {
  for (const f of V.RPC_SZEMELYES) { assert.equal(blk("POST", `/rest/v1/rpc/${f}`, "torzs"), false, f); assert.equal(blk("POST", `/rest/v1/rpc/${f}`, "minden"), true, f); }
});
ok("író függvényhívás mindkét szinten tiltott; az ismeretlen (besorolatlan) függvény is", () => {
  for (const f of [...V.RPC_TILTOTT, "ismeretlen_uj_fuggveny"]) for (const t of ["torzs", "minden"]) for (const m of ["POST", "GET"]) assert.equal(blk(m, `/rest/v1/rpc/${f}`, t), true, `${m} ${f}`);
});
ok("Storage: letöltés, lista és aláírt cím soha nem tiltott; feltöltés, törlés, mozgatás mindkét szinten tiltott", () => {
  for (const t of ["torzs", "minden"]) {
    assert.equal(blk("GET", "/storage/v1/object/component-images/components/x/live.jpg", t), false);
    assert.equal(blk("GET", "/storage/v1/object/public/component-images/components/x/live.jpg", t), false);
    assert.equal(blk("POST", "/storage/v1/object/list/component-images", t), false);
    assert.equal(blk("POST", "/storage/v1/object/sign/component-images/components/x/live.jpg", t), false);
    assert.equal(blk("POST", "/storage/v1/object/component-images/components/x/live.jpg", t), true);
    assert.equal(blk("PUT", "/storage/v1/object/component-images/components/x/live.jpg", t), true);
    assert.equal(blk("DELETE", "/storage/v1/object/component-images", t), true);
    assert.equal(blk("POST", "/storage/v1/object/move", t), true);
  }
});
ok("más cím (saját fájl, külső oldal) és hibás cím soha nem tiltott", () => {
  for (const u of ["https://laprol-lapra.vercel.app/verzio.json?t=1", "https://cdn.jsdelivr.net/npm/x", "nem-cim", "", null, undefined]) assert.equal(V.isBlocked("POST", u, "minden"), false, String(u));
});
ok("a módszer kis- és nagybetűtől független; hiányzó módszer = olvasás", () => {
  assert.equal(blk("patch", "/rest/v1/lists?id=eq.1", "torzs"), true); assert.equal(blk(undefined, "/rest/v1/lists", "torzs"), false);
});
ok("a személyes mentés „torzs” szinten nem tiltott → a kapu nem várakoztatja a verzióellenőrzésre", () => {
  assert.equal(blk("POST", "/rest/v1/member_status?on_conflict=user_id,component_id", "torzs"), false);
  assert.equal(blk("POST", "/rest/v1/member_issue_data?on_conflict=user_id,issue_id", "torzs"), false);
});

// ---------- a listák teljessége a KÓDHOZ képest ----------
const src = fs.readdirSync(JS).filter(f => f.endsWith(".js")).map(f => ({ f, s: fs.readFileSync(path.join(JS, f), "utf8") }));
const found = (re) => { const out = {}; for (const { f, s } of src) for (const m of s.matchAll(re)) (out[m[1]] = out[m[1]] || new Set()).add(f); return out; };
const rpcs = found(/\.rpc\(\s*["'`]([A-Za-z0-9_]+)["'`]/g);
const lists = { olvaso: V.RPC_OLVASO, szemelyes: V.RPC_SZEMELYES, tiltott: V.RPC_TILTOTT };
const where = fn => Object.keys(lists).filter(k => lists[k].includes(fn));
ok(`a kód mind a ${Object.keys(rpcs).length} féle .rpc("…") hívása pontosan egy listában szerepel`, () => {
  assert.ok(Object.keys(rpcs).length >= 10, "túl kevés rpc-hívást talált — a keresés hibás?");
  for (const fn of Object.keys(rpcs)) assert.equal(where(fn).length, 1, `„${fn}” (${[...rpcs[fn]].join(", ")}) ${where(fn).length ? "több listában is szerepel" : "NINCS besorolva a js/version.js-ben"}`);
});
ok("nincs változós nevű rpc-hívás (azt a keresés nem látná)", () => {
  for (const { f, s } of src) for (const m of s.matchAll(/\.rpc\(\s*([^"'`\s)])/g)) assert.fail(`${f}: .rpc(${m[1]}… — a függvény neve nem szöveg, a besorolás nem ellenőrizhető`);
});
ok("a listákban nincs olyan függvény, amit a kód már nem hív (elavult besorolás)", () => {
  for (const k of Object.keys(lists)) for (const fn of lists[k]) assert.ok(rpcs[fn], `„${fn}” a(z) ${k} listában van, de a kód nem hívja`);
});
const st = found(/\.storage\s*\.from\([^)]*\)\s*\.([A-Za-z]+)\(/g);
ok(`a kód mind a ${Object.keys(st).length} féle Storage-hívása be van sorolva (olvasó / író)`, () => {
  assert.ok(Object.keys(st).length >= 3, "túl kevés Storage-hívást talált — a keresés hibás?");
  for (const m of Object.keys(st)) assert.ok(V.STORAGE_OLVASO.includes(m) !== V.STORAGE_IRO.includes(m), `Storage „.${m}(” (${[...st[m]].join(", ")}) nincs besorolva, vagy mindkét listában szerepel`);
});
ok("a Storage-hívások csak a .storage.from(…).metódus( alakban fordulnak elő (más alakot a keresés nem látna)", () => {
  for (const { f, s } of src) { const all = (s.match(/\.storage\b/g) || []).length, ismert = (s.match(/\.storage\s*\.from\([^)]*\)\s*\.[A-Za-z]+\(/g) || []).length; assert.equal(all, ismert, `${f}: ${all} „.storage” előfordulás, ebből ${ismert} ismert alakú`); }
});
const tables = found(/\.from\(\s*["'`]([a-z_]+)["'`]\s*\)\s*\.\s*(?:insert|update|upsert|delete)\(/g);
ok("a kliens által közvetlenül írt táblák listája (tájékoztatásul) — a személyesek mind a SZEMELYES_TABLAK-ban", () => {
  for (const t of Object.keys(tables).filter(t => t.startsWith("member_"))) assert.ok(V.SZEMELYES_TABLAK.includes(t), `„${t}” személyes táblának látszik, de nincs a SZEMELYES_TABLAK-ban`);
  for (const t of V.SZEMELYES_TABLAK) assert.ok(t.startsWith("member_"), t);
});

console.log(`\nversion.test.mjs: ${n} ellenőrzés rendben`);
console.log("  rpc a kódban:", Object.keys(rpcs).sort().map(fn => `${fn} [${where(fn)[0]}]`).join(", "));
console.log("  Storage a kódban:", Object.keys(st).sort().map(m => `${m} [${V.STORAGE_OLVASO.includes(m) ? "olvasó" : "író"}]`).join(", "));
console.log("  közvetlenül írt táblák:", Object.keys(tables).sort().map(t => `${t}${V.SZEMELYES_TABLAK.includes(t) ? " [személyes]" : ""}`).join(", "));
