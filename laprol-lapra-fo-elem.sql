-- ============================================================================
-- LAPRÓL LAPRA — FŐ ELEM (★): egy Számon legfeljebb egy komponens, a sorban az
-- első helyen áll (22. lépés, 1. kör / B)
-- Futtatás: scripts/run-migration.js (backup + BEGIN/COMMIT).
--
-- Séma:
--   components.is_main / draft_components.is_main  boolean not null default false
--   kizáró megszorítás: egy Számon legfeljebb EGY is_main (halasztott, mint az
--   issues_series_id_lapszam_key, hogy a fő elem cseréje egy publikáláson belül
--   sorrendfüggetlen legyen)
-- A fő elem NEM típus, hanem jelölés a komponensen. A Szám címe/borítója és a
-- színezés NEM változik. A váltás CSENDES (nincs verzióemelés / felkiáltójel), a
-- change_log rögzíti (field_name = 'is_main').
--
-- Meglévő adatok — egyszeri kitöltés (NEM naplózódik, ez az inicializálás):
--   ahol van magazin: az első magazin; ahol nincs: az első könyv; ahol az sincs:
--   az első komponens. "Első" = a sorozat komponens-listájának sorrendje, azon
--   belül a létrehozás sorrendje.
-- A függvények: start_edit_draft (másolja), publish_draft_series (visszaviszi,
-- csendesen; tartalék szabály ha a draft nem jelölt), apply_draft_upload (új
-- Számnak tartalék fő elem), mark_draft_ready (kitölti/ellenőrzi: pontosan egy).
-- ============================================================================

alter table public.components       add column if not exists is_main boolean not null default false;
alter table public.draft_components add column if not exists is_main boolean not null default false;

-- ---------------------------------------------------------------------------
-- Segédfüggvények (a tartalék szabály egy helyen)
-- ---------------------------------------------------------------------------
create or replace function public.pick_main_component(p_issue_id uuid)
  returns uuid language sql stable security definer set search_path = public as $$
  select c.id
    from public.components c
    join public.issues i on i.id = c.issue_id
    join public.series s on s.id = i.series_id
   where c.issue_id = p_issue_id
   order by case c.tipus when 'magazin' then 0 when 'konyv' then 1 else 2 end,
            coalesce(array_position(s.components, c.tipus), 999999), c.created_at, c.id
   limit 1
$$;

create or replace function public.pick_main_draft_component(p_draft_issue_id uuid)
  returns uuid language sql stable security definer set search_path = public as $$
  select dc.id
    from public.draft_components dc
    join public.draft_issues di on di.id = dc.draft_issue_id
    join public.draft_series ds on ds.id = di.draft_series_id
    left join public.components lc on lc.id = dc.source_component_id
   where dc.draft_issue_id = p_draft_issue_id
   order by case dc.tipus when 'magazin' then 0 when 'konyv' then 1 else 2 end,
            coalesce(array_position(ds.components, dc.tipus), 999999), lc.created_at nulls last, dc.id
   limit 1
$$;

-- Ha a draft-Számnak van komponense, de nincs fő eleme, kijelöli a tartalék szabály szerint.
create or replace function public.ensure_draft_main(p_draft_issue_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.draft_components x where x.draft_issue_id = p_draft_issue_id)
     and not exists (select 1 from public.draft_components x where x.draft_issue_id = p_draft_issue_id and x.is_main) then
    update public.draft_components set is_main = true
     where id = public.pick_main_draft_component(p_draft_issue_id);
  end if;
