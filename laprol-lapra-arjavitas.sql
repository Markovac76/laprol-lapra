-- ============================================================================
-- LAPRÓL LAPRA — ÁR-KORRUPCIÓ JAVÍTÁSA (egyszeri, futtatható a Supabase SQL Editorban)
--
-- Háttér: a régi (időközben javított) ezres-tagolási beolvasó a "II VH Repülők"
-- #5–#60 számoknál az 5990 Ft-ot "5"-re rontotta. Ez érinti:
--   - issues.eredeti_ar (közös törzsadat)
--   - member_issue_data.fizetett_ar (a tulajdonos személyes ára; a migráció a
--     szintén hibás beszerzesi_ar-ból hozta)
-- A helyes ár két egyező forrásból (újság megjelenések.xlsx + laprol-lapra-
-- adatbetoltes.sql) mind a 56 számnál egyöntetűen 5990 Ft.
--
-- BIZTONSÁG:
--   - csak a "II VH Repülők" sorozat,
--   - csak a korrupt sorok (ar < 100; a DB legolcsóbb valódi ára 490 Ft, tehát
--     a <100 kizárólag a korrupt "5"-öket fogja meg — legitim árat nem ír felül),
--   - a fizetett_ar frissítés csak a tulajdonos sorára,
--   - tranzakcióban, commit előtti ellenőrzéssel.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) DRY-RUN — ELŐBB EZT futtasd külön. Csak OLVAS, semmit nem ír.
--    Ellenőrizd, hogy pontosan a Repülők #5–60 sorok jönnek-e (jelenlegi 5 → 5990).
-- ----------------------------------------------------------------------------
select 'issues' as tabla, i.lapszam, i.eredeti_ar as jelenlegi, 5990 as helyes
from public.issues i
  join public.series s on s.id = i.series_id
where s.megnevezes = 'II VH Repülők' and i.eredeti_ar < 100
union all
select 'member_issue_data', i.lapszam, m.fizetett_ar, 5990
from public.member_issue_data m
  join public.issues i on i.id = m.issue_id
  join public.series s on s.id = i.series_id
where s.megnevezes = 'II VH Repülők'
  and m.user_id = '25cb3724-02d4-4002-98b0-c93f74ef4e42'
  and m.fizetett_ar < 100
order by 1, 2;

-- ----------------------------------------------------------------------------
-- 1) JAVÍTÁS — csak a DRY-RUN ellenőrzése UTÁN futtasd (a begin;-től a commit;-ig).
-- ----------------------------------------------------------------------------
begin;

-- Közös törzsadat: eredeti_ar
update public.issues i
set eredeti_ar = 5990
from public.series s
where s.id = i.series_id
  and s.megnevezes = 'II VH Repülők'
  and i.eredeti_ar < 100;                     -- csak a korrupt #5–60

-- Személyes ár: a tulajdonos fizetett_ar-ja
update public.member_issue_data m
set fizetett_ar = 5990
from public.issues i
  join public.series s on s.id = i.series_id
where m.issue_id = i.id
  and s.megnevezes = 'II VH Repülők'
  and m.user_id = '25cb3724-02d4-4002-98b0-c93f74ef4e42'
  and m.fizetett_ar < 100;

-- Ellenőrzés commit előtt: maradt-e korrupt (<100) ár a sorozatban.
-- Ha a lenti szám 0, minden rendben → commit. Ha nem, akkor: rollback;
select count(*) as maradt_korrupt_ar
from public.issues i
  join public.series s on s.id = i.series_id
where s.megnevezes = 'II VH Repülők' and i.eredeti_ar < 100;

commit;

-- ----------------------------------------------------------------------------
-- (Megjegyzés) A issues holt "beszerzesi_ar" oszlopa — amit az app már nem
-- olvas — a #5–60-nál szintén "5" maradt. Szándékosan nem nyúlunk hozzá,
-- mert nincs hatása. Ha a rend kedvéért mégis akarod, ez a sor megteszi:
--   update public.issues i set beszerzesi_ar = 5990
--   from public.series s
--   where s.id = i.series_id and s.megnevezes = 'II VH Repülők'
--     and i.beszerzesi_ar is not null and i.beszerzesi_ar < 100;
-- ----------------------------------------------------------------------------
