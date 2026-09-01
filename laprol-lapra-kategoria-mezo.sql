-- ============================================================================
-- LAPRÓL LAPRA — Valódi "Kategória" (témakör) mező a sorozatokon (v1.16).
-- Kiegészíti a v1.15-ös szín-tematizálást: eddig a kategória csak a szín
-- CSALÁDJÁBÓL volt "visszafejthető" — mostantól saját, listatár-alapú
-- mező (ugyanaz a minta, mint kiadó/komponens/azonosító/forrás), amit a
-- fülsáv-választó ténylegesen csoportosításra használ, és amit staff az
-- Új sorozat / Karbantartás formon választ/bővít (☰ Listák).
--
-- Futtatás: scripts/run-migration.js (backup + tranzakció).
-- ============================================================================

-- 1) Oszlopok
alter table public.series add column if not exists kategoria text;
alter table public.draft_series add column if not exists kategoria text;

-- 2) Kezdő listatár-értékek (a 3 jelenlegi témakör) — a tulajdonos fiókjához
-- kötve, mint a többi listatár-bejegyzés.
insert into public.lists (tipus, ertek, megjelenites, sort_order, user_id) values
  ('kategoria', 'modellek', 'Modellek', 1, '25cb3724-02d4-4002-98b0-c93f74ef4e42'),
  ('kategoria', 'mese',     'Mese',     2, '25cb3724-02d4-4002-98b0-c93f74ef4e42'),
  ('kategoria', 'lego',     'Lego',     3, '25cb3724-02d4-4002-98b0-c93f74ef4e42')
on conflict do nothing;

-- 3) A 9 jelenlegi sorozat kategóriába sorolása
update public.series set kategoria = 'modellek'
  where megnevezes in ('II VH Repülők','Versenyautók - Forma 1','Volkswagen modellautógyűjtemény','Fast & Furious modellek');
update public.series set kategoria = 'mese'
  where megnevezes in ('Disney könyvek','Disney Hangoskönyvek','A Mancs Őrjárat küldetései');
update public.series set kategoria = 'lego'
  where megnevezes in ('Lego Star Wars Magazin','Lego Marvel');

-- 4) Színek frissítése az élénkebb Kék/Zöld skálára (a Vörös család
-- változatlan hue/szaturációjú, azt csak most rendeljük a Mese témakörhöz
-- a korábbi Magenta helyett).
update public.series set szin = '#123d6e' where megnevezes = 'II VH Repülők';
update public.series set szin = '#1a579e' where megnevezes = 'Versenyautók - Forma 1';
update public.series set szin = '#2275d3' where megnevezes = 'Volkswagen modellautógyűjtemény';
update public.series set szin = '#4b91e2' where megnevezes = 'Fast & Furious modellek';

update public.series set szin = '#a8202b' where megnevezes = 'Disney könyvek';
update public.series set szin = '#d21f2b' where megnevezes = 'Disney Hangoskönyvek';
update public.series set szin = '#e04c47' where megnevezes = 'A Mancs Őrjárat küldetései';

update public.series set szin = '#16692b' where megnevezes = 'Lego Star Wars Magazin';
update public.series set szin = '#1c8235' where megnevezes = 'Lego Marvel';

-- 5) publish_draft_series() — a kategoria mező is menjen át a szokásos
-- diff/verzió/change_log gépezeten, mint kiado/megnevezes/szin.
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
    insert into public.series (kiado, megnevezes, megjelenites, szin, kategoria, components, sort_order, kod_szam, lifecycle, version)
    values (d.kiado, d.megnevezes, d.megjelenites, d.szin, d.kategoria, d.components,
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
    if d.kategoria is distinct from s_row.kategoria then
      perform public.log_field_change('series', live_series_id, 'kategoria', s_row.kategoria, d.kategoria, new_v); changed := true;
    end if;
    if (select array_agg(x order by x) from unnest(d.components) x)
       is distinct from (select array_agg(x order by x) from unnest(s_row.components) x) then
      perform public.log_field_change('series', live_series_id, 'components',
        array_to_string(s_row.components,','), array_to_string(d.components,','), new_v); changed := true;
    end if;
    if changed then
      update public.series set kiado=d.kiado, megnevezes=d.megnevezes, megjelenites=d.megjelenites,
        szin=d.szin, kategoria=d.kategoria, components=d.components, version=new_v where id = live_series_id;
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
        if dc.tipus is distinct from c_row.tipus then
          perform public.log_field_change('component', dc.source_component_id, 'tipus', c_row.tipus, dc.tipus, new_v); changed := true;
        end if;
        if dc.azonosito_tipus is distinct from c_row.azonosito_tipus then
          perform public.log_field_change('component', dc.source_component_id, 'azonosito_tipus', c_row.azonosito_tipus, dc.azonosito_tipus, new_v); changed := true;
        end if;
        if dc.azonosito is distinct from c_row.azonosito then
          perform public.log_field_change('component', dc.source_component_id, 'azonosito', c_row.azonosito, dc.azonosito, new_v); changed := true;
        end if;
        if dc.megnevezes is distinct from c_row.megnevezes then
          perform public.log_field_change('component', dc.source_component_id, 'megnevezes', c_row.megnevezes, dc.megnevezes, new_v); changed := true;
        end if;
        if changed then
          update public.components set tipus=dc.tipus, azonosito_tipus=dc.azonosito_tipus, azonosito=dc.azonosito,
            megnevezes=dc.megnevezes, version=new_v
            where id = dc.source_component_id;
        end if;
      else
        insert into public.components (issue_id, tipus, azonosito_tipus, azonosito, megnevezes, version)
        values (live_issue_id, dc.tipus, dc.azonosito_tipus, dc.azonosito, dc.megnevezes, 1);
      end if;
    end loop;

    perform public.seed_issue_seen_for_subscribers(live_issue_id);
  end loop;

  delete from public.draft_series where id = p_draft_id;
end;
$$;
grant execute on function public.publish_draft_series(uuid) to authenticated;

-- Kész.
