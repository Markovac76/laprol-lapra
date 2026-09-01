# Collector app — állapot-összefoglaló / átadási dokumentum (v7)

**Frissítve:** 2026. augusztus 31. · **Cél:** ha ez a beszélgetés lezárul és újat nyitsz a Claude projektben, ez a dokumentum adja vissza a kontextust gyorsan.

> Told fel ezt a fájlt a Claude projektbe (cseréld le a régi verziót). Új beszélgetés elején hivatkozz rá: "olvasd el az állapot-összefoglalót, onnan tudod, hol tartunk."

---

## 1. A nagy kép

**OM Curator** platform (még nincs építve) + modulok. **Első modul: Lapról Lapra** — éles, működő, több körben tesztelt és javított, legutóbb a komponens-szintű "Megnevezés" + több azonos típusú komponens funkció zárva (v1.9). **Második modul (vázlat): Kockáról Kockára** (Lego-gyűjtemény) — csak v0.1 ötletelés, adatmodell nincs kidolgozva.

---

## 2. Lapról Lapra — ÉLES állapot

### Rendszer
- **URL:** `laprol-lapra.vercel.app` (PWA, telepíthető)
- **GitHub:** `github.com/Markovac76/laprol-lapra` (privát)
- **Supabase:** „Laprol Lapra", Frankfurt, Free
- **Tulajdonos UID:** `25cb3724-02d4-4002-98b0-c93f74ef4e42` (g.marcell.kovacs@gmail.com)
- **Specifikáció:** jelenleg **v1.17** (a projekt-mappában, `laprol-lapra-specifikacio.md`) — ⚠️ a `.pdf` ennél elavultabb lehet, ellenőrizd/generáltasd újra, ha kell.
- **README.md** (v1.8): projekt-belépő dokumentum fejlesztőnek/új munkamenetnek — tech stack, mappaszerkezet, helyi futtatás, deploy, és a "Migrációk"/"Inaktivitás elleni védelem" munkamódszer-szabályok részletesen (ott az elsődleges hely erre, nem itt vagy a specifikációban).

### Fájlszerkezet (natív ES modulok, build-eszköz nélkül)
```
laprol-lapra/
├── index.html          ← csak markup + script betöltés
├── styles.css
├── README.md             ← ÚJ (v1.8): projekt-belépő dokumentum
├── config.js            ← NINCS git-ben, Vercel generálja env változóból
├── config.example.js
├── db.local.js            ← ÚJ (v1.8): Postgres connection string a migrációkhoz — NINCS git-ben
├── db.local.example.js     ← ÚJ (v1.8): minta db.local.js-hez
├── db-backups/               ← ÚJ (v1.8): migráció előtti JSON-pillanatképek — NINCS git-ben
├── scripts/                   ← ÚJ (v1.8): migrációs eszközök, saját package.json + node_modules (utóbbi NINCS git-ben)
│   ├── package.json, package-lock.json
│   ├── backup-db.js
│   └── run-migration.js
├── vercel.json
├── manifest.json + icons/
└── js/
    ├── supabase.js, state.js, modal.js, auth.js, permissions.js
    ├── data.js, render.js, personal.js
    ├── admin-forms.js, admin-users.js
    ├── excel.js, main.js
    ├── my-series.js, series-proposal.js       ← sorozat-választás/javaslás
    ├── karbantartas.js, draft-items.js         ← életciklus, draft-szerkesztés
    ├── changes.js                              ← verziókövetés/felkiáltójel
    ├── component-images.js, image-resize.js    ← képfeltöltés/-javaslat
    ├── my-data.js                               ← „Saját adatlap", leváltotta a price-edit.js-t
    ├── draft-excel.js                           ← sablon-alapú tömeges tétel-feltöltés draftokhoz
    └── help.js, help-content.js                 ← beépített súgó
```
`price-edit.js` **megszűnt** — a `my-data.js` teljesen leváltotta. Ha bármit módosítasz az appon (`index.html`/`js/`/`styles.css`), ebben a modul-szerkezetben kell — nem egyetlen nagy fájlban. A `scripts/` mappa ettől külön áll: helyi fejlesztői eszköz, sosem megy a Vercel build-be.

### Munkafolyamat
1. Home-felületen (itt) átbeszéljük/kidolgozzuk a döntéseket, vagy egyben egy instrukció-fájlt (`claude-code-N-lepes-....md`) állítunk össze.
2. Ezt bemásolod a Claude Code-nak, ő megépíti, kérdez ha kell, majd — csak a te kifejezett "mehet a commit és push" jóváhagyásod után — commit+push.
3. Te éles teszteléssel (bejelentkezve!) ellenőrződ — a Code anonim/publikus adatot lát csak, a személyes/védett adatot NEKED kell tesztelned.
4. Ha minden jó, a Code frissíti a specifikációt is, és ezt az állapot-összefoglalót.

