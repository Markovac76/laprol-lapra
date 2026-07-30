Projekt: Lapról Lapra — a Collector app / OM Curator platform első modulja.
Sima HTML + JavaScript (ES modul), közvetlen Supabase-kapcsolat, build-eszköz nélkül.
Éles: laprol-lapra.vercel.app, GitHub: Markovac76/laprol-lapra (privát).

ELŐBB OLVASD EL a mappában lévő két dokumentumot, mielőtt bármit csinálsz:
- allapot-osszefoglalo.md — teljes projekt-állapot, munkafolyamat, fájlszerkezet
- laprol-lapra-specifikacio.md — a részletes specifikáció (jelenleg v1.3)

====================================================================
MOST ESEDÉKES FELADAT (a build-terv 1. lépése): HÁROMSZINTŰ JOGOSULTSÁG
====================================================================

Ezt a chat-ben részletesen kidolgoztuk — az alábbi a végleges terv,
kérlek eszerint építsd meg.

## Szerepkörök: user / admin / owner (tulajdonos)

A tulajdonos UID-je (én vagyok, ezt ne engedd módosítani senkinek, még
adminnak sem): lásd allapot-osszefoglalo.md, "Felhasználó UID" sor.

## Jogosultsági mátrix (TELJES, a mai pontosításokkal együtt)

| Funkció                                                    | user | admin | owner |
|-------------------------------------------------------------|:----:|:-----:|:-----:|
| Saját jelölés (megvan/hiányzik/nem kell, db)                 |  ✅  |  ✅   |  ✅   |
| Sorozat kiválasztása/törlése (max 5×, később épül)           |  ✅  |  ✅   |  ✅   |
| Üzenetküldés adminnak (később épül)                          |  ✅  |  —    |  —    |
| Excel-import MEGLÉVŐ, kiválasztott sorozathoz — CSAK saját jelölés (státusz/db), törzsadat NEM módosítható | ✅ | ✅ | ✅ |
| Excel-import ÚJ sorozat-igényléshez — teljes adatlap, de JÓVÁHAGYÁSRA VÁR | ✅ (jóváhagyás kell) | ✅ (automatikusan jóváhagyva) | ✅ |
| Sorozat/tétel KÖZVETLEN létrehozása/szerkesztése (jóváhagyás nélkül) | ❌ | ✅ | ✅ |
| Listák bővítése (☰ Listák)                                   |  ❌  |  ✅   |  ✅   |
| Felhasználói sablon-jóváhagyás (később épül)                 |  ❌  |  ✅   |  ✅   |
| Sima "user" letiltása/visszaengedése                         |  ❌  |  ✅   |  ✅   |
| Admin szerepkör kiosztása/visszavonása                       |  ❌  |  ❌   | ✅ (csak ő) |
| Admin letiltása                                              |  ❌  |  ❌   | ✅ (csak ő) |
| Az alkalmazás (kód) módosítása                               |  ❌  |  ❌   |  ✅   |

Fontos szabályok:
- Admin NEM tud másik admint vagy a tulajdonost letiltani/módosítani —
  csak sima "user" szerepkörű fiókokat kezelhet.
- Csak a tulajdonos oszthat ki vagy vonhat vissza admin jogot.
- A tulajdonost SENKI nem tudja letiltani/lefokozni/felülírni.

## Letiltás vs. törlés — MOST CSAK A LETILTÁS ÉPÜL MEG

- Letiltás: visszafordítható, nem igényel admin API-t — egy állapot-mező
  elég hozzá, az RLS-szabályok mindenhol ellenőrzik.
- Valódi fiók-törlés (admin API, Supabase Edge Function): TUDATOSAN NEM
  most épül — ez egy külön, későbbi lépés (a build-terv 7. pontja).
  Ha bármelyik funkciónál "törlés" merülne fel felhasználóra vonatkozóan,
  kérdezz vissza — ott valószínűleg letiltást szeretnénk.

## Adatmodell — jogosultság

Új tábla: `members`
- `user_id` (uuid, references auth.users, primary key vagy unique)
- `role` (text: 'user' | 'admin' | 'owner')
- `status` (text: 'active' | 'disabled')
- `display_name` (text, opcionális)
- `created_at` (timestamptz, default now())

RLS-terv (pontosítsd/egészítsd ki, de tartsd ezt az elvet): mindenki
lekérdezheti a saját sorát; a tulajdonos bármelyik sort módosíthatja;
admin csak 'user' role-ú sorokat módosíthatja (status mezőt); senki nem
módosíthatja a saját role-ját.

Regisztráció után: automatikusan `role='user'`, `status='active'` sor jön
létre (nincs admin-jóváhagyásos várakozás a REGISZTRÁCIÓNÁL — a jóváhagyás
csak az ÚJ SOROZAT igénylésnél kell, lásd lent).

Meglévő tulajdonosi fiók kapjon egy `members` sort `role='owner'`,
`status='active'` értékkel (visszatöltés / seed SQL-ként).

====================================================================
ÁR-FOGALMAK ÚJRARENDEZÉSE (ma pontosítva, ÉRINTI A member_status-t)
====================================================================

Eddig "fedélár" néven szerepelt egy mező — ÁTNEVEZENDŐ "Eredeti ár"-ra,
és tisztázni kell a személyes/közös felosztást:

