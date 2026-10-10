-- ============================================================================
-- LAPRÓL LAPRA — "Szerkesztés indítása" atomi függvénye + egy szerkesztési
-- draft egy élő sorozathoz (feltöltés-átalakítási kör utáni javaslat)
-- Futtatás: scripts/run-migration.js (backup + BEGIN/COMMIT). Idempotens.
--
-- Eddig a "Szerkesztés indítása" három külön kliens-lépés volt (draft-sor,
-- Számok másolása, komponensek másolása). Hálózati hiba vagy bezárt fül
-- félig másolt draftot hagyhatott, dupla koppintás vagy két staff egyszerre
-- két szerkesztési draftot is nyithatott ugyanahhoz a sorozathoz.
--
-- 1) Részleges egyedi index: egy élő sorozathoz legfeljebb EGY szerkesztési
--    ("edit") draft. Elő-ellenőrzéssel: ha ma már van duplikáció, érthető
--    üzenettel megáll, és semmit nem módosít.
-- 2) start_edit_draft(sorozat): egyetlen tranzakcióban létrehozza a draftot a
--    hívó lefoglalásával, és átmásolja az élő NEM törölt Számokat és
--    komponenseiket. A sorozat sort zárolja, így két egyidejű indítás sorba áll.
--    A törölt (soft-delete-elt) élő Számokat NEM másolja: a szerkesztőben nincs
--    helyük, és a lapszámuk újrahasználható (a lapszám-egyediség részleges).
--    Csak AKTÍV (publikált) sorozatra, és nem a törlésre jelölt sorozatra.
-- ============================================================================

do $$
declare n int;
begin
  select count(*) into n from (
    select 1 from public.draft_series
     where pool_type = 'edit' and source_series_id is not null
     group by source_series_id having count(*) > 1) x;
  if n > 0 then
    raise exception 'Van % olyan élő sorozat, amelyhez több szerkesztési munkaanyag is tartozik — előbb egyesíteni/törölni kell őket.', n;
  end if;
end $$;

create unique index if not exists draft_series_one_edit_per_series
  on public.draft_series (source_series_id)
  where pool_type = 'edit';

create or replace function public.start_edit_draft(p_series_id uuid)
  returns uuid language plpgsql security definer set search_path = public as $$
declare
  s    public.series%rowtype;
  d_id uuid;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod szerkesztést indítani.';
  end if;

  select * into s from public.series where id = p_series_id for update;
  if not found then
    raise exception 'A sorozat nem található.';
  end if;
  if s.lifecycle <> 'active' then
    raise exception 'Szerkesztés csak aktív (publikált) sorozaton indítható — ez a sorozat nem aktív (állapota: %).',
      case s.lifecycle when 'unpublished' then 'publikálatlan' else s.lifecycle end;
  end if;
  if s.force_delete_requested_at is not null then
    raise exception 'Ez a sorozat törlésre jelölt — a türelmi idő alatt nem szerkeszthető.';
  end if;
  if exists (select 1 from public.draft_series
              where source_series_id = p_series_id and pool_type = 'edit') then
    raise exception 'Ehhez a sorozathoz már van nyitott szerkesztési munkaanyag — nézd meg a Karbantartás „Munka sorozatok” fülén.';
  end if;

  insert into public.draft_series (pool_type, pool_status, source_series_id, submitted_by,
                                   claimed_by, claimed_at, kiado, megnevezes, megjelenites,
                                   szin, kategoria, components)
  values ('edit', 'claimed', p_series_id, auth.uid(), auth.uid(), now(),
          s.kiado, s.megnevezes, s.megjelenites, s.szin, s.kategoria, s.components)
  returning id into d_id;

  insert into public.draft_issues (draft_series_id, source_issue_id, lapszam, cim, megjelenes, eredeti_ar)
  select d_id, i.id, i.lapszam, i.cim, i.megjelenes, i.eredeti_ar
    from public.issues i
   where i.series_id = p_series_id and not i.is_deleted;

  insert into public.draft_components (draft_issue_id, source_component_id, tipus, azonosito_tipus, azonosito, megnevezes)
  select di.id, c.id, c.tipus, c.azonosito_tipus, c.azonosito, c.megnevezes
    from public.components c
    join public.draft_issues di on di.source_issue_id = c.issue_id
   where di.draft_series_id = d_id;

  return d_id;
end;
$$;
grant execute on function public.start_edit_draft(uuid) to authenticated;

-- Kész.
