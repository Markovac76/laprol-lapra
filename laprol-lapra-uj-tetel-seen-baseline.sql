-- ============================================================================
-- LAPRÓL LAPRA — SÜRGŐS HIBAJAVÍTÁS: a felkiáltójel-jelzés nem szűnik meg.
-- Futtatás: scripts/run-migration.js (közvetlen Postgres-kapcsolat).
--
-- GYÖKÉR-OK: egy VADONATÚJ Szám vagy komponens (akár a "+ Új tétel" gyors-
-- felvitellel, akár Excel új sorral, akár egy "Szerkesztés" draft ÚJ
-- tételeként) `version=1`-gyel jön létre, de SENKINEK (még a létrehozónak
-- sem) nincs hozzá `member_seen` alapvonala — a hiányzó sor `seenOf(...)`
-- 0-t ad vissza, és mivel 1 > 0, a kliens ÖRÖKRE "változott!"-nak látja.
-- Eközben a `change_log` táblában NINCS bejegyzés (hiszen semmi nem
-- MÓDOSULT, csak létrejött) — ezért a "Mi változott?" / "Összes változás"
-- felület, ami a change_log-ból dolgozik, joggal üresnek látja, és a
-- "Mind elfogadom" (seed_member_seen) hiába állítja vissza a sorozat
-- MEGLÉVŐ tételeinek alapvonalát, ha közben ÚJRA létrejön egy hasonlóan
-- alapvonal nélküli, friss tétel — a jelzés újra és újra visszatér.
--
-- JAVÍTÁS: minden ponton, ahol egy VADONATÚJ Szám/komponens létrejön,
-- azonnal beállítjuk a `member_seen` alapvonalát (version=1) MINDENKINEK,
-- aki jelenleg kiválasztotta ezt a sorozatot (`member_series.is_selected`)
-- — így soha nem keletkezhet olyan "változott!" jelzés, aminek nincs
-- hozzá valódi, megjeleníthető change_log-bejegyzése. Ez szünteti meg a
-- badge (verziószám-összehasonlítás) és a modal (change_log-alapú diff)
-- közötti kettős forrás lehetőségét ennél a konkrét esetnél.
--
-- Idempotens (create or replace).
-- ============================================================================

-- Új segédfüggvény: egy adott Szám (és a rajta lévő összes komponens)
-- member_seen alapvonalát tölti fel MINDEN jelenleg kiválasztó felhasználónak,
-- a JELENLEGI verzióra. "on conflict do nothing" — csak a HIÁNYZÓ sorokat
-- pótolja, nem írja felül azt, aki esetleg már látott egy korábbi verziót.
create or replace function public.seed_issue_seen_for_subscribers(p_issue_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.member_seen (user_id, entity_type, entity_id, last_seen_version)
  select ms.user_id, 'issue', i.id, i.version
  from public.issues i
  join public.member_series ms on ms.series_id = i.series_id and ms.is_selected = true
  where i.id = p_issue_id
  on conflict (user_id, entity_type, entity_id) do nothing;

  insert into public.member_seen (user_id, entity_type, entity_id, last_seen_version)
  select ms.user_id, 'component', c.id, c.version
  from public.components c
  join public.issues i on i.id = c.issue_id
  join public.member_series ms on ms.series_id = i.series_id and ms.is_selected = true
  where c.issue_id = p_issue_id
  on conflict (user_id, entity_type, entity_id) do nothing;
end;
$$;
grant execute on function public.seed_issue_seen_for_subscribers(uuid) to authenticated;

-- publish_draft_series — kiegészítve: minden draft-tételre publikálás után
-- meghívja a fenti alapvonal-feltöltést (vadonatúj Számnál ÉS akkor is, ha
-- egy már létező Számhoz csak új komponens került — "on conflict do nothing"
-- miatt a már látott entitásokon ez nem-op).
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

    -- Alapvonal-feltöltés minden jelenlegi feliratkozónak erre a Számra (és
    -- komponenseire) — vadonatúj Számnál ez az EGÉSZ alapvonalat pótolja,
    -- meglévő Számnál csak az esetleg most hozzáadott új komponens(eke)t
    -- ("on conflict do nothing", a többi entitást nem érinti).
    perform public.seed_issue_seen_for_subscribers(live_issue_id);
  end loop;

  delete from public.draft_series where id = p_draft_id;
end;
$$;
grant execute on function public.publish_draft_series(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- EGYSZERI VISSZATÖLTÉS a MÁR LÉTREJÖTT, alapvonal nélküli tételekre.
-- ÉLESBEN MEGERŐSÍTVE: a "Fast & Furious modellek" #1 Számánál (és a két
-- komponensén) a tulajdonosnak MÁR VAN member_seen sora (a korábbi "Mind
-- elfogadom" működött, csak nem tűnt fel azonnal), DE egy másik, ugyanerre
-- a sorozatra feliratkozott usernek (alltrader2012@gmail.com) EGYETLEN
-- sora sincs ezekre — neki örökre "változott!" marad, change_log nélkül.
--
-- A visszatöltés SZÁNDÉKOSAN csak azokra az entitásokra vonatkozik, amiknek
-- SOHA nem volt change_log-bejegyzése (tisztán "létrejött", sosem
-- "módosult") — a valódi, el nem fogadott változásokat ez NEM törli el
-- senkitől, azokhoz továbbra is kell egy tudatos "OK, nyugtázom"/
-- "Mind elfogadom" kattintás.
-- ---------------------------------------------------------------------------
insert into public.member_seen (user_id, entity_type, entity_id, last_seen_version)
select ms.user_id, 'issue', i.id, i.version
from public.issues i
join public.member_series ms on ms.series_id = i.series_id and ms.is_selected = true
where not exists (select 1 from public.change_log cl where cl.entity_type='issue' and cl.entity_id=i.id)
on conflict (user_id, entity_type, entity_id) do nothing;

insert into public.member_seen (user_id, entity_type, entity_id, last_seen_version)
select ms.user_id, 'component', c.id, c.version
from public.components c
join public.issues i on i.id = c.issue_id
join public.member_series ms on ms.series_id = i.series_id and ms.is_selected = true
where not exists (select 1 from public.change_log cl where cl.entity_type='component' and cl.entity_id=c.id)
on conflict (user_id, entity_type, entity_id) do nothing;

-- Kész.
