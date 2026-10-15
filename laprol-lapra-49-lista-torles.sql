-- ============================================================================
-- 49. lépés — LISTÁK TÖRLÉSE (függvény) és a SAJÁT KÉPJAVASLAT TÖRLÉSÉNEK SZABÁLYA (policy).
--
-- JÓVÁHAGYÁSRA VÁR — a tulajdonos kifejezett jóváhagyása nélkül NEM futtatható. ÉLESBEN NEM FUTOTT.
-- Futtatás: node scripts/run-migration.js laprol-lapra-49-lista-torles.sql 49-lista-torles
-- (backup → egyetlen tranzakció, 3 mp-es lock_timeout → COMMIT, hiba esetén ROLLBACK).
--
-- Mit csinál:
--   A) Új függvény: delete_list_value(p_tipus, p_ertek) — a ☰ Listák egy értékének törlése. Csak staff (aktív)
--      hívhatja; csak a használatlan, nem védett érték törölhető; ha használatban van, megáll, és megmondja, hol.
--      A lists táblán a kliensnek közvetlen törlési joga nincs (42. lépés) — ez marad.
--   B) Új sorszintű szabály az image_proposals táblán: a felhasználó a SAJÁT, még FÜGGŐ javaslatát törölheti
--      (a sikertelen képfeltöltés utáni takarítás). Más sort senki nem törölhet közvetlenül.
-- Egy fájl, két független szakasz: mindkettő kicsi, egy mentéssel és egy tranzakcióban fut; a visszaútjuk külön is
-- megadható (a csomag 8. pontja).
--
-- Nem változik: a meglévő 37 függvény szövege és joga, a táblajogok, a többi szabály, adat.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) delete_list_value
--    Sorrend: jogosultság → a lista ismert-e → az érték megvan-e (zárolva) → védett-e → használatban van-e → törlés.
--    Védett (soha nem törölhető):
--      • az „Egyéb” (ertek = 'egyeb') minden listában — a kliens tartalék értéke (alapérték, sorrend);
--      • komponens-típus, amelyhez típusleírás tartozik (component_type_defs.tipus) — a szabályok, a mezők és a
--        fő elem választása (pick_main_component: magazin, konyv) erre épül;
--      • azonosító-típus, amelyre a típusleírás hivatkozik (default_azonosito_tipus, azonosito_tipusok), valamint
--        az isbn és az issn (a sorozat-azonosító szabálya, series_azonositok_error).
--    Használat (kis- és nagybetűtől függetlenül; a JSON-ban a kulcs szerint):
--      • kiado:     series.kiado, draft_series.kiado
--      • kategoria: series.kategoria, draft_series.kategoria
--      • komponens: components.tipus, draft_components.tipus, series / draft_series .components (tömb) és
--                   .component_template (JSON: tipus)
--      • azonosito: components.azonosito_tipus, draft_components.azonosito_tipus, series / draft_series .azonositok
--                   (JSON: tipus) és .component_template (JSON: default_azonosito_tipus)
--      • forras:    member_issue_data.forras (személyes adat: csak a felhasználók SZÁMA kerül az üzenetbe), issues.forras
--    A változásnapló (change_log) régi bejegyzései nem számítanak használatnak (múltbeli érték).
--    Naplózás nincs (a Lista nem verziózott törzsadat); a függvény egy tranzakcióban fut.
-- ---------------------------------------------------------------------------
create function public.delete_list_value(p_tipus text, p_ertek text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l        public.lists%rowtype;
  v_mi     text;              -- „a kiadó”, „az azonosító-típus” … (az üzenetekhez)
  v_nev    text;              -- a megjelenített név
  v_hol    text[] := '{}';    -- a használati helyek, emberi nyelven
  n        int;
  m        int;
  v_nevek  text;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod lista-elemet törölni.';
  end if;

  v_mi := case p_tipus
            when 'kiado'     then 'a kiadó'
            when 'kategoria' then 'a kategória'
            when 'komponens' then 'a komponens-típus'
            when 'azonosito' then 'az azonosító-típus'
            when 'forras'    then 'a beszerzési forrás'
          end;
  if v_mi is null then
    raise exception 'Ismeretlen lista: „%”.', coalesce(p_tipus, '');
  end if;

  select * into l from public.lists where tipus = p_tipus and ertek = p_ertek for update;
  if not found then
    raise exception 'Ez a lista-elem már nem található — frissítsd az oldalt.';
  end if;
  v_nev := coalesce(nullif(btrim(l.megjelenites), ''), l.ertek);

  -- ---- védett értékek ----
  if lower(l.ertek) = 'egyeb' then
    raise exception 'Az „%” a lista tartalék értéke (ide kerül, ami máshová nem illik), ezért nem törölhető.', v_nev;
  end if;
  if p_tipus = 'komponens'
     and exists (select 1 from public.component_type_defs d where lower(d.tipus) = lower(l.ertek)) then
    raise exception 'A(z) „%” komponens-típushoz típusleírás tartozik (szabályok, mezők), ezért nem törölhető.', v_nev;
  end if;
  if p_tipus = 'azonosito'
     and (lower(l.ertek) in ('isbn', 'issn')
          or exists (select 1 from public.component_type_defs d
                      where lower(d.default_azonosito_tipus) = lower(l.ertek)
                         or exists (select 1 from unnest(d.azonosito_tipusok) x where lower(x) = lower(l.ertek)))) then
    raise exception 'A(z) „%” azonosító-típusra a rendszer szabályai hivatkoznak (típusleírás, sorozat-azonosító), ezért nem törölhető.', v_nev;
  end if;

  -- ---- használat ----
  if p_tipus in ('kiado', 'kategoria') then
    select count(*) into n from public.series s
     where lower(case when p_tipus = 'kiado' then s.kiado else s.kategoria end) = lower(l.ertek);
    if n > 0 then
      select string_agg(x, ', ') into v_nevek from (
        select s.megnevezes as x from public.series s
         where lower(case when p_tipus = 'kiado' then s.kiado else s.kategoria end) = lower(l.ertek)
         order by s.megnevezes limit 3) t;
      v_hol := v_hol || format('%s sorozatnál (%s%s)', n, v_nevek, case when n > 3 then ', …' else '' end);
    end if;
    select count(*) into m from public.draft_series d
     where lower(case when p_tipus = 'kiado' then d.kiado else d.kategoria end) = lower(l.ertek);
    if m > 0 then v_hol := v_hol || format('%s munkaanyagban', m); end if;

  elsif p_tipus = 'komponens' then
    select count(*), count(distinct i.series_id) into n, m
      from public.components c join public.issues i on i.id = c.issue_id
     where lower(c.tipus) = lower(l.ertek);
    if n > 0 then v_hol := v_hol || format('%s elemnél (%s sorozatban)', n, m); end if;
    select count(*) into n from public.draft_components c where lower(c.tipus) = lower(l.ertek);
    if n > 0 then v_hol := v_hol || format('%s munkaanyagbeli elemnél', n); end if;
    select count(*) into n from public.series s
     where exists (select 1 from unnest(s.components) x where lower(x) = lower(l.ertek))
        or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(s.component_template) = 'array' then s.component_template else '[]'::jsonb end) e
                    where lower(e->>'tipus') = lower(l.ertek));
    if n > 0 then v_hol := v_hol || format('%s sorozat sablonjában', n); end if;
    select count(*) into n from public.draft_series d
     where exists (select 1 from unnest(d.components) x where lower(x) = lower(l.ertek))
        or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(d.component_template) = 'array' then d.component_template else '[]'::jsonb end) e
                    where lower(e->>'tipus') = lower(l.ertek));
    if n > 0 then v_hol := v_hol || format('%s munkaanyag sablonjában', n); end if;

  elsif p_tipus = 'azonosito' then
    select count(*), count(distinct i.series_id) into n, m
      from public.components c join public.issues i on i.id = c.issue_id
     where lower(c.azonosito_tipus) = lower(l.ertek);
    if n > 0 then v_hol := v_hol || format('%s elemnél (%s sorozatban)', n, m); end if;
    select count(*) into n from public.draft_components c where lower(c.azonosito_tipus) = lower(l.ertek);
    if n > 0 then v_hol := v_hol || format('%s munkaanyagbeli elemnél', n); end if;
    select count(*) into n from public.series s
     where exists (select 1 from jsonb_array_elements(case when jsonb_typeof(s.azonositok) = 'array' then s.azonositok else '[]'::jsonb end) e
                    where lower(e->>'tipus') = lower(l.ertek))
        or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(s.component_template) = 'array' then s.component_template else '[]'::jsonb end) e
                    where lower(e->>'default_azonosito_tipus') = lower(l.ertek));
    if n > 0 then v_hol := v_hol || format('%s sorozat azonosítójában vagy sablonjában', n); end if;
    select count(*) into n from public.draft_series d
     where exists (select 1 from jsonb_array_elements(case when jsonb_typeof(d.azonositok) = 'array' then d.azonositok else '[]'::jsonb end) e
                    where lower(e->>'tipus') = lower(l.ertek))
        or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(d.component_template) = 'array' then d.component_template else '[]'::jsonb end) e
                    where lower(e->>'default_azonosito_tipus') = lower(l.ertek));
    if n > 0 then v_hol := v_hol || format('%s munkaanyag azonosítójában vagy sablonjában', n); end if;

  elsif p_tipus = 'forras' then
    select count(distinct x.user_id) into n from public.member_issue_data x where lower(x.forras) = lower(l.ertek);
    if n > 0 then v_hol := v_hol || format('%s felhasználó beszerzési adatánál', n); end if;
    select count(*) into n from public.issues i where lower(i.forras) = lower(l.ertek);
    if n > 0 then v_hol := v_hol || format('%s Számnál', n); end if;
  end if;

  if cardinality(v_hol) > 0 then
    raise exception 'Ez % még használatban van: %. Előbb azokat módosítsd.', v_mi, array_to_string(v_hol, '; ');
  end if;

  delete from public.lists where id = l.id;
  return jsonb_build_object('torolve', true, 'tipus', l.tipus, 'ertek', l.ertek, 'nev', v_nev);
