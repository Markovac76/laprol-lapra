-- ============================================================================
-- LAPRÓL LAPRA — HIBAJAVÍTÁSI KÖR, 11. pont: sablon-alapú tömeges tétel-
-- feltöltés az "Új sorozat javaslása" köztes lépéséhez.
-- Futtatás: Supabase SQL Editor. Idempotens.
--
-- Miért kell SQL: a draft_issues/draft_components RLS-szabálya ("all")
-- kizárólag is_staff()-ot enged írni — ez helyes a Karbantartás-beli
-- draft-szerkesztésre (mindig staff, mindig már claim-elt munkaanyag),
-- DE az "Új sorozat javaslása" formot bárki használhatja, MÉG A STAFF
-- ÁLTALI ÁTVÉTEL ELŐTT (pool_status='incoming', claimed_by is null) —
-- ott a beküldő saját magának nem tudna a sablonnal tételt felvinni.
--
-- Ezért ez a SECURITY DEFINER függvény a normál RLS-t megkerülve, DE
-- saját, szűk jogosultság-ellenőrzéssel enged tömeges beszúrást: csak a
-- javaslat EREDETI beküldője, és csak amíg a javaslat még nincs
-- feldolgozás alatt (nem claim-elt, "incoming" állapotú).
-- A Karbantartás draft-szerkesztője (már claim-elt munkaanyag, staff)
-- továbbra is a meglévő, közvetlen draft_issues/draft_components
-- insertet használja — arra ez a függvény nem vonatkozik.
-- ============================================================================

create or replace function public.propose_bulk_issues(p_draft_id uuid, p_rows jsonb)
  returns json language plpgsql security definer set search_path = public as $$
declare
  d             public.draft_series%rowtype;
  row_data      jsonb;
  comp          jsonb;
  new_issue_id  uuid;
  existing_nums int[];
  lsz           int;
  inserted      int := 0;
  skipped       int := 0;
begin
  select * into d from public.draft_series where id = p_draft_id;
  if not found then raise exception 'A javaslat nem található.'; end if;
  if d.submitted_by is distinct from auth.uid() then
    raise exception 'Csak a saját javaslatodhoz tölthetsz fel sablont.';
  end if;
  if d.pool_type <> 'new' or d.pool_status <> 'incoming' or d.claimed_by is not null then
    raise exception 'Ez a javaslat már feldolgozás alatt van — a tömeges feltöltés csak beküldés után, a staff általi átvétel előtt lehetséges.';
  end if;

  select array_agg(lapszam) into existing_nums from public.draft_issues where draft_series_id = p_draft_id;

  for row_data in select * from jsonb_array_elements(p_rows) loop
    lsz := (row_data->>'lapszam')::int;
    if existing_nums is not null and lsz = any(existing_nums) then
      skipped := skipped + 1; continue;
    end if;
    insert into public.draft_issues (draft_series_id, lapszam, cim, megjelenes, eredeti_ar)
    values (p_draft_id, lsz, row_data->>'cim',
            nullif(row_data->>'megjelenes','')::date, (row_data->>'eredeti_ar')::int)
    returning id into new_issue_id;
    for comp in select * from jsonb_array_elements(coalesce(row_data->'comps','[]'::jsonb)) loop
      insert into public.draft_components (draft_issue_id, tipus, azonosito, source_component_id)
      values (new_issue_id, comp->>'tipus', nullif(comp->>'azonosito',''), null);
    end loop;
    existing_nums := array_append(existing_nums, lsz);
    inserted := inserted + 1;
  end loop;

  return json_build_object('inserted', inserted, 'skipped', skipped);
end;
$$;
grant execute on function public.propose_bulk_issues(uuid, jsonb) to authenticated;

-- Kész.
