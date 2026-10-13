/* ============================================================
   Verzióellenőrzés: a régi kódot futtató fül / telepített app jelzése és az írások tiltása.
   A futó kód verziója a config.js-ből jön (window.APP_VERSION — a build írja, az app fájljainak
   tartalom-ujjlenyomata), a szerveré a verzio.json-ból. Helyi futtatásnál nincs APP_VERSION →
   az egész kikapcsol: nem kérdez, nem jelez, nem tilt.
   KÉNYELMI réteg: a valódi zár a szerver-oldali jogszűkítés (specifikáció 13.14.9–13.14.10).
   Tiszta részei (judge, isBlocked, a listák) Node-ban tesztelve: scripts/tests/version.test.mjs.
   Élesben kipróbálva 2026-10-13-án (46. lépés): egy újabb telepítés után a nyitva hagyott fül szól.
   ============================================================ */
const CURRENT = (typeof window !== "undefined" && window.APP_VERSION) || "";
const MIN_GAP = 60000;                 // legfeljebb percenként egy lekérdezés
const TIMEOUT = 4000;                  // ennyit vár a verzio.json-ra
let stale = null;                      // null, vagy {v, tilt}, ha a szerveren más verzió van
let lastCheck = 0, inFlight = null;
const listeners = [];

/* ---- A kliens függvényhívásainak (rpc) besorolása. MINDEN .rpc("…") hívásnak szerepelnie kell
        valamelyik listában — a gépi próba elbukik, ha egy új hívás besorolás nélkül marad.
        Ami egyik listában sincs, az régi kódnál TILTOTT (a biztonságos irány). ---- */
// (a) olvasó jellegű: csak számol / ellenőriz, semmit nem ír — SOHA nem tiltott
export const RPC_OLVASO = ["draft_ready_warnings", "draft_lapszam_conflicts"];
// (b) személyes: a hívó saját sorait írja — „torzs” szinten megy, „minden” szinten tiltott
export const RPC_SZEMELYES = ["seed_member_seen"];
// (c) minden más: törzsadatot / munkaanyagot ír — régi kódnál tiltott
export const RPC_TILTOTT = ["create_live_issue", "start_edit_draft", "apply_draft_upload", "mark_draft_ready", "return_draft_to_edit",
  "publish_draft_series", "start_force_delete", "finalize_delete_series", "propose_bulk_issues", "seed_issue_seen_for_subscribers"];

// A személyes táblák: a felhasználó saját sorai (jelölés, darabszám, jegyzet, ár, feliratkozás, „látott”).
export const SZEMELYES_TABLAK = ["member_status", "member_issue_data", "member_seen", "member_series"];

/* ---- A Storage (képek) hívásainak besorolása — a kliens-könyvtár metódusnevei szerint. ---- */
export const STORAGE_OLVASO = ["getPublicUrl", "download", "list", "createSignedUrl", "createSignedUrls"];   // soha nem tiltott
export const STORAGE_IRO = ["upload", "remove", "update", "move", "copy"];                                    // régi kódnál tiltott

// TISZTA döntés: csak érvényes, a futó kódtól ELTÉRŐ válaszra ad vissza „régi” állapotot.
export function judge(current, body){
  if(!current) return null;                                   // helyi futtatás: nincs ellenőrzés
  if(!body || typeof body !== "object") return null;
  const v = typeof body.v === "string" ? body.v.trim() : "";
  if(!v || v === current) return null;
  return { v, tilt: body.tilt === "minden" ? "minden" : "torzs" };
}

// TISZTA döntés: régi kódnál tiltott-e a kérés. tilt: "torzs" (a személyes mentés megy) | "minden".
export function isBlocked(method, url, tilt){
  const m = String(method || "GET").toUpperCase();
  let p; try { p = new URL(url).pathname; } catch (_) { return false; }
  if(p.startsWith("/auth/v1/")) return false;                 // bejelentkezés, a belépés megújítása, kilépés
  if(p.startsWith("/storage/v1/")){
    if(m === "GET" || m === "HEAD") return false;             // letöltés
    if(p.startsWith("/storage/v1/object/list/") || p.startsWith("/storage/v1/object/sign/")) return false;   // lista, aláírt cím: POST, de olvasás
    return true;                                              // feltöltés, törlés, mozgatás
  }
  if(!p.startsWith("/rest/v1/")) return false;
  if(p.startsWith("/rest/v1/rpc/")){                          // a függvényhívás mindig POST → a NEVE dönt, nem a módszer
    const fn = p.slice(13).split("/")[0];
    if(RPC_OLVASO.includes(fn)) return false;
    if(RPC_SZEMELYES.includes(fn)) return tilt === "minden";
    return true;
  }
  if(m === "GET" || m === "HEAD") return false;               // tábla olvasása
  return SZEMELYES_TABLAK.includes(p.slice(9).split("/")[0]) ? tilt === "minden" : true;
}

// A szerver verziójának lekérdezése. Hiba, időtúllépés, hibás válasz: nem jelez, nem tilt.
export async function checkVersion(force = false){
  if(!CURRENT || stale) return stale;
  const now = Date.now();
  if(!force && now - lastCheck < MIN_GAP) return stale;
  if(inFlight) return inFlight;
  lastCheck = now;
  inFlight = (async () => {
    try{
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT);
      const r = await fetch("verzio.json?t=" + now, { cache: "no-store", signal: ctl.signal });
      clearTimeout(t);
      if(!r.ok) return null;
      const s = judge(CURRENT, await r.json());
      if(s){ stale = s; listeners.forEach(f => { try{ f(s); }catch(_){} }); }
    }catch(_){ /* hálózat, időtúllépés, nem JSON */ }
    finally{ inFlight = null; }
    return stale;
  })();
  return inFlight;
}
export const onStale = f => { listeners.push(f); if(stale) f(stale); };

export const STALE_MESSAGE = "Új verzió érhető el — töltsd újra az oldalt, utána a mentés menni fog. Amit most az űrlapba írtál, az újratöltéskor elvész: ha kell, előbb másold ki.";

// A Supabase-kliens kéréseinek kapuja. Tiltott kérésnél SEMMI nem megy ki a hálózatra: a kliens egy
// hibaválaszt kap, amit a meglévő hibakezelés (err → „Hiba: …”) változatlanul megjelenít.
export function gatedFetch(baseFetch = (...a) => fetch(...a)){
  return async (input, init = {}) => {
    if(CURRENT){
      const url = typeof input === "string" ? input : input.url;
      const method = init.method || (typeof input !== "string" && input.method) || "GET";
      // Írás előtti ellenőrzés CSAK a „torzs” szinten is tiltott kérésekre: a személyes mentés (jelölés,
      // darabszám, jegyzet, ár) soha nem vár a verzióellenőrzésre, a folyamatban lévő lekérdezésre sem.
      if(!stale && isBlocked(method, url, "torzs")) await checkVersion();
      if(stale && isBlocked(method, url, stale.tilt))
        return new Response(JSON.stringify({ message: STALE_MESSAGE, code: "LL_REGI_VERZIO", details: null, hint: null }),
          { status: 409, headers: { "Content-Type": "application/json" } });
    }
    return baseFetch(input, init);
  };
}
