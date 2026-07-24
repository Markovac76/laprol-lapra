-- Komponensenkénti darabszám (élő készlet-számláló).
-- Pl. 4 magazin + 4 figura egy vásárlásból; később a figurákból 1 eltörik, 1 elcserélődik → 2 marad,
-- miközben a magazinokból csak 1 marad. A két komponens darabszáma külön él.
-- Ha a számláló 0-ra csökken, a komponens státusza automatikusan „hiányzik" lesz (az app kezeli).
alter table public.components add column if not exists db int not null default 1;
