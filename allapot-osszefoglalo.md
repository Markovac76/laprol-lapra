# Collector app — állapot-összefoglaló / átadási dokumentum

**Készült:** 2026. július 24. · **Cél:** ha ez a beszélgetés lezárul és újat nyitsz a Claude projektben, ez a dokumentum adja vissza a kontextust gyorsan, tokenhatékonyan.

> Ezt a fájlt told fel a Claude projektbe a többi mellé. Egy új beszélgetés elején hivatkozz rá: "olvasd el a kockarol-kockara / laprol-lapra állapot-összefoglalót, onnan tudod, hol tartunk."

---

## 1. A nagy kép

Egy **OM Curator** nevű személyes gyűjtemény-rendszerező **platform** épül, aminek modulok csatlakoznak hozzá. A platform maga még nincs megépítve — csak elvi szinten tervezett (lásd a Lapról Lapra spec 2. fejezetét).

**Első modul: Lapról Lapra** — partwork (számozott, gyűjthető füzetsorozat) követő. **Éles, működő állapotban van.**

**Második modul (tervezés alatt): Kockáról Kockára** — Lego-gyűjtemény nyilvántartó. Csak egy v0.1 vázlat készült, adatmodell még nincs kidolgozva.

---

## 2. Lapról Lapra — technikai állapot (ÉLES)

### Élő rendszer
- **URL:** `laprol-lapra.vercel.app` — telepíthető PWA-ként telefonon/tableten (saját ikonnal).
- **GitHub repo:** `github.com/Markovac76/laprol-lapra` (privát).
- **Supabase projekt:** „Laprol Lapra", Frankfurt régió, Free csomag.
- **Felhasználó UID:** `25cb3724-02d4-4002-98b0-c93f74ef4e42` (g.marcell.kovacs@gmail.com)

### Fájlszerkezet a projekt-mappában
```
laprol-lapra/
├── index.html          ← a teljes app (HTML+CSS+JS egy fájlban, ES module)
├── config.js            ← NINCS a git-ben (.gitignore); az anon kulcsot tartalmazza
├── config.example.js    ← minta a config.js-hez, git-ben van
├── vercel.json           ← buildCommand, ami env változóból generálja a config.js-t Vercelen
├── manifest.json         ← PWA manifest
├── icons/                ← 4 PNG (192/512, sima + maskable)
├── .gitignore
├── laprol-lapra-specifikacio.md / .pdf  ← a fő specifikáció (jelenleg v1.2)
└── (archív SQL-ek, amiket egyszer lefuttattunk a Supabase-ben — lásd lent)
```

### Munkafolyamat (FONTOS, ezt kövesd)
1. Letöltött/módosított fájlokat bemásolod a projekt-mappába, **felülírva** a régieket.
2. **A `config.js`-t SOHA nem küldöm/írom felül** — az egyszer lett létrehozva, benne az anon kulccsal, és érintetlen marad minden körben.
3. VS Code terminálban:
   ```
   git add .
   git commit -m "rövid leírás"
   git push
   ```
4. A Vercel automatikusan újra deployol a push után (~30-60 mp), a `vercel.json` buildCommand-je legenerálja a `config.js`-t a Vercel **Environment Variables**-ben tárolt `SUPABASE_ANON_KEY`-ből.
5. SQL-módosításokat **külön, a Supabase SQL Editorban** kell lefuttatni — ezek nem a git-push részei, hanem egyszeri, manuális lépések.

### Supabase séma (jelenlegi állapot)
Táblák: `series`, `issues`, `components`, `lists`, `counters` — mind RLS-sel védve (`auth.uid() = user_id`).

**series:** id, user_id, kiado (→lists.ertek), megnevezes, megjelenites (max 16 kar.), szin (hex), components (text[]), sort_order, kod_szam (int, soha vissza nem forgó számláló), created_at

**issues:** id, user_id, series_id, lapszam, cim, megjelenes (date), fedelar (int), beszerzesi_ar (int), beszerzes_datuma (date), forras (→lists.ertek), **mennyiseg** (int, default 1 — hány db-ot vettél)

**components:** id, user_id, issue_id, tipus (magazin/modell/konyv/egyeb), status (megvan/hianyzik/nemkell/null), azonosito, azonosito_tipus (→lists.ertek), ar, kep_url (még nem használt — képkezelés még nincs megépítve), jegyzet, cimkek (text[], még nem használt), kulso_ref (még nem használt), **db** (int, default 1 — élő készlet-számláló)

**lists:** id, user_id, tipus (kiado/komponens/azonosito/forras), ertek, megjelenites, sort_order — bővíthető a ☰ Listák felületen

**counters:** user_id, next_series_no — a sorozat kód-számláló állapota

