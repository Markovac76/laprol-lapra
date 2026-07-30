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
