# OM Curator (platform) & Lapról Lapra (első modul) — specifikáció

**Verzió:** 1.4 · **Állapot:** ÉLES, aktív fejlesztés (a Lapról Lapra modul v1) · **Projekt:** Collector app

> Élő dokumentum. Jelölések: **[DÖNTVE]** · **[NYITOTT]** · **[KÉSŐBB]**.
> Az építés csak a specifikáció lezárása után kezdődik. A platform (OM Curator) itt **szándékosan magas szinten**, csak elvi szinten szerepel — a részletei akkor jönnek, amikor lesz második modul.

---

## 0. Elnevezések

- **Platform:** **OM Curator** — a rendszert összefogó, „vékony" réteg (a *Ready Player One* Kurátorára / Ogden Morrow-ra utalva). **[DÖNTVE]**
- **Első modul:** **Lapról Lapra** — számozott, gyűjthető újság-/füzetsorozatok (partwork) követője. **[DÖNTVE]**

---

## 1. A „nagy kép"

Egy személyes **gyűjtemény-rendszerező platform** (OM Curator), amelyhez önálló **modulok** csatlakoznak. Minden modul egy-egy gyűjteménytípust kezel (az első a partwork-sorozatoké). A platform nem veszi át a modulok szerepét: a modulok maguk tartják nyilván és birtokolják az adatot, a platform pedig **összeköti és egységesíti** azokat.

**Használati filozófia:**
- **Otthon:** karbantartás (sorozatok/tételek felvitele, frissítés, státuszok).
- **Úton (bolhapiac, Vatera):** gyors döntés — egy pillantásból eldönthető, kell-e egy adott darab (megvan / hiányzik / nem kell).

---

## 2. Platform: OM Curator (elvi szint) **[nagyrészt KÉSŐBB]**

Az OM Curator egy **munkaterület**: innen érhetők el a modulok és itt épülnek a logikai láncok. **Nem tulajdonos, hanem karmester.**

**Három feladata:**
1. **Térkép** — honnan (melyik modulból) mit lehet elérni.
2. **Kapcsolat-tár** — a logikai láncok tárháza (mi mihez kötődik), a közös fogalmakon keresztül.
3. **Fogalomtár / egységesítő** — a címkék rendben tartása: egy fogalomnak egy kanonikus alakja van, a többi a szinonimája (pl. „ferrari"/„Ferrari" ugyanaz; „krumpli"/„burgonya" egy bejegyzés két neve).

**Működési elvek:**
- **A modul birtokolja az adatot.** A platform nem másolja át magához; ha képre/adatra van szüksége egy elemről, **kinyúl a modul felé és behúzza**, majd elengedi. **[DÖNTVE, elv]**
- **A platform kér, nem parancsol.** Egységesítést/címkézést **javasol**; a modul felé csak annyit ír vissza, amennyit a modul megenged — így a modul platform nélkül is sértetlen marad. **[DÖNTVE, elv]**
- **Okos javaslattétel** (a platform felajánl új címke-szempontokat, és elfogadás után végrehajtja): a **roadmap vége**, valószínűleg MI-réteggel. Az architektúra ne zárja ki. **[KÉSŐBB]**

**Modulok közti kapcsolat — három elv [NYITOTT, jegyzet a platform-specifikációhoz]**

Konkrét példa, ami idevezetett: egy Lego-magazin számhoz tartozó figura (saját, külső — pl. BrickLink — kóddal) egy jövőbeli önálló Lego-nyilvántartás modulban is szerepelhetne. A Lapról Lapra ehhez ma is készen áll (általános azonosító- és címke-mező a komponensen), a modulok-közti összekötés viszont platform-feladat:

