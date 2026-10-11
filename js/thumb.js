/* ============================================================
   Kis képek (a Szám-sor elem-helyein) és típus-piktogramok.
   Tiszta modul (nincs DOM/hálózat) — scripts/tests/thumb.test.mjs.

   thumbUrl(): a feltöltött komponens-kép KICSINYÍTETT változatának címe a
   Supabase Storage saját átméretezésével (/render/image/…?width=…). Ez NEM
   külön fájl: a kicsinyítést a Storage végzi kéréskor (≈2 KB egy 170 KB-os
   kép helyett). Ha a végpont nem elérhető, a hívó (render.js) az eredeti
   képre esik vissza.
   ============================================================ */

const OBJ = "/storage/v1/object/public/";
const REN = "/storage/v1/render/image/public/";

// px: a kért (négyzetes) doboz; a kép nem vágódik (contain). Az átméretezés
// csak a Supabase public-bucket címekre megy; minden más cím változatlan.
export function thumbUrl(url, px = 64){
  if(!url || typeof url !== "string") return url || "";
  const i = url.indexOf(OBJ);
  if(i < 0) return url;
  const head = url.slice(0, i), rest = url.slice(i + OBJ.length);
  const [path, query = ""] = rest.split("?");
  const keep = query ? query + "&" : "";
  return `${head}${REN}${path}?${keep}width=${px}&height=${px}&resize=contain&quality=70`;
}

// ---- piktogramok (beágyazott SVG, külső függőség nélkül) -------------------
const P = {
  magazin: '<path d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
  konyv:   '<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/><path d="M9 7h6"/>',
  figura:  '<circle cx="12" cy="6" r="3"/><path d="M6.5 21v-5.5A3.5 3.5 0 0 1 10 12h4a3.5 3.5 0 0 1 3.5 3.5V21"/><path d="M9.5 21v-4M14.5 21v-4"/>',
  modell:  '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  lego:    '<path d="M4 11h16v8H4z"/><path d="M7 11V8.5h3V11M14 11V8.5h3V11"/>',
  karta:   '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 15.5l2.5-3 2 2 2-2.5"/><circle cx="9.5" cy="8" r="1.2"/>',
  cd:      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M12 3a9 9 0 0 1 6 2.3"/>',
  poszter: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 16l5-5 4 4 3-3 6 5"/><circle cx="16" cy="9" r="1.3"/>',
  matrica: '<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.4 6.8 19.2l1-5.9L3.5 9.2l5.9-.8z"/>',
  egyeb:   '<path d="M4 8h16v11H4z"/><path d="M4 8l2-4h12l2 4"/><path d="M12 4v15"/>',
};
export const ICON_KEYS = Object.keys(P);

// A Listák komponens-típus azonosítói (ertek) és néhány várható típus → piktogram.
// Az azonosítók ékezet nélküliek, a régi csonkolt (pl. "krtya") változatot is ismerjük.
const ALIAS = {
  magazin:"magazin", ujsag:"magazin",
  konyv:"konyv", knyv:"konyv", konyvecske:"konyv", fuzet:"konyv",
  figura:"figura", minifigura:"figura",
  modell:"modell", auto:"modell", repulo:"modell",
  lego:"lego",
  karta:"karta", kartya:"karta", krtya:"karta",
  cd:"cd", dvd:"cd", hangoskonyv:"cd", hangos:"cd", hanglemez:"cd",
  poszter:"poszter", plakat:"poszter",
  matrica:"matrica", sticker:"matrica",
};
const fold = s => String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]/g,"");
export function iconKey(tipus){ return ALIAS[fold(tipus)] || "egyeb"; }
export function typeIcon(tipus){ return `<svg viewBox="0 0 24 24" aria-hidden="true">${P[iconKey(tipus)]}</svg>`; }
