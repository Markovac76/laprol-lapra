/* ============================================================
   Változásnapló ("Újdonságok") — user-felé szóló, egyszerű nyelvű
   bejegyzések a láthatóan, mindenkit érintő változásokról. Csak azok
   a változtatások kerülnek ide, amik ténylegesen látszanak/éreztetik
   a hatásukat a felületen — nem minden apró hibajavítás.
   Legújabb elöl. Szándékosan elválasztva a UI-tól (changelog.js).
   ============================================================ */
export const CHANGELOG = [
  { date:"2026-10-16",
    text:"Karbantartóknak: a ☰ Listákban mostantól törölni is lehet egy értéket (🗑) — de csak azt, ami sehol nincs használatban. Ha igen, az üzenet megmondja, hol (pl. melyik sorozatoknál). Az „Egyéb” és a rendszer által használt típusok nem törölhetők."
  },
  { date:"2026-10-13",
    text:"Ha az alkalmazás frissül, miközben nálad nyitva van (böngészőfül vagy a telepített app), mostantól sárga sáv szól a lap tetején: „Új verzió érhető el”, egy Újratöltés gombbal. A jelöléseid addig is menthetők; a többi mentés az újratöltésig vár, hogy a régi változat ne írjon hibás adatot."
  },
  { date:"2026-10-13",
    text:"Rendbe tettük a sorozat-azonosítókat és az elemek típusát. Öt sorozatnál (Disney, Volkswagen model, Disney Hangos, Lego Star Wars, Lego Marvel) az egész sorozatra érvényes ISSN / ISBN mostantól egyszer, a sorozat fejlécében, a név alatt látszik, és nem ismétlődik minden Számon. A Disney Hangos hangfigurái „Figura” néven szerepelnek (eddig „Modell” volt), a haladásjelzőn is. A Listákban a kártya típus neve „Kártya”. A jelöléseid, a darabszámok, a színek és az összegek nem változtak, és új felkiáltójel sem keletkezett. Karbantartóknak: a „Kész” előtt mostantól a Magazinon és a Könyvön is figyelmeztetés jön, ha ugyanaz az azonosító több Számon szerepel — ami az egész sorozaté, az a „Sorozat-azonosítók” szakaszba való."
  },
  { date:"2026-10-13",
    text:"Karbantartóknak: a 🔧 Gyors szerkesztés „+ Új tétel” űrlapja megújult. Az elemek a típusuk szerinti mezőket kapják (ugyanazokat, mint a Karbantartás szerkesztőjében, a kötelezők * jelöléssel), megjelölhető a ★ fő elem, és a mentés egy lépésben történik: vagy a teljes Szám létrejön, vagy semmi. A hiányzó vagy a típusnak nem megfelelő adatokat az űrlap egyszerre sorolja fel, a beírt adat megmarad; foglalt lapszámnál is érthetően szól. A saját jelölés és beszerzési adat megadása nem kötelező. Az Excel-feltöltés új sorai ugyanezekkel a szabályokkal jönnek létre: a hibás sor kimarad, a többi feltöltődik, a végén Számonként látszik, mi nem ment át és miért."
  },
  { date:"2026-10-12",
    text:"Karbantartóknak: a Szám szerkesztője megmutatja és javíthatóvá teszi azt az adatot, ami nem felel meg az elem típusának (pl. Kártyán más azonosító-típus, Figurán azonosító) — eddig az ilyen adat rejtve maradt. A kötelező, de még üres mezők halvány kiemelést kapnak („a „Kész”-hez kell”). A sorozat-azonosító hibájára a szerkesztő már a mező elhagyásakor szól. A munkaanyag Szám-listájában az elemek sorrendje állandó: a fő elem (★) elöl, utána a sablon sorrendje. A Saját adatlapon és az „Új szám” űrlapon minden típus a rendes nevén látszik."
  },
  { date:"2026-10-12",
    text:"A sorozat fejlécében, a név alatt megjelenhet a sorozat-azonosító (az egész sorozatra érvényes ISBN vagy ISSN, pl. „ISSN 3103-4152”). A lenyitott sorban és a Saját adatlapon a név nélküli modell neve a Szám címe. Karbantartóknak: a sorozat szerkesztőjében új „Sorozat-azonosítók” szakasz (legfeljebb két ISBN / ISSN, egyszer megadva; a változása nem ad felkiáltójelet). A Szám szerkesztőjében minden elem a típusa szerinti mezőket mutatja, a kötelezők * jelöléssel: a Kártyának hét mezője van (Gyártó, Gyűjtemény, Széria, Kiadás éve, Sorozatváltozat, Kód, Név), a Figuránál a név kötelező, a Legónál és a Kártyánál az azonosító-típus rögzített, a Magazinnál és a Könyvnél csak ISBN vagy ISSN választható. A „Kész” az új és a most módosított elemek hiányzó kötelező mezőinél áll meg; a régebbi elemek hiányáról csak figyelmeztetés jön. Az oda-vissza sablon kezeli a Kártya mezőit és a sorozat-azonosítót (külön lapon)."
  },
  { date:"2026-10-12",
    text:"Új a Szám sora: az elemek (magazin, könyv, figura, lego, kártya…) csempékben, egymás mellett látszanak, legfeljebb három, az első a „fő elem” (★). Egy csempén felül a státusz-gomb az elem nevével (✓ megvan, ✕ hiányzik, – nem kell, üres kör = jelöletlen), alatta nagyobb kép (ha nincs, „kép” felirat), mellette a típus jele és a darabszám — a darabszám mostantól mindig látszik. Ha háromnál több elem van, a lenyitó nyílnál „+N” jelzi a többit. Telefonon a csempék a szöveg alá kerülnek, egy sorba. A képek élesebbek lettek, de továbbra is kicsinyítve töltődnek. A sor színe, a haladásjelzők, az összegek és a gombok működése nem változott."
  },
  { date:"2026-10-11",
    text:"Karbantartóknak: a sorozatnak mostantól komponens-sablonja van (a sorozat-szerkesztőben): típusonként állítható a sorrend, a fő elem (★), hogy kötelező-e, az azonosító-szabály (kötelező / ajánlott / nincs), az alapértelmezett azonosító-típus és hogy számít-e a Szám színébe. Az új Számok a sablonból indulnak; a meglévőket a sablon nem módosítja. Egy Számhoz bármilyen más típusú elem is hozzáadható („+ Elem hozzáadása”, pl. egy Limited Edition kártya) — az csak az adott Számra vonatkozik. A „Kész” előtt figyelmeztetés jelenik meg az ajánlott azonosító hiányáról és a duplikált azonosítókról („Mégis Kész”). Az átmeneti kompatibilitás a régi szerkesztővel (amely csak a komponens-listát módosította) megszűnt: a publikálásnál a sorozat sablonja az irányadó."
  },
  { date:"2026-10-11",
    text:"Karbantartóknak: egy komponens valóban törölhető egy Számról (a draft-szerkesztőben; a fő elem nem törölhető, és egy Számnak mindig marad legalább egy komponense). A törlés csendes — nincs felkiáltójel —, a hozzá tartozó személyes jelölések, darabszámok megmaradnak, és a komponens visszaállítható. A törölt komponens sehol nem jelenik meg: nem számít a számlálókba, a haladásjelzőkbe, a színezésbe és az összegbe."
  },
  { date:"2026-10-11",
    text:"Átrendeződött a Szám sora: az elemek (magazin, könyv, figura, lego…) most egymás alatt, legfeljebb háromig látszanak, mindegyik mellett egy kis képpel (ha nincs kép, a típus jelével) és a státusz-gombbal. Az első elem a „fő elem” (kis ★), ha háromnál több van, a lenyitó nyíl fölött „+N” jelzi a többit. A kis képek a feltöltött képek kicsinyített változatából töltődnek, így gyorsabban jönnek. A sor színe, a haladásjelzők és az összegek nem változtak."
  },
  { date:"2026-10-11",
    text:"A sorozat-listákban (📚 Sorozataim, és a Karbantartás Aktív sorozatok fülén) keresni lehet névre — kis- és nagybetűtől, ékezettől függetlenül —, és rendezni ABC szerint, legutóbb módosított szerint vagy a Számok száma szerint; a választást megjegyzi. Karbantartóknak: a munkaanyag-listákon látszik a Számok száma, a publikálás előtt pedig egy összefoglaló, mi változik (új / módosult / törölt Szám)."
  },
  { date:"2026-10-11",
    text:"Az „Összeg” kártya egységesebb lett: mindkét nézet („Eredeti ár alapján” és „Fizetett ár alapján”) ugyanazokat a Számokat adja össze — azokat, amikből legalább egy elem megvan —, és ugyanazzal a beszerzési mennyiséggel szoroz, így a kettő összevethető. Az összeg mellett látod, hány Szám alapján számolt (pl. „78 961 Ft · 39 Szám”). Az ár a Szám (a magazin) ára; a mellékletnek nincs külön ára. Ahol eddig csak a teljesen meglévő (zöld) Számok kerültek az eredeti ár szerinti összegbe — például a Lego Star Warsnál —, ott az összeg most a megvett Számok teljes eredeti árát mutatja."
  },
  { date:"2026-10-11",
    text:"A „megjelent” és a „várható” mostantól a saját időzónád (helyi) dátuma szerint dönt, és éjfélkor magától frissül. A mai dátumú szám már megjelentnek számít, nem „várhatónak” — a „Várható” szűrő és a „Következő megjelenés” is ehhez igazodik. Korábban helyi idő szerint éjfél és hajnali kettő között még a tegnapi nappal számolt, és a mai szám egyszerre volt „megjelent” és „várható”."
  },
  { date:"2026-10-11",
    text:"Karbantartóknak: az új sorozat és a sablon-feltöltés új sorai mostantól mindig megkapják a sorozat komponenseit (üresen, később kitölthetők), és a „Kész” gomb nem enged publikálni olyan új Számot, aminek egyetlen komponense sincs. Egy hiba miatt az „Autós Legendák” Számai komponens nélkül jöttek létre (nem lehetett rajtuk státuszt vagy azonosítót állítani) — ez javítva, a sorozat Számai megkapták a Könyv komponenst."
  },
  { date:"2026-10-10",
    text:"Átszámozásnál nem jelez többé felkiáltójelet a puszta sorszám-változás: ha a sorozatban a Számok sorszáma módosul (átszámozás), de a cím, a dátum vagy az ár nem, nem kapsz tételenkénti jelzést — a változás rögzítve van, az új sorszámot ott látod, ahol a sor áll. Tartalmi változásnál (cím, dátum, ár, azonosító) a felkiáltójel a szokásos módon megjelenik."},
  { date:"2026-10-10",
    text:"A választólistákban (kiadó, témakör, komponens-típus, azonosító-típus, beszerzés forrása) az „Egyéb” mostantól mindig az utolsó, az új értékek elé kerülnek. A listák értékei átnevezhetők is (pl. „kártya” → „Kártya”), a már használt helyeken automatikusan az új név látszik."},
  { date:"2026-09-01",
    text:"Új: sorozat-szintű borítókép. Sok részletsorozatnál a számozott 1-es szám előtt jár egy ingyenes bemutató-/reklámfüzet — ehhez most egy kis, önálló képhely került a sorozat nevénél (a hero-dobozban), ami nem számít bele semmilyen darabszám- vagy százalék-összesítőbe. Bárki javasolhat rá képet a saját, kiválasztott sorozatainál, ugyanúgy, mint egy komponens-képnél." },
  { date:"2026-09-01",
    text:"Valódi Kategória (témakör) mező került a sorozatokhoz — a fülsáv-választó mostantól témakörönként csoportosítva mutatja a sorozatokat (Modellek, Mese, Lego), egy-egy élénk, jól megkülönböztethető színcsaláddal (kék / piros / zöld). Új sorozat felvitelekor kiválasztható egy meglévő témakör, vagy a ☰ Listák felületen felvehető egy új." },
];
