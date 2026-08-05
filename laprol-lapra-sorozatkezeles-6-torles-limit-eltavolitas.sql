-- ============================================================================
-- LAPRÓL LAPRA — SOROZATKEZELÉS: az 5x törlési limit eltávolítása
-- Futtatás: Supabase SQL Editor. Idempotens.
--
-- Döntés: a member_series.delete_count-alapú, 5 törlés utáni újra-választási
-- tiltás feleslegesnek bizonyult — eleve adott, melyik felhasználó melyik
-- sorozatot használja és honnan, ez nem terheli a rendszert. A leválasztás/
-- újra-választás mostantól korlátlan; a leválasztáskori "megtartod vagy
-- törlöd a saját adataidat" választás (member_status/member_issue_data
-- sorsa) változatlan.
-- ============================================================================

-- 1) A trigger egyszerűsítése — a delete_count-tal kapcsolatos két szabály
--    (nem csökkenthető / 5 fölött nem választható újra) törölve, csak a
--    force-törlés-védőháló marad. A trigger kötése (before insert or update)
--    változatlan, csak a függvénytest cserélődik.
create or replace function public.protect_member_series()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  fd_pending boolean;
begin
  if new.is_selected and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and not old.is_selected)) then
    select force_delete_requested_at is not null into fd_pending from public.series where id = new.series_id;
    if fd_pending then
      raise exception 'Ez a sorozat törlésre jelölve — jelenleg nem választható be.';
    end if;
  end if;
  return new;
end;
$$;

-- 2) delete_count oszlop eltávolítása — a check constraint vele együtt megszűnik.
alter table public.member_series drop column if exists delete_count;

-- Kész.
