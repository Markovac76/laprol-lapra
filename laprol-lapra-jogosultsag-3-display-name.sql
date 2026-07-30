-- ============================================================================
-- LAPRÓL LAPRA — FELHASZNÁLÓ-NÉV A KEZELŐFELÜLETHEZ (3/3, opcionális de ajánlott)
-- Futtatás: Supabase SQL Editor, a "-1-members.sql" után (a "-2"-vel együtt is mehet).
-- Idempotens.
--
-- Cél: a felhasználó-kezelő lista e-mail alapján azonosítható legyen.
-- A böngésző NEM olvashatja az auth.users táblát, ezért az e-mailt a
-- members.display_name mezőbe másoljuk (új regisztrációkor automatikusan,
-- a meglévőkhöz egyszeri visszatöltéssel).
-- ============================================================================

-- 1) Új regisztráció: a member-sor kapja meg az e-mailt display_name-ként.
create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (user_id, role, status, display_name)
  values (new.id, 'user', 'active', new.email)
  on conflict (user_id) do update
    set display_name = coalesce(public.members.display_name, excluded.display_name);
  return new;
end;
$$;

-- 2) Meglévő felhasználók: töltsük fel a display_name-et az e-mailjükkel,
--    ahol még üres. (A tulajdonos sora is megkapja.)
update public.members m
set display_name = u.email
from auth.users u
where u.id = m.user_id
  and (m.display_name is null or m.display_name = '');

-- Ellenőrzés (opcionális):
--   select role, status, display_name from public.members order by created_at;
