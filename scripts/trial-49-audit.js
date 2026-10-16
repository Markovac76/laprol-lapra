/* 49. lépés / C — az audit szkript hibás-állapot próbája. ÉLŐ adatbázis, EGY tranzakció, a végén MINDIG ROLLBACK.
   CSAK a tulajdonos jóváhagyásával futtatható (CLAUDE.md). Használat: node scripts/trial-49-audit.js
   Szándékosan hibás állapotot hoz létre a tranzakcióban (próbatábla anon-joggal és kikapcsolt RLS-sel, authenticated
   TRUNCATE-joggal; próba-szekvencia anon-joggal; a postgres alapértelmezett táblajoga újra nyitva), és az auditot
   (scripts/audit-jogok.js, audit(q)) a saját tranzakciójának lekérdezőjével futtatja. Meglévő táblához, adathoz nem nyúl. */
const crypto = require("crypto");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");
const { audit } = require("./audit-jogok.js");
const md5 = s => crypto.createHash("md5").update(s).digest("hex");
const SNAP = `select md5(string_agg(c.relname::text || c.relkind::text || coalesce(c.relacl::text,'') || c.relrowsecurity::text, ',' order by c.relname)) rel,
    (select md5(string_agg(pg_get_userbyid(defaclrole) || defaclobjtype::text || defaclacl::text, ',' order by defaclrole, defaclnamespace, defaclobjtype)) from pg_default_acl) dacl,
    count(*)::int n from pg_class c where c.relnamespace = 'public'::regnamespace`;
const results = []; const report = (n, ok, d) => { results.push(ok); console.log(`  ${ok ? "✔" : "✘"} ${n}${d ? " — " + d : ""}`); };
(async () => {
  const c = new Client({ connectionString: DATABASE_URL }); await c.connect();
  const before = (await c.query(SNAP)).rows[0];
  console.log(`ELŐTTE: ${before.n} objektum a public sémában, jogok ujjlenyomata ${before.rel}, alapértelmezett jogok ${before.dacl}`);
  const q = async (sql, p) => (await c.query(sql, p)).rows;
  try {
    await c.query("BEGIN"); await c.query("SET LOCAL lock_timeout = '3s'");
    console.log("\n── 1. Az audit a mai (helyes) állapoton, a próba tranzakciójában ──");
    const k0 = await audit(q);
    report("C1 a helyes állapoton az audit 0-val tér vissza (nincs hiba)", k0 === 0, `kilépési kód: ${k0}`);
    console.log("\n── 2. Szándékosan hibás állapot a tranzakcióban ──");
    for (const s of [
      "create table public.zz_audit_proba (id int primary key, x text)",          // RLS NINCS bekapcsolva
      "grant select, insert on table public.zz_audit_proba to anon",            // anon-jog
      "grant truncate on table public.zz_audit_proba to authenticated",         // tiltott authenticated-jog
      "create table public.zz_audit_proba2 (id int primary key)",
      "alter table public.zz_audit_proba2 enable row level security",
      "grant update (id) on table public.zz_audit_proba2 to anon",               // anon OSZLOPszintű jog
      "create sequence public.zz_audit_seq",
      "grant usage on sequence public.zz_audit_seq to anon",                    // anon a szekvencián
      "alter default privileges for role postgres in schema public grant select on tables to anon",   // nyitott alapértelmezés
    ]) { await c.query(s); console.log("  " + s); }
    console.log("\n── 3. Az audit a hibás állapoton ──");
    const k1 = await audit(q);
    report("C2 a hibás állapoton az audit 1-gyel tér vissza (a parancssori futtatásnál ez a kilépési kód)", k1 === 1, `kilépési kód: ${k1}`);
  } catch (e) { report("a próba végigfutott", false, e.message); }
  finally {
    try { await c.query("ROLLBACK"); } catch (_) {}
    console.log("\n── ROLLBACK megtörtént ──");
    const after = (await c.query(SNAP)).rows[0]; await c.end();
    report("C3 a ROLLBACK után az éles állapot azonos (objektumok, jogok, RLS, alapértelmezett jogok)", J(after) === J(before), `UTÁNA: ${after.n} objektum, ${after.rel}, ${after.dacl}`);
    console.log(`\nPróbák: ${results.filter(Boolean).length}/${results.length} sikeres`);
  }
})();
function J(x) { return JSON.stringify(x); }
