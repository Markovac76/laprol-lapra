-- ============================================================================
-- LAPRÓL LAPRA — SOROZATKEZELÉS ÚJRATERVEZÉS (3. lépés): draft-tételek +
-- verziókövetés + felkiáltójel-mechanizmus
-- Futtatás: Supabase SQL Editor. Idempotens: nyugodtan újrafuttatható.
--
-- Tartalom:
--   1) series/issues/components — version oszlop
--   2) draft_issues / draft_components (a draft_series szám/komponens-szintje)
--   3) change_log (mezőnkénti változás-napló, minden entitás-típusra közösen)
--   4) member_seen (userenkénti "utoljára látott verzió")
--   5) global_counters + next_series_no() — GLOBÁLIS sorozat-kód számláló.
--      Csere a régi, felhasználónkénti `counters` táblára épülő
--      nextSeriesNo() kliens-függvényre, ami hibás volt: mivel userenként
--      külön számlált, két staff-tag ütköző kod_szam-ot kaphatott volna.
--      A publikálás mostantól szerver-oldalon (SQL-függvényben) fut, ott
--      pedig csak egy GLOBÁLIS, atomi számláló helyes. A régi `counters`
--      tábla érintetlenül marad (holtan), nem törlöm.
--   6) publish_draft_series(uuid) — a teljes publikálás EGY tranzakcióban:
--      diff mezőnként, change_log, verzióemelés, élő sorok frissítése/
--      létrehozása (UUID-k VÁLTOZATLANOK maradnak a meglévő tételeknél),
--      draft törlése.
--   7) seed_member_seen(uuid) — kiválasztáskor/gyűjtött-elfogadáskor a
--      hívó felhasználó member_seen sorainak feltöltése a sorozat MINDEN
--      tételére a JELENLEGI verzióra (ez a "ne lássak hamis felkiáltójelet
--      olyasmire, amit sosem láttam másképp" baseline).
--   8) RLS mindenre.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) version oszlopok
-- ---------------------------------------------------------------------------
alter table public.series     add column if not exists version int not null default 1;
alter table public.issues     add column if not exists version int not null default 1;
alter table public.components add column if not exists version int not null default 1;

-- ---------------------------------------------------------------------------
-- 2) draft_issues / draft_components — CSAK törzsadat-mezők (nincs személyes
--    státusz/ár — a draft publikálás előtti állapot, senkinek nincs még
--    személyes adata rajta).
-- ---------------------------------------------------------------------------
create table if not exists public.draft_issues (
  id               uuid primary key default gen_random_uuid(),
  draft_series_id  uuid not null references public.draft_series(id) on delete cascade,
  source_issue_id  uuid references public.issues(id) on delete set null,
  lapszam          int not null,
  cim              text,
  megjelenes       date,
  eredeti_ar       int
);
alter table public.draft_issues enable row level security;

create table if not exists public.draft_components (
  id                   uuid primary key default gen_random_uuid(),
  draft_issue_id       uuid not null references public.draft_issues(id) on delete cascade,
  source_component_id  uuid references public.components(id) on delete set null,
  tipus                text not null,
  azonosito_tipus      text,
  azonosito            text
);
alter table public.draft_components enable row level security;

-- ---------------------------------------------------------------------------
-- 3) change_log — közös tábla series/issue/component mezőváltozásokra
-- ---------------------------------------------------------------------------
create table if not exists public.change_log (
  id          bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('series','issue','component')),
  entity_id   uuid not null,
  field_name  text not null,
  old_value   text,
  new_value   text,
  version     int not null,
  changed_at  timestamptz not null default now(),
  is_current  boolean not null default true
);
alter table public.change_log enable row level security;
create index if not exists change_log_entity_idx on public.change_log(entity_type, entity_id);

-- ---------------------------------------------------------------------------
-- 4) member_seen — userenkénti utoljára látott verzió, entitásonként
-- ---------------------------------------------------------------------------
create table if not exists public.member_seen (
  user_id          uuid not null references auth.users(id) on delete cascade,
  entity_type      text not null check (entity_type in ('series','issue','component')),
  entity_id        uuid not null,
  last_seen_version int not null,
  primary key (user_id, entity_type, entity_id)
);
alter table public.member_seen enable row level security;

-- ---------------------------------------------------------------------------
-- 5) Globális sorozat-kód számláló
-- ---------------------------------------------------------------------------
create table if not exists public.global_counters (
  id           int primary key default 1,
  next_series_no int not null default 1,
  check (id = 1)
);
insert into public.global_counters (id, next_series_no)
select 1, coalesce(max(kod_szam),0) + 1 from public.series
on conflict (id) do nothing;

