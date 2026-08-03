# Collector app — állapot-összefoglaló / átadási dokumentum (v2)

**Frissítve:** 2026. augusztus 3. · **Cél:** ha ez a beszélgetés lezárul és újat nyitsz a Claude projektben, ez a dokumentum adja vissza a kontextust gyorsan.

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
- **Specifikáció:** jelenleg **v1.5** (a projekt-mappában, `laprol-lapra-specifikacio.md`) — ⚠️ a `.pdf` ennél elavultabb lehet, ellenőrizd/generáltasd újra, ha kell.

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
    ├── supabase.js, state.js, auth.js, permissions.js
    ├── data.js, render.js, personal.js
    ├── admin-forms.js, admin-users.js
    ├── price-edit.js    ← új: mindenkinek elérhető ár-szerkesztő
    ├── excel.js, main.js
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

## 3. Adatmodell — jelentős bővülés a legutóbbi körben

### Táblák (a korábbi `series/issues/components/lists/counters` mellett ÚJAK):

**members** — a háromszintű jogosultság: `user_id`, `role` ('user'/'admin'/'owner'), `status` ('active'/'disabled'), `display_name`. SECURITY DEFINER függvények (`my_role()`, `is_staff()`, `is_active()`) kerülik el az RLS-rekurziót. A tulajdonos sora triggerrel védett (senki, még ő maga sem tudja lefokozni/letiltani magát).

**member_status** — a régi, komponens-szintű személyes állapot (megvan/hiányzik/nem kell + darabszám + jegyzet), user_id-vel elkülönítve. Ez tette lehetővé a **megosztott katalógust**: a sorozatokat/tételeket a staff viszi fel, MINDENKI látja, de a jelölés személyes.

**member_issue_data** — ÚJ, szám-szintű személyes adat: `fizetett_ar`, `beszerzesi_mennyiseg`, `beszerzes_datuma`, `forras`. Az `issues.fedelar` átnevezve `eredeti_ar`-ra (törzsadat, csak staff szerkeszti). A régi `issues.beszerzesi_ar` stb. oszlopok holtan megmaradtak (nem törölve, biztonsági okból).

### RLS-modell összefoglalva
`series/issues/components/lists` írása: `is_staff() AND is_active()`. Olvasása: mindenki (megosztott katalógus elve). `member_status`/`member_issue_data`: mindenki csak a sajátját (upsert minta).

---

## 4. Elkészült funkciók (a korábbi listát kiegészítve)

**Alapfunkciók** (mint eddig): komponens-modell, hierarchia-szín, körbeforgó jelölés, tapadó fejléc, lenyíló képsáv (kép nélkül még), rejthető belekerülési költség, adaptív statisztika, összecsukható fülsáv, színcsaládos paletta, Excel-import biztonsággal, PWA.

**ÚJ ebben a körben:**
- **Háromszintű jogosultság** (user/admin/owner) + felhasználó-kezelő felület (önálló 👥 gomb a fejlécben, staffnak) — letiltás/visszaengedés (userre), admin-jog ki/beadás (csak owner).
- **Letiltott user azonnal kizárva** bejelentkezéskor ("A fiókod fel van függesztve").
- **Ár-modell szétválasztva:** Eredeti ár (törzsadat) vs. Fizetett ár (személyes, `member_issue_data`).
- **Automatikus fizetett ár kitöltés:** első "megvan" jelöléskor = eredeti ár; csak első alkalommal tölt; ha minden jelölés visszavonásra kerül, visszaáll "nem ismert"-re.
- **"Nem ismert" ár kezelése** végig a felületen (NULL → felirat, nem üres/hibás).
- **Mindenkinek elérhető ár-szerkesztő** a lenyíló panelben (fizetett ár, mennyiség, dátum, forrás) — plain user is használja, nem csak staff.
- **Hero összeg-számítás javítva:** a domináns komponens szerint számol (nem csak magazin/könyv), "+nem ismert" badge, ha van kihagyott tétel.
- **Kétnézetes hero:** "Eredeti ár alapján" / "Fizetett ár alapján" választó.
- **UX-javítások:** nagyobb fejléc-ikonok (46×44px), gate accent-szín reset kilépéskor, kétsoros ár-megjelenítés telefonon, darabszám +/− áthelyezve a fő listából a lenyíló panelbe.

---

