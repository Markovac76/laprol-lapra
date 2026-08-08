/* ============================================================
   Személyes adatok mentése (a bejelentkezett felhasználóé).
   Jelenleg: member_status (státusz / darabszám / jegyzet, komponensenként).
   A következő lépésben ide kerül a member_issue_data (szám-szintű
   személyes ár-adatok) upsertje is.
   ============================================================ */
import { supabase } from "./supabase.js";
import { state, hasOwnedComponent } from "./state.js";

export async function upsertMyStatus(componentId, fields){
  const { error } = await supabase.from("member_status")
    .upsert({ user_id: state.myId, component_id: componentId, ...fields }, { onConflict: "user_id,component_id" });
  return error;
}

// Szám-szintű személyes ár-adat (fizetett ár, beszerzési mennyiség, dátum, forrás).
export async function upsertMyIssueData(issueId, fields){
  const { error } = await supabase.from("member_issue_data")
    .upsert({ user_id: state.myId, issue_id: issueId, ...fields }, { onConflict: "user_id,issue_id" });
  return error;
}

// Egy törölt Szám elfogadásakor (a felkiáltójel OK gombja) a SAJÁT adatok
// törlése erről a Számról — komponensenkénti státusz/darabszám/jegyzet és a
// szám-szintű beszerzési adat. Mást (más userek adatát, a törzsadatot) nem érint.
export async function purgeMyDataForIssue(issueId, componentIds){
  if(componentIds && componentIds.length){
    await supabase.from("member_status").delete().eq("user_id",state.myId).in("component_id",componentIds);
  }
  await supabase.from("member_issue_data").delete().eq("user_id",state.myId).eq("issue_id",issueId);
}

// Automatikus fizetett-ár kitöltés / nullázás egy tétel megvan-állapotának változásakor.
// prevOwned = volt-e ≥1 'megvan' komponens a változás ELŐTT. A hívó a jelölés/léptetés
// mentése UTÁN hívja (a komponens állapota ekkor már a friss). Mutálja az it-et is.
export async function applyAutoPrice(it, s, prevOwned){
  const nowOwned = hasOwnedComponent(it, s);
  // Először válik megvetté ÉS még nincs fizetett ár → auto-kitöltés az eredeti árból ("nem ismert" öröklődik).
  if(!prevOwned && nowOwned && it.fizetett_ar==null){
    it.fizetett_ar = (it.eredeti_ar==null ? null : it.eredeti_ar);
    it.ar_auto = true;
    return upsertMyIssueData(it.id, { fizetett_ar: it.fizetett_ar, ar_auto: true });
  }
  // Minden 'megvan' visszavonva ÉS az ár AUTO volt → visszaáll "nem ismert"-re (a kézit megőrizzük).
  if(prevOwned && !nowOwned && it.ar_auto && it.fizetett_ar!=null){
    it.fizetett_ar = null;
    return upsertMyIssueData(it.id, { fizetett_ar: null, ar_auto: true });
  }
  return null;
}
