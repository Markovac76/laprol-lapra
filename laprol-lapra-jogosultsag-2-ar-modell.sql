-- ============================================================================
-- LAPRÓL LAPRA — ÁR-FOGALMAK ÚJRARENDEZÉSE (2/2)
-- Futtatás: Supabase SQL Editor, a "-1-members.sql" UTÁN. Idempotens.
--
-- Cél:
--   - "fedélár" -> "Eredeti ár": TÖRZSADAT marad az issues-on (átnevezés
--     fedelar -> eredeti_ar), csak staff (admin/owner) szerkeszti.
--   - A SZEMÉLYES ár-adatok (fizetett ár, beszerzési mennyiség, dátum, forrás)
--     átkerülnek egy szám-szintű személyes táblába: member_issue_data
--     (mindenki a sajátját rögzíti — a member_status mintájára).
--   - A tulajdonos meglévő személyes adatai átmigrálódnak az új táblába.
--
-- A régi issues oszlopokat (beszerzesi_ar, beszerzes_datuma, forras, mennyiseg)
-- MEGHAGYJUK holt oszlopként (visszafordítható); az app többé nem használja őket.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) fedelar -> eredeti_ar átnevezés (idempotens: csak ha még 'fedelar')
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'issues' and column_name = 'fedelar'
  ) then
    alter table public.issues rename column fedelar to eredeti_ar;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) Személyes, SZÁM-szintű adat tábla (egy sor = egy felhasználó egy számhoz)
--    RLS a member_status mintájára: mindenki csak a sajátját (upsert).
-- ---------------------------------------------------------------------------
create table if not exists public.member_issue_data (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id)      on delete cascade,
  issue_id             uuid not null references public.issues(id)   on delete cascade,
  fizetett_ar          int,
  beszerzesi_mennyiseg int not null default 1,
  beszerzes_datuma     date,
  forras               text,
  updated_at           timestamptz not null default now(),
  unique (user_id, issue_id)
);
alter table public.member_issue_data enable row level security;

drop policy if exists "own issue data" on public.member_issue_data;
create policy "own issue data" on public.member_issue_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3) Migráció: a tulajdonos meglévő személyes ár-adatai issues -> member_issue_data.
--    Csak az ÉRDEMI sorokat visszük át (ahol van tényleges személyes adat),
--    a puszta alapértelmezést (mennyiseg=1, minden más üres) nem — azt az app
--    hiányzó sor esetén úgyis 1-es mennyiséggel értelmezi.
-- ---------------------------------------------------------------------------
insert into public.member_issue_data
  (user_id, issue_id, fizetett_ar, beszerzesi_mennyiseg, beszerzes_datuma, forras)
select
  '25cb3724-02d4-4002-98b0-c93f74ef4e42',
  id,
  beszerzesi_ar,
  coalesce(mennyiseg, 1),
  beszerzes_datuma,
  forras
from public.issues
where beszerzesi_ar   is not null
   or beszerzes_datuma is not null
   or forras          is not null
   or (mennyiseg is not null and mennyiseg <> 1)
on conflict (user_id, issue_id) do nothing;

-- Kész. A jogosultsági + ár-migráció ezzel lefutott.
-- Ellenőrzés (opcionális):
--   select role, status, count(*) from public.members group by 1,2;
--   select count(*) from public.member_issue_data;
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='issues' order by 1;
