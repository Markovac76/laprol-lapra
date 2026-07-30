/* ============================================================
   Jogosultsági segédek — EGY helyen, hogy a következő lépésben
   (members.role: user/admin/owner) könnyen bővíthető legyen.

   Jelenleg a korábbi viselkedést tükrözi 1:1-ben: "staff" = a
   tulajdonos; mindenki aktív. A háromszintű szerep bekötésekor
   ezek a members-táblából olvasott role/status-ra állnak át.
   ============================================================ */
import { state } from "./state.js";

export const isStaff      = () => state.isOwner;   // admin/owner majd itt bővül
export const isActive     = () => true;
export const canEditMaster = () => state.isOwner;  // törzsadat (series/issues/components/lists) írása
