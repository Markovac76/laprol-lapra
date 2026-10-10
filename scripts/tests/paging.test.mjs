// fetchAllRows stabil rendezésének tesztje. Futtatás: node scripts/tests/paging.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../../js/supabase.js", import.meta.url),"utf8");
const m = src.match(/export async function fetchAllRows[\s\S]*?\n}\n/);
assert(m, "fetchAllRows nem található");
const fetchAllRows = new Function(m[0].replace("export async function","return async function"))();

// Hamis építő: a rendezés nélküli lekérdezés a lapok között ELTÉRŐ sorrendet ad (ez a valós kockázat),
// a rendezett pedig determinisztikus. Minden híváshoz új "tárolási sorrend" készül.
function makeTable(n){ return Array.from({length:n}, (_,i)=>({id:i+1, g:i%7, user_id:"u", entity_type:i%2?"issue":"component", entity_id:"e"+String(i).padStart(5,"0")})); }
let callNo = 0;
function factory(rows){
  return () => {
    const orders = [];
    const qb = {
      order(c){ orders.push(c); return qb; },
      async range(a,b){
        callNo++;
        let r = rows.slice();
        if(!orders.length){                       // rendezés nélkül: "hívásonként más" tárolási sorrend
          const k = callNo * 7919;
          r.sort((x,y)=> ((x.id*k)%1009) - ((y.id*k)%1009));
        } else {
          r.sort((x,y)=>{ for(const c of orders){ if(x[c]<y[c]) return -1; if(x[c]>y[c]) return 1; } return 0; });
        }
        return { data: r.slice(a, b+1), error: null };
      },
    };
    return qb;
  };
}
const rows = makeTable(2500);

// 1) a régi viselkedés (nincs kulcs): sor marad ki / duplázódik
callNo = 0;
const old = await fetchAllRows(factory(rows), null);
const uniqOld = new Set(old.data.map(r=>r.id)).size;
assert.equal(old.data.length, 2500);
assert(uniqOld < 2500, "rendezés nélkül duplázódnia/kimaradnia kell — a teszt-modell működik");

// 2) alapértelmezett "id": pontosan egyszer minden sor
callNo = 0;
const a = await fetchAllRows(factory(rows));
assert.equal(a.data.length, 2500); assert.equal(new Set(a.data.map(r=>r.id)).size, 2500);
assert.deepEqual(a.data.map(r=>r.id), rows.map(r=>r.id));

// 3) a hívó saját .order()-je + kulcs: g szerint, azon belül id szerint
callNo = 0;
const f = () => { const q = factory(rows)(); q.order("g"); return q; };
const b = await fetchAllRows(f);
assert.equal(new Set(b.data.map(r=>r.id)).size, 2500);
for(let i=1;i<b.data.length;i++){ const p=b.data[i-1], c=b.data[i]; assert(p.g<c.g || (p.g===c.g && p.id<c.id)); }

// 4) összetett kulcs tömbben
callNo = 0;
const c2 = await fetchAllRows(factory(rows), ["entity_type","entity_id"]);
assert.equal(new Set(c2.data.map(r=>r.entity_id)).size, 2500);

// 5) régi (queryFactory, pageSize) aláírás
callNo = 0;
const d = await fetchAllRows(factory(rows), 500);
assert.equal(new Set(d.data.map(r=>r.id)).size, 2500);

// 6) pontosan 1000 / 0 sor
callNo = 0;
assert.equal((await fetchAllRows(factory(makeTable(1000)))).data.length, 1000);
assert.equal((await fetchAllRows(factory(makeTable(0)))).data.length, 0);
console.log("OK — a lapozás stabil: nincs kimaradó/duplázódó sor (rendezés nélkül van: %d egyedi / 2500)", uniqOld);
