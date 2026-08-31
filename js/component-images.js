/* ============================================================
   Képfeltöltés + képjavaslat-workflow (spec 2.7). Közös, PUBLIKUS
   Storage bucket ("component-images") — a kep_url állandó publikus
   URL, cache-busting query-vel frissítve minden cserénél.
   Staff: közvetlen feltöltés/csere, bármikor, engedélyezés-státusztól
   függetlenül. User: csak javaslat, csak a saját kiválasztott
   sorozatához tartozó komponensre, max 1 függő javaslat/komponens.
   ============================================================ */
import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { resizeImage } from "./image-resize.js";

const BUCKET = "component-images";

function livePath(componentId){ return `components/${componentId}/live.jpg`; }
function proposedPath(componentId, proposalId){ return `components/${componentId}/proposed/${proposalId}.jpg`; }

function publicUrl(path){
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Staff: közvetlen feltöltés/csere — a törzsadat-draft/publikálás-ciklustól
// FÜGGETLEN, azonnal az élő komponensre hat (spec 2.7).
export async function uploadLiveImage(componentId, file){
  const blob = await resizeImage(file);
  const path = livePath(componentId);
  const { error: uerr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType:"image/jpeg", upsert:true });
  if(uerr) throw uerr;
  const url = publicUrl(path) + "?v=" + Date.now();
  const { error } = await supabase.from("components").update({ kep_url: url }).eq("id", componentId);
  if(error) throw error;
}

// Staff: élő kép törlése — visszaáll "Nincs kép" állapotra. A tárból is
// takarítunk (ne maradjon árva fájl), de a fájl hiánya nem akadályozza a
// kep_url nullázását (ugyanaz az elv, mint rejectProposal-nál). "Nincs kép"
// állapotnál a feltöltés/javaslás usereknek is mindig engedélyezett — ehhez
// nem kell külön beállítás, a meglévő !c.kep_url feltétel automatikusan
// érvényesül a megjelenítésnél.
export async function deleteLiveImage(componentId){
  await supabase.storage.from(BUCKET).remove([livePath(componentId)]);
  const { error } = await supabase.from("components").update({ kep_url: null }).eq("id", componentId);
  if(error) throw error;
}

export async function setUploadEnabled(componentId, enabled){
  const { error } = await supabase.from("components").update({ upload_enabled: enabled }).eq("id", componentId);
  if(error) throw error;
}

// User: javaslat beküldése. Előbb a sor (hogy legyen proposal.id az útvonalhoz),
// hiba esetén a sor törlődik, hogy ne maradjon "pending" DB-sor fájl nélkül.
export async function proposeImage(componentId, file){
  const { data: prop, error: perr } = await supabase.from("image_proposals")
    .insert({ component_id: componentId, proposed_by: state.myId }).select().single();
  if(perr) throw perr;
  try{
    const blob = await resizeImage(file);
    const path = proposedPath(componentId, prop.id);
    const { error: uerr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType:"image/jpeg", upsert:true });
    if(uerr) throw uerr;
  }catch(e){
    await supabase.from("image_proposals").delete().eq("id", prop.id);
    throw e;
  }
  return prop;
}

// Staff: jóváhagyás — a javasolt kép átkerül az élő útvonalra (letöltve,
// majd feltöltve, mert a Storage copy() alapból nem ír felül), a javasolt
// másolat törlődik, kep_url frissül. Nincs értesítés a usernek.
export async function approveProposal(proposal){
  const from = proposedPath(proposal.component_id, proposal.id);
  const { data: blob, error: dlerr } = await supabase.storage.from(BUCKET).download(from);
  if(dlerr) throw dlerr;
  const to = livePath(proposal.component_id);
  const { error: uperr } = await supabase.storage.from(BUCKET).upload(to, blob, { contentType:"image/jpeg", upsert:true });
  if(uperr) throw uperr;
  await supabase.storage.from(BUCKET).remove([from]);
  const url = publicUrl(to) + "?v=" + Date.now();
  const { error: cerr } = await supabase.from("components").update({ kep_url: url }).eq("id", proposal.component_id);
  if(cerr) throw cerr;
  const { error: perr } = await supabase.from("image_proposals")
    .update({ status:"approved", decided_at:new Date().toISOString(), decided_by: state.myId }).eq("id", proposal.id);
  if(perr) throw perr;
}

// Staff: elutasítás — a javasolt kép törlődik a tárból, marad a régi (vagy
// "nincs kép"). Nincs értesítés a usernek.
export async function rejectProposal(proposal){
  const path = proposedPath(proposal.component_id, proposal.id);
  await supabase.storage.from(BUCKET).remove([path]);
  const { error } = await supabase.from("image_proposals")
    .update({ status:"rejected", decided_at:new Date().toISOString(), decided_by: state.myId }).eq("id", proposal.id);
  if(error) throw error;
}

export { publicUrl, proposedPath };
