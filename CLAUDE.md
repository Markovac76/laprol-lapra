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
- Titkos adatot (kapcsolati szöveg, kulcs, jelszó) ne írj ki, ne commitolj. A `db.local.js`, a `config.js` és a `.env.test` nem kerülhet git-be. A felhasználók e-mail-címét jelentésbe ne írd ki.
- A jóváhagyott SQL szövegén ne változtass. Az `.sql` fájlok sorvége LF (`.gitattributes`); futtatás előtt a próba által mért függvény-hash egyezzen a jóváhagyott csomagéval.
- Futtatás: `node scripts/run-migration.js <fájl> <címke>` (mentés, egy tranzakció, 3 mp-es `lock_timeout`). Hibánál ne próbáld újra; a visszaúthoz új jóváhagyás kell.
- Minden új függvény mellé kötelező a hívási jog kifejezett megadása ugyanabban a migrációban: belső segédnél `revoke execute … from public, anon, authenticated`; kliensből hívottnál `revoke execute … from public, anon`, és ha kell, `grant execute … to authenticated` (a `create_live_issue` mintájára). A jogosultsági modell: specifikáció 13.14.9.
- Minden új tábla (és szekvencia) mellé kötelező a jogok kifejezett megadása ugyanabban a migrációban: RLS bekapcsolva, szabály (policy) megírva, `grant` csak arra a műveletre / oszlopra, amit a kliens ténylegesen használ. Az `anon` semmit nem kap; kivétel csak külön döntéssel és leírt indokkal. `TRUNCATE`, `REFERENCES`, `TRIGGER`, `MAINTAIN` jogot a kliens-szerepkörök nem kapnak. Új tábla migrációja után futtasd: `node scripts/audit-jogok.js` (csak olvasás; hibánál nem nulla kilépési kód; modulként is hívható, próbából: `audit(q)`). A modell: specifikáció 13.14.12.
- Az élő törzsadat-táblákra (series, issues, components, change_log, global_counters, lists) nincs közvetlen írási jog; új írási igényhez függvény kell, vagy az oszlopszintű kivétel külön döntéssel. (A mai kivételek: specifikáció 13.14.10.)
- Nagyobb migráció előtt átnézendő csomag készül (`NN-lepes-atnezesre.md`: teljes SQL, mellékhatások, számlálók, próbák, futtatási terv, visszaút). Ez a fájl nem kerül a repóba.

## Felületi próba
- Csak a teszt-felhasználóval, erre létrehozott próbasorozaton. A jelszót a tulajdonos írja be a böngészőben; te soha nem írod ki és nem gépeled be. Kijelentkezni nem kell.
- Éles sorozatot ne nyiss szerkesztésre, munkaanyagot ne hozz létre rajta, mások munkaanyagához ne nyúlj.
- A képernyőképek a `scripts/ui-test/kepek/` mappába kerülnek (git-ből kizárva).

## Kliens
- Új, nem az apphoz tartozó fájl vagy mappa (dokumentum, adat, eszköz) kerül a `.vercelignore`-ba; az élő címen 404-et kell adnia.
- Hibaüzenet és megerősítő kérdés az app saját ablakában (`js/dialog.js`, `showMessage`, `askConfirm`) jelenik meg; natív `alert(` és `confirm(` nem használható (a `scripts/tests/no-native-dialogs.test.mjs` őrzi).
- Natív ES modulok, build-eszköz nélkül. Nincs service worker; a deploy után az appot újra kell tölteni a böngészőben.

## Munkamód a jogosultságokhoz
- A szkripteket (js, py, sql) ne a parancs szövegében írd meg (nincs `cat > fájl <<'EOF'`), hanem a fájlíró eszközzel, és utána egy rövid paranccsal futtasd. Az átmeneti szkriptek a scratchpad mappába kerüljenek.
- Ne kezdd a parancsot `cd …`-vel, ha már a projektmappában vagy. Egy hívásban lehetőleg egy művelet legyen, ne fűzz össze sok parancsot `&&`-sel.
- A commit-üzenetet fájlból add meg (`git commit -F fájl`), ne hosszú, idézőjeles szövegként a parancsban.
