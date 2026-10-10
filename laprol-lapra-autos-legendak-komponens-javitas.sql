-- ============================================================================
-- LAPRÓL LAPRA — Az Autós Világ Legendái (Autós Legendák): a hiányzó
-- komponensek pótlása (egyszeri adatjavítás)
-- Futtatás: scripts/run-migration.js (backup + BEGIN/COMMIT).
--
-- FUTTATÁS ELŐFELTÉTELE: az új-Szám-komponens javítás (laprol-lapra-uj-szam-
-- komponens-alap.sql) élesben van és jóváhagyott.
--
-- A hiba (a457ed7): a sorozat 60 Száma komponens nélkül jött létre
-- (2026-10-10 22:10:18 UTC, publikálás). Itt pontosan azt pótoljuk, amit a
-- publish_draft_series egy új komponensnél létrehoz: issue_id, tipus,
-- azonosito_tipus/azonosito/megnevezes (NULL), version = 1 — a többi oszlop az
-- alapérték (db=1, cimkek={}, upload_enabled=false, created_at=now()). A
-- user_id-t a futtatás szuperfelhasználóként nem tudja az auth.uid()-ból
-- venni, ezért a sorozat tulajdonosáé (series.user_id) — ugyanaz, mint amit a
-- publikáló felhasználó kapott volna (a Mancs Őrjárat komponenseinél is a
-- tulajdonos az).
--
-- Típusok: a sorozat deklarált komponens-típusai (series.components) — itt
-- csak a „konyv”. Számonként egy üres példány.
--
-- Utána seed_issue_seen_for_subscribers() minden Számra, hogy a feliratkozóknak
-- ne jelenjen meg tételenkénti felkiáltójel (komponens-verzió 1 > látott 0).
--
-- Önellenőrző: ha az állapot nem pontosan az elvárt (60 Szám, 1 deklarált
-- típus, 0 komponens), vagy az eredmény nem 60 új komponens / 0 hiányzó
-- member_seen, a tranzakció visszagörög, és semmi nem változik.
-- ============================================================================

do $$
declare
  sid       uuid := '45d431fc-d769-4bd9-9639-42b9e4f01d02';
  ser       public.series%rowtype;
  n_issue   int;
  n_types   int;
  n_ins     int;
  n_comp    int;
  n_unseen  int;
begin
  select * into ser from public.series where id = sid;
  if not found then
    raise exception 'A sorozat nem található (%).', sid;
  end if;

  select count(*) into n_issue from public.issues where series_id = sid and not is_deleted;
  n_types := coalesce(array_length(ser.components, 1), 0);
  select count(*) into n_comp
    from public.components c join public.issues i on i.id = c.issue_id where i.series_id = sid;

  if n_issue <> 60 or n_types <> 1 or n_comp <> 0 then
    raise exception 'Az Autós Legendák állapota nem az elvárt (Számok: %, deklarált típusok: %, meglévő komponensek: %) — nem módosítok semmit.',
      n_issue, n_types, n_comp;
  end if;

  insert into public.components (issue_id, tipus, azonosito_tipus, azonosito, megnevezes, version, user_id)
  select i.id, t.tipus, null, null, null, 1, ser.user_id
    from public.issues i
    cross join lateral unnest(ser.components) with ordinality as t(tipus, ord)
   where i.series_id = sid and not i.is_deleted
     and not exists (select 1 from public.components c where c.issue_id = i.id and c.tipus = t.tipus)
   order by i.lapszam, t.ord;
  get diagnostics n_ins = row_count;
  if n_ins <> 60 then
    raise exception 'A beszúrt komponensek száma % (várt: 60) — visszagörgetés.', n_ins;
  end if;

  perform public.seed_issue_seen_for_subscribers(i.id)
     from public.issues i where i.series_id = sid and not i.is_deleted;

  -- ellenőrzés: minden új komponenshez van member_seen sor minden feliratkozónál
  select count(*) into n_unseen
    from public.components c
    join public.issues i on i.id = c.issue_id
    join public.member_series ms on ms.series_id = i.series_id and ms.is_selected
   where i.series_id = sid
     and not exists (select 1 from public.member_seen x
                      where x.user_id = ms.user_id and x.entity_type = 'component' and x.entity_id = c.id);
  if n_unseen <> 0 then
    raise exception '% komponenshez hiányzik a member_seen sor — visszagörgetés.', n_unseen;
  end if;
end $$;

-- Kész.