1. **Azonosító mező — tudatosan általános.** A komponens azonosító mezője nem csak ISBN/ISSN/vonalkód lehet, hanem **bármilyen külső rendszer kódja** (pl. BrickLink-kód). A listatár csak példákat ad, nem korlátoz.
2. **Címkézés — „tágabb/szűkebb fogalom" (thesaurus-szerű) modell, nem szigorú fa és nem lapos lista.** Egy címke (pl. „Episode IV") kaphat egy vagy több „ez alá tartozik" kapcsolatot (pl. „Star Wars"), és **nem kizárólagosan** — egy címke több tágabb fogalomhoz is tartozhat. Tágabb fogalomra keresve a keresés automatikusan lemegy az alá tartozó szűkebb címkékre is. *(Példa: platform-szintű keresés „Star Wars — Új remény"-re több modulból hoz találatot: akciófigura, lego, kártya, képregény, könyv — mind a saját, egyszer felvitt címkéjük alapján.)* Ez a logika **kizárólag a platform fogalomtárában** él; a modul oldalán a címke marad egyszerű, szabad szöveges lista.
3. **„Kezdeményez → jóváhagy → befogad" folyamat, két szabállyal:**
   - **Új kapcsolat:** a modul csak **javasolja** a másik modulba való átvételt (pl. „ez a figura nyilvántartható a Lego-modulban is — átveszed?"); **sosem történik automatikusan.**
   - **Meglévő kapcsolat sérülése (drift):** ha egy már jóváhagyott kapcsolat egyik oldala megváltozik (pl. a Lego-nyilvántartásban egy darab eltörik/elcserélődik), a platform **értesít**, de **nem ír felül automatikusan** semmit egyik modulban sem.
   - **A jóváhagyási állapot maga (a kapcsolat ténye) kizárólag a platformon él, egyetlen példányban** — a modulok felülete csak **ablak** erre az egy, központi rekordra, nem másolat. Így mindegy, melyik felületen (platform vagy bármelyik érintett modul) fogadod el vagy nézed meg a javaslatot, mindig ugyanazt az állapotot látod — nincs szinkronizálási rés.

---

## 3. Modul-architektúra: „különálló, de csatolható" **[DÖNTVE]**

- A **Lapról Lapra önállóan is teljes**: saját telepítés, **saját Supabase-adatbázis**; platform nélkül is működik.
- Csatlakozáskor a platform **hivatkozni** tud a modul elemeire, de a modul nem függ tőle.
- **Tudatos ár:** mivel a modul valóban külön adatbázisban él, a későbbi platform-összekötés **valódi rendszer-rendszer linkelés** lesz (nagyobb munka, mint közös adatbázisnál). Ezt vállaljuk, cserébe a modul most egyszerűbb és maximálisan független.

**Négy olcsó „horog", amit már most beépítünk (a fájdalommentes későbbi csatoláshoz):**
1. **UUID** minden elemen (sorozat, szám, komponens) — örök, ütközésmentes identitás.
2. **Modul-névtér** — egy elem kívülről egyértelműen megcímezhető.
3. **Külső hivatkozás / címke-hely** (opcionális) — ide jön a platform-linkelés, átépítés nélkül.
4. **Adat-export** — a modul ki tudja adni magából az adatait (a platform beolvashatja; egyben **biztonsági mentés**). **[DÖNTVE]**

---

## 4. Azonosítás: kettős rendszer **[DÖNTVE]**

Minden elem két azonosítót kap, külön szerepben:

- **UUID (identitás):** véletlenszerű, globálisan egyedi kód (a Supabase generálja). Ezt használja a linkelés; soha nem változik, sosem ütközik — még két külön adatbázis közt sem.
- **Kód (beszédes felirat):** a te hierarchikus sémád, pl. `001-002-0017-02` = modul 001 (Lapról Lapra) · sorozat 002 · 17. szám · 02. komponens. A felületen ez látszik, e szerint rendezünk. A kód a **hierarchiából származtatott**: ha valami átrendeződik, a kód frissül, de az UUID fix marad, így a linkek nem törnek.
- A **modulszámot** (a „001") nem születéskor kapja a modul, hanem a **platformhoz csatlakozáskor** (a platform osztja ki, hogy ne ütközzön). Önállóan a modul a saját UUID-jével azonosítja magát.
- **A kód-számláló soha nem forog vissza. [DÖNTVE, hibajavítás]** A sorozat- (és tétel-/komponens-) kód nem a **pozícióból** (hányadik a listában) származik, hanem egy **folyamatosan növekvő, soha vissza nem forgó számlálóból**. Ha egy sorozatot törölsz, a kódja nem adódik ki újra — a következő új sorozat a *következő* számot kapja. Így a kód „lyukas" lehet, de sosem mutat véletlenül más entitásra, mint amire eredetileg utalt (ez fontos a platform-hivatkozások és bármilyen kód-alapú export miatt).

---

## 5. Adatmodell — Lapról Lapra

### 5.1 Sorozat
UUID · kód · **kiadó** · **megnevezés** (teljes név) · **megjelenítendő név** (fülön, max **16** karakter) · **szín** (12-es paletta, de bármennyi sorozat) · **komponens-készlet** (mely komponensekből áll egy szám ebben a sorozatban — a modul készletéből választva). **[DÖNTVE]**

### 5.2 Szám (= „tartó") **[DÖNTVE · v1.4-ben átrendezve]**
**Közös törzsadat (a számon ül, mindenki ugyanazt látja, csak admin/owner szerkeszti):**
UUID · kód · **lapszám** · **cím** · **megjelenés dátuma** (elhagyható) · **eredeti ár** (a megjelenéskori/újságos referencia-ár az egész számra, korábban „fedélár", elhagyható). A szám önmagában nem birtokol státuszt — a státusz a komponenseké.

**Személyes, szám-szintű adat (felhasználónként, `member_issue_data` tábla — v1.4):**
**fizetett ár** (amennyiért Ő ténylegesen megszerezte) · **beszerzési mennyiség** (db, alapértelmezetten 1 — hány db-ot vett egy vételből; ez szorozza a fizetett árat az összesítésnél) · **beszerzés dátuma** · **beszerzés forrása**. Ezek nem komponenshez, hanem a **számhoz** tartoznak, de **személyesek** (mindenki a sajátját rögzíti). **[DÖNTVE, v1.4]**

### 5.3 Komponens (a lényegi újdonság) **[DÖNTVE]**
A komponens-**típusokat a modul** definiálja (magazin / modell / egyéb; a modul szintjén bővíthető). Minden **sorozat megadja**, mely komponensekből áll egy szám (Disney: csak füzet; F1: magazin + modell), a modul készletéből választva. Az **import-sablon a sorozat komponens-készletéből származik**, így a kettő sosem csúszik szét.

Egy szám egy vagy több komponensből áll (pl. **magazin** + **modell**, vagy több melléklet). Minden komponens:
- UUID · kód · **típus** (magazin / modell / egyéb)
- **saját státusz** (megvan / hiányzik / nem kell / jelöletlen)
- **darabszám (db)** — élő készlet-számláló, alapértelmezetten 1; komponensenként külön (a magazinból maradhat 1, a modellből 2). Lásd 6.7.
- **saját kép** (**egy kép komponensenként**: a magaziné a borító, a modellé a modellfotó, a könyvé egy kép a könyvről — Supabase Storage)
- **azonosító** (ISBN / ISSN / vonalkód, elhagyható) — **a komponensen ül, nem a számon**
- **ár / érték** (elhagyható)
- **jegyzet** (elhagyható)
- **címkék (tag-ek)** — külön lekérdezhetők; ez a platform „fogalomtárához" kapcsolódó réteg

> Ez leváltja a korábbi „két fix képmező" ötletet: a kép mostantól **komponens-szintű**, így akárhány melléklet is viheti a sajátját.

**Képkezelés terve [DÖNTVE, építés előtt]:**
- Tárolás: **Supabase Storage**, **privát** tárolóban, **felhasználónkénti mappával** (a mappa neve a felhasználó UID-je); csak a saját mappa írható/olvasható. Megjelenítéskor rövid életű, aláírt hivatkozás.
- **Feltöltés előtti automatikus átméretezés:** hosszabbik oldal max **1200 px**, JPEG — kb. 150–250 kB/kép (az 1 GB ingyenes keretbe több ezer kép fér).
- Feltöltés helye: a **lenyíló képsáv**. Asztalin **drag & drop** + fájlválasztó; telefonon/tableten koppintásra **kamera vagy galéria**.
- Kép **cseréje és törlése** a képen lévő kis gombokkal.

### 5.4 Kezdő adat (az eredeti Excelből)
RBA — II. vh. repülők (60) · Centuria — Forma 1 (60) · Hachette — Disney könyvek (80).

### 5.5 Pénz-fogalmak (ár és érték) — három külön dolog **[DÖNTVE · v1.4-ben pontosítva]**
1. **Eredeti ár (referencia-ár, korábban „fedélár"):** megjelenéskori/újságos ár, az egész **számra**. **Közös törzsadat** — mindenki ugyanazt látja, csak admin/owner szerkeszti. → *v1-ben benne.* **[DÖNTVE, v1.4 átnevezés]**
2. **Fizetett ár („amit én fizettem") + beszerzési mennyiség + dátum + forrás:** **személyes**, szám-szinten (felhasználónként, `member_issue_data`). Mindenki a sajátját rögzíti. A belekerülési költség = Σ (**fizetett ár × beszerzési mennyiség**) a saját tételekre. → *v1-ben benne.* **[DÖNTVE, v1.4]**
3. **Aktuális érték (piaci / központi) + értéktörténet:** az elem *mai* értéke, időbélyeges naplóval; ülhet **számon vagy komponensen** is (a Lapról Lapra a szám-szintűt használná). → **[KÉSŐBB]** — betervezve, de nem v1.

**Származtatott statisztikák:** belekerülési költség (Σ fizetett ár × mennyiség) · jelenlegi összérték (Σ aktuális érték) · a kettő különbsége (nyereség / ráfizetés).

**Sorozat-összeg — kétféle nézet (választható) [DÖNTVE, v1.4]:** a hero összeg-doboza két alapon számol, kapcsolóval:
- **„Eredeti ár alapján"** (alapértelmezett): Σ eredeti ár × a **referencia-komponens** aktuális darabszáma, **csak a `megvan` állapotúakra**. Referencia-komponens: **magazin** → ha nincs, **könyv** → ha az sincs, az első komponens-típus.
- **„Fizetett ár alapján":** Σ fizetett ár × beszerzési mennyiség, a saját rögzített tételekre.

**Megjelenítési szabály [DÖNTVE, v1.4]:** a **„fizetve X Ft"** felirat (lista) és a **„Fizetett ár alapján"** összeg **csak azt a tételt** veszi figyelembe, amelynél **legalább egy komponens `megvan`**. Ha semmi nincs megvan állapotban (hiányzik/jelöletlen), a „fizetve" nem jelenik meg és nem számít az összegbe — hiszen ténylegesen semmi nem lett megvéve.

### 5.6 Közös listatár (kötött, bővíthető listák) **[DÖNTVE]**
A szabad szöveges mezők elgépelhetők, és ez később a címkerendszert is összezavarná. Ezért egy **közös listatár** (egy tábla, több listatípussal) szolgálja ki a választható értékeket:

| Listatípus | Példa értékek |
|---|---|
| **kiadó** | RBA · Centuria · Hachette · Egyéb |
| **komponens-típus** | Magazin · Modell · Könyv · Egyéb |
| **azonosító-típus** | ISBN · ISSN · Vonalkód · Egyéb |
| **beszerzés forrása** | Előfizetés · Bolt · Bolhapiac · Vatera · Ajándék · Egyéb |

**Elvek:**
- Mindegyik listában van **„Egyéb"** — a rögzítés soha ne akadjon el azon, hogy nincs kész kategória; a bejegyzés **később átsorolható**. **[DÖNTVE]**
- A lista **bővítése csak a szerkesztő felületén** lehetséges (nem rögzítés közben) — így nem hízik el észrevétlenül („keep it simple"). **[DÖNTVE]**
- Nem listásítunk: státusz (a rendszer alaplogikája), szín (vizuális tulajdonság), egyedi mezők (cím, ár, dátum).
- **Címkék:** a listatárban a hely fenn van tartva, de a **címkelogikát még nem szabványosítjuk** — külön átbeszélendő. **[NYITOTT]**

A **beszerzés forrása** új mező a számon (opcionális).

---

## 6. Státuszok, hierarchia és színezés **[DÖNTVE]**

### 6.1 A komponens négy állapota
megvan · hiány · nem kell · jelöletlen. A színek: **megvan = zöld**, **hiány = piros**, **nem kell = szürke**, jelöletlen = semleges.
*(A „nem kell" szürke — így a sárga felszabadult, és kizárólag a lapszám-szintű „részleges" jelentést hordozza.)*

### 6.2 Jelölés (körbeforgó) **[DÖNTVE]**
- Az első koppintás jelöletlenről → **megvan**.
- Utána körbeforog: megvan → hiány → nem kell → megvan…
- **Jelöletlenre nem tér vissza.** A státusz **reset-elése kizárólag a szerkesztő ablakban** lehetséges.
- **Jövőbeli dátumú** szám komponensei nem állíthatók (a gombok letiltva).

### 6.3 Komponens-hierarchia **[DÖNTVE]**
Egy szám színét a **domináns komponens** dönti el:
- ha van magazin + más komponens → a **nem-magazin** komponens a domináns;
- ha csak egy komponens van → az a domináns.
*(Kettőnél több nem-magazin komponens esetét később tisztázzuk — jelenleg nincs ilyen.)*

### 6.4 A lapszám színe **[DÖNTVE]**

| Domináns komponens | Magazin | Lapszám színe |
|---|---|---|
| megvan | bármi | **zöld** |
| nem kell | bármi | **szürke** |
| hiány | megvan | **sárga** (részleges) |
| hiány | hiány / nem kell / jelöletlen | **piros** |
| jelöletlen | bármi | **semleges** |
| *(még nem jelent meg)* | — | **semleges** |

**Olvasata:** zöld = kész · sárga = van belőle valami, de a lényeg hiányzik · piros = kell · szürke = tudatosan kihúzva · semleges = még nem téma.

### 6.5 Darabszám-számláló (komponensenként) **[DÖNTVE]**
Egy komponensből több példány is lehet (pl. 4 magazint veszel a melléklet miatt), és a példányok sorsa **komponensenként eltérhet** (a magazinokból 1 marad, a figurákból 2).

- A számláló **komponensenként** él, alapértelmezetten **1**.
- „Megvan"-ra jelöléskor mindig **1-ről indul** — onnan emelhető.
- A listában **+/− gombokkal** léptethető; a darabszám a jelölő gombon látszik (ikon balra, szám jobbra), **csak ha 1-nél több**.
- A +/− gombok akkor láthatók, ha a darabszám 1-nél több, **vagy** ha be van kapcsolva a karbantartó mód (így lehet 1-ről feljebb lépni anélkül, hogy a böngésző nézet zsúfolt lenne).
- **0-ra csökkentve** a komponens automatikusan **„hiányzik"** állapotba vált; **1 fölé visszanövelve** automatikusan **„megvan"**-ra. Negatívba nem megy.
- A számláló a *jelenlegi készletet* mutatja; a **beszerzéskori** mennyiség (a költségszámításhoz) külön mező a **számon** (5.2). A kettő szándékosan külön: az egyik „mennyit vettem", a másik „mennyi van most".
- Az egyes példányok részletes sorsa (mi tört el, mi cserélődött el) továbbra is a szabad **jegyzet** mezőbe írható, strukturálás nélkül.

### 6.6 Láthatóság napfényben **[DÖNTVE]**
A fő használat a bolhapiac, tűző napon. Ezért a lapszám-színek **erős háttérrel** és **tömör, színes bal oldali csíkkal** jelennek meg — a halvány árnyalatok kültéren eltűnnek.
*(Ha kevés: teljesen telített háttér, vagy világos mód — [NYITOTT], ha felmerül.)*

### 6.7 Egyéb megjelenítési elvek **[DÖNTVE]**
- A haladás **komponens-típusonként** mérhető (pl. „magazinok 40/60, modellek 31/60").
- A rendszer **soha nem állít át magától** semmit.
- **Dátum:** egységes méret/vastagság/szín minden sorozatnál — **egyetlen kivétel**: a még meg nem jelent számnál **piros**.
- **Tipográfiai konzisztencia:** a betűméretek, színek és vastagságok egységesek az egész felületen; eltérés csak szándékos jelzés lehet.

---

## 7. Funkciók

- **Összecsukható fülsáv [DÖNTVE, megvalósítva]:** alapból csak az **aktív sorozat** füle látszik (saját színével), mellette egy nagyobb **„Sorozatok (n)"** gomb nyitja le a többit 3-as rácsban. Választás után magától visszazár. **Nyitott választó közben a tétel-lista, a szűrők és a hero el vannak rejtve** — csak a választásra fókuszálunk. A „Sorozatok" gomb szándékosan **nagyobb**, mint az aktív sorozaté (könnyebb telefonos célzás).
- **Hero:** kiadó, teljes név, haladás komponens-típusonként.
- **Belekerülési költség:** **alapból rejtett**, gombbal megjeleníthető/elrejthető; **sorozatváltáskor mindig visszaáll rejtettre**. **[DÖNTVE]**
- **Adaptív statisztika:** van jövőbeli szám → „Következő megjelenés"; nincs → „Beszerzendő (hiányzó + jelöletlen)". **[DÖNTVE]**
- **Szűrők:** Mind / Megvan / Hiányzik / Nem kell / Várható (a Várható elrejtve, ha nincs jövőbeli). **[DÖNTVE]**
- **Keresés** név/szám szerint.
- **Lista (kompakt):** egy sor / lapszám — szám, cím, adatok, jobbra **komponensenként egy-egy ikonos jelölő** (a gomb alatt rövid felirat: megvan / hiány / nem kell). Ha egy komponensből 1-nél több van, a **darabszám a gombon** jelenik meg az ikon mellett, alatta **+/− léptetőkkel** (lásd 6.5). **[DÖNTVE]**
- **Tapadó fejléc:** a lista fölött rögzített sáv nevezi meg az oszlopokat (Magazin / Modell / Könyv) — mint Excelben a fagyasztott sor. **[DÖNTVE]**
- **Lenyíló képsáv:** a sor végén nyíl; lenyitva komponensenként **egy-egy azonos méretű kép** (egy komponensnél középre húzva), alatta a **komponens neve és kódja**; ha nincs kép: „nincs adat". **Alapból csukott, egyszerre csak egy nyitható**, sorozat-/szűrő-/keresésváltáskor visszazár. **[DÖNTVE]**
- **Karbantartó mód:** tétel/komponens szerkesztése-törlése, új tétel, új sorozat, sorozat szerkesztése; **státusz-reset**; a **listatár bővítése**. *(Építés alatt — 5b.)*
- **Excel-alapú betöltés (csak asztali/laptop, telefonon rejtve):** sablon letöltése (**a sorozat komponens-készletéből származtatva**) + kitöltött fájl feltöltése; sorszám szerinti, nem-romboló frissítés. **[DÖNTVE]**
- **Kép csatolása:** komponens-szinten (Supabase Storage). *(Építés alatt.)*
- **Bejelentkezés megőrzése:** tartós munkamenet, hogy telefonon ne kelljen újra belépni; élesben „kezdőképernyőhöz adás" (PWA) is szóba jön. **[DÖNTVE]**

**Nézetek és eszközök [DÖNTVE]:** egy közös, reszponzív felület — **nincs külön „gyors nézet", és nincs vizuális eltérés** az eszközök közt; csak a funkciók elérhetősége tér el.
- **Telefon / tablet:** beszerzés + karbantartás (státuszok jelölése, keresés, szűrés, böngészés, kép fotóval, egyszerű szerkesztés). A nehéz, fájl-alapú műveletek (Excel-sablon + drag & drop feltöltés) itt **nem elérhetők**.
- **Asztali / laptop:** mindez + **adminisztráció** (sablon letöltése/feltöltése, tömeges műveletek).
- A tablet a telefonnal egy csoportban (karbantartás-szerep); az admin-funkciók elrejtése az **eszköz jellegére** (érintős/méret) figyel, nem csak a szélességre. (Megvalósítás: építési részlet.)

---

## 8. Technológiai felépítés

- **Vercel:** a modul (felület) tárolása/publikálása. **[DÖNTVE]**
- **Supabase (a modul saját projektje):** adatbázis + Storage (képek) + Auth (privát bejelentkezés). **[DÖNTVE]**
- A felület **közvetlenül** a Supabase-hez fordul — nincs külön proxy. **[DÖNTVE]**
- **Privát**, **szinkron** telefon és gép közt (közös háttér). **[DÖNTVE]**
- **Felület felépítése [DÖNTVE, v1.4]:** natív **ES modulok**, **build-eszköz nélkül**. `index.html` (markup) + `styles.css` + `js/` mappa: `state`, `supabase`, `modal`, `permissions`, `data`, `render`, `personal`, `admin-forms`, `admin-users`, `excel`, `auth`, `main`. A `supabase-js` és az `xlsx` CDN-ről, ESM-ként. (A mutálható app-állapot egy közös `state` objektumban.)
- **Jogosultság:** háromszintű szerep a `members` táblában, RLS-sel és belépéskori ellenőrzéssel — lásd 13.

---

## 9. Roadmap

1. **Lapról Lapra (most):** komponens-modell, kettős azonosító, komponens-szintű kép/azonosító, a négy horog, önálló Supabase, publikálás.
2. **Felismerés [KÉSŐBB]:** előbb **szám/vonalkód-leolvasás** (ISBN 978/979, ISSN/periodika 977; megbízható), később **vizuális MI-felismerés** (szűkített találati lista; borítónál jobb, modellnél gyengébb; külső MI, költség).
3. **Sorozatok sorrendjének kézi átrendezése [KÉSŐBB]:** drag & drop (mint telefonon az alkalmazás-ikonok rendezése). A **kód** ettől függetlenül a létrehozás sorrendjét (a számlálót) követi — csak a *megjelenítési sorrend* változna. Most nem szükséges (kevés sorozatnál a létrehozási sorrend elég), „keep it simple" — később, ha indokolt.
4. **Értékkövetés [KÉSŐBB]:** aktuális érték + **értéktörténet** (idősor); belekerülési költség vs. jelenlegi összérték, nyereség/ráfizetés.
5. **Hordozhatóság [KÉSŐBB]:** adat-export mint biztonsági mentés és költöztetés alapja; szolgáltató-alternatívák felmérése (Vercel/Supabase kiesés esetére); hosszú távon esetleg saját szerver.
6. **OM Curator platform [KÉSŐBB]:** térkép, kapcsolat-tár, fogalomtár; a végén az **okos címke-javaslat** (MI). Elv: „a platform kér, nem parancsol".

---

## 10. Nyitott kérdések

1. **Komponens-típus bővítés: Lego-jellegű sorozatok** **[NYITOTT]**
   Hasonló szerkezetű, de eddig nem kezelt sorozattípus: magazin + figura (pl. Lego) — a mostani komponens-modell (5.3) ezt már ma is elbírja, csak egy új komponens-típust kell felvenni a listatárba (☰ Listák), kódolás nélkül. Kapcsolódik az 5.6 „azonosító mező tudatosan általános" ponthoz.
2. **12 fölötti sorozatszám kezelése — 8–15 sorozatra tervezve** **[DÖNTVE, megvalósítva]**
   - **Színek:** bővített, **színcsaládokba csoportosított** paletta (kb. 6 család × 3–4 árnyalat). A színválasztó vizuálisan csoportosítva mutatja a családokat, hogy logikailag összetartozó sorozatok (pl. modellautók, könyvek, Lego-figurák) hasonló árnyalatot kaphassanak. **Nincs mögötte tárolt kategória-adat** — tisztán vizuális segítség, tudatosan nem előlegzi meg a platform jövőbeli címke-/fogalomtárát.
   - **Fülek elrendezése:** **összecsukható fülsáv** — alapból csak az aktív sorozat füle látszik nagyban, mellette egy „Sorozatok" gombbal nyitható a többi (mini-választó, nem állandóan kiterített rács). 20–30+ sorozatnál később megfontolandó egy kereshető sorozatválasztó is — egyelőre nem indokolt.
3. **Lapszám beszúrása lista közepére** **[LEZÁRVA, funkció nem szükséges]**
   Tisztázva: a lapszám a rendszerben **nem pozíció, hanem sima adat** — a tételek mindig szám szerint rendeződnek, nem felvitel sorrendje szerint. Ha a kiadó kihagy egy számot és később pótolja (pl. 1,2,3,4,6,7… majd később az 5), elég felvinni az 5-öst — magától a helyére kerül, semmit nem kell eltolni. **Valódi átszámozás** (amikor a kiadó ténylegesen minden utána lévő számot átszámoz, pl. egy beékelt különkiadás miatt) nem jellemző eset a tulajdonos szerint — nem épül rá funkció.
4. **Többespéldány kezelése egy beszerzésen belül** **[DÖNTVE, megvalósítva]**
   Példa: 4 db ugyanabból a magazinból egy vásárlással (mert a melléklet kell többször). **Két, szándékosan külön mező** oldja meg:
   - **Beszerzési mennyiség** a **számon** (5.2) — „mennyit vettem": ez épül be a belekerülési költségbe (mennyiség × beszerzési ár).
   - **Darabszám** a **komponensen** (6.5) — „mennyi van most": komponensenként külön él és a listában +/− gombokkal léptethető, mert a magazinok és a mellékletek sorsa eltérhet. 0-nál automatikusan „hiányzik".
   Az egyes példányok részletes sorsa (mi tört el, mi cserélődött el) továbbra is a **szabad jegyzet mezőbe** írható, strukturálás nélkül. *(A platform-fejezet „drift" elvéhez kapcsolódik: mennyiségi árnyalat nélkül a modulok-közti értesítés is csak megvan/nincs-meg szinten tudna jelezni.)*
5. **Több felhasználó — adattárolási modell** **[NYITOTT]**
   Jelenleg: **egy közös Supabase-projekt**, felhasználónként szétválasztott adattal (RLS + saját mappa a képeknek). Alternatíva: **felhasználónként saját Supabase-projekt**.
   - *Saját projekt mellett:* teljes adatszétválasztás, külön tárhelykeret, illeszkedik a „modul birtokolja az adatot" elvhez.
   - *Ellene:* magas belépési küszöb (fiók + projekt + SQL-ek + kulcsok kézzel); minden jövőbeli adatbázis-módosítást **minden felhasználónak** külön le kellene futtatnia; az ingyenes projektet a Supabase **egy hét inaktivitás után felfüggeszti**.
   - **A tulajdonos iránya:** a **platform** (OM Curator) legyen a fő belépési pont, onnan érhetők el a modulok. Aki közvetlenül a modult használja, az is **adjon adatot a platformnak**. A platform később **automatikusan létrehozhatná** a felhasználó Supabase-projektjét, és **heti ütemezett feladattal** forgalmat generálna, hogy ne függessze fel a szolgáltató. *(Részletek a platform-specifikációba.)*
   - Köztes lehetőség: alapértelmezés a közös projekt, haladó opcióként „hozd a saját hátteredet" (saját URL + kulcs megadható).

6. **Hordozhatóság / szolgáltatófüggetlenség** **[NYITOTT]**
   Készüljön terv arra az esetre, ha a **Vercel** vagy a **Supabase** kiesik, vagy erősen fizetőssé válik: milyen alternatívák vannak, és hogyan költöztethető az adat. Az **adat-export** (a négy horog egyike) ennek az alapja.
   **Hosszú táv:** saját szerver — *jelenleg nem indokolt, felesleges komplikáció; később aktuális lehet.*

7. **Címkerendszer:** a listatárban a hely megvan, de a logika (hierarchia? szinonimák? kanonikus alak?) **külön átbeszélendő**, mielőtt szabványosítjuk. *(Lásd bővebben a platform-fejezet „Modulok közti kapcsolat" pontját is.)*
8. **Import-sablon konkrét elrendezése:** az elv eldőlt (a sorozat komponens-készletéből származik); a pontos oszlop-felépítés az építéskor.
9. **Kép nagyítása:** a lenyíló képsávban a képre koppintva teljes képernyős nézet — hasznos lehet, még nem épült meg.
10. **Kettőnél több nem-magazin komponens** esetén a hierarchia pontosítása (jelenleg nem aktuális).
11. **További „nagy kép" szempontok**, ha felmerülnek.

---

## 11. Állapot most (építés)

**Kész és él:**
- **Supabase-projekt** (Frankfurt, Free), táblák: `series`, `issues`, `components`, `lists` — mind **RLS**-sel védve (csak a saját adat).
- **Bejelentkezés** (e-mail + jelszó), tartós munkamenettel.
- **Adatok betöltve:** 3 sorozat · 200 szám · 320 komponens.
- **App (5a):** bejelentkezés → a saját adatok betöltése Supabase-ből → kompakt lista, tapadó fejléc, ikonos komponens-jelölők (körbeforgó, mentés azonnal a felhőbe), hierarchia szerinti lapszám-színezés, rejthető belekerülési költség, lenyíló képsáv (képek nélkül), színes fülek.
- **Listatár** feltöltve (kiadó / komponens / azonosító / forrás).

**Következő lépések:**
1. **5b — Karbantartás:** szerkesztő ablak (mezők, komponens-kód, azonosító + típus, forrás, státusz-reset), új tétel/sorozat, listatár bővítése, Excel-sablon és -feltöltés (csak asztali).
2. **Képek:** Supabase Storage, komponensenként egy kép; feltöltés egyesével és tömegesen.
3. **Publikálás:** GitHub (privát repó, verziókövetés) → Vercel → élő link, telefonon is.

---

## 12. Karbantartás — hibajavítási napló (5b tesztelés) **[DÖNTVE, javítás alatt]**

Az 5b (karbantartás) éles tesztelése során felmerült hibák és a rájuk adott döntés:

1. **Sablon sorozat nélkül:** nem volt jelzés, hogy előbb sorozatot kell létrehozni. → Javítás: figyelmeztető üzenet, ha nincs kiválasztott/aktív sorozat.
2. **Excel-feltöltés célsorozata nem egyértelmű (súlyos):** a feltöltés a véletlenül aktív fület töltötte fel — más sorozat sablonjával könnyen felül lehetett írni egy másikat. → Javítás: **megerősítő ablak** feltöltés előtt, ami kiírja a célsorozat nevét és a várható hatást (hány új tétel, hány frissül), mielőtt bármi mentődik.
3. **Sablon formátuma nem vezetett:** a dátum/ár cellák szövegként viselkedtek, a rendszer a nem felismert formátumot szótlanul elutasította. → Javítás: a sablon cellái **valódi Excel dátum- és szám-formátumot** kapjanak.
4. **Ár beolvasása nem kezelte az ezres tagolást:** `1.490` → hibásan `1`-ként olvasódott be (a `parseInt` a tagoló karakternél megállt). → Javítás: a tagolójelek (pont, vessző, szóköz) eltávolítása szám-értelmezés előtt.
5. **Kód pozícióból, nem számlálóból származott:** lásd 4. fejezet — javítva.

*(A javítások élesben ellenőrizve, működnek — beleértve egy menet közben talált 6. hibát is: az Excel-feltöltés néma hibája a `dateWarnings` hibás hatóköre miatt, javítva. A dátum-felismerés emellett magyar hónapneveket (Excel-automatikus formázás) is kezel.)*

**Utólagos adatjavítás (v1.4) [DÖNTVE, javítva]:** a 4. pont ezres-tagolási **kód-hibája rég javítva**, de a régi adatokban maradt egy korrupt csomag: a „II VH Repülők" **#5–60** ára `5990 → 5`-re romlott (az `eredeti_ar`-nál és a migrált `fizetett_ar`-nál is). Egyszeri, biztonságos SQL-lel visszatöltve a **forrásból** (`újság megjelenések.xlsx` + `laprol-lapra-adatbetoltes.sql`, egyező árak), **`< 100 Ft` szűrővel csak a korrupt sorokra** (legitim árat nem érintve), tranzakcióban. A többi öt sorozat ellenőrizve, tiszta. Emellett a személyes `fizetett_ar` teljessé téve (minden árral bíró számhoz `fizetett_ar = eredeti_ar`, ahol hiányzott). Fájlok: `laprol-lapra-arjavitas.sql`, `laprol-lapra-fizetett-teljesseg.sql`.

---

## 13. Megosztott katalógus és felhasználó-kezelés **[DÖNTVE, alap; részletek NYITOTT]**

### 13.1 Alapmodell + háromszintű jogosultság **[DÖNTVE, megvalósítva — v1.4]**
A sorozatokat/tételeket a **tulajdonos/admin** viszi fel — minden bejelentkezett felhasználó látja őket. A **státusz/darabszám/jegyzet** (`member_status`) és a **szám-szintű személyes ár-adat** (`member_issue_data`) felhasználónként elkülönített. Regisztráció nyitott; új fiók automatikusan `role='user'`, `status='active'`.

**Három szerepkör** (`members` tábla: `user_id`, `role`, `status`, `display_name`):
- **user** — saját jelölés + személyes ár-adat. (Később: sorozat-választás, üzenetküldés.)
- **admin** — + törzsadat (sorozat/tétel/komponens) közvetlen létrehozása/szerkesztése, ☰ Listák bővítése, Excel-import, **sima user letiltása/visszaengedése**.
- **owner (tulajdonos)** — + **admin-jog kiosztása/visszavonása** és a kód módosítása. A tulajdonos sora **védett**: senki (admin sem) nem tilthatja le / fokozhatja le / írhatja felül.

**Szabályok:** admin **csak `user` sort** kezelhet (másik admint vagy a tulajdonost nem); admin-jogot **csak a tulajdonos** oszthat/vonhat vissza; **senki nem módosíthatja a saját szerepkörét**.

**Letiltás vs. törlés — most CSAK a letiltás:** a letiltás visszafordítható (`status='disabled'`), és a letiltott fiók **belépéskor azonnal kiléptetve** („A fiókod fel van függesztve"), olvasásig sem jut. Valódi fiók-**törlés** tudatosan **később** (admin API / Edge Function — lásd 13.2).

**Technikai megvalósítás:** RLS a `members`-en; a szerep-ellenőrzés **`SECURITY DEFINER` segédfüggvényekkel** (`my_role` / `is_staff` / `is_active`) az RLS-rekurzió elkerülésére; **oszlop-védő `BEFORE UPDATE` trigger** (tulajdonos-sor sérthetetlen, role-t csak owner, admin csak `status`). A törzstáblák (`series/issues/components/lists`) írás-policy-je **„staff + aktív"**. Felhasználó-kezelő felület: 🔧 → **„👥 Felhasználók"**. Az import-funkciók (mindkettő) csak PC/laptop/tablet nézetben (`desktop-only`). SQL: `laprol-lapra-jogosultsag-1-members.sql` (+ `-2-ar-modell`, `-3-display-name`).

### 13.2 Fiókkezelés **[részben DÖNTVE — letiltás kész; törlés NYITOTT]**
- **Letiltás/visszaengedés:** ✅ **megvalósítva** (13.1) — visszafordítható, RLS-szinten és belépéskor is kikényszerítve; admin a sima usereket, a tulajdonos az adminokat is.
- **Valódi fióktörlés** (adminisztrátori és saját): továbbra is **[NYITOTT]**. A törléshez a titkos `service_role` kulcs kell (Supabase **Edge Function**), ami sosem kerülhet a böngészőbe. Egy közös, később megépítendő Edge Function oldaná meg. Ha „törlés" merül fel felhasználóra, addig **letiltás** a helyes válasz.

### 13.3 Felhasználói sorozat-választás (kiválasztás/bővítés/törlés) **[NYITOTT]**
Igény: a nem-tulajdonos felhasználó a tulajdonos által felvitt sorozatok közül **kiválaszthassa**, melyiket szeretné a saját nyilvántartásába felvenni (nem mindegyiket látja automatikusan alapértelmezésben) — később bővíthet, vagy törölhet a választásából.
- **Egy sorozatból csak egy aktív választás lehet** — nem választható be kétszer ugyanaz.
- **Törlés-korlát:** ha egy felhasználó sokszor törli, majd újra felveszi ugyanazt a sorozatot, az zavart okozhat a kód-hivatkozásoknál (platform-integráció szempontjából). **Javasolt limit: max. 5 törlés** sorozatonként/felhasználónként — ez látszódjon is a sorozat-kezelő felületen (pl. "3/5 törlés felhasználva").
- **Újra felvételkor tiszta lap:** ha egy felhasználó töröl egy sorozatot a saját nyilvántartásából, majd újra hozzáadja, **ne emlékezzen a korábbi jelöléseire** — teljesen új, üres állapotból induljon (nem a régi `member_status` sorok élednek újra, hanem törlődnek/érvénytelenednek, és a következő felvételkor friss kezdés van).
- Nyitott technikai kérdés: ez egy új kapcsoló-tábla igényét veti fel (pl. `member_series` — melyik felhasználó melyik sorozatot választotta be, hányszor törölte), amit még nem terveztünk meg részletesen.

### 13.4 Üzenetküldés az adminisztrátornak **[NYITOTT, koncepció]**
Alapötlet: a nem-tulajdonos felhasználó rövid üzenetet küldhessen a tulajdonosnak.
- **Max. 150 karakter.**
- Az adminisztrátornál megjelenik: **ki küldte** + **az üzenet szövege**.
- A részletek (hol jelenik meg az adminnak, olvasottság-jelzés, válaszolhat-e, értesítés-e vagy csak belépéskor látható lista) **külön átbeszélendő**, mielőtt tervezünk rá adatmodellt.

---

*Napló:*
- v1.4 — **háromszintű jogosultság** (user/admin/owner; `members` tábla `role`/`status`/`display_name`; **letiltás** [nem törlés], letiltott fiók belépéskor kirúgva; felhasználó-kezelő UI „👥 Felhasználók"; `SECURITY DEFINER` segédfüggvények + oszlop-védő trigger; staff-alapú törzsadat-RLS; a tulajdonos sora védett). **Ár-modell szétválasztás:** „fedélár" → **Eredeti ár** (közös törzsadat), a személyes ár-adat (fizetett ár, beszerzési mennyiség, dátum, forrás) a **`member_issue_data`** táblába; **kétnézetes hero** („Eredeti ár" / „Fizetett ár alapján") + megjelenítési szabály: a „fizetve"/összeg **csak megvett tételre** (≥1 komponens `megvan`) számít. **Fájlszétbontás:** `index.html` → natív **ES modulok** (`js/`) + `styles.css`, build-eszköz nélkül. **Adatjavítás:** régi ezres-tagolási korrupció (II VH Repülők #5–60: 5→5990) egyszeri, forrás-alapú SQL-lel visszatöltve, `<100` szűrővel; a személyes fizetett ár teljessé téve. SQL-ek: `jogosultsag-1/2/3`, `arjavitas`, `fizetett-teljesseg`.
- v1.3 — megosztott katalógus (13. fejezet): alapmodell megvalósítva (member_status, tulajdonos-only szerkesztés, nyitott regisztráció); négy új nyitott kérdés: admin/saját fióktörlés (Edge Function kell), felhasználói sorozat-választás (max 5 törlés/sorozat limit, tiszta újrafelvétel), üzenetküldés adminnak (max 150 karakter, koncepció szinten).
- v1.2 — megvalósítva: összecsukható fülsáv (nyitott választónál a lista/szűrők/hero elrejtve, nagyobb „Sorozatok" gomb), színcsaládokba rendezett 24-es paletta, **komponensenkénti darabszám-számláló** (+/− a listában, 0-nál automatikus „hiányzik", 1 fölé visszanövelve „megvan"). A beszerzési mennyiség (szám) és a jelenlegi darabszám (komponens) szándékosan külön mező.
- v1.1 — a „később megbeszélendő" csomag lezárva: 12 fölötti sorozatszám (színcsaládos paletta + összecsukható fülsáv); lapszám-beszúrás lezárva funkció nélkül (a lapszám eleve nem pozíció); többespéldány kezelése (mennyiség mező a számon, költségszámításba építve, részletek a jegyzetben).
- v1.0 — platform-jegyzetek: „Modulok közti kapcsolat" három elve (általános azonosító, tágabb/szűkebb címke-modell, kezdeményez→jóváhagy→befogad — a jóváhagyási állapot kizárólag a platformon él); négy új Lapról Lapra nyitott kérdés (Lego-jellegű komponens, 12 fölötti sorozatszám, lapszám-beszúrás, többespéldány); az 5b hibajavítási napló „élesben ellenőrizve" állapotra frissítve (a néma Excel-hibával együtt, 6 hiba összesen).
- v0.9 — hibajavítási kör (5b tesztelés): kód-számláló soha nem forog vissza (sorozat/tétel/komponens); Excel-import célsorozat megerősítő ablak (tervezett); sablon dátum/szám-formátum javítás (tervezett); ár ezres-tagolás javítás (tervezett); sorozatok kézi átrendezése a roadmapre (KÉSŐBB, „keep it simple").
- v0.8 — képkezelés terve rögzítve (privát Storage, felhasználónkénti mappa, automatikus átméretezés, drag & drop / kamera); új nyitott kérdések: több felhasználós adattárolási modell (közös vs. saját Supabase-projekt, platform-alapú automatizálással) és hordozhatóság/szolgáltatófüggetlenség.
- v0.7 — **építés megkezdve** (Supabase + app 5a él). Új: komponens-hierarchia (domináns komponens) és a lapszám-színezés táblázata; körbeforgó jelölés, jelöletlenre nincs visszatérés (reset csak szerkesztőben); közös **listatár** (kiadó/komponens/azonosító/forrás, „Egyéb"-bel, bővítés csak szerkesztőben); beszerzés forrása mező; lenyíló képsáv; rejthető belekerülési költség; színes fülek; egységes dátum- és tipográfia-szabály; napfény-olvashatóság elve; tartós bejelentkezés.
- v0.6 — kép komponensenként egy (magazin→borító, modell→modellfotó, könyv→egy kép); a demó (v3) a komponens-modellt tükrözi, képkezelés nélkül (Supabase-fázis).
- v0.5 — nézetek: egy közös, reszponzív felület, azonos kinézettel; telefon/tablet = beszerzés + karbantartás, asztali = + adminisztráció (fájl-alapú műveletek csak asztalin). 10.2 (telefonos gyors nézet) eldőlt.
- v0.4 — komponens-típusok a **modul** szintjén, a **sorozat** választja ki a saját komponens-készletét; az import-sablon ebből származik (10.1 elv eldőlt).
- v0.3 — pénz-fogalmak szétválasztása (fedélár / beszerzési ár / aktuális érték); ár a **számon** (10.1 eldőlt); belekerülési költség statisztika; értékkövetés a roadmapre.
- v0.2 — platform (OM Curator) elvi fejezet; komponens-modell (szám = tartó, komponensek külön státusszal); kettős azonosító (UUID + kód); képek és ISBN/ISSN komponens-szintre; „különálló, de csatolható" architektúra + négy horog; a régi „két képmező" leváltva.
- v0.1 — első összeállítás.
