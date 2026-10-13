-- ============================================================================
-- 47. lépés — JOGOSULTSÁGI HIGIÉNIA a public séma MINDEN tábláján (csak REVOKE / GRANT / ALTER DEFAULT PRIVILEGES).
--
-- JÓVÁHAGYÁSRA VÁR — a tulajdonos kifejezett jóváhagyása nélkül NEM futtatható. ÉLESBEN NEM FUTOTT.
-- Futtatás: node scripts/run-migration.js laprol-lapra-47-jogosultsagi-higienia.sql 47-jogosultsagi-higienia
-- (backup → egyetlen tranzakció, 3 mp-es lock_timeout → COMMIT, hiba esetén ROLLBACK).
--
-- Mit csinál: a (C3) (42. lépés) folytatása a többi táblán. Táblajogot, egy szekvencia jogát, egy függvény hívási
-- jogát és az ÚJ táblák / szekvenciák alapértelmezett jogát szűkíti. Függvény szövegét, RLS-szabályt (policy),
-- adatot nem módosít. A service_role és a tulajdonos (postgres) joga nem változik — a SECURITY DEFINER függvények
-- a tulajdonos jogával írnak, ezért nem érinti őket.
--
-- Elvek:
--   1) Az anon (bejelentkezés nélküli hívó) SEMMIT nem kap: se írást, se olvasást, egyik táblán sem. Az app belépés
--      előtt egyetlen táblát sem olvas (csak a belépőképernyő, a config.js és a verzio.json töltődik be).
--   2) A TRUNCATE, REFERENCES, TRIGGER, MAINTAIN jog az authenticated szerepkörtől is megszűnik mindenhol (ezeket a
--      sorszintű szabályok nem fogják, és a kliens egyiket sem használja).
--   3) Az authenticated csak ott és csak azt írhatja, amit a kliens ténylegesen ír. Ahol a kliens a SAJÁT sorait
--      vagy staffként munkaanyagot ír (member_*, draft_*), a táblaszintű jog marad — a sorszintű szabály védi.
--      Ahol csak egy-két oszlopot ír (members, image_proposals), oszlopszintű kivétel (a 42. lépés mintájára).
--   4) Amit a kliens nem használ (counters, global_counters, system_heartbeat), ott az olvasás is megszűnik.
--   5) Az ÚJ táblák és szekvenciák ne örököljék a nyitott jogot (ahogy a függvényeknél a 40. lépés óta).
--
-- ELŐFELTÉTEL a 0) ponthoz: a kliens holt kódja (js/changes.js, seedNewIssueSeen) már ne legyen kint.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Függvény: a seed_issue_seen_for_subscribers átsorolása a belső segédek közé.
--    A kliens már nem hívja (az új Számot a create_live_issue veszi fel, az belül intézi). Belülről két
--    SECURITY DEFINER függvény hívja (create_live_issue, publish_draft_series) — a tulajdonos jogával.
--    A PUBLIC és az anon joga a 39. lépésben megszűnt; most az authenticated is. A függvény szövege nem változik.
-- ---------------------------------------------------------------------------
revoke execute on function public.seed_issue_seen_for_subscribers(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- 1) anon: minden jog megvonva mind a 18 táblán (olvasás is).
-- ---------------------------------------------------------------------------
revoke all privileges on table public.series              from anon;
revoke all privileges on table public.issues              from anon;
revoke all privileges on table public.components          from anon;
revoke all privileges on table public.lists               from anon;
revoke all privileges on table public.component_type_defs from anon;
revoke all privileges on table public.change_log          from anon;
revoke all privileges on table public.global_counters     from anon;
revoke all privileges on table public.counters            from anon;
revoke all privileges on table public.system_heartbeat    from anon;
revoke all privileges on table public.members             from anon;
revoke all privileges on table public.member_status       from anon;
revoke all privileges on table public.member_issue_data   from anon;
revoke all privileges on table public.member_seen         from anon;
revoke all privileges on table public.member_series       from anon;
revoke all privileges on table public.draft_series        from anon;
revoke all privileges on table public.draft_issues        from anon;
revoke all privileges on table public.draft_components    from anon;
revoke all privileges on table public.image_proposals     from anon;

-- ---------------------------------------------------------------------------
-- 2) authenticated — a hat törzsadat-tábla (42. lépés) NEM változik: series, issues, components, lists, change_log.
--    Kivétel a global_counters: szabály (policy) nincs rajta, a kliens nem olvassa → az olvasás is megszűnik.
-- ---------------------------------------------------------------------------
revoke all privileges on table public.global_counters from authenticated;

-- component_type_defs — a kliens csak olvassa (típusleírás); írni eddig sem tudta. A maradék három jog megszűnik.
revoke references, trigger, maintain on table public.component_type_defs from authenticated;

-- counters — régi, holt tábla (a userenkénti sorszámláló; a global_counters váltotta le). A kliens nem használja.
revoke all privileges on table public.counters from authenticated;

-- system_heartbeat — a heti „életjel” táblája; csak az ütemezett feladat írja a postgres nevében. Szabály nincs rajta.
revoke all privileges on table public.system_heartbeat from authenticated;

