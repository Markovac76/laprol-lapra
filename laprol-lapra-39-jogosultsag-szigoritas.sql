-- ============================================================================
-- 39. lépés — JOGOSULTSÁG-SZIGORÍTÁS a public séma függvényein (csak REVOKE).
--
-- JÓVÁHAGYÁSRA VÁR — a tulajdonos kifejezett jóváhagyása nélkül NEM futtatható. ÉLESBEN NEM FUTOTT.
-- Futtatás: node scripts/run-migration.js laprol-lapra-39-jogosultsag-szigoritas.sql 39-jogosultsag-szigoritas
-- (backup → egyetlen tranzakció, 3 mp-es lock_timeout → COMMIT, hiba esetén ROLLBACK).
--
-- Mit csinál: a függvények HÍVÁSI JOGÁT szűkíti. Függvényt nem módosít (mind a 37 definíció-hash
-- azonos marad), adatot nem ír, táblajogot és RLS-szabályt nem érint.
--
-- Kiinduló állapot: 36 függvényt a bejelentkezés nélküli hívó (anon) és a PUBLIC is meghívhat
-- (ACL: =X, anon=X, authenticated=X, service_role=X); a create_live_issue már le van zárva.
--
--   A) 15 függvény: a PUBLIC és az anon joga megszűnik, az authenticated MARAD
--      (a kliens hívja, vagy RLS-szabály / CHECK hívja a bejelentkezett felhasználó jogával).
--   B) 13 függvény: a PUBLIC, az anon ÉS az authenticated joga is megszűnik
--      (belső segéd: csak más függvény hívja; a SECURITY DEFINER függvények a tulajdonos jogával hívják).
--   C)  8 függvény: NEM VÁLTOZIK (is_staff, is_active, my_role — az RLS-szabályok a bejelentkezés
--      nélküli olvasásnál is hívják; és az 5 trigger-függvény).
--   A create_live_issue (már lezárva) szintén nem változik.
--   A service_role és a tulajdonos (postgres) joga mindenhol marad.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) PUBLIC és anon megvonva — az authenticated marad
-- ---------------------------------------------------------------------------
-- A kliens hívja (.rpc), csak staff; belül staff + aktív ellenőrzés van:
revoke execute on function public.start_edit_draft(uuid)                from public, anon;  -- Karbantartás, Gyors Excel
revoke execute on function public.apply_draft_upload(uuid, jsonb)       from public, anon;  -- oda-vissza sablon alkalmazása
revoke execute on function public.draft_lapszam_conflicts(uuid, jsonb)  from public, anon;  -- feltöltés-előnézet
revoke execute on function public.draft_ready_warnings(uuid)            from public, anon;  -- „Kész” előtti figyelmeztetések
revoke execute on function public.mark_draft_ready(uuid)                from public, anon;  -- „Kész”
revoke execute on function public.return_draft_to_edit(uuid)            from public, anon;  -- visszaadás szerkesztésre
revoke execute on function public.publish_draft_series(uuid)            from public, anon;  -- publikálás
-- A kliens hívja, csak a tulajdonos; belül tulajdonos-ellenőrzés van:
revoke execute on function public.start_force_delete(uuid)              from public, anon;
revoke execute on function public.finalize_delete_series(uuid, text)    from public, anon;
-- A kliens hívja, bármely bejelentkezett felhasználó (a saját adatára / saját javaslatára):
revoke execute on function public.propose_bulk_issues(uuid, jsonb)      from public, anon;  -- saját javaslat sablon-feltöltése
revoke execute on function public.seed_member_seen(uuid)                from public, anon;  -- sorozat beválasztása, „Mind elfogadom”
-- A kliens kódjában van hívása (js/changes.js) — a belső staff-ellenőrzés külön, későbbi döntés:
revoke execute on function public.seed_issue_seen_for_subscribers(uuid) from public, anon;
-- RLS-szabály hívja a bejelentkezett felhasználó jogával (image_proposals, storage.objects):
revoke execute on function public.can_propose_image(uuid)               from public, anon;
revoke execute on function public.can_propose_series_image(uuid)        from public, anon;
-- CHECK hívja a beszúró felhasználó jogával (series, draft_series — javaslat beküldése, sorozat mentése):
revoke execute on function public.series_azonositok_error(jsonb)        from public, anon;

