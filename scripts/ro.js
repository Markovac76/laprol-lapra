/* ============================================================
   Olvasó segéd az élő adatbázishoz (CSAK OLVASÁS: BEGIN READ ONLY,
   a végén mindig ROLLBACK). A kapcsolatot a db.local.js-ből veszi.

   Használat (saját szkriptből):
     const { withRO } = require("<projekt>/scripts/ro.js");
     withRO(async q => {
       console.log(await q(`select count(*) from public.series where id <> $1`, [0]));
     });

   Közvetlenül is futtatható egyetlen lekérdezéssel:
     node scripts/ro.js "select count(*) from series"
   ============================================================ */
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const STATEMENT_TIMEOUT = "8s";
const LOCK_TIMEOUT = "3s";

async function withRO(fn) {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  try {
    await c.query("BEGIN READ ONLY");
    await c.query(`set local statement_timeout = '${STATEMENT_TIMEOUT}'`);
    await c.query(`set local lock_timeout = '${LOCK_TIMEOUT}'`);
    const q = async (sql, params) => (await c.query(sql, params)).rows;
    return await fn(q);
  } finally {
    try { await c.query("ROLLBACK"); } catch (e) { /* a kapcsolat már megszakadt */ }
    await c.end();
  }
}

module.exports = { withRO };

if (require.main === module) {
  const sql = process.argv[2];
  if (!sql) { console.error('Használat: node scripts/ro.js "select …"'); process.exit(1); }
  withRO(q => q(sql)).then(rows => console.table(rows)).catch(e => { console.error("HIBA: " + e.message); process.exit(1); });
}
