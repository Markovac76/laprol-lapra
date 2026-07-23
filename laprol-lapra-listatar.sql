-- ========== LAPRÓL LAPRA — közös listatár ==========
-- Egy tábla, több listatípusra: kiadó, komponens-típus, azonosító-típus, beszerzés forrása.
-- (A címkék helye fenn van tartva, de a logikát még nem szabványosítjuk.)

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipus text not null,          -- 'kiado' | 'komponens' | 'azonosito' | 'forras' | (később: 'cimke')
  ertek text not null,          -- a tárolt, kanonikus érték (pl. 'magazin')
  megjelenites text,            -- ahogy a felületen látszik (pl. 'Magazin')
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, tipus, ertek)
);

create index on public.lists (user_id, tipus, sort_order);

alter table public.lists enable row level security;
create policy "own lists" on public.lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== Kezdő értékek =====
do $$
declare uid uuid := '25cb3724-02d4-4002-98b0-c93f74ef4e42';
begin
  -- Kiadók: a meglévő sorozataidból
  insert into public.lists (user_id, tipus, ertek, megjelenites, sort_order)
  select distinct uid, 'kiado', kiado, kiado, 0
  from public.series where kiado is not null and kiado <> '';

  insert into public.lists (user_id, tipus, ertek, megjelenites, sort_order) values
    (uid,'kiado','egyeb','Egyéb',99),

    (uid,'komponens','magazin','Magazin',1),
    (uid,'komponens','modell','Modell',2),
    (uid,'komponens','konyv','Könyv',3),
    (uid,'komponens','egyeb','Egyéb',99),

    (uid,'azonosito','isbn','ISBN',1),
    (uid,'azonosito','issn','ISSN',2),
    (uid,'azonosito','vonalkod','Vonalkód',3),
    (uid,'azonosito','egyeb','Egyéb',99),

    (uid,'forras','elofizetes','Előfizetés',1),
    (uid,'forras','bolt','Bolt / újságos',2),
    (uid,'forras','bolhapiac','Bolhapiac',3),
    (uid,'forras','vatera','Vatera / online piactér',4),
    (uid,'forras','ajandek','Ajándék',5),
    (uid,'forras','egyeb','Egyéb',99)
  on conflict (user_id, tipus, ertek) do nothing;
end $$;

-- ===== Beszerzés forrása a számokhoz (opcionális mező) =====
alter table public.issues add column if not exists forras text;
