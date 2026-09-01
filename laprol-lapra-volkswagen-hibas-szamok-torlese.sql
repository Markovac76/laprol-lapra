-- ============================================================================
-- LAPRÓL LAPRA — "Volkswagen modellautógyűjtemény": a #4-67 tartományból
-- a MÉG NEM megerősített, hibás (nem magyarországi listás) AI-adatú 44
-- Szám soft-törlése.
--
-- Előzmény: a tulajdonos szándéka az volt, hogy a teljes #4-67 tartományt
-- törli, és csak a már megerősített 20 Számot (4-19, 27, 30, 59, 61) viszi
-- vissza élesen javított adattal — ez a 20 db a legutóbbi migrációval és
-- publikálással már megtörtént. A maradék 44 Szám tévedésből NEM lett
-- törölve (a draftból egyszerűen kimaradtak, se szerkesztésként, se
-- törlésként) — jelenleg élesen látszanak a régi, hibás adatukkal.
--
-- Ez a script ugyanazt csinálja, amit a Karbantartás draft-szerkesztőjének
-- "Ezt a Számot törlöm a sorozatból" jelölőnégyzete + publikálás tenne
-- mindegyik Számra: log_field_change('issue', ..., 'is_deleted', ...) +
-- version emelés + is_deleted = true — így a felkiáltójel/gyűjtött-
-- elfogadás mechanizmus a jelenlegi feliratkozóknak helyesen jelzi a
-- törlést, ugyanúgy, mintha a normál úton történt volna.
--
-- Futtatás: scripts/run-migration.js (backup + tranzakció).
-- ============================================================================

do $$
declare
  r record;
  new_v int;
  kept int[] := array[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,27,30,59,61];
  cnt int := 0;
begin
  for r in
    select id, version from public.issues
    where series_id = '1e1a9bad-f25e-4bcf-8c74-b032d5bb3599'
      and lapszam between 4 and 67
      and lapszam != all(kept)
      and not is_deleted
  loop
    new_v := r.version + 1;
    perform public.log_field_change('issue', r.id, 'is_deleted', 'false', 'true', new_v);
    update public.issues set is_deleted = true, version = new_v where id = r.id;
    cnt := cnt + 1;
  end loop;
  raise notice 'Törölt (soft-delete) Számok száma: %', cnt;
end $$;

-- Kész.
