/* ============================================================
   Súgó — TARTALOM (kérdés–válasz párok, kategóriákba rendezve).
   Szándékosan elválasztva a UI-logikától (help.js) — ha csak a
   szöveget kell javítani/bővíteni, ide elég nyúlni.

   VÁZLAT-ÁLLAPOT: a 17 kategória mind megvan a helyén (cím + fül-
   beosztás jóváhagyásra), de egyelőre csak 1-2 minta-kérdés van
   kitöltve — a teljes tartalom a váz jóváhagyása után kerül bele,
   a tényleges élő felület alapján (nem a specifikációból másolva).
   ============================================================ */

export const HELP_CONTENT = {
  user: [
    { id:"kezdo", title:"Kezdő lépések", open:true, items:[
      { q:"Mi az a Sorozat, Szám és Komponens?",
        a:"<p>A <b>Sorozat</b> egy gyűjthető újságsorozat (pl. „II VH Repülők”). Minden sorozat <b>Számokból</b> áll (a lapszámok, pl. #1, #2…), és minden Szám egy vagy több <b>Komponensből</b> — ilyen lehet a magazin maga, egy hozzá tartozó modell, könyv, vagy más melléklet. Ezt láthatod a lista minden sorában: a lapszám mellett annyi ikonos gomb van, ahány komponensből az a szám áll.</p>" },
    ]},
    { id:"sorozataim", title:"Sorozataim", open:false, items:[] },
    { id:"jeloles", title:"Jelölés és státuszok", open:false, items:[] },
    { id:"arak", title:"Árak", open:false, items:[] },
    { id:"kereses", title:"Keresés és szűrés", open:false, items:[] },
    { id:"kepek", title:"Képek", open:false, items:[] },
    { id:"valtozasok", title:"Változás-értesítések", open:false, items:[] },
    { id:"uj-javaslat", title:"Új sorozat javaslása", open:false, items:[] },
    { id:"osszesitok", title:"Belekerülési költség és összesítők", open:false, items:[] },
  ],
  admin: [
    { id:"karbantartas-attekintes", title:"Karbantartás áttekintés", open:true, items:[
      { q:"Mire való a 🗂️ Karbantartás gomb?",
        a:"<p>Ez staff-only (admin/owner) menüpont, innen kezelhető a sorozatok teljes életútja. Három fület tartalmaz: <b>Aktív sorozatok</b> (a már publikáltak), <b>Munka sorozatok</b> (a beérkezett javaslatok és folyamatban lévő szerkesztések) és <b>Publikálatlan</b> (a levett sorozatok).</p>" },
    ]},
    { id:"eletciklus", title:"Sorozat-életciklus", open:false, items:[] },
    { id:"sorozat-szerk", title:"Sorozat szerkesztése", open:false, items:[] },
    { id:"excel-import", title:"Excel-import", open:false, items:[] },
    { id:"kepjavaslatok", title:"Képjavaslatok elbírálása", open:false, items:[] },
    { id:"felhasznalok", title:"Felhasználók kezelése", open:false, items:[] },
    { id:"listak", title:"Listák bővítése", open:false, items:[] },
    { id:"torles", title:"Sorozat publikálatlanná tétele és törlése", open:false, items:[] },
  ],
};
