# Lapról Lapra

Számozott, gyűjthető újság-/füzetsorozatok (partwork) követője — az OM
Curator gyűjtemény-platform első modulja. Élő verzió:
https://laprol-lapra.vercel.app

## Tech stack

- **Frontend**: natív ES modulok, build-eszköz nélkül (`js/` mappa, `index.html`, `styles.css`)
- **Backend / adatbázis**: [Supabase](https://supabase.com) (Postgres + Auth + Row Level Security + Storage + `pg_cron`)
- **Hosting**: [Vercel](https://vercel.com)
- **PWA**: `manifest.json` + ikonok, telepíthető a telefon kezdőképernyőjére

Nincs npm-csomag, nincs bundler, nincs framework az appban magában — a
böngésző natívan tölti be az ES modulokat `<script type="module">`-lal.
Az egyetlen build-lépés (`vercel.json` `buildCommand`-ja) a Supabase
anon key-t írja bele `config.js`-be, Vercel környezeti változóból. A
`scripts/` mappa (lásd "Migrációk" lent) ettől független, önálló,
fejlesztői eszköz — sosem megy a Vercel build-be.

## Mappaszerkezet

```
├── index.html              # Belépő HTML, betölti js/main.js-t
├── styles.css               # Az egész app stílusa
├── manifest.json + icons/   # PWA
├── vercel.json               # Build-parancs: config.js generálása env változóból
├── config.js                 # Supabase URL + anon key — NINCS git-ben, build-időben generált
├── config.example.js         # Minta config.js helyi fejlesztéshez
├── db.local.js                # Postgres connection string a migrációkhoz — NINCS git-ben
├── db.local.example.js        # Minta db.local.js-hez
├── db-backups/                 # Migráció előtti JSON-pillanatképek — NINCS git-ben
├── scripts/                    # Helyi migrációs eszközök (lásd "Migrációk" lent)
│   ├── package.json + node_modules/  # csak a `pg` csomag, NINCS git-ben (node_modules)
│   ├── backup-db.js                   # táblák JSON-exportja
│   └── run-migration.js               # backup + BEGIN/COMMIT/ROLLBACK migráció-futtatás
├── js/                         # Az egész alkalmazás logikája, funkciónként egy fájl
│   ├── main.js                  # Belépési pont: minden esemény-bekötés
│   ├── state.js, supabase.js, modal.js, auth.js, permissions.js
│   ├── data.js, render.js, personal.js
│   ├── admin-forms.js, admin-users.js, excel.js
│   ├── my-series.js, series-proposal.js     # sorozat-választás/javaslás
│   ├── karbantartas.js, draft-items.js       # sorozat-életciklus, draft-szerkesztés
│   ├── changes.js                            # verziókövetés/felkiáltójel-jelzés
│   ├── component-images.js, image-resize.js  # képfeltöltés/-javaslat
│   ├── my-data.js                            # „Saját adatlap" — konszolidált személyes-adat panel
│   ├── draft-excel.js                        # sablon-alapú tömeges tétel-feltöltés draftokhoz
│   └── help.js, help-content.js              # beépített súgó
├── laprol-lapra-*.sql          # sorszámozott/névvel azonosított SQL-migrációk (nem mappában, a gyökérben)
├── laprol-lapra-specifikacio.md      # a hiteles, technikai állapot
└── allapot-osszefoglalo.md            # gyors visszaállási pont egy új beszélgetéshez
```

## Helyi futtatás

1. Másold le `config.example.js`-t `config.js` néven, és töltsd ki a saját Supabase projekted URL-jével és anon key-jével.
2. Indíts egy statikus fájlkiszolgálót a repó gyökeréből, pl.:
   ```bash
   npx serve .
   ```
3. Nyisd meg a megjelenő localhost-címet a böngészőben.

Nincs `npm install`, nincs build lépés az app helyi futtatásához — a
`config.js` az egyetlen dolog, amit magadnak kell előállítanod (ez sosem
kerül git-be). A `scripts/` mappának VAN saját, külön `npm install`-ja
— lásd "Migrációk" lent —, de ez az app futtatásához nem szükséges.

## Deploy-folyamat

- **Vercel**: a repó a Vercel projekthez van kötve, minden `main`-re történő push automatikusan deployol. A `vercel.json` `buildCommand`-ja a `SUPABASE_ANON_KEY` Vercel environment változóból generálja le `config.js`-t (Vercel projekt → Settings → Environment Variables).
- **Supabase**: külön projekt, semmilyen automatikus CI/CD nincs hozzá kötve — a migrációk manuálisan (lásd lent) kerülnek fel, közvetlen Postgres-kapcsolattal.

## A kialakult munkamódszer

### Migrációk

Adatbázis-migráció (`laprol-lapra-*.sql`) **soha nem fut le automatikusan
jóváhagyás nélkül** — a teljes SQL-t meg kell mutatni, és meg kell várni
az explicit jóváhagyást, mielőtt lefut. Futtatás előtt mindig készül egy
friss `db-backups/` pillanatkép (a táblák nyers JSON-exportja) — ez a
mappa gitignore-olt, csak helyi biztonsági háló. Migrációt közvetlen
Postgres-kapcsolattal futtatunk (`scripts/run-migration.js`, a `pg`
npm-csomaggal — nincs Supabase CLI/Docker ehhez a gépen), egy
tranzakcióba csomagolva (`BEGIN`/`COMMIT`, hiba esetén `ROLLBACK`), hogy
soha ne maradjon félig alkalmazott állapotban a séma.

A connection stringet a `db.local.js` (gitignore-olt, sosem kerül
git-be — másold le `db.local.example.js`-ből) tárolja, a Supabase
Dashboard → Project Settings → Database → Connection string → "Direct
connection" alapján (nem a connection pooler).

Használat:
```bash
cd scripts && npm install   # csak egyszer, a pg csomag telepítéséhez
cd ..
node scripts/run-migration.js laprol-lapra-valami.sql cimke-a-backuphoz
```
Önálló, migráció nélküli biztonsági mentéshez: `node scripts/backup-db.js cimke`.

### Inaktivitás elleni védelem

A Supabase Free plan 7 nap valódi adatbázis-írás hiánya után szünetelteti
a projektet. A `weekly-heartbeat` `pg_cron` job (lásd `laprol-lapra-heartbeat.sql`
és a specifikáció 13.8/kapcsolódó fejezete) ezt fedi le: minden vasárnap
egy egyszerű UPSERT-et futtat egy erre dedikált, RLS-sel a kliens elől
teljesen elzárt `system_heartbeat` táblán.

### A dokumentumok szerepe

- **`laprol-lapra-specifikacio.md`** — a hiteles, technikai állapot. Minden fejlesztési kör végén frissítve — ha valami a kódban és a specifikációban eltér, a kód a valóság, de a specifikációt frissíteni kell.
- **`allapot-osszefoglalo.md`** — gyors visszaállási pont egy új Claude-beszélgetéshez.
- **`README.md`** (ez a fájl) — fejlesztői belépő pont: mi ez, hogyan fut helyben, hogyan kell deployolni, és a fenti munkamódszer-szabályok.

### Tesztelési szokások

- **Élő tesztelés élvez elsőbbséget** — egy statikus szerverrel (`npx serve`) elindított böngészős munkameneten keresztül, valódi Supabase-projekt ellen, nem mockolt adatokkal.
- A személyes/védett adatot (bejelentkezést igénylő nézeteket) mindig a projekt tulajdonosa teszteli élesben — a Claude Code csak anonim/publikus felületet lát.
- Git: minden kész, tesztelt lépés után commit + push, **kizárólag a tulajdonos explicit jóváhagyása után**, világos, a hibajavítási/fejlesztési pontra hivatkozó üzenettel.
