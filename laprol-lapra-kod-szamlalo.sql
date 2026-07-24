-- ========== Soha vissza nem forgó sorozat-kód számláló ==========
-- (5. hibajavítás: a kód eddig a lista pozíciójából jött, törlés után újra kiadódott)

alter table public.series add column if not exists kod_szam int;

create table if not exists public.counters (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_series_no int not null default 1
);
alter table public.counters enable row level security;
create policy "own counters" on public.counters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Meglévő sorozatok visszatöltése: a jelenlegi sorrend szerint kapnak kód-számot,
-- a számláló pedig a következő szabad értékre áll.
do $$
declare
  uid uuid := '25cb3724-02d4-4002-98b0-c93f74ef4e42';
  r record;
  i int := 1;
begin
  for r in select id from public.series where user_id = uid order by sort_order loop
    update public.series set kod_szam = i where id = r.id;
    i := i + 1;
  end loop;
  insert into public.counters (user_id, next_series_no) values (uid, i)
    on conflict (user_id) do update set next_series_no = excluded.next_series_no;
end $$;
