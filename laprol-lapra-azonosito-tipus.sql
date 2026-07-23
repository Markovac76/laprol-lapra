-- Azonosító típusa (ISBN / ISSN / vonalkód / egyéb) a komponenshez
alter table public.components add column if not exists azonosito_tipus text;