**SQL-migrációk módja MEGVÁLTOZOTT (lásd lent):** eddig a Code csak írta a `.sql` fájlt, TE futtattad a Supabase SQL Editorban. Mostantól a Code közvetlen Postgres-kapcsolattal MAGA futtatja le — a jóváhagyási igény (a teljes SQL megmutatása + explicit "mehet" várása) VÁLTOZATLANUL kötelező, csak a végrehajtás módja más. Részletek: `README.md` "Migrációk" szakasza.

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
- **global_counters** — a sorozat-kód-számláló globálissá vált (a régi, userenkénti `counters` tábla holtan megmaradt).
- Storage: `component-images` bucket (publikus, közös — nem felhasználónkénti).

### RLS-modell összefoglalva
`series/issues/components/lists` írása (insert/update): `is_staff() AND is_active()`; a `series` **törlése** RLS-szinten senkinek sincs engedélyezve — kizárólag owner-ellenőrzött SQL-függvényeken át (13.7). Olvasása: mindenki. `member_status`/`member_issue_data`/`member_series`/`member_seen`: mindenki csak a sajátját. `change_log`/`image_proposals`: olvasás mindenkinek, írás staffnak. `draft_series` SELECT **staff-only**, INSERT bárki aktív fióknak `pool_type='new'`-ra; `draft_issues`/`draft_components` **teljesen staff-only** — a javaslat-beküldő saját, még fel nem vett javaslatához külön SECURITY DEFINER RPC-n (`propose_bulk_issues`) ír, nem közvetlenül. A legtöbb összetettebb művelet (publikálás, force-törlés, seed, tömeges javaslat-feltöltés) SECURITY DEFINER SQL-függvényen át fut, egy tranzakcióban.

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

**Sorozat-szintű borítókép (v1.17):** az 1-es szám előtti ingyenes bemutató-/reklámfüzethez egy önálló, vizuális/referencia mező a sorozaton — kicsi, álló formátumú miniatűr a Hero-doboz fejlécében, a kiadó/cím mellett. Sehol nem számít bele darabszám/százalék-számításba. A workflow a MEGLÉVŐ komponens-kép mechanizmus (feltöltés/csere, user-javaslat, admin jóváhagyás/elutasítás, törlés) általánosítása — az `image_proposals` tábla `entity_type` megkülönböztetéssel bővült, a `js/component-images.js` függvényei type-paraméterrel egységesek mindkét entitásra, nincs párhuzamos kód. SQL: `laprol-lapra-sorozat-borito.sql`.

**Valódi Kategória (témakör) mező + élénkebb színek (v1.16):** finomítás a v1.15-ös első próbálkozáson, élesben kapott visszajelzés alapján ("nagyon hasonló színek", "jobb lenne élénkebb"). Önálló, listatár-alapú `kategoria` mező a sorozatokon (Kiadó mintájára — bővíthető ☰ Listákon, választható az Új sorozat/Karbantartás formon) — a fülsáv-választó TÉNYLEGESEN csoportosítva mutatja a sorozatokat témakör szerint (nem csak a szín családjából "visszafejtve"). Modellek → Kék, Mese → **Vörös** (a Magenta helyett — az eleve élénk, meglévő Vörös családot kapta), Lego → Zöld (8 árnyalat, 6 tartalék a tervezett Spider-Man/Batman/Jurassic Park/Ninjago sorozatoknak). A Kék/Zöld családok szaturációja jelentősen megemelve, a Zöld hue-ja teal-ről valódi zöldre tolva. SQL: `laprol-lapra-kategoria-mezo.sql`. Súgó + changelog frissítve.

**Első próbálkozás — Sorozat-színek tematizálása + Változásnapló bevezetése (v1.15, felülírva v1.16-ban):** Modellek → Kék, Mese → Magenta, Lego → Zöld színcsalád. **Új, állandó rendszer:** 🔔 "Újdonságok" changelog (`js/changelog-content.js`/`changelog.js`) — mostantól minden láthatóan megjelenő változtatáshoz kötelező egy egyszerű nyelvű bejegyzés.

