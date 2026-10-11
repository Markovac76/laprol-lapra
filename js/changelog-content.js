/* ============================================================
   Változásnapló ("Újdonságok") — user-felé szóló, egyszerű nyelvű
   bejegyzések a láthatóan, mindenkit érintő változásokról. Csak azok
   a változtatások kerülnek ide, amik ténylegesen látszanak/éreztetik
   a hatásukat a felületen — nem minden apró hibajavítás.
   Legújabb elöl. Szándékosan elválasztva a UI-tól (changelog.js).
   ============================================================ */
export const CHANGELOG = [
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
