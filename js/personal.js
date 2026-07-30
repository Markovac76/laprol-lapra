/* ============================================================
   Személyes adatok mentése (a bejelentkezett felhasználóé).
   Jelenleg: member_status (státusz / darabszám / jegyzet, komponensenként).
   A következő lépésben ide kerül a member_issue_data (szám-szintű
   személyes ár-adatok) upsertje is.
   ============================================================ */
import { supabase } from "./supabase.js";
import { state } from "./state.js";

export async function upsertMyStatus(componentId, fields){
  const { error } = await supabase.from("member_status")
    .upsert({ user_id: state.myId, component_id: componentId, ...fields }, { onConflict: "user_id,component_id" });
  return error;
}
