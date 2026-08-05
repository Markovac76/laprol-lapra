# Collector app — állapot-összefoglaló / átadási dokumentum (v2)

**Frissítve:** 2026. augusztus 5. · **Cél:** ha ez a beszélgetés lezárul és újat nyitsz a Claude projektben, ez a dokumentum adja vissza a kontextust gyorsan.

> Told fel ezt a fájlt a Claude projektbe (cseréld le a régi verziót). Új beszélgetés elején hivatkozz rá: "olvasd el az állapot-összefoglalót, onnan tudod, hol tartunk."

---

## 1. A nagy kép

**OM Curator** platform (még nincs építve) + modulok. **Első modul: Lapról Lapra** — éles, működő, több körben tesztelt és javított. **Második modul (vázlat): Kockáról Kockára** (Lego-gyűjtemény) — csak v0.1 ötletelés, adatmodell nincs kidolgozva.

---

## 2. Lapról Lapra — ÉLES állapot

### Rendszer
- **URL:** `laprol-lapra.vercel.app` (PWA, telepíthető)
- **GitHub:** `github.com/Markovac76/laprol-lapra` (privát)
- **Supabase:** „Laprol Lapra", Frankfurt, Free
- **Tulajdonos UID:** `25cb3724-02d4-4002-98b0-c93f74ef4e42` (g.marcell.kovacs@gmail.com)
- **Specifikáció:** jelenleg **v1.6** (a projekt-mappában, `laprol-lapra-specifikacio.md`) — ⚠️ a `.pdf` ennél elavultabb lehet, ellenőrizd/generáltasd újra, ha kell.

### Fájlszerkezet (FONTOS VÁLTOZÁS: nem egyetlen fájl többé!)
A korábbi egyetlen `index.html` **szét lett bontva** natív ES modulokra (build-eszköz nélkül):
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
    ├── admin-forms.js, admin-users.js, price-edit.js
    ├── excel.js, main.js
    ├── my-series.js, series-proposal.js       ← v1.6: sorozat-választás/javaslás
    ├── karbantartas.js, draft-items.js         ← v1.6: életciklus, draft-szerkesztés
    ├── changes.js                              ← v1.6: verziókövetés/felkiáltójel
    └── component-images.js, image-resize.js    ← v1.6: képfeltöltés/-javaslat
