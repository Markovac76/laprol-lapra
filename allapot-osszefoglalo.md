# Collector app — állapot-összefoglaló / átadási dokumentum (v18)

**Frissítve:** 2026. október 14. · **Cél:** ha ez a beszélgetés lezárul és újat nyitsz a Claude projektben, ez a dokumentum adja vissza a kontextust gyorsan.

> Told fel ezt a fájlt a Claude projektbe (cseréld le a régi verziót). Új beszélgetés elején hivatkozz rá: "olvasd el az állapot-összefoglalót, onnan tudod, hol tartunk."

---

## 1. A nagy kép

**OM Curator** platform (még nincs építve) + modulok. **Első modul: Lapról Lapra** — éles, működő, több körben tesztelt és javított. Legutóbb a 27–48. lépés köre zárult (v1.26–v1.30): típusszabályok (a Kártya hét mezője, a Figura neve, rögzített / választható azonosító-típusok), sorozat-azonosítók a sorozat törzsében, új Szám-sáv csempékkel, a „+ Új tétel” és a Gyors Excel új sorai egyetlen szerver-oldali függvényen át (`create_live_issue`), az S2 adatrendezés (öt sorozat azonosítója, Disney Hangos figurák), a függvények hívási jogának és a törzsadat-táblák közvetlen írási jogának szűkítése, a verzióellenőrző sáv és a repó dokumentumainak kizárása az élő címről, végül a többi tábla jogosultsági higiéniája (bejelentkezés nélkül semmi nem olvasható és írható). **Második modul (vázlat): Kockáról Kockára** (Lego-gyűjtemény) — csak v0.1 ötletelés, adatmodell nincs kidolgozva.

---

## 2. Lapról Lapra — ÉLES állapot

### Rendszer
- **URL:** `laprol-lapra.vercel.app` (PWA, telepíthető)
- **GitHub:** `github.com/Markovac76/laprol-lapra` (privát)
- **Supabase:** „Laprol Lapra", Frankfurt, Free
- **Tulajdonos UID:** `25cb3724-02d4-4002-98b0-c93f74ef4e42` (g.marcell.kovacs@gmail.com)
- **Specifikáció:** jelenleg **v1.30** (a projekt-mappában, `laprol-lapra-specifikacio.md`) — ⚠️ a `.pdf` ennél elavultabb lehet, ellenőrizd/generáltasd újra, ha kell.
- **README.md** (v1.8): projekt-belépő dokumentum fejlesztőnek/új munkamenetnek — tech stack, mappaszerkezet, helyi futtatás, deploy, és a "Migrációk"/"Inaktivitás elleni védelem" munkamódszer-szabályok részletesen (ott az elsődleges hely erre, nem itt vagy a specifikációban).

### Fájlszerkezet (natív ES modulok, build-eszköz nélkül)
```
laprol-lapra/
├── index.html          ← csak markup + script betöltés
├── styles.css
├── README.md             ← projekt-belépő dokumentum
├── CLAUDE.md             ← a Claude Code munkaszabályai (minden munkamenet elején ezt olvassa)
├── .gitattributes        ← az .sql fájlok sorvége mindig LF (a függvény-hash ne függjön a sorvégtől)
├── .vercelignore         ← ami NEM az app része (dokumentumok, SQL, scripts/, minták), nem kerül ki az élő címre
├── vercel.json           ← build parancs (node build-config.js) + a verzio.json no-store fejléce
├── build-config.js       ← a Vercel build: config.js (kulcs + verzió) és verzio.json; helyben nem kell futtatni
├── kiadas.json           ← mit tiltson a RÉGI kód: "torzs" (alap: a személyes mentés megy) vagy "minden"
├── verzio.json           ← a szerver aktuális verziója — NINCS git-ben, a build írja
├── config.js            ← NINCS git-ben, Vercel generálja env változóból
├── config.example.js
├── db.local.js            ← Postgres kapcsolati szöveg a migrációkhoz — NINCS git-ben
├── db.local.example.js     ← minta db.local.js-hez
├── .env.test               ← a teszt-felhasználó adatai a felületi próbához — NINCS git-ben; a jelszó csak a próba idejére van benne
├── db-backups/               ← migráció előtti JSON-pillanatképek — NINCS git-ben
├── laprol-lapra-*.sql         ← a migrációk, időrendben (a legutóbbiak: 39-jogosultsag-szigoritas, 40-alapertelmezett-jogok, 40-teszt-kiado-torles, 42-irasi-jogok, 47-jogosultsagi-higienia)
├── scripts/                   ← helyi fejlesztői eszközök, saját package.json + node_modules (utóbbi NINCS git-ben)
│   ├── ro.js                              ← CSAK OLVASÓ lekérdezés (READ ONLY tranzakció, a végén mindig ROLLBACK)
│   ├── backup-db.js, run-migration.js     ← mentés + migráció egy tranzakcióban, 3 mp-es lock_timeout
│   ├── trial-*.js                         ← visszagörgetett próbák élő adaton, MINDIG ROLLBACK, csak jóváhagyással:
│   │                                         publish, renumber, start-edit, uj-szam-komponens, 22-komponensek,
│   │                                         27-tipusok-azonositok (az S2 előtti állapotra íródott), 33-uj-szam, 39-jogosultsag, 42-irasi-jogok,
│   │                                         47-jogosultsagi-higienia
│   ├── audit-jogok.js                     ← CSAK OLVASÓ jogosultsági audit (anon-jog, tiltott jog, RLS nélküli tábla); új tábla migrációja után futtatandó
│   ├── compare-before-after.js            ← olvasó visszaellenőrzés két kódállapot közt: színek / haladás / összeg
│   ├── test-deleted-component.js
│   ├── tests/                             ← Node-tesztek a tiszta modulokra + szam-sav-proba.html (látványpróba bejelentkezés nélkül)
│   └── ui-test/kepek/                     ← a felületi próbák képernyőképei — NINCS git-ben
├── manifest.json + icons/
└── js/
    ├── supabase.js, state.js, modal.js, auth.js, permissions.js, main.js
    ├── version.js                               ← verzióellenőrzés: a régi kód jelzése, a kérések kapuja, a függvényhívások besorolása (tiszta részei tesztelve)
    ├── data.js, model.js, totals.js            ← adatbetöltés, a sorozat-modell (tiszta), az Összeg-kártya számítása (tiszta)
    ├── render.js, thumb.js                      ← megjelenítés, a Szám-sáv csempéi, kis képek és típus-jelek
    ├── type-defs.js                             ← a TÍPUSSZABÁLYOK tiszta modulja (mezők, azonosító-mód, hibalista, sorozat-azonosítók)
    ├── component-template.js                    ← komponens-sablon (tiszta)
    ├── personal.js, my-data.js                  ← személyes adat, „Saját adatlap"
    ├── admin-forms.js                           ← 🔧 „+ Új tétel" űrlap (create_live_issue), Listák
    ├── excel.js                                 ← Gyors Excel: új sor → create_live_issue, meglévő sor → szerkesztési munkaanyag
    ├── admin-users.js
    ├── my-series.js, series-proposal.js, series-list.js, series-sort.js   ← sorozat-választás / javaslás / keresés, rendezés
    ├── karbantartas.js, draft-items.js, draft-diff.js   ← életciklus, munkaanyag-szerkesztés, publikálás előtti összefoglaló
    ├── draft-excel.js, draft-excel-plan.js      ← oda-vissza sablon (a -plan a tiszta logika)
    ├── changes.js                               ← verziókövetés / felkiáltójel
    ├── component-images.js, image-resize.js     ← képfeltöltés / képjavaslat
    ├── help.js, help-content.js                 ← beépített súgó
    └── changelog.js, changelog-content.js       ← 🔔 Újdonságok
```
`price-edit.js` **megszűnt** — a `my-data.js` teljesen leváltotta. Ha bármit módosítasz az appon (`index.html`/`js/`/`styles.css`), ebben a modul-szerkezetben kell — nem egyetlen nagy fájlban. A `scripts/` mappa ettől külön áll: helyi fejlesztői eszköz, sosem megy a Vercel build-be.

