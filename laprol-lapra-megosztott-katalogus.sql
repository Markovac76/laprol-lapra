-- ========== MEGOSZTOTT KATALÓGUS ==========
-- A sorozatokat/tételeket a tulajdonos (te) viszi fel — mindenki látja.
-- A státusz/darabszám/jegyzet SZEMÉLYES — mindenki a sajátját állítja.

-- 1) Személyes állapot tábla (egy sor = egy felhasználó egy komponenshez tartozó jelölése)
create table public.member_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  component_id uuid not null references public.components(id) on delete cascade,
  status text,
  db int not null default 1,
  jegyzet text,
  updated_at timestamptz not null default now(),
  unique (user_id, component_id)
);
alter table public.member_status enable row level security;
create policy "own status" on public.member_status
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2) A tulajdonos meglévő jelölései átkerülnek ide (az eddigi components.status/db/jegyzet)
insert into public.member_status (user_id, component_id, status, db, jegyzet)
select user_id, id, status, coalesce(db,1), jegyzet
from public.components
where status is not null or db is not null or jegyzet is not null;

-- 3) Tulajdonos azonosítója (csak ő szerkesztheti a sorozatokat/tételeket/mestertörzsadatot)
-- FIGYELEM: ha nem a te fiókod ez a UID, cseréld ki mindenhol ebben a fájlban!
-- Tulajdonos: 25cb3724-02d4-4002-98b0-c93f74ef4e42

-- 4) RLS csere: series / issues / components — mindenki OLVASHATJA, csak a tulajdonos ÍRHATJA
drop policy if exists "own series" on public.series;
drop policy if exists "own issues" on public.issues;
drop policy if exists "own components" on public.components;

create policy "read series" on public.series for select using (true);
create policy "write series" on public.series for all
  using (auth.uid() = '25cb3724-02d4-4002-98b0-c93f74ef4e42')
  with check (auth.uid() = '25cb3724-02d4-4002-98b0-c93f74ef4e42');

create policy "read issues" on public.issues for select using (true);
create policy "write issues" on public.issues for all
  using (auth.uid() = '25cb3724-02d4-4002-98b0-c93f74ef4e42')
  with check (auth.uid() = '25cb3724-02d4-4002-98b0-c93f74ef4e42');

create policy "read components" on public.components for select using (true);
create policy "write components" on public.components for all
  using (auth.uid() = '25cb3724-02d4-4002-98b0-c93f74ef4e42')
  with check (auth.uid() = '25cb3724-02d4-4002-98b0-c93f74ef4e42');

-- A lists (listatár) marad ahogy volt: a tulajdonos listái mindenkinek megjelennek olvasásra is,
-- hogy a legördülők működjenek. Írás csak tulajdonosnak (a lists tábla ritkán változik).
drop policy if exists "own lists" on public.lists;
create policy "read lists" on public.lists for select using (true);
create policy "write lists" on public.lists for all
  using (auth.uid() = '25cb3724-02d4-4002-98b0-c93f74ef4e42')
  with check (auth.uid() = '25cb3724-02d4-4002-98b0-c93f74ef4e42');
