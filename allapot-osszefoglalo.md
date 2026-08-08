# Collector app — állapot-összefoglaló / átadási dokumentum (v3)

**Frissítve:** 2026. augusztus 8. · **Cél:** ha ez a beszélgetés lezárul és újat nyitsz a Claude projektben, ez a dokumentum adja vissza a kontextust gyorsan.

> Told fel ezt a fájlt a Claude projektbe (cseréld le a régi verziót). Új beszélgetés elején hivatkozz rá: "olvasd el az állapot-összefoglalót, onnan tudod, hol tartunk."

---

## 1. A nagy kép

**OM Curator** platform (még nincs építve) + modulok. **Első modul: Lapról Lapra** — éles, működő, több körben tesztelt és javított, jelenleg egy 15-pontos hibajavítási kör frissen lezárva. **Második modul (vázlat): Kockáról Kockára** (Lego-gyűjtemény) — csak v0.1 ötletelés, adatmodell nincs kidolgozva.

---

## 2. Lapról Lapra — ÉLES állapot

### Rendszer
- **URL:** `laprol-lapra.vercel.app` (PWA, telepíthető)
- **GitHub:** `github.com/Markovac76/laprol-lapra` (privát)
- **Supabase:** „Laprol Lapra", Frankfurt, Free
- **Tulajdonos UID:** `25cb3724-02d4-4002-98b0-c93f74ef4e42` (g.marcell.kovacs@gmail.com)
- **Specifikáció:** jelenleg **v1.7** (a projekt-mappában, `laprol-lapra-specifikacio.md`) — ⚠️ a `.pdf` ennél elavultabb lehet, ellenőrizd/generáltasd újra, ha kell.

### Fájlszerkezet (natív ES modulok, build-eszköz nélkül)
```
laprol-lapra/
├── index.html          ← csak markup + script betöltés
├── styles.css
├── config.js            ← NINCS git-ben, Vercel generálja env változóból
├── config.example.js
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
    ├── my-data.js                               ← ÚJ (v1.7): „Saját adatlap", leváltotta a price-edit.js-t
    ├── draft-excel.js                           ← ÚJ (v1.7): sablon-alapú tömeges tétel-feltöltés draftokhoz
    └── help.js, help-content.js                 ← ÚJ (v1.7): beépített súgó
```
`price-edit.js` **megszűnt** — a `my-data.js` teljesen leváltotta. Ha bármit módosítasz, ebben a modul-szerkezetben kell — nem egyetlen nagy fájlban.

### Munkafolyamat
1. Home-felületen (itt) átbeszéljük/kidolgozzuk a döntéseket, vagy egyben egy instrukció-fájlt (`claude-code-N-lepes-....md`) állítunk össze.
2. Ezt bemásolod a Claude Code-nak, ő megépíti, kérdez ha kell, majd — csak a te kifejezett "mehet a commit és push" jóváhagyásod után — commit+push.
3. Te éles teszteléssel (bejelentkezve!) ellenőrződ — a Code anonim/publikus adatot lát csak, a személyes/védett adatot NEKED kell tesztelned.
4. Ha minden jó, a Code frissíti a specifikációt is, és ezt az állapot-összefoglalót.

**SQL-migrációk módja is így megy:** a Code ír egy `.sql` fájlt a mappába, TE futtatod a Supabase SQL Editorban, majd jelented az eredményt (a Code sosem fut SQL-t közvetlenül a te Supabase-projekted ellen).

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
- A specifikációt élő dokumentumként kezeljük, verziószámmal (jelenleg v1.7).
- **Token-tudatos vagyok** — tömör válaszokat kérek, kevesebb ismétlést/fejezetcímet, amikor a kérdés nem indokol hosszú, strukturált választ.
- **Magyarul kérem a kérdéseket/válaszokat** a Claude Code-munkameneteken belül (explicit kérés).
- Git-fegyelem: a Code csak az én kifejezett "mehet a commit és push" jóváhagyásom UTÁN commitol/pushol, minden tesztelt lépés után külön commit-ban, világos, a hibajavítási pont sorszámára hivatkozó üzenettel.
- **A Claude Code-dal külön munkamenetben dolgozom** — a Home-felület (ez itt) és a Code egymástól független kontextussal bír; a köztük lévő hidat ez a dokumentum és a specifikáció adja.
- Fontos nekem a **konzisztencia** és a **"keep it simple"** elv.

---

## 9. Javasolt következő lépések

**A) A 6. fejezet nyitott pontjai** — sorrend rád van bízva; a sorozat-beküldő értesítése (1. pont) a legkonkrétabb, ha jön egy következő fejlesztési kör.

**B) Kockáról Kockára adatmodell kidolgozása** — ötletelős módban, ahogy a Lapról Laprát is felépítettük.

**C) OM Curator platform specifikálása** — most, hogy két modul körvonalazódik.

---

*Ha új beszélgetést nyitsz: told fel ezt a fájlt + a legfrissebb `laprol-lapra-specifikacio.md`-t (kérd el a pontos, friss verziót akár a Code-tól, akár töltsd le a repóból), és írd meg, melyik iránnyal folytatnád.*