create or replace function public.next_series_no()
  returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.global_counters set next_series_no = next_series_no + 1
    where id = 1
    returning next_series_no - 1 into n;
  return n;
end;
$$;

-- global_counters: RLS bekapcsolva, SZÁNDÉKOSAN nulla policy-vel — senki
-- (még authenticated sem) nem érheti el közvetlenül, csak a SECURITY DEFINER
-- next_series_no() (ami a tábla tulajdonosaként fut, tehát megkerüli az RLS-t).
alter table public.global_counters enable row level security;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
drop policy if exists "draft_issues all"     on public.draft_issues;
drop policy if exists "draft_components all" on public.draft_components;
create policy "draft_issues all" on public.draft_issues
  for all using (public.is_staff() and public.is_active())
          with check (public.is_staff() and public.is_active());
create policy "draft_components all" on public.draft_components
  for all using (public.is_staff() and public.is_active())
          with check (public.is_staff() and public.is_active());

drop policy if exists "change_log read"   on public.change_log;
drop policy if exists "change_log write"  on public.change_log;
create policy "change_log read" on public.change_log for select using (true);
create policy "change_log write" on public.change_log
  for all using (public.is_staff() and public.is_active())
          with check (public.is_staff() and public.is_active());

drop policy if exists "member_seen all" on public.member_seen;
create policy "member_seen all" on public.member_seen
  for all using (user_id = auth.uid())
          with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7) seed_member_seen — a hívó saját member_seen sorainak feltöltése egy
