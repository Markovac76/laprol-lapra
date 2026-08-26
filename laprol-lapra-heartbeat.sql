-- ============================================================================
-- LAPRÓL LAPRA — Supabase inaktivitás elleni védelem: heti "heartbeat"
-- Futtatás: Supabase SQL Editor. Idempotens: nyugodtan újrafuttatható.
--
-- ELŐFELTÉTEL: a `pg_cron` extension engedélyezve legyen ennél a projektnél.
-- Ez a script megpróbálja magától bekapcsolni (`create extension if not
-- exists pg_cron`) — ha ez a sor hibával elszáll ("permission denied" vagy
-- hasonló), előbb kapcsold be kézzel: Supabase Dashboard → Database →
-- Extensions → keresd meg a "pg_cron"-t → Enable. Utána futtasd újra
-- ezt a teljes scriptet.
--
-- Cél: a Supabase Free plan 7 nap inaktivitás (valódi adatbázis-írás
-- hiánya) után szüneteltet egy projektet — pusztán a Dashboard/app
-- megnyitása nem elég. Ez a mechanizmus HETENTE egyszer, magától ír egy
-- sort, hogy ez sose forduljon elő. Nincs benne Edge Function, pg_net
-- vagy külső titok — tisztán a Postgres motoron belül futó pg_cron +
-- egy egyszerű UPSERT végzi, mert ez az egyetlen dolog, amire szükség
-- van (nem kell hozzá email/riasztás/Storage, mint egy másik, hasonló
-- célú, de bonyolultabb projektben).
-- ============================================================================

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- 1) system_heartbeat — tisztán technikai, egysoros tábla.
--    RLS bekapcsolva, DE szándékosan NINCS rajta policy: a kliens (anon/
--    authenticated, tehát a böngésző/app) semmilyen hozzáférést nem kap
--    hozzá. Kizárólag a pg_cron (ami adatbázis-szuperjoggal fut, és így
--    az RLS-t megkerüli) éri el. Semmi köze a felhasználói adatokhoz.
-- ---------------------------------------------------------------------------
create table if not exists public.system_heartbeat (
  id        int primary key,
  pinged_at timestamptz not null default now(),
  constraint system_heartbeat_single_row check (id = 1)
);
alter table public.system_heartbeat enable row level security;

insert into public.system_heartbeat (id, pinged_at)
values (1, now())
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Heti ütemezés — minden vasárnap 03:17-kor (UTC), bőven a 7 napos
--    határidőn belül, így egy-egy kimaradt hét sem okoz problémát.
--    Előbb törli a régi, azonos nevű job-ot, ha van (idempotencia), majd
--    újra beütemezi — így a script bármikor biztonságosan újrafuttatható.
-- ---------------------------------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'weekly-heartbeat';

select cron.schedule(
  'weekly-heartbeat',
  '17 3 * * 0',
  $$
  insert into public.system_heartbeat (id, pinged_at)
  values (1, now())
  on conflict (id) do update set pinged_at = excluded.pinged_at;
  $$
);

-- Ellenőrzéshez, bármikor lefuttatható:
--   select * from cron.job where jobname = 'weekly-heartbeat';
--   select * from cron.job_run_details where jobid =
--     (select jobid from cron.job where jobname = 'weekly-heartbeat')
--     order by start_time desc limit 5;
-- Ha valaha törölni kellene: select cron.unschedule('weekly-heartbeat');

-- Kész.
