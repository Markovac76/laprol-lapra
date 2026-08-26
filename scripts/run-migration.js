/* ============================================================
   Egy SQL-migrációs fájl futtatása közvetlen Postgres-kapcsolattal.

   FONTOS: ezt a scriptet CSAK azután szabad meghívni, hogy a teljes
   SQL-t megmutattuk a felhasználónak a beszélgetésben, és megkaptuk
   az EXPLICIT jóváhagyását — a script maga nem kér külön megerősítést,
   a jóváhagyási kapu a beszélgetésben van, nem itt.

   Lépések:
   1) friss db-backups/ pillanatkép (backup-db.js) a migráció ELŐTT
   2) BEGIN
   3) a megadott .sql fájl teljes tartalmának futtatása
   4) COMMIT, vagy hiba esetén ROLLBACK — sosem marad félig alkalmazva

   Használat: node scripts/run-migration.js <sql-fájl-útvonala> <címke>
   Példa:     node scripts/run-migration.js ../laprol-lapra-heartbeat.sql heartbeat
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");
const { backupAllTables } = require("./backup-db.js");

async function main() {
  const [, , sqlPathArg, label] = process.argv;
  if (!sqlPathArg || !label) {
    console.error("Használat: node scripts/run-migration.js <sql-fájl-útvonala> <címke>");
    process.exit(1);
  }
  const sqlPath = path.resolve(process.cwd(), sqlPathArg);
  if (!fs.existsSync(sqlPath)) {
    console.error(`Nem található: ${sqlPath}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, "utf8");

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    console.log(`Biztonsági mentés készítése ("pre-${label}")…`);
    const { dir, tableCount } = await backupAllTables(client, label);
    console.log(`  Kész: ${tableCount} tábla mentve ide: ${dir}`);

    console.log(`Migráció futtatása: ${sqlPath}`);
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("COMMIT");
      console.log("Migráció sikeres, COMMIT megtörtént.");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("Migráció sikertelen, ROLLBACK megtörtént. Hiba:", e.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch(e => {
  console.error("Váratlan hiba:", e.code ? `[${e.code}] ${e.message || e}` : (e.message || e));
  process.exit(1);
});
