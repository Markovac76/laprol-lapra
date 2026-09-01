-- ============================================================================
-- LAPRÓL LAPRA — Sorozat-szintű borítókép (ingyenes bemutató-füzet, ami a
-- számozott 1-es szám előtt jár). Tisztán vizuális/referencia mező, NEM egy
-- Szám — nem számít bele semmilyen darabszám/teljesítettségi-számításba.
--
-- A workflow UGYANAZ, mint a komponens-képeknél (2.7. pont) — a meglévő
-- image_proposals táblát bővítjük entity_type megkülönböztetéssel, nem
-- épül párhuzamos, duplikált mechanizmus.
--
-- Futtatás: scripts/run-migration.js (backup + tranzakció).
-- ============================================================================

-- 1) Sorozat-szintű borítókép mezők — a components mintájára (kep_url,
-- upload_enabled), de "borito_" előtaggal, hogy egyértelműen elkülönüljön.
-- Tudatosan NEM a draft_series-en él (mint a komponens-képek, ez is a
-- draft/publikálás-ciklustól FÜGGETLEN, azonnal az élő sorozatra hat).
alter table public.series add column if not exists borito_url text;
alter table public.series add column if not exists borito_upload_enabled boolean not null default false;

-- 2) image_proposals bővítése entity_type-tal — 'component' (eddigi
-- viselkedés, változatlan) vagy 'series' (új). component_id NULLABLE lesz,
-- új series_id oszlop jön, egy CHECK biztosítja, hogy pontosan az egyik
-- legyen kitöltve az entity_type-nak megfelelően.
alter table public.image_proposals add column if not exists entity_type text not null default 'component';
alter table public.image_proposals add column if not exists series_id uuid references public.series(id) on delete cascade;
alter table public.image_proposals alter column component_id drop not null;
alter table public.image_proposals add constraint image_proposals_entity_check check (
  (entity_type = 'component' and component_id is not null and series_id is null) or
  (entity_type = 'series' and series_id is not null and component_id is null)
);

-- Max. 1 függő javaslat sorozat-borítónként is (a komponensekre már meglévő
-- image_proposals_one_pending indexhez hasonlóan, de series_id-re).
create unique index if not exists image_proposals_one_pending_series
  on public.image_proposals (series_id) where (status = 'pending');

-- 3) can_propose_series_image — a can_propose_image komponens-szintű
-- párja: csak az javasolhat sorozat-borítót, aki a saját (member_series)
-- Sorozataim listájában már kiválasztotta azt a sorozatot.
create or replace function public.can_propose_series_image(p_series_id uuid)
  returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.member_series ms
    where ms.series_id = p_series_id and ms.user_id = auth.uid() and ms.is_selected = true
  );
end;
$$;
grant execute on function public.can_propose_series_image(uuid) to authenticated;

-- 4) image_proposals INSERT policy — mindkét entity_type-ot kezelje.
drop policy if exists "image_proposals insert" on public.image_proposals;
create policy "image_proposals insert" on public.image_proposals for insert
  with check (
    proposed_by = auth.uid() and public.is_active() and (
      (entity_type = 'component' and public.can_propose_image(component_id)) or
      (entity_type = 'series' and public.can_propose_series_image(series_id))
    )
  );

-- 5) Storage: a meglévő "component-images staff all" policy már mindent
-- enged staffnak, bucketen belül BÁRMELY útvonalon (tehát series/... alatt
-- is) — ahhoz nem kell semmit módosítani. Csak a nem-staff propose-utakat
-- kell bővíteni a "series/{id}/proposed/{proposalId}.jpg" mintára.
drop policy if exists "component-images propose insert series" on storage.objects;
create policy "component-images propose insert series" on storage.objects for insert
  with check (
    bucket_id = 'component-images' and public.is_active()
    and (storage.foldername(name))[1] = 'series'
    and (storage.foldername(name))[3] = 'proposed'
    and public.can_propose_series_image(((storage.foldername(name))[2])::uuid)
  );
drop policy if exists "component-images propose update series" on storage.objects;
create policy "component-images propose update series" on storage.objects for update
  using (
    bucket_id = 'component-images' and public.is_active()
    and (storage.foldername(name))[1] = 'series'
    and (storage.foldername(name))[3] = 'proposed'
    and public.can_propose_series_image(((storage.foldername(name))[2])::uuid)
  );

-- Kész.
