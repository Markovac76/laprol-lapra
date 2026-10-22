// Védőpróba: a js/ mappában (a dialog.js kivételével) nem lehet natív alert( hívás — hiba és figyelmeztetés az app
// saját ablakában (js/dialog.js, showMessage) jelenik meg. A megjegyzésben és karakterlánc-tartalomban lévő
// „alert(” nem számít. (A confirm( ellenőrzése a D kör 2. lépésében kerül bele.)
// Futtatás: node scripts/tests/no-native-dialogs.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const JS = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "js");

// A kódból kiveszi a megjegyzéseket és a karakterláncok tartalmát (a ${…} kifejezések kódja megmarad),
// a regex-literálokat is. Visszaadja a „csak kód” szöveget, a sorszámok megtartásával.
export function codeOnly(src){
  let out = "", i = 0, prev = "";
  const stack = [];                       // template-literálok ${ } mélysége
  const regexCtx = c => c === "" || "(,=:[!&|?{};+-*%<>~^".includes(c);
  while (i < src.length){
    const c = src[i], n = src[i + 1];
    if (c === "/" && n === "/"){ while (i < src.length && src[i] !== "\n") i++; continue; }
    if (c === "/" && n === "*"){ i += 2; while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")){ if (src[i] === "\n") out += "\n"; i++; } i += 2; continue; }
    if (c === "'" || c === '"'){ const q = c; i++; while (i < src.length && src[i] !== q){ if (src[i] === "\\") i++; i++; } i++; out += q + q; prev = q; continue; }
    if (c === "`" || (c === "}" && stack.length && stack[stack.length - 1] === 0)){
      if (c === "}") stack.pop();
      i++;                                  // template-szöveg a következő ` vagy ${ -ig
      while (i < src.length && src[i] !== "`"){
        if (src[i] === "\\"){ i += 2; continue; }
        if (src[i] === "$" && src[i + 1] === "{"){ stack.push(0); i += 2; break; }
        if (src[i] === "\n") out += "\n";
        i++;
      }
      if (src[i] === "`"){ i++; }
      out += "``"; prev = "`"; continue;
    }
    if (c === "/" && regexCtx(prev)){       // regex-literál
      i++; let inClass = false;
      while (i < src.length && (src[i] !== "/" || inClass)){ if (src[i] === "\\") i++; else if (src[i] === "[") inClass = true; else if (src[i] === "]") inClass = false; if (src[i] === "\n") break; i++; }
      i++; while (/[a-z]/i.test(src[i] || "")) i++;
      out += "/r/"; prev = "/"; continue;
    }
    if (c === "{" && stack.length) stack[stack.length - 1]++;
    if (c === "}" && stack.length) stack[stack.length - 1]--;
    out += c; if (!/\s/.test(c)) prev = c; i++;
  }
  return out;
}

// Önellenőrzés: a szűrő a megjegyzést és a karakterláncot kiveszi, a valódi hívást megtartja.
assert.equal(/\balert\s*\(/.test(codeOnly(`// alert("x")\nconst a = "alert(1)"; /* alert( */`)), false, "megjegyzés és karakterlánc nem számít");
assert.equal(/\balert\s*\(/.test(codeOnly("const t = `szöveg alert( ${1+1}`;")), false, "template-szöveg nem számít");
assert.equal(/\balert\s*\(/.test(codeOnly("const t = `${ alert('x') }`;")), true, "a ${…} kódjában lévő hívás számít");
assert.equal(/\balert\s*\(/.test(codeOnly(`if(x){ alert("hiba"); }`)), true, "a valódi hívás számít");
assert.equal(/\balert\s*\(/.test(codeOnly(`const r = /["']/; alert("x");`)), true, "a regex-literál után a hívás számít");

const files = readdirSync(JS).filter(f => f.endsWith(".js") && f !== "dialog.js").sort();
const hits = [];
for (const f of files){
  const lines = codeOnly(readFileSync(join(JS, f), "utf8")).split("\n");
  lines.forEach((l, i) => { if (/(^|[^.\w$])alert\s*\(|window\.alert\s*\(/.test(l)) hits.push(`${f}:${i + 1}`); });
}
assert.deepEqual(hits, [], "natív alert( hívás maradt: " + hits.join(", "));
console.log(`OK — a js/ ${files.length} fájljában (a dialog.js kivételével) nincs natív alert( hívás`);
