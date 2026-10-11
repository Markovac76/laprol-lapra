-- ============================================================================
-- LAPRÓL LAPRA — a régi szerkesztő KOMPATIBILITÁSI ÁGÁNAK kivétele (22. lépés, 2. kör utáni)
-- Futtatás: scripts/run-migration.js (backup + BEGIN/COMMIT). ELŐFELTÉTEL: komponens-torles.sql.
--
-- A komponens-sablon szerkesztő megjelent (3d23023), a draft komponens-listája és a sablon
-- típus-készlete mostantól mindig szinkronban jön. A publikáló függvényből kikerül az az ág,
-- amely a sablont a komponens-listához igazította (sync_template_with_components): a sablon
-- az irányadó. Üres sablonnál (a beküldői / régi propose-út) az alapértelmezett továbbra is
-- lép (DB-szintű kikényszerítés későbbre marad). Egyetlen módosuló függvény:
-- publish_draft_series — a 4. szakasz (komponens-törlés) utáni változatából EGYETLEN blokk.
-- A sync_template_with_components függvény megmarad (más helyen nem hívódik; később törölhető).
-- ============================================================================

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
  dup_list    text;
  lapszam_changed boolean;
  main_list   text;
  tmpl        jsonb;
  terr        text;
  tmpl_types  text[];
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod publikálni.';
  end if;

  select * into d from public.draft_series where id = p_draft_id for update;
  if not found then raise exception 'A draft nem található.'; end if;
  if d.pool_status <> 'ready' then
    raise exception 'Ez a munkaanyag már nem „Publikálásra váró” állapotban van (közben visszaadták szerkesztésre?) — frissítsd a Karbantartás nézetet.';
  end if;

  -- Komponens-sablon: üres (régi szerkesztő) → alapértelmezett a komponens-listából; ha a lista
  -- és a sablon típus-készlete eltér (régi szerkesztő csak a listát módosította) → a sablon igazodik.
  tmpl := d.component_template;
  if tmpl is null or jsonb_typeof(tmpl) <> 'array' or jsonb_array_length(tmpl) = 0 then
    tmpl := public.default_component_template(d.components);   -- üres sablon (régi propose-út): alapértelmezett
  end if;
  terr := public.component_template_error(tmpl);
  if terr is not null then
    raise exception 'A publikálás nem lehetséges: a komponens-sablon érvénytelen — %', terr;
  end if;
  select array_agg(x->>'tipus' order by o) into tmpl_types from jsonb_array_elements(tmpl) with ordinality as t(x, o);
  d.components := tmpl_types;          -- a sorozat komponens-listája a sablon típusainak listája (kompatibilitás)
  d.component_template := tmpl;

  if d.pool_type = 'new' then
    insert into public.series (kiado, megnevezes, megjelenites, szin, kategoria, components, component_template, sort_order, kod_szam, lifecycle, version)
    values (d.kiado, d.megnevezes, d.megjelenites, d.szin, d.kategoria, d.components, d.component_template,
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
    -- A komponens-sablon változása CSENDES (nincs verzióemelés), a change_log rögzíti; csak az ÚJ
    -- Számok/komponensek kiindulása — a meglévőket nem módosítja.
    if d.component_template is distinct from s_row.component_template then
      perform public.log_field_change('series', live_series_id, 'component_template',
                                      s_row.component_template::text, d.component_template::text,
                                      case when changed then new_v else s_row.version end);
      update public.series set component_template = d.component_template where id = live_series_id;
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

      changed := false;   -- TARTALMI változás (cím/dátum/ár) — ez emeli a verziót
      lapszam_changed := di.lapszam is distinct from i_row.lapszam;
      if di.cim is distinct from i_row.cim then
        perform public.log_field_change('issue', live_issue_id, 'cim', i_row.cim, di.cim, new_v); changed := true;
      end if;
      if di.megjelenes is distinct from i_row.megjelenes then
        perform public.log_field_change('issue', live_issue_id, 'megjelenes', i_row.megjelenes::text, di.megjelenes::text, new_v); changed := true;
      end if;
      if di.eredeti_ar is distinct from i_row.eredeti_ar then
        perform public.log_field_change('issue', live_issue_id, 'eredeti_ar', i_row.eredeti_ar::text, di.eredeti_ar::text, new_v); changed := true;
      end if;
      -- A puszta lapszám-változás (átszámozás) CSENDES: a change_log rögzíti, de a
      -- verzió nem emelkedik, így a felhasználóknál nincs tételenkénti felkiáltójel
      -- (egy tömeges átszámozás ne árassza el őket). Tartalmi változás mellett a
      -- lapszám-diff a szokásos módon, az új verzióval jelenik meg.
      if lapszam_changed then
        perform public.log_field_change('issue', live_issue_id, 'lapszam', i_row.lapszam::text, di.lapszam::text,
                                        case when changed then new_v else i_row.version end);
      end if;
      if changed or lapszam_changed then
        update public.issues set lapszam=di.lapszam, cim=di.cim, megjelenes=di.megjelenes, eredeti_ar=di.eredeti_ar,
               version = case when changed then new_v else i_row.version end
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
        -- Törölt-jelölés (a Számoknál használt minta szerint): a személyes adatok (member_status,
        -- jegyzet, darabszám) megmaradnak, a komponens visszaállítható. CSENDES: a change_log
        -- rögzíti, de nincs verzióemelés / felkiáltójel. A fő elem nem törölhető (a draftban a
        -- törölt komponens sosem fő elem; a megszorítás a táblán is áll).
        if dc.deleted then
          if not c_row.is_deleted then
            perform public.log_field_change('component', dc.source_component_id, 'is_deleted', 'false', 'true', c_row.version);
            if c_row.is_main then
              perform public.log_field_change('component', dc.source_component_id, 'is_main', 'true', 'false', c_row.version);
            end if;
            update public.components set is_deleted = true, is_main = false where id = dc.source_component_id;
          end if;
          continue;
        elsif c_row.is_deleted then
          perform public.log_field_change('component', dc.source_component_id, 'is_deleted', 'true', 'false', c_row.version);
          update public.components set is_deleted = false where id = dc.source_component_id;
        end if;
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
        if dc.adatok is distinct from c_row.adatok then
          perform public.log_field_change('component', dc.source_component_id, 'adatok', c_row.adatok::text, dc.adatok::text, new_v); changed := true;
        end if;
        if changed then
          update public.components set tipus=dc.tipus, azonosito_tipus=dc.azonosito_tipus, azonosito=dc.azonosito,
            megnevezes=dc.megnevezes, adatok=dc.adatok, version=new_v
            where id = dc.source_component_id;
        end if;
        -- A fő elem váltása CSENDES: a change_log rögzíti, de a verzió nem emelkedik
        -- (nincs felkiáltójel). (A kizáró megszorítás halasztott, így a csere egy
        -- publikáláson belül sorrendfüggetlen.)
        if dc.is_main is distinct from c_row.is_main then
          perform public.log_field_change('component', dc.source_component_id, 'is_main',
                                          c_row.is_main::text, dc.is_main::text,
                                          case when changed then new_v else c_row.version end);
          update public.components set is_main = dc.is_main where id = dc.source_component_id;
        end if;
      elsif dc.deleted then
        continue;     -- sosem publikált komponens, törlésre jelölve: egyszerűen kimarad
      else
        insert into public.components (issue_id, tipus, azonosito_tipus, azonosito, megnevezes, adatok, version, is_main)
        values (live_issue_id, dc.tipus, dc.azonosito_tipus, dc.azonosito, dc.megnevezes, dc.adatok, 1, dc.is_main);
      end if;
    end loop;

    -- Egy Számnak mindig marad legalább egy nem törölt komponense (ha volt neki).
    if exists (select 1 from public.draft_components where draft_issue_id = di.id)
       and not exists (select 1 from public.components where issue_id = live_issue_id and not is_deleted) then
      raise exception 'A publikálás nem lehetséges: a(z) #% Számon minden komponens törölve lenne. Az élő sorozat nem változott. Teendő: „Visszaadás szerkesztésre”, és vond vissza a törlés-jelölést legalább egy komponensen.', di.lapszam;
    end if;

    -- Minden Számnak mindig legyen fő eleme: ha a draft nem jelölt, a tartalék szabály dolgozik.
    if not exists (select 1 from public.components where issue_id = live_issue_id and is_main) then
      update public.components set is_main = true where id = public.pick_main_component(live_issue_id);
    end if;

    perform public.seed_issue_seen_for_subscribers(live_issue_id);
  end loop;

  -- A lapszám-egyediség ellenőrzése halasztott (átszámozás/csere miatt), ezért
  -- az ütközés egyébként csak a commit-nál, nyers constraint-hibával derülne
  -- ki. Itt, a függvényen belül, még érthetően jelezzük.
  select string_agg(lapszam::text, ', ' order by lapszam) into dup_list
  from (
    select lapszam from public.issues
    where series_id = live_series_id and not is_deleted
    group by lapszam having count(*) > 1
  ) x;
  if dup_list is not null then
    raise exception 'A publikálás nem lehetséges: a(z) % lapszám több nem törölt Számnál is szerepelne a sorozatban. Ez jellemzően akkor fordul elő, ha egy élő Szám nincs benne a munkaanyagban (pl. „Szám törlése a draftból” után), egy új Szám pedig ugyanazt a lapszámot kapta. Az élő sorozat nem változott. Teendő: „Visszaadás szerkesztésre”, majd az ütköző Számok lapszámának javítása.', dup_list;
  end if;

  -- Egy Számon legfeljebb egy fő elem lehet (halasztott kizáró megszorítás: itt, a
  -- függvényen belül érthetően jelezzük, nem a commit-nál nyers hibával).
  select string_agg('#' || lapszam, ', ' order by lapszam) into main_list
  from (
    select i.lapszam from public.issues i
     where i.series_id = live_series_id and not i.is_deleted
       and (select count(*) from public.components c where c.issue_id = i.id and c.is_main) > 1
  ) x;
  if main_list is not null then
    raise exception 'A publikálás nem lehetséges: a(z) % Számon több fő elem (★) lenne. Ez akkor fordul elő, ha a munkaanyagban kijelölt fő elem mellett egy, a munkaanyagban nem szereplő élő komponens is fő elem. Az élő sorozat nem változott. Teendő: „Visszaadás szerkesztésre”, és a Számon jelöld ki újra a fő elemet.', main_list;
  end if;

  delete from public.draft_series where id = p_draft_id;
end;
$$;

-- Kész.