### Elvégzett SQL-ek (időrendben, mind lefuttatva)
1. Alap táblák (series/issues/components) + RLS
2. Listatár (lists) + kezdő értékek + `issues.forras` mező
3. `components.azonosito_tipus` mező
4. Kód-számláló (`series.kod_szam` + `counters` tábla) + visszatöltés
5. `issues.mennyiseg` mező
6. `components.db` mező

---

## 3. Lapról Lapra — elkészült funkciók

- **Bejelentkezés** (e-mail+jelszó, tartós munkamenet — `persistSession`)
- **Komponens-modell**: egy szám (issue) egy vagy több komponensből áll (magazin/modell/könyv/egyéb), mindegyiknek saját státusza
- **Hierarchia-alapú lapszám-színezés**: a domináns komponens (nem-magazin, ha van ilyen) dönti el a szín; ha domináns=megvan→zöld, nemkell→szürke, hiány+magazin megvan→sárga, hiány+egyéb→piros, jelöletlen/jövőbeli→semleges
- **Körbeforgó jelölés**: jelöletlen→megvan→hiány→nemkell→megvan…, jelöletlenre nem tér vissza (csak szerkesztőben reset-elhető)
- **Komponensenkénti darabszám-számláló**: +/− gombok, 0-nál automatikusan „hiányzik", visszanövelve „megvan"
- **Tapadó fejléc** a listánál (oszlopnevek fent maradnak görgetéskor)
- **Lenyíló képsáv** komponensenként (UI kész, de **kép-feltöltés/tárolás még NINCS megépítve** — ez a legnagyobb nyitott munka)
- **Rejthető belekerülési költség** (gomb, sorozatváltáskor visszaáll rejtettre)
- **Adaptív statisztika**: van jövőbeli szám→"Következő megjelenés", nincs→"Beszerzendő lapszám" (lapszám-alapú számolás, nem komponens-alapú)
- **"Lezárt sorozat" címke**, ha nincs jövőbeli dátum
- **Összecsukható fülsáv**: csak az aktív sorozat füle nagy, "Sorozatok (n)" gomb nyitja a többit; nyitva a lista/szűrők/hero el vannak rejtve
- **Színcsaládos paletta**: 24 szín, 6 családban (Kék/Vörös/Lila/Zöld/Barna/Magenta), csoportosítva a választóban
- **Karbantartó mód** (🔧): tétel szerkesztése/törlése/új, sorozat szerkesztése/törlése/új (kiadó listából, komponens-választó, szín), ☰ Listák (bővíthető listák), Excel-sablon letöltés + feltöltés (csak asztali)
- **Excel-import biztonság**: feltöltés előtt megerősítő ablak (célsorozat + hatás előnézete), hibatűrő dátum-felismerés (magyar hónapnevek is), ezres tagolás kezelése az áraknál
- **PWA**: telepíthető telefonon/tableten, saját ikonnal

## 4. Lapról Lapra — NYITOTT/nem megépített dolgok

1. **Képkezelés** — ez a legnagyobb hátralévő munka. Terv (a specifikációban rögzítve): Supabase Storage, **privát** tároló, **felhasználónkénti mappa** (mappa neve = UID), automatikus átméretezés feltöltés előtt (max 1200px, JPEG), drag&drop asztalin / kamera telefonon, kép cseréje/törlése gombokkal. **Még semmi nincs megépítve belőle**, csak a `kep_url` oszlop létezik üresen.
2. **Címkerendszer** — a `cimkek` mező létezik, de a logika (hierarchia/szinonimák) nincs kidolgozva. Ez platform-szintű feladat lesz (lásd lent).
3. Kép nagyítása teljes képernyőn (kisebb, függő feature a képkezeléshez)
4. Kettőnél több nem-magazin komponens esetén a hierarchia pontosítása (jelenleg nincs ilyen eset)
5. Hordozhatóság/exportálás — nincs kidolgozva
6. Több felhasználós adattárolási modell — jelenleg egy közös Supabase projekt, RLS-sel elválasztva; nyitott kérdés, hogy ez maradjon-e így vagy legyen platform-vezérelt saját projekt később

---

## 5. OM Curator platform — elvi döntések (még nincs építve)

A platform **"karmester, nem tulajdonos"**: a modulok birtokolják a saját adatukat, a platform csak kapcsolatot teremt és egységesít.

**Három feladata:** térkép (mi hol érhető el), kapcsolat-tár (logikai láncok), fogalomtár/egységesítő (címke-kanonizálás, pl. "ferrari"/"Ferrari" ugyanaz).

