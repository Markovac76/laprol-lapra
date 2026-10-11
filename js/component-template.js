/* ============================================================
   Sorozat komponens-sablonja (22. lépés, 2. kör / E) — TISZTA logika
   (nincs DOM/hálózat), Node-ban tesztelhető:
   scripts/tests/component-template.test.mjs

   A sablon a sorozat új Számainak kiindulása (a meglévő Számokat és komponenseket
   NEM módosítja). Egy elem:
     {tipus, main, required, id_rule: "kotelezo"|"ajanlott"|"nincs",
      default_azonosito_tipus, counts_for_color, default_megnevezes}
   Sorrend = a tömb sorrendje. Pontosan egy elem fő (★). A szerver-oldali
   ellenőrzés (component_template_error) tükörképe: templateError().
   ============================================================ */

export const ID_RULES = [["nincs","nincs"],["ajanlott","ajánlott"],["kotelezo","kötelező"]];
export const TEMPLATE_SOFT_MAX = 3;          // a sor legfeljebb 3 elemet mutat: csak figyelmeztetés

// A mostani viselkedést adó alapértelmezett sablon egy típus-listából
// (a szerver-oldali default_component_template tükre).
export function defaultTemplate(components, defaults = {}){
  const list = (components || []).filter(Boolean);
  if(!list.length) return [];
  const mainT = list.includes("magazin") ? "magazin" : list.includes("konyv") ? "konyv" : list[0];
  const onlyMag = list.filter(t=>t!=="magazin").length === 0;
  return list.map(t=>({
    tipus: t, main: t === mainT, required: true, id_rule: "nincs",
    default_azonosito_tipus: (defaults[t] && defaults[t].default_azonosito_tipus) || null,
    counts_for_color: t !== "magazin" || onlyMag, default_megnevezes: null,
  }));
}

export const hasTemplate = t => Array.isArray(t) && t.length > 0;

// null = érvényes; különben magyar hibaüzenet
export function templateError(t){
  if(!Array.isArray(t)) return "a sablon nem lista";
  if(t.length < 1) return "a sablonhoz legalább 1 komponens-típus kell";
  const seen = new Set(); let mains = 0;
  for(const el of t){
    if(!el || typeof el !== "object") return "a sablon minden eleme objektum kell legyen";
    if(!el.tipus || !String(el.tipus).trim()) return "a sablon egyik eleméből hiányzik a típus";
    if(seen.has(el.tipus)) return `a(z) „${el.tipus}” típus kétszer szerepel a sablonban`;
    seen.add(el.tipus);
    if(!["kotelezo","ajanlott","nincs"].includes(el.id_rule || "nincs")) return `érvénytelen azonosító-szabály a(z) „${el.tipus}” típusnál`;
    if(el.main) mains++;
  }
  if(mains !== 1) return `a sablonban pontosan egy típus lehet fő elem (most: ${mains})`;
  return null;
}

export const templateTypes = t => (t || []).map(e=>e.tipus);

const copy = t => t.map(e=>({...e}));

// Típus hozzáadása a sablon végére (az új elem alapértelmezései a típusleírásból).
export function addType(t, tipus, defaults = {}){
  if(t.some(e=>e.tipus === tipus)) return copy(t);
  const el = { tipus, main: t.length === 0, required: true, id_rule: "nincs",
    default_azonosito_tipus: (defaults[tipus] && defaults[tipus].default_azonosito_tipus) || null,
    counts_for_color: true, default_megnevezes: null };
  return copy(t).concat([el]);
}

// Típus eltávolítása; ha a fő elem típusa esett ki, a tartalék szabály új főt jelöl (magazin → könyv → első).
export function removeType(t, tipus){
  const out = copy(t).filter(e=>e.tipus !== tipus);
  if(out.length && !out.some(e=>e.main)){
    const m = out.find(e=>e.tipus === "magazin") || out.find(e=>e.tipus === "konyv") || out[0];
    m.main = true;
  }
  return out;
}

export function setMain(t, tipus){ return copy(t).map(e=>({ ...e, main: e.tipus === tipus })); }

export function move(t, i, dir){
  const j = i + dir;
  if(i < 0 || j < 0 || i >= t.length || j >= t.length) return copy(t);
  const out = copy(t); [out[i], out[j]] = [out[j], out[i]]; return out;
}

export function setField(t, tipus, key, value){ return copy(t).map(e=>e.tipus === tipus ? { ...e, [key]: value } : e); }

// Az új Számok kiinduló (üres) komponensei: a KÖTELEZŐ típusok, a sablon sorrendjében, az
// alapértelmezett azonosító-típussal / megnevezéssel; a fő elem a sablon fő típusa.
export function initialComponents(t){
  return (t || []).filter(e => e.required !== false).map(e=>({
    tipus: e.tipus, azonosito_tipus: e.default_azonosito_tipus || null, azonosito: "",
    megnevezes: e.default_megnevezes || "", is_main: !!e.main,
  }));
}