--    sorozat MINDEN tételére, a JELENLEGI verzióra. Ezt hívja a kliens:
--    a) sorozat kiválasztásakor/újra-kiválasztásakor (my-series.js) —
--       baseline, hogy ne lásson hamis jelzést régi, előtte történt
--       változásokra;
--    b) a "gyűjtött elfogadás" gombra (mind elfogadom egyszerre).
-- ---------------------------------------------------------------------------
create or replace function public.seed_member_seen(p_series_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.member_seen (user_id, entity_type, entity_id, last_seen_version)
  select auth.uid(), 'series', id, version from public.series where id = p_series_id
  on conflict (user_id, entity_type, entity_id) do update set last_seen_version = excluded.last_seen_version;

  insert into public.member_seen (user_id, entity_type, entity_id, last_seen_version)
  select auth.uid(), 'issue', id, version from public.issues where series_id = p_series_id
  on conflict (user_id, entity_type, entity_id) do update set last_seen_version = excluded.last_seen_version;

  insert into public.member_seen (user_id, entity_type, entity_id, last_seen_version)
  select auth.uid(), 'component', c.id, c.version
    from public.components c join public.issues i on i.id = c.issue_id
    where i.series_id = p_series_id
  on conflict (user_id, entity_type, entity_id) do update set last_seen_version = excluded.last_seen_version;
end;
$$;
grant execute on function public.seed_member_seen(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6) log_field_change — belső segéd: lezárja a régi is_current bejegyzést,
--    beszúrja az újat. Csak a publish_draft_series hívja.
-- ---------------------------------------------------------------------------
create or replace function public.log_field_change(
  p_entity_type text, p_entity_id uuid, p_field text, p_old text, p_new text, p_version int
) returns void language plpgsql security definer set search_path = public as $$
begin
  update public.change_log set is_current = false
    where entity_type = p_entity_type and entity_id = p_entity_id
      and field_name = p_field and is_current = true;
  insert into public.change_log(entity_type, entity_id, field_name, old_value, new_value, version, is_current)
    values (p_entity_type, p_entity_id, p_field, p_old, p_new, p_version, true);
end;
$$;

-- publish_draft_series — a teljes publikálás egy tranzakcióban.
create or replace function public.publish_draft_series(p_draft_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
declare
  d           public.draft_series%rowtype;
  s_row       public.series%rowtype;
  i_row       public.issues%rowtype;
  c_row       public.components%rowtype;
  di          public.draft_issues%rowtype;
  dc          public.draft_components%rowtype;
  live_series_id uuid;
  live_issue_id  uuid;
  new_v       int;
  changed     boolean;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod publikálni.';
  end if;

  select * into d from public.draft_series where id = p_draft_id;
  if not found then raise exception 'A draft nem található.'; end if;

  if d.pool_type = 'new' then
    insert into public.series (kiado, megnevezes, megjelenites, szin, components, sort_order, kod_szam, lifecycle, version)
    values (d.kiado, d.megnevezes, d.megjelenites, d.szin, d.components,
            (select count(*) from public.series), public.next_series_no(), 'active', 1)
    returning id into live_series_id;
  else
    live_series_id := d.source_series_id;
    select * into s_row from public.series where id = live_series_id;
    new_v := s_row.version + 1;
    changed := false;
    if d.kiado is distinct from s_row.kiado then
      perform public.log_field_change('series', live_series_id, 'kiado', s_row.kiado, d.kiado, new_v); changed := true;
    end if;
    if d.megnevezes is distinct from s_row.megnevezes then
      perform public.log_field_change('series', live_series_id, 'megnevezes', s_row.megnevezes, d.megnevezes, new_v); changed := true;
    end if;
    if d.megjelenites is distinct from s_row.megjelenites then
      perform public.log_field_change('series', live_series_id, 'megjelenites', s_row.megjelenites, d.megjelenites, new_v); changed := true;
    end if;
    if d.szin is distinct from s_row.szin then
      perform public.log_field_change('series', live_series_id, 'szin', s_row.szin, d.szin, new_v); changed := true;
    end if;
    -- Rendezett összehasonlítás — a komponens-készlet SORRENDJE nem számít,
    -- csak a tartalma (checkbox ki/be kapcsolgatás ne jelezzen álváltozást).
    if (select array_agg(x order by x) from unnest(d.components) x)
       is distinct from (select array_agg(x order by x) from unnest(s_row.components) x) then
      perform public.log_field_change('series', live_series_id, 'components',
        array_to_string(s_row.components,','), array_to_string(d.components,','), new_v); changed := true;
    end if;
    if changed then
      update public.series set kiado=d.kiado, megnevezes=d.megnevezes, megjelenites=d.megjelenites,
        szin=d.szin, components=d.components, version=new_v where id = live_series_id;
    end if;
  end if;

  for di in select * from public.draft_issues where draft_series_id = d.id order by lapszam loop
    if di.source_issue_id is not null then
      select * into i_row from public.issues where id = di.source_issue_id;
      live_issue_id := di.source_issue_id;
      new_v := i_row.version + 1;
      changed := false;
      if di.lapszam is distinct from i_row.lapszam then
        perform public.log_field_change('issue', live_issue_id, 'lapszam', i_row.lapszam::text, di.lapszam::text, new_v); changed := true;
      end if;
      if di.cim is distinct from i_row.cim then
        perform public.log_field_change('issue', live_issue_id, 'cim', i_row.cim, di.cim, new_v); changed := true;
      end if;
      if di.megjelenes is distinct from i_row.megjelenes then
        perform public.log_field_change('issue', live_issue_id, 'megjelenes', i_row.megjelenes::text, di.megjelenes::text, new_v); changed := true;
      end if;
      if di.eredeti_ar is distinct from i_row.eredeti_ar then
        perform public.log_field_change('issue', live_issue_id, 'eredeti_ar', i_row.eredeti_ar::text, di.eredeti_ar::text, new_v); changed := true;
      end if;
      if changed then
        update public.issues set lapszam=di.lapszam, cim=di.cim, megjelenes=di.megjelenes, eredeti_ar=di.eredeti_ar, version=new_v
          where id = live_issue_id;
      end if;
    else
      insert into public.issues (series_id, lapszam, cim, megjelenes, eredeti_ar, version)
      values (live_series_id, di.lapszam, di.cim, di.megjelenes, di.eredeti_ar, 1)
      returning id into live_issue_id;
    end if;

    for dc in select * from public.draft_components where draft_issue_id = di.id loop
      if dc.source_component_id is not null then
        select * into c_row from public.components where id = dc.source_component_id;
        new_v := c_row.version + 1;
        changed := false;
        if dc.azonosito_tipus is distinct from c_row.azonosito_tipus then
          perform public.log_field_change('component', dc.source_component_id, 'azonosito_tipus', c_row.azonosito_tipus, dc.azonosito_tipus, new_v); changed := true;
        end if;
        if dc.azonosito is distinct from c_row.azonosito then
          perform public.log_field_change('component', dc.source_component_id, 'azonosito', c_row.azonosito, dc.azonosito, new_v); changed := true;
        end if;
        if changed then
          update public.components set azonosito_tipus=dc.azonosito_tipus, azonosito=dc.azonosito, version=new_v
            where id = dc.source_component_id;
        end if;
      else
        insert into public.components (issue_id, tipus, azonosito_tipus, azonosito, version)
        values (live_issue_id, dc.tipus, dc.azonosito_tipus, dc.azonosito, 1);
      end if;
    end loop;
  end loop;

  delete from public.draft_series where id = p_draft_id;
end;
$$;
grant execute on function public.publish_draft_series(uuid) to authenticated;

-- Kész. Következő (4. lépés): képjavaslat-workflow (image_proposals).
