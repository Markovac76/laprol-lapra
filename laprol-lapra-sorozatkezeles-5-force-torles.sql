-- ============================================================================
-- LAPRÓL LAPRA — SOROZATKEZELÉS ÚJRATERVEZÉS (5., utolsó lépés): force-törlés
-- Futtatás: Supabase SQL Editor. Idempotens: nyugodtan újrafuttatható.
--
-- Tartalom:
--   1) series — force_delete_requested_at / force_delete_by / force_delete_grace_end
--   2) start_force_delete(uuid) — owner indítja, 14 napos türelmi idő
--   3) finalize_delete_series(uuid, text) — 0 aktív kiválasztásnál azonnal,
--      különben a türelmi idő letelte + a sorozat nevének begépelése után;
--      teljes kaszkádolt törlés (member_status/member_issue_data/member_seen/
--      change_log/member_series/components/issues/series) — EXPLICIT, nem
--      FK-cascade-re támaszkodva, mert az eredeti táblák (series/issues/
--      components) nem SQL-fájlból jöttek létre, a pontos FK-actionjük
--      nem ismert innen biztosan.
--   4) VÉDŐHÁLÓ: szerkesztés-indítás (draft_series insert, pool_type='edit')
--      trigger-szinten blokkolva, ha a cél sorozat törlésre jelölve; a
--      publish_draft_series is ellenőrzi újra publikáláskor, és ha valahogy
--      mégis sikerülne, a force-törlési jelzőket nullázza (a folyamatot
--      újra kellene indítani).
--   5) member_series — új kiválasztás (be nem választotta korábban) tiltva,
--      ha a sorozat törlésre jelölve (a protect_member_series trigger bővítve).
--   6) RLS-szigorítás: a `series` írás-policy-t insert/update-re szűkítjük,
--      a DELETE-et kivesszük — sorozat mostantól KIZÁRÓLAG a fenti SECURITY
--      DEFINER függvényeken át törölhető (owner-only ellenőrzéssel odabent),
--      nem közvetlen kliens-DELETE-tel. Ez zárja be a jelenlegi rést: a
--      régi "write series" for-all policy staff-nak közvetlen törlést is
--      engedett volna, holott a specifikáció szerint a törlés owner-only.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) series — force-törlés mezői
-- ---------------------------------------------------------------------------
alter table public.series add column if not exists force_delete_requested_at timestamptz;
alter table public.series add column if not exists force_delete_by uuid references auth.users(id);
alter table public.series add column if not exists force_delete_grace_end timestamptz;

-- ---------------------------------------------------------------------------
-- 2) start_force_delete — owner indítja, csak publikálatlan sorozatra,
--    csak ha van még aktív kiválasztás (0 esetén lásd finalize_delete_series).
-- ---------------------------------------------------------------------------
create or replace function public.start_force_delete(p_series_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  s public.series%rowtype;
begin
  if public.my_role() <> 'owner' then
    raise exception 'Csak a tulajdonos indíthat törlést.';
  end if;
  select * into s from public.series where id = p_series_id;
  if not found then raise exception 'A sorozat nem található.'; end if;
  if s.lifecycle <> 'unpublished' then
    raise exception 'Csak publikálatlan sorozat törölhető.';
  end if;
  if s.force_delete_requested_at is not null then
    raise exception 'A törlési folyamat már fut ezen a sorozaton.';
  end if;
  update public.series set
    force_delete_requested_at = now(),
    force_delete_by = auth.uid(),
    force_delete_grace_end = now() + interval '14 days'
  where id = p_series_id;
end;
$$;
grant execute on function public.start_force_delete(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) finalize_delete_series — azonnali törlés (0 aktív kiválasztás, nincs
--    türelmi idő) VAGY véglegesítés (türelmi idő lejárt + a sorozat nevének
--    pontos begépelése).
-- ---------------------------------------------------------------------------
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
    if now() < s.force_delete_grace_end then
      raise exception 'A 14 napos türelmi idő még nem telt le.';
    end if;
    if p_confirm_name is null or trim(p_confirm_name) <> s.megnevezes then
      raise exception 'A megerősítéshez pontosan be kell írni a sorozat nevét.';
    end if;
  end if;

  -- Esetleges elakadt "Szerkesztés" draft ezen a sorozaton — töröljük, hogy
  -- ne maradjon forrás nélküli, publikálhatatlan pool-tétel.
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

-- ---------------------------------------------------------------------------
-- 4) Védőháló — szerkesztés-indítás blokkolása törlésre jelölt sorozaton,
--    és a publikálás is újra ellenőrzi + nullázza a jelzőt, ha valahogy
--    mégis átcsúszna.
-- ---------------------------------------------------------------------------
create or replace function public.block_edit_during_force_delete()
  returns trigger language plpgsql security definer set search_path = public as $$