-- ---------------------------------------------------------------------------
-- 3) members — a tag-sort a regisztráció triggere hozza létre (handle_new_user, a tulajdonos jogával). A kliens
--    (👥 Felhasználók, staff) két oszlopot ír: status (letiltás / visszaengedés) és role (admin jog; csak a tulajdonos).
--    A sorszintű szabály és a protect_members trigger ezekre továbbra is érvényes. Beszúrás, törlés, a megjelenített
--    név, a user_id és a létrehozás ideje közvetlenül nem írható.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger, maintain on table public.members from authenticated;
grant update (status, role) on table public.members to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Személyes táblák — a felhasználó a SAJÁT sorait írja; a sorszintű szabály (user_id = a hívó) védi.
--    A táblaszintű beszúrás és módosítás MARAD: a kliens .upsert-tel ment (beszúrás + ütközéskor módosítás, amely a
--    kulcs-oszlopokat is beállítja), ezért oszlopszintű szűkítés itt nem ad többet, csak törékenyebb lenne.
-- ---------------------------------------------------------------------------
-- member_status (jelölés, darabszám, jegyzet) — a kliens upsertel, és törli a saját sorait (leválasztás, törölt Szám nyugtázása).
revoke truncate, references, trigger, maintain on table public.member_status from authenticated;
-- member_issue_data (fizetett ár, beszerzés) — ugyanígy: upsert és a saját sorok törlése.
revoke truncate, references, trigger, maintain on table public.member_issue_data from authenticated;
-- member_seen („látott” verzió) — a kliens csak upsertel; törölni csak a végleges sorozat-törlés függvénye töröl.
revoke delete, truncate, references, trigger, maintain on table public.member_seen from authenticated;
-- member_series (feliratkozás) — a kliens upsertel és módosít (leválasztás = is_selected hamis); törlés szabály sincs rá.
revoke delete, truncate, references, trigger, maintain on table public.member_series from authenticated;

-- ---------------------------------------------------------------------------
-- 5) Munkaanyag-táblák — a staff a Karbantartás szerkesztőjében közvetlenül ír (beszúr, módosít, töröl), a sima
--    felhasználó új javaslatot szúr be és a saját, még át nem vett javaslatát törölheti. A sorszintű szabály védi;
--    a tartalmat a „Kész” és a publikálás a szerveren ellenőrzi. A táblaszintű írás MARAD.
-- ---------------------------------------------------------------------------
revoke truncate, references, trigger, maintain on table public.draft_series     from authenticated;
revoke truncate, references, trigger, maintain on table public.draft_issues     from authenticated;
revoke truncate, references, trigger, maintain on table public.draft_components from authenticated;

-- ---------------------------------------------------------------------------
-- 6) image_proposals — a felhasználó képjavaslatot szúr be (és sikertelen feltöltésnél megpróbálja törölni a sajátját);
--    a staff az elbírálásnál három oszlopot ír: status, decided_at, decided_by. Más oszlop közvetlenül nem módosítható.
-- ---------------------------------------------------------------------------
revoke update, truncate, references, trigger, maintain on table public.image_proposals from authenticated;
grant update (status, decided_at, decided_by) on table public.image_proposals to authenticated;

-- ---------------------------------------------------------------------------
-- 7) Szekvencia — a változásnapló sorszáma (change_log.id). Csak a log_field_change függvény használja.
-- ---------------------------------------------------------------------------
revoke all privileges on sequence public.change_log_id_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8) Az ÚJ táblák és szekvenciák alapértelmezett joga (a postgres szerepkör által EZUTÁN létrehozottakra, a public
--    sémában): az anon és az authenticated semmit nem kap magától. Minden új tábla mellé a migráció adja meg a jogot.
-- ---------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Záró önellenőrzés: ha a jogok nem pontosan a vártak, az egész visszagörög.
-- ---------------------------------------------------------------------------
do $$
declare
  r     record;
  bad   text[] := '{}';
  van_t text;
  van_u text;
  n     int;
