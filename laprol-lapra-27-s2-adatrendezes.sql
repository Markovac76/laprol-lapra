-- ============================================================================
-- 27. lépés / S2 — ADATRENDEZÉS (csak az S1 UTÁN futtatható; külön jóváhagyás kell hozzá).
-- Módosítva a 36. lépésben: (a) a kártya-lépés feltétele a Lego Star Wars sorozatra szűkül; (b) az 5. pont új:
-- a draft_ready_warnings ÁTMENETI duplikáció-szabálya kikerül.
--
-- JÓVÁHAGYÁSRA VÁR — a tulajdonos kifejezett jóváhagyása nélkül NEM futtatható. ÉLESBEN NEM FUTOTT.
-- Futtatás: node scripts/run-migration.js laprol-lapra-27-s2-adatrendezes.sql 27-s2-adatrendezes
-- (backup → egyetlen tranzakció → COMMIT, hiba esetén ROLLBACK).
--
-- Minden lépés CSENDES: nem emel verziót (nincs felkiáltójel), a change_log rögzíti.
-- A személyes adatok (member_status, member_issue_data, member_seen) érintetlenek: a komponensek
-- azonosítója (id) nem változik. Minden lépés a futás pillanatában ÚJRA ellenőrzi a feltételeit
-- (darabszám, különböző értékek száma, nincs függő szerkesztési draft); bármelyik eltérésnél az
-- egész megszakad, és semmi nem változik.
--
--   1) sorozatszámok a sorozat törzsébe (5 sorozat, összesen 155 komponens azonosítója ürül)
--   2) Disney Hangos: „modell” → „figura” (82 komponens + a sorozat sablonja és komponens-listája)
--   3) Lego Star Wars #29 kártya: az azonosító-típusa a Kártya fix típusa lesz (Kód = LE19, Név marad)
--   4) Listák: a „kártya” komponens-típus megjelenített neve „Kártya” (a kulcs — krtya — marad)
--   5) draft_ready_warnings: az S1-ben bevezetett ÁTMENETI szabály (a kiadvány-családban a 3 vagy több
--      komponensen azonos érték nem duplikáció) kikerül — az 1) lépés után már nincs rá szükség. A függvény
--      minden más sora szó szerint az élő (S1 utáni) definíció. Adatot nem módosít.
-- ============================================================================

do $$
declare
  r        record;
  c        record;
  s        public.series%rowtype;
  n        int;
  n_kul    int;
  n_ossz   int := 0;
  uj       jsonb;
  uj_tmpl  jsonb;
  uj_comps text[];