declare fd timestamptz;
begin
  if new.pool_type = 'edit' and new.source_series_id is not null then
    select force_delete_requested_at into fd from public.series where id = new.source_series_id;
    if fd is not null then
      raise exception 'Ez a sorozat törlésre jelölve — szerkesztés nem indítható rajta.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists draft_series_block_force_delete on public.draft_series;
create trigger draft_series_block_force_delete
  before insert on public.draft_series
  for each row execute function public.block_edit_during_force_delete();

create or replace function public.publish_draft_series(p_draft_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  d           public.draft_series%rowtype;
  s_row       public.series%rowtype;
  i_row       public.issues%rowtype;
  c_row       public.components%rowtype;
  di          public.draft_issues%rowtype;
  dc          public.draft_components%rowtype;
  live_series_id uuid;
  live_issue_id  uuid;
  new_v       int;
  changed     boolean;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod publikálni.';
  end if;

  select * into d from public.draft_series where id = p_draft_id;
  if not found then raise exception 'A draft nem található.'; end if;

  if d.pool_type = 'new' then
    insert into public.series (kiado, megnevezes, megjelenites, szin, components, sort_order, kod_szam, lifecycle, version)
    values (d.kiado, d.megnevezes, d.megjelenites, d.szin, d.components,
            (select count(*) from public.series), public.next_series_no(), 'active', 1)
    returning id into live_series_id;
  else
    live_series_id := d.source_series_id;
    select * into s_row from public.series where id = live_series_id;
    if not found then raise exception 'A forrás-sorozat már nem létezik.'; end if;
    if s_row.force_delete_requested_at is not null then
      raise exception 'Ez a sorozat törlésre jelölve — publikálás nem lehetséges, amíg a törlési folyamat fut.';
    end if;
    new_v := s_row.version + 1;
    changed := false;
    if d.kiado is distinct from s_row.kiado then
      perform public.log_field_change('series', live_series_id, 'kiado', s_row.kiado, d.kiado, new_v); changed := true;
    end if;
    if d.megnevezes is distinct from s_row.megnevezes then
      perform public.log_field_change('series', live_series_id, 'megnevezes', s_row.megnevezes, d.megnevezes, new_v); changed := true;
    end if;
    if d.megjelenites is distinct from s_row.megjelenites then
      perform public.log_field_change('series', live_series_id, 'megjelenites', s_row.megjelenites, d.megjelenites, new_v); changed := true;
    end if;
    if d.szin is distinct from s_row.szin then
      perform public.log_field_change('series', live_series_id, 'szin', s_row.szin, d.szin, new_v); changed := true;
    end if;
    if (select array_agg(x order by x) from unnest(d.components) x)
       is distinct from (select array_agg(x order by x) from unnest(s_row.components) x) then
      perform public.log_field_change('series', live_series_id, 'components',
        array_to_string(s_row.components,','), array_to_string(d.components,','), new_v); changed := true;
    end if;
    if changed then
      update public.series set kiado=d.kiado, megnevezes=d.megnevezes, megjelenites=d.megjelenites,
        szin=d.szin, components=d.components, version=new_v where id = live_series_id;
    end if;
    -- Védőháló: ha idáig eljutott a publikálás, a sorozat force-törlése nem
    -- lehetett folyamatban (a fenti ellenőrzés blokkolta volna) — ez csak
    -- egy extra biztonsági nullázás, ha egy jövőbeli kódút mégis megkerülné.
    update public.series set force_delete_requested_at=null, force_delete_by=null, force_delete_grace_end=null
      where id = live_series_id and force_delete_requested_at is not null;
  end if;

  for di in select * from public.draft_issues where draft_series_id = d.id order by lapszam loop
    if di.source_issue_id is not null then
      select * into i_row from public.issues where id = di.source_issue_id;
      live_issue_id := di.source_issue_id;
      new_v := i_row.version + 1;
      changed := false;
      if di.lapszam is distinct from i_row.lapszam then
        perform public.log_field_change('issue', live_issue_id, 'lapszam', i_row.lapszam::text, di.lapszam::text, new_v); changed := true;
      end if;
      if di.cim is distinct from i_row.cim then
        perform public.log_field_change('issue', live_issue_id, 'cim', i_row.cim, di.cim, new_v); changed := true;
      end if;
      if di.megjelenes is distinct from i_row.megjelenes then
        perform public.log_field_change('issue', live_issue_id, 'megjelenes', i_row.megjelenes::text, di.megjelenes::text, new_v); changed := true;
      end if;
      if di.eredeti_ar is distinct from i_row.eredeti_ar then
        perform public.log_field_change('issue', live_issue_id, 'eredeti_ar', i_row.eredeti_ar::text, di.eredeti_ar::text, new_v); changed := true;
      end if;
      if changed then
        update public.issues set lapszam=di.lapszam, cim=di.cim, megjelenes=di.megjelenes, eredeti_ar=di.eredeti_ar, version=new_v
          where id = live_issue_id;
      end if;
    else
      insert into public.issues (series_id, lapszam, cim, megjelenes, eredeti_ar, version)
      values (live_series_id, di.lapszam, di.cim, di.megjelenes, di.eredeti_ar, 1)
      returning id into live_issue_id;
    end if;

    for dc in select * from public.draft_components where draft_issue_id = di.id loop
      if dc.source_component_id is not null then
        select * into c_row from public.components where id = dc.source_component_id;
        new_v := c_row.version + 1;
        changed := false;
        if dc.azonosito_tipus is distinct from c_row.azonosito_tipus then
          perform public.log_field_change('component', dc.source_component_id, 'azonosito_tipus', c_row.azonosito_tipus, dc.azonosito_tipus, new_v); changed := true;
        end if;
        if dc.azonosito is distinct from c_row.azonosito then
          perform public.log_field_change('component', dc.source_component_id, 'azonosito', c_row.azonosito, dc.azonosito, new_v); changed := true;
        end if;
        if changed then
          update public.components set azonosito_tipus=dc.azonosito_tipus, azonosito=dc.azonosito, version=new_v
            where id = dc.source_component_id;
        end if;
      else
        insert into public.components (issue_id, tipus, azonosito_tipus, azonosito, version)
        values (live_issue_id, dc.tipus, dc.azonosito_tipus, dc.azonosito, 1);
      end if;
    end loop;
  end loop;

  delete from public.draft_series where id = p_draft_id;
end;
$$;
grant execute on function public.publish_draft_series(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) member_series — új kiválasztás tiltása törlésre jelölt sorozaton
--    (bővíti a laprol-lapra-sorozatkezeles-1-member-series.sql trigger-jét).
-- ---------------------------------------------------------------------------
create or replace function public.protect_member_series()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  fd_pending boolean;
begin
  if tg_op = 'UPDATE' and new.delete_count < old.delete_count then
    raise exception 'A törlés-számláló nem csökkenthető.';
  end if;
  if tg_op = 'UPDATE' and new.is_selected and not old.is_selected and old.delete_count >= 5 then
    raise exception 'Ez a sorozat elérte az 5/5 törlési limitet — nem választható újra.';
  end if;
  if new.is_selected and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and not old.is_selected)) then
    select force_delete_requested_at is not null into fd_pending from public.series where id = new.series_id;
    if fd_pending then
      raise exception 'Ez a sorozat törlésre jelölve — jelenleg nem választható be.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists member_series_protect on public.member_series;
create trigger member_series_protect
  before insert or update on public.member_series
  for each row execute function public.protect_member_series();

-- ---------------------------------------------------------------------------
-- 6) series RLS szigorítás — DELETE kivéve, csak a fenti függvényeken át törölhető.
-- ---------------------------------------------------------------------------
drop policy if exists "write series" on public.series;
drop policy if exists "series staff insert" on public.series;
drop policy if exists "series staff update" on public.series;
create policy "series staff insert" on public.series
  for insert with check (public.is_staff() and public.is_active());
create policy "series staff update" on public.series
  for update using (public.is_staff() and public.is_active())
             with check (public.is_staff() and public.is_active());

-- Kész. A sorozatkezelés-újratervezés mind az 5 lépése lezárva.
