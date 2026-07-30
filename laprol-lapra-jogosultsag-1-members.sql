-- ============================================================================
-- LAPRÓL LAPRA — HÁROMSZINTŰ JOGOSULTSÁG (1/2)
-- Futtatás: Supabase SQL Editor. ELŐBB ez a fájl, UTÁNA a "-2-ar-modell.sql".
-- Idempotens: nyugodtan újrafuttatható.
--
-- Tartalom:
--   1) members tábla (user / admin / owner + active / disabled)
--   2) Automatikus member-sor regisztrációkor (trigger auth.users-en)
--   3) Meglévő felhasználók visszatöltése + tulajdonos owner-ré tétele (seed)
--   4) SECURITY DEFINER segédfüggvények (my_role / is_staff / is_active)
--      — ezek kerülik meg az RLS-rekurziót a members-re hivatkozó policy-knél
--   5) members RLS (olvasás: saját sor vagy staff; írás: owner/admin szabályok)
--   6) members oszlop-védő trigger (owner immutable, role csak owner, stb.)
--   7) series / issues / components / lists ÍRÁS-policy átállítása staff-alapúra
-- ============================================================================

-- Tulajdonos UID (lásd allapot-osszefoglalo.md). Ha nem a te fiókod, cseréld!
-- Tulajdonos: 25cb3724-02d4-4002-98b0-c93f74ef4e42

-- ---------------------------------------------------------------------------
-- 1) members tábla
-- ---------------------------------------------------------------------------
create table if not exists public.members (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'user'  check (role   in ('user','admin','owner')),
  status       text not null default 'active' check (status in ('active','disabled')),
  display_name text,
  created_at   timestamptz not null default now()
);
alter table public.members enable row level security;

-- ---------------------------------------------------------------------------
-- 4) Segédfüggvények (SECURITY DEFINER — az RLS-t megkerülve olvassák a members-t,
--    így a members-re hivatkozó policy-k nem okoznak végtelen rekurziót)
-- ---------------------------------------------------------------------------
create or replace function public.my_role()
  returns text language sql stable security definer set search_path = public as $$
  select role from public.members where user_id = auth.uid()
$$;

create or replace function public.is_staff()
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role in ('admin','owner') from public.members where user_id = auth.uid()),
    false)
$$;

create or replace function public.is_active()
  returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select status = 'active' from public.members where user_id = auth.uid()),
    false)
$$;

grant execute on function public.my_role()  to authenticated, anon;
grant execute on function public.is_staff() to authenticated, anon;
grant execute on function public.is_active() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- 2) Automatikus member-sor minden új regisztrációnál
--    (role='user', status='active'; a jóváhagyás NEM itt, hanem az új-sorozat
--     igénylésnél lesz — az egy későbbi lépés)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (user_id, role, status)
  values (new.id, 'user', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3) Visszatöltés: minden MÁR létező felhasználó kapjon member-sort,
--    majd a tulajdonos legyen owner/active.
-- ---------------------------------------------------------------------------
insert into public.members (user_id, role, status)
select id, 'user', 'active' from auth.users
on conflict (user_id) do nothing;

insert into public.members (user_id, role, status)
values ('25cb3724-02d4-4002-98b0-c93f74ef4e42', 'owner', 'active')
on conflict (user_id) do update set role = 'owner', status = 'active';

-- ---------------------------------------------------------------------------
-- 5) members RLS
--    - olvasás: a SAJÁT sor, vagy staff (admin/owner) az összeset (kell a
--      felhasználó-kezelő listához)
--    - írás (update): owner bármely sort; admin csak 'user' sort. A finom
--      oszlop-szintű szabályokat a 6) trigger tartatja be.
--    - insert nincs engedélyezve kliensről (a regisztrációs trigger intézi)
-- ---------------------------------------------------------------------------
drop policy if exists "members read"   on public.members;
drop policy if exists "members update" on public.members;

create policy "members read" on public.members
  for select using (user_id = auth.uid() or public.is_staff());

create policy "members update" on public.members
  for update
  using      (public.my_role() = 'owner' or (public.my_role() = 'admin' and role = 'user'))
  with check (public.my_role() = 'owner' or (public.my_role() = 'admin' and role = 'user'));

-- ---------------------------------------------------------------------------
-- 6) Oszlop-védő trigger a members UPDATE-re
--    - a tulajdonos sora TELJESEN zárolva (role/status sem változhat, senkitől)
--    - a saját role-t senki nem írhatja
--    - role-t csak owner módosíthat
--    - admin csak 'user' sort érinthet, és role-t nem válthat (csak status)
-- ---------------------------------------------------------------------------
create or replace function public.protect_members()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  caller_role text := public.my_role();
begin
  -- Tulajdonos sora sérthetetlen
  if old.role = 'owner'
     and (new.role is distinct from old.role or new.status is distinct from old.status) then
    raise exception 'A tulajdonos sora nem módosítható.';
  end if;

  -- Saját szerepkör nem módosítható
  if new.user_id = auth.uid() and new.role is distinct from old.role then
    raise exception 'A saját szerepköröd nem módosítható.';
  end if;

  -- Szerepkört csak a tulajdonos oszthat/vonhat vissza
  if new.role is distinct from old.role and caller_role <> 'owner' then
    raise exception 'Szerepkört csak a tulajdonos módosíthat.';
  end if;

  -- Admin csak sima felhasználó sorát, és csak a status mezőt
  if caller_role = 'admin' then
    if old.role <> 'user' then
      raise exception 'Admin csak sima felhasználó sorát módosíthatja.';
    end if;
    if new.role is distinct from old.role then
      raise exception 'Admin nem módosíthat szerepkört.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists members_protect on public.members;
create trigger members_protect
  before update on public.members
  for each row execute function public.protect_members();

-- ---------------------------------------------------------------------------
-- 7) Törzsadat írás-policy átállítása: owner-UID helyett STAFF (admin+owner),
--    aktív fiókkal. Az OLVASÁS marad, ahogy volt (mindenki olvashatja).
-- ---------------------------------------------------------------------------
drop policy if exists "write series"     on public.series;
drop policy if exists "write issues"     on public.issues;
drop policy if exists "write components" on public.components;
drop policy if exists "write lists"      on public.lists;

create policy "write series" on public.series
  for all using (public.is_staff() and public.is_active())
          with check (public.is_staff() and public.is_active());

create policy "write issues" on public.issues
  for all using (public.is_staff() and public.is_active())
          with check (public.is_staff() and public.is_active());

create policy "write components" on public.components
  for all using (public.is_staff() and public.is_active())
          with check (public.is_staff() and public.is_active());

create policy "write lists" on public.lists
  for all using (public.is_staff() and public.is_active())
          with check (public.is_staff() and public.is_active());

-- Kész. Következő: laprol-lapra-jogosultsag-2-ar-modell.sql
