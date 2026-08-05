/* ============================================================
   Súgó — TARTALOM (kérdés–válasz párok, kategóriákba rendezve).
   Szándékosan elválasztva a UI-logikától (help.js) — ha csak a
   szöveget kell javítani/bővíteni, ide elég nyúlni.

   A szöveg a TÉNYLEGES felületet/kódot tükrözi (nem a specifikáció
   tervezési nyelvét) — gombfeliratok, ikonok, pontos folyamat-lépések
   az élő appból.
   ============================================================ */

export const HELP_CONTENT = {
  user: [
    { id:"kezdo", title:"Kezdő lépések", open:true, items:[
      { q:"Mi az a Sorozat, Szám és Komponens?",
        a:"<p>A <b>Sorozat</b> egy gyűjthető újságsorozat (pl. „II VH Repülők”). Minden sorozat <b>Számokból</b> áll (a lapszámok, pl. #1, #2…), és minden Szám egy vagy több <b>Komponensből</b> — ilyen lehet a magazin maga, egy hozzá tartozó modell, könyv, vagy más melléklet. Ezt láthatod a lista minden sorában: a lapszám mellett annyi ikonos gomb van, ahány komponensből az a szám áll.</p>" },
      { q:"Hogyan jelentkezem be?",
        a:"<p>A bejelentkező képernyőn add meg az e-mail címed és a jelszavad, majd nyomd meg a <b>Belépés</b> gombot. Ha még nincs fiókod, a <b>Regisztrálj</b> linkkel hozhatsz létre egyet — utána ugyanezzel az e-maillel/jelszóval jelentkezz be. A bejelentkezés tartós, telefonon nem kell újra és újra belépned.</p>" },
      { q:"Mit jelentenek a fejléc gombjai?",
        a:"<p>Balról jobbra, amit mindenki lát: <b>📚 Sorozataim</b> (melyik sorozatokat követed), <b>❓ Súgó</b> (ez itt), és <b>⎋</b> (kijelentkezés). Ha staff (admin/tulajdonos) vagy, további gombok is megjelennek — ezekről az Adminisztrátori fülön olvashatsz.</p>" },
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
    ]},

    { id:"jeloles", title:"Jelölés és státuszok", open:false, items:[
      { q:"Hogyan jelölöm meg, hogy megvan egy szám?",
        a:"<p>Koppints a lapszám sorában a komponens ikonjára (pl. a magazin ikonjára). Az első koppintás <b>megvan</b>-ra állítja. További koppintásokra körbeforog: megvan → hiány → nem kell → megvan… Jelöletlenre nem tér vissza magától — ahhoz szerkesztő ablak kell (staff-funkció).</p>" },
      { q:"Mit jelentenek a lapszám színei?",
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
        a:"<p>Amikor egy tételnél először jelölsz meg legalább egy komponenst „megvan”-ra, és még nincs saját fizetett árad rajta, a rendszer automatikusan az eredeti árat írja be. Ha ezt utána kézzel átírod, a kézi érték megmarad. Ha az összes jelölésedet visszavonod arról a tételről, és az ár még mindig az automatikus volt, visszaáll „nem ismert”-re — a kézzel beírt árat viszont sosem törli.</p>" },
      { q:"Hogyan írom át kézzel a saját fizetett áramat?",
        a:"<p>Nyisd le a sor képsávját, majd a fizetett ár melletti <b>✎</b> ikonra koppintva megnyílik a „Saját beszerzési adatok” ablak — itt állíthatod a fizetett árat (vagy jelölheted „nem ismert”-nek), a beszerzési mennyiséget, a dátumot és a forrást.</p>" },
      { q:"Mit jelent a „nem ismert” felirat egy árnál?",
        a:"<p>Azt, hogy nincs rögzített érték — nem hiba vagy üres mező, egyszerűen még nem tudod (vagy nem adtad meg) az árat. Ez a hero-doboz összegzésénél <b>„+ nem ismert”</b> jelzésként is megjelenhet, ha van ilyen tételed.</p>" },
    ]},

    { id:"kereses", title:"Keresés és szűrés", open:false, items:[
      { q:"Hogyan keresek egy adott számra?",
        a:"<p>A keresőmezőbe írd be a lapszámot (pontos találat) vagy a cím egy részletét (részleges egyezés is működik).</p>" },
      { q:"Mit jelentenek a szűrő-gombok?",
        a:"<p><b>Mind</b> — minden tétel; <b>Megvan / Hiányzik / Nem kell</b> — csak azok a tételek, amiknek legalább egy komponense az adott státuszban van; <b>Várható</b> — csak a még meg nem jelent, jövőbeli számok (ez a gomb csak akkor látszik, ha van ilyen a sorozatban).</p>" },
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
    ]},

    { id:"valtozasok", title:"Változás-értesítések", open:false, items:[
      { q:"Mit jelent a felkiáltójel (!) a fülemen vagy egy tételnél?",
        a:"<p>Azt jelzi, hogy a staff módosított valamit egy közös adaton (pl. cím, dátum, ár, azonosító), amit korábban már láttál egy másik állapotában. Három helyen bukkanhat fel: a sorozat fülének sarkán (ha bármi változott a sorozaton belül), a sorozat neve mellett (ha maga a sorozat adata változott), vagy egy tétel sorszáma mellett (ha az a tétel vagy annak komponense változott).</p>" },
      { q:"Mit csinál az OK és a Mégse gomb a változás-ablakban?",
        a:"<p>A felkiáltójelre koppintva megnyílik egy ablak, ami mezőnként mutatja: „régi érték → új érték”. <b>OK, nyugtázom</b> — tudomásul veszed, a jelzés eltűnik. <b>Mégse</b> — bezárja az ablakot, de a felkiáltójel megmarad, később is megnézheted.</p>" },
      { q:"Mi az a gyűjtött elfogadás gomb?",
        a:"<p>A szűrő-gombok sorának jobb szélén, egy önálló „!” gomb jelenik meg, ha a sorozaton belül bárhol van el nem fogadott változás. Erre koppintva egy listában látod az ÖSSZES változást egyszerre, és egy „Mind elfogadom” gombbal egyszerre nyugtázhatod mindet — nem kell tételenként külön.</p>" },
    ]},

    { id:"uj-javaslat", title:"Új sorozat javaslása", open:false, items:[
      { q:"Hogyan javasoljak egy teljesen új sorozatot?",
        a:"<p>A <b>📚 Sorozataim</b> ablak alján van egy <b>„+ Új sorozat javaslása”</b> gomb. Itt megadhatod a kiadót, a sorozat nevét, a fülön megjelenő rövid nevet, a színét és hogy miből áll egy szám (pl. magazin + modell). A <b>„Javaslat beküldése”</b> gombbal küldheted el.</p>" },
      { q:"Mi történik a javaslatommal a beküldés után?",
        a:"<p>Bekerül a staff „feldolgozásra váró” listájába (a Karbantartás menüpontba) — a staff nézi át, egészíti ki a tételekkel/számokkal, és publikálja, ha kész. Amíg ez nem történik meg, a sorozat nem jelenik meg senki fülsávjában, a Sorozataim választóban sem.</p>" },
    ]},

    { id:"osszesitok", title:"Belekerülési költség és összesítők", open:false, items:[
      { q:"Hogyan nézem meg, mennyibe került eddig a sorozatom?",
        a:"<p>A sorozat tetején lévő doboz „összeg megjelenítése” gombjára koppintva megjelenik az összesített ár, két nézet közt választhatsz: <b>Eredeti ár</b> (mit ér a gyűjteményed a hivatalos árak alapján) és <b>Fizetett ár</b> (amennyit te ténylegesen kifizettél). Az „elrejt” gombbal visszazárhatod — sorozatváltáskor amúgy is automatikusan visszaáll rejtettre.</p>" },
      { q:"Mit jelent a „Következő megjelenés” vagy a „Beszerzendő” doboz?",
        a:"<p>Ha van még jövőbeli, meg nem jelent szám a sorozatban, a dátumát és címét mutatja. Ha nincs (a sorozat „lezárt”), helyette azt mutatja, hány hiányzó vagy jelöletlen lapszámod van még — ezekre érdemes vadászni.</p>" },
      { q:"Mit mutatnak a haladás-sávok?",
        a:"<p>Komponens-típusonként (pl. külön a magazinokra, külön a modellekre) mutatják, hány darab van meg a teljesből, és ennek százalékát.</p>" },
    ]},
  ],

  admin: [
    { id:"karbantartas-attekintes", title:"Karbantartás áttekintés", open:true, items:[
      { q:"Mire való a 🗂️ Karbantartás gomb?",
        a:"<p>Ez staff-only (admin/tulajdonos) menüpont, innen kezelhető a sorozatok teljes életútja. Három fület tartalmaz: <b>Aktív sorozatok</b> (a már publikáltak), <b>Munka sorozatok</b> (a beérkezett javaslatok és folyamatban lévő szerkesztések) és <b>Publikálatlan</b> (a levett sorozatok).</p>" },
      { q:"Miben más ez, mint a 🔧 Gyors szerkesztés gomb?",
        a:"<p>A 🔧 gomb a lista soraiban egy ✎ ikont jelenít meg, amivel egy tételt (és a komponenseit) rögtön, közvetlenül szerkeszthetsz vagy törölhetsz — ez a leggyorsabb út egy elgépelés vagy hiányzó adat pótlására. A Karbantartás ezzel szemben a <b>teljes, végigkövetett</b> utat kínálja: draftot nyit, amit publikálni kell, és csak publikáláskor kapják meg a felhasználók a felkiáltójel-jelzést a változásról. A 🔧-vel végzett gyors szerkesztés <b>azonnal élesbe kerül, verziókövetés és felkiáltójel-jelzés nélkül</b> — erről bővebben lásd „Sorozat szerkesztése” alább.</p>" },
    ]},

    { id:"eletciklus", title:"Sorozat-életciklus", open:false, items:[
      { q:"Milyen állapotokon megy át egy sorozat?",
        a:"<p><b>Beérkezett</b> (valaki beküldte, senki nem foglalta le) → <b>Munkaanyag</b> (valaki „felvette”, csak ő szerkesztheti) → <b>Publikálásra váró</b> (kész, publikálásra vár) → <b>Aktív</b> (élesben, mindenki látja) → <b>Publikálatlan</b> (a staff levette, de a korábbi kiválasztók megtartják a hozzáférést).</p>" },
      { q:"Hogyan veszek fel („claim-elek”) egy beérkezett javaslatot?",
        a:"<p>A Munka sorozatok fülön, a Beérkezett csoportban minden tételnél van egy <b>„Felveszem”</b> gomb. Ez rád zárolja — amíg nálad van, más staff nem nyúlhat hozzá (a Munkaanyag csoportban „🔒 [név] dolgozik rajta” felirattal látják).</p>" },
      { q:"Mi történik, ha elengedem a foglalást?",
        a:"<p>A Munkaanyag alatti tételnél az <b>„Elengedem”</b> gombra kattintva a tétel visszakerül lock nélküli Beérkezett állapotba, a addigi munkával együtt — bárki más felveheti onnantól.</p>" },
      { q:"Mi az a 20-as korlát?",
        a:"<p>A Beérkezett és a Munkaanyag csoportok tételei EGYÜTT max. 20 darabot tehetnek ki (ezt mutatja a fül felirata: „Munka sorozatok (N/20)”). A Publikálásra váró és a Publikálatlan tételek nem számítanak bele.</p>" },
      { q:"Mi a különbség az „Új javaslat” és a „Szerkesztés” tétel között?",
        a:"<p>Az <b>„Új javaslat”</b> egy vadonatúj sorozat (user vagy staff küldte be sablonnal) — ez az egyetlen út, ahogy új sorozat egyáltalán a rendszerbe kerülhet. A <b>„Szerkesztés”</b> egy már élő, publikált sorozaton indított módosítás — ilyenkor az élő verzió közben zavartalanul, változatlanul elérhető marad mindenki másnak, amíg a szerkesztés folyik.</p>" },
    ]},

    { id:"sorozat-szerk", title:"Sorozat szerkesztése", open:false, items:[
      { q:"Hogyan indítok szerkesztést egy már élő sorozaton?",
        a:"<p>A Karbantartás Aktív sorozatok fülén, a sorozat sorában koppints a <b>„Szerkesztés indítása”</b> gombra. Ez azonnal létrehoz egy másolatot (draftot) az összes tételéről/komponenséről, és átkerül a Munka sorozatok fülre, rád claim-elve.</p>" },
      { q:"Mi az a draft, és ki látja?",
        a:"<p>A draft egy munkaanyag-másolat — csak a Karbantartásban, csak a claim-elő staff-tagnak látszik, amíg publikálva nincs. A draft-nézetben mind a sorozat mezői (kiadó, név, szín, komponens-készlet), mind az egyes tételek listája szerkeszthető.</p>" },
      { q:"Hogyan adok hozzá vagy szerkesztek egy tételt a draftban?",
        a:"<p>A draft-szerkesztő nézet alján a <b>„+ Új tétel”</b> gombbal vehetsz fel újat, vagy egy meglévő tételnél a <b>„Szerkesztés”</b> gombbal módosíthatod (lapszám, cím, dátum, eredeti ár, komponensenkénti azonosító). Ez a draftot módosítja, NEM az élő adatot.</p>" },
      { q:"Mi történik publikáláskor?",
        a:"<p>Ha a draft kész, a Munkaanyag fülön a <b>„Kész”</b> gombbal átteszed Publikálásra váróba, ott pedig a <b>„Publikálás”</b> gombbal élesíted. Ekkor a rendszer mezőnként összeveti a draftot az élő adattal, minden változott mezőről feljegyzést készít, és mindenkinek, akit érint, felkiáltójel-jelzést ad — ez a végigkövetett, „mindenki tudomást szerez róla” útja a szerkesztésnek.</p>" },
      { q:"Van ennél gyorsabb út egy apró javításra?",
        a:"<p>Igen — a 🔧 Gyors szerkesztés gomb bekapcsolásával minden sorban megjelenik egy ✎ ikon, amire koppintva rögtön szerkesztheted vagy törölheted a tételt, draft és publikálás nélkül. <b>Fontos:</b> ez a mód KÖZVETLENÜL, azonnal élesbe teszi a módosítást — a verziókövetés és a felkiáltójel-jelzés ezen NEM megy át, tehát a többi felhasználó nem kap értesítést a változásról. Kisebb elgépelések gyors javítására való; ha azt szeretnéd, hogy mindenki lássa a felkiáltójelet, a fenti, draft-alapú utat használd.</p>" },
    ]},

    { id:"excel-import", title:"Excel-import", open:false, items:[
      { q:"Hogyan töltök le sablont?",
        a:"<p>Válaszd ki a sorozatot a fülsávban, majd a 🔧 Gyors szerkesztés eszköztárban koppints az <b>„⬇ Sablon”</b> gombra (csak asztali/laptop nézetben érhető el, telefonon nem). A letöltött Excel fájl oszlopai a kiválasztott sorozat komponens-készletéhez igazodnak.</p>" },
      { q:"Mit jelentenek a sablon oszlopai?",
        a:"<p>Lapszám, cím, dátum, eredeti ár, majd személyes fizetett ár, aztán komponensenként két oszlop: „státusz” (megvan/hianyzik/nemkell) és „azonosító”.</p>" },
      { q:"Mi történik feltöltéskor, ha a sor egy MEGLÉVŐ tételre vonatkozik?",
        a:"<p>A cím/dátum/eredeti ár/azonosító módosítás egy szerkesztési <b>draftba</b> kerül — ugyanúgy, mintha a Karbantartásban kézzel indítottad volna a szerkesztést, tehát publikálni kell, mielőtt élesbe kerülne, és a felhasználók a szokásos felkiáltójel-jelzést kapják. A fizetett ár és a komponens-státusz (a te saját jelölésed) viszont AZONNAL frissül, draft nélkül — ez sosem törzsadat.</p>" },
      { q:"Mi történik egy ÚJ tétellel (ami még nincs a listában)?",
        a:"<p>Azonnal, közvetlenül létrejön élesben — nincs mit megvédeni rajta, hiszen még senkinek nincs saját adata ezen a tételen.</p>" },
      { q:"Mikor kapok hibaüzenetet feltöltéskor?",
        a:"<p>Ha valaki más már szerkeszti ugyanazt a sorozatot a Karbantartásban (foglalva van nála), vagy ha az a szerkesztés már „Publikálásra váró” állapotban van — ilyenkor egyértelmű hibaüzenettel leáll az import, hogy ne ütközzön bele a folyamatban lévő munkába.</p>" },
    ]},

    { id:"kepjavaslatok", title:"Képjavaslatok elbírálása", open:false, items:[
      { q:"Hol találom a függő képjavaslatokat?",
        a:"<p>Nyisd le annál a tételnél a képsávot, aminél van javaslat — staffnak egy kis 📷 jelzés is megjelenik a lenyitó (▾) gombon, ha az adott tételen vár elbírálásra javaslat.</p>" },
      { q:"Hogyan fogadom el vagy utasítom el egy javaslatot?",
        a:"<p>A lenyitott képsávban a jelenlegi kép mellett/helyett megjelenik a javasolt kép előnézete, alatta <b>„Elfogad”</b> és <b>„Elutasít”</b> gombbal. Elfogadáskor a javasolt kép azonnal lecseréli az élőt; elutasításkor a régi kép (vagy „nincs adat”) marad.</p>" },
      { q:"Kap-e értesítést a felhasználó a döntésről?",
        a:"<p>Nem, szándékosan nincs külön értesítés — a user egyszerűen legközelebb látja az eredményt (az új képet, vagy hogy nem változott semmi).</p>" },
      { q:"Hogyan engedélyezem vagy tiltom le a képfeltöltést egy komponensen?",
        a:"<p>Ha a komponensen MÁR van valódi kép, egy kapcsoló jelenik meg staffnak: <b>„🔓 userek javasolhatnak”</b> / <b>„🔒 userek nem javasolhatnak”</b> — erre koppintva ki/be kapcsolhatod. Ha a komponensen még NINCS kép, a feltöltés automatikusan engedélyezett, nincs mit kapcsolni.</p>" },
    ]},

    { id:"felhasznalok", title:"Felhasználók kezelése", open:false, items:[
      { q:"Hogyan tiltok le vagy engedek vissza egy felhasználót?",
        a:"<p>A fejléc <b>👥 Felhasználók</b> gombjával nyílik a lista. Sima felhasználó sorában <b>„Letiltás”</b> / <b>„Visszaengedés”</b> gomb — a letiltás visszafordítható, a letiltott fiók bejelentkezéskor azonnal ki van zárva.</p>" },
      { q:"(csak owner) Hogyan adok vagy vonok vissza admin jogot?",
        a:"<p>Ugyanitt, a 👥 Felhasználók listában, egy sima felhasználó sorában <b>„Admin-jog megadása”</b>, egy admin sorában <b>„Admin-jog visszavonása”</b> gomb jelenik meg — de csak a tulajdonosnak. Admin ezt nem teheti meg, és a tulajdonos sora is védett, azt senki nem módosíthatja.</p>" },
    ]},

    { id:"listak", title:"Listák bővítése", open:false, items:[
      { q:"Hogyan bővítem a választható listákat (kiadó, komponens-típus stb.)?",
        a:"<p>A 🔧 Gyors szerkesztés eszköztárban koppints a <b>„☰ Listák”</b> gombra. Négy lista bővíthető itt: Kiadó, Komponens-típus, Azonosító típusa, Beszerzés forrása — mindegyiknél egy szövegmezőbe írd be az új értéket, majd a „+” gombbal add hozzá. A bővítés csak itt lehetséges, rögzítés közben nem — így a listák nem hízhatnak el észrevétlenül.</p>" },
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