begin
  -- Előfeltétel: az S1 lefutott.
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'series' and column_name = 'azonositok')
     or not exists (select 1 from public.component_type_defs where tipus = 'krtya' and azonosito_mod = 'fix') then
    raise exception 'S2: az S1 (szerkezet) még nem futott le — megszakítva.';
  end if;

  -- ------------------------------------------------------------------ 1) sorozatszámok
  for r in
    select * from (values
      -- sorozat (megjelenített név), komponens-típus, azonosító-típus, érték, várt darab, más érték megengedett darabszáma
      ('Disney',           'konyv',   'issn', '3103-4152',          8, 0),
      ('Volkswagen model', 'magazin', 'isbn', '978-88-334-2749-2', 23, 0),
      ('Disney Hangos',    'konyv',   'isbn', '978-88-334-2840-6', 81, 1),   -- a 82. (978-88-334-2839-0) a komponensén marad
      ('Lego Star Wars',   'magazin', 'issn', '2568-2474',         42, 0),
      ('Lego Marvel',      'magazin', 'issn', '3053-5611',          1, 0)
    ) as t(sorozat, tipus, az_tipus, ertek, varhato, mas_ertek)
  loop
    select count(*) into n from public.series where megjelenites = r.sorozat;
    if n <> 1 then raise exception 'S2/1: „%” nevű sorozatból % van (1 kell) — megszakítva.', r.sorozat, n; end if;
    select * into s from public.series where megjelenites = r.sorozat for update;

    if exists (select 1 from public.draft_series d where d.source_series_id = s.id) then
      raise exception 'S2/1: a(z) „%” sorozaton függő szerkesztési munkaanyag van — a publikálása visszaírhatná a régi értékeket. Előbb zárd le (publikáld vagy töröld) a munkaanyagot. Megszakítva.', r.sorozat;
    end if;
    if s.azonositok <> '[]'::jsonb then
      raise exception 'S2/1: a(z) „%” sorozatnak már van sorozat-azonosítója (%) — megszakítva.', r.sorozat, s.azonositok;
    end if;

    -- a futás pillanatában: pontosan a várt darab hordozza az értéket, és nincs váratlan más érték
    select count(*) filter (where k.azonosito = r.ertek),
           count(*) filter (where k.azonosito <> r.ertek)
      into n, n_kul
      from public.components k
      join public.issues i on i.id = k.issue_id
     where i.series_id = s.id and k.tipus = r.tipus and coalesce(btrim(k.azonosito), '') <> '';
    if n <> r.varhato or n_kul <> r.mas_ertek then
      raise exception 'S2/1: „%” / %: % komponensen áll a(z) % érték (várt: %), más értékű: % (várt: %) — megszakítva.',
        r.sorozat, r.tipus, n, r.ertek, r.varhato, n_kul, r.mas_ertek;
    end if;

    uj := jsonb_build_array(jsonb_build_object('tipus', r.az_tipus, 'ertek', r.ertek));
    perform public.log_field_change('series', s.id, 'azonositok', s.azonositok::text, uj::text, s.version);
    update public.series set azonositok = uj where id = s.id;

    for c in
      select k.id, k.azonosito, k.azonosito_tipus, k.version
        from public.components k
        join public.issues i on i.id = k.issue_id
       where i.series_id = s.id and k.tipus = r.tipus and k.azonosito = r.ertek
    loop
      perform public.log_field_change('component', c.id, 'azonosito', c.azonosito, null, c.version);
      if c.azonosito_tipus is not null then
        perform public.log_field_change('component', c.id, 'azonosito_tipus', c.azonosito_tipus, null, c.version);
      end if;
      update public.components set azonosito = null, azonosito_tipus = null where id = c.id;
      n_ossz := n_ossz + 1;
    end loop;
  end loop;
  if n_ossz <> 155 then
    raise exception 'S2/1: összesen % komponens azonosítója ürült volna (várt: 155) — megszakítva.', n_ossz;
  end if;

  -- ------------------------------------------------------------------ 2) Disney Hangos: modell → figura
  select * into s from public.series where megjelenites = 'Disney Hangos' for update;
  select count(*) filter (where k.tipus = 'modell'), count(*) filter (where k.tipus = 'figura')
    into n, n_kul
    from public.components k join public.issues i on i.id = k.issue_id
   where i.series_id = s.id;
  if n <> 82 or n_kul <> 0 or not ('modell' = any(s.components)) or 'figura' = any(s.components) then
    raise exception 'S2/2: Disney Hangos — % modell és % figura komponens (várt: 82 és 0), komponens-lista: % — megszakítva.', n, n_kul, s.components;
  end if;

  for c in
    select k.id, k.version from public.components k join public.issues i on i.id = k.issue_id
     where i.series_id = s.id and k.tipus = 'modell'
  loop
    perform public.log_field_change('component', c.id, 'tipus', 'modell', 'figura', c.version);
    update public.components set tipus = 'figura' where id = c.id;
  end loop;

  uj_comps := array_replace(s.components, 'modell', 'figura');
  select jsonb_agg(case when x->>'tipus' = 'modell' then jsonb_set(x, '{tipus}', '"figura"') else x end order by o)
    into uj_tmpl from jsonb_array_elements(s.component_template) with ordinality as t(x, o);
  if public.component_template_error(uj_tmpl) is not null then
    raise exception 'S2/2: az átírt komponens-sablon érvénytelen lenne (%) — megszakítva.', public.component_template_error(uj_tmpl);
  end if;
  perform public.log_field_change('series', s.id, 'components', array_to_string(s.components, ','), array_to_string(uj_comps, ','), s.version);
  perform public.log_field_change('series', s.id, 'component_template', s.component_template::text, uj_tmpl::text, s.version);
  update public.series set components = uj_comps, component_template = uj_tmpl where id = s.id;

  -- ------------------------------------------------------------------ 3) Lego Star Wars #29 kártya
  select count(*) into n
    from public.components k join public.issues i on i.id = k.issue_id join public.series x on x.id = i.series_id
   where x.megjelenites = 'Lego Star Wars' and i.lapszam = 29 and k.tipus = 'krtya'
     and k.azonosito = 'LE19' and k.megnevezes = 'Bo-Katan Kryze' and k.azonosito_tipus = 'egyeb';
  -- (A feltétel a Lego Star Wars sorozatra szűkül: a sorozatnak pontosan egy kártya komponense van. Más
  -- sorozatok kártyáihoz — a 32. lépés óta a TESZT sorozatban is vannak — ez a lépés nem nyúl.)
  if n <> 1 or (select count(*) from public.components k join public.issues i on i.id = k.issue_id join public.series x on x.id = i.series_id
                 where x.megjelenites = 'Lego Star Wars' and k.tipus = 'krtya') <> 1 then
    raise exception 'S2/3: a Lego Star Wars #29 kártya nem a várt állapotban van (találat: %) — megszakítva.', n;
  end if;
  for c in
    select k.id, k.version
      from public.components k join public.issues i on i.id = k.issue_id join public.series x on x.id = i.series_id
     where x.megjelenites = 'Lego Star Wars' and i.lapszam = 29 and k.tipus = 'krtya' and k.azonosito = 'LE19'
  loop
    perform public.log_field_change('component', c.id, 'azonosito_tipus', 'egyeb', 'kartya_kod', c.version);
    update public.components set azonosito_tipus = 'kartya_kod' where id = c.id;
    -- A Kód (azonosito = LE19) és a Név (megnevezes = Bo-Katan Kryze) a helyén van; a Gyűjtemény és
    -- a többi mező (components.adatok) üres marad — a tulajdonos tölti ki a felületen.
  end loop;

  -- ------------------------------------------------------------------ 4) Listák: „kártya” → „Kártya”
  update public.lists set megjelenites = 'Kártya'
   where tipus = 'komponens' and ertek = 'krtya' and megjelenites = 'kártya';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'S2/4: a „kártya” komponens-típus sora nem a várt állapotban van (módosult sor: %) — megszakítva.', n; end if;

  raise notice 'S2 kész: % komponens azonosítója a sorozat törzsébe került, 82 modell → figura, 1 kártya, 1 Listák-érték.', n_ossz;
