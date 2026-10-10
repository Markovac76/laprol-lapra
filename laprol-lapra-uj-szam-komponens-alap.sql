-- ============================================================================
-- LAPRÓL LAPRA — minden ÚJ draft-Számhoz jöjjön létre a sorozat deklarált
-- komponens-típusainak (üres) példánya — szerver-oldalon
-- Futtatás: scripts/run-migration.js (backup + BEGIN/COMMIT). Idempotens
-- (CREATE OR REPLACE).
--
-- A hiba (a457ed7, 2026-10-10): az oda-vissza sablon feltöltése az ÚJ sorokhoz
-- csak azokat a komponenseket hozta létre, amelyek azonosító- vagy megnevezés-
-- cellája ki volt töltve. Üres komponens-celláknál a Szám komponens nélkül
-- jött létre, és a publikálás is komponens nélküli élő Számot hozott létre
-- (Autós Legendák: 60 Szám, 0 komponens). A régi viselkedés (és a kézi
-- szerkesztő viselkedése, draft-items.js) az, hogy egy új Számon a sorozat
-- MINDEN deklarált típusából van egy (üres) példány.
--
-- A javítás szerver-oldali, hogy a kliens-logika ne tudja újra elrontani:
-- az apply_draft_upload a feltöltés minden ÚJ draft-Számához felveszi a sorozat
-- (draft_series.components) deklarált típusainak hiányzó üres példányait —
-- szerkesztési és új-sorozat draftban is.
--
-- A beküldői út (propose_bulk_issues) SZÁNDÉKOSAN változatlan: azt a kliens
-- minden csoporttal hívja, és ha a beküldő szándékosan elhagyott egy típust,
-- azt nem szabad csendben visszatenni (egy Számon nem kell minden deklarált
-- típusnak meglennie).
--
-- Az üres példány pontosan olyan, mint a kézi szerkesztőé: tipus kitöltve,
-- azonosito_tipus / azonosito / megnevezes NULL, source_component_id NULL.
-- Már létező (élő párral rendelkező) Számot nem érint. A deklarált típusok
-- sorrendjét megtartja (unnest ... with ordinality).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- apply_draft_upload — az élő definíció (laprol-lapra-draft-sablon-
--    roundtrip.sql) + az új Számok hiányzó komponens-típusainak felvétele.
--    A visszatérési JSON új kulcsa: auto_komponens.
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

-- Kész.
