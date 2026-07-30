/* ============================================================
   Jogosultsági segédek — EGY helyen.
   A háromszintű szerep a members táblából jön (role/status),
   amit a bejelentkezéskor töltünk be (auth.js → state.role/status).

     user  — csak saját jelölés + személyes ár-adat
     admin — + törzsadat szerkesztése, listák, import, user-letiltás
     owner — + admin-jog kiosztása; a tulajdonos sora sérthetetlen
   ============================================================ */
import { state } from "./state.js";

export const isActive     = () => state.status === "active";
export const isStaff      = () => state.role === "admin" || state.role === "owner";
export const isOwnerRole  = () => state.role === "owner" || state.isOwner;   // owner = admin-jog kiosztó
export const canEditMaster = () => isStaff() && isActive();                  // series/issues/components/lists írása
