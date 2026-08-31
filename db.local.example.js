/* ============================================================
   Postgres-kapcsolat a migrációkhoz (scripts/run-migration.js).
   Másold le `db.local.js` néven a projekt gyökerébe, és töltsd ki a
   saját connection stringeddel. A `db.local.js` SOSEM kerülhet git-be
   (lásd .gitignore) — ez a fájl (`.example`) csak a formátumot
   dokumentálja, valós titok nélkül.

   Honnan szerezd be: Supabase Dashboard → Connect → Connection String
   → "Session pooler" (NEM "Direct connection" — az csak IPv6-címet
   publikál, sok hálózatról/gépről elérhetetlen; a "Transaction pooler"
   viszont NEM alkalmas, mert nem tartja meg a session-t egy tranzakción
   belül a BEGIN/COMMIT-hoz). A Session pooler bizonyítottan működik
   tranzakciós migrációkhoz is.

   FONTOS: ha a jelszó speciális karaktert tartalmaz (pl. @, /, :, #),
   azt URL-kódolni kell a stringben, különben a kapcsolat rosszul
   értelmeződik (pl. @ → %40) — máskülönben a parser azt hiheti, hogy
   ott kezdődik a host-rész.
   ============================================================ */
module.exports = {
  DATABASE_URL: "postgresql://postgres.[PROJECT-REF]:[JELSZÓ]@aws-0-[REGIÓ].pooler.supabase.com:5432/postgres",
};