## Törzsadat (a számon ül, csak admin/owner szerkeszti, mindenki ugyanazt látja)
- **Eredeti ár** (a korábbi "fedélár") — amennyiért annak idején az
  újságosnál/kiadónál kapható volt.
- Lapszám, cím, megjelenés dátuma — változatlanul törzsadat, mint eddig.

## Személyes adat (mindenki a sajátját rögzíti — ÚJ, a member_status
komponens-szintű sémája mellé egy SZÁM-SZINTŰ személyes tábla is kell,
mert ezek az adatok nem komponenshez, hanem a számhoz tartoznak)
- **Fizetett ár** — amennyiért Ő ténylegesen megszerezte (lehet több/
  kevesebb/ugyanannyi, mint az Eredeti ár).
- **Beszerzési mennyiség** — hány darabot vett egy alkalommal (ez
  szorozza a Fizetett árat az összesítésnél).
- Beszerzés dátuma, forrás (bolt/bolhapiac/stb.) — szintén személyes.

Javasolt új tábla, pl. `member_issue_data` (user_id, issue_id, fizetett_ar,
beszerzesi_mennyiseg, beszerzes_datuma, forras) — hasonló mintával, mint a
meglévő member_status (upsert, RLS: mindenki csak a sajátját).

## Sorozat-fejléc (lenyíló doboz) — KÉTFÉLE NÉZET, VÁLASZTHATÓ
- **"Eredeti ár alapján"** (marad az ALAPÉRTELMEZETT, mint eddig):
  összesen = Eredeti ár × a magazin komponens AKTUÁLIS darabszáma
  (a member_status.db mezője); ha a sorozatnak nincs magazin komponense,
  a KÖNYV komponens darabszáma számít helyette.
- **"Fizetett ár alapján"**: összesen = Σ (Fizetett ár × Beszerzési
  mennyiség) az adott felhasználó saját, rögzített tételeire.
- NYITOTT ÉL (nem blokkoló, csak jelezve): ha egy sorozatnak se magazin,
  se könyv komponense nincs, egyelőre az ELSŐ komponens-típus darabszáma
  legyen az alapértelmezett szorzó — ezt majd pontosítjuk, ha felmerül.

====================================================================
ESZKÖZ-KORLÁTOZÁS (mindenkire vonatkozik, nem csak adminra)
====================================================================

Mindkét import-funkció (meglévő sorozathoz saját jelölés feltöltése ÉS
új sorozat-igényléshez sablon feltöltése) csak PC/laptop/tablet nézetben
érhető el — telefonon egyiket se mutasd (ugyanaz a `desktop-only` minta,
mint a jelenlegi Sablon/Excel gomboknál, csak most usernek is elérhető
ezen az eszközkategórián).

====================================================================
EGYÜTT ESEDÉKES FELADAT: A NAGY index.html SZÉTBONTÁSA
====================================================================

A jelenlegi index.html kb. 60 kB, HTML+CSS+JS egyben — ez a jogosultsági
réteg és az ár-modell beépítésével tovább nő, nehezen karbantarthatóvá
válik.

Javasolj egy ésszerű szétbontást TÖBB FÁJLRA, build-eszköz (Node/Vite/
webpack) bevezetése NÉLKÜL, ha ez ésszerűen elkerülhető — natív ES
modulokkal valószínűleg megoldható. Ha szerinted mégis érdemesebb lenne
build-eszközt bevezetni, indokold röviden és kérdezz rá — ne vezesd be
magától értetődően.

====================================================================
MUNKASTÍLUS, AMIT KÖVESSÜNK
====================================================================

- Előbb terv/kérdések, utána kód. Ha bármi a fenti tervben pontatlan
  vagy hiányos, kérdezz vissza, mielőtt kódolnál.
- FONTOS: ha kérdezel, tedd fel az ÖSSZES kérdésedet EGYSZERRE, szövegben
  felsorolva — ne egyesével, egymás után, mert ez feleslegesen sok kört
  és tokent emészt fel. Én egyszerre válaszolok mindegyikre, és bármikor
  közbeszólhatok, ha az egész irány pontosításra szorul.
- Kis, tesztelhető lépésekben haladjunk — ne akard egyszerre az összes
  jövőbeli funkciót (sablon-jóváhagyás, sorozat-választás, üzenetküldés)
  megépíteni, csak a fenti jogosultsági réteget, az ár-modellt és a
  fájlszétbontást.
- "Keep it simple" — ne vezess be komplexitást, ami nem szükséges ehhez
  a lépéshez.
- Minden meglévő funkció (komponens-modell, hierarchia-szín, darabszám-
  számláló, megosztott katalógus, Excel-import, PWA) továbbra is működjön
  változatlanul.
- Git: a kész, tesztelt lépés után commit + push, világos üzenettel.
- SQL-migrációkat külön, futtatható fájlként add nekem (én futtatom a
  Supabase SQL Editorban).

Kezdd azzal, hogy elolvasod a két dokumentumot, aztán foglald össze
nekem EGYBEN (nem egymás utáni körökben) a kérdéseidet a `members` és
`member_issue_data` táblák RLS-tervéről, illetve a fájlszétbontás
javasolt szerkezetéről — és várd meg a jóváhagyásomat, mielőtt kódolnál.
