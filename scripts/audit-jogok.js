/* ============================================================
   Jogosultsági audit a public sémára (CSAK OLVASÁS, a scripts/ro.js-sel).
   Minden új tábla / szekvencia migrációja után futtatandó (CLAUDE.md; specifikáció 13.14.12).

   Hibának számít (nem nulla kilépési kód):
     1) bármelyik táblán, nézeten vagy szekvencián az anon (vagy a PUBLIC) bármilyen jogot kap
        — táblaszinten vagy oszlopszinten;
     2) az authenticated bármelyik táblán TRUNCATE, REFERENCES, TRIGGER vagy MAINTAIN jogot kap;
     3) van olyan tábla, amelyen a sorszintű védelem (RLS) ki van kapcsolva;
     4) a postgres alapértelmezett jogai a public sémában táblára vagy szekvenciára az anon vagy az
        authenticated szerepkörnek jogot adnak.
   Tájékoztató (nem hiba): RLS-es tábla szabály (policy) nélkül; a supabase_admin alapértelmezett jogai
   (a postgres nevében nem módosíthatók).

   Használat: node scripts/audit-jogok.js
   ============================================================ */
const { withRO } = require("./ro.js");

const TPRIV = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"];
const TILOS_AUTH = ["TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"];
const KIND = { r: "tábla", p: "particionált tábla", v: "nézet", m: "anyagi nézet", f: "külső tábla", S: "szekvencia" };

withRO(async q => {
  const hibak = [], info = [];
  const rel = await q(`select c.oid::int as oid, c.relname as nev, c.relkind as k, c.relrowsecurity as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','p','v','m','f','S') order by c.relname`);
  for (const r of rel) {
    if (r.k === "S") {
      const s = (await q(`select array_remove(array[case when has_sequence_privilege('anon', $1::oid, 'SELECT') then 'SELECT' end,
          case when has_sequence_privilege('anon', $1::oid, 'UPDATE') then 'UPDATE' end, case when has_sequence_privilege('anon', $1::oid, 'USAGE') then 'USAGE' end], null) as p`, [r.oid]))[0].p;
      if (s.length) hibak.push(`${r.nev} (szekvencia): az anon jogot kap: ${s.join(", ")}`);
      continue;
    }
    const anon = (await q(`select coalesce(array_agg(p order by o), '{}') as p from unnest($2::text[]) with ordinality u(p, o) where has_table_privilege('anon', $1::oid, p)`, [r.oid, TPRIV]))[0].p;
    if (anon.length) hibak.push(`${r.nev} (${KIND[r.k]}): az anon táblaszintű jogot kap: ${anon.join(", ")}`);
    const anonOsz = (await q(`select coalesce(array_agg(a.attname::text order by a.attnum), '{}') as o from pg_attribute a where a.attrelid = $1::oid and a.attnum > 0 and not a.attisdropped
        and (has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT') or has_column_privilege('anon', a.attrelid, a.attnum, 'INSERT')
          or has_column_privilege('anon', a.attrelid, a.attnum, 'UPDATE') or has_column_privilege('anon', a.attrelid, a.attnum, 'REFERENCES'))`, [r.oid]))[0].o;
    if (anonOsz.length && !anon.length) hibak.push(`${r.nev} (${KIND[r.k]}): az anon oszlopszintű jogot kap: ${anonOsz.join(", ")}`);
    const auth = (await q(`select coalesce(array_agg(p order by o), '{}') as p from unnest($2::text[]) with ordinality u(p, o) where has_table_privilege('authenticated', $1::oid, p)`, [r.oid, TILOS_AUTH]))[0].p;
    if (auth.length) hibak.push(`${r.nev} (${KIND[r.k]}): az authenticated tiltott jogot kap: ${auth.join(", ")}`);
    if ((r.k === "r" || r.k === "p") && !r.rls) hibak.push(`${r.nev} (${KIND[r.k]}): a sorszintű védelem (RLS) KI van kapcsolva`);
    if ((r.k === "r" || r.k === "p") && r.rls && !(await q(`select 1 from pg_policies where schemaname = 'public' and tablename = $1 limit 1`, [r.nev])).length)
      info.push(`${r.nev}: RLS be, szabály (policy) nincs — a kliens-szerepkörök egy sort sem látnak (szándékos, ha a tábla csak függvényből érhető el)`);
  }
  const dacl = await q(`select pg_get_userbyid(d.defaclrole) as szerep, d.defaclobjtype as tipus, d.defaclacl::text as acl,
      exists (select 1 from aclexplode(d.defaclacl) a where pg_get_userbyid(a.grantee) in ('anon', 'authenticated') or a.grantee = 0) as nyitott
      from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'public' and d.defaclobjtype in ('r', 'S') order by 1, 2`);
  for (const d of dacl) {
    const mi = d.tipus === "r" ? "táblák" : "szekvenciák";
    if (d.szerep === "postgres" && d.nyitott) hibak.push(`alapértelmezett jog (postgres, public, ${mi}): az anon / authenticated jogot kap: ${d.acl}`);
    else if (d.nyitott) info.push(`alapértelmezett jog (${d.szerep}, public, ${mi}) nyitott — a postgres nevében nem módosítható; csak a platform által létrehozott objektumokra vonatkozik: ${d.acl}`);
  }
  const t = rel.filter(r => r.k !== "S").length, s = rel.length - t;
  console.log(`Jogosultsági audit — public séma: ${t} tábla / nézet, ${s} szekvencia.`);
  if (info.length) { console.log("\nTájékoztató (nem hiba):"); info.forEach(x => console.log("  • " + x)); }
  if (hibak.length) { console.log(`\n✘ ${hibak.length} HIBA:`); hibak.forEach(x => console.log("  ✘ " + x)); process.exitCode = 1; }
  else console.log("\n✔ Nincs hiba: az anon semmit nem kap, az authenticated-nek nincs TRUNCATE / REFERENCES / TRIGGER / MAINTAIN joga, minden táblán be van kapcsolva az RLS, és a postgres alapértelmezett jogai zártak.");
}).catch(e => { console.error("HIBA: " + e.message); process.exit(2); });