## 5. NYITOTT/nem megépített dolgok — Lapról Lapra

Prioritási javaslat (a Code ajánlása alapján, sorrend nincs kőbe vésve):

1. **Képkezelés** — a LEGNAGYOBB nyitott munka. Terv kész a specifikációban (Supabase Storage, privát/megosztott katalógus miatt most feltehetően KÖZÖS tárolás, nem felhasználónkénti — ezt érdemes újra átgondolni a megosztott katalógus fényében, mielőtt építeni kezditek).
2. **Excel komponens-státusz átkötése** a személyes `member_status`-ra (jelenleg a holt `components.status`-t használja az import — ELLENŐRIZENDŐ, hogy ez tényleg így van-e még, vagy időközben javításra került).
3. **Felhasználói sorozat-választás** (13.3 a specifikációban): user kiválaszthatja, mely staff-jóváhagyott sorozatokat karbantartja saját maga; max 5× törlés limit; tiszta újrafelvétel.
4. **Üzenetküldés az adminnak** (13.4): max 150 karakter, user → staff.
5. **Valódi fióktörlés** (Edge Function kell, service_role kulccsal — eddig csak letiltás épült meg).
6. **Felhasználói sablon-beküldés** új sorozat igényléséhez (user tölt ki sablont, staff jóváhagyja/javítja) — koncepció megvan, nincs építve.
7. **Címkerendszer** — platform-szintű, még nem szabványosítva.
8. **Hordozhatóság/export** — nincs kidolgozva.

---

## 6. OM Curator platform — elvi döntések (nincs építve)

Változatlan a korábbi összefoglalóhoz képest — lásd a `laprol-lapra-specifikacio.md` 2. fejezetét: "karmester, nem tulajdonos" elv, három feladat (térkép/kapcsolat-tár/fogalomtár), "Modulok közti kapcsolat" három elve (általános azonosító, tágabb/szűkebb címke-modell, kezdeményez→jóváhagy→befogad).

**Kockáról Kockára** (2. modul): név eldőlt, BrickLink-irány (kézi kód, API később) rögzítve `kockarol-kockara-specifikacio.md` v0.1-ben. Adatmodell még nincs kidolgozva.

---

## 7. Munkastílus / amit tudni érdemes rólam (a tulajdonosról)

- Kezdő fejlesztésben, de már magabiztosan kezelem: VS Code, Git, GitHub, Vercel, Supabase SQL Editor, és ÚJABBAN a **Claude Code**-ot is.
- **Előbb megbeszélés/ötletelés, utána kód** — ez különösen fontos maradt; hibákat/kéréseket összegyűjtve, egyben viszem tovább, nem egyesével.
- A specifikációt élő dokumentumként kezeljük, verziószámmal (jelenleg v1.5).
- **Token-tudatos vagyok** — kértem tömörebb válaszokat, kevesebb ismétlést/fejezetcímet, amikor a kérdés nem indokol hosszú, strukturált választ. Ha egy válasz nagy tokenhányadot emészt fel, szólok, és kérem az okok elemzését.
- **A Claude Code-dal külön munkamenetben dolgozom** — a Home-felület (ez itt) és a Code egymástól független kontextussal bír; a köztük lévő hidat ez a dokumentum és a specifikáció adja.
- Fontos nekem a **konzisztencia** és a **"keep it simple"** elv.

---

## 8. Javasolt következő lépések

**A) Képkezelés megépítése** — a legnagyobb elmaradt munka; FONTOS: a megosztott katalógus miatt a régi terv (felhasználónkénti privát mappa) újragondolandó — valószínűleg KÖZÖS, staff által feltöltött képek, mindenki látja (ugyanaz a minta, mint a sorozatok/tételek).

**B) A nyitott Lapról Lapra funkciók** (5. pont) valamelyike — sorrend rád van bízva.

**C) Kockáról Kockára adatmodell kidolgozása** — ötletelős módban, ahogy a Lapról Laprát is felépítettük.

**D) OM Curator platform specifikálása** — most, hogy két modul körvonalazódik.

---

*Ha új beszélgetést nyitsz: told fel ezt a fájlt + a legfrissebb `laprol-lapra-specifikacio.md`-t (kérd el a pontos, friss verziót akár a Code-tól, akár töltsd le a repóból), és írd meg, melyik iránnyal folytatnád.*
