-- 40. lépés — új függvények ne örököljék a nyitott hívási jogot (csak a jövőbeli függvényekre hat).
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
notify pgrst, 'reload schema';