end $$;

-- ============================================================================
-- 5) draft_ready_warnings — az ÁTMENETI duplikáció-szabály kivétele
--    Az élő (S1 utáni) definíció, három sor elhagyásával: a „having count(*) > 1” utáni két megjegyzés-sor
--    és az „and not (count(*) >= 3 and tipus in (… csalad = 'kiadvany'))” feltétel. Minden más sor változatlan.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.draft_ready_warnings(p_draft_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d    public.draft_series%rowtype;
  tmpl jsonb;
  res  jsonb := '[]'::jsonb;
  r    record;
  nev  text;
  lst  jsonb;
  sor_norm text[];
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod ehhez a művelethez.';
  end if;
  select * into d from public.draft_series where id = p_draft_id;
  if not found then raise exception 'A munkaanyag nem található.'; end if;
  tmpl := case when jsonb_typeof(d.component_template) = 'array' and jsonb_array_length(d.component_template) > 0
               then d.component_template else public.default_component_template(d.components) end;

  -- 1) AJÁNLOTT azonosító: hány ilyen típusú komponens azonosító nélkül (nem törölt Számokon)
  for r in
    select x->>'tipus' as tipus, count(dc.id) as n
      from jsonb_array_elements(tmpl) x
      join public.draft_components dc on dc.tipus = x->>'tipus' and not dc.deleted
      join public.draft_issues di on di.id = dc.draft_issue_id and di.draft_series_id = p_draft_id and not di.deleted
     where x->>'id_rule' = 'ajanlott' and coalesce(btrim(dc.azonosito), '') = ''
     group by 1 having count(dc.id) > 0
  loop
    nev := coalesce((select l.megjelenites from public.lists l where l.tipus = 'komponens' and l.ertek = r.tipus limit 1), r.tipus);
    res := res || jsonb_build_object('kod', 'azonosito_ajanlott',
             'szoveg', r.n || ' ' || nev || ' komponensnek még nincs azonosítója (ajánlott)', 'darab', r.n);
  end loop;

  -- 2) KÖTELEZŐ azonosító a MEGLÉVŐ (nem ebben a draftban hozzáadott) komponenseken: csak figyelmeztet
  for r in
    select x->>'tipus' as tipus, count(dc.id) as n
      from jsonb_array_elements(tmpl) x
      join public.draft_components dc on dc.tipus = x->>'tipus' and dc.source_component_id is not null and not dc.deleted
      join public.draft_issues di on di.id = dc.draft_issue_id and di.draft_series_id = p_draft_id and not di.deleted
     where x->>'id_rule' = 'kotelezo' and coalesce(btrim(dc.azonosito), '') = ''
     group by 1 having count(dc.id) > 0
  loop
    nev := coalesce((select l.megjelenites from public.lists l where l.tipus = 'komponens' and l.ertek = r.tipus limit 1), r.tipus);
    res := res || jsonb_build_object('kod', 'azonosito_kotelezo_meglevo',
             'szoveg', r.n || ' meglévő ' || nev || ' komponensen hiányzik a kötelező azonosító (a meglévőket nem blokkoljuk)', 'darab', r.n);
  end loop;

  -- 2/b) TÍPUSLEÍRÁS szerinti kötelező mező / azonosító-típus a MEGLÉVŐ, nem módosított komponenseken:
  --      csak figyelmeztet (az új és a módosított komponenseken a mark_draft_ready blokkol).
  for r in
    select f.tipus_nev, f.uzenet, count(*) as n
      from public.draft_type_field_issues(p_draft_id) f
     where not f.blokkol
     group by 1, 2 order by 1, 2
  loop
    res := res || jsonb_build_object('kod', 'tipus_mezo_meglevo',
             'szoveg', r.n || ' meglévő ' || r.tipus_nev || ' komponensen ' || r.uzenet || ' (a meglévőket nem blokkoljuk)', 'darab', r.n);
  end loop;

  -- A sorozat-szintű azonosítók (a draft „Sorozat-azonosítók” listája) normalizált értékei: az ezekkel
  -- egyező komponens-azonosító NEM duplikáció (a sorozatszám a sorozatot azonosítja, nem a Számot).
  select coalesce(array_agg(lower(regexp_replace(btrim(e->>'ertek'), '[\s-]+', '', 'g'))), '{}')
    into sor_norm
    from jsonb_array_elements(case when jsonb_typeof(d.azonositok) = 'array' then d.azonositok else '[]'::jsonb end) e;

  -- 3) DUPLIKÁLT azonosító a publikálás UTÁNI állapotban: azonos típus + azonos azonosító
  --    (üresek kihagyva; kis/nagybetű- és szóközfüggetlen). A draft komponensei + az élő sorozat
  --    azon komponensei, amelyeket a draft nem érint.
  with allc as (
    select dc.tipus, lower(regexp_replace(btrim(dc.azonosito), '\s+', '', 'g')) as norm, dc.azonosito as eredeti,
           '#' || di.lapszam as hely
      from public.draft_components dc
      join public.draft_issues di on di.id = dc.draft_issue_id and di.draft_series_id = p_draft_id and not di.deleted
     where coalesce(btrim(dc.azonosito), '') <> '' and not dc.deleted
    union all
    select c.tipus, lower(regexp_replace(btrim(c.azonosito), '\s+', '', 'g')), c.azonosito, '#' || i.lapszam || ' (élő)'
      from public.components c
      join public.issues i on i.id = c.issue_id and not i.is_deleted
     where d.source_series_id is not null and i.series_id = d.source_series_id
       and coalesce(btrim(c.azonosito), '') <> '' and not c.is_deleted
       and not exists (select 1 from public.draft_components x
                         join public.draft_issues xi on xi.id = x.draft_issue_id and xi.draft_series_id = p_draft_id
                        where x.source_component_id = c.id)
       and not exists (select 1 from public.draft_issues xi where xi.draft_series_id = p_draft_id
                          and xi.source_issue_id = i.id and xi.deleted)
  )
  select coalesce(jsonb_agg(jsonb_build_object('tipus', g.tipus, 'azonosito', g.eredeti, 'helyek', g.helyek) order by g.tipus, g.norm), '[]'::jsonb)
    into lst
    from (select tipus, norm, min(eredeti) as eredeti, jsonb_agg(hely order by hely) as helyek
            from allc
           where not (replace(norm, '-', '') = any(sor_norm))
           group by tipus, norm
          having count(*) > 1
           order by tipus, norm limit 10) g;
  if jsonb_array_length(lst) > 0 then
    res := res || jsonb_build_object('kod', 'azonosito_duplikalt',
             'szoveg', jsonb_array_length(lst) || ' azonosító kétszer vagy többször szerepel azonos típusú komponensen a sorozatban (legfeljebb 10 felsorolva)',
             'tetelek', lst);
  end if;

  return res;
end;
$function$;

grant execute on function public.draft_ready_warnings(uuid) to authenticated;

notify pgrst, 'reload schema';