end;
$$;

-- Hívási jog (CLAUDE.md, specifikáció 13.14.9): kliensből hívott → A csoport.
revoke execute on function public.delete_list_value(text, text) from public, anon;
grant execute on function public.delete_list_value(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- B) image_proposals — a saját, még függő javaslat törlése.
--    A kliens (component-images.js, proposeImage) a javaslat sorát a képfeltöltés ELŐTT szúrja be; ha a feltöltés
--    elakad, törölni próbálja. Eddig nem volt törlési szabály → 0 sor törlődött, a „függő” javaslat bent ragadt
--    (a felhasználónál „A javaslatod elbírálás alatt”, a staffnál kép nélküli javaslat). A táblaszintű DELETE jogot
--    az authenticated a 47. lépésben megtartotta, ezért elég a szabály. Az elbírált (approved / rejected) javaslat és
--    más felhasználó javaslata nem törölhető; a staffnak sem ad törlési jogot (eddig sem volt).
--    Az aktív fiók nem feltétel: a saját függő javaslat eltávolítása ártalmatlan takarítás.
-- ---------------------------------------------------------------------------
create policy "image_proposals delete own pending" on public.image_proposals
  for delete to authenticated
  using (proposed_by = auth.uid() and status = 'pending');

-- ---------------------------------------------------------------------------
-- Záró önellenőrzés: ha bármi nem a várt, az egész visszagörög.
-- ---------------------------------------------------------------------------
do $$
declare
  bad text[] := '{}';
  r   record;
  n   int;
