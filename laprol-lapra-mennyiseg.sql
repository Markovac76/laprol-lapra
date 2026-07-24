-- Mennyiség (db) a számhoz — több példány egy beszerzésből (pl. 4 magazin a melléklet miatt).
-- Beépül a belekerülési költség számításába: mennyiség × beszerzési ár.
alter table public.issues add column if not exists mennyiseg int not null default 1;
