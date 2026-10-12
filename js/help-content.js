/* ============================================================
   Súgó — TARTALOM (kérdés–válasz párok, kategóriákba rendezve).
   Szándékosan elválasztva a UI-logikától (help.js) — ha csak a
   szöveget kell javítani/bővíteni, ide elég nyúlni.

   A szöveg a TÉNYLEGES felületet/kódot tükrözi (nem a specifikáció
   tervezési nyelvét) — gombfeliratok, ikonok és folyamat-lépések
   az élő appból. Terminológia (3. hibajavítási pont): a gyűjthető
   egység egységesen "Szám" — a "lapszám" szó csak ott marad, ahol
   valóban a SZÁMÉRTÉKRŐL (a mezőről/oszlopról) van szó, nem magáról
   az entitásról. A Karbantartás pool-jában lévő javaslat/szerkesztés-
   bejegyzések (amik nem publikált Számok, hanem sorozat-szintű
   munkaanyagok) "elem" vagy "munkaanyag" szóval, nem "tétel"-lel,
   hogy ne keveredjenek a Szám fogalmával.
   ============================================================ */

export const HELP_CONTENT = {
  user: [
    { id:"kezdo", title:"Kezdő lépések", open:true, items:[
      { q:"Mi az a Sorozat, Szám és Komponens?",
        a:"<p>A <b>Sorozat</b> egy gyűjthető újságsorozat (pl. „II VH Repülők”). Minden sorozat <b>Számokból</b> áll (pl. #1, #2…), és minden szám egy vagy több <b>Komponensből</b> — ilyen lehet a magazin maga, egy hozzá tartozó modell, könyv, vagy más melléklet. Ezt láthatod a lista minden sorában: a szám mellett annyi ikonos gomb van, ahány komponensből az a szám áll.</p>" },
      { q:"Hogyan jelentkezem be?",
        a:"<p>A bejelentkező képernyőn add meg az e-mail címed és a jelszavad, majd nyomd meg a <b>Belépés</b> gombot. Ha még nincs fiókod, a <b>Regisztrálj</b> linkkel hozhatsz létre egyet — utána ugyanezzel az e-maillel/jelszóval jelentkezz be. A bejelentkezés tartós, telefonon nem kell újra és újra belépned.</p>" },
      { q:"Mit jelentenek a fejléc gombjai?",
        a:"<p>Balról jobbra, amit mindenki lát: <b>📚 Sorozataim</b> (melyik sorozatokat követed), <b>🔔 Újdonságok</b> (mi változott a felületen, egyszerű nyelven), <b>❓ Súgó</b> (ez itt), és <b>⎋</b> (kijelentkezés). Ha staff (admin/tulajdonos) vagy, további gombok is megjelennek — ezekről az Adminisztrátori fülön olvashatsz.</p>" },
    ]},

    { id:"sorozataim", title:"Sorozataim", open:false, items:[
      { q:"Hogyan válasszak sorozatot a listámba?",
        a:"<p>Nyisd meg a fejlécben a <b>📚 Sorozataim</b> gombot. Egy lista jelenik meg az elérhető sorozatokról, pipálható jelölőnégyzetekkel — pipáld be, amit szeretnél, és azonnal megjelenik a fülsávban.</p>" },
      { q:"Hogyan válasszak le egy sorozatot?",
        a:"<p>A <b>📚 Sorozataim</b> ablakban vedd ki a pipát a sorozat mellől. Ekkor rákérdez: <b>Megtartom</b> vagy <b>Törlöm a saját adataimat is</b> — ha megtartod, a jelöléseid/áraid megmaradnak a háttérben, csak a fülsávból tűnik el a sorozat; ha törlöd, a saját adataid véglegesen elvesznek erről a sorozatról (a törzsadatot, amit a staff visz fel, ez nem érinti).</p>" },
      { q:"Ha újra beválasztom, amit korábban leválasztottam, emlékszik a régi jelöléseimre?",
        a:"<p>Csak akkor, ha leváláskor a <b>Megtartom</b> opciót választottad — ekkor a régi jelöléseid/áraid visszakerülnek. Ha akkor a <b>Törlöm</b> opciót választottad, újra-beválasztáskor teljesen tiszta lappal indulsz. Korlátlanul le- és újra-választhatsz, nincs limit.</p>" },
      { q:"Miért nem tudom kiválasztani az egyik sorozatot?",
        a:"<p>Két oka lehet: <b>„publikálatlan — nem választható újra”</b> — a staff levette ezt a sorozatot, és te korábban nem voltál rajta, ezért újonnan nem választható; <b>„törlésre jelölve — nem választható”</b> — a tulajdonos elindította a végleges törlését, amíg ez fut, senki nem választhatja be újonnan.</p>" },
      { q:"Miért van néhány sorozatnak egymáshoz hasonló színe a fülsávban, és miért csoportosítva jelennek meg?",
        a:"<p>Minden sorozathoz tartozik egy <b>Kategória (témakör)</b> — pl. <b>Modellek</b> (kék), <b>Mese</b> (piros), <b>Lego</b> (zöld). A <b>📚 Sorozataim</b> gomb melletti „Sorozatok” fülsáv lenyitva témakörönként csoportosítva mutatja a sorozatokat, egy-egy élénk, jól megkülönböztethető színcsaláddal — így egy pillantásra látszik, mely sorozatok tartoznak össze, miközben a családon belül egyénileg is megkülönböztethetők maradnak.</p>" },
    ]},

    { id:"jeloles", title:"Jelölés és státuszok", open:false, items:[
      { q:"Hogyan jelölöm meg, hogy megvan egy szám?",
        a:"<p>Koppints a szám sorában az elem csempéjének tetején lévő gombra (a státusz jele és az elem neve, pl. „Magazin”). Az első koppintás <b>megvan</b>-ra állítja. További koppintásokra körbeforog: megvan → hiány → nem kell → megvan… Jelöletlenre nem tér vissza magától koppintással — ehhez nyisd le a sort, és a fizetve-sor melletti <b>✎ Saját adatlap</b> gombon a „jelöletlen” választógombbal állíthatod vissza (ez mindenkinek elérhető, nem staff-funkció).</p>" },
      { q:"Mit látok egy Szám sorában?",
        a:"<p>Bal oldalon a <b>sorszám</b> és a cím, alatta a dátum és a kód, az árak; jobbra a Szám <b>elemei</b> csempékben, legfeljebb három egymás mellett (az első a ★ fő elem). Egy csempén felül a <b>státusz-gomb</b>: a státusz jele (✓ zöld = megvan, ✕ piros = hiányzik, – szürke = nem kell, üres pöttyözött kör = jelöletlen) és az elem neve — ha a név nem fér ki, „…” jelzi, a teljes nevet a gombra mutatva látod. Alatta balra az elem <b>képe</b> (ha nincs feltöltött kép, szaggatott keretben „kép” felirat), mellette felül a <b>típus jele</b> (magazin, könyv, figura, modell, lego, kártya…), alul a <b>darabszám</b> — ez mindig látszik, akkor is, ha 1. A jobb szélen a lenyitó nyíl: lenyitva minden elem látszik, nagyobb képpel, darabszám-állítóval és státusz-gombbal.</p><p>Ha háromnál több elem van a Számon, a lenyitó nyíl mellett <b>+N</b> jelzi, hány további van. Telefonon a szöveg felül van, a nyíl a jobb felső sarokban, a csempék alatta egy sorban. A sor színe és a gombok működése változatlan.</p>" },
      { q:"Mi az a fő elem (★)?",
        a:"<p>Egy Szám elemei közül az, amelyik a sorban mindig az <b>első</b> helyen áll, kis <b>★</b> jelöléssel — általában a magazin, ahol nincs magazin, a könyv. Karbantartók a draft-szerkesztőben állíthatják át („★ Fő elem” választó; mindig pontosan egy van). A fő elem <b>nem törölhető</b>: előbb másikat kell kijelölni. A fő elem csak a sorrendet és a ★ jelet adja — a Szám színét, a haladásjelzőket és az összegeket nem befolyásolja.</p>" },
      { q:"Mit jelentenek a szám színei?",
        a:"<ul><li><b>Zöld</b> — kész, megvan a lényeg</li><li><b>Piros</b> — hiányzik, kell</li><li><b>Sárga</b> — részleges (pl. megvan a magazin, de a hozzá tartozó modell/melléklet még hiányzik)</li><li><b>Szürke</b> — tudatosan „nem kell”-re jelölve</li><li><b>Semleges</b> — még jelöletlen, vagy a szám még nem is jelent meg</li></ul>" },
      { q:"Hogyan állítom be, ha egy komponensből több példányom van?",
        a:"<p>Nyisd le a sor végén a nyíllal a képsávot — ott, minden komponensnél, egy +/− léptető van, amivel a darabszámot állíthatod. Ha 0-ra csökkented, a komponens automatikusan „hiányzik”-ra vált; ha 1 fölé emeled, automatikusan „megvan”-ra.</p>" },
      { q:"Miért nem tudom jelölni egy jövőbeli szám komponenseit?",
        a:"<p>Egy még meg nem jelent (jövőbeli dátumú) szám gombjai le vannak tiltva — a dátuma is pirossal jelenik meg a listában, jelzésül.</p>" },
    ]},

    { id:"arak", title:"Árak", open:false, items:[
      { q:"Mi a különbség az eredeti ár és a fizetett ár között?",
        a:"<p>Az <b>eredeti ár</b> a megjelenéskori, újságosnál kapható ár — ez közös adat, amit a staff visz fel, mindenki ugyanazt látja. A <b>fizetett ár</b> az, amennyiért TE ténylegesen megszerezted — ez teljesen személyes, csak te látod és szerkeszted.</p>" },
      { q:"Miért töltődik ki automatikusan a fizetett ár?",
        a:"<p>Amikor egy számnál először jelölsz meg legalább egy komponenst „megvan”-ra, és még nincs saját fizetett árad rajta, a rendszer automatikusan az eredeti árat írja be. Ha ezt utána kézzel átírod, a kézi érték megmarad. Ha az összes jelölésedet visszavonod arról a számról, és az ár még mindig az automatikus volt, visszaáll „nem ismert”-re — a kézzel beírt árat viszont sosem törli.</p>" },
      { q:"Hogyan írom át kézzel a saját fizetett áramat?",
        a:"<p>Nyisd le a sor képsávját, majd a fizetett ár melletti <b>✎</b> ikonra koppintva megnyílik a <b>„Saját adatlap”</b> — itt állíthatod a fizetett árat (vagy jelölheted „nem ismert”-nek), a beszerzési mennyiséget, a dátumot és a forrást. Ugyanez az ablak komponensenként a státuszt, darabszámot és jegyzetet is kezeli — lásd „Mi az a Saját adatlap?” alább.</p>" },
      { q:"Mi az a Saját adatlap?",
        a:"<p>Egy mindenki (nem csak staff) számára elérhető, egységes ablak egy Számhoz — a ✎ ikonnal nyitható meg a lenyitott sorban. Itt van egy helyen: komponensenként a <b>Státusz</b> (megvan/hiány/nem kell/jelöletlen), a <b>Darabszám</b>, a <b>Jegyzet</b>, az (olvasható) Azonosító, valamint szám-szinten a <b>Fizetett ár</b>, a beszerzési mennyiség, dátum és forrás. Ez mindig csak a SAJÁT adataidat írja — a törzsadatot (cím, dátum, eredeti ár, azonosító) soha.</p>" },
      { q:"Mit jelent a „nem ismert” felirat egy árnál?",
        a:"<p>Azt, hogy nincs rögzített érték — nem hiba vagy üres mező, egyszerűen még nem tudod (vagy nem adtad meg) az árat. Ez a hero-doboz összegzésénél <b>„+ nem ismert”</b> jelzésként is megjelenhet, ha van ilyen számod.</p>" },
    ]},

    { id:"kereses", title:"Keresés és szűrés", open:false, items:[
      { q:"Hogyan keresek egy adott számra?",
        a:"<p>A keresőmezőbe írd be a lapszámot (pontos találat) vagy a cím egy részletét (részleges egyezés is működik).</p>" },
      { q:"Hogyan keresek és rendezek a sorozatok között?",
        a:"<p>A <b>📚 Sorozataim</b> ablakban és a Karbantartás <b>Aktív sorozatok</b> fülén van egy keresőmező és egy rendező. A keresés névre megy, <b>kis- és nagybetű-, valamint ékezetfüggetlenül</b> (a „forma” megtalálja a „Formula” sorozatot, az „orjarat” az „Őrjárat”-ot). Rendezés: <b>ABC szerint</b> (magyar sorrend), <b>legutóbb módosított</b> (az a legutóbbi publikálás, ami a sorozatot ténylegesen érintette; ha még sosem módosult, a létrehozás ideje), vagy a <b>Számok száma</b> szerint. A választott rendezést megjegyzi.</p>" },
      { q:"Mit jelentenek a szűrő-gombok?",
        a:"<p><b>Mind</b> — minden szám; <b>Megvan / Hiányzik / Nem kell</b> — csak azok a számok, amiknek legalább egy komponense az adott státuszban van; <b>Várható</b> — csak a még meg nem jelent, jövőbeli számok; a mai dátumú szám már megjelentnek számít (ez a gomb csak akkor látszik, ha van ilyen a sorozatban).</p>" },
    ]},

    { id:"kepek", title:"Képek", open:false, items:[
      { q:"Hogyan nézem meg egy komponens képét?",
        a:"<p>Nyisd le a sor végén a nyilat — minden komponenshez tartozik egy képkocka; ha még nincs kép feltöltve, „nincs adat” felirat látszik helyette.</p>" },
      { q:"Hogyan javasolhatok saját képet egy komponenshez?",
        a:"<p>A lenyitott képsávban, a kép alatt megjelenik egy <b>„Kép javaslása”</b> (vagy meglévő képnél <b>„Csere javaslása”</b>) gomb — ide koppintva választhatsz fájlt. A kép automatikusan átméreteződik feltöltés előtt, nem kell magadnak méretezned.</p>" },
      { q:"Miért nem látom a javaslás gombot egyik komponensnél sem?",
        a:"<p>Két lehetséges ok: már van egy függőben lévő javaslat azon a komponensen (ilyenkor „elbírálás alatt” feliratot látsz helyette — egyszerre csak egy javaslat lehet), vagy a staff nem engedélyezte a cserét arra a komponensre (ha már van rajta valódi kép, ehhez a staffnak külön be kell kapcsolnia — ha még nincs kép, automatikusan engedélyezett).</p>" },
      { q:"Mi történik a javaslatommal, miután beküldtem?",
        a:"<p>A staff elbírálja (elfogadja vagy elutasítja). Nem kapsz külön értesítést: ha elfogadta, legközelebb az új képet látod; ha elutasította, a régi kép (vagy „nincs adat”) marad — egyik esetben sincs figyelmeztetés, egyszerűen ez lesz az állapot.</p>" },
      { q:"Mi az a kis kép a sorozat neve mellett a hero-dobozban?",
        a:"<p>Ez a sorozat <b>borítóképe</b> — sok részletsorozatnál a számozott 1-es szám előtt jár egy ingyenes bemutató-/reklámfüzet, aminek nincs saját „Száma”, csak ez a vizuális/referencia hely. Nem számít bele semmilyen darabszám- vagy százalék-összesítőbe. Ha még nincs feltöltve, szaggatott keretű helyet látsz — ugyanúgy javasolhatsz rá képet, mint egy komponensre (csak olyan sorozatnál, amit a 📚 Sorozataimban már kiválasztottál).</p>" },
    ]},

    { id:"valtozasok", title:"Változás-értesítések", open:false, items:[
      { q:"Mit jelent a felkiáltójel (!) a fülemen vagy egy számnál?",
        a:"<p>Azt jelzi, hogy a staff módosított valamit egy közös adaton (pl. cím, dátum, ár, azonosító), amit korábban már láttál egy másik állapotában. Három helyen bukkanhat fel: a sorozat fülének sarkán (ha bármi változott a sorozaton belül), a sorozat neve mellett (ha maga a sorozat adata változott), vagy egy szám sorszáma mellett (ha az a szám vagy annak komponense változott).</p>" },
      { q:"Mit csinál az OK és a Mégse gomb a változás-ablakban?",
        a:"<p>A felkiáltójelre koppintva megnyílik egy ablak, ami mezőnként mutatja: „régi érték → új érték”. <b>OK, nyugtázom</b> — tudomásul veszed, a jelzés eltűnik. <b>Mégse</b> — bezárja az ablakot, de a felkiáltójel megmarad, később is megnézheted.</p>" },
      { q:"Mi az a gyűjtött elfogadás gomb?",
        a:"<p>A szűrő-gombok sorának jobb szélén, egy önálló „!” gomb jelenik meg, ha a sorozaton belül bárhol van el nem fogadott változás. Erre koppintva egy listában látod az ÖSSZES változást egyszerre, és egy „Mind elfogadom” gombbal egyszerre nyugtázhatod mindet — nem kell számonként külön.</p>" },
      { q:"Miért nem jelez felkiáltójelet, ha egy Szám sorszáma (lapszáma) megváltozott?",
        a:"<p>Ha a staff átszámozza a sorozatot, a puszta sorszám-változás <b>csendes</b>: nem jelenik meg tételenként felkiáltójel, hogy egy tömeges átszámozás ne árassza el a listádat. A változás rögzítve van, a Szám új sorszámát egyszerűen ott látod, ahol a sor áll. Ha a sorszám mellett tartalmi adat is változott (cím, megjelenés dátuma, ár, azonosító), akkor a szokásos felkiáltójel megjelenik, és a részletes ablakban a sorszám-változás is látszik.</p>" },
      { q:"Miért van egy szám áthúzva, „Ez a szám törölve lett a sorozatból” felirattal?",
        a:"<p>A staff törölte ezt a Számot a sorozatból. Amíg nem nyugtázod a felkiáltójellel, a sor még látszik (áthúzva, szaggatott kerettel), hogy biztosan tudomást szerezz róla — utána eltűnik a listából. Nyugtázáskor a saját (státusz/darabszám/jegyzet/beszerzés) adataid arról a Számról törlődnek, a döntést nem lehet visszavonni.</p>" },
    ]},

    { id:"uj-javaslat", title:"Új sorozat javaslása", open:false, items:[
      { q:"Hogyan javasoljak egy teljesen új sorozatot?",
        a:"<p>A <b>📚 Sorozataim</b> ablak alján van egy <b>„+ Új sorozat javaslása”</b> gomb. Itt megadhatod a kiadót, a sorozat nevét, a fülön megjelenő rövid nevet, a színét és hogy miből áll egy szám (pl. magazin + modell). A <b>„Javaslat beküldése”</b> gombbal küldheted el.</p>" },
      { q:"Mi történik a javaslatommal a beküldés után?",
        a:"<p>Bekerül a staff „feldolgozásra váró” listájába (a Karbantartás menüpontba) — a staff nézi át, egészíti ki a számokkal, és publikálja, ha kész. Amíg ez nem történik meg, a sorozat nem jelenik meg senki fülsávjában, a Sorozataim választóban sem.</p>" },
      { q:"Fel tudom vinni én magam a Számokat a javaslatomhoz, vagy azt is a staffnak kell?",
        a:"<p>Beküldés után egy köztes képernyő jelenik meg: itt (nem kötelezően) letöltheted a sorozatod komponens-készletéhez igazodó Excel-sablont, kitöltheted a Számokkal, és visszatöltheted — ez egyenesen a javaslatod munkaanyagába kerül, nem kell egyesével a staffnak pótolnia. Ha kihagyod, a staff pótolja majd feldolgozáskor.</p>" },
    ]},

    { id:"osszesitok", title:"Belekerülési költség és összesítők", open:false, items:[
      { q:"Hogyan nézem meg, mennyibe került eddig a sorozatom?",
        a:"<p><b>Az összeg-kártya</b> azt mutatja, mennyit ér a gyűjteményed, két módon. Az „összeg megjelenítése” gombbal nyitod meg, az „elrejt” gombbal zárod vissza (sorozatváltáskor magától visszaáll rejtettre). Mindkét mód <b>ugyanazokat a Számokat</b> adja össze: azokat, amikből <b>legalább egy elem megvan</b> — így a kettő összevethető, és mellette látod, hány Szám alapján számolt (pl. „78 961 Ft · 39 Szám”).</p><p>Az <b>„Eredeti ár alapján”</b> a Számok listaárát adja össze, a <b>„Fizetett ár alapján”</b> pedig azt, amit ténylegesen fizettél. Az ár mindig a <b>Szám (a magazin) ára</b>: a mellékletnek, például a legónak nincs külön ára, ezért az sem számít, hány darabot jelöltél belőle.</p><p>Ha egy Számból többet vettél, de kevesebbet tartottál meg, add meg a <b>beszerzési mennyiséget</b> (Saját adatlap): az összeg ezzel szorozza az árat, ezért a ténylegesen megvett példányok árát mutatja. Ha valamelyik Számnak nincs ára, az nem kerül az összegbe, és a <b>„+ nem ismert”</b> jelzi.</p>" },
      { q:"Mit jelent a „Következő megjelenés” vagy a „Beszerzendő” doboz?",
        a:"<p>Ha van még jövőbeli, meg nem jelent szám a sorozatban, a dátumát és címét mutatja (a mai dátumú szám már megjelent, ezért nem számít „következőnek”; a nap a saját időzónád szerint vált, éjfélkor magától frissül). Ha nincs (a sorozat „lezárt”), helyette azt mutatja, hány hiányzó vagy jelöletlen számod van még — ezekre érdemes vadászni.</p>" },
      { q:"Mit mutatnak a haladás-sávok?",
        a:"<p>Komponens-típusonként (pl. külön a magazinokra, külön a modellekre) mutatják, hány darab van meg a teljesből, és ennek százalékát.</p>" },
    ]},
  ],

  admin: [
    { id:"karbantartas-attekintes", title:"Karbantartás áttekintés", open:true, items:[
      { q:"Mire való a 🗂️ Karbantartás gomb?",
        a:"<p>Ez staff-only (admin/tulajdonos) menüpont, innen kezelhető a sorozatok teljes életútja. Három fület tartalmaz: <b>Aktív sorozatok</b> (a már publikáltak), <b>Munka sorozatok</b> (a beérkezett javaslatok és folyamatban lévő szerkesztések) és <b>Publikálatlan</b> (a levett sorozatok).</p>" },
      { q:"Miben más ez, mint a 🔧 Gyors szerkesztés gomb?",
        a:"<p>A 🔧 gomb egy kis eszköztárat nyit meg a kiválasztott sorozat felett: <b>„+ Új tétel”</b> (vadonatúj Szám azonnali, közvetlen felvétele), <b>„☰ Listák”</b> (a választható listák — kiadó, komponens-típus stb. — bővítése), és <b>„⬇ Sablon”</b>/<b>„⬆ Excel”</b> (tömeges Excel-import a kiválasztott, már élő sorozathoz). Egy MÁR LÉTEZŐ Szám törzsadatát (cím, dátum, ár, azonosító, komponens-típus) ez az eszköztár nem tudja közvetlenül módosítani vagy törölni — ahhoz mindig a Karbantartás draft/publikálás útja kell, hogy a többi felhasználó a szokásos felkiáltójel-jelzést kapja a változásról. A saját (személyes) adataid — státusz, darabszám, jegyzet, fizetett ár — bármikor, közvetlenül a „Saját adatlap” ✎ ikonjával szerkesztheted, draft nélkül, mert ezek sosem törzsadat.</p>" },
    ]},

    { id:"eletciklus", title:"Sorozat-életciklus", open:false, items:[
      { q:"Milyen állapotokon megy át egy sorozat?",
        a:"<p><b>Beérkezett</b> (valaki beküldte, senki nem foglalta le) → <b>Munkaanyag</b> (valaki „felvette”, csak ő szerkesztheti) → <b>Publikálásra váró</b> (kész, publikálásra vár) → <b>Aktív</b> (élesben, mindenki látja) → <b>Publikálatlan</b> (a staff levette, de a korábbi kiválasztók megtartják a hozzáférést).</p>" },
      { q:"Hogyan veszek fel („claim-elek”) egy beérkezett javaslatot?",
        a:"<p>A Munka sorozatok fülön, a Beérkezett csoportban mindegyiknél van egy <b>„Felveszem”</b> gomb. Ez rád zárolja — amíg nálad van, más staff nem nyúlhat hozzá (a Munkaanyag csoportban „🔒 [név] dolgozik rajta” felirattal látják).</p>" },
      { q:"Mi történik, ha elengedem a foglalást?",
        a:"<p>A Munkaanyag alatti elemnél az <b>„Elengedem”</b> gombra kattintva az visszakerül lock nélküli Beérkezett állapotba, a addigi munkával együtt — bárki más felveheti onnantól.</p>" },
      { q:"Mit tehetek, ha a „Publikálásra váró” munkaanyagot még javítani kell, vagy a publikálás nem sikerült?",
        a:"<p>A Publikálásra váró elemnél a <b>„Visszaadás szerkesztésre”</b> gombbal visszaléphetsz Munkaanyag állapotba. A tartalom, a lefoglalásod és az élő sorozat érintetlen marad, verzió nem emelkedik, felhasználók felé értesítés nincs. A gombot a munkaanyagot lefoglaló admin és a tulajdonos látja; a sorozat törlési türelmi ideje alatt nem használható. Sikertelen publikálás után a hibaablak is ezt ajánlja fel — a hiba érthető szöveggel jelzi az okot (pl. mely lapszámok ütköznének), és az élő sorozat ilyenkor nem változik.</p>" },
      { q:"Mi az a 20-as korlát?",
        a:"<p>A Beérkezett és a Munkaanyag csoport elemei EGYÜTT max. 20 darabot tehetnek ki (ezt mutatja a fül felirata: „Munka sorozatok (N/20)”). A Publikálásra váró állapotú elemek nem számítanak bele. (A Publikálatlan egy teljesen más, már ÉLŐ sorozatokra vonatkozó állapot — azzal ennek a limitnek nincs kapcsolata.)</p>" },
      { q:"Mi a különbség az „Új javaslat” és a „Szerkesztés” típus között?",
        a:"<p>Az <b>„Új javaslat”</b> egy vadonatúj sorozat (user vagy staff küldte be sablonnal) — ez az egyetlen út, ahogy új sorozat egyáltalán a rendszerbe kerülhet. A <b>„Szerkesztés”</b> egy már élő, publikált sorozaton indított módosítás — ilyenkor az élő verzió közben zavartalanul, változatlanul elérhető marad mindenki másnak, amíg a szerkesztés folyik.</p>" },
    ]},

    { id:"sorozat-szerk", title:"Sorozat szerkesztése", open:false, items:[
      { q:"Mit mutat a publikálás előtti összefoglaló és a „N Szám” a listán?",
        a:"<p>A <b>Munka sorozatok</b> listán minden munkaanyag mellett látszik, hány (nem törölt) Számot tartalmaz; szerkesztésnél az élő szám is („41 Szám, élőben: 40”). A <b>Publikálás</b> gomb megerősítő ablakában rövid összefoglaló áll: „X új, Y módosult, Z törölt Szám”; ahol csak a lapszám változik (átszámozás), azt külön jelzi, mert az csendes (nincs felkiáltójel). Az összefoglaló ugyanazokat a szabályokat követi, mint a tényleges publikálás.</p>" },
      { q:"Mi a komponens-sablon, és hogyan állítom be?",
        a:"<p>A sorozat <b>komponens-sablonja</b> azt írja le, miből áll egy Szám, és ebből indul minden ÚJ Szám. A Karbantartás sorozat-szerkesztőjének „Komponens-sablon” szakaszában, típusonként állítható: <b>sorrend</b> (▲▼), <b>★ fő elem</b> (pontosan egy típus), <b>kötelező</b> (az új Számnál létrejön egy üres példány; az opcionálisból nem), <b>azonosító-szabály</b> (kötelező / ajánlott / nincs), <b>alap azonosító-típus</b> (pl. a könyvnél ISBN), <b>számít a Szám színébe</b>, és egy <b>alap megnevezés</b>. A sablon csak az új Számokat érinti — a meglévő Számokat és komponenseket nem módosítja. A sor legfeljebb 3 elemet mutat, a többit „+N” jelzi.</p>" },
      { q:"Hogyan adok hozzá más típusú elemet egy Számhoz (pl. Limited Edition kártya)?",
        a:"<p>A Szám szerkesztőjében (Karbantartás → szerkesztés → a Szám „Szerkesztés” gombja) az <b>„+ Elem hozzáadása”</b> sornál válaszd ki a típust — az összes komponens-típus közül lehet választani, nem csak a sorozat sablonjában szereplők közül. Az így hozzáadott elem <b>csak az adott Számra</b> vonatkozik: nem kerül a sorozat sablonjába. Saját azonosítót, megnevezést, képet, állapotot és darabszámot visel, és külön haladásjelzőt kap (a nevezője azoknak a Számoknak a száma, amelyeken van ilyen típusú elem).</p>" },
      { q:"Mit jelent az azonosító-szabály (kötelező / ajánlott / nincs)?",
        a:"<p><b>Nincs</b> — az azonosító üresen is maradhat. <b>Ajánlott</b> — a „Kész” előtt figyelmeztet, ha egy ilyen típusú komponensnek nincs azonosítója (nem akadályoz). <b>Kötelező</b> — az ÚJ Számok és az ebben a munkaanyagban hozzáadott komponensek azonosító nélkül nem állíthatók „Kész”-re (a hiba felsorolja őket); a már meglévő, nem módosított komponensek hiánya csak figyelmeztetés, hogy egy régi sorozat se ragadjon be.</p>" },
      { q:"Hogyan törölhetek egy komponenst egy Számról?",
        a:"<p>A Szám szerkesztőjében (draft) a komponens alatti <b>„Ez a példány törlése”</b> gombbal. A törlés <b>törölt-jelölés</b>: a komponens a publikálásig a szerkesztőben szürkítve látszik („Törlés visszavonása” gombbal visszavonható), publikáláskor eltűnik a Számról — a hozzá tartozó személyes jelölések, darabszámok az adatbázisban megmaradnak, és a komponens később visszaállítható. A törlés <b>csendes</b>: nincs felkiáltójel. Két védelem van: a <b>fő elem (★) nem törölhető</b> (előbb jelölj ki másikat fő elemnek), és egy Számnak <b>mindig marad legalább egy</b> komponense. A törölt komponens sehol nem számít: sem a számlálókba, sem a haladásjelzőkbe, sem a színezésbe, sem az összegbe.</p>" },
      { q:"Mit jelentenek a „Kész” előtti figyelmeztetések?",
        a:"<p>A „Kész” gomb előtt egy ablak felsorolja a <b>nem blokkoló</b> megfigyeléseket: az ajánlott azonosító hiányát (darabszámmal), a meglévő komponensek hiányzó kötelező azonosítóját, és azt, ha ugyanaz az azonosító kétszer szerepel azonos típusú komponensen a sorozatban (kis- és nagybetű-, szóközfüggetlenül, a publikálás UTÁNI állapotra számolva; legfeljebb 10 pár). A <b>„Mégis Kész”</b> gombbal tovább lehet lépni. A blokkoló hibákat (lapszám-ütközés, komponens nélküli új Szám, kötelező azonosító hiánya) továbbra is hibaüzenet jelzi.</p>" },
      { q:"Hogyan indítok szerkesztést egy már élő sorozaton?",
        a:"<p>A Karbantartás Aktív sorozatok fülén, a sorozat sorában koppints a <b>„Szerkesztés indítása”</b> gombra. Ez azonnal, egy lépésben létrehoz egy másolatot (draftot) az összes (nem törölt) számáról/komponenséről, és átkerül a Munka sorozatok fülre, rád claim-elve. Egy sorozathoz egyszerre egyetlen szerkesztési munkaanyag tartozhat — ha már van, a gomb ezt jelzi —, és csak aktív (publikált) sorozaton indítható.</p>" },
      { q:"Mi az a draft, és ki látja?",
        a:"<p>A draft egy munkaanyag-másolat — csak a Karbantartásban, csak a claim-elő staff-tagnak látszik, amíg publikálva nincs. A draft-nézetben mind a sorozat mezői (kiadó, név, szín, komponens-készlet), mind az egyes számok listája szerkeszthető.</p>" },
      { q:"Hogyan adok hozzá vagy szerkesztek egy számot a draftban?",
        a:"<p>A draft-szerkesztő nézet alján a <b>„+ Új szám”</b> gombbal vehetsz fel újat, vagy egy meglévő számnál a <b>„Szerkesztés”</b> gombbal módosíthatod (lapszám, cím, dátum, eredeti ár, komponensenkénti azonosító). Ez a draftot módosítja, NEM az élő adatot.</p>" },
      { q:"Mi történik publikáláskor?",
        a:"<p>Ha a draft kész, a Munkaanyag fülön a <b>„Kész”</b> gombbal átteszed Publikálásra váróba, ott pedig a <b>„Publikálás”</b> gombbal élesíted. Ekkor a rendszer mezőnként összeveti a draftot az élő adattal, minden változott mezőről feljegyzést készít, és mindenkinek, akit érint, felkiáltójel-jelzést ad — ez a végigkövetett, „mindenki tudomást szerez róla” útja a szerkesztésnek.</p><p>A „Kész” <b>nem enged</b> publikálásra állítani olyan ÚJ Számot, amelyiknek egyetlen komponense sincs — az ilyen Számon nem állítható sem státusz, sem azonosító. A hibaüzenet felsorolja az érintett Számokat; adj hozzá legalább egy komponenst, vagy töltsd fel újra a sablont.</p>" },
      { q:"Van ennél gyorsabb út egy apró javításra egy már élő Számon?",
        a:"<p>Nem — egy már publikált Szám törzsadatának (cím, dátum, ár, azonosító, komponens-típus) MINDEN módosítása a fenti, draft-alapú, publikálást igénylő úton megy át, hogy a felhasználók megkapják a felkiáltójel-jelzést. Gyorsabb, közvetlen út csak vadonatúj Szám felvitelére van (🔧 Gyors szerkesztés → „+ Új tétel”), mert azon még senkinek nincs saját adata, nincs mit védeni. Ha a SAJÁT (személyes) adataidat — státuszt, darabszámot, jegyzetet, fizetett árat — akarod gyorsan javítani, azt bármikor közvetlenül a „Saját adatlap” ✎ ikonjával teheted, draft nélkül.</p>" },
      { q:"Hogyan működik az oda-vissza sablon a draft-szerkesztőben?",
        a:"<p>A <b>„⬇ Sablon”</b> a draft AKTUÁLIS állapotát tölti le (az eddigi módosításokkal együtt), tételenként egy sorral. A Szám és a komponensek <b>rejtett azonosítót</b> kapnak — ez azonosítja a tételt, nem a neve és nem a lapszáma, ezért az átszámozás, átnevezés, átrendezés biztonságos. A lapszám tiszta sorrend-szám, a fájl az irányadó rá. Többpéldányos komponensnél (pl. két Lego) típusonként több „#1, #2…” oszlopcsoport van.</p><p><b>Feltöltéskor:</b> azonosítós sor = a meglévő tétel frissítése, azonosító nélküli sor = új tétel. Az <b>üres cella nem töröl</b> semmit. A <b>fájlból hiányzó tétel MARAD</b> — csak az előnézetben, külön bejelölve lehet töröltnek jelölni. Az azonosító nélküli sornál, ha a neve egy meglévő tételével egyezik, az előnézet <i>párosítást javasol</i>, de csak a te megerősítéseddel. Törölt tétel „törlésre jelölve (igen)” jelöléssel jön a fájlban; ha a jelölést kitörlöd, a tétel visszaáll.</p><p>Az <b>új sorokhoz</b> a sorozat komponens-típusaiból (pl. Könyv) automatikusan létrejön egy-egy üres példány, akkor is, ha a komponens-celláit üresen hagyod — az azonosítót és a megnevezést később is megadhatod.</p><p>Ha a fájl a letöltés óta megváltozott munkaanyagból való, az előnézet figyelmeztet, és megerősítést kér. A régi (azonosító nélküli) sablonok biztonsági okból nem tölthetők fel — töltsd le az újat.</p>" },
      { q:"Mit jelent a „lapszám-ütközés”, és miért nem enged Kész-re állítani vagy feltölteni?",
        a:"<p>Ütközés akkor van, ha a publikálás után két nem törölt Szám ugyanazt a lapszámot kapná. Az ellenőrzés a publikálás UTÁNI állapotot nézi: a munkaanyag nem törölt tételei, az új sorok, valamint az élő sorozat azon Számai, amelyek nincsenek a munkaanyagban (azok megmaradnak). A „Kész” gomb és a sablon-feltöltés előnézete is ezt használja, ezért a hiba nem publikáláskor derül ki. Teendő: javítsd a lapszámokat, vagy jelöld törlésre az ütköző élő Számot.</p>" },
      { q:"Hogyan törlök egy már publikált Számot?",
        a:"<p>A draft-szerkesztőben nyisd meg a Szám <b>„Szerkesztés”</b> gombját, és vagy pipáld be az <b>„Ezt a Számot törlöm a sorozatból (publikáláskor)”</b> jelölőnégyzetet, vagy használd a <b>„Szám törlése a sorozatból (törlésre jelölés)”</b> gombot — mindkettő ugyanazt jelöli. A jelölés a publikálásig bármikor visszavonható („Törlésre jelölés visszavonása”). Fontos: egy már élő Számot a rendszer SOHA nem töröl fizikailag a draftból, mert akkor a publikálás nem nyúlna hozzá, és az élő Szám ott maradna (egy azonos lapszámú új tétellel ütközne). Publikáláskor az élő Szám törölt lesz: a felhasználók a szokásos felkiáltójel-jelzésen keresztül kapnak róla értesítést („Ez a szám törölve lett a sorozatból.”), és csak az ő OK-nyugtázásukkor törlődnek a saját adataik arról a Számról. Csak a draftban létrehozott, még sosem publikált Számot lehet fizikailag törölni a draftból. Egy komponens-példány törlése a draftból az élő komponenst nem törli.</p>" },
      { q:"Hogyan sorolok át egy komponenst másik típusra?",
        a:"<p>Ha egy komponens korábban pl. „Egyéb”-ként lett felvéve, mert a pontos típus még nem létezett a listában — miután a „☰ Listák”-ban felvetted a pontos típust (pl. „Irattartó”), a draft-szerkesztőben az adott Szám komponensénél megjelenik egy <b>„Típus (utólagos átsorolás)”</b> legördülő, ahol átválthatod. Ez egyedi, komponensenkénti korrekció, publikáláskor a szokásos felkiáltójel-jelzésen megy át. Két komponens a Számon nem sorolható ugyanarra a típusra.</p>" },
    ]},

    { id:"excel-import", title:"Excel-import", open:false, items:[
      { q:"Hogyan töltök le sablont?",
        a:"<p>Válaszd ki a sorozatot a fülsávban, majd a 🔧 Gyors szerkesztés eszköztárban koppints az <b>„⬇ Sablon”</b> gombra. A letöltött Excel fájl oszlopai a kiválasztott sorozat komponens-készletéhez igazodnak.</p>" },
      { q:"Ez ugyanaz a sablon, mint a Karbantartás draft-szerkesztőjében vagy az Új sorozat javaslásánál?",
        a:"<p>Nem, két különböző mechanizmus, hasonló elven: ez itt (🔧 Gyors szerkesztés → ⬇ Sablon/⬆ Excel) egy MÁR ÉLŐ, publikált sorozathoz szól — a sablon a saját (személyes) jelöléseidet/áraidat és a törzsadat-módosításokat egyszerre kezeli (utóbbi draftba kerül, lásd lent). A Karbantartás draft-szerkesztőjében és az „Új sorozat javaslása” köztes lépésében található sablon ezzel szemben kizárólag DRAFT-ba (még nem élő munkaanyagba) visz fel vadonatúj Számokat tömegesen — abban nincs személyes/ár oszlop, mert a draftnak még nincs is felhasználója.</p>" },
      { q:"Mit jelentenek a sablon oszlopai?",
        a:"<p>Lapszám, cím, dátum, eredeti ár, majd személyes fizetett ár, aztán komponensenként két oszlop: „státusz” (megvan/hianyzik/nemkell) és „azonosító”.</p>" },
      { q:"Mi történik feltöltéskor, ha a sor egy MEGLÉVŐ számra vonatkozik?",
        a:"<p>A cím/dátum/eredeti ár/azonosító módosítás egy szerkesztési <b>draftba</b> kerül — ugyanúgy, mintha a Karbantartásban kézzel indítottad volna a szerkesztést, tehát publikálni kell, mielőtt élesbe kerülne, és a felhasználók a szokásos felkiáltójel-jelzést kapják. A fizetett ár és a komponens-státusz (a te saját jelölésed) viszont AZONNAL frissül, draft nélkül — ez sosem törzsadat.</p>" },
      { q:"Mi történik egy ÚJ számmal (ami még nincs a listában)?",
        a:"<p>Azonnal, közvetlenül létrejön élesben — nincs mit megvédeni rajta, hiszen még senkinek nincs saját adata ezen a számon.</p>" },
      { q:"Mikor kapok hibaüzenetet feltöltéskor?",
        a:"<p>Ha valaki más már szerkeszti ugyanazt a sorozatot a Karbantartásban (foglalva van nála), vagy ha az a szerkesztés már „Publikálásra váró” állapotban van — ilyenkor egyértelmű hibaüzenettel leáll az import, hogy ne ütközzön bele a folyamatban lévő munkába.</p>" },
    ]},

    { id:"kepjavaslatok", title:"Képjavaslatok elbírálása", open:false, items:[
      { q:"Hol találom a függő képjavaslatokat?",
        a:"<p>Komponens-képnél nyisd le annál a számnál a képsávot, aminél van javaslat — staffnak egy kis 📷 jelzés is megjelenik a lenyitó (▾) gombon, ha az adott számon vár elbírálásra javaslat. A sorozat-szintű <b>borítókép</b> javaslata a hero-dobozban, a kis borítókép alatt jelenik meg — ugyanaz a mechanizmus, csak a sorozatra vonatkozik, nem egy komponensre.</p>" },
      { q:"Hogyan fogadom el vagy utasítom el egy javaslatot?",
        a:"<p>A jelenlegi kép mellett/helyett megjelenik a javasolt kép előnézete, alatta <b>„Elfogad”</b> és <b>„Elutasít”</b> gombbal. Elfogadáskor a javasolt kép azonnal lecseréli az élőt; elutasításkor a régi kép (vagy „nincs adat”) marad. Ez komponens-képnél és a sorozat-borítóképnél egyformán működik.</p>" },
      { q:"Kap-e értesítést a felhasználó a döntésről?",
        a:"<p>Nem, szándékosan nincs külön értesítés — a user egyszerűen legközelebb látja az eredményt (az új képet, vagy hogy nem változott semmi).</p>" },
      { q:"Hogyan engedélyezem vagy tiltom le a képfeltöltést egy komponensen (vagy a sorozat-borítón)?",
        a:"<p>Ha MÁR van valódi kép, egy kapcsoló jelenik meg staffnak: <b>„🔓 userek javasolhatnak”</b> / <b>„🔒 userek nem javasolhatnak”</b> — erre koppintva ki/be kapcsolhatod. Ha még NINCS kép, a feltöltés automatikusan engedélyezett, nincs mit kapcsolni.</p>" },
      { q:"Hogyan törlöm teljesen a képet (visszaállítás „Nincs kép” állapotra)?",
        a:"<p>Ha van élő kép, egy <b>„🗑 Kép törlése”</b> gomb is megjelenik a feltöltés/csere gomb mellett — egyszerű megerősítő kérdés után törli a képet (a tárból is), és visszaáll „Nincs kép” állapotra, ami a userek felé automatikusan újra megnyitja a javaslási lehetőséget. Ugyanez a gomb komponens-képnél és a sorozat-borítóképnél is elérhető.</p>" },
    ]},

    { id:"felhasznalok", title:"Felhasználók kezelése", open:false, items:[
      { q:"Hogyan tiltok le vagy engedek vissza egy felhasználót?",
        a:"<p>A fejléc <b>👥 Felhasználók</b> gombjával nyílik a lista. Sima felhasználó sorában <b>„Letiltás”</b> / <b>„Visszaengedés”</b> gomb — a letiltás visszafordítható, a letiltott fiók bejelentkezéskor azonnal ki van zárva.</p>" },
      { q:"(csak owner) Hogyan adok vagy vonok vissza admin jogot?",
        a:"<p>Ugyanitt, a 👥 Felhasználók listában, egy sima felhasználó sorában <b>„Admin-jog megadása”</b>, egy admin sorában <b>„Admin-jog visszavonása”</b> gomb jelenik meg — de csak a tulajdonosnak. Admin ezt nem teheti meg, és a tulajdonos sora is védett, azt senki nem módosíthatja.</p>" },
    ]},

    { id:"listak", title:"Listák bővítése", open:false, items:[
      { q:"Hogyan bővítem és nevezem át a választható listákat (kiadó, komponens-típus stb.)?",
        a:"<p>A 🔧 Gyors szerkesztés eszköztárban koppints a <b>„☰ Listák”</b> gombra. Öt lista kezelhető itt: Kiadó, Komponens-típus, Azonosító típusa, Beszerzés forrása, Kategória (témakör). <b>Új érték:</b> írd be a nevét, majd „+” — az első betű automatikusan nagybetűs lesz, és a kis/nagybetűs vagy szóközös eltéréssel már meglévő érték nem vehető fel még egyszer. <b>Átnevezés:</b> az érték melletti <b>✎</b> ikonnal; csak a megjelenített név változik, a már használt értékek (sorozatok, komponensek) automatikusan az új nevet mutatják, a fülek és választók is. A listák mindenkinek közösek, a módosítás azonnali (nem megy a draft/publikálás folyamaton át). Az <b>„Egyéb”</b> a legördülőkben és választókban mindig az utolsó marad, az új értékek elé kerülnek. A bővítés csak itt lehetséges, rögzítés közben nem — így a listák nem hízhatnak el észrevétlenül.</p>" },
      { q:"Hogyan adok új témakört (Kategória) egy sorozathoz?",
        a:"<p>Az „Új sorozat javaslása” formon, illetve a Karbantartás draft-szerkesztőjében van egy <b>Kategória (témakör)</b> legördülő a Kiadó mellett — ott választhatod a meglévő témakörök egyikét. Ha egy vadonatúj témakör kell, először vedd fel a <b>„☰ Listák”</b> felületen (lásd fent), utána már választható lesz a sorozat-formon. A fülsáv-választó ez alapján csoportosítja a sorozatokat — a szín viszont továbbra is önálló, kézzel választott mező marad (érdemes a témakörhöz illő színcsaládból választani, hogy a csoportosítás vizuálisan is konzisztens legyen).</p>" },
    ]},

    { id:"torles", title:"Sorozat publikálatlanná tétele és törlése", open:false, items:[
      { q:"Hogyan veszek le (publikálatlanná teszek) egy sorozatot?",
        a:"<p>A Karbantartás Aktív sorozatok fülén, a sorozat sorában a <b>„Publikálatlanná tétel”</b> gombbal. A már kiválasztó felhasználók megtartják a hozzáférést, de újak nem választhatják be.</p>" },
      { q:"(csak owner) Hogyan törölhetek véglegesen egy sorozatot?",
        a:"<p>A Publikálatlan fülön: ha a sorozaton NINCS már aktív kiválasztás, egy egyszerű <b>„Törlés”</b> gomb azonnal, véglegesen törli. Ha VAN még aktív kiválasztás, előbb a <b>„Törlés indítása (N felhasználó érintett)”</b> gombbal kell elindítanod a folyamatot.</p>" },
      { q:"(csak owner) Mit jelent a 14 napos türelmi idő?",
        a:"<p>A törlés-indítás után a sorozat 14 napig „🗑️ törlésre jelölve” állapotban van (a badge mutatja, hány nap van hátra). Ezalatt nem választható be újonnan, nem indítható rajta szerkesztés, és az érintett, még kiválasztó felhasználók minden belépéskor kötelezően nyugtázandó figyelmeztetést kapnak.</p>" },
      { q:"(csak owner) Mit tehetek, ha lejárt a türelmi idő?",
        a:"<p>A badge „türelmi idő lejárt”-ra vált, és megjelenik a <b>„Végleges törlés”</b> gomb. Erre koppintva be kell gépelned a sorozat pontos nevét megerősítésként — utána a sorozat és minden hozzá kapcsolódó, még meglévő felhasználói adat (jelölések, árak, kiválasztások) véglegesen törlődik. Ez nem vonható vissza.</p>" },
    ]},
  ],
};