**SÜRGŐS hibajavítás: publikálás ütközött soft-delete-elt/élő lapszámmal (v1.14):** az `issues_series_id_lapszam_key` sima `UNIQUE(series_id, lapszam)` volt, a soft-delete-et figyelmen kívül hagyva — egy törölt Szám lapszáma örökre foglalt maradt. Konkrét eset: a "Volkswagen modellautógyűjtemény" draftjában 20 db, hibás AI-adatot javító tétel (#4-19, #27, #30, #59, #61) élő pár nélkül maradt (a "Szám törlése a draftból" gomb csak a draft-tételt törli, az élő Számot nem) és vadonatúj beszúrásként ütközött a még élő, régi sorral. Javítás: **részleges unique index** (`WHERE NOT is_deleted`), + a konkrét draft 20 tételének visszakötése az élő párjához (adatvesztés nélkül). SQL: `laprol-lapra-lapszam-reszleges-unique.sql`.

**Kép törlésének lehetősége (v1.13):** staff (admin/owner) "🗑 Kép törlése" gombbal eltávolíthatja az élő komponens-képet (visszaáll "Nincs kép" állapotra), azonnali megerősítéssel, türelmi idő nélkül — a Storage-fájl is törlődik. Nincs SQL-változás, a meglévő jogosultság/Storage-policy már fedte.

**Komponens-kép levágás nélküli megjelenítése (v1.12):** a hibajavítási kör 15. pontja ("nagyobb kép-placeholder") kiegészítve — magas, álló formátumú magazin-borítóknál (pl. Forma-1 #28, II. VH Repülők #35) a `cover`-vágás levágta a cím/kiadói logó sávot; a nagyobb doboz önmagában nem volt elég. Váltás `object-fit: contain`-re mindenhol (panel + képjavaslat-előnézet); Magazin/Könyv típusnál a doboz 150×210px-re (kb. A4-arány) állítva, a többi típusnál (Modell, Figura, Lego, Egyéb) változatlan.

**Teljeskörű 1000-soros lapozási átvizsgálás (v1.11):** a fenti hiba gyökere (Supabase/PostgREST alapból max. 1000 sort ad vissza `.select()`-re, `range()` nélkül, hibaüzenet nélkül) elvben BÁRMELYIK lapozatlan lekérdezést érintheti — átnéztük a teljes kódbázist. A közös `fetchAllRows()` segéd (`js/supabase.js`) mostantól ott is lapoz, ahol eddig nem: `change_log`/`member_seen` (`js/changes.js`), `components` egy nagy sorozat/draft összes tételére (`js/karbantartas.js`, `js/my-series.js`, `js/draft-items.js` — a több-komponens funkció óta nagyobb lehet), és két, MINDEN userre vonatkozó app-szintű lekérdezés (`member_series`, `members` — `js/karbantartas.js`, `js/admin-users.js`).

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

---

## 7. OM Curator platform — elvi döntések (nincs építve)

Változatlan a korábbi összefoglalóhoz képest — lásd a `laprol-lapra-specifikacio.md` 2. fejezetét: "karmester, nem tulajdonos" elv, három feladat (térkép/kapcsolat-tár/fogalomtár), "Modulok közti kapcsolat" három elve (általános azonosító, tágabb/szűkebb címke-modell, kezdeményez→jóváhagy→befogad).

**Kockáról Kockára** (2. modul): név eldőlt, BrickLink-irány (kézi kód, API később) rögzítve `kockarol-kockara-specifikacio.md` v0.1-ben. Adatmodell még nincs kidolgozva.

---

## 8. Munkastílus / amit tudni érdemes rólam (a tulajdonosról)

- Kezdő fejlesztésben, de már magabiztosan kezelem: VS Code, Git, GitHub, Vercel, Supabase SQL Editor, és a **Claude Code**-ot is.
- **Előbb megbeszélés/ötletelés, utána kód** — hibákat/kéréseket összegyűjtve, egyben viszem tovább, nem egyesével.
- A specifikációt élő dokumentumként kezeljük, verziószámmal (jelenleg v1.15).
- **Token-tudatos vagyok** — tömör válaszokat kérek, kevesebb ismétlést/fejezetcímet, amikor a kérdés nem indokol hosszú, strukturált választ.
- **Magyarul kérem a kérdéseket/válaszokat** a Claude Code-munkameneteken belül (explicit kérés).
- Git-fegyelem: a Code csak az én kifejezett "mehet a commit és push" jóváhagyásom UTÁN commitol/pushol, minden tesztelt lépés után külön commit-ban, világos, a hibajavítási pont sorszámára hivatkozó üzenettel.
- **Állandó szabály (v1.15 óta): minden láthatóan/érezhetően megjelenő, felhasználó által észlelhető változtatáshoz kötelező egy egyszerű nyelvű bejegyzés a 🔔 "Újdonságok" changelogba** (`js/changelog-content.js`) — nem csak a specifikáció naplójába, ami fejlesztői dokumentum. Ha egy hibajavítás csak a háttérben javít valamit (a user soha nem is látta a hibát), az NEM kell a changelogba.
- **A Claude Code-dal külön munkamenetben dolgozom** — a Home-felület (ez itt) és a Code egymástól független kontextussal bír; a köztük lévő hidat ez a dokumentum és a specifikáció adja.
- Fontos nekem a **konzisztencia** és a **"keep it simple"** elv.

---

## 9. Javasolt következő lépések

**A) A 6. fejezet nyitott pontjai** — sorrend rád van bízva; a sorozat-beküldő értesítése (1. pont) a legkonkrétabb, ha jön egy következő fejlesztési kör.

**B) Kockáról Kockára adatmodell kidolgozása** — ötletelős módban, ahogy a Lapról Laprát is felépítettük.

**C) OM Curator platform specifikálása** — most, hogy két modul körvonalazódik.

---

*Ha új beszélgetést nyitsz: told fel ezt a fájlt + a legfrissebb `laprol-lapra-specifikacio.md`-t (kérd el a pontos, friss verziót akár a Code-tól, akár töltsd le a repóból), és írd meg, melyik iránnyal folytatnád.*
