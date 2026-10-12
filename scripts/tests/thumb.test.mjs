// Kis képek és piktogramok tesztje. Futtatás: node scripts/tests/thumb.test.mjs
import assert from "node:assert/strict";
const { thumbUrl, iconKey, typeIcon, ICON_KEYS } = await import("../../js/thumb.js");

const base = "https://x.supabase.co/storage/v1/object/public/component-images/components/abc/live.jpg";
// átméretezett cím: a v= cache-törő megmarad, a kép nem vágódik
assert.equal(thumbUrl(base + "?v=123", 64),
  "https://x.supabase.co/storage/v1/render/image/public/component-images/components/abc/live.jpg?v=123&width=64&height=64&resize=contain&quality=70");
assert.equal(thumbUrl(base, 56), "https://x.supabase.co/storage/v1/render/image/public/component-images/components/abc/live.jpg?width=56&height=56&resize=contain&quality=70");
// téglalap alakú doboz (a Szám-sáv csempéje, 2× felbontás)
assert.equal(thumbUrl(base, 168, 144), "https://x.supabase.co/storage/v1/render/image/public/component-images/components/abc/live.jpg?width=168&height=144&resize=contain&quality=70");
// nem Supabase-cím és üres érték változatlan
assert.equal(thumbUrl("https://example.com/a.jpg"), "https://example.com/a.jpg");
assert.equal(thumbUrl(""), ""); assert.equal(thumbUrl(null), "");
// piktogramok: a Listák típusai és az aliasok, ismeretlen → általános
for (const [t, k] of [["magazin","magazin"],["konyv","konyv"],["Könyv","konyv"],["figura","figura"],["modell","modell"],["lego","lego"],
                      ["krtya","karta"],["Kártya","karta"],["kartya","karta"],["hangoskönyv","cd"],["poszter","poszter"],["matrica","matrica"],
                      ["egyeb","egyeb"],["valami-ismeretlen","egyeb"],[null,"egyeb"],["", "egyeb"]])
  assert.equal(iconKey(t), k, String(t));
assert(ICON_KEYS.includes("egyeb") && ICON_KEYS.length >= 10);
assert.match(typeIcon("lego"), /^<svg viewBox="0 0 24 24"/);
console.log("OK — a kis kép és piktogram tesztek átmentek");