-- ---------------------------------------------------------------------------
-- B) PUBLIC, anon és authenticated megvonva — belső segédek
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, belső ellenőrzés nélkül ÍR — ezért sürgős:
revoke execute on function public.log_field_change(text, uuid, text, text, text, integer) from public, anon, authenticated;  -- csak a publish_draft_series hívja
revoke execute on function public.next_series_no()                      from public, anon, authenticated;  -- csak a publish_draft_series hívja
revoke execute on function public.ensure_draft_main(uuid)               from public, anon, authenticated;  -- apply_draft_upload, mark_draft_ready hívja
-- SECURITY DEFINER, csak olvas / számol:
revoke execute on function public.pick_main_component(uuid)             from public, anon, authenticated;  -- create_live_issue, publish_draft_series
revoke execute on function public.pick_main_draft_component(uuid)       from public, anon, authenticated;  -- ensure_draft_main
revoke execute on function public.default_component_template(text[])    from public, anon, authenticated;  -- több SECURITY DEFINER függvény
revoke execute on function public.sync_template_with_components(jsonb, text[]) from public, anon, authenticated;  -- ma senki nem hívja
-- Nem SECURITY DEFINER, csak számol; kizárólag SECURITY DEFINER függvényből hívódik:
revoke execute on function public.component_template_error(jsonb)       from public, anon, authenticated;  -- mark_draft_ready, publish_draft_series
revoke execute on function public.draft_conflicts_text(jsonb)           from public, anon, authenticated;  -- apply_draft_upload, mark_draft_ready
revoke execute on function public.draft_type_field_issues(uuid)         from public, anon, authenticated;  -- draft_ready_warnings, mark_draft_ready
revoke execute on function public.template_main_type(jsonb)             from public, anon, authenticated;  -- pick_main_*, sync_template_with_components
revoke execute on function public.type_azonosito_tipus(text, jsonb)     from public, anon, authenticated;  -- apply_draft_upload, create_live_issue, propose_bulk_issues
-- CHECK-ben áll a component_type_defs táblán, de azt az app szerepköre nem írhatja (csak migráció):
revoke execute on function public.component_type_fields_error(jsonb)    from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Záró önellenőrzés: ha az eredmény nem pontosan a várt, az egész visszagörög.
-- ---------------------------------------------------------------------------
do $$
declare
  n_anon int; n_pub int; n_auth int; n_svc int; n_all int;
begin
  select count(*),
         count(*) filter (where has_function_privilege('anon', p.oid, 'execute')),
         count(*) filter (where exists (select 1 from aclexplode(p.proacl) a where a.grantee = 0)),
         count(*) filter (where has_function_privilege('authenticated', p.oid, 'execute')),
         count(*) filter (where has_function_privilege('service_role', p.oid, 'execute'))
    into n_all, n_anon, n_pub, n_auth, n_svc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f';
  if n_all <> 37 or n_anon <> 8 or n_pub <> 8 or n_auth <> 24 or n_svc <> 37 then
    raise exception '39. lépés: a jogok nem a vártak (függvény: %, anon: % [várt 8], PUBLIC: % [várt 8], authenticated: % [várt 24], service_role: % [várt 37]) — megszakítva.',
      n_all, n_anon, n_pub, n_auth, n_svc;
  end if;
  raise notice '39. lépés kész: 37 függvényből az anon / PUBLIC 8-at, az authenticated 24-et hívhat.';
end $$;

notify pgrst, 'reload schema';
