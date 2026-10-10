/* ============================================================
   Változásnapló ("Újdonságok") — user-felé szóló, egyszerű nyelvű
   bejegyzések a láthatóan, mindenkit érintő változásokról. Csak azok
   a változtatások kerülnek ide, amik ténylegesen látszanak/éreztetik
   a hatásukat a felületen — nem minden apró hibajavítás.
   Legújabb elöl. Szándékosan elválasztva a UI-tól (changelog.js).
   ============================================================ */
export const CHANGELOG = [
  { date:"2026-10-10",
    text:"Átszámozásnál nem jelez többé felkiáltójelet a puszta sorszám-változás: ha a sorozatban a Számok sorszáma módosul (átszámozás), de a cím, a dátum vagy az ár nem, nem kapsz tételenkénti jelzést — a változás rögzítve van, az új sorszámot ott látod, ahol a sor áll. Tartalmi változásnál (cím, dátum, ár, azonosító) a felkiáltójel a szokásos módon megjelenik."},
  { date:"2026-10-10",
    text:"A választólistákban (kiadó, témakör, komponens-típus, azonosító-típus, beszerzés forrása) az „Egyéb” mostantól mindig az utolsó, az új értékek elé kerülnek. A listák értékei átnevezhetők is (pl. „kártya” → „Kártya”), a már használt helyeken automatikusan az új név látszik."},
  { date:"2026-09-01",
    text:"Új: sorozat-szintű borítókép. Sok részletsorozatnál a számozott 1-es szám előtt jár egy ingyenes bemutató-/reklámfüzet — ehhez most egy kis, önálló képhely került a sorozat nevénél (a hero-dobozban), ami nem számít bele semmilyen darabszám- vagy százalék-összesítőbe. Bárki javasolhat rá képet a saját, kiválasztott sorozatainál, ugyanúgy, mint egy komponens-képnél." },
  { date:"2026-09-01",
    text:"Valódi Kategória (témakör) mező került a sorozatokhoz — a fülsáv-választó mostantól témakörönként csoportosítva mutatja a sorozatokat (Modellek, Mese, Lego), egy-egy élénk, jól megkülönböztethető színcsaláddal (kék / piros / zöld). Új sorozat felvitelekor kiválasztható egy meglévő témakör, vagy a ☰ Listák felületen felvehető egy új." },
];
