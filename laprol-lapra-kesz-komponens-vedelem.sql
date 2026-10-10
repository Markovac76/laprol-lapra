-- ============================================================================
-- LAPRÓL LAPRA — a „Kész” gomb védelme: komponens nélküli ÚJ Szám nem mehet
-- publikálásra
-- Futtatás: scripts/run-migration.js (backup + BEGIN/COMMIT). Idempotens
-- (CREATE OR REPLACE).
--
-- A feltétel (a tulajdonos döntése): minden ÚJ (élő párral nem rendelkező,
-- nem törölt) draft-Számnak legyen LEGALÁBB EGY komponense. NEM követeli meg,
-- hogy a sorozat minden deklarált típusa meglegyen (van olyan Szám, aminek
-- szándékosan nincs minden típusa); a komponens nélküli Szám viszont mindig
-- hiba: nem állítható rajta sem státusz, sem azonosító. A publikálás ilyet
-- eddig csendben létrehozott (Autós Legendák, 60 Szám).
--
-- A meglévő (élő párral rendelkező) Számokat ez az ellenőrzés nem érinti.
-- A függvény egyébként azonos az élő definícióval
-- (laprol-lapra-draft-sablon-roundtrip.sql), a lapszám-ütközés ellenőrzése
-- változatlan.
-- ============================================================================

create or replace function public.mark_draft_ready(p_draft_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  d         public.draft_series%rowtype;
  conf      jsonb;
  n_missing int;
  lst       text;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod ehhez a művelethez.';
  end if;
  select * into d from public.draft_series where id = p_draft_id for update;
  if not found then raise exception 'A munkaanyag nem található.'; end if;
  if d.pool_status <> 'claimed' then
    raise exception 'Ez a munkaanyag nem „Munkaanyag” állapotban van — frissítsd a Karbantartás nézetet.';
  end if;
  if d.claimed_by is distinct from auth.uid() and public.my_role() <> 'owner' then
    raise exception 'Csak a munkaanyagot lefoglaló admin vagy a tulajdonos állíthatja Kész-re.';
  end if;

  -- Komponens nélküli ÚJ Számok
  select count(*) into n_missing
    from public.draft_issues di
   where di.draft_series_id = p_draft_id and di.source_issue_id is null and not di.deleted
     and not exists (select 1 from public.draft_components dc where dc.draft_issue_id = di.id);
  if n_missing > 0 then
    select string_agg('#' || x.lapszam || ' „' || coalesce(nullif(btrim(x.cim), ''), 'cím nélkül') || '”', ', ' order by x.lapszam)
      into lst
      from (select di.lapszam, di.cim
              from public.draft_issues di
             where di.draft_series_id = p_draft_id and di.source_issue_id is null and not di.deleted
               and not exists (select 1 from public.draft_components dc where dc.draft_issue_id = di.id)
             order by di.lapszam
             limit 10) x;
    raise exception E'A munkaanyag nem állítható „Kész”-re: % nincs egyetlen komponense sem — a publikálás komponens nélküli Számot hozna létre, amelyen sem azonosító, sem státusz nem állítható.\n\n%\n\nTeendő: nyisd meg az érintett Számot a szerkesztőben, és adj hozzá legalább egy komponenst („+ Még egy … hozzáadása”), vagy töltsd fel újra a sablont (az új sorokhoz a sorozat komponensei automatikusan létrejönnek), majd próbáld újra.',
      n_missing || ' új Számnak',
      lst || case when n_missing > 10 then ' … (és még ' || (n_missing - 10) || ')' else '' end;
  end if;

  conf := public.draft_lapszam_conflicts(p_draft_id, '[]'::jsonb);
  if jsonb_array_length(conf) > 0 then
    raise exception E'A munkaanyag nem állítható „Kész”-re: a publikálás után több nem törölt Szám ugyanazt a lapszámot kapná.\n\n%\n\nJavítsd a lapszámokat, vagy jelöld törlésre az élő Számot, majd próbáld újra.',
      public.draft_conflicts_text(conf);
  end if;

  update public.draft_series set pool_status = 'ready', ready_at = now() where id = p_draft_id;
end;
$$;
grant execute on function public.mark_draft_ready(uuid) to authenticated;

-- Kész.
