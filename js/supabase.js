/* ============================================================
   Supabase kliens + konfiguráció.
   A beállítások a külön config.js fájlból jönnek (window-globálok),
   amit a Vercel-build generál — azt NEM kell szerkeszteni frissítéskor.
   (Mintát lásd: config.example.js)
   ============================================================ */
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = window.SUPABASE_URL || "https://jwiujuxvymzxjpphrgip.supabase.co";
export const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || "hianyzik", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: "laprol-lapra-auth" }
});

// Supabase/PostgREST alapból max. 1000 sort ad vissza egy .select()-re,
// range() nélkül — HIBAÜZENET NÉLKÜL vágja le a többit (élesben ez okozott
// egy súlyos, nehezen észrevehető hibát: a member_seen tábla egy aktív
// usernél 1000+ sor volt, a levágott sorok "sosem látott"-nak tűntek,
// holott a DB-ben helyes bejegyzés volt rájuk — lásd allapot-osszefoglalo.md).
// Minden olyan lekérdezésnél kötelező, ahol a sorszám elvben átlépheti
// az 1000-et (akár egy aktív felhasználónál, akár egy nagy sorozatnál,
// akár app-szintű összesítésnél). queryFactory: () => supabase.from(...)... —
// FRISS query-builder minden lapozási körhöz, mert egy már lekérdezett
// builder nem hívható újra .range()-dzsel.
export async function fetchAllRows(queryFactory, pageSize = 1000){
  let all = [], from = 0;
  while(true){
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if(error) return { data: null, error };
    if(!data || !data.length) break;
    all = all.concat(data);
    if(data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all, error: null };
}
