/* ============================================================
   Megosztott állapot, konstansok és tiszta segédfüggvények.
   A mutálható állapot EGY objektumban él (state.X = …), mert
   modulok közt importált `let` bindinget nem lehet újra-értékadni.
   ============================================================ */

export const OWNER_UID = "25cb3724-02d4-4002-98b0-c93f74ef4e42";

export const state = {
  SERIES: [], activeIdx: 0, filter: "mind", query: "", adminMode: false,
  LISTS: {}, TYPEDEFS: {}, costVisible: false, costBasis: "eredeti", openIssue: null, tabsOpen: false,
  myId: null, isOwner: false, role: "user", status: "active",
};

// Kék/Vörös/Zöld — kategória-tematizáláshoz bővítve (Modellek/Mese/Lego,
// v1.15/v1.16): egyenletes világosság-lépcső, MAGAS szaturációval
// ("élénk" színek, v1.16-os finomítás — az első próbálkozás túl hasonlónak/
// fakónak bizonyult). A Mese témakör a MEGLÉVŐ Vörös családot kapja (az
// már eleve élénk piros) — nincs rá külön "Piros" család.
export const PAL_FAMILIES = [
  {nev:"Kék",    szinek:["#123d6e","#1a579e","#2275d3","#4b91e2","#7bafea"]},
  {nev:"Vörös",  szinek:["#a8202b","#d21f2b","#e04c47","#eb7a6b"]},
  {nev:"Lila",   szinek:["#5b3d96","#7b52b8","#9a72d4","#b795e6"]},
  {nev:"Zöld",   szinek:["#16692b","#1c8235","#22a041","#27b94c","#31d359","#4ad96e","#68df85","#81e49a"]},
  {nev:"Barna",  szinek:["#8a4f22","#c9772e","#d99a4e","#b0504d"]},
  {nev:"Magenta",szinek:["#611f49","#9b3174","#c8519c","#da8bbd"]},
];
export const PAL12 = PAL_FAMILIES.flatMap(f=>f.szinek);   // visszafelé kompatibilis, sík lista
export const DISPLAY_MAX = 16;
export const COMP_TYPES = {magazin:"Magazin",modell:"Modell",konyv:"Könyv",egyeb:"Egyéb"};
export const PAL_FALLBACK = "#3a6ea5";
export const HU_MON = ["jan.","febr.","márc.","ápr.","máj.","jún.","júl.","aug.","szept.","okt.","nov.","dec."];
// A mai nap a FELHASZNÁLÓ helyi időzónájában (ÉÉÉÉ-HH-NN) — NEM UTC, és nem
// betöltéskor befagyasztott érték: minden híváskor friss. (A korábbi UTC-s,
// betöltéskor rögzített érték helyi 00:00–02:00 között még "tegnap" volt, a
// fülön hagyva pedig napokig az lett volna.)
export const localISO = (d=new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export const today = () => localISO();
// Egy dátum akkor "jövőbeli" (még nem jelent meg / "Várható"), ha SZIGORÚAN a
// mai nap utáni. A mai dátumú Szám MEGJELENT. Minden "megjelent / jövőbeli /
// várható" döntés ezt használja, hogy a szűrő, a dátum-jelzés, a színezés és a
// "következő megjelenés" ugyanazt jelentse.
export const isFutureDate = iso => !!iso && iso > localISO();

export const fmtDate = iso => { if(!iso) return null; const [y,m,d]=iso.split("-").map(Number); return `${y}. ${HU_MON[m-1]} ${d}.`; };
export const fmtFt = n => n==null ? null : n.toLocaleString("hu-HU").replace(/,/g," ")+" Ft";
export const pad = (x,l) => String(x).padStart(l,"0");
export const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
export const S = () => state.SERIES[state.activeIdx];

/* ---- Listatár-segédek (a state.LISTS-re épülnek) ---- */
export const opts = (tipus,sel) => (state.LISTS[tipus]||[]).map(o=>`<option value="${esc(o.ertek)}"${o.ertek===sel?" selected":""}>${esc(o.nev)}</option>`).join("");
// "Egyéb" mindig az utolsó a megjelenítésben (legördülők, választók, Listák menü) —
// az adatbázisbeli vagy memóriabeli sorrendtől függetlenül (13. pont). A többi
// érték relatív sorrendje változatlan.
const isEgyeb = o => !!o && (o.ertek==="egyeb" || String(o.nev||"").trim().toLowerCase()==="egyéb");
export const sortEgyebLast = arr => { const a=arr||[]; return a.filter(o=>!isEgyeb(o)).concat(a.filter(isEgyeb)); };
// Listaérték megjelenített neve: szóközök egységesítve, az első betű nagybetűs (11. pont).
export const capFirst = s => { const t=String(s==null?"":s).trim().replace(/\s+/g," "); return t ? t.charAt(0).toLocaleUpperCase("hu-HU")+t.slice(1) : t; };
// Új listaérték azonosítója: ékezet nélküli, kisbetűs [a-z0-9_]. A MEGLÉVŐ azonosítókat
// (pl. "krtya") nem bántjuk — csak az újak lesznek olvashatók.
export const slugify = nev => String(nev==null?"":nev).normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,"");
export const listName = (tipus,ertek) => { const o=(state.LISTS[tipus]||[]).find(x=>x.ertek===ertek); return o?o.nev:(ertek||""); };

