-- ============================================================================
-- LAPRÓL LAPRA — SÜRGŐS HIBAJAVÍTÁS: publikálás ütközik soft-delete-elt/
-- élő lapszámmal ("duplicate key value violates unique constraint
-- issues_series_id_lapszam_key").
--
-- 1) STRUKTURÁLIS JAVÍTÁS: az issues_series_id_lapszam_key eddig sima
--    UNIQUE(series_id, lapszam) volt — egy soft-deleted Szám lapszáma
--    örökre foglalt maradt volna, sosem lehetett volna újra felhasználni.
--    Részleges (partial) unique indexre váltva: csak a NEM törölt sorokra
--    vonatkozik.
--
-- 2) EGYSZERI ADATJAVÍTÁS: a "Volkswagen modellautógyűjtemény" sorozat
--    nyitott draftjában (id: 1ae58ecc-9a4f-4e24-aa58-a4c72f3f66a9) 20 db,
--    élő pár nélküli ("új") draft_issues sor van a #4-19, #27, #30, #59,
--    #61 lapszámokra — ezek valójában a hozzájuk tartozó ÉLŐ (de hibás
--    AI-adatú) Számok kijavított változatai, csak a "Szám törlése a
--    draftból" gomb (ami csak a draft-tételt törli, az élőt nem)
--    használata miatt elszakadtak az élő párjuktól. A draft publikálása
--    emiatt vadonatúj Számként próbálta beszúrni őket, ütközve a még
--    élő, régi sorral. Az alábbi UPDATE-ek lapszám (és típus) alapján
--    visszakötik ezeket az élő párjukhoz, hogy publikáláskor SZERKESZTÉS-
--    ként (frissítés), ne ütköző beszúrásként fussanak le — a draftban
--    már bevitt, kijavított adatok megmaradnak.
--
-- Futtatás: scripts/run-migration.js (backup + tranzakció).
-- ============================================================================

-- 1) Részleges unique index
alter table public.issues drop constraint issues_series_id_lapszam_key;
create unique index issues_series_id_lapszam_key
  on public.issues (series_id, lapszam)
  where not is_deleted;

-- 2) A Volkswagen-draft 20 "árva" (élő pár nélküli) tételének visszakötése
update draft_issues di set source_issue_id = i.id
from issues i
where di.draft_series_id = '1ae58ecc-9a4f-4e24-aa58-a4c72f3f66a9'
  and di.source_issue_id is null
  and i.series_id = '1e1a9bad-f25e-4bcf-8c74-b032d5bb3599'
  and i.lapszam = di.lapszam;

update draft_components dc set source_component_id = c.id
from draft_issues di, issues i, components c
where dc.draft_issue_id = di.id
  and di.draft_series_id = '1ae58ecc-9a4f-4e24-aa58-a4c72f3f66a9'
  and dc.source_component_id is null
  and di.source_issue_id = i.id
  and c.issue_id = i.id
  and c.tipus = dc.tipus;

-- Kész.
