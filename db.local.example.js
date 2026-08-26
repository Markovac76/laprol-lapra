/* ============================================================
   Közvetlen Postgres-kapcsolat a migrációkhoz (scripts/run-migration.js).
   Másold le `db.local.js` néven a projekt gyökerébe, és töltsd ki a
   saját connection stringeddel. A `db.local.js` SOSEM kerülhet git-be
   (lásd .gitignore) — ez a fájl (`.example`) csak a formátumot
   dokumentálja, valós titok nélkül.

   Honnan szerezd be: Supabase Dashboard → Project Settings → Database
   → Connection string → "Direct connection" fül (NEM a "Connection
   pooler" / "Transaction pooler" változat — a migrációkhoz a direkt
   kapcsolat a megbízhatóbb, session-szintű BEGIN/COMMIT-hoz).

   FONTOS: ha a jelszó speciális karaktert tartalmaz (pl. @, /, :, #),
   azt URL-kódolni kell a stringben, különben a kapcsolat rosszul
   értelmeződik (pl. @ → %40) — máskülönben a parser azt hiheti, hogy
   ott kezdődik a host-rész.
   ============================================================ */
module.exports = {
  DATABASE_URL: "postgresql://postgres:[JELSZÓ]@db.[PROJECT-REF].supabase.co:5432/postgres",
};
