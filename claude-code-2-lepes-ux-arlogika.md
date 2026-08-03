Folytatás a Lapról Lapra projekten. Két csomagot kérek egyben — előbb olvasd
el a mappában lévő legfrissebb specifikációt és állapot-összefoglalót, aztán
foglald össze a kérdéseidet EGYBEN, mielőtt kódolnál (ahogy eddig is).

====================================================================
A) MAI UX-HIBALISTA (éles tesztelésből)
====================================================================

1. Felhasználó-kezelés: jelenleg a karbantartó (🔧) eszköztár egyik gombja
   — legyen helyette ÖNÁLLÓ ikongomb a fejlécben, közvetlenül a 🔧 mellett
   (csak staff — admin/owner — látja), saját ablakban nyílva.

2. Kilépéskor a bejelentkező képernyő megtartja az utoljára nézett sorozat
   accent-színét (a --accent CSS-változó nem áll vissza). Javítás: kilépés-
   kor/gate megjelenítésekor állítsd vissza egy semleges alapszínre.

3. Fejléc ikongombok mérete (👥/🔧/⎋): jelenleg 38×34px → NÖVELD 46×44px-re.
   Az "összeg megjelenítése"/"elrejt" gomb: jelenleg ~28px magas → NÖVELD
   ~40px magasra, arányosan nagyobb belső térközzel és betűmérettel.

4. Telefonon az "eredeti ár · fizetve" sor egy hosszú sorba próbál férni és
   törik/zsúfolt. Bontsd KÉT KÜLÖN SORRA: "eredeti ár X Ft" egy sorban,
   "fizetve Y Ft" alatta egy másikban.

5. A +/− darabszám-léptető gombok jelenleg a fő listasorban vannak, túl
   kicsik, nem akarjuk növelni (zsúfolt lenne). ÚJ IRÁNY: a +/− gombok
   TŰNJENEK EL a fő listából — ott csak a darabszám KIJELZÉSE maradjon
   (a komponens ikonján, mint eddig). A tényleges +/− állítás KIZÁRÓLAG
   a lenyíló képpanelbe kerüljön, ahol elég hely van nagyobb, kényelmesen
   érinthető gomboknak.

====================================================================
B) ÁR-LOGIKA — TELJES, TISZTÁZOTT MUNKAFOLYAMAT
====================================================================

Ez a "sorozat létrehozás → jóváhagyás → felhasználói beszerzés" teljes
ár-vonatkozású folyamata. A user-oldali sorozat-választás (13.3 a
specifikációban) még nincs megépítve, ezért ennek egy részét csak
staff-fiókokkal tudjuk most tesztelni — ezt vedd figyelembe.

## B1. Eredeti ár — a sorozat/tétel jóváhagyásakor
- Admin/owner tölti ki (közvetlen létrehozáskor, vagy user-sablon
  jóváhagyásakor, azt javítva/kiegészítve).
- Ha üresen marad: az érték "nem ismert" (adatbázisban NULL — ez már
  eddig is így volt, csak a MEGJELENÍTÉS változik: NULL helyett a
  felületen "nem ismert" felirat jelenjen meg, ne üres/kötőjel).

## B2. Fizetett ár — automatikus kitöltés szabálya (ÚJ LOGIKA)
- Amikor egy adott tételnél ELŐSZÖR válik igazzá, hogy legalább egy
  komponens status='megvan' (előtte egy sem volt az), ÉS a felhasználónak
  MÉG NINCS member_issue_data sora ehhez a tételhez:
  → automatikusan létrejön egy member_issue_data sor, fizetett_ar =
    az adott tétel eredeti_ar értéke (vagy NULL, ha az eredeti_ar is NULL
    — tehát "nem ismert" öröklődik).
- CSAK ELSŐ ALKALOMMAL tölt: ha a felhasználónak MÁR VAN saját fizetett_ar
  értéke (akár auto-kitöltött korábban, akár kézzel módosított), egy
  további komponens megvan-ra jelölése NEM írja felül azt.
- Ha a felhasználó az ÖSSZES komponenst visszavonja "megvan"-ból (egy
  sincs többé megvan állapotban ennél a tételnél), a fizetett_ar
  VISSZAÁLL "nem ismert"-re (NULL) — töröld/nullázd a member_issue_data
  sort (vagy a fizetett_ar mezőt benne).

## B3. Fizetett ár kézi szerkesztése — ÚJ FELÜLET KELL, MINDENKINEK
- Jelenleg NINCS olyan felület, ahol egy plain USER (nem staff) a saját
  fizetett árát módosíthatná — csak a staff-only tétel-szerkesztő létezik.
- Kell egy KÖNNYŰ, MINDENKI SZÁMÁRA elérhető szerkesztési lehetőség a
  saját fizetett_ar (+ beszerzési mennyiség, dátum, forrás) mezőkhöz —
  pl. a lenyíló képpanelben, az árak mellett egy kis szerkesztés-ikonnal.
  Ez NEM nyithatja meg a staff tétel-szerkesztőt (törzsadat marad
  védett), csak a member_issue_data saját sorát.
- Az ár mező szabálya: nem-negatív egész szám (0 megengedett), VAGY
  "nem ismert" — a "nem ismert" innen állítható át konkrét Ft-értékre.

## B4. Összesítések — "+nem ismert" jelzés ÉS a régi szorzó-hiba javítása
Emlékeztető a korábban már jelzett, még nem javított hibára: az "Eredeti
ár alapján" összesítés jelenleg mindig a magazin (vagy könyv) komponens
darabszámát használja szorzóként — FÜGGETLENÜL attól, hogy a lapszám-
színezés (6.3-6.4 a specifikációban) a DOMINÁNS komponenst nézi. Ez
ellentmondást okoz: egy zöld (kész) lapszám kimaradhat az összegből, ha
épp a magazin "nem kell".

JAVÍTSD EGYSZERRE mindkettőt:
- Az összesítés szorzója legyen a DOMINÁNS komponens (issueState-hez
  hasonló logika), NE külön magazin/könyv-eset.
- Ha az összesítésbe bevont tételek közül BÁRMELYIKNEK az ára (eredeti_ar
  VAGY a felhasználó fizetett_ar-ja, attól függően melyik nézetben
  vagyunk) "nem ismert" (NULL), az érintett tétel kimarad a számított
  Ft-összegből, DE az összeg mellé kerüljön egy "+nem ismert" felirat/
  badge, jelezve hogy van kihagyott tétel.

====================================================================
MUNKASTÍLUS
====================================================================
- Előbb kérdések egyben, utána kód — ha bármi nem világos a fentiekből.
- Kis, tesztelhető lépések: először az A) UX-csomag, aztán a B) ár-logika
  — külön commit/push, hogy köztük tesztelhessek.
- SQL-migrációt (ha kell a member_issue_data auto-fill/nullázás miatt,
  vagy trigger formájában oldod meg) külön, futtatható fájlként add.
- Miután mindkettő élesben ellenőrizve van, jelezd — a spec frissítését
  (v1.5) csak az én megerősítésem után indítsd.
