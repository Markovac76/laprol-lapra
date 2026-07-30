/* ============================================================
   Megosztott állapot, konstansok és tiszta segédfüggvények.
   A mutálható állapot EGY objektumban él (state.X = …), mert
   modulok közt importált `let` bindinget nem lehet újra-értékadni.
   ============================================================ */

export const OWNER_UID = "25cb3724-02d4-4002-98b0-c93f74ef4e42";

export const state = {
  SERIES: [], activeIdx: 0, filter: "mind", query: "", adminMode: false,
  LISTS: {}, costVisible: false, openIssue: null, tabsOpen: false,
  myId: null, isOwner: false,
};

export const PAL_FAMILIES = [
  {nev:"Kék",    szinek:["#2f5f8f","#3a6ea5","#4f8ac4","#6ea6dd"]},
  {nev:"Vörös",  szinek:["#a8202b","#d21f2b","#e04c47","#eb7a6b"]},
  {nev:"Lila",   szinek:["#5b3d96","#7b52b8","#9a72d4","#b795e6"]},
  {nev:"Zöld",   szinek:["#1f7a5e","#2e9e8f","#4fbf9b","#6bbf59"]},
  {nev:"Barna",  szinek:["#8a4f22","#c9772e","#d99a4e","#b0504d"]},
  {nev:"Magenta",szinek:["#9c3a78","#c94f9e","#dd7ab6","#8a7dd6"]},
];
export const PAL12 = PAL_FAMILIES.flatMap(f=>f.szinek);   // visszafelé kompatibilis, sík lista
export const DISPLAY_MAX = 16;
export const COMP_TYPES = {magazin:"Magazin",modell:"Modell",konyv:"Könyv",egyeb:"Egyéb"};
export const PAL_FALLBACK = "#3a6ea5";
export const HU_MON = ["jan.","febr.","márc.","ápr.","máj.","jún.","júl.","aug.","szept.","okt.","nov.","dec."];
export const todayISO = new Date().toISOString().slice(0,10);

export const fmtDate = iso => { if(!iso) return null; const [y,m,d]=iso.split("-").map(Number); return `${y}. ${HU_MON[m-1]} ${d}.`; };
export const fmtFt = n => n==null ? null : n.toLocaleString("hu-HU").replace(/,/g," ")+" Ft";
export const pad = (x,l) => String(x).padStart(l,"0");
export const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
export const S = () => state.SERIES[state.activeIdx];

/* ---- Listatár-segédek (a state.LISTS-re épülnek) ---- */
export const opts = (tipus,sel) => (state.LISTS[tipus]||[]).map(o=>`<option value="${esc(o.ertek)}"${o.ertek===sel?" selected":""}>${esc(o.nev)}</option>`).join("");
export const listName = (tipus,ertek) => { const o=(state.LISTS[tipus]||[]).find(x=>x.ertek===ertek); return o?o.nev:(ertek||""); };

/* ---- Tiszta domén-logika: státusz-körforgás, komponens-hierarchia, lapszám-állapot ---- */

// Ha még jelöletlen → első koppintás "megvan". Utána a három állapot körbe (jelöletlenre nem tér vissza).
export function nextStatus(cur){
  if(!cur) return "megvan";
  const o=["megvan","hianyzik","nemkell"];
  return o[(o.indexOf(cur)+1)%o.length];
}

// Hierarchia: a nem-magazin komponens dominál; ha csak egy van, az.
export function dominantType(s){
  const nm=s.components.filter(t=>t!=="magazin");
  return nm.length ? nm[0] : (s.components[0]||null);
}

export function issueState(it,s){
  if(it.date && it.date>todayISO) return null;                  // még nem jelent meg → semleges
  const dt=dominantType(s); if(!dt) return null;
  const d=(it.comps[dt]&&it.comps[dt].status)||null;
  if(!d) return null;                                           // domináns jelöletlen → semleges
  if(d==="megvan") return "megvan";                             // zöld
  if(d==="nemkell") return "nemkell";                           // szürke
  const mag = s.components.includes("magazin") ? ((it.comps.magazin&&it.comps.magazin.status)||null) : null;
  return mag==="megvan" ? "reszleges" : "hianyzik";             // sárga, ha a magazin megvan; egyébként piros
}
