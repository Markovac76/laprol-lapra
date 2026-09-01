/* ============================================================
   Változásnapló ("Újdonságok") — user-felé szóló, egyszerű nyelvű
   bejegyzések a láthatóan, mindenkit érintő változásokról. Csak azok
   a változtatások kerülnek ide, amik ténylegesen látszanak/éreztetik
   a hatásukat a felületen — nem minden apró hibajavítás.
   Legújabb elöl. Szándékosan elválasztva a UI-tól (changelog.js).
   ============================================================ */
export const CHANGELOG = [
  { date:"2026-09-01",
    text:"Új: sorozat-szintű borítókép. Sok részletsorozatnál a számozott 1-es szám előtt jár egy ingyenes bemutató-/reklámfüzet — ehhez most egy kis, önálló képhely került a sorozat nevénél (a hero-dobozban), ami nem számít bele semmilyen darabszám- vagy százalék-összesítőbe. Bárki javasolhat rá képet a saját, kiválasztott sorozatainál, ugyanúgy, mint egy komponens-képnél." },
  { date:"2026-09-01",
    text:"Valódi Kategória (témakör) mező került a sorozatokhoz — a fülsáv-választó mostantól témakörönként csoportosítva mutatja a sorozatokat (Modellek, Mese, Lego), egy-egy élénk, jól megkülönböztethető színcsaláddal (kék / piros / zöld). Új sorozat felvitelekor kiválasztható egy meglévő témakör, vagy a ☰ Listák felületen felvehető egy új." },
];
