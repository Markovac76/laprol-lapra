-- ============================================================================
-- LAPRÓL LAPRA — HIBAJAVÍTÁSI KÖR, 1+5. pont: Szám törlése draft-on át +
-- a "Tétel szerkesztése" gyors-panel törzsadat-mezőinek/törlésének kivezetése
-- Futtatás: Supabase SQL Editor. Idempotens.
--
-- Tartalom:
--   1) issues.is_deleted — a Szám törlése mostantól NEM fizikai DELETE,
--      hanem egy mezőváltozás (false→true), ami a MEGLÉVŐ diff/verzió/
--      change_log/felkiáltójel-gépezeten megy át, mint bármelyik más
--      mezőmódosítás. Ez azért kritikus, hogy a törlés-értesítés a
--      "gyűjtött elfogadás" listában is megjelenhessen — ha a sor fizikailag
--      eltűnne, nem lenne mihez kötni a jelzést.
--   2) draft_issues.deleted — a draft-szerkesztőben bejelölhető "ezt a
--      Számot törlöm publikáláskor" jelző.
--   3) publish_draft_series() bővítve: ha egy meglévő tétel draftja
--      deleted=true, nem a szokásos mezőnkénti diffet futtatja, hanem
--      egyetlen 'is_deleted' change_log-bejegyzést ír, verziót emel, és
--      is_deleted=true-ra állítja az élő sort — a komponensei nem
--      frissülnek (nincs értelme). Új (source nélküli) draft-tétel
--      deleted=true jelöléssel egyszerűen kimarad a publikálásból.
-- ============================================================================

alter table public.issues add column if not exists is_deleted boolean not null default false;
alter table public.draft_issues add column if not exists deleted boolean not null default false;

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
    update public.series set force_delete_requested_at=null, force_delete_by=null, force_delete_grace_end=null
      where id = live_series_id and force_delete_requested_at is not null;
  end if;

  for di in select * from public.draft_issues where draft_series_id = d.id order by lapszam loop
    if di.source_issue_id is not null then
      select * into i_row from public.issues where id = di.source_issue_id;
      live_issue_id := di.source_issue_id;
      new_v := i_row.version + 1;

      if di.deleted then
        if not i_row.is_deleted then
          perform public.log_field_change('issue', live_issue_id, 'is_deleted', 'false', 'true', new_v);
          update public.issues set is_deleted = true, version = new_v where id = live_issue_id;
        end if;
        continue; -- törölt tételnél a komponensei nem frissülnek
      end if;

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
      if di.deleted then
        continue; -- sosem publikált, törlésre jelölt új tétel — egyszerűen kimarad
      end if;
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

-- Kész.