end;
$$;
grant execute on function public.pick_main_component(uuid), public.pick_main_draft_component(uuid), public.ensure_draft_main(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Egyszeri kitöltés (a megszorítás ELŐTT)
-- ---------------------------------------------------------------------------
update public.components c set is_main = true
  from (
    select distinct on (cc.issue_id) cc.id
      from public.components cc
      join public.issues i on i.id = cc.issue_id
      join public.series s on s.id = i.series_id
     order by cc.issue_id,
              case cc.tipus when 'magazin' then 0 when 'konyv' then 1 else 2 end,
              coalesce(array_position(s.components, cc.tipus), 999999), cc.created_at, cc.id
  ) x
 where c.id = x.id and not c.is_main;

-- a draftok: az élő párjuk jelölését öröklik, ahol még nincs fő elem, a tartalék szabály dönt
update public.draft_components dc set is_main = c.is_main
  from public.components c
 where dc.source_component_id = c.id and c.is_main and not dc.is_main;
select public.ensure_draft_main(id) from public.draft_issues;

-- ---------------------------------------------------------------------------
-- Megszorítások
-- ---------------------------------------------------------------------------
alter table public.components drop constraint if exists components_one_main_per_issue;
alter table public.components add constraint components_one_main_per_issue
  exclude using btree (issue_id with =) where (is_main) deferrable initially deferred;
alter table public.draft_components drop constraint if exists draft_components_one_main_per_issue;
alter table public.draft_components add constraint draft_components_one_main_per_issue
  exclude using btree (draft_issue_id with =) where (is_main) deferrable initially deferred;

-- ---------------------------------------------------------------------------
-- start_edit_draft — a fő elem jelölést is másolja
-- ---------------------------------------------------------------------------
create or replace function public.start_edit_draft(p_series_id uuid)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  s    public.series%rowtype;
  d_id uuid;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod szerkesztést indítani.';
  end if;

  select * into s from public.series where id = p_series_id for update;
  if not found then
    raise exception 'A sorozat nem található.';
  end if;
  if s.lifecycle <> 'active' then
    raise exception 'Szerkesztés csak aktív (publikált) sorozaton indítható — ez a sorozat nem aktív (állapota: %).',
      case s.lifecycle when 'unpublished' then 'publikálatlan' else s.lifecycle end;
  end if;
  if s.force_delete_requested_at is not null then
    raise exception 'Ez a sorozat törlésre jelölt — a türelmi idő alatt nem szerkeszthető.';
  end if;
  if exists (select 1 from public.draft_series
              where source_series_id = p_series_id and pool_type = 'edit') then
    raise exception 'Ehhez a sorozathoz már van nyitott szerkesztési munkaanyag — nézd meg a Karbantartás „Munka sorozatok” fülén.';
  end if;

  insert into public.draft_series (pool_type, pool_status, source_series_id, submitted_by,
                                   claimed_by, claimed_at, kiado, megnevezes, megjelenites,
                                   szin, kategoria, components)
  values ('edit', 'claimed', p_series_id, auth.uid(), auth.uid(), now(),
          s.kiado, s.megnevezes, s.megjelenites, s.szin, s.kategoria, s.components)
  returning id into d_id;

  insert into public.draft_issues (draft_series_id, source_issue_id, lapszam, cim, megjelenes, eredeti_ar)
  select d_id, i.id, i.lapszam, i.cim, i.megjelenes, i.eredeti_ar
    from public.issues i
   where i.series_id = p_series_id and not i.is_deleted;

  insert into public.draft_components (draft_issue_id, source_component_id, tipus, azonosito_tipus, azonosito, megnevezes, is_main)
  select di.id, c.id, c.tipus, c.azonosito_tipus, c.azonosito, c.megnevezes, c.is_main
    from public.components c
    join public.draft_issues di on di.source_issue_id = c.issue_id
   where di.draft_series_id = d_id;

  return d_id;
end;
$$;
grant execute on function public.start_edit_draft(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- apply_draft_upload — az új Számnak tartalék fő elem (az Excel nem viszi a fő elemet)
-- ---------------------------------------------------------------------------
create or replace function public.apply_draft_upload(p_draft_id uuid, p_payload jsonb)
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  d          public.draft_series%rowtype;
  it         jsonb;
  cp         jsonb;
  did        text;
  iid        uuid;
  cid        uuid;
  conf       jsonb;
  new_types  text[];
  is_new     boolean;
  n_new      int := 0;
  n_upd      int := 0;
  n_cnew     int := 0;
  n_cupd     int := 0;
  n_cauto    int := 0;
  n_k        int := 0;
  n_del      int := 0;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod ehhez a művelethez.';
  end if;
  select * into d from public.draft_series where id = p_draft_id for update;
  if not found then raise exception 'A munkaanyag nem található.'; end if;
  if d.pool_status <> 'claimed' then
    raise exception 'Ez a munkaanyag nem „Munkaanyag” állapotban van, a feltöltés nem alkalmazható.';
  end if;
  if d.claimed_by is distinct from auth.uid() and public.my_role() <> 'owner' then
    raise exception 'Csak a munkaanyagot lefoglaló admin vagy a tulajdonos tölthet fel sablont.';
  end if;

  for it in select * from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
    if nullif(it->>'id','') is not null then
      -- meglévő draft-tétel: csak a payloadban SZEREPLŐ mezők módosulnak
      is_new := false;
      iid := (it->>'id')::uuid;
      update public.draft_issues set
        lapszam    = case when it ? 'lapszam'    then (it->>'lapszam')::int         else lapszam    end,
        cim        = case when it ? 'cim'        then it->>'cim'                    else cim        end,
        megjelenes = case when it ? 'megjelenes' then (it->>'megjelenes')::date     else megjelenes end,
        eredeti_ar = case when it ? 'eredeti_ar' then (it->>'eredeti_ar')::int      else eredeti_ar end,
        deleted    = case when it ? 'deleted'    then (it->>'deleted')::boolean     else deleted    end
      where id = iid and draft_series_id = p_draft_id;
      if not found then
        raise exception 'A feltöltésben ismeretlen tétel-azonosító szerepel (%) — a sablon másik munkaanyagból vagy elavult állapotból származik.', iid;
      end if;
      n_upd := n_upd + 1;
    else
      -- új draft-tétel (az azonosítót a kliens generálja, így az újrapróbálás nem duplikál)
      is_new := true;
      iid := (it->>'new_id')::uuid;
      insert into public.draft_issues (id, draft_series_id, lapszam, cim, megjelenes, eredeti_ar)
      values (iid, p_draft_id, (it->>'lapszam')::int, it->>'cim',
              nullif(it->>'megjelenes','')::date, nullif(it->>'eredeti_ar','')::int);
      n_new := n_new + 1;
    end if;

    for cp in select * from jsonb_array_elements(coalesce(it->'comps','[]'::jsonb)) loop
      if nullif(cp->>'id','') is not null then
        cid := (cp->>'id')::uuid;
        update public.draft_components set
          azonosito  = case when cp ? 'azonosito'  then nullif(cp->>'azonosito','')  else azonosito  end,
          megnevezes = case when cp ? 'megnevezes' then nullif(cp->>'megnevezes','') else megnevezes end
        where id = cid and draft_issue_id = iid;
        if not found then
          raise exception 'A feltöltésben ismeretlen komponens-azonosító szerepel (%).', cid;
        end if;
        n_cupd := n_cupd + 1;
      else
        insert into public.draft_components (draft_issue_id, tipus, azonosito, megnevezes, source_component_id)
        values (iid, cp->>'tipus', nullif(cp->>'azonosito',''), nullif(cp->>'megnevezes',''), null);
        n_cnew := n_cnew + 1;
      end if;
    end loop;

    -- ÚJ Számnál a sorozat minden deklarált komponens-típusából legyen
    -- legalább egy (üres) példány — mint a kézi szerkesztőben. A payload által
    -- már létrehozott típusokat nem duplikálja.
    if is_new then
      insert into public.draft_components (draft_issue_id, tipus, azonosito, megnevezes, source_component_id)
      select iid, t.tipus, null, null, null
        from unnest(d.components) with ordinality as t(tipus, ord)
       where not exists (select 1 from public.draft_components dc
                          where dc.draft_issue_id = iid and dc.tipus = t.tipus)
       order by t.ord;
      get diagnostics n_k = row_count;
      n_cauto := n_cauto + n_k;
      -- az új Számnak legyen fő eleme (tartalék szabály: magazin, könyv, első)
      perform public.ensure_draft_main(iid);
    end if;
  end loop;

  -- A fájlból hiányzó, a felhasználó által KIFEJEZETTEN törlésre jelölt tételek.
  -- Élő párral rendelkezőt nem törlünk fizikailag (a publikálás soft-delete-eli);
  -- csak az új (élő pár nélküli) draft-tétel törölhető fizikailag.
  for did in select jsonb_array_elements_text(coalesce(p_payload->'delete_ids','[]'::jsonb)) loop
    iid := did::uuid;
    update public.draft_issues set deleted = true
     where id = iid and draft_series_id = p_draft_id and source_issue_id is not null;
    if not found then
      delete from public.draft_issues
       where id = iid and draft_series_id = p_draft_id and source_issue_id is null;
    end if;
    n_del := n_del + 1;
  end loop;

  -- Új komponens-típus felvétele a sorozat komponens-listájára (különben az élő
  -- felület sehol nem jelenítené meg) — a meglévő sorrendet megőrizve.
  select array_agg(distinct dc.tipus) into new_types
    from public.draft_components dc
    join public.draft_issues di on di.id = dc.draft_issue_id
   where di.draft_series_id = p_draft_id and not (dc.tipus = any(d.components));
  if new_types is not null then
    update public.draft_series set components = components || new_types where id = p_draft_id;
  end if;

  -- Végső védelem: a feltöltés utáni állapotban nem lehet lapszám-ütközés.
  conf := public.draft_lapszam_conflicts(p_draft_id, '[]'::jsonb);
  if jsonb_array_length(conf) > 0 then
    raise exception E'A feltöltés nem alkalmazható: ütköző lapszámok maradnának.\n\n%\n\nA munkaanyag nem változott.',
      public.draft_conflicts_text(conf);
  end if;

  return jsonb_build_object('uj', n_new, 'frissitett', n_upd, 'uj_komponens', n_cnew,
                            'frissitett_komponens', n_cupd, 'auto_komponens', n_cauto, 'torolt', n_del);
end;
$$;
grant execute on function public.apply_draft_upload(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_draft_ready — fő elem kitöltése/ellenőrzése
-- ---------------------------------------------------------------------------
create or replace function public.mark_draft_ready(p_draft_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  d         public.draft_series%rowtype;
  conf      jsonb;
  n_missing int;
  lst       text;
  n_main    int;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod ehhez a művelethez.';
  end if;
  select * into d from public.draft_series where id = p_draft_id for update;
  if not found then raise exception 'A munkaanyag nem található.'; end if;
  if d.pool_status <> 'claimed' then
    raise exception 'Ez a munkaanyag nem „Munkaanyag” állapotban van — frissítsd a Karbantartás nézetet.';
  end if;
  if d.claimed_by is distinct from auth.uid() and public.my_role() <> 'owner' then
    raise exception 'Csak a munkaanyagot lefoglaló admin vagy a tulajdonos állíthatja Kész-re.';
  end if;

  -- Komponens nélküli ÚJ Számok
  select count(*) into n_missing
    from public.draft_issues di
   where di.draft_series_id = p_draft_id and di.source_issue_id is null and not di.deleted
     and not exists (select 1 from public.draft_components dc where dc.draft_issue_id = di.id);
  if n_missing > 0 then
    select string_agg('#' || x.lapszam || ' „' || coalesce(nullif(btrim(x.cim), ''), 'cím nélkül') || '”', ', ' order by x.lapszam)
      into lst
      from (select di.lapszam, di.cim
              from public.draft_issues di
             where di.draft_series_id = p_draft_id and di.source_issue_id is null and not di.deleted
               and not exists (select 1 from public.draft_components dc where dc.draft_issue_id = di.id)
             order by di.lapszam
             limit 10) x;
    raise exception E'A munkaanyag nem állítható „Kész”-re: % nincs egyetlen komponense sem — a publikálás komponens nélküli Számot hozna létre, amelyen sem azonosító, sem státusz nem állítható.\n\n%\n\nTeendő: nyisd meg az érintett Számot a szerkesztőben, és adj hozzá legalább egy komponenst („+ Még egy … hozzáadása”), vagy töltsd fel újra a sablont (az új sorokhoz a sorozat komponensei automatikusan létrejönnek), majd próbáld újra.',
      n_missing || ' új Számnak',
      lst || case when n_missing > 10 then ' … (és még ' || (n_missing - 10) || ')' else '' end;
  end if;

  -- Fő elem (★): ahol van komponens, de nincs kijelölve, a tartalék szabály szerint
  -- kijelöli (magazin, könyv, első); utána minden nem törölt Számon, amelyiken van
  -- komponens, PONTOSAN egy fő elem kell.
  perform public.ensure_draft_main(di.id)
     from public.draft_issues di where di.draft_series_id = p_draft_id and not di.deleted;
  select count(*) into n_main
    from public.draft_issues di
   where di.draft_series_id = p_draft_id and not di.deleted
     and exists (select 1 from public.draft_components x where x.draft_issue_id = di.id)
     and (select count(*) from public.draft_components x where x.draft_issue_id = di.id and x.is_main) <> 1;
  if n_main > 0 then
    select string_agg('#' || x.lapszam || ' „' || coalesce(nullif(btrim(x.cim), ''), 'cím nélkül') || '”', ', ' order by x.lapszam)
      into lst
      from (select di.lapszam, di.cim from public.draft_issues di
             where di.draft_series_id = p_draft_id and not di.deleted
               and exists (select 1 from public.draft_components x where x.draft_issue_id = di.id)
               and (select count(*) from public.draft_components x where x.draft_issue_id = di.id and x.is_main) <> 1
             order by di.lapszam limit 10) x;
    raise exception E'A munkaanyag nem állítható „Kész”-re: % nem pontosan egy fő elem (★) van.\n\n%\n\nTeendő: a Szám szerkesztőjében jelölj ki pontosan egy komponenst fő elemnek.',
      n_main || ' Számon', lst;
  end if;

  conf := public.draft_lapszam_conflicts(p_draft_id, '[]'::jsonb);
  if jsonb_array_length(conf) > 0 then
    raise exception E'A munkaanyag nem állítható „Kész”-re: a publikálás után több nem törölt Szám ugyanazt a lapszámot kapná.\n\n%\n\nJavítsd a lapszámokat, vagy jelöld törlésre az élő Számot, majd próbáld újra.',
      public.draft_conflicts_text(conf);
  end if;

  update public.draft_series set pool_status = 'ready', ready_at = now() where id = p_draft_id;
end;
$$;
grant execute on function public.mark_draft_ready(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- publish_draft_series — fő elem visszaírása (csendes), tartalék szabály, ellenőrzés
-- ---------------------------------------------------------------------------
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
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod publikálni.';
  end if;

  select * into d from public.draft_series where id = p_draft_id for update;
  if not found then raise exception 'A draft nem található.'; end if;
  if d.pool_status <> 'ready' then
    raise exception 'Ez a munkaanyag már nem „Publikálásra váró” állapotban van (közben visszaadták szerkesztésre?) — frissítsd a Karbantartás nézetet.';
  end if;

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
        -- A fő elem váltása CSENDES: a change_log rögzíti, de a verzió nem emelkedik
        -- (nincs felkiáltójel). (A kizáró megszorítás halasztott, így a csere egy
        -- publikáláson belül sorrendfüggetlen.)
        if dc.is_main is distinct from c_row.is_main then
          perform public.log_field_change('component', dc.source_component_id, 'is_main',
                                          c_row.is_main::text, dc.is_main::text,
                                          case when changed then new_v else c_row.version end);
          update public.components set is_main = dc.is_main where id = dc.source_component_id;
        end if;
      else
        insert into public.components (issue_id, tipus, azonosito_tipus, azonosito, megnevezes, version, is_main)
        values (live_issue_id, dc.tipus, dc.azonosito_tipus, dc.azonosito, dc.megnevezes, 1, dc.is_main);
      end if;
    end loop;

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
grant execute on function public.publish_draft_series(uuid) to authenticated;

-- Kész.
