-- ============================================================================
-- 27. lépés / S2 — ADATRENDEZÉS (csak az S1 UTÁN futtatható; külön jóváhagyás kell hozzá).
--
-- JÓVÁHAGYÁSRA VÁR — a tulajdonos kifejezett jóváhagyása nélkül NEM futtatható.
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
  if n <> 1 or (select count(*) from public.components where tipus = 'krtya') <> 1 then
    raise exception 'S2/3: a Lego Star Wars #29 kártya nem a várt állapotban van (találat: %) — megszakítva.', n;
  end if;
  for c in
    select k.id, k.version from public.components k where k.tipus = 'krtya' and k.azonosito = 'LE19'
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