**"Modulok közti kapcsolat" — három elv** (a Lego/BrickLink-példából jött):
1. **Azonosító mező tudatosan általános** — bármilyen külső rendszer kódja lehet (ISBN-től BrickLink-kódig), nem csak könyves azonosítók.
2. **Címkézés: "tágabb/szűkebb fogalom" (thesaurus) modell**, NEM szigorú fa, NEM lapos lista. Egy címke több tágabb fogalomhoz is tartozhat, tágabb fogalomra keresve lemegy a szűkebbekre is. *(Példa: platform-keresés "Star Wars — Új remény"-re több modulból hoz találatot.)* Ez a logika **kizárólag a platformon** él, a modulban a címke sima szabad szöveg marad.
3. **"Kezdeményez → jóváhagy → befogad" folyamat:**
   - Új kapcsolat: a modul csak **javasolja**, sosem automatikus.
   - Meglévő kapcsolat sérülése (drift, pl. egy Lego-darab eltörik): platform **értesít**, nem ír felül automatikusan semmit.
   - **A jóváhagyási állapot (a kapcsolat maga) kizárólag a platformon él, egyetlen példányban** — a modulok csak "ablakok" rá, nem másolatok. Akárhonnan (platform vagy bármelyik modul felülete) fogadod el, mindig ugyanazt az állapotot látod.
   - Fontos tisztázott pont: a platform **nem tart élő, folyamatos másolatot** a modulok adatából — csak amikor ténylegesen lekérdezed, akkor nyúl oda ("kinyúl és behúzza, majd elengedi"). A függőben lévő javaslatok viszont a platform saját, központi listájában élnek, modultól függetlenül elérhetően.

**Kockáról Kockára modul (2. modul, tervezés alatt):**
- Név eldőlt: **Kockáról Kockára**
- Irány: **kézzel kitölthető BrickLink-kód mezővel indul**, élő API-összekötés **later/később** (a BrickLink hivatalos API-ja OAuth 1.0, kézi aláírással — nem triviális, külön fejlesztési szakasz, valószínűleg proxy-réteggel, mint a NovelAI-nál volt)
- Alternatíva/kiegészítés később: Brickset API (készlet-szintű adatokra, egyszerűbb hitelesítéssel)
- Van egy `kockarol-kockara-specifikacio.md` v0.1 fájl a projektben — csak vázlat, 5 nyitott kérdéssel (mit tart nyilván pontosan, adatmodell váza, címkézés viszonya a BrickLink kategóriákhoz, önálló felvitel vs. csak Lapról Lapra-forrásból, mit jelent "megvan" egy készletnél)

---

## 6. "Később megbeszélendő" — már mind eldőlt és megépült ebben a beszélgetésben
(csak a rendszerezés kedvéért, hogy tudd, ezek nem nyitottak már)
- 12 fölötti sorozatszám kezelése → színcsaládos paletta + összecsukható fülsáv (MEGÉPÍTVE)
- Lapszám beszúrása résbe → lezárva, nem kell hozzá funkció (a lapszám eleve nem pozíció)
- Többespéldány kezelése → mennyiség (számon) + darabszám (komponensen) két külön mező (MEGÉPÍTVE)

---

## 7. Munkastílus / amit érdemes tudni rólam (a tulajdonosról)

- Kezdő vagyok fejlesztésben, VS Code + GitHub + Vercel + Supabase alapszinten megy már (végigcsináltuk lépésről lépésre).
- Szeretem, ha **előbb megbeszéljük/ötleteljük** a dolgokat, és csak utána kódolunk — "gyűjtsd össze a hibákat/kéréseket, majd egyszerre nézzük át" mintát használtunk sokszor, ez jól bevált.
- A specifikációt élő dokumentumként kezeljük, minden döntés bekerül, verziószámmal.
- Fontos nekem a **konzisztencia** és a **"keep it simple"** elv — ha egy funkció bonyolítana valamit, inkább kérdezzek rá és a projekt-elvekhez (platform-szint vs. modul-szint) igazítsam.
- Token-tudatos vagyok — kértem, hogy tömörebben válaszoljak, kevesebb ismétléssel/fejezetcímmel, amikor a kérdés nem indokol hosszú, strukturált választ.

---

## 8. Javasolt következő lépések (döntsd el, mivel folytatod)

**A) Lapról Lapra — képkezelés megépítése.** Ez a legnagyobb elmaradt Lapról Lapra munka; a terv már rögzítve van a specifikációban (5.3 fejezet), csak meg kell építeni: Storage bucket létrehozása (SQL/Supabase UI), feltöltés/átméretezés logika, a lenyíló panel bekötése.

**B) Kockáról Kockára — adatmodell kidolgozása.** A v0.1 vázlat 5 nyitott kérdéséből indulva, ötletelős módban (nem kódolva), hasonlóan ahhoz, ahogy a Lapról Laprát is felépítettük.

**C) OM Curator platform — magának a platformnak a specifikálása**, most hogy két modul körvonalazódik, talán érdemesebb lenne konkrétan nekiállni.

---

*Ha új beszélgetést nyitsz: told fel ezt a fájlt (ha még nincs a projektben), és írd meg, melyik iránnyal (A/B/C) szeretnéd folytatni.*
