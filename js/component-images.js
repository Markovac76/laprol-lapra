/* ============================================================
   Képfeltöltés + képjavaslat-workflow (spec 2.7) — KÉT entitás-típusra:
   komponens-kép ("component") ÉS sorozat-szintű borítókép ("series",
   az 1-es szám előtti ingyenes bemutató-füzethez). UGYANAZ a workflow
   mindkettőnél, egyetlen közös mechanizmus (image_proposals tábla,
   entity_type megkülönböztetéssel) — nincs párhuzamos, duplikált kód.

   Közös, PUBLIKUS Storage bucket ("component-images") — a kep_url/
   borito_url állandó publikus URL, cache-busting query-vel frissítve
   minden cserénél. Staff: közvetlen feltöltés/csere, bármikor,
   engedélyezés-státusztól függetlenül. User: csak javaslat, csak a
   saját kiválasztott sorozatához (vagy magához a sorozathoz) tartozó
   entitásra, max 1 függő javaslat/entitás.
   ============================================================ */
import { supabase } from "./supabase.js";
import { state } from "./state.js";
import { resizeImage } from "./image-resize.js";

const BUCKET = "component-images";

const folderOf   = type => type==="series" ? "series" : "components";
const tableOf     = type => type==="series" ? "series" : "components";
const urlColOf     = type => type==="series" ? "borito_url" : "kep_url";
const enabledColOf = type => type==="series" ? "borito_upload_enabled" : "upload_enabled";
const idColOf       = type => type==="series" ? "series_id" : "component_id";

function livePath(type, id){ return `${folderOf(type)}/${id}/live.jpg`; }
function proposedPath(type, id, proposalId){ return `${folderOf(type)}/${id}/proposed/${proposalId}.jpg`; }

function publicUrl(path){
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Staff: közvetlen feltöltés/csere — a törzsadat-draft/publikálás-ciklustól
// FÜGGETLEN, azonnal az élő komponensre/sorozatra hat (spec 2.7).
export async function uploadLiveImage(type, id, file){
  const blob = await resizeImage(file);
  const path = livePath(type, id);
  const { error: uerr } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType:"image/jpeg", upsert:true });
  if(uerr) throw uerr;
  const url = publicUrl(path) + "?v=" + Date.now();
  const { error } = await supabase.from(tableOf(type)).update({ [urlColOf(type)]: url }).eq("id", id);
  if(error) throw error;
}

// Staff: élő kép törlése — visszaáll "Nincs kép" állapotra. A tárból is
// takarítunk (ne maradjon árva fájl), de a fájl hiánya nem akadályozza a
// mező nullázását (ugyanaz az elv, mint rejectProposal-nál). "Nincs kép"
// állapotnál a feltöltés/javaslás usereknek is mindig engedélyezett — ehhez
// nem kell külön beállítás, a meglévő "nincs kép" feltétel automatikusan
// érvényesül a megjelenítésnél.
export async function deleteLiveImage(type, id){
  await supabase.storage.from(BUCKET).remove([livePath(type, id)]);
  const { error } = await supabase.from(tableOf(type)).update({ [urlColOf(type)]: null }).eq("id", id);
  if(error) throw error;
}

export async function setUploadEnabled(type, id, enabled){
  const { error } = await supabase.from(tableOf(type)).update({ [enabledColOf(type)]: enabled }).eq("id", id);
  if(error) throw error;
}

// User: javaslat beküldése. Előbb a sor (hogy legyen proposal.id az útvonalhoz),
// hiba esetén a sor törlődik, hogy ne maradjon "pending" DB-sor fájl nélkül.
export async function proposeImage(type, id, file){
  const payload = { entity_type: type, proposed_by: state.myId, [idColOf(type)]: id };
  const { data: prop, error: perr } = await supabase.from("image_proposals").insert(payload).select().single();
  if(perr) throw perr;
  try{
    const blob = await resizeImage(file);
    const path = proposedPath(type, id, prop.id);
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
// másolat törlődik, a kép-mező frissül. Nincs értesítés a usernek.
export async function approveProposal(proposal){
  const type = proposal.entity_type || "component";
  const id = proposal[idColOf(type)];
  const from = proposedPath(type, id, proposal.id);
  const { data: blob, error: dlerr } = await supabase.storage.from(BUCKET).download(from);
  if(dlerr) throw dlerr;
  const to = livePath(type, id);
  const { error: uperr } = await supabase.storage.from(BUCKET).upload(to, blob, { contentType:"image/jpeg", upsert:true });
  if(uperr) throw uperr;
  await supabase.storage.from(BUCKET).remove([from]);
  const url = publicUrl(to) + "?v=" + Date.now();
  const { error: cerr } = await supabase.from(tableOf(type)).update({ [urlColOf(type)]: url }).eq("id", id);
  if(cerr) throw cerr;
  const { error: perr } = await supabase.from("image_proposals")
    .update({ status:"approved", decided_at:new Date().toISOString(), decided_by: state.myId }).eq("id", proposal.id);
  if(perr) throw perr;
}

// Staff: elutasítás — a javasolt kép törlődik a tárból, marad a régi (vagy
// "nincs kép"). Nincs értesítés a usernek.
export async function rejectProposal(proposal){
  const type = proposal.entity_type || "component";
  const id = proposal[idColOf(type)];
  const path = proposedPath(type, id, proposal.id);
  await supabase.storage.from(BUCKET).remove([path]);
  const { error } = await supabase.from("image_proposals")
    .update({ status:"rejected", decided_at:new Date().toISOString(), decided_by: state.myId }).eq("id", proposal.id);
  if(error) throw error;
}

export { publicUrl, proposedPath };
