-- ============================================================================
-- LAPRÓL LAPRA — SOROZATKEZELÉS ÚJRATERVEZÉS (1. lépés): member_series
-- Futtatás: Supabase SQL Editor. Idempotens: nyugodtan újrafuttatható.
--
-- Tartalom:
--   1) member_series tábla (a kiválasztás rétege — 2.3)
--   2) RLS: saját sor teljes hozzáférés; staff teljes SELECT (§6.4/1 döntés)
--   3) Oszlop-védő trigger: delete_count nem csökkenthető kliensről,
--      és az 5/5 törlési limit fölött nem lehet újra bepipálni (DB-szintű
--      védelem, ugyanaz a minta, mint a members-jogosultságnál — lásd
--      laprol-lapra-jogosultsag-1-members.sql "protect_members" függvénye)
--   4) Backfill: minden jelenlegi (felhasználó, sorozat) párra is_selected=true
--      sor — a mostani állapot ("mindenki mindenkit lát") befagyasztva indul,
--      hogy senkinek ne ürüljön ki a fülsávja a bevezetéskor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) member_series tábla
-- ---------------------------------------------------------------------------
create table if not exists public.member_series (
  user_id       uuid not null references auth.users(id) on delete cascade,
  series_id     uuid not null references public.series(id) on delete cascade,
  is_selected   boolean not null default true,
  selected_at   timestamptz not null default now(),
  deselected_at timestamptz,
  delete_count  int not null default 0 check (delete_count >= 0 and delete_count <= 5),
  primary key (user_id, series_id)
);
alter table public.member_series enable row level security;

-- ---------------------------------------------------------------------------
-- 2) RLS — saját sor: SELECT/INSERT/UPDATE, de SZÁNDÉKOSAN NINCS DELETE.
--    Enélkül a kliens sort tudna törölni és tiszta (delete_count=0) sort
--    visszainsertelni ugyanahhoz a sorozathoz — megkerülve az 5/5 limitet.
--    A leválasztás ezért mindig UPDATE (is_selected=false), sosem törlés.
--    staff: teljes SELECT is (kell az admin "Aktív sorozatok" nézet
--    aktív-felhasználó számlálójához — jóváhagyva).
-- ---------------------------------------------------------------------------
drop policy if exists "member_series read"   on public.member_series;
drop policy if exists "member_series write"  on public.member_series;
drop policy if exists "member_series insert" on public.member_series;
drop policy if exists "member_series update" on public.member_series;

create policy "member_series read" on public.member_series
  for select using (user_id = auth.uid() or public.is_staff());

create policy "member_series insert" on public.member_series
  for insert with check (user_id = auth.uid());

create policy "member_series update" on public.member_series
  for update using (user_id = auth.uid())
             with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3) Oszlop-védő trigger — a kliens nem csökkentheti a delete_count-ot,
--    és nem kapcsolhatja vissza is_selected=true-ra, ha delete_count már 5.
-- ---------------------------------------------------------------------------
create or replace function public.protect_member_series()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.delete_count < old.delete_count then
    raise exception 'A törlés-számláló nem csökkenthető.';
  end if;
  if new.is_selected and not old.is_selected and old.delete_count >= 5 then
    raise exception 'Ez a sorozat elérte az 5/5 törlési limitet — nem választható újra.';
  end if;
  return new;
end;
$$;

drop trigger if exists member_series_protect on public.member_series;
create trigger member_series_protect
  before update on public.member_series
  for each row execute function public.protect_member_series();

-- ---------------------------------------------------------------------------
-- 4) Backfill — a jelenlegi "mindenki mindent lát" állapot befagyasztása
-- ---------------------------------------------------------------------------
insert into public.member_series (user_id, series_id, is_selected)
select m.user_id, s.id, true
from public.members m
cross join public.series s
on conflict (user_id, series_id) do nothing;

-- Kész. Következő: a fülsáv innentől member_series.is_selected=true sorokból épül.