```
Ha bármit módosítasz, ebben a modul-szerkezetben kell — nem egyetlen nagy fájlban.

### Munkafolyamat — VÁLTOZÁS: Claude Code-ban dolgozunk, nem itt
A közelmúltbeli fejlesztés (jogosultsági réteg, ár-modell, UX-javítások) **Claude Code-ban** történt, nem a Home/chat felületen. A minta:
1. Home-felületen (itt) átbeszéljük/kidolgozzuk a döntéseket.
2. Elkészül egy pontos, másolható instrukció-fájl (`claude-code-N-lepes-....md`).
3. Ezt bemásolod a Code-nak, ő megépíti, kérdez ha kell, majd commit+push.
4. Te éles teszteléssel (bejelentkezve!) ellenőrződ — a Code anonim/publikus adatot lát csak, a személyes/védett adatot NEKED kell tesztelned.
5. Ha minden jó, a Code frissíti a specifikációt is, és jelzi az állapot-összefoglaló frissítésének szükségességét.

**SQL-migrációk módja is így megy:** a Code ír egy `.sql` fájlt a mappába, TE futtatod a Supabase SQL Editorban (dry-run előbb, ha van benne), majd jelented az eredményt.

---

## 3. Adatmodell — jelentős bővülés, két körben

### Táblák (a korábbi `series/issues/components/lists/counters` mellett):

**members** — a háromszintű jogosultság: `user_id`, `role` ('user'/'admin'/'owner'), `status` ('active'/'disabled'), `display_name`. SECURITY DEFINER függvények (`my_role()`, `is_staff()`, `is_active()`) kerülik el az RLS-rekurziót. A tulajdonos sora triggerrel védett (senki, még ő maga sem tudja lefokozni/letiltani magát).

**member_status** — a régi, komponens-szintű személyes állapot (megvan/hiányzik/nem kell + darabszám + jegyzet), user_id-vel elkülönítve. Ez tette lehetővé a **megosztott katalógust**: a sorozatokat/tételeket a staff viszi fel, MINDENKI látja, de a jelölés személyes.

**member_issue_data** — szám-szintű személyes adat: `fizetett_ar`, `beszerzesi_mennyiseg`, `beszerzes_datuma`, `forras`. Az `issues.fedelar` átnevezve `eredeti_ar`-ra (törzsadat, csak staff szerkeszti). A régi `issues.beszerzesi_ar` stb. oszlopok holtan megmaradtak (nem törölve, biztonsági okból).

**ÚJ a sorozatkezelés-újratervezésből (v1.6, részletek a specifikáció 13. fejezetében):**
- **member_series** — a kiválasztás rétege (`user_id`, `series_id`, `is_selected`, `selected_at`, `deselected_at`); a fülsáv innentől ebből épül, nem az összes publikált sorozatból.
- **draft_series / draft_issues / draft_components** — a sorozat-életciklus pool-ja és a szerkesztés-munkaanyag (saját UUID-k, `source_*_id` mutat az élő párra).
- **change_log** — mezőnkénti változás-napló (series/issue/component közösen), **member_seen** — userenkénti „utoljára látott verzió".
- **image_proposals** — képjavaslat-workflow; **`components.upload_enabled`**, **`components/issues/series.version`**, **`series.lifecycle`** (`active`/`unpublished`) + `force_delete_*` mezők.
- **global_counters** — a sorozat-kód-számláló globálissá vált (a régi, userenkénti `counters` tábla holtan megmaradt).
- Storage: `component-images` bucket (publikus, közös — nem felhasználónkénti).

### RLS-modell összefoglalva
`series/issues/components/lists` írása (insert/update): `is_staff() AND is_active()`; a `series` **törlése** RLS-szinten senkinek sincs engedélyezve — kizárólag owner-ellenőrzött SQL-függvényeken át lehetséges (13.7). Olvasása: mindenki (megosztott katalógus elve). `member_status`/`member_issue_data`/`member_series`/`member_seen`: mindenki csak a sajátját (upsert minta). `change_log`/`image_proposals`: olvasás mindenkinek, írás staff-nak (a `image_proposals` insert usernek is, saját kiválasztott sorozatára). A legtöbb összetettebb művelet (publikálás, force-törlés, seed) SECURITY DEFINER SQL-függvényen át fut, egy tranzakcióban.

---

## 4. Elkészült funkciók (a korábbi listát kiegészítve)

**Alapfunkciók** (mint eddig): komponens-modell, hierarchia-szín, körbeforgó jelölés, tapadó fejléc, lenyíló képsáv, rejthető belekerülési költség, adaptív statisztika, összecsukható fülsáv, színcsaládos paletta, Excel-import biztonsággal, PWA.

**Jogosultság + ár-modell (v1.4–1.5 köre):**
- **Háromszintű jogosultság** (user/admin/owner) + felhasználó-kezelő felület (önálló 👥 gomb a fejlécben, staffnak) — letiltás/visszaengedés (userre), admin-jog ki/beadás (csak owner).
- **Letiltott user azonnal kizárva** bejelentkezéskor ("A fiókod fel van függesztve").
- **Ár-modell szétválasztva:** Eredeti ár (törzsadat) vs. Fizetett ár (személyes, `member_issue_data`), automatikus kitöltés/nullázás, "nem ismert" kezelés, mindenkinek elérhető ár-szerkesztő, kétnézetes hero.

**Sorozatkezelés-újratervezés — TELJES, mind az 5 tervezett lépés megvalósítva (v1.6, részletek: specifikáció 13. fejezet):**
- **Kiválasztás rétege:** 📚 Sorozataim gomb, `member_series` — a fülsáv csak a saját, bepipált sorozatokból épül; a korábban tervezett 5×-ös törlési limit utólag elvetve (korlátlan le-/újra-választás).
- **Sorozat-életciklus + Karbantartás:** 🗂️ staff-only menüpont, három füllel (Aktív / Munka-pool / Publikálatlan); a régi közvetlen "+ Új sorozat"/"✎ Sorozat" gombok megszűntek — minden törzsadat-módosítás a Beérkezett→Munkaanyag→Publikálásra váró→Aktív pool-on megy át.
- **Draft/verziókövetés/felkiáltójel:** `publish_draft_series()` egy tranzakcióban diffel/verzióz/frissít; `change_log` + `member_seen` alapú felkiáltójel négy helyen (fülsáv, hero, tétel, gyűjtött elfogadás). Mellékesen javítva: a sorozat-kód számláló globálissá vált.
- **Képkezelés a semmiből felépítve:** közös, publikus Storage bucket, kliens-oldali átméretezés, staff közvetlen feltöltés/csere, user-javaslat workflow (max 1 függő javaslat/komponens, admin helyben bírálja el, nincs értesítés).
- **Force-törlés:** owner-only, 0 aktív kiválasztásnál azonnali, egyébként 14 napos türelmi idővel (kötelező belépési nyugtázás, kétszintű DB-védőháló). Mellékesen lezárva egy talált RLS-rés (staff eddig közvetlenül törölhetett volna sorozatot).

---

## 5. NYITOTT/nem megépített dolgok — Lapról Lapra

A sorozat-választás, a képkezelés és a felhasználói sablon-beküldés (korábban itt szerepeltek) a sorozatkezelés-újratervezéssel **elkészültek** — lásd 4. pont. Ami még nyitott:

1. **Excel-import ÉS a draft/pool-folyamat összehangolása — DÖNTVE, DE MÉG NEM ÉPÍTVE.** A sorozatkezelés-újratervezés Q&A-körében megszületett a döntés (publikált sorozatra irányuló import MEGLÉVŐ tételek módosítására → automatikusan nyisson/töltsön egy szerkesztési draftot, szokásos publikálás-folyamattal; ÚJ tétel/komponens hozzáadása → közvetlen írás; munkaanyag-sorozatra irányuló import → változatlanul közvetlen), de a build-lépések (1–5) egyike sem érintette `js/excel.js`-t. **Éles állapot: az Excel-import MA IS közvetlenül ír az élő `issues`/`components` táblákba, minden esetben** — publikált sorozat meglévő tételeinek felülírása a draft/verzió/felkiáltójel-mechanizmus TELJES megkerülésével történik. Ez a legfontosabb elmaradt/eltérő pont a döntés és a valóság között — érdemes hamar sorra keríteni.
2. **Excel komponens-státusz átkötése** a személyes `member_status`-ra — ELLENŐRIZENDŐ, hogy ez tényleg így van-e még, vagy időközben javításra került.
3. Sima user saját-státusz Excel-importja meglévő sorozathoz (max 5 pont a régi listában) — külön kör, nincs építve.
4. **Üzenetküldés az adminnak** (13.4): max 150 karakter, user → staff.
5. **Valódi fióktörlés** (Edge Function kell, service_role kulccsal — eddig csak letiltás épült meg).
6. **Címkerendszer** — platform-szintű, még nem szabványosítva.
7. **Hordozhatóság/export** — nincs kidolgozva.

---

## 6. OM Curator platform — elvi döntések (nincs építve)

Változatlan a korábbi összefoglalóhoz képest — lásd a `laprol-lapra-specifikacio.md` 2. fejezetét: "karmester, nem tulajdonos" elv, három feladat (térkép/kapcsolat-tár/fogalomtár), "Modulok közti kapcsolat" három elve (általános azonosító, tágabb/szűkebb címke-modell, kezdeményez→jóváhagy→befogad).

**Kockáról Kockára** (2. modul): név eldőlt, BrickLink-irány (kézi kód, API később) rögzítve `kockarol-kockara-specifikacio.md` v0.1-ben. Adatmodell még nincs kidolgozva.

---

## 7. Munkastílus / amit tudni érdemes rólam (a tulajdonosról)

- Kezdő fejlesztésben, de már magabiztosan kezelem: VS Code, Git, GitHub, Vercel, Supabase SQL Editor, és ÚJABBAN a **Claude Code**-ot is.
- **Előbb megbeszélés/ötletelés, utána kód** — ez különösen fontos maradt; hibákat/kéréseket összegyűjtve, egyben viszem tovább, nem egyesével.
- A specifikációt élő dokumentumként kezeljük, verziószámmal (jelenleg v1.6).
- **Token-tudatos vagyok** — kértem tömörebb válaszokat, kevesebb ismétlést/fejezetcímet, amikor a kérdés nem indokol hosszú, strukturált választ. Ha egy válasz nagy tokenhányadot emészt fel, szólok, és kérem az okok elemzését.
- **A Claude Code-dal külön munkamenetben dolgozom** — a Home-felület (ez itt) és a Code egymástól független kontextussal bír; a köztük lévő hidat ez a dokumentum és a specifikáció adja.
- Fontos nekem a **konzisztencia** és a **"keep it simple"** elv.

---

## 8. Javasolt következő lépések

**A) Excel-import/pool-összehangolás megépítése** (5. fejezet 1. pontja) — ez a legsürgetőbb: a döntés megvan, de az élő kód még nem követi, és amíg ez így van, az Excel-import a draft/verzió/felkiáltójel-mechanizmus teljes megkerülésével írja felül a publikált sorozatok tételeit.

**B) A többi nyitott Lapról Lapra funkció** (5. fejezet) — sorrend rád van bízva.

**C) Kockáról Kockára adatmodell kidolgozása** — ötletelős módban, ahogy a Lapról Laprát is felépítettük.

**D) OM Curator platform specifikálása** — most, hogy két modul körvonalazódik.

---

*Ha új beszélgetést nyitsz: told fel ezt a fájlt + a legfrissebb `laprol-lapra-specifikacio.md`-t (kérd el a pontos, friss verziót akár a Code-tól, akár töltsd le a repóból), és írd meg, melyik iránnyal folytatnád.*