/* ---- Tiszta domén-logika: státusz-körforgás, komponens-hierarchia, lapszám-állapot ---- */

// Ha még jelöletlen → első koppintás "megvan". Utána a három állapot körbe (jelöletlenre nem tér vissza).
export function nextStatus(cur){
  if(!cur) return "megvan";
  const o=["megvan","hianyzik","nemkell"];
  return o[(o.indexOf(cur)+1)%o.length];
}

// it.comps[tipus] mostantól TÖMB (egy típusból több, egyedi Megnevezésű
// példány is lehet egy Számon) — ez a segéd mindig tömböt ad vissza, üres
// tömböt is, sose undefined-et.
export const compsOfType = (it,t) => (it.comps && it.comps[t]) || [];
export const allComps = it => Object.values(it.comps||{}).flat();
export const findCompById = (it,id) => allComps(it).find(c=>c.id===id) || null;

// ---- Szám-sor elem-helyei (1. kör / A) -----------------------------------
// Egy Szám ÖSSZES komponens-példánya (típus-sorrendben: előbb a sorozat
// deklarált típusai a listájuk sorrendjében, utána az esetleges egyéb
// típusok ABC szerint; típuson belül a létrehozás sorrendje). A visszatérési
// elem {t: típus, c: komponens, legacyIdx: 1-től, a régi (típus-sorrendi)
// pozíció — a komponens-kód (pl. 012-0001-02) ebből számolódik, hogy a fő elem
// előre vétele ne változtassa meg).
export function orderedComps(it, s){
  const declared = (s && s.components) || [];
  const extra = Object.keys((it && it.comps) || {}).filter(t=>!declared.includes(t)).sort();
  const out = [];
  declared.concat(extra).forEach(t=>{ compsOfType(it,t).forEach(c=>out.push({t, c, legacyIdx: out.length+1})); });
  return out;
}

// A FŐ ELEM (★): a komponensen jelölt (is_main), ennek hiányában a tartalék
// szabály — van magazin: az első magazin; nincs: az első könyv; az sincs: az
// első komponens (a fenti sorrend szerint). Egy Számon legfeljebb egy.
export function mainEntry(pairs){
  if(!pairs.length) return null;
  return pairs.find(p=>p.c && p.c.is_main) || pairs.find(p=>p.t==="magazin") || pairs.find(p=>p.t==="konyv") || pairs[0];
}

export const typeLabel = t => COMP_TYPES[t] || listName("komponens", t) || t;