begin
  select p.prosecdef, coalesce(p.proconfig::text, '') as cfg, coalesce(p.proacl::text, '(alap)') as acl into r
    from pg_proc p where p.oid = 'public.delete_list_value(text, text)'::regprocedure;
  if not r.prosecdef then bad := bad || 'delete_list_value: nem SECURITY DEFINER'::text; end if;
  if r.cfg <> '{search_path=public}' then bad := bad || format('delete_list_value: search_path [%s]', r.cfg); end if;
  if r.acl <> '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    bad := bad || format('delete_list_value: ACL [%s]', r.acl);
  end if;
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f';
  if n <> 38 then bad := bad || format('függvények száma: %s (várt: 38)', n); end if;
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and has_function_privilege('authenticated', p.oid, 'execute');
  if n <> 24 then bad := bad || format('az authenticated %s függvényt hívhat (várt: 24)', n); end if;
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute');
  if n <> 8 then bad := bad || format('az anon %s függvényt hívhat (várt: 8)', n); end if;

  select * into r from pg_policies
   where schemaname = 'public' and tablename = 'image_proposals' and policyname = 'image_proposals delete own pending';
  if not found then
    bad := bad || 'image_proposals: a törlési szabály hiányzik'::text;
  elsif r.cmd <> 'DELETE' or r.roles::text <> '{authenticated}' or r.permissive <> 'PERMISSIVE'
     or r.qual <> '((proposed_by = auth.uid()) AND (status = ''pending''::text))' or r.with_check is not null then
    bad := bad || format('image_proposals: a törlési szabály nem a várt [%s | %s | %s | %s]', r.cmd, r.roles, r.qual, r.with_check);
  end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'image_proposals';
  if n <> 4 then bad := bad || format('image_proposals: %s szabály (várt: 4)', n); end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'image_proposals' and cmd = 'DELETE';
  if n <> 1 then bad := bad || format('image_proposals: %s törlési szabály (várt: 1)', n); end if;

  if cardinality(bad) > 0 then
    raise exception E'49. lépés: nem a várt állapot — megszakítva.\n%', array_to_string(bad, E'\n');
  end if;
  raise notice '49. lépés kész: delete_list_value (A csoport, 38 függvény, a bejelentkezett 24-et hívhat); image_proposals: a saját függő javaslat törölhető.';
end $$;

notify pgrst, 'reload schema';
