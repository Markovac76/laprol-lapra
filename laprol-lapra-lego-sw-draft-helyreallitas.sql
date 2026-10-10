-- ============================================================================
-- LAPRÓL LAPRA — Lego Star Wars Magazin beragadt szerkesztési draftjának
-- egyszeri helyreállítása (feltöltés-átalakítási kör, 8. pont).
-- Futtatás: scripts/run-migration.js (backup + BEGIN/COMMIT). EGYSZERI adat-javítás.
--
-- Háttér: az élő #5 ("2026. 5.szám") és #6 ("2026. 6.szám") draft-sorát a
-- "Szám törlése a draftból" gomb fizikailag eltávolította, a sablonból pedig
-- 42 ÚJ draft-tétel jött létre — köztük a "2026. 5.szám" (draft #39) és a
-- "2026. 6.szám" (draft #40) más lapszámmal. A lapszám ennél a sorozatnál
-- folyamatos sorszám, NEM a nyomtatott szám, ezért a párosítás NÉV alapján
-- történik (tulajdonos által jóváhagyva), SOSEM lapszám alapján.
--
-- Mit csinál (csak a draftot módosítja, az ÉLŐ adathoz nem nyúl):
--  1) a draft #39 / #40 tételt visszaköti az élő #5 / #6-hoz (source_issue_id),
--  2) a komponenseiket is (source_component_id), hogy ne duplázódjanak, és a
--     képek / személyes "megvan" jelölések az élő komponenseken megmaradjanak,
--  3) a draft komponensek ÜRES azonosítóját és azonosító-típusát kitölti az
--     élő értékekből (különben a publikálás NULL-ra írná át őket),
--  4) az élő #6 "Mandalorian Pilot" komponensét (a draftban nincs meg) felveszi
--     a draftba, az élő komponenshez kötve.
-- A draft "2022. 4.szám" / "2022. 5.szám" (jelenleg #5/#6) ÚJ tétel marad.
--
-- Minden lépés pontos azonosító + név egyezést ellenőriz és sorszámot számol;
-- eltérésnél az egész tranzakció visszagördül, semmi nem íródik.
-- ============================================================================

do $$
declare
  D   constant uuid := '8033ddcd-2d64-4be1-a331-da2b854aa853';  -- draft_series
  n   int;
begin
  -- 0) Előfeltétel: a draft vissza van adva szerkesztésre (10. pont gombja).
  if (select pool_status from public.draft_series where id = D) is distinct from 'claimed' then
    raise exception 'A draft nincs "Munkaanyag" állapotban — előbb a Karbantartásban "Visszaadás szerkesztésre".';
  end if;

  -- 1) Szám-szintű visszakötés (id + név + jelenleg kötetlen)
  update public.draft_issues set source_issue_id = '21f2c5bb-548d-494b-8d83-03794f5e3a1d'
   where id = '99f13df2-abd5-49bb-8837-983914b8d427' and draft_series_id = D
     and cim = '2026. 5.szám' and lapszam = 39 and source_issue_id is null and not deleted
     and exists (select 1 from public.issues where id='21f2c5bb-548d-494b-8d83-03794f5e3a1d' and cim='2026. 5.szám' and not is_deleted);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A #39 tétel visszakötése nem egyezett (% sor).', n; end if;

  update public.draft_issues set source_issue_id = '3060d600-cc2d-43e5-a356-4bdc1b3f39ce'
   where id = '5c26603d-ea63-4927-b586-9fa8306cf0aa' and draft_series_id = D
     and cim = '2026. 6.szám' and lapszam = 40 and source_issue_id is null and not deleted
     and exists (select 1 from public.issues where id='3060d600-cc2d-43e5-a356-4bdc1b3f39ce' and cim='2026. 6.szám' and not is_deleted);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A #40 tétel visszakötése nem egyezett (% sor).', n; end if;

  -- 2)+3) Komponens-visszakötés: draft-komponens (id, típus, megnevezés) ↔ élő komponens;
  --       az üres azonosító/azonosító-típus az élő értékből töltődik (csak a NULL mezők).
  update public.draft_components dc set
      source_component_id = lc.id,
      azonosito           = coalesce(dc.azonosito, lc.azonosito),
      azonosito_tipus     = coalesce(dc.azonosito_tipus, lc.azonosito_tipus)
    from public.components lc
   where dc.id = '57196cb5-7588-49ed-a869-bb0d7985ec89' and dc.draft_issue_id = '99f13df2-abd5-49bb-8837-983914b8d427'
     and dc.tipus = 'lego' and dc.megnevezes = 'Galactic Marine' and dc.source_component_id is null
     and lc.id = 'b75c7122-e471-484e-a152-cef0de60841e' and lc.issue_id = '21f2c5bb-548d-494b-8d83-03794f5e3a1d'
     and lc.tipus = 'lego' and lc.megnevezes = 'Galactic Marine';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Galactic Marine komponens nem egyezett (% sor).', n; end if;

  update public.draft_components dc set
      source_component_id = lc.id,
      azonosito           = coalesce(dc.azonosito, lc.azonosito),
      azonosito_tipus     = coalesce(dc.azonosito_tipus, lc.azonosito_tipus)
    from public.components lc
   where dc.id = 'e89bf0e3-1962-49af-9799-70abccaa55b2' and dc.draft_issue_id = '99f13df2-abd5-49bb-8837-983914b8d427'
     and dc.tipus = 'magazin' and dc.source_component_id is null
     and lc.id = '36f99768-20ef-4710-97b0-9df1001900d9' and lc.issue_id = '21f2c5bb-548d-494b-8d83-03794f5e3a1d'
     and lc.tipus = 'magazin';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A #39 magazin komponens nem egyezett (% sor).', n; end if;

  update public.draft_components dc set
      source_component_id = lc.id,
      azonosito           = coalesce(dc.azonosito, lc.azonosito),
      azonosito_tipus     = coalesce(dc.azonosito_tipus, lc.azonosito_tipus)
    from public.components lc
   where dc.id = 'c969aec4-2961-4f9c-b29d-b374fdb3ddfb' and dc.draft_issue_id = '5c26603d-ea63-4927-b586-9fa8306cf0aa'
     and dc.tipus = 'lego' and dc.megnevezes = 'Death Trooper' and dc.source_component_id is null
     and lc.id = '215e4524-a820-4388-82a0-36f9306d9258' and lc.issue_id = '3060d600-cc2d-43e5-a356-4bdc1b3f39ce'
     and lc.tipus = 'lego' and lc.megnevezes = 'Death Trooper';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'Death Trooper komponens nem egyezett (% sor).', n; end if;

  update public.draft_components dc set
      source_component_id = lc.id,
      azonosito           = coalesce(dc.azonosito, lc.azonosito),
      azonosito_tipus     = coalesce(dc.azonosito_tipus, lc.azonosito_tipus)
    from public.components lc
   where dc.id = 'abb0eef7-e6ac-4d2e-8533-bf3d05224e4b' and dc.draft_issue_id = '5c26603d-ea63-4927-b586-9fa8306cf0aa'
     and dc.tipus = 'magazin' and dc.source_component_id is null
     and lc.id = 'a58c2033-fbca-4885-810d-cad791679907' and lc.issue_id = '3060d600-cc2d-43e5-a356-4bdc1b3f39ce'
     and lc.tipus = 'magazin';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A #40 magazin komponens nem egyezett (% sor).', n; end if;

  -- 4) A draftban hiányzó élő komponens (Mandalorian Pilot) felvétele, az élőhöz kötve.
  insert into public.draft_components (draft_issue_id, source_component_id, tipus, azonosito_tipus, azonosito, megnevezes)
  select '5c26603d-ea63-4927-b586-9fa8306cf0aa', lc.id, lc.tipus, lc.azonosito_tipus, lc.azonosito, lc.megnevezes
    from public.components lc
   where lc.id = 'f968ff15-b062-475b-8e98-936c8dc9dd70' and lc.issue_id = '3060d600-cc2d-43e5-a356-4bdc1b3f39ce'
     and lc.tipus = 'lego' and lc.megnevezes = 'Mandalorian Pilot'
     and not exists (select 1 from public.draft_components x where x.source_component_id = lc.id);
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A Mandalorian Pilot felvétele nem sikerült (% sor).', n; end if;
end $$;

-- Kész. A publikálást NEM ez a script végzi — a tulajdonos élesben, a Karbantartásból.
