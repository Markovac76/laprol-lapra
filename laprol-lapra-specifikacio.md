# OM Curator (platform) & Lapról Lapra (első modul) — specifikáció

**Verzió:** 1.9 · **Állapot:** ÉLES, aktív fejlesztés (a Lapról Lapra modul v1) · **Projekt:** Collector app

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
UUID · kód · **lapszám** · **cím** · **megjelenés dátuma** (elhagyható) · **eredeti ár** (a megjelenéskori/újságos referencia-ár az egész számra, korábban „fedélár", elhagyható) · **`is_deleted`** (v1.7 — lásd 13.8, soft-delete). A szám önmagában nem birtokol státuszt — a státusz a komponenseké.

**Személyes, szám-szintű adat (felhasználónként, `member_issue_data` tábla — v1.4):**
**fizetett ár** (amennyiért Ő ténylegesen megszerezte) · **beszerzési mennyiség** (db, alapértelmezetten 1 — hány db-ot vett egy vételből; ez szorozza a fizetett árat az összesítésnél) · **beszerzés dátuma** · **beszerzés forrása**. Ezek nem komponenshez, hanem a **számhoz** tartoznak, de **személyesek** (mindenki a sajátját rögzíti). **[DÖNTVE, v1.4]**

### 5.3 Komponens (a lényegi újdonság) **[DÖNTVE]**
A komponens-**típusokat a modul** definiálja (magazin / modell / egyéb; a modul szintjén bővíthető). Minden **sorozat megadja**, mely komponensekből áll egy szám (Disney: csak füzet; F1: magazin + modell), a modul készletéből választva. Az **import-sablon a sorozat komponens-készletéből származik**, így a kettő sosem csúszik szét.

Egy szám egy vagy több komponensből áll (pl. **magazin** + **modell**, vagy több melléklet). Minden komponens:
- UUID · kód · **típus** (magazin / modell / egyéb)
- **megnevezés** (opcionális, szabad szöveges) — lásd lent
- **saját státusz** (megvan / hiányzik / nem kell / jelöletlen)
- **darabszám (db)** — élő készlet-számláló, alapértelmezetten 1; komponensenként külön (a magazinból maradhat 1, a modellből 2). Lásd 6.7.
- **saját kép** (**egy kép komponensenként**: a magaziné a borító, a modellé a modellfotó, a könyvé egy kép a könyvről — Supabase Storage)
- **azonosító** (ISBN / ISSN / vonalkód, elhagyható) — **a komponensen ül, nem a számon**
- **ár / érték** (elhagyható)
- **jegyzet** (elhagyható)
- **címkék (tag-ek)** — külön lekérdezhetők; ez a platform „fogalomtárához" kapcsolódó réteg

> Ez leváltja a korábbi „két fix képmező" ötletet: a kép mostantól **komponens-szintű**, így akárhány melléklet is viheti a sajátját.

**Komponens-szintű "Megnevezés" + több azonos típusú komponens egy Számon [DÖNTVE, megvalósítva — v1.9]:** feloldja a 10.10-es nyitott kérdést. Egy Számon **egy típusból TÖBB, egyedi példány is** felvehető (pl. két különböző Lego-minifigura-csomag ugyanazon a Számon) — a `components`/`draft_components` táblákon sosem volt `UNIQUE(issue_id, tipus)` megszorítás, ez korábban tisztán a kliens-oldali (típusonként egy komponens) modell korlátja volt. Minden példány kaphat egy opcionális, szabad szöveges **`megnevezes`** mezőt (pl. "Star Wars minifigura-csomag"), ami eltérhet a Szám (könyv/magazin) címétől; ha üres, a felület "Típus #N" sorszámozásra esik vissza (csak akkor számoz, ha ténylegesen 1-nél több példány van egy típusból — egyetlen példánynál a puszta típusnév marad, nincs vizuális változás a megszokotthoz képest).
- **UI:** a kompakt lista-sorban egyetlen példánynál minden marad a régiben (koppintásra körbeforog); 2+ példánynál a gomb egy "legrosszabb eset" jelvénnyé válik (×N jelzéssel), koppintásra a lenyíló panelt nyitja meg — ott minden példány saját kártyát kap (kép, darabszám-léptető, Megnevezés/fallback felirat), mert egyenkénti állítás csak ott értelmezhető (melyiket cserélgetné a kompakt gomb?).
- **Felvitel:** a Karbantartás draft-szerkesztőjében ÉS a "+ Új tétel" gyors-felvitelnél is van "+ Még egy [Típus] hozzáadása" — mindkét helyen tetszőleges számú példány adható egy típusból, mentés előtt szabadon törölhető/bővíthető.
- **Excel-sablon:** a "Megnevezés" mostantól saját oszlop típusonként (mind az élő sorozat sablonjában, mind a draft/javaslat sablonban) — de kizárólag az adott típus **elsődleges (első) példányára** vonatkozik; egy 2., 3. példány felvitele/elnevezése Excellel nem támogatott, csak kézzel a szerkesztőben (a sablon egy Szám = egy sor modellje ezt nem bírná el jól változó példányszám mellett).
- **Draft-folyamat:** egy meglévő, publikált Számon új példány hozzáadása vagy egy meglévő megnevezésének módosítása a szokásos draft → diff → verzió → felkiáltójel-folyamaton megy át (`publish_draft_series()` a `megnevezes` mezőt is diffeli/logolja/frissíti); nem publikált (munkaanyag) sorozatnál szabadon szerkeszthető.
- SQL: `laprol-lapra-komponens-megnevezes.sql` (oszlop), `laprol-lapra-komponens-megnevezes-rpc.sql` (`propose_bulk_issues`), `laprol-lapra-komponens-megnevezes-publish.sql` (`publish_draft_series`).

**Képkezelés [DÖNTVE, megvalósítva — v1.6]:**
- Tárolás: **Supabase Storage, KÖZÖS, publikus bucket** (`component-images`) — a megosztott katalógus elvéhez igazítva. *(Eltérés a korábbi tervtől: az eredetileg elgondolt felhasználónkénti privát mappa + aláírt URL a megosztott katalógus fényében feleslegesen bonyolult lett volna — a kép mostantól közös adat, mint a sorozat/tétel törzsadata.)* A `kep_url` állandó publikus URL, minden cserénél cache-busting query-paraméterrel frissítve.
- **Feltöltés előtti automatikus átméretezés:** kliens-oldali (`<canvas>`), hosszabbik oldal max **1200 px**, JPEG, kb. 150–250 kB/kép.
- **Staff bármikor közvetlenül feltölthet/cserélhet** képet bármelyik komponensre — ez a sorozat draft/publikálás-ciklusától **független**, azonnal az élő komponensre hat.
- **Felhasználói képjavaslat (workflow):** bármely user javasolhat cserét/új képet, de **csak** olyan komponensre, ami a saját, `member_series`-ben bepipált sorozatához tartozik. `components.upload_enabled` (alapból `false`) szabályozza, engedélyezett-e a javaslás; ha a komponensen még nincs kép, a feltöltés **automatikusan engedélyezett**, admin beavatkozása nélkül — ha már van valódi kép, staffnak explicit be kell kapcsolnia komponensenként. Egyszerre max. **egy** függő javaslat lehet egy komponensen (DB-szinten kikényszerítve, parciális unique index).
- Az admin **helyben, a lenyíló képsávban** bírálja el a javaslatot — a jelenlegi és a javasolt kép egymás mellett, Elfogad/Elutasít gombbal (nincs külön review-queue felület). **Nincs értesítés** a userek felé egyik döntés esetén sem: jóváhagyáskor a user egyszerűen látja az új képet legközelebb, elutasításkor marad a régi (vagy „nincs kép").
- Tábla: `image_proposals` (`component_id`, `proposed_by`, `status`: pending/approved/rejected, `created_at`, `decided_at`, `decided_by`). SQL: `laprol-lapra-sorozatkezeles-4-kepjavaslat.sql`.

### 5.4 Kezdő adat (az eredeti Excelből)
RBA — II. vh. repülők (60) · Centuria — Forma 1 (60) · Hachette — Disney könyvek (80).

### 5.5 Pénz-fogalmak (ár és érték) — három külön dolog **[DÖNTVE · v1.4-ben pontosítva]**
1. **Eredeti ár (referencia-ár, korábban „fedélár"):** megjelenéskori/újságos ár, az egész **számra**. **Közös törzsadat** — mindenki ugyanazt látja, csak admin/owner szerkeszti. → *v1-ben benne.* **[DÖNTVE, v1.4 átnevezés]**
2. **Fizetett ár („amit én fizettem") + beszerzési mennyiség + dátum + forrás:** **személyes**, szám-szinten (felhasználónként, `member_issue_data`). Mindenki a sajátját rögzíti. A belekerülési költség = Σ (**fizetett ár × beszerzési mennyiség**) a saját tételekre. → *v1-ben benne.* **[DÖNTVE, v1.4]**
3. **Aktuális érték (piaci / központi) + értéktörténet:** az elem *mai* értéke, időbélyeges naplóval; ülhet **számon vagy komponensen** is (a Lapról Lapra a szám-szintűt használná). → **[KÉSŐBB]** — betervezve, de nem v1.

**Származtatott statisztikák:** belekerülési költség (Σ fizetett ár × mennyiség) · jelenlegi összérték (Σ aktuális érték) · a kettő különbsége (nyereség / ráfizetés).

**Sorozat-összeg — kétféle nézet (választható) [DÖNTVE, v1.4 · v1.5-ben pontosítva]:** a hero összeg-doboza két alapon számol, kapcsolóval:
- **„Eredeti ár alapján"** (alapértelmezett): Σ eredeti ár × a **domináns komponens** aktuális darabszáma, **csak ha a domináns komponens `megvan`** (azaz a lapszám zöld — a színezéssel megegyező logika, 6.3–6.4). *(v1.5 javítás: korábban külön magazin/könyv-referenciát nézett, ami zöld lapszámot is kihagyhatott, ha épp a magazin „nem kell".)*
- **„Fizetett ár alapján":** Σ fizetett ár × beszerzési mennyiség, a saját tételekre (ahol ≥1 komponens `megvan`).
- **„+nem ismert" jelzés [DÖNTVE, v1.5]:** ha egy bevont tételnek az aktuális nézet szerinti ára NULL („nem ismert"), az kimarad a Ft-összegből, de az összeg mellé **„+nem ismert"** badge kerül.

**Megjelenítési szabály [DÖNTVE, v1.4]:** a **„fizetve X Ft"** felirat (lista) és a **„Fizetett ár alapján"** összeg **csak azt a tételt** veszi figyelembe, amelynél **legalább egy komponens `megvan`**. Ha semmi nincs megvan állapotban (hiányzik/jelöletlen), a „fizetve" nem jelenik meg és nem számít az összegbe — hiszen ténylegesen semmi nem lett megvéve.

**„Nem ismert" ár megjelenítése [DÖNTVE, v1.5]:** a NULL `eredeti_ar` / `fizetett_ar` a felületen **„nem ismert"** felirattal jelenik meg (nem üresen/kötőjellel).

**Fizetett ár — automatikus kitöltés/nullázás [DÖNTVE, v1.5]:** amikor egy tétel **először** kap ≥1 `megvan` komponenst és a felhasználónak még nincs `fizetett_ar` értéke → automatikus kitöltés: `fizetett_ar = eredeti_ar` (vagy „nem ismert", ha az is az). Ha már van értéke (auto vagy kézi), további `megvan` **nem** írja felül. Ha az **összes** `megvan`-t visszavonja, a fizetett ár visszaáll „nem ismert"-re — de **csak ha auto-kitöltésű volt**; a kézzel beírt árat megőrzi. Az auto/kézi megkülönböztetést a `member_issue_data.ar_auto` mező adja. A logika kliens-oldali (a gyors jelölés/léptetés kezelőjében).

**„Saját adatlap" — konszolidált személyes-adat panel [DÖNTVE, megvalósítva — v1.7, hibajavítási kör 1+5. pont]:** a lenyíló panelben egy **✎** ikonról bárki (nem csak staff) megnyithatja — ez leváltotta a korábbi, csak-ár-szerkesztő `price-edit.js`-t. Egy helyen kezeli: komponensenként a **Státusz** (megvan/hiány/nem kell/jelöletlen — a jelöletlenre való visszaállítás is innen megy, MINDENKINEK, nem csak staffnak), a **Darabszám**, a **Jegyzet**, az (olvasható) Azonosító, valamint szám-szinten a **Fizetett ár** (+ „nem ismert" jelölő), beszerzési mennyiség, dátum, forrás. Kizárólag a `member_status`/`member_issue_data` saját sorait írja, a törzsadatot soha. Az ár: nem-negatív egész (0 megengedett) **vagy** „nem ismert". Kézi mentés → `ar_auto=false`.

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
- **Jelöletlenre nem tér vissza koppintással.** A státusz **reset-elése a „Saját adatlap" ablakban** lehetséges — ez mindenkinek elérhető, nem staff-funkció (v1.7).
- **Jövőbeli dátumú** szám komponensei nem állíthatók (a gombok letiltva).

### 6.3 Komponens-hierarchia **[DÖNTVE · v1.9-ben kiterjesztve]**
Egy szám színét a **domináns típus(ok)** összesített állapota dönti el:
- ha van magazin + más típus → a **nem-magazin** típus(ok) dominálnak;
- ha csak egy típus van → az a domináns.

**Kettőnél több nem-magazin komponens (10.10) — LEZÁRVA, v1.9:** ha egy Számon a domináns típus(ok) összesen TÖBB példányból állnak (akár mert több nem-magazin TÍPUS van deklarálva, akár mert egy típusból több, egyedi Megnevezésű PÉLDÁNY létezik — pl. két különböző Lego-csomag), a "legrosszabb eset nyer" elv dönt: a Szám csak akkor **zöld**, ha a domináns típus(ok) MINDEN példánya `megvan`. A rangsor (legrosszabbtól a legjobbig): **hiányzik > jelöletlen > nem kell > megvan** — ez pontosan visszaadja a 6.4-es táblázatot egyetlen példány esetén, nincs viselkedésváltozás a ma megszokotthoz képest.

### 6.4 A lapszám színe **[DÖNTVE]**

| Domináns típus(ok) összesített állapota | Magazin | Lapszám színe |
|---|---|---|
| megvan (MINDEN példány) | bármi | **zöld** |
| nem kell (a legrosszabb eset ez, hiány/jelöletlen nélkül) | bármi | **szürke** |
| hiány (van legalább egy hiányzó példány) | megvan | **sárga** (részleges) |
| hiány (van legalább egy hiányzó példány) | hiány / nem kell / jelöletlen | **piros** |
| jelöletlen (a legrosszabb eset ez, hiány nélkül) | bármi | **semleges** |
| *(még nem jelent meg)* | — | **semleges** |

**Olvasata:** zöld = kész · sárga = van belőle valami, de a lényeg hiányzik · piros = kell · szürke = tudatosan kihúzva · semleges = még nem téma.

### 6.5 Darabszám-számláló (komponensenként) **[DÖNTVE]**
Egy komponensből több példány is lehet (pl. 4 magazint veszel a melléklet miatt), és a példányok sorsa **komponensenként eltérhet** (a magazinokból 1 marad, a figurákból 2).

- A számláló **komponensenként** él, alapértelmezetten **1**.
- „Megvan"-ra jelöléskor mindig **1-ről indul** — onnan emelhető.
- A darabszám a jelölő gombon látszik (ikon balra, szám jobbra), **csak ha 1-nél több** — a fő listában ez **csak kijelzés**, nincs léptető.
- A tényleges **+/− léptetés a lenyíló panelben** történik (nagyobb, kényelmesen érinthető gombok), minden komponensnél; így 1-ről is emelhető, a böngésző-nézet zsúfolása nélkül. **[v1.5: a léptetők a listából a panelbe kerültek.]**
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
- **Lista (kompakt):** egy sor / lapszám — szám, cím, **ár két külön sorban** (eredeti ár / fizetve — 5.5), jobbra **komponensenként egy-egy ikonos jelölő** (a gomb alatt rövid felirat: megvan / hiány / nem kell). Ha egy komponensből 1-nél több van, a **darabszám a gombon** jelenik meg (csak kijelzés; a léptetés a panelben — 6.5). **[DÖNTVE · v1.5]**
- **Tapadó fejléc:** a lista fölött rögzített sáv nevezi meg az oszlopokat (Magazin / Modell / Könyv) — mint Excelben a fagyasztott sor. **[DÖNTVE]**
- **Lenyíló panel:** a sor végén nyíl; lenyitva komponensenként **egy-egy azonos méretű kép** (alatta a komponens neve/kódja; ha nincs kép: „nincs adat"), **komponensenkénti +/− darabszám-léptető** (6.5), és egy **személyes ár-blokk** (eredeti ár + saját fizetett ár, **✎** ikonnal szerkeszthető — 5.5). **Alapból csukott, egyszerre csak egy nyitható**, sorozat-/szűrő-/keresésváltáskor visszazár. **[DÖNTVE · v1.5]**
- **🔧 Gyors szerkesztés eszköztár [DÖNTVE, megvalósítva — v1.7]:** vadonatúj Szám azonnali felvitele („+ Új tétel" — nincs mit védeni rajta), a listatár bővítése („☰ Listák"), és Excel-alapú tömeges import a kiválasztott, élő sorozathoz („⬇ Sablon"/„⬆ Excel" — minden nézeten elérhető, telefonon is). Egy MÁR LÉTEZŐ Szám törzsadatát (cím, dátum, ár, azonosító, komponens-típus) ez az eszköztár nem módosítja/törli közvetlenül — ahhoz mindig a Karbantartás draft/publikálás útja kell (13.5–13.8), hogy a felhasználók megkapják a felkiáltójel-jelzést. A saját (személyes) adatokat bárki bármikor, közvetlenül a **„Saját adatlap"** ✎ ikonjával szerkesztheti, draft nélkül (5.5).
- **Kép csatolása:** komponens-szinten (Supabase Storage). *(Építés alatt.)*
- **Bejelentkezés megőrzése:** tartós munkamenet, hogy telefonon ne kelljen újra belépni; élesben „kezdőképernyőhöz adás" (PWA) is szóba jön. **[DÖNTVE]**

**Nézetek és eszközök [DÖNTVE, v1.7-ben pontosítva]:** egy közös, reszponzív felület — **nincs külön „gyors nézet", és nincs vizuális eltérés** az eszközök közt. A funkciók elérhetősége szerep szerint tér el (user/staff), NEM eszköz szerint — a korábbi „Excel-sablon csak asztalin" korlátozás megszűnt (hibajavítási kör 12. pont, v1.7): staff a ⬇ Sablon/⬆ Excel gombokat telefonon is eléri, ott is meg tudja nyitni a fájl-választót (bár a fájl kitöltése/rendezése gyakorlatilag asztali munka marad).

---

## 8. Technológiai felépítés

- **Vercel:** a modul (felület) tárolása/publikálása. **[DÖNTVE]**
- **Supabase (a modul saját projektje):** adatbázis + Storage (képek) + Auth (privát bejelentkezés). **[DÖNTVE]**
- A felület **közvetlenül** a Supabase-hez fordul — nincs külön proxy. **[DÖNTVE]**
- **Privát**, **szinkron** telefon és gép közt (közös háttér). **[DÖNTVE]**
- **Felület felépítése [DÖNTVE, v1.4, bővítve v1.6/v1.7]:** natív **ES modulok**, **build-eszköz nélkül**. `index.html` (markup) + `styles.css` + `js/` mappa: `state`, `supabase`, `modal`, `permissions`, `data`, `render`, `personal`, `admin-forms`, `admin-users`, `excel`, `auth`, `main` (alap) · `my-series`, `series-proposal` (sorozat-választás/javaslás), `karbantartas`, `draft-items` (életciklus, draft-szerkesztés), `changes` (verziókövetés/felkiáltójel), `component-images`, `image-resize` (képkezelés — v1.6) · `my-data` (konszolidált „Saját adatlap", v1.7 — leváltotta a régi `price-edit`-et), `draft-excel` (sablon-alapú tömeges tétel-feltöltés draftokhoz, v1.7), `help`, `help-content` (beépített súgó, v1.7). A `supabase-js` és az `xlsx` CDN-ről, ESM-ként. (A mutálható app-állapot egy közös `state` objektumban.)
- **Jogosultság:** háromszintű szerep a `members` táblában, RLS-sel és belépéskori ellenőrzéssel — lásd 13.
- **Üzemeltetés [DÖNTVE, megvalósítva — v1.8]:**
  - **Inaktivitás elleni védelem:** a Supabase Free plan 7 nap valódi adatbázis-írás hiánya után szüneteltetne egy projektet (majdnem megtörtént élesben egyszer). Megoldás: `system_heartbeat` tábla (egysoros, RLS bekapcsolva, policy NÉLKÜL — kliens számára teljesen elérhetetlen) + `weekly-heartbeat` `pg_cron` job, ami minden vasárnap 03:17 UTC-kor egy egyszerű UPSERT-et futtat rajta. Tudatosan nincs benne Edge Function/`pg_net`/külső titok — kizárólag az inaktivitás elkerülése a cél. SQL: `laprol-lapra-heartbeat.sql`.
  - **Migrációk — közvetlen Postgres-kapcsolat:** a korábbi „Code ír egy `.sql` fájlt, a tulajdonos futtatja a Supabase SQL Editorban" munkamódszer megváltozott: a Code mostantól egy `scripts/run-migration.js` Node-scripttel (a `pg` npm-csomaggal, `scripts/` saját, gitignore-olt `node_modules`-ával — ez NEM az app buildjének/deploy-jának a része) közvetlenül futtatja a migrációkat, a Supabase Dashboard „Direct connection" connection stringjével (`db.local.js`-ben tárolva, gitignore-olt; `db.local.example.js` a minta). Minden futtatás előtt automatikus `db-backups/` JSON-pillanatkép az összes tábláról (gitignore-olt), a migráció `BEGIN`/`COMMIT`/`ROLLBACK` tranzakcióba csomagolva. **A jóváhagyási igény változatlan**: a teljes SQL-t mindig meg kell mutatni, és meg kell várni az explicit jóváhagyást, mielőtt a script lefut — ez a beszélgetés szintjén betartott szabály, nem szoftveres kényszer. Részletes dokumentáció: a projekt gyökerében lévő **`README.md`** „Migrációk" szakasza (ez az elsődleges hely erre, nem a specifikáció).

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
   Jelenleg: **egy közös Supabase-projekt**, felhasználónként szétválasztott személyes adattal (RLS), közös törzsadattal és közös, publikus Storage bucket-tel a képeknek (5.3, v1.6 — nem felhasználónkénti mappa, ahogy korábban itt szerepelt). Alternatíva: **felhasználónként saját Supabase-projekt**.
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
10. **Kettőnél több nem-magazin komponens** esetén a hierarchia pontosítása — **[LEZÁRVA, megvalósítva — v1.9]**, lásd 5.3/6.3.
11. **További „nagy kép" szempontok**, ha felmerülnek.
12. **Excel-import összehangolása a draft/pool-folyamattal — [LEZÁRVA, megvalósítva]** A döntés (publikált sorozatra irányuló import, MEGLÉVŐ tételek módosítása → szerkesztési draftba, szokásos publikálás-folyamattal; ÚJ tétel/komponens → közvetlen írás, nincs mit védeni) átvezetve a kódba (`js/excel.js`). Mellékesen javítva egy dormant hiba: a komponens-státusz korábban a holt `components.status` oszlopba íródott a személyes `member_status` helyett.

---

## 11. Állapot most (építés) **[TÖRTÉNETI — a korai (5a/5b) építési fázis pillanatképe, azóta minden pontja lezárult]**

*Ez a fejezet a projekt legkorábbi, „még csak épül" állapotát rögzíti — ma már minden itt felsorolt pont kész (Karbantartás, képkezelés, publikálás GitHub+Vercelre), sőt jóval továbbfejlődött (13. fejezet, hibajavítási körök). Változatlanul hagyva, mint történeti jegyzet.*

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

**Technikai megvalósítás:** RLS a `members`-en; a szerep-ellenőrzés **`SECURITY DEFINER` segédfüggvényekkel** (`my_role` / `is_staff` / `is_active`) az RLS-rekurzió elkerülésére; **oszlop-védő `BEFORE UPDATE` trigger** (tulajdonos-sor sérthetetlen, role-t csak owner, admin csak `status`). A törzstáblák (`series/issues/components/lists`) írás-policy-je **„staff + aktív"**. Felhasználó-kezelő felület: **önálló „👥" fejléc-gomb** a 🔧 mellett (staff-only, saját ablakban — v1.5). Az import-funkciók (mindkettő) csak PC/laptop/tablet nézetben (`desktop-only`). SQL: `laprol-lapra-jogosultsag-1-members.sql` (+ `-2-ar-modell`, `-3-display-name`).

### 13.2 Fiókkezelés **[részben DÖNTVE — letiltás kész; törlés NYITOTT]**
- **Letiltás/visszaengedés:** ✅ **megvalósítva** (13.1) — visszafordítható, RLS-szinten és belépéskor is kikényszerítve; admin a sima usereket, a tulajdonos az adminokat is.
- **Valódi fióktörlés** (adminisztrátori és saját): továbbra is **[NYITOTT]**. A törléshez a titkos `service_role` kulcs kell (Supabase **Edge Function**), ami sosem kerülhet a böngészőbe. Egy közös, később megépítendő Edge Function oldaná meg. Ha „törlés" merül fel felhasználóra, addig **letiltás** a helyes válasz.

### 13.3 Felhasználói sorozat-választás **[DÖNTVE, megvalósítva — v1.6]**
A user a publikált sorozatok közül aktívan **kiválasztja**, melyiket akarja a saját fülsávjában látni — a fülsáv mostantól kizárólag a `member_series.is_selected=true` sorokból épül, NEM az összes publikált sorozatból. Ez minden bejelentkezett usernek elérhető, staffnak is (**📚 Sorozataim** fejléc-gomb).

Tábla: `member_series` (`user_id`, `series_id`, `is_selected`, `selected_at`, `deselected_at`). Leválasztáskor (checkbox kikapcsolása) a UI megkérdezi: „Megtartod vagy törlöd a hozzá tartozó saját adataidat (jelölések, árak)?" — törlés esetén a `member_status`/`member_issue_data` sorok törlődnek erre a sorozatra nézve; megtartás esetén érintetlenek maradnak, csak a fülsávban nem látszanak, amíg újra be nem választja. Újra-kiválasztáskor a `member_series` sor frissül (nem új sor jön létre) és a `member_seen` baseline újraszeeddelődik (lásd 13.6).

**A korábban tervezett 5×-ös törlési limit ELVETVE [DÖNTVE, v1.6 pontosítás]:** a leválasztás/újra-választás korlátlan — eleve adott, melyik felhasználó melyik sorozatot használja és honnan, ez nem terheli a rendszert, a limit feleslegesnek bizonyult.

Egy sorozatból csak egy aktív választás lehet (a `member_series` elsődleges kulcsa `user_id, series_id`). Publikálatlan sorozatot csak az választhat, akinek már volt rajta saját sora (grandfather-hozzáférés) — új user nem választhatja.

Új sorozat létrehozásakor a létrehozó automatikusan bekerül a saját fülsávjába, hogy ne tűnjön el rögtön a szeme elől.

### 13.4 Üzenetküldés az adminisztrátornak **[NYITOTT, koncepció]**
Alapötlet: a nem-tulajdonos felhasználó rövid üzenetet küldhessen a tulajdonosnak.
- **Max. 150 karakter.**
- Az adminisztrátornál megjelenik: **ki küldte** + **az üzenet szövege**.
- A részletek (hol jelenik meg az adminnak, olvasottság-jelzés, válaszolhat-e, értesítés-e vagy csak belépéskor látható lista) **külön átbeszélendő**, mielőtt tervezünk rá adatmodellt.

### 13.5 Sorozat-életciklus és Karbantartás **[DÖNTVE, megvalósítva — v1.6]**
A sorozat/szám/komponens törzsadata egy és ugyanaz mindenki számára — nincs userenkénti másolat. A törzsadat módosítása admin/owner kizárólagos joga, de **soha nem írja felül automatikusan/észrevétlenül a user saját adatait** — helyette jelez (13.6), a user pedig tudatosan nyugtázza.

Egy sorozat mindig pontosan egy állapotban van:
1. **Beérkezett** (lock nélküli, bárki claim-elheti)
2. **Munkaanyag / foglalva** (lock-olva egy adott admin/owner-nél)
3. **Publikálásra váró**
4. **Aktív / publikált**
5. **Publikálatlan** (korábban publikált volt, admin levette; grandfather-userek megtartják a hozzáférést — 13.3)

Beérkezett + Munkaanyag/foglalva együtt max. **20 tétel** lehet (globális limit, DB-triggerrel kikényszerítve; Publikálásra váró és Publikálatlan nem számít bele). A pool kétféle eredetű tételt tartalmaz: **„Új javaslat"** (user vagy admin/owner nyújt be egy teljesen új sorozatot sablonnal — ez az egyetlen út, ahogy új sorozat a rendszerbe kerülhet, admin/owner sem hozhat létre közvetlenül publikált sorozatot) és **„Szerkesztés"** (admin/owner egy már élő, publikált sorozaton indít módosítást — ez azonnal draftot hoz létre és claim-eli az indítónál, az élő verzió eközben zavartalanul elérhető marad mindenkinek).

Állapotátmenetek: Beérkezett → **claim** → Munkaanyag; Munkaanyag → **kész** → Publikálásra váró; Munkaanyag → **elenged** → vissza Beérkezettbe (a munkával együtt); Beérkezett → beküldő törölheti sajátját, vagy staff bárkiét; Publikálásra váró → **publikálás** → Aktív (13.6); Aktív → **publikálatlanná tétel** → Publikálatlan; Publikálatlan → **újra publikálás** (direkt) VAGY **force-törlés** (13.7, owner-only).

**Karbantartás** — új, önálló, staff-only menüpont (🗂️ fejléc-gomb), három füllel:
1. **Aktív sorozatok** — publikált sorozatok, aktív-felhasználó számláló, „Szerkesztés indítása" (draftot hoz létre), „Publikálatlanná tétel".
2. **Munka sorozatok** — a pool, három alcsoportban (Beérkezett / Munkaanyag-foglalva / Publikálásra váró), eredet-típussal és beküldő/claim-elő névvel.
3. **Publikálatlan** — grandfather-userek száma, „Újra publikálás", owner-nek törlés-indítás/végleges törlés (13.7).

SQL: `laprol-lapra-sorozatkezeles-2-eletciklus.sql`.

### 13.6 Draft-mechanizmus, verziókövetés és felkiáltójel-jelzés **[DÖNTVE, megvalósítva — v1.6]**
**Draft-tárolás:** külön `draft_series`/`draft_issues`/`draft_components` táblák (nem a `series/issues/components` sémán belüli flag), saját (ideiglenes) UUID-kkel, `source_series_id`/`source_issue_id`/`source_component_id` mezővel az élő párra mutatva (nullable — null = új tétel a draft-on belül). A draft csak **törzsadat-mezőket** hordoz, személyes réteg nincs rajta (publikálás előtt még senkinek nincs saját adata az új/módosuló tételen).

**Kritikus szabály:** publikáláskor az élő Szám/Komponens sorok UUID-je **fix marad** — a publikálás mező-szinten frissíti (UPDATE) az élő sorokat, sorhoz-sort párosítva a draft `source_*_id` mezője alapján. Ha a draft-ban új tétel szerepel (nincs élő párja), az új, valódi UUID-t kap. Ez azért létfontosságú, mert a `member_status`/`member_issue_data` a komponens/szám UUID-jára hivatkozik.

**Publikálás** (`publish_draft_series(uuid)` SQL-függvény, EGY tranzakcióban):
1. Mezőnként összehasonlítja a draftot az élő verzióval.
2. Minden változott mezőről bejegyzés kerül a `change_log` táblába (`entity_type`: series/issue/component, `entity_id`, `field_name`, `old_value`, `new_value`, `version`, `changed_at`, `is_current` — ha egy mező többször változott, minden bejegyzés megmarad, csak az aktuális van megjelölve).
3. Az érintett entitás (`series`/`issues`/`components` — mindháromnak van `version` oszlopa) verziószáma eggyel nő.
4. Az élő sorok frissülnek a draft tartalmával; a draft törlődik.
5. Új tétel/komponens (nincs élő párja) új UUID-vel, `version=1`, diff/change_log nélkül kerül be (senkinek nincs még adata rajta).
6. Első alkalommal publikált sorozatnál (Új javaslat típus) nincs diff, nincs értesítés.

**„Utoljára látott verzió"** (`member_seen`: `user_id`, `entity_type`, `entity_id`, `last_seen_version`) — userenkénti, entitásonkénti nyilvántartás. **Baseline-probléma és megoldása:** ha valaki most választ be egy sorozatot, aminek tételei már magasabb verziónál tartanak, hamis „változott!" jelzést kapna, ha a baseline hiányozna. Ezért kiválasztáskor/újra-kiválasztáskor a `seed_member_seen(series_id)` SQL-függvény feltölti a `member_seen` sorokat a sorozat MINDEN tételére a JELENLEGI verzióra.

**Felkiáltójel-jelzés, három helyen + egy gyűjtő nézet:**
1. **Fülsáv** — a sorozat fülének sarkán, ha a sorozaton BÁRMI változott (sorozat-szintű mező VAGY bármelyik szám/komponens).
2. **Hero** — ha a SOROZAT saját mezői változtak; kattintva mezőnkénti „régi érték → új érték" popup, OK nyugtázza (`member_seen` frissül a sorozatra), Mégse-re megmarad.
3. **Tétel sorszáma mellett** — ha a SZÁM vagy annak komponense változott; ugyanaz az OK/Mégse logika, OK egyszerre nyugtázza a számot és minden komponensét.
4. **Gyűjtött elfogadás** — a szűrő-sorban egy önálló „!" gomb: legörgethető lista MINDEN változásról a sorozaton belül, egy gombnyomással (`seed_member_seen`) mind elfogadható.

A jelzés mindenhol megjelenik, függetlenül attól, van-e a usernek saját adata az adott tételen — nincs szűrés eszerint.

**Mellékes javítás (v1.6):** a sorozat-kód számláló a publikálás szerver-oldalra költözésével **globálissá** vált (`global_counters` + `next_series_no()`) — a korábbi, felhasználónkénti számláló (`counters` tábla) ütköző kódokat adhatott volna ki két staff-tag egyidejű publikálásánál; a régi tábla érintetlenül, holtan megmaradt.

SQL: `laprol-lapra-sorozatkezeles-3-verziokoves.sql`.

### 13.7 Force-törlés **[DÖNTVE, megvalósítva — v1.6]**
Végleges törlés csak **publikálatlan** sorozatra, kizárólag **owner** jogosultsággal (`start_force_delete`/`finalize_delete_series` SQL-függvények, owner-ellenőrzéssel a függvényen belül — a `series` táblán nincs is kliens-DELETE RLS-policy, kizárólag ezeken a függvényeken át törölhető).

- **0 aktív `member_series.is_selected=true` sor** → azonnali törlés, egyszerű megerősítéssel.
- **Van még aktív kiválasztás** → owner elindítja a törlést (`force_delete_requested_at`/`_by`/`_grace_end` mezők, +14 nap): a türelmi idő alatt a sorozat nem választható be újonnan, nem szerkeszthető (DB-trigger blokkolja a draft-claim-et és a publikálást is, nemcsak a UI), és az érintett, még kiválasztó userek **minden belépéskor kötelezően nyugtázandó** felugró ablakot kapnak (háttérre kattintva nem zárható, csak a saját OK gombjával — csak az adott munkamenetre tűnik el).
- **Védőháló:** ha valahogy mégis módosítás történne a türelmi idő alatt (elvileg blokkolva, de a `publish_draft_series` is újraellenőrzi), a force-törlési jelzők nullázódnak — a folyamatot újra kellene indítani.
- 14 nap letelte előtt owner sem hajthatja végre a törlést; utána a sorozat nevének pontos begépelésével véglegesítheti — ekkor törlődik a sorozat és minden hozzá kapcsolódó, még meglévő felhasználói adat (`member_status`, `member_issue_data`, `member_series`, `member_seen`, `change_log`, esetleges elakadt draft) is.

SQL: `laprol-lapra-sorozatkezeles-5-force-torles.sql`.

### 13.8 Hibajavítási kör kiegészítései a draft-rendszerhez **[DÖNTVE, megvalósítva — v1.7]**
A 15-pontos hibajavítási kör (élő tesztelésből) három érdemi bővítést hozott a 13.5–13.7-ben leírt draft/publikálás-architektúrára:

**Szám-törlés (soft-delete) [1+5. pont].** A staff-only „Tétel szerkesztése" gyors-panel megszűnt (lásd 5.5, 7. fejezet) — egy MÁR ÉLŐ Szám törzsadatát innentől kizárólag a Karbantartás draft-szerkesztője módosíthatja/törölheti. A törlés NEM fizikai `DELETE`: az élő `issues.is_deleted` mezőt a draft `deleted` jelzője a szokásos diff/verzió/`change_log` gépezeten át `false→true`-ra állítja publikáláskor — ez azért kritikus, hogy a felkiáltójel/gyűjtött-elfogadás felület a törlés UTÁN is tudjon róla értesíteni (azok a nézetek csak a MÉG LÉTEZŐ sorokon iterálnak). A felhasználó a törölt Számot áthúzva, „Ez a szám törölve lett a sorozatból." üzenettel látja, amíg nem nyugtázza; nyugtázáskor a saját (`member_status`/`member_issue_data`) adatai arról a Számról törlődnek. A `stats()`/`renderChips()` a törölt Számokat kihagyja a haladás-számításból.

**Komponens-típus utólagos átsorolása [14. pont].** Ha egy komponens korábban pl. „Egyéb"-ként lett felvéve, mert a pontos típus még nem létezett a listatárban, a draft-szerkesztőben (egy már létező komponensnél) egy típus-választó legördülő engedi átsorolni a listatár aktuális típusaira — egyedi, komponensenkénti korrekció, a szokásos publikálás/felkiáltójel-mechanizmuson át. Ütközésvédelem: két komponens egy Számon nem sorolható ugyanarra a típusra. Ha az új típus még nincs a sorozat komponens-készletén, automatikusan felkerül oda (különben az élő felület sehol nem jelenítené meg — minden nézet a sorozat deklarált komponens-listáján iterál).

**Sablon-alapú tömeges tétel-feltöltés draftokhoz [11. pont].** Eddig csak egyesével lehetett Számot felvinni egy draftba. Új, közös modul (`draft-excel.js`) ad sablon letöltést/feltöltést két helyen: (a) az „Új sorozat javaslása" beküldés utáni köztes lépésében, (b) a Karbantartás draft-szerkesztőjében (mindkét draft-típusnál). Technikai részlet: a `draft_issues`/`draft_components` RLS-e staff-only, ezért a javaslat-beküldő saját, MÉG FEL NEM VETT javaslatához egy külön, szűk jogosultság-ellenőrzésű SQL-függvény (`propose_bulk_issues`) enged tömeges beszúrást — csak a beküldőnek, csak staff-i átvétel előtt. Ütköző (már létező) lapszámokat a feltöltés kihagyja, nem ír felül.

SQL-ek: `laprol-lapra-hibajavitas-1-5-szam-torles-sajat-adatlap.sql`, `-14-komponens-atsorolas.sql`, `-11-sablon-tomeges-feltoltes.sql`.

### 13.9 Beépített súgó **[DÖNTVE, megvalósítva — v1.7]**
❓ fejléc-gomb, mindenkinek elérhető, permission-gated tartalommal: „Felhasználói" fül (mindenki) + „Adminisztrátori" fül (csak staffnak látszik). 17 kategória, kérdés-válasz formában (`js/help-content.js`), a TÉNYLEGES felület/kód alapján írva (nem a specifikáció tervezési nyelvén) — gombfeliratok, ikonok, folyamat-lépések az élő appból. Terminológia egységesítve: a gyűjthető egység mindig „Szám" (hibajavítási kör 3. pont).

---

*Napló:*
- v1.9 — **Komponens-szintű "Megnevezés" + több azonos típusú komponens egy Számon** (5.3, 6.3/6.4, 10.10 lezárva): opcionális, szabad szöveges `megnevezes` mező minden komponensen ("Típus #N" fallback, ha üres); egy típusból mostantól tetszőleges számú, egyedi példány felvehető egy Számon (pl. két Lego-csomag) — a `+ Még egy X hozzáadása` a Karbantartás draft-szerkesztőjében és a "+ Új tétel" gyors-felvitelnél is elérhető. Színezés kiterjesztve: "legrosszabb eset nyer" a domináns típus(ok) ÖSSZES példányára (nem csak egyre), 1 példánynál nincs viselkedésváltozás. Excel-sablon (mindkét helyen) új "megnevezés" oszlopot kapott típusonként, kizárólag az elsődleges példányra. Draft-folyamat: `publish_draft_series()` és `propose_bulk_issues()` is frissítve, a `megnevezes` a szokásos diff/verzió/change_log-gépezeten megy át. SQL: `laprol-lapra-komponens-megnevezes.sql`, `-rpc.sql`, `-publish.sql`. *(Mellékesen javítva: a Karbantartásban egy "Új javaslat" sehol nem mutatta a sorozat nevét — a `karbantartas.js` három helyen kézzel írt felirata `pool_type==="new"`-nál kihagyta a nevet; nem RLS/JOIN-hiba volt, tisztán megjelenítési hiba, javítva.)*
- v1.8 — **Üzemeltetési kiegészítések** (8. fejezet): (1) **Supabase inaktivitás elleni védelem** — heti `pg_cron` „heartbeat" (`system_heartbeat` tábla, RLS-sel, policy nélkül; `weekly-heartbeat` job), hogy a Free plan sose szüneteltesse a projektet 7 nap inaktivitás miatt. (2) **Migrációk munkamódszere megváltozott**: a Code mostantól közvetlen Postgres-kapcsolattal (`scripts/run-migration.js`, `pg` npm-csomag, gitignore-olt `db.local.js` connection stringgel) maga futtatja a migrációkat, automatikus `db-backups/` pillanatképpel és tranzakciós (`BEGIN`/`COMMIT`/`ROLLBACK`) végrehajtással — a korábbi „a tulajdonos futtatja a Supabase SQL Editorban" helyett. A jóváhagyási igény (teljes SQL megmutatása + explicit jóváhagyás előbb) változatlan. Élesben tesztelve mindkettő (kapcsolódás, 17-táblás backup, idempotens migráció újrafuttatása, cron job aktív állapota). Új projekt-belépő dokumentum: **`README.md`** (tech stack, mappaszerkezet, munkamódszer — a migrációs munkamódszer részletei elsődlegesen ott, nem itt). SQL: `laprol-lapra-heartbeat.sql`.
- v1.7 — **Hibajavítási kör** (élő tesztelésből, 15 pont, `claude-code-4-lepes-hibajavitasok.md`), teljesen lezárva: mobil UI/CSS finomítások (chips-görgetősáv, felkiáltójel-badge pozíció, fejléc-gomb sorrend/hangsúly, kép-placeholder méret); terminológia-egységesítés („Szám" mindenütt); egységes, kézzel írt inline SVG-ikonrendszer (a natív emoji platformfüggő megjelenése helyett); force-törlés korai lezárása (ha a türelmi idő alatt 0-ra csökken az aktív kiválasztás); **a staff-only „Tétel szerkesztése" gyors-panel megszűnt**, helyette mindenkinek elérhető **„Saját adatlap"** (5.5) + a Karbantartás draft-útja minden törzsadat-módosításra, Szám-törlés **soft-delete-tel** (13.8); komponens-típus utólagos átsorolása (13.8); **sablon-alapú tömeges tétel-feltöltés** draftokhoz, két helyen (13.8); a meglévő, élő sorozatokhoz tartozó Excel-sablon gombok mostantól minden nézeten (mobilon is) elérhetők, a „+ Új tétel"/„☰ Listák" gombokkal egy sorban; a 🗂️ Karbantartás és 📚 Sorozataim fejléc-gomb helyet cserélt; **beépített súgó** (13.9). Mellékesen javítva egy önálló, a kör közben talált RLS-hiba: a javaslat-beküldés (`draft_series` insert) egy `.select()`-es visszaolvasás miatt minden nem-staff felhasználónál elbukott (a SELECT-szabály staff-only, Postgres az `INSERT...RETURNING` kimenetét is átengedi rajta) — javítva kliens-oldali id-generálással, RLS-módosítás nélkül. Az Excel-import/draft-pool összehangolása (10. fejezet 12. pontja, korábban „döntve, de nem építve") ezzel a körrel egy időben szintén lezárva.
- v1.6 — **Sorozatkezelés teljes újratervezése és megvalósítása** (5 lépésben): **(1)** kiválasztás rétege — `member_series`, „📚 Sorozataim" választó, a fülsáv innentől csak a saját bepipált sorozatokból épül (13.3, az 5×-ös törlési limit később elvetve). **(2)** sorozat-életciklus állapotgép (Beérkezett/Munkaanyag/Publikálásra váró/Aktív/Publikálatlan) + „🗂️ Karbantartás" staff-only menüpont, `draft_series` pool — a régi közvetlen „+ Új sorozat"/„✎ Sorozat" gombok megszűntek, minden sorozat-törzsadat-módosítás a pool-on megy át (13.5). **(3)** `draft_issues`/`draft_components` — a szerkesztés-indítás a teljes élő adatot átmásolja a draftba; `publish_draft_series()` SQL-függvény egy tranzakcióban diffel/verzióz/frissít; felkiáltójel-mechanizmus (`change_log`, `member_seen`) négy helyen (13.6). Mellékesen javítva: a sorozat-kód számláló globálissá vált. **(4)** teljes képkezelés-csővezeték a semmiből: közös, publikus Storage bucket, kliens-oldali átméretezés, staff közvetlen feltöltés, user-javaslat workflow helyi (nem külön queue) elbírálással (5.3). **(5)** force-törlés — owner-only, 0 aktív kiválasztásnál azonnali, egyébként 14 napos türelmi idővel, kétszintű védőhálóval (13.7); mellékesen lezárva egy talált RLS-rés (a `series` tábla eddig staffnak közvetlen törlést is engedett volna). SQL-ek: `laprol-lapra-sorozatkezeles-1` … `-6` (az utolsó a törlési limit utólagos elvetése).
- v1.5 — **UX-csomag:** a „Felhasználók" önálló 👥 fejléc-gomb lett (a 🔧 eszköztárból kivéve, staff-only); kilépéskor a sorozat-accent visszaáll semlegesre; nagyobb fejléc-ikonok és „összeg" gomb; a lista „eredeti ár / fizetve" **két külön sorban**; a **+/− léptetők a listából a lenyíló panelbe** kerültek (nagyobb gombok). **Ár-logika:** **„nem ismert"** felirat a NULL árakra; **automatikus fizetett-ár** kitöltés (első `megvan`-ná váláskor `fizetett_ar = eredeti_ar`) és nullázás (minden `megvan` visszavonásakor — a kézi árat `ar_auto` jelző őrzi); **személyes ár-szerkesztő MINDENKINEK** a panel ✎ ikonjáról (csak `member_issue_data`); az **„Eredeti ár alapján"** szorzó a **domináns** komponens (a színezéssel egyezően), nem magazin/könyv; **„+nem ismert" badge** a NULL-áras bevont tételekre. SQL: `laprol-lapra-ar-auto.sql` (ar_auto oszlop). Fix: a panel-léptető szelektora (`.pstepbtn`).
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