### Munkafolyamat
1. Home-felületen (itt) átbeszéljük/kidolgozzuk a döntéseket, vagy egyben egy instrukció-fájlt (`claude-code-N-lepes-....md`) állítunk össze.
2. Ezt bemásolod a Claude Code-nak, ő megépíti, kérdez ha kell. Commit és push csak akkor, ha az utasítás vagy te kifejezetten jóváhagytad (az utasítás megmondhatja: „commitold, de ne pushold").
3. A Code a jelentés végén kiírja, mit nézz meg élesben; te bejelentkezve ellenőrzöd. A Code az adatbázist csak olvasó segéddel (`scripts/ro.js`) látja, a felületet pedig külön teszt-felhasználóval próbálja — a te fiókodba nem lép be, a személyes státuszgombjaidat nem kattintja.
4. Minden kör végén: súgó, változásnapló, specifikáció (verzióemelés), ez az állapot-összefoglaló.

A Code állandó munkaszabályai a repó `CLAUDE.md` fájljában vannak (nyelv, migrációk, próbák, titkok kezelése).

**Szabályok, amelyek ebben a körben alakultak ki:**
- **Migráció:** a teljes SQL megmutatása → a te jóváhagyásod → `node scripts/run-migration.js <fájl> <címke>` (mentés a `db-backups/` mappába, egyetlen tranzakció, 3 mp-es `lock_timeout`, hiba esetén ROLLBACK) → számlálók és a függvények hash-e előtte és utána. A jóváhagyott SQL szövegén a Code egy karaktert sem változtat; eltérésnél megáll. Hibánál nem próbálja újra.
- **Visszagörgetett próba élő adaton** (`scripts/trial-*.js`): egyetlen tranzakció, a végén mindig ROLLBACK, előtte / utána azonos számlálók és hash-ek. Csak jóváhagyással.
- **Olvasás:** mindig a `scripts/ro.js` segéddel (csak olvasó tranzakció).
- **Felületi próba:** külön teszt-felhasználóval, erre létrehozott TESZT sorozaton. A jelszót te írod be a böngészőben; a Code soha nem írja ki, és nem gépeli be. A jelszó a próba után kikerül a `.env.test` fájlból, a TESZT sorozatot te törlöd.
- **Titkok:** kapcsolati szöveg, kulcs, jelszó, a felhasználók e-mail-címe nem kerül jelentésbe, naplóba, commitba.
- **Átnézendő csomag:** nagyobb migráció előtt `NN-lepes-atnezesre.md` készül (teljes SQL, mellékhatások, számlálók, próbák, futtatási terv, visszaút); ez nem kerül a repóba.
- **Sorvégek:** az `.sql` fájlok LF sorvégűek (`.gitattributes`).
- **Telepítés:** új, nem az apphoz tartozó fájl vagy mappa a `.vercelignore`-ba kerül (az élő címen 404-et kell adnia). Új `.rpc("…")` vagy Storage-hívás csak a `js/version.js` besorolási listáival együtt kerülhet a kódba (a gépi próba őrzi).

### Közvetlen Postgres-kapcsolat a migrációkhoz **[DÖNTVE, megvalósítva]**
Az anyanotesz projektben már bevált minta átvéve: a Code egy `scripts/run-migration.js` Node-scripttel (a `pg` npm-csomaggal, `scripts/`-en belüli, gitignore-olt saját `node_modules`-szal — ez NEM az app build-jének/deploy-jának a része) fut le a Postgres ellen, `db.local.js`-ben (gitignore-olt, `db.local.example.js` a minta) tárolt connection stringgel. **v1.10: "Session pooler"-re váltva** (korábban "Direct connection") — az kizárólag IPv6-címet publikál, ami egy munkamenetből elérhetetlennek bizonyult; a Session pooler IPv4-kompatibilis és megtartja a session-t egy tranzakción belül, tehát a `BEGIN`/`COMMIT` migrációkhoz is jó. Minden futtatás előtt automatikusan friss `db-backups/` JSON-pillanatképet készít az összes táblából (gitignore-olt), és a migrációt `BEGIN`/`COMMIT`/`ROLLBACK` tranzakcióba csomagolja. A jóváhagyási kapu (teljes SQL megmutatása, explicit "mehet" várása, mielőtt a script lefut) VÁLTOZATLANUL kötelező — ez nem szoftveres kényszer, hanem a beszélgetés szintjén betartott szabály. Technikai eltérés az anyanotesz-mintától: az eredetileg tervezett ephemeral `npx -p pg` injektálás ezen a gépen nem működött megbízhatóan (modul-feloldási hiba), ezért egy dedikált `scripts/package.json` + helyi `node_modules` lett a megoldás — funkcionálisan egyenértékű, semmi nem kerül belőle git-be. **Élesben végpontig tesztelve** (2026-08-26): valódi kapcsolódás, mind a 17 tábla helyes JSON-backupja, és egy idempotens migráció sikeres, tranzakciós újrafuttatása.

### Supabase inaktivitás elleni védelem — heti "heartbeat" **[DÖNTVE, megvalósítva]**
A Supabase Free plan 7 nap valódi adatbázis-aktivitás (írás) hiánya után szüneteltet egy projektet — pusztán a Dashboard/app megnyitása nem elég, ez majdnem megtörtént élesben egyszer (figyelmeztető email érkezett róla). Megoldás: egy tisztán adatbázis-szintű, `pg_cron`-nal ütemezett heti job (**nincs benne Edge Function, `pg_net` vagy külső titok** — szándékosan a legegyszerűbb, elégséges megoldás, mivel egyedüli cél az inaktivitás elkerülése, semmi más — nem tévesztendő össze a hordozhatóság/export nyitott kérdésével, ami külön, később aktuális téma).
- **`system_heartbeat` tábla** — egysoros, tisztán technikai; RLS bekapcsolva, DE szándékosan nincs rajta policy, így a kliens (böngésző/app) semmilyen hozzáférést nem kap hozzá, kizárólag a `pg_cron` éri el.
- **`weekly-heartbeat` cron job** — minden vasárnap 03:17 UTC-kor egy egyszerű UPSERT-et futtat rajta (`cron.job`/`cron.job_run_details` táblákból ellenőrizhető, hogy lefutott-e).
- SQL: `laprol-lapra-heartbeat.sql`. Előfeltétel: a `pg_cron` extension engedélyezve legyen (a script megpróbálja magától bekapcsolni; ha nem sikerül, Dashboard → Database → Extensions → pg_cron).
- **Megerősítve élesben** (2026-08-26): a `weekly-heartbeat` job aktív, a `17 3 * * 0` ütemezéssel, a tulajdonos ellenőrizte a `cron.job` táblában.

---

## 3. Adatmodell

### Táblák (a korábbi `series/issues/components/lists/counters` mellett):

**members** — a háromszintű jogosultság: `user_id`, `role` ('user'/'admin'/'owner'), `status` ('active'/'disabled'), `display_name`. SECURITY DEFINER függvények (`my_role()`, `is_staff()`, `is_active()`) kerülik el az RLS-rekurziót. A tulajdonos sora triggerrel védett.

**member_status** — komponens-szintű személyes állapot (megvan/hiányzik/nem kell + darabszám + jegyzet), user_id-vel elkülönítve. Ez teszi lehetővé a **megosztott katalógust**: a sorozatokat/tételeket a staff viszi fel, MINDENKI látja, de a jelölés személyes.

**member_issue_data** — szám-szintű személyes adat: `fizetett_ar`, `beszerzesi_mennyiseg`, `beszerzes_datuma`, `forras`, `ar_auto`. Az `issues.eredeti_ar` (korábban „fedélár") törzsadat, csak staff szerkeszti (a draft-útján, lásd lent).

**A sorozatkezelés-újratervezésből (v1.6):**
- **member_series** — a kiválasztás rétege (`user_id`, `series_id`, `is_selected`, `selected_at`, `deselected_at`); a fülsáv ebből épül, nem az összes publikált sorozatból.
- **draft_series / draft_issues / draft_components** — a sorozat-életciklus pool-ja és a szerkesztés-munkaanyag (saját UUID-k, `source_*_id` mutat az élő párra). `draft_issues.deleted` (v1.7): Szám-törlés jelzője a draftban.
- **change_log** — mezőnkénti változás-napló (series/issue/component közösen); **member_seen** — userenkénti „utoljára látott verzió".
- **image_proposals** — képjavaslat-workflow; **`components.upload_enabled`**, **`components/issues/series.version`**, **`series.lifecycle`** (`active`/`unpublished`) + `force_delete_*` mezők.
- **`issues.is_deleted`** (v1.7) — Szám soft-delete jelzője (lásd 4. fejezet).
- **global_counters** — a sorozat-kód-számláló globálissá vált (a régi, userenkénti `counters` tábla holtan megmaradt). A sorszám soha nem használódik újra: a törölt sorozatok (legutóbb a TESZT próbasorozat) után hézag marad, a következő szabad szám ma a 16.

**A 22–37. lépésből (v1.24–v1.26):**
- **`components.is_main`** (fő elem ★), **`components.is_deleted`** / **`draft_components.deleted`** (komponens soft-delete), **`components.adatok jsonb`** (a típus saját mezői, pl. a Kártya Gyűjteménye).
- **`series.component_template`** / **`draft_series.component_template`** — a komponens-sablon (az új Számok kiindulása).
- **`component_type_defs`** — a típusleírás és a típusszabályok (azonosító-mód: fix / választható / nincs / szabad; megengedett azonosító-típusok; a mezők és a kötelezők). Csak migrációval állítható, az app nem írhatja.
- **`series.azonositok`** / **`draft_series.azonositok`** — sorozat-azonosítók (legfeljebb két ISBN / ISSN), CHECK-kel.
- **37 függvény** a `public` sémában (lista: specifikáció 13.14.7; hívási jogok: 13.14.9). Az új Szám közvetlen felvétele: `create_live_issue`.

**Az élő adat ma (2026-10-13, a TESZT sorozat törlése után):** 10 sorozat, 582 Szám, 1026 komponens; 2 tag (tulajdonos + a teszt-felhasználó admin szerepkörrel). Sorozat-azonosítója öt sorozatnak van (Disney, Volkswagen model, Disney Hangos, Lego Star Wars, Lego Marvel).
- Storage: `component-images` bucket (publikus, közös — nem felhasználónkénti).

### RLS-modell összefoglalva
`series/issues/components/lists` írása (insert/update): `is_staff() AND is_active()`; a `series` **törlése** RLS-szinten senkinek sincs engedélyezve — kizárólag owner-ellenőrzött SQL-függvényeken át (13.7). Olvasása: mindenki. `member_status`/`member_issue_data`/`member_series`/`member_seen`: mindenki csak a sajátját. `change_log`/`image_proposals`: olvasás mindenkinek, írás staffnak. `draft_series` SELECT **staff-only**, INSERT bárki aktív fióknak `pool_type='new'`-ra; `draft_issues`/`draft_components` **teljesen staff-only** — a javaslat-beküldő saját, még fel nem vett javaslatához külön SECURITY DEFINER RPC-n (`propose_bulk_issues`) ír, nem közvetlenül. A legtöbb összetettebb művelet (publikálás, force-törlés, seed, tömeges javaslat-feltöltés) SECURITY DEFINER SQL-függvényen át fut, egy tranzakcióban. **v1.28 óta a táblajog is szűk:** a `series`, `issues`, `components`, `lists`, `change_log`, `global_counters` táblán a kliens csak hat oszlopot írhat közvetlenül (és a Listákba szúrhat be), minden más írás függvényen át megy — a sorszintű szabály fölött ez egy második zár (specifikáció 13.14.10). **v1.30 óta a többi táblán is:** a bejelentkezés nélküli hívó (`anon`) egyik táblán sem kap jogot, az olvasást sem; a `members` táblán csak a `status` és a `role`, az `image_proposals` táblán az elbírálás három oszlopa írható közvetlenül; a `counters`, `global_counters`, `system_heartbeat` a bejelentkezettnek sem érhető el; az új táblák magától semmilyen jogot nem adnak (specifikáció 13.14.12).

**Fontos, éles tapasztalatból tanult minta:** ha egy táblán a SELECT-szabály szűkebb, mint az INSERT-szabály, egy `.insert().select()` (visszaolvasással kombinált beszúrás) a szűkebb jogú felhasználóknál RLS-hibával elbukik, még ha a beszúrás önmagában sikeres is lenne — Postgres a `INSERT...RETURNING` kimenetét is a SELECT-szabályon engedi át, és hibát dob, ha az nem enged. Ez okozott egy valós regressziót ebben a körben (lásd 5. fejezet) — a tanulság: ilyen esetben a kliens generálja az id-t (`crypto.randomUUID()`) beszúrás előtt, nincs szükség visszaolvasásra.

---

## 4. Elkészült funkciók

**Alapfunkciók:** komponens-modell, hierarchia-szín, körbeforgó jelölés, tapadó fejléc, lenyíló képsáv, rejthető belekerülési költség, adaptív statisztika, összecsukható fülsáv, színcsaládos paletta, PWA.

**Jogosultság + ár-modell (v1.4–1.5):** háromszintű jogosultság (user/admin/owner) + felhasználó-kezelő felület (👥 gomb, staffnak) — letiltás/visszaengedés, admin-jog ki/beadás (csak owner), letiltott user azonnal kizárva belépéskor. Ár-modell szétválasztva: Eredeti ár (törzsadat) vs. Fizetett ár (személyes), automatikus kitöltés/nullázás, "nem ismert" kezelés, kétnézetes hero.

**Sorozatkezelés-újratervezés (v1.6, teljes, 5 lépés — specifikáció 13. fejezet):** kiválasztás rétege (📚 Sorozataim, `member_series`, korlátlan le-/újra-választás); sorozat-életciklus + 🗂️ Karbantartás staff-only menüpont (Aktív/Munka-pool/Publikálatlan); draft/verziókövetés/felkiáltójel (`publish_draft_series()`, `change_log`+`member_seen`, négy jelzési hely); teljes képkezelés-csővezeték (közös Storage bucket, kliens-oldali átméretezés, staff-feltöltés + user-javaslat workflow); force-törlés (owner-only, 0 aktív kiválasztásnál azonnali, egyébként 14 napos türelmi idő).

**Excel-import ÉS a draft/pool-folyamat összehangolása (v1.6 vége felé) — LEZÁRVA:** publikált sorozatra irányuló import, meglévő tételek módosítása → szerkesztési draftba (szokásos publikálás-folyamattal); új tétel/komponens → közvetlen írás. Mellékesen javítva: a komponens-státusz korábban a holt `components.status` oszlopba íródott a személyes `member_status` helyett.

**15-pontos hibajavítási kör — TELJESEN LEZÁRVA (v1.7, `claude-code-4-lepes-hibajavitasok.md` alapján):**
- Mobil UI/CSS finomítások: chips-görgetősáv láthatóság, felkiáltójel-badge pozíció, fejléc-gomb sorrend/hangsúly (❓/⎋ nagyobb), kép-placeholder méret a lenyíló panelben.
- Terminológia-egységesítés: a gyűjthető egység mindenütt „Szám" (nem „tétel"/„lapszám" vegyesen).
- Egységes, kézzel írt inline SVG-ikonrendszer a fejléc-gombokon (a natív emoji platformfüggő megjelenése helyett).
- Force-törlés korai lezárása, ha a 14 napos türelmi idő alatt 0-ra csökken az aktív kiválasztás.
- **A staff-only „Tétel szerkesztése" gyors-panel megszűnt.** Helyette: mindenkinek elérhető **„Saját adatlap"** (`my-data.js`, ✎ ikon a panelben — komponensenkénti státusz/darabszám/jegyzet + szám-szintű beszerzés egy helyen), és egy már élő Szám törzsadatának MINDEN módosítása a Karbantartás draft-útján megy át. Szám-**törlés** bevezetve, **soft-delete-tel** (`issues.is_deleted`) a szokásos diff/verzió/felkiáltójel-gépezeten át, hogy a törlés-értesítés a tétel törlése után is megjelenjen a gyűjtött elfogadás listájában.
- **Komponens-típus utólagos átsorolása** a draft-szerkesztőben (pl. „Egyéb" → egy később felvett pontos típus), egyedi, komponensenkénti korrekcióként.
- **Sablon-alapú tömeges tétel-feltöltés** draftokhoz (`draft-excel.js`), két helyen: az „Új sorozat javaslása" köztes lépésében és a Karbantartás draft-szerkesztőjében. Nem-staff beküldőknél egy külön SECURITY DEFINER RPC (`propose_bulk_issues`) engedi, a staff-only draft-tábla RLS mellett is.
- A meglévő, élő sorozatokhoz tartozó Excel-sablon gombok (⬇ Sablon/⬆ Excel) mostantól minden nézeten (mobilon is) elérhetők, ugyanabban a sorban a „+ Új tétel"/„☰ Listák" gombokkal.
- Fejléc: 🗂️ Karbantartás és 📚 Sorozataim gomb helyet cserélt.
- **Beépített súgó** (`help.js`/`help-content.js`): ❓ fejléc-gomb, 17 kategória, „Felhasználói"/„Adminisztrátori" fül, a tényleges felület alapján írva.
- **Melléktalálat, javítva:** egy önálló RLS-regresszió a javaslat-beküldésben — lásd 5. fejezet és a 3. fejezet záró bekezdése.

**Komponens-szintű "Megnevezés" + több azonos típusú komponens (v1.9, specifikáció 5.3/6.3/6.4, 10.10 lezárva):**
- Opcionális, szabad szöveges `megnevezes` mező minden komponensen ("Típus #N" fallback, ha üres és 1-nél több példány van egy típusból).
- Egy Számon egy típusból mostantól TÖBB, egyedi példány is felvehető (pl. két különböző Lego-csomag) — sem a `components`, sem a `draft_components` tábla nem korlátozta ezt DB-szinten, tisztán a kliens `it.comps[típus]` (egy objektum, nem tömb) modellje volt a gát. Ez most `it.comps[típus]` = **tömb** mindenütt (`js/state.js`, `data.js`, `render.js`, `main.js`, `my-data.js`, `draft-items.js`, `excel.js`, `draft-excel.js`, `changes.js`).
- "+ Még egy [Típus] hozzáadása" gomb a Karbantartás draft-szerkesztőjében ÉS a "+ Új tétel" gyors-felvitelnél is.
- Színezés kiterjesztve: "legrosszabb eset nyer" a domináns típus(ok) ÖSSZES példányára (rangsor: hiányzik > jelöletlen > nem kell > megvan) — 1 példánynál nincs viselkedésváltozás a régihez képest.
- Excel-sablon mindkét helyen (élő sorozat + draft/javaslat) új "megnevezés" oszlopot kapott típusonként, kizárólag az elsődleges (első) példányra.
- `publish_draft_series()` és `propose_bulk_issues()` SQL-függvények frissítve — a `megnevezes` a szokásos diff/verzió/change_log-gépezeten megy át.
- SQL: `laprol-lapra-komponens-megnevezes.sql`, `-rpc.sql`, `-publish.sql`.
- **Melléktalálat, javítva:** a Karbantartásban egy "Új javaslat" sehol nem mutatta a sorozat nevét (Beérkezett/Munkaanyag listában és a szerkesztő címében sem) — tisztán megjelenítési hiba a `karbantartas.js`-ben (`pool_type==="new"`-nál a felirat kihagyta a nevet), NEM RLS/JOIN-probléma.

**SÜRGŐS hibajavítás — "eltüntethetetlen felkiáltójel" (v1.10, specifikáció 13.6):** egy vadonatúj Szám/komponens `version=1`-gyel, `change_log`/`member_seen` nélkül jött létre — a badge örökre aktív maradt, a "Összes változás" modal joggal üresnek látta, és a "Mind elfogadom" is csak a kattintó saját alapvonalát javította, a sorozatra feliratkozott TÖBBI usernek nem. Élesben megerősítve a "Fast & Furious modellek" #1 tételén (a tulajdonosnak rendben volt, egy másik feliratkozott usernek egyetlen `member_seen` sora sem volt rá). Javítás: új `seed_issue_seen_for_subscribers()` SQL-függvény minden új Szám/komponens létrejöttekor lefut (`publish_draft_series()`, "+ Új tétel", Excel új sor) — MINDEN jelenlegi feliratkozónak azonnal alapvonalat ad. Egyszeri, biztonságos visszatöltés a már létrejött, alapvonal nélküli (és SOHA nem módosult) tételekre. SQL: `laprol-lapra-uj-tetel-seen-baseline.sql`.
**Melléktalálat:** a migrációs DB-kapcsolat "Direct connection"-ról "Session pooler"-re váltva — a Direct connection host kizárólag IPv6-címet publikál, ami egy munkamenetből elérhetetlennek bizonyult.

**Excel-import a draftban frissíti a meglévő lapszámot (v1.19):** a draft-szerkesztő ⬆ Sablon feltöltése (`js/draft-excel.js`) korábban minden meglévő lapszámot kihagyott (szerkesztési draftban mind létezik). Most a nem üres cellák értékeivel frissíti a draft-tételt, előnézettel (új/frissül/változatlan); a publikálás a szokásos diff→verzió→felkiáltójel úton megy. Az „Új javaslat" beküldői út továbbra is kihagyó. Nincs SQL-változás.

**SÜRGŐS hibajavítás: lapszám-csere ütközött az egyediségi szabállyal (v1.18):** két AKTÍV Szám sorszámának felcserélése (#29↔#30) ugyanazt a `duplicate key`-hibát dobta, mint a korábbi (v1.14) eset, de más okból — a publikálás soros UPDATE-jei a csere köztes állapotában átmenetileg két Számot hagytak ugyanazzal a lapszámmal. Mivel a v1.14-es részleges unique index sosem lehetett volna halasztható, a végleges megoldás egy `EXCLUDE ... WHERE ... DEFERRABLE INITIALLY DEFERRED` constraint, ami egyszerre részleges ÉS halasztott — a két javítás nem zárja ki egymást. SQL: `laprol-lapra-lapszam-deferrable.sql`. Élesben tesztelve a valódi "Forma 1" #29/#30 sorain.

**Sorozat-szintű borítókép (v1.17):** az 1-es szám előtti ingyenes bemutató-/reklámfüzethez egy önálló, vizuális/referencia mező a sorozaton — kicsi, álló formátumú miniatűr a Hero-doboz fejlécében, a kiadó/cím mellett. Sehol nem számít bele darabszám/százalék-számításba. A workflow a MEGLÉVŐ komponens-kép mechanizmus (feltöltés/csere, user-javaslat, admin jóváhagyás/elutasítás, törlés) általánosítása — az `image_proposals` tábla `entity_type` megkülönböztetéssel bővült, a `js/component-images.js` függvényei type-paraméterrel egységesek mindkét entitásra, nincs párhuzamos kód. SQL: `laprol-lapra-sorozat-borito.sql`.

**Valódi Kategória (témakör) mező + élénkebb színek (v1.16):** finomítás a v1.15-ös első próbálkozáson, élesben kapott visszajelzés alapján ("nagyon hasonló színek", "jobb lenne élénkebb"). Önálló, listatár-alapú `kategoria` mező a sorozatokon (Kiadó mintájára — bővíthető ☰ Listákon, választható az Új sorozat/Karbantartás formon) — a fülsáv-választó TÉNYLEGESEN csoportosítva mutatja a sorozatokat témakör szerint (nem csak a szín családjából "visszafejtve"). Modellek → Kék, Mese → **Vörös** (a Magenta helyett — az eleve élénk, meglévő Vörös családot kapta), Lego → Zöld (8 árnyalat, 6 tartalék a tervezett Spider-Man/Batman/Jurassic Park/Ninjago sorozatoknak). A Kék/Zöld családok szaturációja jelentősen megemelve, a Zöld hue-ja teal-ről valódi zöldre tolva. SQL: `laprol-lapra-kategoria-mezo.sql`. Súgó + changelog frissítve.

**Első próbálkozás — Sorozat-színek tematizálása + Változásnapló bevezetése (v1.15, felülírva v1.16-ban):** Modellek → Kék, Mese → Magenta, Lego → Zöld színcsalád. **Új, állandó rendszer:** 🔔 "Újdonságok" changelog (`js/changelog-content.js`/`changelog.js`) — mostantól minden láthatóan megjelenő változtatáshoz kötelező egy egyszerű nyelvű bejegyzés.

**SÜRGŐS hibajavítás: publikálás ütközött soft-delete-elt/élő lapszámmal (v1.14):** az `issues_series_id_lapszam_key` sima `UNIQUE(series_id, lapszam)` volt, a soft-delete-et figyelmen kívül hagyva — egy törölt Szám lapszáma örökre foglalt maradt. Konkrét eset: a "Volkswagen modellautógyűjtemény" draftjában 20 db, hibás AI-adatot javító tétel (#4-19, #27, #30, #59, #61) élő pár nélkül maradt (a "Szám törlése a draftból" gomb csak a draft-tételt törli, az élő Számot nem) és vadonatúj beszúrásként ütközött a még élő, régi sorral. Javítás: **részleges unique index** (`WHERE NOT is_deleted`), + a konkrét draft 20 tételének visszakötése az élő párjához (adatvesztés nélkül). SQL: `laprol-lapra-lapszam-reszleges-unique.sql`.

**Kép törlésének lehetősége (v1.13):** staff (admin/owner) "🗑 Kép törlése" gombbal eltávolíthatja az élő komponens-képet (visszaáll "Nincs kép" állapotra), azonnali megerősítéssel, türelmi idő nélkül — a Storage-fájl is törlődik. Nincs SQL-változás, a meglévő jogosultság/Storage-policy már fedte.

**Komponens-kép levágás nélküli megjelenítése (v1.12):** a hibajavítási kör 15. pontja ("nagyobb kép-placeholder") kiegészítve — magas, álló formátumú magazin-borítóknál (pl. Forma-1 #28, II. VH Repülők #35) a `cover`-vágás levágta a cím/kiadói logó sávot; a nagyobb doboz önmagában nem volt elég. Váltás `object-fit: contain`-re mindenhol (panel + képjavaslat-előnézet); Magazin/Könyv típusnál a doboz 150×210px-re (kb. A4-arány) állítva, a többi típusnál (Modell, Figura, Lego, Egyéb) változatlan.

**Teljeskörű 1000-soros lapozási átvizsgálás (v1.11):** a fenti hiba gyökere (Supabase/PostgREST alapból max. 1000 sort ad vissza `.select()`-re, `range()` nélkül, hibaüzenet nélkül) elvben BÁRMELYIK lapozatlan lekérdezést érintheti — átnéztük a teljes kódbázist. A közös `fetchAllRows()` segéd (`js/supabase.js`) mostantól ott is lapoz, ahol eddig nem: `change_log`/`member_seen` (`js/changes.js`), `components` egy nagy sorozat/draft összes tételére (`js/karbantartas.js`, `js/my-series.js`, `js/draft-items.js` — a több-komponens funkció óta nagyobb lehet), és két, MINDEN userre vonatkozó app-szintű lekérdezés (`member_series`, `members` — `js/karbantartas.js`, `js/admin-users.js`).

**Feltöltés-átalakítási kör — a Lego Star Wars publikálási hiba után (v1.20, részletek: specifikáció 13.11):**
- **Kötött elv:** a lapszám NEM azonosító (ennél a sorozatnál a felvivő által adott folyamatos sorszám), a név sem az; a Szám azonossága egy rejtett azonosító. Élő és draft tételt SOHA nem lapszám alapján kötünk össze.
- **Visszaadás szerkesztésre** („Publikálásra váró" → „Munkaanyag") és érthető publikálási hibaüzenet (a hibaablak ezt ajánlja).
- **Törölt-jelölés:** élő párral rendelkező Számnál a draftban nem fizikai törlés történik, hanem `deleted=true` (különben a publikálás nem nyúl az élő Számhoz, az ott marad).
- **Azonosító-alapú oda-vissza sablon:** a letöltés a draft aktuális állapotát tükrözi, rejtett Szám-/komponens-ID-val; azonosítós sor = frissítés, azonosító nélküli = új; név-egyezés csak javaslat; üres cella nem töröl; a hiányzó sor marad; elavulás-jelzés (ujjlenyomat); blokkoló azonosító-hibák (lemásolt sor); az előnézet soronként osztályoz.
- **Egy forrás az ütközés-ellenőrzésre** (DB): „Kész", feltöltés-előnézet és feltöltés-alkalmazás (egy tranzakcióban) ugyanazt használja; a publikálás utáni állapotot szimulálja.
- **Mentés-védelem mindenhol** (`guarded()`), magyar hibaüzenetek; a Listák kétszeri futásának oka (halmozódó figyelő) megszűnt.
- **Listák:** átnevezhetők, közös egyediségi kulcs, első betű nagy, ékezetmentes új azonosító, „Egyéb" mindig utolsó.
- **Lapszám-csendesítés:** a puszta lapszám-változás nem emel verziót (nincs felkiáltójel), a `change_log` rögzíti.
- **A Lego Star Wars draft helyreállítása** név alapján, jóváhagyással történt; a tulajdonos publikálta (09:39 UTC, még a régi függvénnyel — ezért a #6 verziója 5 → 6 lett, nyugtázva).
- **Szerkesztés indítása (v1.21):** egy szerver-oldali tranzakció (`start_edit_draft`), egy sorozathoz legfeljebb egy szerkesztési draft; a Gyors szerkesztés → Excel létrehozó ága ugyanezt használja (a párosítása továbbra is lapszám-alapú — nyitott 7. pont).
- **Autós Legendák hibája (v1.22):** az oda-vissza sablon az új sorokhoz nem hozott létre üres komponenst → komponens nélküli élő Számok. Javítva: szerver-oldali alap-komponensek az új Számokhoz, „Kész” védelem (≥1 komponens), egyszeri adatjavítás (60 komponens). A beküldői RPC szándékosan változatlan.
- **Dátumkezelés (v1.22):** a „ma” helyi dátum (frissül); a mai dátumú Szám megjelent; a „Várható”, a piros dátum, a színezés és a „Következő megjelenés” egy szabályt (`isFutureDate`) használ.
- **Lapozás (v1.22):** a `fetchAllRows` egyedi kulcs szerint is rendez; a `components` tábla már 1000 sor fölött van (1 025).
- **Összeg-kártya (v1.23):** mindkét nézet azonos Számokat (≥1 komponens megvan) és a beszerzési mennyiséget használja; az ár a Szám (magazin) ára, komponens-szintű ár nem kell; a kártyán a Szám-darabszám látszik. Közös számítás: `js/totals.js` (tesztelve). A tulajdonosi fiókban csak a Lego Star Wars eredeti összege változott (10 495 → 78 961 Ft).
- **22. lépés / 1. kör (v1.24):** összecsukott Szám-sor (legfeljebb 3 elem egymás alatt, kis kép + státuszgomb, „+N"); **fő elem (★)** a komponensen (`is_main`, csendes váltás, nem törölhető); „N Szám" a függő listákon + publikálás előtti összefoglaló (`draft-diff.js`); sorozat-lista keresés/rendezés közös komponenssel (`series-list.js`); stabil lapozás; `scripts/compare-before-after.js` (színek / haladás / összeg, minden sorozatra).
- **22. lépés / 2. kör (v1.25):** komponens-sablon (sorrend, fő elem, kötelező, azonosító-szabály, alap azonosító-típus, számít a színnél) + típusleírás; sablon szerinti színezés (538 Szám, 0 eltérés); más típusú elem egy Számhoz, külön haladásjelzővel; „Kész” figyelmeztetések (ajánlott / duplikált azonosító); komponens valódi törlése (soft-delete, csendes, a fő elem nem törölhető); törölt komponens egyetlen szűrési ponton (`model.js`). SQL: `komponens-sablon`, `tipus-hozzaadas`, `komponens-torles` — ÉLESÍTVE.

**27–37. lépés — típusszabályok, sorozat-azonosítók, közvetlen új Szám, adatrendezés (v1.26, részletek: specifikáció 13.14):**
- **Új Szám-sáv (27. lépés):** az elemek csempékben, legfeljebb három egymás mellett, a fő elem (★) elöl; csempénként státuszgomb az elem nevével, kép, típus-jel, darabszám (mindig látszik); „+N" a többire.
- **S1 — szerkezet (29. lépés, ÉLES):** a típusleírás szabályai; a Kártya hét mezője (Gyártó, Gyűjtemény*, Széria, Kiadás éve, Sorozatváltozat, Kód*, Név*); a Figura neve kötelező; Lego és Kártya rögzített azonosító-típus, Magazin / Könyv csak ISBN vagy ISSN, Figura / Modell azonosító nélkül; sorozat-azonosítók (legfeljebb kettő, a fejlécben látszik, csendes). A „Kész" csak az új és a módosított elemeken blokkol, a régieknél figyelmeztet.
- **A szerkesztők egysége (33. lépés):** a típusnak nem megfelelő tárolt adat látszik és javítható; a kötelező üres mező kiemelve; a sorozat-azonosító hibája a mező elhagyásakor jelez; állandó elem-sorrend.
- **`create_live_issue` (35. lépés, ÉLES):** a „+ Új tétel" űrlap és a Gyors Excel új sorai egyetlen szerver-oldali függvényt hívnak — vagy a teljes Szám létrejön, vagy semmi; a szabályok a munkaanyagéval azonosak; a hibák egyszerre, érthetően jönnek.
- **S2 — adatrendezés (37. lépés, ÉLES, 2026-10-13):** öt sorozat megkapta a sorozat-azonosítóját, 155 komponensről lekerült az ismételt érték; a Disney Hangos 82 „modell" eleme „figura" lett; a Lego Star Wars #29 kártya Kártyakód típusú; a Listákban „Kártya"; a `draft_ready_warnings` átmeneti szabálya kikerült. Csendes volt: a színek, a haladás, az összegek és a személyes adatok nem változtak, új felkiáltójel nem keletkezett.
- **Tesztelés:** teszt-felhasználó + TESZT sorozat a felületi próbához (a sorozat azóta törölve), visszagörgetett próbák (60 + 19 ellenőrzés), `scripts/ro.js`.
- SQL: `27-s1-szerkezet`, `33-uj-szam-fuggveny`, `27-s2-adatrendezes` — mind ÉLESÍTVE.

**39–40. lépés — jogosultság-szigorítás (v1.27, ÉLES, 2026-10-13; részletek: specifikáció 13.14.9):** a függvények hívási joga szűkítve (a bejelentkezés nélküli hívó 36 helyett 8 függvényt hívhat, a változásnaplóba és a sorszámlálóba író belső segédeket már senki kívülről); az új függvények alapértelmezett joga átállítva; a „Teszt Kiadó” próbasor törölve. A felhasználónak látható működés nem változott. SQL: `39-jogosultsag-szigoritas`, `40-alapertelmezett-jogok`, `40-teszt-kiado-torles` — mind ÉLESÍTVE.

**42–43. lépés — a közvetlen írások lezárása (v1.28, ÉLES, 2026-10-13; részletek: specifikáció 13.14.10):** az élő törzsadat-táblákba a kliens már csak hat oszlopot írhat közvetlenül (kép, kapcsolók, életciklus, a Listák megjelenített neve) és a Listákba szúrhat be; Számot, komponenst, sorozatot közvetlenül sem beszúrni, sem törölni, sem átírni nem lehet — csak függvényen át. A bejelentkezés nélküli hívó sehol nem ír. A felhasználónak látható működés nem változott. SQL: `42-irasi-jogok` — ÉLESÍTVE.

**44–46. lépés — verzióellenőrző sáv és a nyilvános dokumentumok lezárása (v1.29, ÉLES, 2026-10-13; részletek: specifikáció 13.14.11):** (1) **Lelet és lezárás:** a Vercel beállítása miatt a repó minden fájlja letölthető volt az élő címen (dokumentumok, SQL-ek, szkriptek; titok nem). A `.vercelignore` óta csak az app kerül ki; a többi 404-et ad. (2) **Sáv:** a build (`build-config.js`) az app fájljainak ujjlenyomatát írja a `config.js`-be és a `verzio.json`-ba; a kliens (`js/version.js`) betöltéskor, visszatéréskor és törzsadat-írás előtt ellenőriz; régi kódnál sáv szól, és a Supabase-kliens kapuja a törzsadat-írásokat nem engedi ki. A `kiadas.json` dönti el, hogy egy kiadás a régi kódnak a személyes mentést is tiltsa-e. Adatbázis-változás nincs.

---

## 5. A kör során talált és javított RLS-hiba (tanulságos eset)

A hibajavítási kör 11. pontja (sablon-alapú tömeges feltöltés) a javaslat-beküldés kódját `.insert()`-ről `.insert().select().single()`-re módosította, hogy megkapja az új draft `id`-ját a köztes lépéshez. Ez minden **nem-staff** beküldőnél RLS-hibával ("new row violates row-level security policy for table draft_series") elbuktatta a beküldést — a `draft_series` SELECT-szabálya staff-only, és Postgres az `INSERT...RETURNING` kimenetét is átengedi a SELECT-szabályon, hibát dobva, ha az nem enged (owner/staff mindig átment, teszt user sosem — platform-/böngésző-függetlenül). A tulajdonos ezt élesen tesztelve vette észre, és pontosan leírt tünetekkel jelezte. Javítás: a kliens generálja az `id`-t (`crypto.randomUUID()`) beszúrás előtt, nincs szükség visszaolvasásra — nincs RLS-módosítás.

---

## 6. NYITOTT/nem megépített dolgok — Lapról Lapra

1. **Sorozat-beküldő értesítése publikálásról/elutasításról** — jövőbeli fejlesztésként jegyzett, még nem tervezett: amikor egy user „Új javaslat"-ot küld be, jelenleg nem kap értesítést, ha publikálják vagy elutasítják/törlik. Formája nincs meghatározva — a tulajdonos elképzelése szerint elég egy belépéskor/frissítéskor felugró, okézandó ablak (hasonló a force-törlés türelmi idő figyelmeztetéséhez).
2. **Üzenetküldés az adminnak** (spec 13.4): max 150 karakter, user → staff — koncepció szinten, nincs építve.
3. **Valódi fióktörlés** (Edge Function kell, service_role kulccsal — eddig csak letiltás épült meg).
4. **Címkerendszer** — platform-szintű, még nem szabványosítva.
5. **Hordozhatóság/export** — nincs kidolgozva.
6. **Komponens soft-delete** — **KÉSZ (v1.25).**
7. **A Gyors Excel és a sablonok átdolgozása** — ma lapszám alapján párosít; a sablonjában nincs oszlopa az azonosító-típusnak és a típus saját mezőinek (pl. a Kártya Gyűjteménye), ezért Kártyát tartalmazó sablonú sorozatra ezen az úton nem vehető fel új Szám (ma nincs ilyen élő sorozat). Önálló kör. (Az új sorok már a `create_live_issue` függvényen mennek át.)
8. **Egy szerkesztési draft egy élő sorozathoz** — **KÉSZ (v1.21):** részleges egyedi index + atomi `start_edit_draft()`; a Karbantartás gombja és a Gyors szerkesztés → Excel is ezt hívja (a soft-delete-elt Számokat nem másolja).
9. **Döntés nélküli ötletek:** „tervezett” jelzés a még meg nem jelent számoknál; dátum szerinti rendezés segítségként (nem automatikus); eltolás ütközésnél felajánlott kényelmi lehetőségként.
10. **A lapszám-csendesítés élő ellenőrzése** — **KÉSZ:** a visszagörgetett szintetikus próba (`scripts/trial-renumber.js`) igazolta: a puszta lapszám-változás nem emel verziót, a `change_log` rögzíti, a számlálók a ROLLBACK után azonosak.
11. **„Jelöletlen” szűrő** — javaslat: ma a megjelent, de jelöletlen Szám egyik státusz-szűrőbe sem esik.
12. **Gyors szerkesztés → Excel: komponens nélküli Szám csendes kihagyása** — jelzés kellene.
13. **Az Excel-sablon a fő elemet nem viszi / nem módosítja** — új sornál tartalék szabály; a kijelölés a draft-szerkesztőben.
14. **Új sorozat sablonja: DB-szintű kikényszerítés későbbre** — a kliens kényszeríti ki, üres sablonnál az alapértelmezett lép be.
15. **A régi szerkesztő kompatibilitási ága** — KÉSZ (lásd 17.).
16. **Kézi törölt-jelölés kockázata** — kézi SQL előtt ellenőrizni, hogy nincs-e függő szerkesztési draft; a visszaállítás legyen kifejezett művelet.
17. **Kompatibilitási ág kivétele** — KÉSZ: élesítve (a `sync_template_with_components` függvény megmaradt).

**A 27–38. lépés köréből nyitva maradt (a javasolt sorrendben):**

18. **Jogosultság-szigorítás** — **KÉSZ (v1.27, 39–40. lépés, 2026-10-13):** a bejelentkezés nélküli hívó már csak 8 függvényt hívhat (`is_staff`, `is_active`, `my_role` és az 5 trigger-függvény — indok: specifikáció 13.14.9), a bejelentkezett 24-et, a 13 belső segédet csak más függvény. Az új függvények nem öröklik a `PUBLIC` / `anon` jogot. A „Teszt Kiadó” próbasor törölve. (v1.30 óta: a bejelentkezett 23-at, a belső segéd 14 — lásd a 26. pontot.)
19. **A közvetlen írások lezárása (C)** — **KÉSZ (v1.28, 42–43. lépés, 2026-10-13):** trigger helyett a táblajogok szűkítésével. Az élő törzsadat-táblákon (`series`, `issues`, `components`, `lists`, `change_log`, `global_counters`) az `anon` nem ír; az `authenticated` csak hat oszlopot módosíthat (`components.kep_url`, `components.upload_enabled`, `series.borito_url`, `series.borito_upload_enabled`, `series.lifecycle`, `lists.megjelenites`), és a Listákba szúrhat be; minden más függvényen át megy. A régi, újra nem töltött fül közvetlen beszúrása hibával megáll. Részletek: specifikáció 13.14.10.
20. **Verzióellenőrző sáv** — **KÉSZ (v1.29, 44–46. lépés, 2026-10-13):** ha a fül vagy a telepített app régi kódot futtat, sárga sáv szól a fejléc tetején („Új verzió érhető el”, Újratöltés gombbal), és a törzsadat-írások az újratöltésig nem mennek ki; a személyes mentés (jelölés, darabszám, jegyzet, ár) megy. A verzió az app fájljainak tartalom-ujjlenyomata (dokumentáció-commit nem ad új verziót). Részletek: specifikáció 13.14.11. Ami ebből nyitva maradt: az űrlapok tartalmának megőrzése az újratöltésen át.
21. **„Szám adatainak szerkesztése" gomb** a Szám sorából (egyenes út a munkaanyag-szerkesztőbe).
22. **A Karbantartás és a szerkesztés összevonása.**
23. **A javaslat-beküldő értesítése** (azonos az 1. ponttal).
24. **Adat-teendők a tulajdonosnál:** a Mancs Őrjárat sorozat-azonosítója; a Lego Star Wars #29 kártya Gyűjteménye; a Disney Hangos #1 eltérő ISBN-jének (978-88-334-2839-0) ellenőrzése; a Disney Hangos 82 figurájának neve (nem sürgős: a régi elemeknél csak figyelmeztetés).
25. **Apróságok jegyzetben:** a sorozat-azonosító hibájánál a szerkesztő mindkét kitöltött sort bekeretezi; a Gyors Excel sablon fejlécében néhány típus kisbetűs kulccsal áll („figura", „lego").
26. **A `seed_issue_seen_for_subscribers` lezárása** — **KÉSZ (v1.30, 48. lépés, 2026-10-14):** a holt kliens-kód (`js/changes.js`, `seedNewIssueSeen`) törölve, a függvény a belső segédek közé került (a bejelentkezett sem hívhatja közvetlenül; a `create_live_issue` és a `publish_draft_series` hívja).
27. **Törlés a Listák ablakban** — ma csak hozzáadás és átnevezés van; a törlés függvényen át jöjjön (a `lists` táblán a kliensnek már nincs törlési joga), a használatban lévő érték védelmével. A 29. ponttal együtt, egy kis lépésben.
28. **Jogosultsági higiénia a többi táblán** — **KÉSZ (v1.30, 47–48. lépés, 2026-10-14):** az `anon` egyik táblán sem kap jogot (az olvasást sem); a `TRUNCATE` / `REFERENCES` / `TRIGGER` / `MAINTAIN` a kliens-szerepköröktől mindenhol megvonva; a `members` és az `image_proposals` oszlopszintű kivétellel; a három nem használt tábla a bejelentkezettnek sem érhető el; a `member_seen` és a `member_series` közvetlenül nem törölhető; az új táblák és szekvenciák alapértelmezett joga zárva. Új, csak olvasó ellenőrző: `scripts/audit-jogok.js` (új tábla migrációja után futtatandó). Nem módosítható: a `supabase_admin` alapértelmezett jogai (a platform saját objektumaira). Részletek: specifikáció 13.14.12.
29. **A saját képjavaslat törlésének szabálya** (a 47. lépés felmérésének lelete) — az `image_proposals` táblán nincs törlési szabály, ezért ha a kép feltöltése a javaslat beszúrása után elakad, a kliens takarító törlése 0 sort töröl, és a „függő” javaslat bent ragad. Javítás: szabály vagy függvény; a 27. ponttal együtt, egy kis lépésben.

---

## 7. OM Curator platform — elvi döntések (nincs építve)

Változatlan a korábbi összefoglalóhoz képest — lásd a `laprol-lapra-specifikacio.md` 2. fejezetét: "karmester, nem tulajdonos" elv, három feladat (térkép/kapcsolat-tár/fogalomtár), "Modulok közti kapcsolat" három elve (általános azonosító, tágabb/szűkebb címke-modell, kezdeményez→jóváhagy→befogad).

**Kockáról Kockára** (2. modul): név eldőlt, BrickLink-irány (kézi kód, API később) rögzítve `kockarol-kockara-specifikacio.md` v0.1-ben. Adatmodell még nincs kidolgozva.

---

## 8. Munkastílus / amit tudni érdemes rólam (a tulajdonosról)

- Kezdő fejlesztésben, de már magabiztosan kezelem: VS Code, Git, GitHub, Vercel, Supabase SQL Editor, és a **Claude Code**-ot is.
- **Előbb megbeszélés/ötletelés, utána kód** — hibákat/kéréseket összegyűjtve, egyben viszem tovább, nem egyesével.
- A specifikációt élő dokumentumként kezeljük, verziószámmal (jelenleg v1.30).
- **Token-tudatos vagyok** — tömör válaszokat kérek, kevesebb ismétlést/fejezetcímet, amikor a kérdés nem indokol hosszú, strukturált választ.
- **Magyarul kérem a kérdéseket/válaszokat** a Claude Code-munkameneteken belül (explicit kérés).
- Git-fegyelem: a Code csak az én kifejezett "mehet a commit és push" jóváhagyásom UTÁN commitol/pushol, minden tesztelt lépés után külön commit-ban, világos, a hibajavítási pont sorszámára hivatkozó üzenettel.
- **Állandó szabály (v1.15 óta): minden láthatóan/érezhetően megjelenő, felhasználó által észlelhető változtatáshoz kötelező egy egyszerű nyelvű bejegyzés a 🔔 "Újdonságok" changelogba** (`js/changelog-content.js`) — nem csak a specifikáció naplójába, ami fejlesztői dokumentum. Ha egy hibajavítás csak a háttérben javít valamit (a user soha nem is látta a hibát), az NEM kell a changelogba.
- **A Claude Code-dal külön munkamenetben dolgozom** — a Home-felület (ez itt) és a Code egymástól független kontextussal bír; a köztük lévő hidat ez a dokumentum és a specifikáció adja.
- **Állandó szabály (a 2026-10-10-i körtől):** élő adaton DB-érintő tesztet — visszagörgetettet is — a Code csak az én előzetes jóváhagyásommal futtat; a migrációknál a teljes SQL megmutatása → jóváhagyás → backup → tranzakció sorrend kötelező.
- **Állandó szabály:** azonosítást (élő ↔ draft párosítás) sosem lapszám vagy név alapján végzünk; a lapszám sorrend-szám.
- Fontos nekem a **konzisztencia** és a **"keep it simple"** elv.

---

## 9. Javasolt következő lépések

**A) A 6. fejezet nyitott pontjai** — a 27–48. lépés köréből a 18. (jogosultság-szigorítás), a 19. (a közvetlen írások lezárása), a 20. (verzióellenőrző sáv), a 26. (holt kliens-kód) és a 28. (jogosultsági higiénia) kész; a következő a 27. és a 29. együtt (Listák törlés, a saját képjavaslat törlésének szabálya), utána a 21–22. (szerkesztés gomb, összevonás) és a 7. (Excel átdolgozása).

**B) Kockáról Kockára adatmodell kidolgozása** — ötletelős módban, ahogy a Lapról Laprát is felépítettük.

**C) OM Curator platform specifikálása** — most, hogy két modul körvonalazódik.

---

*Ha új beszélgetést nyitsz: told fel ezt a fájlt + a legfrissebb `laprol-lapra-specifikacio.md`-t (kérd el a pontos, friss verziót akár a Code-tól, akár töltsd le a repóból), és írd meg, melyik iránnyal folytatnád.*
