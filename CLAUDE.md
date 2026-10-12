# Lapról Lapra — munkaszabályok a Claude Code-nak

Nyelv: magyar. Tömör válaszok. A kérdéseket egyszerre, egyben, szövegben felsorolva tedd fel, ne egyesével. Nem szakmai nyelven kérdezz: ha egy kifejezés nem egyértelmű, magyarázd el.

## Olvasd el először
- `laprol-lapra-specifikacio.md` (a részletes specifikáció, a legújabb verzió)
- `allapot-osszefoglalo.md` (állapot, munkafolyamat, fájlszerkezet)

## Munkafolyamat
- A döntések a Home csevegésben dőlnek el, onnan jönnek a `claude-code-N-lepes-….md` utasítások. Ha az utasítás ellentmond a specifikációnak vagy az adatnak, állj meg és kérdezz.
- Kész, tesztelt lépés után commit és push (világos üzenet). Commit és push csak akkor, ha az utasítás vagy a tulajdonos kifejezetten jóváhagyta.
- Minden kör végén: súgó, változásnapló, specifikáció (verzióemelés), állapot-összefoglaló. Írd meg, mit nézzen meg a tulajdonos élesben.
- Fogalmak: Sorozat → Szám → Komponens (elem). A felhasználónak látható állapotok: megvan / hiányzik / nem kell / jelöletlen. A "várható" nem állapot, csak a még meg nem jelent Számokat jelöli, dátum alapján.

## Adatbázis és migrációk
- Migráció: az SQL megmutatása, jóváhagyás, backup (`db-backups/`), tranzakció, ellenőrző számlálók és a függvények hash-e előtte és utána.
- Élő adatban tesztet (visszagörgetettet is) csak jóváhagyással futtass. Előre jóváhagyott minta, ha az utasítás ezt kifejezetten megadja: egyetlen tranzakció, a végén mindig ROLLBACK, `lock_timeout` beállítva, a függvények hash-e és a számlálók előtte és utána egyeznek, nem publikál semmit, a függő draftokat nem érinti.
- Olvasáshoz használd a `scripts/ro.js` segédet (csak olvasás).
- Minden lekérdezésnél lapozz (PostgREST 1000 sor csendes levágás), stabil rendezéssel (`fetchAllRows`).
- A tulajdonos személyes státuszgombjait ne kattintsd, személyes adatot ne módosíts.
- Titkos adatot (kapcsolati szöveg, kulcs) ne írj ki, ne commitolj. A `db.local.js` és a `config.js` nem kerülhet git-be.

## Kliens
- Natív ES modulok, build-eszköz nélkül. Nincs service worker; a deploy után az appot újra kell tölteni a böngészőben.

## Munkamód a jogosultságokhoz
- A szkripteket (js, py, sql) ne a parancs szövegében írd meg (nincs `cat > fájl <<'EOF'`), hanem a fájlíró eszközzel, és utána egy rövid paranccsal futtasd. Az átmeneti szkriptek a scratchpad mappába kerüljenek.
- Ne kezdd a parancsot `cd …`-vel, ha már a projektmappában vagy. Egy hívásban lehetőleg egy művelet legyen, ne fűzz össze sok parancsot `&&`-sel.
- A commit-üzenetet fájlból add meg (`git commit -F fájl`), ne hosszú, idézőjeles szövegként a parancsban.
