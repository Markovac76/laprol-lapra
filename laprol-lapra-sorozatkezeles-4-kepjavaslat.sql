-- ============================================================================
-- LAPRÓL LAPRA — SOROZATKEZELÉS ÚJRATERVEZÉS (4. lépés): képkezelés +
-- képjavaslat-workflow
-- Futtatás: Supabase SQL Editor. Idempotens: nyugodtan újrafuttatható.
--
-- Ez az első lépés, ami Supabase Storage-ot használ — eddig sehol nem volt
-- kép-feltöltés az appban, ezért ez a teljes csővezetéket megépíti: közös,
-- PUBLIKUS bucket (nincs aláírt-URL frissítési logika, a `kep_url` egyszerű,
-- állandó publikus URL marad — a jóváhagyott terv szerint), staff közvetlen
-- feltöltés/csere, user-javaslat kiválasztott sorozaton belüli komponensre,
-- max 1 függő javaslat/komponens, admin jóváhagyás/elutasítás.
--
-- Tartalom:
--   1) components.upload_enabled oszlop (alapból false; a "nincs kép"
--      kivétel kliens-oldalon számolt, NEM tárolt flag — lásd js).
--   2) image_proposals tábla + RLS (max 1 pending/komponens: parciális
--      unique index).
--   3) can_propose_image(component_id) — SECURITY DEFINER helper: a hívó
--      csak olyan komponensre javasolhat, aminek a sorozata nála
--      member_series.is_selected=true.
--   4) component-images Storage bucket (publikus) + storage.objects RLS:
--      staff mindent tehet a bucketben; aktív user csak a saját, engedélyezett
--      javaslat-útvonalára tölthet fel/frissíthet.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) upload_enabled
-- ---------------------------------------------------------------------------
alter table public.components add column if not exists upload_enabled boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2) image_proposals
-- ---------------------------------------------------------------------------
create table if not exists public.image_proposals (
  id           uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.components(id) on delete cascade,
  proposed_by  uuid not null references auth.users(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references auth.users(id)
);
alter table public.image_proposals enable row level security;
create unique index if not exists image_proposals_one_pending
  on public.image_proposals(component_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- 3) can_propose_image — csak a saját, kiválasztott (member_series) sorozat
--    komponensére lehet javasolni.
-- ---------------------------------------------------------------------------
create or replace function public.can_propose_image(p_component_id uuid)
  returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return exists (
    select 1 from public.components c
    join public.issues i on i.id = c.issue_id
    join public.member_series ms on ms.series_id = i.series_id
    where c.id = p_component_id and ms.user_id = auth.uid() and ms.is_selected = true
  );
end;
$$;
grant execute on function public.can_propose_image(uuid) to authenticated;

drop policy if exists "image_proposals read"   on public.image_proposals;
drop policy if exists "image_proposals insert" on public.image_proposals;
drop policy if exists "image_proposals staff"  on public.image_proposals;
-- Olvasás mindenkinek (mint a change_log) — kelleni fog mindenkinek, hogy lássa,
-- van-e már függő javaslat egy komponensen, mielőtt sajátot próbálna beküldeni.
create policy "image_proposals read" on public.image_proposals for select using (true);
create policy "image_proposals insert" on public.image_proposals
  for insert with check (
    proposed_by = auth.uid() and public.is_active() and public.can_propose_image(component_id)
  );
-- Elbírálás (approved/rejected + decided_at/decided_by) csak staff.
create policy "image_proposals staff" on public.image_proposals
  for update using (public.is_staff() and public.is_active())
             with check (public.is_staff() and public.is_active());

-- ---------------------------------------------------------------------------
-- 4) Storage bucket + RLS
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('component-images', 'component-images', true)
on conflict (id) do nothing;

drop policy if exists "component-images staff all" on storage.objects;
drop policy if exists "component-images propose insert" on storage.objects;
drop policy if exists "component-images propose update" on storage.objects;

-- Staff: teljes hozzáférés a bucketben (élő kép feltöltése/cseréje, javaslatok
-- élővé mozgatása/törlése jóváhagyáskor/elutasításkor).
create policy "component-images staff all" on storage.objects
  for all using (bucket_id = 'component-images' and public.is_staff() and public.is_active())
          with check (bucket_id = 'component-images' and public.is_staff() and public.is_active());

-- Aktív user: csak a "components/{component_id}/proposed/…" útvonalra tölthet
-- fel/frissíthet, és csak olyan komponensre, ami a saját kiválasztott
-- sorozatához tartozik. Az útvonalból kinyert component_id-t a
-- can_propose_image() ellenőrzi.
create policy "component-images propose insert" on storage.objects
  for insert with check (
    bucket_id = 'component-images' and public.is_active()
    and (storage.foldername(name))[1] = 'components'
    and (storage.foldername(name))[3] = 'proposed'
    and public.can_propose_image(((storage.foldername(name))[2])::uuid)
  );
create policy "component-images propose update" on storage.objects
  for update using (
    bucket_id = 'component-images' and public.is_active()
    and (storage.foldername(name))[1] = 'components'
    and (storage.foldername(name))[3] = 'proposed'
    and public.can_propose_image(((storage.foldername(name))[2])::uuid)
  );

-- Kész. A publikus bucket miatt OLVASÁS (a kép megjelenítése) nem igényel
-- policy-t — a Storage a publikus URL-t RLS-től függetlenül kiszolgálja.
