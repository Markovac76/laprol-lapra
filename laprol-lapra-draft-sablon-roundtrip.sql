-- ============================================================================
-- LAPRÓL LAPRA — oda-vissza sablon, előnézet, ütközés-védelem
-- (feltöltés-átalakítási kör, 1–5. pont)
-- Futtatás: scripts/run-migration.js (backup + BEGIN/COMMIT). Idempotens.
-- Csak ÚJ függvényeket vesz fel; meglévő táblához/függvényhez nem nyúl.
--
-- 1) draft_lapszam_conflicts(draft, változtatások): az EGY forrás a
--    lapszám-ütközés ellenőrzéséhez. A publikálás UTÁNI állapotot szimulálja:
--      • a draft nem törölt tételei (a hipotetikus módosításokkal),
--      • a hipotetikus ÚJ sorok,
--      • az élő sorozat nem törölt Számai, amiket a draft NEM kezel (nincs
--        draft-soruk): ezek a publikálás után is megmaradnak.
--    Ugyanezt hívja a "Kész" gomb, a feltöltés előnézete és a feltöltés
--    alkalmazása. (A publikáló függvény saját, a tényleges sorokon futó
--    utolsó védelme — 10. pont — ennek megfelelője.)
-- 2) mark_draft_ready(draft): "Munkaanyag" → "Publikálásra váró", de csak ha
--    nincs lapszám-ütközés. Eddig sima kliens-oldali UPDATE volt.
-- 3) apply_draft_upload(draft, payload): a sablon-feltöltés alkalmazása EGY
--    tranzakcióban (a korábbi soronkénti kliens-hívások helyett), a végén
--    ütközés-ellenőrzéssel — hiba esetén az egész visszagördül.
-- ============================================================================

create or replace function public.draft_lapszam_conflicts(p_draft_id uuid, p_changes jsonb default '[]'::jsonb)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  d   public.draft_series%rowtype;
  res jsonb;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod ehhez a művelethez.';
  end if;
  select * into d from public.draft_series where id = p_draft_id;
  if not found then raise exception 'A munkaanyag nem található.'; end if;

  with ch as (
    select nullif(x->>'id','')::uuid       as id,
           nullif(x->>'lapszam','')::int   as lapszam,
           (x->>'deleted')::boolean        as deleted,
           x->>'cim'                       as cim
    from jsonb_array_elements(coalesce(p_changes,'[]'::jsonb)) x
  ),
  dr as (
    select di.id,
           coalesce(c.lapszam, di.lapszam)       as lapszam,
           coalesce(c.cim, di.cim, '')           as cim,
           coalesce(c.deleted, di.deleted)       as deleted,
           'draft'::text                         as eredet
    from public.draft_issues di
    left join ch c on c.id = di.id
    where di.draft_series_id = p_draft_id
  ),
  nw as (
    select null::uuid as id, lapszam, coalesce(cim,'') as cim, false as deleted, 'új'::text as eredet
    from ch where id is null and lapszam is not null
  ),
  lv as (
    select i.id, i.lapszam, coalesce(i.cim,'') as cim, false as deleted, 'élő'::text as eredet
    from public.issues i
    where d.source_series_id is not null
      and i.series_id = d.source_series_id
      and not i.is_deleted
      and not exists (select 1 from public.draft_issues x
                      where x.draft_series_id = p_draft_id and x.source_issue_id = i.id)
  ),
  fin as (
    select * from dr where not deleted
    union all select * from nw
    union all select * from lv
  ),
  dup as (select lapszam from fin group by lapszam having count(*) > 1)
  select coalesce(jsonb_agg(jsonb_build_object('lapszam', g.lapszam, 'tetelek', g.items) order by g.lapszam), '[]'::jsonb)
    into res
  from (
    select f.lapszam,
           jsonb_agg(jsonb_build_object('eredet', f.eredet, 'cim', f.cim) order by f.eredet, f.cim) as items
    from fin f
    where f.lapszam in (select lapszam from dup)
    group by f.lapszam
  ) g;

  return res;
end;
$$;
grant execute on function public.draft_lapszam_conflicts(uuid, jsonb) to authenticated;

create or replace function public.draft_conflicts_text(p_conf jsonb)
  returns text language sql immutable set search_path = public as $$
  select string_agg(
    format('%s. lapszám: %s', c->>'lapszam',
      (select string_agg(
          coalesce(nullif(t->>'cim',''), '(cím nélkül)') || ' ['
          || case t->>'eredet'
               when 'draft' then 'a munkaanyagban'
               when 'új'    then 'új sor a feltöltésben'
               else 'az élő sorozatban, a munkaanyag nem érinti' end
          || ']', ' · ')
       from jsonb_array_elements(c->'tetelek') t)),
    E'\n')
  from jsonb_array_elements(p_conf) c
$$;

create or replace function public.mark_draft_ready(p_draft_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  d    public.draft_series%rowtype;
  conf jsonb;
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

  conf := public.draft_lapszam_conflicts(p_draft_id, '[]'::jsonb);
  if jsonb_array_length(conf) > 0 then
    raise exception E'A munkaanyag nem állítható „Kész”-re: a publikálás után több nem törölt Szám ugyanazt a lapszámot kapná.\n\n%\n\nJavítsd a lapszámokat, vagy jelöld törlésre az élő Számot, majd próbáld újra.',
      public.draft_conflicts_text(conf);
  end if;

  update public.draft_series set pool_status = 'ready', ready_at = now() where id = p_draft_id;
end;
$$;
grant execute on function public.mark_draft_ready(uuid) to authenticated;

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
  n_new      int := 0;
  n_upd      int := 0;
  n_cnew     int := 0;
  n_cupd     int := 0;
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
                            'frissitett_komponens', n_cupd, 'torolt', n_del);
end;
$$;
grant execute on function public.apply_draft_upload(uuid, jsonb) to authenticated;

-- Kész.
