-- ============================================================================
-- LAPRÓL LAPRA — SOROZATKEZELÉS ÚJRATERVEZÉS (2. lépés): életciklus + pool
-- Futtatás: Supabase SQL Editor. Idempotens: nyugodtan újrafuttatható.
--
-- Tartalom:
--   1) series.lifecycle + series.created_at (Aktív / Publikálatlan megkülönböztetéshez)
--   2) draft_series tábla (a pool — csak SOROZAT-szintű mezők ebben a lépésben;
--      szám/komponens-szintű draft-szerkesztés a 3. lépésben, a diff-géppel együtt)
--   3) RLS: bárki (aktív fiók) javasolhat "új javaslat"-ot; staff kezeli a poolt
--   4) 20-as limit trigger (Beérkezett+Munkaanyag/foglalva együtt, globális)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) series — életciklus-mező + létrehozás dátuma
-- ---------------------------------------------------------------------------
alter table public.series add column if not exists lifecycle text not null default 'active'
  check (lifecycle in ('active','unpublished'));
alter table public.series add column if not exists created_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 2) draft_series — a munka-pool
--    pool_type:   'new'  = új sorozat-javaslat · 'edit' = élő sorozat szerkesztése
--    pool_status: 'incoming' (Beérkezett) · 'claimed' (Munkaanyag/foglalva) ·
--                 'ready' (Publikálásra váró — kikerül a 20-as limitből)
-- ---------------------------------------------------------------------------
create table if not exists public.draft_series (
  id               uuid primary key default gen_random_uuid(),
  pool_type        text not null check (pool_type in ('new','edit')),
  pool_status      text not null default 'incoming' check (pool_status in ('incoming','claimed','ready')),
  source_series_id uuid references public.series(id) on delete set null,
  submitted_by     uuid not null references auth.users(id),
  claimed_by       uuid references auth.users(id),
  claimed_at       timestamptz,
  ready_at         timestamptz,
  created_at       timestamptz not null default now(),
  -- sorozat-szintű mezők (a series tábla megfelelőivel egyezően)
  kiado            text,
  megnevezes       text not null,
  megjelenites     text,
  szin             text,
  components       text[] not null default '{}'
);
alter table public.draft_series enable row level security;

-- ---------------------------------------------------------------------------
-- 3) RLS
--    - SELECT: staff (a Karbantartás felület csak nekik való)
--    - INSERT: bárki aktív fiók javasolhat 'new'-t (Beérkezett, jelöletlen);
--              staff indíthat 'edit'-et is, de az AZONNAL saját magánál
--              claim-elve jön létre (nincs "lock nélküli szerkesztés-javaslat")
--    - UPDATE: staff (a finomabb "csak a claim-elő szerkesztheti" szabályt
--              egyelőre az alkalmazás UI kényszeríti ki, nem a DB — a staff
--              kör kicsi és megbízható, ugyanaz a bizalmi modell, mint a
--              törzsadat write-policy-knál)
--    - DELETE: a beküldő a SAJÁT, még lock nélküli javaslatát törölheti;
--              staff bármit törölhet (moderálás / a publikálás lépés is ezt
--              használja a kész draft eltávolítására, miután beépült)
-- ---------------------------------------------------------------------------
drop policy if exists "draft_series read"   on public.draft_series;
drop policy if exists "draft_series insert" on public.draft_series;
drop policy if exists "draft_series update" on public.draft_series;
drop policy if exists "draft_series delete" on public.draft_series;

create policy "draft_series read" on public.draft_series
  for select using (public.is_staff());

create policy "draft_series insert" on public.draft_series
  for insert with check (
    submitted_by = auth.uid() and public.is_active()
    and (
      (pool_type = 'new'  and pool_status = 'incoming' and claimed_by is null)
      or
      (pool_type = 'edit' and pool_status = 'claimed' and claimed_by = auth.uid()
       and public.is_staff() and source_series_id is not null)
    )
  );

create policy "draft_series update" on public.draft_series
  for update using (public.is_staff() and public.is_active())
             with check (public.is_staff() and public.is_active());

create policy "draft_series delete" on public.draft_series
  for delete using (
    (submitted_by = auth.uid() and pool_status = 'incoming' and claimed_by is null)
    or (public.is_staff() and public.is_active())
  );

-- ---------------------------------------------------------------------------
-- 4) 20-as limit — Beérkezett + Munkaanyag/foglalva EGYÜTT max. 20, globálisan.
--    A "Publikálásra váró" (ready) már nem számít bele, ezért elég ÚJ sor
--    beszúrásakor ellenőrizni (állapotváltás nem növeli az (incoming+claimed)
--    darabszámot, csak a beszúrás).
-- ---------------------------------------------------------------------------
create or replace function public.check_pool_limit()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  cnt int;
begin
  select count(*) into cnt from public.draft_series where pool_status in ('incoming','claimed');
  if cnt >= 20 then
    raise exception 'A munka-pool megtelt (max. 20 tétel Beérkezett+Munkaanyag állapotban egyszerre). Előbb zárj le vagy engedj el valamit.';
  end if;
  return new;
end;
$$;

drop trigger if exists draft_series_limit on public.draft_series;
create trigger draft_series_limit
  before insert on public.draft_series
  for each row execute function public.check_pool_limit();

-- Kész. Következő (3. lépés): draft_issues/draft_components + verziókövetés +
-- felkiáltójel-mechanizmus — ekkor a "Publikálás" is bővül diff/change_log-gal.