begin
  -- várt: tábla | az authenticated táblaszintű jogai | az authenticated által módosítható oszlopok ('*' = mind)
  for r in
    select * from (values
      ('series',              'SELECT',                      'borito_upload_enabled,borito_url,lifecycle'),
      ('issues',              'SELECT',                      ''),
      ('components',          'SELECT',                      'kep_url,upload_enabled'),
      ('lists',               'SELECT,INSERT',               'megjelenites'),
      ('component_type_defs', 'SELECT',                      ''),
      ('change_log',          'SELECT',                      ''),
      ('global_counters',     '',                            ''),
      ('counters',            '',                            ''),
      ('system_heartbeat',    '',                            ''),
      ('members',             'SELECT',                      'role,status'),
      ('member_status',       'SELECT,INSERT,UPDATE,DELETE', '*'),
      ('member_issue_data',   'SELECT,INSERT,UPDATE,DELETE', '*'),
      ('member_seen',         'SELECT,INSERT,UPDATE',        '*'),
      ('member_series',       'SELECT,INSERT,UPDATE',        '*'),
      ('draft_series',        'SELECT,INSERT,UPDATE,DELETE', '*'),
      ('draft_issues',        'SELECT,INSERT,UPDATE,DELETE', '*'),
      ('draft_components',    'SELECT,INSERT,UPDATE,DELETE', '*'),
      ('image_proposals',     'SELECT,INSERT,DELETE',        'decided_at,decided_by,status')
    ) as t(tabla, auth_tabla, auth_upd)
  loop
    -- anon: semmi (táblaszinten és oszlopszinten sem)
    if exists (select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p
                where has_table_privilege('anon', 'public.' || r.tabla, p))
       or exists (select 1 from pg_attribute a where a.attrelid = ('public.' || r.tabla)::regclass and a.attnum > 0 and not a.attisdropped
                    and (has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT') or has_column_privilege('anon', a.attrelid, a.attnum, 'INSERT')
                      or has_column_privilege('anon', a.attrelid, a.attnum, 'UPDATE'))) then
      bad := bad || format('%s / anon: maradt jog', r.tabla);
    end if;
    -- authenticated: a táblaszintű jogok pontosan a vártak
    select coalesce(string_agg(p, ',' order by o), '') into van_t
      from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) with ordinality u(p, o)
     where has_table_privilege('authenticated', 'public.' || r.tabla, p);
    if van_t <> r.auth_tabla then bad := bad || format('%s / authenticated: táblajog [%s], várt [%s]', r.tabla, van_t, r.auth_tabla); end if;
    -- authenticated: a módosítható oszlopok pontosan a vártak
    select coalesce(string_agg(a.attname, ',' order by a.attname), ''), count(*) into van_u, n
      from pg_attribute a
     where a.attrelid = ('public.' || r.tabla)::regclass and a.attnum > 0 and not a.attisdropped
       and has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE');
    if r.auth_upd = '*' then
      if n <> (select count(*) from pg_attribute a where a.attrelid = ('public.' || r.tabla)::regclass and a.attnum > 0 and not a.attisdropped) then
        bad := bad || format('%s / authenticated: nem minden oszlop módosítható (%s)', r.tabla, van_u);
      end if;
    elsif van_u <> r.auth_upd then
      bad := bad || format('%s / authenticated: módosítható oszlopok [%s], várt [%s]', r.tabla, van_u, r.auth_upd);
    end if;
    -- service_role: mindent megtart
    if exists (select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) p
                where not has_table_privilege('service_role', 'public.' || r.tabla, p)) then
      bad := bad || format('%s / service_role: hiányzó jog', r.tabla);
    end if;
  end loop;
  -- minden tábla szerepel-e a fenti listában (új, besorolatlan tábla ne maradjon ki)
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f');
  if n <> 18 then bad := bad || format('a public sémában %s tábla / nézet van, a lista 18-at fed le', n); end if;
  -- szekvencia
  if has_sequence_privilege('anon', 'public.change_log_id_seq', 'USAGE') or has_sequence_privilege('authenticated', 'public.change_log_id_seq', 'USAGE')
     or has_sequence_privilege('anon', 'public.change_log_id_seq', 'SELECT') or has_sequence_privilege('authenticated', 'public.change_log_id_seq', 'SELECT')
     or has_sequence_privilege('anon', 'public.change_log_id_seq', 'UPDATE') or has_sequence_privilege('authenticated', 'public.change_log_id_seq', 'UPDATE') then
    bad := bad || 'change_log_id_seq: maradt jog'::text;
  end if;
  -- függvények: 37, az anon 8-at, az authenticated 23-at hívhat (a seed_issue_seen_for_subscribers átsorolva)
  select count(*) filter (where has_function_privilege('authenticated', p.oid, 'execute')) into n
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.prokind = 'f';
  if n <> 23 or has_function_privilege('authenticated', 'public.seed_issue_seen_for_subscribers(uuid)', 'execute') then
    bad := bad || format('függvények: az authenticated %s-at hívhat (várt: 23)', n);
  end if;
  -- alapértelmezett jogok: a postgres public sémabeli tábla- és szekvencia-alapértelmezésében nincs anon / authenticated
  if exists (select 1 from pg_default_acl d join pg_namespace s on s.oid = d.defaclnamespace, aclexplode(d.defaclacl) a
              where s.nspname = 'public' and pg_get_userbyid(d.defaclrole) = 'postgres' and d.defaclobjtype in ('r', 'S')
                and pg_get_userbyid(a.grantee) in ('anon', 'authenticated')) then
    bad := bad || 'alapértelmezett jogok: maradt anon / authenticated a táblákra vagy a szekvenciákra'::text;
  end if;
  if cardinality(bad) > 0 then
    raise exception E'47. lépés: a jogok nem a vártak — megszakítva.\n%', array_to_string(bad, E'\n');
  end if;
  raise notice '47. lépés kész: az anon egyik táblán sem kap semmit; az authenticated csak a kliens által írt táblákat / oszlopokat írhatja.';
end $$;

notify pgrst, 'reload schema';
