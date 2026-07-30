-- ============================================================================
-- LAPRÓL LAPRA — SZEMÉLYES FIZETETT ÁR TELJESSÉGE (egyszeri, Supabase SQL Editor)
--
-- Cél: minden issues sorhoz (aminek van eredeti_ar-ja) legyen a tulajdonosnak
-- member_issue_data sora fizetett_ar értékkel. Ahol hiányzik a sor → beszúr,
-- ahol a sor megvan de fizetett_ar üres → kitölt. Minden esetben:
--     fizetett_ar = a hozzá tartozó issues.eredeti_ar
-- (Nincs sehol valódi, ettől eltérő fizetett ár rögzítve — ez biztonságosan pótlás.)
--
-- FUTTATÁSI SORREND: ELŐBB a "laprol-lapra-arjavitas.sql" (hogy a Repülők #5–60
-- eredeti_ar-ja már a helyes 5990 legyen), UTÁNA ez a fájl.
--
-- BIZTONSÁG:
--   - csak a tulajdonos sorai (user_id),
--   - meglévő, NEM üres fizetett_ar-t SOHA nem ír felül (csak hiányt/üreset pótol),
--   - eredeti_ar nélküli számokat (pl. Volkswagen, nincs ár) kihagyja,
--   - tranzakcióban, commit előtti ellenőrzéssel.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0) DRY-RUN — ELŐBB EZT. Csak OLVAS. Sorozatonként mutatja, mennyi sor jön létre
--    (nincs member_issue_data) és mennyi frissül (üres fizetett_ar).
-- ----------------------------------------------------------------------------
select 'beszúrandó (nincs sor)' as muvelet, s.megnevezes, count(*) as db
from public.issues i
  join public.series s on s.id = i.series_id
where i.eredeti_ar is not null
  and not exists (select 1 from public.member_issue_data m
                  where m.user_id = '25cb3724-02d4-4002-98b0-c93f74ef4e42' and m.issue_id = i.id)
group by s.megnevezes
union all
select 'frissítendő (üres fizetett_ar)', s.megnevezes, count(*)
from public.member_issue_data m
  join public.issues i on i.id = m.issue_id
  join public.series s on s.id = i.series_id
where m.user_id = '25cb3724-02d4-4002-98b0-c93f74ef4e42'
  and m.fizetett_ar is null and i.eredeti_ar is not null
group by s.megnevezes
order by 1, 2;

-- ----------------------------------------------------------------------------
-- 1) TELJESSÉG — csak a dry-run ellenőrzése UTÁN (begin;-től commit;-ig).
-- ----------------------------------------------------------------------------
begin;

-- (a) Hiányzó sorok beszúrása (fizetett_ar = eredeti_ar, mennyiség = 1)
insert into public.member_issue_data (user_id, issue_id, fizetett_ar, beszerzesi_mennyiseg)
select '25cb3724-02d4-4002-98b0-c93f74ef4e42', i.id, i.eredeti_ar, 1
from public.issues i
where i.eredeti_ar is not null
  and not exists (select 1 from public.member_issue_data m
                  where m.user_id = '25cb3724-02d4-4002-98b0-c93f74ef4e42' and m.issue_id = i.id);

-- (b) Meglévő sorok üres fizetett_ar-jának kitöltése (a nem-üreseket NEM bántjuk)
update public.member_issue_data m
set fizetett_ar = i.eredeti_ar
from public.issues i
where m.issue_id = i.id
  and m.user_id = '25cb3724-02d4-4002-98b0-c93f74ef4e42'
  and m.fizetett_ar is null and i.eredeti_ar is not null;

-- Ellenőrzés commit előtt: maradt-e olyan (eredeti_ar-ral bíró) szám, aminek
-- nincs fizetett_ar-ja a tulajdonosnál. 0 → commit; különben rollback.
select count(*) as maradt_hianyzo
from public.issues i
where i.eredeti_ar is not null
  and not exists (select 1 from public.member_issue_data m
                  where m.user_id = '25cb3724-02d4-4002-98b0-c93f74ef4e42'
                    and m.issue_id = i.id and m.fizetett_ar is not null);

commit;