// A sor elem-helyei: a fő elem az első, utána a többi a fenti sorrendben;
// legfeljebb `max` látszik, a többit a `extra` számolja ("+N"). A címke:
// megnevezés, különben a típus neve (több azonos típusnál "Típus #N").
export function issueSlots(it, s, max = 3){
  const pairs = orderedComps(it, s);
  const main = mainEntry(pairs);
  const counts = {}, seen = {};
  pairs.forEach(p=>{ counts[p.t] = (counts[p.t]||0) + 1; });
  const withLabel = pairs.map(p=>{
    seen[p.t] = (seen[p.t]||0) + 1;
    const nm = p.c && p.c.megnevezes ? String(p.c.megnevezes) : null;
    return { ...p, isMain: p === main, label: nm || (counts[p.t] > 1 ? `${typeLabel(p.t)} #${seen[p.t]}` : typeLabel(p.t)) };
  });
  const sorted = main ? [withLabel.find(p=>p.isMain)].concat(withLabel.filter(p=>!p.isMain)) : withLabel;
  return { all: sorted, shown: sorted.slice(0, max), extra: Math.max(0, sorted.length - max) };
}

// "Legrosszabb eset nyer": egy típus (vagy típusok) összes példánya közül az
// összesített állapot — hiányzik a legrosszabb, utána jelöletlen, utána nem
// kell, a legjobb a megvan. Egyetlen példánynál ez pontosan a példány saját
// állapotát adja vissza (nincs viselkedésváltozás a mai, egy-komponenses esetben).
export function worstStatus(instances){
  if(!instances.length) return null;
  if(instances.some(c=>c.status==="hianyzik")) return "hianyzik";
  if(instances.some(c=>!c.status)) return null;
  if(instances.some(c=>c.status==="nemkell")) return "nemkell";
  return "megvan";
}

// Legalább egy komponens-PÉLDÁNY 'megvan' — ekkor tekintjük a tételt ténylegesen
// megvettnek (ettől függ a "fizetve" felirat és a "Fizetett ár alapján" összeg).
export function hasOwnedComponent(it,s){
  return allComps(it).some(c=>c.status==="megvan");
}

// A Szám színe a "számít a színnél" típus(ok) összes példányának együttes állapotából jön
// ("legrosszabb eset nyer", 6.3–6.4). Ha a sorozatnak van komponens-sablonja, a sablon
// `counts_for_color` jelzője dönt; sablon nélkül (régi adat / teszt) a korábbi szabály:
// a domináns típusok a magazinon kívüliek (ha csak magazin van, az). A sablonban nem
// szereplő (egy Számhoz külön hozzáadott) típus a színt NEM befolyásolja. Ha a Számon
// nincs a színnél számító komponens, a domináns az összes komponens.
export function colorTypeSets(s){
  const tmpl = s && Array.isArray(s.template) && s.template.length ? s.template : null;
  if(tmpl){
    return { color:new Set(tmpl.filter(e=>e.counts_for_color!==false).map(e=>e.tipus)),
             non:new Set(tmpl.filter(e=>e.counts_for_color===false).map(e=>e.tipus)) };
  }
  const types=(s&&s.components)||[]; const nm=types.filter(t=>t!=="magazin"); const dom=nm.length?nm:types;
  return { color:new Set(dom), non:new Set(types.filter(t=>!dom.includes(t))) };
}
export function issueState(it,s){
  if(isFutureDate(it.date)) return null;                        // még nem jelent meg → semleges
  const { color, non } = colorTypeSets(s);
  const pairs = Object.entries(it.comps||{}).flatMap(([t,arr])=>(arr||[]).map(c=>({t,c})));
  let dom = pairs.filter(p=>color.has(p.t)).map(p=>p.c);
  if(!dom.length) dom = pairs.map(p=>p.c);                      // nincs ilyen → az összes komponens
  const d = worstStatus(dom);
  if(!d) return null;                                           // domináns jelöletlen → semleges
  if(d==="megvan") return "megvan";                             // zöld
  if(d==="nemkell") return "nemkell";                           // szürke
  const m = worstStatus(pairs.filter(p=>non.has(p.t)).map(p=>p.c));
  return m==="megvan" ? "reszleges" : "hianyzik";               // sárga, ha a nem számító elemek (ma: a magazin) megvannak; egyébként piros
}
