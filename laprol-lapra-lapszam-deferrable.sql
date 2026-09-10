-- ============================================================================
-- LAPRÓL LAPRA — SÜRGŐS HIBAJAVÍTÁS: lapszám-csere ütközik az egyediségi
-- szabállyal ("duplicate key value violates unique constraint
-- issues_series_id_lapszam_key").
--
-- Ez NEM ugyanaz a hiba, mint a korábbi (soft-delete után újrafelvitt
-- lapszám) — ott a régi, TÖRÖLT sor foglalta a helyet. Itt két AKTÍV Szám
-- sorszámát cserélik fel egy draftban (#29↔#30) — a publish_draft_series()
-- a draft_issues sorokat SORBAN, egyesével UPDATE-eli, ezért a csere
-- köztes állapotában (amíg csak az egyik UPDATE futott le) átmenetileg KÉT
-- Szám állna 30-as lapszámmal — ezt a sima (nem halasztott) egyediségi
-- ellenőrzés AZONNAL, statement után elbukja, még a második UPDATE előtt.
--
-- publish_draft_series() egyetlen PL/pgSQL FÜGGVÉNY (nem PROCEDURE) —
-- ilyen nem tartalmazhat COMMIT-ot, tehát a teljes törzse szerkezetileg
-- mindig a hívó EGY tranzakciójában fut. A hiányzó darab csak az volt,
-- hogy az egyediség-ellenőrzés a tranzakció VÉGÉRE legyen halasztva.
--
-- A 12. lépés óta issues_series_id_lapszam_key egy sima, RÉSZLEGES
-- UNIQUE INDEX (WHERE NOT is_deleted) — ez NEM lehet DEFERRABLE (Postgres-
-- ben egy sima UNIQUE/EXCLUDE CONSTRAINT, ami lehet deferrable, nem
-- támogat WHERE-részleges feltételt). A megoldás egy EXCLUDE constraint,
-- ami EGYSZERRE támogatja mindkettőt: a részleges feltételt ÉS a
-- halasztást. Ez megőrzi a 12. lépés javítását (soft-delete után a
-- lapszám újra felhasználható) ÉS megoldja a mostani hibát is — a kettő
-- egymást nem zárja ki, egyetlen constraint fedi le mindkettőt.
--
-- Előzetesen egy ideiglenes teszttáblán (tranzakción belül, rollbackelve)
-- kipróbálva: a csere-forgatókönyv sikerült, egy valódi/tartós ütközés a
-- commit-nál helyesen elbukott, a részleges (soft-delete) kizárás is
-- helyesen működött.
--
-- Futtatás: scripts/run-migration.js (backup + tranzakció).
-- ============================================================================

drop index if exists issues_series_id_lapszam_key;

alter table public.issues add constraint issues_series_id_lapszam_key
  exclude using btree (series_id with =, lapszam with =)
  where (not is_deleted)
  deferrable initially deferred;

-- Kész.
