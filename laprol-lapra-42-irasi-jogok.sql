-- ============================================================================
-- 42. lépés — (C3) AZ ÉLŐ TÖRZSADAT-TÁBLÁK KÖZVETLEN ÍRÁSI JOGÁNAK SZŰKÍTÉSE (csak REVOKE / GRANT).
--
-- JÓVÁHAGYÁSRA VÁR — a tulajdonos kifejezett jóváhagyása nélkül NEM futtatható. ÉLESBEN NEM FUTOTT.
-- Futtatás: node scripts/run-migration.js laprol-lapra-42-irasi-jogok.sql 42-irasi-jogok
-- (backup → egyetlen tranzakció, 3 mp-es lock_timeout → COMMIT, hiba esetén ROLLBACK).
--
-- Mit csinál: hat táblán szűkíti az anon és az authenticated szerepkör TÁBLAJOGAIT. Függvényt, RLS-szabályt
-- (policy), adatot nem módosít. A SELECT mindenhol marad. A service_role és a tulajdonos (postgres) joga
-- nem változik — a SECURITY DEFINER függvények (create_live_issue, publish_draft_series, …) a tulajdonos
-- jogával írnak, ezért nem érinti őket.
--
-- Kiinduló állapot mind a hat táblán: anon = authenticated = minden jog (arwdDxtm: INSERT, SELECT, UPDATE, DELETE,
-- TRUNCATE, REFERENCES, TRIGGER, MAINTAIN); külön oszlopjog nincs. A MAINTAIN (karbantartás: pl. VACUUM, tábla zárolása)
-- és a TRUNCATE jogot a sorszintű szabályok nem fogják — ezek is megszűnnek.
-- Eddig kizárólag a sorszintű szabály (staff + aktív) védett: aki staff, az bármelyik oszlopba bármit írhatott,
-- Számot és komponenst szúrhatott be és törölhetett a függvények megkerülésével (régi böngészőfül, közvetlen hívás).
--
-- Végállapot (authenticated; az RLS-szabály — staff + aktív — ezekre továbbra is érvényes):
--   components : csak a kep_url és az upload_enabled oszlop módosítható
--   series     : csak a borito_url, a borito_upload_enabled és a lifecycle oszlop módosítható
--   lists      : beszúrás, és a megjelenites oszlop módosítása
--   issues, change_log, global_counters : semmi
-- Az anon sehol nem ír.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- issues — a kliens sehol nem írja közvetlenül: az új Számot a create_live_issue, minden mást a
-- publish_draft_series ír. (A régi, a 35. lépés előtti kód közvetlenül szúrt be ide — ez zárul le.)
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger, maintain on table public.issues from anon, authenticated;

-- ---------------------------------------------------------------------------
-- components — beszúrás és törlés csak függvényen át. A kliens két oszlopot ír közvetlenül (staff):
-- kep_url (kép feltöltése / törlése / képjavaslat elfogadása) és upload_enabled (feltöltés engedélyezése).
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger, maintain on table public.components from anon, authenticated;
grant update (kep_url, upload_enabled) on table public.components to authenticated;

-- ---------------------------------------------------------------------------
-- series — beszúrás csak publikálással, törlés csak a tulajdonosi függvényekkel. A kliens három oszlopot ír
-- közvetlenül (staff): borito_url, borito_upload_enabled (borítókép) és lifecycle (publikálatlanná / újra aktívvá).
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger, maintain on table public.series from anon, authenticated;
grant update (borito_url, borito_upload_enabled, lifecycle) on table public.series to authenticated;

-- ---------------------------------------------------------------------------
-- lists — a ☰ Listák ablak (staff) beszúr és átnevez (csak a megjelenites oszlopot írja). Törlés gomb nincs;
-- a törlés később függvényen át jön, a használatban lévő érték védelmével.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger, maintain on table public.lists from anon;
revoke update, delete, truncate, references, trigger, maintain on table public.lists from authenticated;
grant update (megjelenites) on table public.lists to authenticated;

-- ---------------------------------------------------------------------------
-- change_log — a változásnaplót kizárólag a log_field_change függvény írja (és a finalize_delete_series törli).
-- A kliens csak olvassa.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger, maintain on table public.change_log from anon, authenticated;

-- ---------------------------------------------------------------------------
-- global_counters — a sorozat-sorszámlálót kizárólag a next_series_no függvény írja. RLS-szabály nincs rajta,
-- így a kliens eddig sem érte el; a jog fölösleges.
-- ---------------------------------------------------------------------------
revoke insert, update, delete, truncate, references, trigger, maintain on table public.global_counters from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Záró önellenőrzés: ha a jogok nem pontosan a vártak, az egész visszagörög.
-- ---------------------------------------------------------------------------
do $$
declare
  t    text;
  r    text;
  p    text;
  bad  text[] := '{}';
  varh text;
  van  text;
begin
  foreach t in array array['series', 'issues', 'components', 'lists', 'change_log', 'global_counters'] loop
    -- a SELECT mindenkinek megmarad; a service_role mindent megtart
    foreach r in array array['anon', 'authenticated', 'service_role'] loop
      if not has_table_privilege(r, 'public.' || t, 'SELECT') then bad := bad || format('%s / %s: nincs SELECT', t, r); end if;
    end loop;
    foreach p in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'] loop
      if not has_table_privilege('service_role', 'public.' || t, p) then bad := bad || format('%s / service_role: nincs %s', t, p); end if;
      -- az anon sehol nem ír
      if has_table_privilege('anon', 'public.' || t, p) then bad := bad || format('%s / anon: van %s', t, p); end if;
      -- az authenticated táblaszinten csak a lists táblába szúrhat be
      if has_table_privilege('authenticated', 'public.' || t, p) <> (t = 'lists' and p = 'INSERT') then
        bad := bad || format('%s / authenticated: a(z) %s táblajog nem a várt', t, p);
      end if;
    end loop;
    -- az anon egyetlen oszlopot sem módosíthat / szúrhat be
    if exists (select 1 from pg_attribute a where a.attrelid = ('public.' || t)::regclass and a.attnum > 0 and not a.attisdropped
                  and (has_column_privilege('anon', a.attrelid, a.attnum, 'UPDATE') or has_column_privilege('anon', a.attrelid, a.attnum, 'INSERT'))) then
      bad := bad || format('%s / anon: van oszlopszintű írási jog', t);
    end if;
    -- az authenticated pontosan a várt oszlopokat módosíthatja
    varh := case t when 'components' then 'kep_url,upload_enabled'
                   when 'series'     then 'borito_upload_enabled,borito_url,lifecycle'
                   when 'lists'      then 'megjelenites'
                   else '' end;
    select coalesce(string_agg(a.attname, ',' order by a.attname), '') into van
      from pg_attribute a
     where a.attrelid = ('public.' || t)::regclass and a.attnum > 0 and not a.attisdropped
       and has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE');
    if van <> varh then bad := bad || format('%s / authenticated: módosítható oszlopok: [%s], várt: [%s]', t, van, varh); end if;
  end loop;
  if cardinality(bad) > 0 then
    raise exception E'42. lépés: a jogok nem a vártak — megszakítva.\n%', array_to_string(bad, E'\n');
  end if;
  raise notice '42. lépés kész: a hat táblán az anon nem ír; az authenticated csak a megengedett oszlopokat (components 2, series 3, lists 1 + beszúrás).';
end $$;

notify pgrst, 'reload schema';
