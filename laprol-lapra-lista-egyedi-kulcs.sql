-- ============================================================================
-- LAPRÓL LAPRA — a listatár egyediségi kulcsa (feltöltés-átalakítási kör, 11. pont)
-- Futtatás: scripts/run-migration.js (backup + BEGIN/COMMIT). Idempotens.
--
-- Eddig:  UNIQUE (user_id, tipus, ertek)  — a user_id miatt két admin ugyanazt
--         az értéket külön-külön felvehette, és a kis/nagybetű eltérés ("Kártya"
--         / "kártya") mindkettőt átengedte. A listák KÖZÖSEK (mindenki
--         ugyanazt látja), a user_id csak a létrehozót jelöli.
-- Ezután: egyedi (tipus, lower(ertek)) — listánként, kis/nagybetű-függetlenül,
--         user_id nélkül; és a megjelenített név is egyedi (tipus,
--         lower(trim(név))), hogy az ÁTNEVEZÉS se hozhasson létre "Kártya" és
--         "kártya" párt.
--
-- Biztonsági elő-ellenőrzés: ha a meglévő adatban már van ilyen duplikáció,
-- a script érthető üzenettel megáll (és semmit nem módosít).
-- ============================================================================

do $$
declare n int;
begin
  select count(*) into n from (
    select 1 from public.lists group by tipus, lower(ertek) having count(*) > 1) x;
  if n > 0 then
    raise exception 'A lists táblában % olyan (tipus, ertek) pár van, ami csak kis/nagybetűben tér el — előbb ezeket kell egyesíteni.', n;
  end if;

  select count(*) into n from (
    select 1 from public.lists
    group by tipus, lower(btrim(coalesce(megjelenites, ertek))) having count(*) > 1) x;
  if n > 0 then
    raise exception 'A lists táblában % olyan megjelenített név-pár van, ami csak kis/nagybetűben vagy szóközben tér el — előbb ezeket kell egyesíteni.', n;
  end if;
end $$;

alter table public.lists drop constraint if exists lists_user_id_tipus_ertek_key;

create unique index if not exists lists_tipus_ertek_ci_key
  on public.lists (tipus, lower(ertek));

create unique index if not exists lists_tipus_nev_ci_key
  on public.lists (tipus, lower(btrim(coalesce(megjelenites, ertek))));

-- Kész.
