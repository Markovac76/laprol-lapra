/* ============================================================
   Nyers JSON-pillanatkép a `public` séma minden tábláiról, közvetlen
   Postgres-kapcsolattal — migráció ELŐTTI helyi biztonsági háló.
   A `db-backups/` mappa gitignore-olt, sosem kerül git-be.

   Importálható modulként (run-migration.js hívja migráció előtt) VAGY
   önállóan futtatható: node scripts/backup-db.js <címke>
   ============================================================ */
const fs = require("fs");
const path = require("path");

async function backupAllTables(client, label) {
  const { rows: tables } = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const dirName = `${stamp}_pre-${label}`;
  const dir = path.join(__dirname, "..", "db-backups", dirName);
  fs.mkdirSync(dir, { recursive: true });

  for (const { table_name } of tables) {
    // table_name az information_schema-ból jön (nem felhasználói bemenet),
    // az idézőjelbe tétel csak a vegyes kis/nagybetűs neveket védi.
    const { rows } = await client.query(`select * from public."${table_name}"`);
    fs.writeFileSync(
      path.join(dir, `${table_name}.json`),
      JSON.stringify(rows, null, 2),
      "utf8"
    );
  }

  return { dir, tableCount: tables.length };
}

if (require.main === module) {
  const { Client } = require("pg");
  const { DATABASE_URL } = require("../db.local.js");
  const label = process.argv[2];
  if (!label) {
    console.error("Használat: node scripts/backup-db.js <címke>");
    process.exit(1);
  }
  (async () => {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const { dir, tableCount } = await backupAllTables(client, label);
      console.log(`Kész: ${tableCount} tábla mentve ide: ${dir}`);
    } finally {
      await client.end();
    }
  })().catch(e => {
    console.error("Mentés sikertelen:", e.message);
    process.exit(1);
  });
}

module.exports = { backupAllTables };
