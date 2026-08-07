-- ============================================================================
-- LAPRÓL LAPRA — HIBAJAVÍTÁSI KÖR, 10. pont: force-törlés korai lezárása
-- Futtatás: Supabase SQL Editor. Idempotens.
--
-- Döntés: a 14 napos türelmi idő kizárólagos célja az aktív kiválasztók
-- védelme — ha időközben MINDENKI leválasztja magát a sorozatról (aktív
-- kiválasztás 0-ra csökken), a végleges törlés owner számára AZONNAL
-- elérhetővé válik, nem kell kivárni a hátralévő napokat. A védőháló
-- (admin-szerkesztés megszakítja/újraindítja a folyamatot) változatlan.
-- ============================================================================

create or replace function public.finalize_delete_series(p_series_id uuid, p_confirm_name text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare
  s public.series%rowtype;
  active_cnt int;
begin
  if public.my_role() <> 'owner' then
    raise exception 'Csak a tulajdonos törölhet véglegesen.';
  end if;
  select * into s from public.series where id = p_series_id;
  if not found then raise exception 'A sorozat nem található.'; end if;
  if s.lifecycle <> 'unpublished' then
    raise exception 'Csak publikálatlan sorozat törölhető.';
  end if;
  select count(*) into active_cnt from public.member_series where series_id = p_series_id and is_selected = true;

  if s.force_delete_requested_at is null then
    if active_cnt > 0 then
      raise exception 'Van még aktív kiválasztás — előbb a törlési folyamatot kell indítani (start_force_delete, 14 napos türelmi idő).';
    end if;
    -- 0 aktív kiválasztás, nincs türelmi idő folyamatban: azonnali törlés.
  else
    -- Türelmi idő alatt is végrehajtható, ha időközben 0-ra csökkent az aktív kiválasztás.
    if now() < s.force_delete_grace_end and active_cnt > 0 then
      raise exception 'A 14 napos türelmi idő még nem telt le, és van még aktív kiválasztás.';
    end if;
    if p_confirm_name is null or trim(p_confirm_name) <> s.megnevezes then
      raise exception 'A megerősítéshez pontosan be kell írni a sorozat nevét.';
    end if;
  end if;

  delete from public.draft_series where source_series_id = p_series_id;

  delete from public.member_status where component_id in (
    select c.id from public.components c join public.issues i on i.id = c.issue_id where i.series_id = p_series_id);
  delete from public.member_issue_data where issue_id in (select id from public.issues where series_id = p_series_id);
  delete from public.member_seen where
    entity_id in (select c.id from public.components c join public.issues i on i.id = c.issue_id where i.series_id = p_series_id)
    or entity_id in (select id from public.issues where series_id = p_series_id)
    or entity_id = p_series_id;
  delete from public.change_log where
    entity_id in (select c.id from public.components c join public.issues i on i.id = c.issue_id where i.series_id = p_series_id)
    or entity_id in (select id from public.issues where series_id = p_series_id)
    or entity_id = p_series_id;
  delete from public.member_series where series_id = p_series_id;
  delete from public.components where issue_id in (select id from public.issues where series_id = p_series_id);
  delete from public.issues where series_id = p_series_id;
  delete from public.series where id = p_series_id;
end;
$$;
grant execute on function public.finalize_delete_series(uuid, text) to authenticated;

-- Kész.
