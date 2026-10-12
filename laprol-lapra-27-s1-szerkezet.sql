-- ============================================================================
-- 27. lépés / S1 — SZERKEZET: típusleírás bővítése (fix azonosító-típus, mezőlista),
-- sorozat-szintű azonosítók (series.azonositok), a „Kész” ellenőrzés típus szerinti szabályai.
--
-- JÓVÁHAGYÁSRA VÁR — a tulajdonos kifejezett jóváhagyása nélkül NEM futtatható.
-- Futtatás: node scripts/run-migration.js laprol-lapra-27-s1-szerkezet.sql 27-s1-szerkezet
-- (backup → egyetlen tranzakció → COMMIT, hiba esetén ROLLBACK).
--
-- ADATOT NEM MÓDOSÍT a típusleíró táblán (component_type_defs) és egy új Listák-értéken
-- („Kártyakód” azonosító-típus) kívül: a sorozatok, Számok, komponensek, személyes adatok
-- érintetlenek. Az új oszlopok üres alapértékkel jönnek létre ('[]').
--
-- A 19. és a 22. lépés védelmei (csendes lapszám-változás, Számok törölt-jelölése, új Szám
-- komponens-létrehozása, fő elem, komponens-törlés, member_seen) SZÓ SZERINT megmaradnak: az
-- 5–10. pont függvényei az élő definícióból készültek, csak a megjelölt sorok újak
-- (függvényenkénti diff: 27-lepes-s1-s2-csomag.md).
-- ============================================================================


-- ============================================================================
-- 1. Típusleírás (component_type_defs): fix / választható azonosító-típus, család, mezőlista
-- ============================================================================
-- azonosito_mod:
--   'fix'          a típusnak EGY rögzített azonosító-típusa van (azonosito_tipusok[1]); a felületen nem szerkeszthető
--   'valaszthato'  az azonosító-típus az azonosito_tipusok listájából választható (kiadvány család: isbn / issn)
--   'nincs'        a típusnak nincs külön azonosítója (a név azonosít — figura, modell)
--   'szabad'       nincs megkötés (a Listák bármely azonosító-típusa — egyéb)
-- csalad: 'kiadvany' = magazin és könyv (azonos mezők, azonos azonosító-szabály).
alter table public.component_type_defs
  add column if not exists csalad            text,
  add column if not exists azonosito_mod     text   not null default 'szabad',
  add column if not exists azonosito_tipusok text[] not null default '{}';

-- A mezőlista (fields) eleme: {key, label, kind, szint?, lista?, szemelyes?, potlas?}
--   key    'azonosito_tipus' | 'azonosito' | 'megnevezes' → a komponens saját oszlopa; 'kep' | 'db' | 'jegyzet'
--          → a meglévő kép / személyes mezők; MINDEN MÁS kulcs a components.adatok (jsonb) kulcsa
--   kind   érték-típus: 'szoveg' | 'egesz' | 'lista' | 'kep'
--   szint  'kotelezo' | 'ajanlott' | 'opcionalis' (törzsadat-mezőknél; a személyes mezőknél nincs)
--   potlas 'szam_cime': ha a mező üres, megjelenítéskor a Szám címe számít (modell neve)
create or replace function public.component_type_fields_error(f jsonb)
returns text language plpgsql immutable set search_path = public as $$
declare e jsonb; keys text[] := '{}';
begin
  if f is null or jsonb_typeof(f) <> 'array' then return 'a mezőlista nem lista'; end if;
  for e in select * from jsonb_array_elements(f) loop
    if jsonb_typeof(e) <> 'object' then return 'a mezőlista eleme nem objektum'; end if;
    if coalesce(e->>'key', '') !~ '^[a-z][a-z0-9_]*$' then return 'hibás mezőkulcs: ' || coalesce(e->>'key', '(üres)'); end if;
    if coalesce(btrim(e->>'label'), '') = '' then return 'hiányzó címke: ' || (e->>'key'); end if;
    if coalesce(e->>'kind', '') not in ('szoveg', 'egesz', 'lista', 'kep') then return 'ismeretlen érték-típus: ' || (e->>'key'); end if;
    if e ? 'szint' and (e->>'szint') not in ('kotelezo', 'ajanlott', 'opcionalis') then return 'ismeretlen szint: ' || (e->>'key'); end if;
    if (e->>'key') = any(keys) then return 'kétszer szereplő mezőkulcs: ' || (e->>'key'); end if;
    keys := keys || (e->>'key');
  end loop;
  return null;
end $$;

-- A típusleírás tartalma (a közös végződés: kép + a két személyes mező).
with kozos(f) as (values ('[
    {"key":"kep","kind":"kep","label":"Kép"},
    {"key":"db","kind":"egesz","label":"Darabszám","szemelyes":true},
    {"key":"jegyzet","kind":"szoveg","label":"Jegyzet","szemelyes":true}]'::jsonb)),
uj(tipus, csalad, azonosito_mod, azonosito_tipusok, default_azonosito_tipus, sajat) as (values
  ('magazin', 'kiadvany', 'valaszthato', array['isbn','issn'], null, '[
    {"key":"azonosito_tipus","kind":"lista","label":"Azonosító típusa","lista":"azonosito","szint":"opcionalis"},
    {"key":"azonosito","kind":"szoveg","label":"Azonosító","szint":"opcionalis"},
    {"key":"megnevezes","kind":"szoveg","label":"Megnevezés","szint":"opcionalis"}]'::jsonb),
  ('konyv', 'kiadvany', 'valaszthato', array['isbn','issn'], 'isbn', '[
    {"key":"azonosito_tipus","kind":"lista","label":"Azonosító típusa","lista":"azonosito","szint":"opcionalis"},
    {"key":"azonosito","kind":"szoveg","label":"Azonosító","szint":"opcionalis"},
    {"key":"megnevezes","kind":"szoveg","label":"Megnevezés","szint":"opcionalis"}]'::jsonb),
  ('lego', null, 'fix', array['lego_kd'], 'lego_kd', '[
    {"key":"azonosito","kind":"szoveg","label":"Lego-kód","szint":"opcionalis"},
    {"key":"megnevezes","kind":"szoveg","label":"Megnevezés","szint":"opcionalis"}]'::jsonb),
  ('krtya', null, 'fix', array['kartya_kod'], 'kartya_kod', '[
    {"key":"gyarto","kind":"szoveg","label":"Gyártó","szint":"opcionalis"},
    {"key":"gyujtemeny","kind":"szoveg","label":"Gyűjtemény","szint":"kotelezo"},
    {"key":"szeria","kind":"szoveg","label":"Széria","szint":"opcionalis"},
    {"key":"kiadas_eve","kind":"egesz","label":"Kiadás éve","szint":"opcionalis"},
    {"key":"sorozatvaltozat","kind":"szoveg","label":"Sorozatváltozat","szint":"opcionalis"},
    {"key":"azonosito","kind":"szoveg","label":"Kód","szint":"kotelezo"},
    {"key":"megnevezes","kind":"szoveg","label":"Név","szint":"kotelezo"}]'::jsonb),
  ('figura', null, 'nincs', array[]::text[], null, '[
    {"key":"megnevezes","kind":"szoveg","label":"Név","szint":"kotelezo"}]'::jsonb),
  ('modell', null, 'nincs', array[]::text[], null, '[
    {"key":"megnevezes","kind":"szoveg","label":"Név","szint":"opcionalis","potlas":"szam_cime"}]'::jsonb),
  ('egyeb', null, 'szabad', array[]::text[], null, '[
    {"key":"azonosito_tipus","kind":"lista","label":"Azonosító típusa","lista":"azonosito","szint":"opcionalis"},
    {"key":"azonosito","kind":"szoveg","label":"Azonosító","szint":"opcionalis"},
    {"key":"megnevezes","kind":"szoveg","label":"Megnevezés","szint":"opcionalis"}]'::jsonb))
update public.component_type_defs t
   set csalad = uj.csalad, azonosito_mod = uj.azonosito_mod, azonosito_tipusok = uj.azonosito_tipusok,
       default_azonosito_tipus = uj.default_azonosito_tipus, fields = uj.sajat || kozos.f
  from uj, kozos
 where t.tipus = uj.tipus;

do $$
begin
  if (select count(*) from public.component_type_defs) <> 7
     or (select count(*) from public.component_type_defs where azonosito_mod = 'szabad') <> 1 then
    raise exception 'S1/1: a típusleíró tábla nem a várt 7 típust tartalmazza (vagy nem mind kapott szabályt) — megszakítva.';
  end if;
end $$;

alter table public.component_type_defs
  drop constraint if exists component_type_defs_azonosito_mod_check,
  add constraint component_type_defs_azonosito_mod_check check (
        azonosito_mod in ('fix', 'valaszthato', 'nincs', 'szabad')
    and (azonosito_mod <> 'fix'         or cardinality(azonosito_tipusok) = 1)
    and (azonosito_mod <> 'valaszthato' or cardinality(azonosito_tipusok) >= 2)
    and (azonosito_mod not in ('nincs', 'szabad') or cardinality(azonosito_tipusok) = 0)
    and (default_azonosito_tipus is null or azonosito_mod = 'szabad' or default_azonosito_tipus = any(azonosito_tipusok))
    and (csalad is null or csalad = 'kiadvany')),
  drop constraint if exists component_type_defs_fields_check,
  add constraint component_type_defs_fields_check check (public.component_type_fields_error(fields) is null);
-- (A component_type_defs_no_price megszorítás — ár soha nem lehet mező — változatlanul áll.)

-- A típusleírást csak migráció módosíthatja: az írási jogot az app szerepköreitől elvesszük
-- (eddig csak az RLS védte: nincs író policy; ez a második zár).
revoke insert, update, delete, truncate on public.component_type_defs from anon, authenticated;

-- A Kártya fix azonosító-típusa: új érték az „Azonosító típusa” listában.
insert into public.lists (user_id, tipus, ertek, megjelenites, sort_order)
select (select user_id from public.lists where tipus = 'azonosito' order by sort_order limit 1), 'azonosito', 'kartya_kod', 'Kártyakód', 6
 where not exists (select 1 from public.lists where tipus = 'azonosito' and ertek = 'kartya_kod');

-- A típushoz tartozó azonosító-típus új komponensnél: fix típusnál a rögzített; „nincs”-nél semmi;
-- egyébként a sorozat sablonjának alapértéke, ennek hiányában a típusleírásé. (Ismeretlen — a
-- Listákban később felvett — típusnál a sablon alapértéke vagy semmi.)
create or replace function public.type_azonosito_tipus(p_tipus text, p_tmpl jsonb)
returns text language sql stable set search_path = public as $$
  select case when t.azonosito_mod = 'fix'   then t.azonosito_tipusok[1]
              when t.azonosito_mod = 'nincs' then null
              else coalesce(
                     (select nullif(x->>'default_azonosito_tipus', '')
                        from jsonb_array_elements(case when jsonb_typeof(p_tmpl) = 'array' then p_tmpl else '[]'::jsonb end) x
                       where x->>'tipus' = p_tipus limit 1),
                     t.default_azonosito_tipus) end
    from (select 1) one left join public.component_type_defs t on t.tipus = p_tipus;
$$;
grant execute on function public.type_azonosito_tipus(text, jsonb), public.component_type_fields_error(jsonb) to authenticated;


-- ============================================================================
-- 2. Sorozat-szintű azonosítók: series.azonositok / draft_series.azonositok
-- ============================================================================
-- Lista, legfeljebb 2 elem; elem: {"tipus": "isbn" | "issn", "ertek": "…"}. Egyszer megadva az
-- egész sorozatra vonatkozik; a Számonkénti (egyedi) ISBN/ISSN a komponensen marad.
create or replace function public.series_azonositok_error(a jsonb)
returns text language plpgsql immutable set search_path = public as $$
declare e jsonb; seen text[] := '{}'; k text; v text;
begin
  if a is null or jsonb_typeof(a) <> 'array' then return 'a sorozat-azonosítók listája hibás formátumú'; end if;
  if jsonb_array_length(a) > 2 then return 'legfeljebb két sorozat-azonosító adható meg'; end if;
  for e in select * from jsonb_array_elements(a) loop
    if jsonb_typeof(e) <> 'object' or (e - 'tipus' - 'ertek') <> '{}'::jsonb then return 'a sorozat-azonosító eleme hibás formátumú'; end if;
    if coalesce(e->>'tipus', '') not in ('isbn', 'issn') then return 'a sorozat-azonosító típusa csak ISBN vagy ISSN lehet'; end if;
    if jsonb_typeof(e->'ertek') is distinct from 'string' or btrim(e->>'ertek') = '' then return 'a sorozat-azonosító értéke nem lehet üres'; end if;
    if (e->>'ertek') <> btrim(e->>'ertek') then return 'a sorozat-azonosító értéke elején vagy végén szóköz van'; end if;
    v := upper(regexp_replace(e->>'ertek', '[\s-]+', '', 'g'));
    if (e->>'tipus') = 'issn' and v !~ '^[0-9]{7}[0-9X]$' then
      return 'az ISSN 8 jegyű (pl. 1234-5678) — ez nem az: ' || (e->>'ertek'); end if;
    if (e->>'tipus') = 'isbn' and v !~ '^([0-9]{9}[0-9X]|[0-9]{13})$' then
      return 'az ISBN 10 vagy 13 jegyű (pl. 978-963-12-3456-7) — ez nem az: ' || (e->>'ertek'); end if;
    k := (e->>'tipus') || ':' || v;
    if k = any(seen) then return 'ugyanaz a sorozat-azonosító kétszer szerepel'; end if;
    seen := seen || k;
  end loop;
  return null;
end $$;
grant execute on function public.series_azonositok_error(jsonb) to authenticated;

alter table public.series       add column if not exists azonositok jsonb not null default '[]'::jsonb;
alter table public.draft_series add column if not exists azonositok jsonb not null default '[]'::jsonb;
alter table public.series
  drop constraint if exists series_azonositok_check,
  add constraint series_azonositok_check check (public.series_azonositok_error(azonositok) is null);
alter table public.draft_series
  drop constraint if exists draft_series_azonositok_check,
  add constraint draft_series_azonositok_check check (public.series_azonositok_error(azonositok) is null);


-- ============================================================================
-- 3–4. Típusleírás szerinti hiányok egy draftban (a „Kész” ellenőrzés és a figyelmeztetések közös forrása)
-- ============================================================================
-- Soronként egy hiány: kötelező mező üres, vagy az azonosító-típus nem felel meg a típusnak.
-- blokkol = igaz, ha a komponens ÚJ (nincs élő párja) vagy ebben a draftban MÓDOSULT (típus,
-- azonosító-típus, azonosító, megnevezés vagy a típus mezői eltérnek az élőtől); a meglévő, nem
-- módosított komponensnél hamis → csak figyelmeztetés. A törölt Számok / komponensek kimaradnak.
-- (Nem SECURITY DEFINER: közvetlen hívásnál a draft-táblák RLS-e — csak staff olvashat — érvényes.)
create or replace function public.draft_type_field_issues(p_draft_id uuid)
returns table (draft_component_id uuid, lapszam int, tipus text, tipus_nev text, kod text, uzenet text, blokkol boolean)
language sql stable set search_path = public as $$
  with dc as (
    select x.id, di.lapszam, x.tipus, x.azonosito_tipus, x.azonosito, x.megnevezes, x.adatok,
           (x.source_component_id is null or c.id is null
             or x.tipus is distinct from c.tipus or x.azonosito_tipus is distinct from c.azonosito_tipus
             or x.azonosito is distinct from c.azonosito or x.megnevezes is distinct from c.megnevezes
             or x.adatok is distinct from c.adatok) as valtozott,
           t.azonosito_mod, t.azonosito_tipusok, t.fields,
           coalesce((select l.megjelenites from public.lists l where l.tipus = 'komponens' and l.ertek = x.tipus limit 1), x.tipus) as tipus_nev
      from public.draft_components x
      join public.draft_issues di on di.id = x.draft_issue_id and di.draft_series_id = p_draft_id and not di.deleted
      join public.component_type_defs t on t.tipus = x.tipus
      left join public.components c on c.id = x.source_component_id
     where not x.deleted
  )
  select dc.id, dc.lapszam, dc.tipus, dc.tipus_nev, 'mezo_hianyzik'::text, 'hiányzik: ' || (f->>'label'), dc.valtozott
    from dc cross join lateral jsonb_array_elements(dc.fields) f
   where f->>'szint' = 'kotelezo'
     and coalesce(btrim(case f->>'key' when 'azonosito' then dc.azonosito
                                       when 'megnevezes' then dc.megnevezes
                                       else dc.adatok->>(f->>'key') end), '') = ''
  union all
  select dc.id, dc.lapszam, dc.tipus, dc.tipus_nev, 'azonosito_tipus'::text,
         case dc.azonosito_mod
           when 'nincs' then 'ennél a típusnál nincs külön azonosító (a név azonosít)'
           else 'az azonosító típusa csak ' || (select string_agg(coalesce((select l.megjelenites from public.lists l
                                                    where l.tipus = 'azonosito' and l.ertek = a.t limit 1), a.t), ' vagy ' order by a.o)
                                                  from unnest(dc.azonosito_tipusok) with ordinality a(t, o)) || ' lehet'
         end, dc.valtozott
    from dc
   where coalesce(btrim(dc.azonosito), '') <> ''
     and (dc.azonosito_mod = 'nincs'
          or (dc.azonosito_mod in ('fix', 'valaszthato') and not coalesce(dc.azonosito_tipus = any(dc.azonosito_tipusok), false)));
$$;
grant execute on function public.draft_type_field_issues(uuid) to authenticated;

-- ============================================================================
-- 5. start_edit_draft — az élő definíció + a sorozat-azonosítók másolása a draftba
-- ============================================================================
CREATE OR REPLACE FUNCTION public.start_edit_draft(p_series_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s    public.series%rowtype;
  d_id uuid;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod szerkesztést indítani.';
  end if;

  select * into s from public.series where id = p_series_id for update;
  if not found then
    raise exception 'A sorozat nem található.';
  end if;
  if s.lifecycle <> 'active' then
    raise exception 'Szerkesztés csak aktív (publikált) sorozaton indítható — ez a sorozat nem aktív (állapota: %).',
      case s.lifecycle when 'unpublished' then 'publikálatlan' else s.lifecycle end;
  end if;
  if s.force_delete_requested_at is not null then
    raise exception 'Ez a sorozat törlésre jelölt — a türelmi idő alatt nem szerkeszthető.';
  end if;
  if exists (select 1 from public.draft_series
              where source_series_id = p_series_id and pool_type = 'edit') then
    raise exception 'Ehhez a sorozathoz már van nyitott szerkesztési munkaanyag — nézd meg a Karbantartás „Munka sorozatok” fülén.';
  end if;

  insert into public.draft_series (pool_type, pool_status, source_series_id, submitted_by,
                                   claimed_by, claimed_at, kiado, megnevezes, megjelenites,
                                   szin, kategoria, components, component_template, azonositok)
  values ('edit', 'claimed', p_series_id, auth.uid(), auth.uid(), now(),
          s.kiado, s.megnevezes, s.megjelenites, s.szin, s.kategoria, s.components, s.component_template, s.azonositok)
  returning id into d_id;

  insert into public.draft_issues (draft_series_id, source_issue_id, lapszam, cim, megjelenes, eredeti_ar)
  select d_id, i.id, i.lapszam, i.cim, i.megjelenes, i.eredeti_ar
    from public.issues i
   where i.series_id = p_series_id and not i.is_deleted;

  insert into public.draft_components (draft_issue_id, source_component_id, tipus, azonosito_tipus, azonosito, megnevezes, is_main, adatok)
  select di.id, c.id, c.tipus, c.azonosito_tipus, c.azonosito, c.megnevezes, c.is_main, c.adatok
    from public.components c
    join public.draft_issues di on di.source_issue_id = c.issue_id
   where di.draft_series_id = d_id and not c.is_deleted;

  return d_id;
end;
$function$;
grant execute on function public.start_edit_draft(uuid) to authenticated;

-- ============================================================================
-- 6. apply_draft_upload — sorozat-azonosítók, a típus mezői (adatok), típus szerinti azonosító-típus
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_draft_upload(p_draft_id uuid, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d          public.draft_series%rowtype;
  it         jsonb;
  cp         jsonb;
  did        text;
  iid        uuid;
  cid        uuid;
  conf       jsonb;
  is_new     boolean;
  n_new      int := 0;
  n_upd      int := 0;
  n_cnew     int := 0;
  n_cupd     int := 0;
  n_cauto    int := 0;
  n_k        int := 0;
  n_del      int := 0;
  tmpl       jsonb;
  aerr       text;
  n_saz      int := 0;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod ehhez a művelethez.';
  end if;
  select * into d from public.draft_series where id = p_draft_id for update;
  if not found then raise exception 'A munkaanyag nem található.'; end if;
  if d.pool_status <> 'claimed' then
    raise exception 'Ez a munkaanyag nem „Munkaanyag” állapotban van, a feltöltés nem alkalmazható.';
  end if;
  if d.claimed_by is distinct from auth.uid() and public.my_role() <> 'owner' then
    raise exception 'Csak a munkaanyagot lefoglaló admin vagy a tulajdonos tölthet fel sablont.';
  end if;
  tmpl := case when d.component_template is not null and jsonb_typeof(d.component_template) = 'array'
                    and jsonb_array_length(d.component_template) > 0
               then d.component_template else public.default_component_template(d.components) end;

  -- Sorozat-szintű azonosítók (ha a feltöltés hozza): a teljes lista cseréje, ellenőrzéssel.
  if p_payload ? 'sorozat_azonositok' then
    aerr := public.series_azonositok_error(p_payload->'sorozat_azonositok');
    if aerr is not null then
      raise exception 'A feltöltés nem alkalmazható: a sorozat-azonosítók érvénytelenek — %', aerr;
    end if;
    update public.draft_series set azonositok = p_payload->'sorozat_azonositok'
     where id = p_draft_id and azonositok is distinct from p_payload->'sorozat_azonositok';
    get diagnostics n_saz = row_count;
  end if;

  for it in select * from jsonb_array_elements(coalesce(p_payload->'items','[]'::jsonb)) loop
    if nullif(it->>'id','') is not null then
      -- meglévő draft-tétel: csak a payloadban SZEREPLŐ mezők módosulnak
      is_new := false;
      iid := (it->>'id')::uuid;
      update public.draft_issues set
        lapszam    = case when it ? 'lapszam'    then (it->>'lapszam')::int         else lapszam    end,
        cim        = case when it ? 'cim'        then it->>'cim'                    else cim        end,
        megjelenes = case when it ? 'megjelenes' then (it->>'megjelenes')::date     else megjelenes end,
        eredeti_ar = case when it ? 'eredeti_ar' then (it->>'eredeti_ar')::int      else eredeti_ar end,
        deleted    = case when it ? 'deleted'    then (it->>'deleted')::boolean     else deleted    end
      where id = iid and draft_series_id = p_draft_id;
      if not found then
        raise exception 'A feltöltésben ismeretlen tétel-azonosító szerepel (%) — a sablon másik munkaanyagból vagy elavult állapotból származik.', iid;
      end if;
      n_upd := n_upd + 1;
    else
      -- új draft-tétel (az azonosítót a kliens generálja, így az újrapróbálás nem duplikál)
      is_new := true;
      iid := (it->>'new_id')::uuid;
      insert into public.draft_issues (id, draft_series_id, lapszam, cim, megjelenes, eredeti_ar)
      values (iid, p_draft_id, (it->>'lapszam')::int, it->>'cim',
              nullif(it->>'megjelenes','')::date, nullif(it->>'eredeti_ar','')::int);
      n_new := n_new + 1;
    end if;

    for cp in select * from jsonb_array_elements(coalesce(it->'comps','[]'::jsonb)) loop
      if nullif(cp->>'id','') is not null then
        cid := (cp->>'id')::uuid;
        update public.draft_components set
          azonosito  = case when cp ? 'azonosito'  then nullif(cp->>'azonosito','')  else azonosito  end,
          megnevezes = case when cp ? 'megnevezes' then nullif(cp->>'megnevezes','') else megnevezes end,
          -- azonosító érkezik, de a komponensnek még nincs azonosító-típusa: a típus szerinti (fix / alap)
          azonosito_tipus = case when cp ? 'azonosito' and nullif(cp->>'azonosito','') is not null and azonosito_tipus is null
                                 then public.type_azonosito_tipus(tipus, tmpl) else azonosito_tipus end,
          -- a típus saját mezői (pl. Kártya: gyűjtemény, széria…): a megadott kulcsok felülírnak, a többi marad
          adatok     = case when jsonb_typeof(cp->'adatok') = 'object' then jsonb_strip_nulls(adatok || (cp->'adatok')) else adatok end
        where id = cid and draft_issue_id = iid;
        if not found then
          raise exception 'A feltöltésben ismeretlen komponens-azonosító szerepel (%).', cid;
        end if;
        n_cupd := n_cupd + 1;
      else
        insert into public.draft_components (draft_issue_id, tipus, azonosito_tipus, azonosito, megnevezes, adatok, source_component_id)
        values (iid, cp->>'tipus', public.type_azonosito_tipus(cp->>'tipus', tmpl), nullif(cp->>'azonosito',''), nullif(cp->>'megnevezes',''),
                case when jsonb_typeof(cp->'adatok') = 'object' then jsonb_strip_nulls(cp->'adatok') else '{}'::jsonb end, null);
        n_cnew := n_cnew + 1;
      end if;
    end loop;

    -- ÚJ Számnál a sorozat minden deklarált komponens-típusából legyen
    -- legalább egy (üres) példány — mint a kézi szerkesztőben. A payload által
    -- már létrehozott típusokat nem duplikálja.
    if is_new then
      -- a sorozat komponens-sablonjának KÖTELEZŐ típusaiból (az opcionálisakból nem),
      -- a sablon alapértelmezett azonosító-típusával / megnevezésével
      insert into public.draft_components (draft_issue_id, tipus, azonosito_tipus, azonosito, megnevezes, source_component_id)
      select iid, x.t->>'tipus', public.type_azonosito_tipus(x.t->>'tipus', tmpl), null, nullif(x.t->>'default_megnevezes',''), null
        from jsonb_array_elements(tmpl) with ordinality as x(t, ord)
       where coalesce((x.t->>'required')::boolean, true)
         and not exists (select 1 from public.draft_components dc
                          where dc.draft_issue_id = iid and dc.tipus = x.t->>'tipus' and not dc.deleted)
       order by x.ord;
      get diagnostics n_k = row_count;
      n_cauto := n_cauto + n_k;
      -- az új Számnak legyen fő eleme (tartalék szabály: magazin, könyv, első)
      perform public.ensure_draft_main(iid);
    end if;
  end loop;

  -- A fájlból hiányzó, a felhasználó által KIFEJEZETTEN törlésre jelölt tételek.
  -- Élő párral rendelkezőt nem törlünk fizikailag (a publikálás soft-delete-eli);
  -- csak az új (élő pár nélküli) draft-tétel törölhető fizikailag.
  for did in select jsonb_array_elements_text(coalesce(p_payload->'delete_ids','[]'::jsonb)) loop
    iid := did::uuid;
    update public.draft_issues set deleted = true
     where id = iid and draft_series_id = p_draft_id and source_issue_id is not null;
    if not found then
      delete from public.draft_issues
       where id = iid and draft_series_id = p_draft_id and source_issue_id is null;
    end if;
    n_del := n_del + 1;
  end loop;

  -- (A korábbi viselkedés — a nem deklarált típus a sorozat komponens-listájára kerül —
  -- megszűnt: a sorozat sablonjában nem szereplő típus csak az adott Szám komponense marad.)

  -- Végső védelem: a feltöltés utáni állapotban nem lehet lapszám-ütközés.
  conf := public.draft_lapszam_conflicts(p_draft_id, '[]'::jsonb);
  if jsonb_array_length(conf) > 0 then
    raise exception E'A feltöltés nem alkalmazható: ütköző lapszámok maradnának.\n\n%\n\nA munkaanyag nem változott.',
      public.draft_conflicts_text(conf);
  end if;

  return jsonb_build_object('uj', n_new, 'frissitett', n_upd, 'uj_komponens', n_cnew,
                            'frissitett_komponens', n_cupd, 'auto_komponens', n_cauto, 'torolt', n_del,
                            'sorozat_azonositok', n_saz);
end;
$function$;
grant execute on function public.apply_draft_upload(uuid, jsonb) to authenticated;

-- ============================================================================
-- 7. propose_bulk_issues — típus szerinti azonosító-típus és a típus mezői az új-sorozat javaslatnál
-- ============================================================================
CREATE OR REPLACE FUNCTION public.propose_bulk_issues(p_draft_id uuid, p_rows jsonb)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d             public.draft_series%rowtype;
  row_data      jsonb;
  comp          jsonb;
  new_issue_id  uuid;
  existing_nums int[];
  lsz           int;
  inserted      int := 0;
  skipped       int := 0;
begin
  select * into d from public.draft_series where id = p_draft_id;
  if not found then raise exception 'A javaslat nem található.'; end if;
  if d.submitted_by is distinct from auth.uid() then
    raise exception 'Csak a saját javaslatodhoz tölthetsz fel sablont.';
  end if;
  if d.pool_type <> 'new' or d.pool_status <> 'incoming' or d.claimed_by is not null then
    raise exception 'Ez a javaslat már feldolgozás alatt van — a tömeges feltöltés csak beküldés után, a staff általi átvétel előtt lehetséges.';
  end if;

  select array_agg(lapszam) into existing_nums from public.draft_issues where draft_series_id = p_draft_id;

  for row_data in select * from jsonb_array_elements(p_rows) loop
    lsz := (row_data->>'lapszam')::int;
    if existing_nums is not null and lsz = any(existing_nums) then
      skipped := skipped + 1; continue;
    end if;
    insert into public.draft_issues (draft_series_id, lapszam, cim, megjelenes, eredeti_ar)
    values (p_draft_id, lsz, row_data->>'cim',
            nullif(row_data->>'megjelenes','')::date, (row_data->>'eredeti_ar')::int)
    returning id into new_issue_id;
    for comp in select * from jsonb_array_elements(coalesce(row_data->'comps','[]'::jsonb)) loop
      insert into public.draft_components (draft_issue_id, tipus, azonosito_tipus, azonosito, megnevezes, adatok, source_component_id)
      values (new_issue_id, comp->>'tipus', public.type_azonosito_tipus(comp->>'tipus', d.component_template),
              nullif(comp->>'azonosito',''), nullif(comp->>'megnevezes',''),
              case when jsonb_typeof(comp->'adatok') = 'object' then jsonb_strip_nulls(comp->'adatok') else '{}'::jsonb end, null);
    end loop;
    existing_nums := array_append(existing_nums, lsz);
    inserted := inserted + 1;
  end loop;

  return json_build_object('inserted', inserted, 'skipped', skipped);
end;
$function$;
grant execute on function public.propose_bulk_issues(uuid, jsonb) to authenticated;

-- ============================================================================
-- 8. mark_draft_ready — sorozat-azonosítók ellenőrzése; típusleírás szerinti kötelező mezők (új / módosított: blokkol)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_draft_ready(p_draft_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d         public.draft_series%rowtype;
  conf      jsonb;
  n_missing int;
  lst       text;
  n_main    int;
  tmpl      jsonb;
  terr      text;
  n_azon    int;
  aerr      text;
  n_mezo    int;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod ehhez a művelethez.';
  end if;
  select * into d from public.draft_series where id = p_draft_id for update;
  if not found then raise exception 'A munkaanyag nem található.'; end if;
  if d.pool_status <> 'claimed' then
    raise exception 'Ez a munkaanyag nem „Munkaanyag” állapotban van — frissítsd a Karbantartás nézetet.';
  end if;
  if d.claimed_by is distinct from auth.uid() and public.my_role() <> 'owner' then
    raise exception 'Csak a munkaanyagot lefoglaló admin vagy a tulajdonos állíthatja Kész-re.';
  end if;

  -- Komponens-sablon: üres sablonnál (régi szerkesztő) az alapértelmezett lép be, utána ellenőrzés.
  tmpl := d.component_template;
  if tmpl is null or jsonb_typeof(tmpl) <> 'array' or jsonb_array_length(tmpl) = 0 then
    tmpl := public.default_component_template(d.components);
    update public.draft_series set component_template = tmpl where id = p_draft_id;
  end if;
  terr := public.component_template_error(tmpl);
  if terr is not null then
    raise exception E'A munkaanyag nem állítható „Kész”-re: a komponens-sablon érvénytelen.\n\n%', terr;
  end if;

  -- Sorozat-szintű azonosítók (ISBN/ISSN, legfeljebb 2): érték- és darabszám-ellenőrzés.
  aerr := public.series_azonositok_error(d.azonositok);
  if aerr is not null then
    raise exception E'A munkaanyag nem állítható „Kész”-re: a sorozat-azonosítók érvénytelenek.\n\n%\n\nTeendő: javítsd a sorozat szerkesztőjében a „Sorozat-azonosítók” szakaszt.', aerr;
  end if;

  -- Komponens nélküli ÚJ Számok
  select count(*) into n_missing
    from public.draft_issues di
   where di.draft_series_id = p_draft_id and di.source_issue_id is null and not di.deleted
     and not exists (select 1 from public.draft_components dc where dc.draft_issue_id = di.id);
  if n_missing > 0 then
    select string_agg('#' || x.lapszam || ' „' || coalesce(nullif(btrim(x.cim), ''), 'cím nélkül') || '”', ', ' order by x.lapszam)
      into lst
      from (select di.lapszam, di.cim
              from public.draft_issues di
             where di.draft_series_id = p_draft_id and di.source_issue_id is null and not di.deleted
               and not exists (select 1 from public.draft_components dc where dc.draft_issue_id = di.id)
             order by di.lapszam
             limit 10) x;
    raise exception E'A munkaanyag nem állítható „Kész”-re: % nincs egyetlen komponense sem — a publikálás komponens nélküli Számot hozna létre, amelyen sem azonosító, sem státusz nem állítható.\n\n%\n\nTeendő: nyisd meg az érintett Számot a szerkesztőben, és adj hozzá legalább egy komponenst („+ Még egy … hozzáadása”), vagy töltsd fel újra a sablont (az új sorokhoz a sorozat komponensei automatikusan létrejönnek), majd próbáld újra.',
      n_missing || ' új Számnak',
      lst || case when n_missing > 10 then ' … (és még ' || (n_missing - 10) || ')' else '' end;
  end if;

  -- KÖTELEZŐ azonosítójú típus: az ÚJ Számok és az ebben a draftban hozzáadott komponensek
  -- azonosító nélkül nem mehetnek Kész-re (a meglévő, nem módosított komponensek hiánya csak
  -- figyelmeztetés — draft_ready_warnings).
  select count(*) into n_azon
    from public.draft_components dc
    join public.draft_issues di on di.id = dc.draft_issue_id
   where di.draft_series_id = p_draft_id and not di.deleted and not dc.deleted and dc.source_component_id is null
     and coalesce(btrim(dc.azonosito), '') = ''
     and dc.tipus in (select x->>'tipus' from jsonb_array_elements(tmpl) x where x->>'id_rule' = 'kotelezo');
  if n_azon > 0 then
    select string_agg('#' || y.lapszam || ' (' || y.nev || ')', ', ' order by y.lapszam, y.nev)
      into lst
      from (select di.lapszam,
                   coalesce((select l.megjelenites from public.lists l where l.tipus = 'komponens' and l.ertek = dc.tipus limit 1), dc.tipus) as nev
              from public.draft_components dc
              join public.draft_issues di on di.id = dc.draft_issue_id
             where di.draft_series_id = p_draft_id and not di.deleted and not dc.deleted and dc.source_component_id is null
               and coalesce(btrim(dc.azonosito), '') = ''
               and dc.tipus in (select x->>'tipus' from jsonb_array_elements(tmpl) x where x->>'id_rule' = 'kotelezo')
             order by di.lapszam limit 10) y;
    raise exception E'A munkaanyag nem állítható „Kész”-re: % kötelező azonosító nélkül van.\n\n%\n\nTeendő: add meg az azonosítót az érintett komponenseken, vagy állítsd a sablonban „ajánlott”-ra az azonosító-szabályt.',
      n_azon || ' komponens', lst || case when n_azon > 10 then ' … (és még ' || (n_azon - 10) || ')' else '' end;
  end if;

  -- TÍPUSLEÍRÁS (component_type_defs) szerinti kötelező mezők és az azonosító-típus szabálya:
  -- az ÚJ és az ebben a draftban MÓDOSÍTOTT komponenseken blokkol; a meglévő, nem módosított
  -- komponensek hiánya csak figyelmeztetés (draft_ready_warnings).
  select count(distinct f.draft_component_id) into n_mezo
    from public.draft_type_field_issues(p_draft_id) f where f.blokkol;
  if n_mezo > 0 then
    select string_agg(y.sor, E'\n' order by y.lapszam, y.sor) into lst
      from (select f.lapszam, '#' || f.lapszam || ' ' || f.tipus_nev || ' — ' || string_agg(f.uzenet, '; ' order by f.uzenet) as sor
              from public.draft_type_field_issues(p_draft_id) f
             where f.blokkol
             group by f.draft_component_id, f.lapszam, f.tipus_nev
             order by f.lapszam limit 10) y;
    raise exception E'A munkaanyag nem állítható „Kész”-re: % adata hiányos vagy nem felel meg a típusának.\n\n%\n\nTeendő: nyisd meg az érintett Számot a szerkesztőben, és pótold a kötelező mezőket, illetve állítsd be a típushoz tartozó azonosító-típust. (A korábban felvitt, most nem módosított komponensek hiánya nem akadály, azokról csak figyelmeztetés jön.)',
      n_mezo || ' új vagy módosított komponens', lst || case when n_mezo > 10 then E'\n… (és még ' || (n_mezo - 10) || ')' else '' end;
  end if;

  -- Egy Számnak mindig marad legalább egy nem törölt komponense (a fő elem pedig nem törölhető —
  -- a megszorítás a táblán is áll).
  select count(*) into n_missing
    from public.draft_issues di
   where di.draft_series_id = p_draft_id and not di.deleted
     and exists (select 1 from public.draft_components x where x.draft_issue_id = di.id)
     and not exists (select 1 from public.draft_components x where x.draft_issue_id = di.id and not x.deleted);
  if n_missing > 0 then
    select string_agg('#' || y.lapszam || ' „' || coalesce(nullif(btrim(y.cim), ''), 'cím nélkül') || '”', ', ' order by y.lapszam)
      into lst
      from (select di.lapszam, di.cim from public.draft_issues di
             where di.draft_series_id = p_draft_id and not di.deleted
               and exists (select 1 from public.draft_components x where x.draft_issue_id = di.id)
               and not exists (select 1 from public.draft_components x where x.draft_issue_id = di.id and not x.deleted)
             order by di.lapszam limit 10) y;
    raise exception E'A munkaanyag nem állítható „Kész”-re: % minden komponense törlésre van jelölve.\n\n%\n\nTeendő: egy Számnak legalább egy komponensének megmaradnia — vond vissza a törlés-jelölést.',
      n_missing || ' Számon', lst;
  end if;

  -- Fő elem (★): ahol van komponens, de nincs kijelölve, a tartalék szabály szerint
  -- kijelöli (magazin, könyv, első); utána minden nem törölt Számon, amelyiken van
  -- komponens, PONTOSAN egy fő elem kell.
  perform public.ensure_draft_main(di.id)
     from public.draft_issues di where di.draft_series_id = p_draft_id and not di.deleted;
  select count(*) into n_main
    from public.draft_issues di
   where di.draft_series_id = p_draft_id and not di.deleted
     and exists (select 1 from public.draft_components x where x.draft_issue_id = di.id and not x.deleted)
     and (select count(*) from public.draft_components x where x.draft_issue_id = di.id and x.is_main and not x.deleted) <> 1;
  if n_main > 0 then
    select string_agg('#' || x.lapszam || ' „' || coalesce(nullif(btrim(x.cim), ''), 'cím nélkül') || '”', ', ' order by x.lapszam)
      into lst
      from (select di.lapszam, di.cim from public.draft_issues di
             where di.draft_series_id = p_draft_id and not di.deleted
               and exists (select 1 from public.draft_components x where x.draft_issue_id = di.id and not x.deleted)
               and (select count(*) from public.draft_components x where x.draft_issue_id = di.id and x.is_main and not x.deleted) <> 1
             order by di.lapszam limit 10) x;
    raise exception E'A munkaanyag nem állítható „Kész”-re: % nem pontosan egy fő elem (★) van.\n\n%\n\nTeendő: a Szám szerkesztőjében jelölj ki pontosan egy komponenst fő elemnek.',
      n_main || ' Számon', lst;
  end if;

  conf := public.draft_lapszam_conflicts(p_draft_id, '[]'::jsonb);
  if jsonb_array_length(conf) > 0 then
    raise exception E'A munkaanyag nem állítható „Kész”-re: a publikálás után több nem törölt Szám ugyanazt a lapszámot kapná.\n\n%\n\nJavítsd a lapszámokat, vagy jelöld törlésre az élő Számot, majd próbáld újra.',
      public.draft_conflicts_text(conf);
  end if;

  update public.draft_series set pool_status = 'ready', ready_at = now() where id = p_draft_id;
end;
$function$;
grant execute on function public.mark_draft_ready(uuid) to authenticated;

-- ============================================================================
-- 9. publish_draft_series — sorozat-azonosítók átvezetése (CSENDES, mint a sablon); minden korábbi védelem szó szerint
-- ============================================================================
CREATE OR REPLACE FUNCTION public.publish_draft_series(p_draft_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  dup_list    text;
  lapszam_changed boolean;
  main_list   text;
  tmpl        jsonb;
  terr        text;
  tmpl_types  text[];
  aerr        text;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod publikálni.';
  end if;

  select * into d from public.draft_series where id = p_draft_id for update;
  if not found then raise exception 'A draft nem található.'; end if;
  if d.pool_status <> 'ready' then
    raise exception 'Ez a munkaanyag már nem „Publikálásra váró” állapotban van (közben visszaadták szerkesztésre?) — frissítsd a Karbantartás nézetet.';
  end if;

  -- Komponens-sablon: üres (régi szerkesztő) → alapértelmezett a komponens-listából; ha a lista
  -- és a sablon típus-készlete eltér (régi szerkesztő csak a listát módosította) → a sablon igazodik.
  tmpl := d.component_template;
  if tmpl is null or jsonb_typeof(tmpl) <> 'array' or jsonb_array_length(tmpl) = 0 then
    tmpl := public.default_component_template(d.components);   -- üres sablon (régi propose-út): alapértelmezett
  end if;
  terr := public.component_template_error(tmpl);
  if terr is not null then
    raise exception 'A publikálás nem lehetséges: a komponens-sablon érvénytelen — %', terr;
  end if;
  select array_agg(x->>'tipus' order by o) into tmpl_types from jsonb_array_elements(tmpl) with ordinality as t(x, o);
  d.components := tmpl_types;          -- a sorozat komponens-listája a sablon típusainak listája (kompatibilitás)
  d.component_template := tmpl;

  -- Sorozat-szintű azonosítók (ISBN/ISSN, legfeljebb 2): érték- és darabszám-ellenőrzés.
  aerr := public.series_azonositok_error(d.azonositok);
  if aerr is not null then
    raise exception 'A publikálás nem lehetséges: a sorozat-azonosítók érvénytelenek — %', aerr;
  end if;

  if d.pool_type = 'new' then
    insert into public.series (kiado, megnevezes, megjelenites, szin, kategoria, components, component_template, azonositok, sort_order, kod_szam, lifecycle, version)
    values (d.kiado, d.megnevezes, d.megjelenites, d.szin, d.kategoria, d.components, d.component_template, d.azonositok,
            (select count(*) from public.series), public.next_series_no(), 'active', 1)
    returning id into live_series_id;
  else
    live_series_id := d.source_series_id;
    select * into s_row from public.series where id = live_series_id;
    if not found then raise exception 'A forrás-sorozat már nem létezik.'; end if;
    if s_row.force_delete_requested_at is not null then
      raise exception 'Ez a sorozat törlésre jelölve — publikálás nem lehetséges, amíg a törlési folyamat fut.';
    end if;
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
    if d.kategoria is distinct from s_row.kategoria then
      perform public.log_field_change('series', live_series_id, 'kategoria', s_row.kategoria, d.kategoria, new_v); changed := true;
    end if;
    if (select array_agg(x order by x) from unnest(d.components) x)
       is distinct from (select array_agg(x order by x) from unnest(s_row.components) x) then
      perform public.log_field_change('series', live_series_id, 'components',
        array_to_string(s_row.components,','), array_to_string(d.components,','), new_v); changed := true;
    end if;
    if changed then
      update public.series set kiado=d.kiado, megnevezes=d.megnevezes, megjelenites=d.megjelenites,
        szin=d.szin, kategoria=d.kategoria, components=d.components, version=new_v where id = live_series_id;
    end if;
    -- A komponens-sablon változása CSENDES (nincs verzióemelés), a change_log rögzíti; csak az ÚJ
    -- Számok/komponensek kiindulása — a meglévőket nem módosítja.
    if d.component_template is distinct from s_row.component_template then
      perform public.log_field_change('series', live_series_id, 'component_template',
                                      s_row.component_template::text, d.component_template::text,
                                      case when changed then new_v else s_row.version end);
      update public.series set component_template = d.component_template where id = live_series_id;
    end if;
    -- A sorozat-szintű azonosítók változása is CSENDES (mint a sablon): a change_log rögzíti,
    -- nincs verzióemelés / felkiáltójel.
    if d.azonositok is distinct from s_row.azonositok then
      perform public.log_field_change('series', live_series_id, 'azonositok',
                                      s_row.azonositok::text, d.azonositok::text,
                                      case when changed then new_v else s_row.version end);
      update public.series set azonositok = d.azonositok where id = live_series_id;
    end if;
    update public.series set force_delete_requested_at=null, force_delete_by=null, force_delete_grace_end=null
      where id = live_series_id and force_delete_requested_at is not null;
  end if;

  for di in select * from public.draft_issues where draft_series_id = d.id order by lapszam loop
    if di.source_issue_id is not null then
      select * into i_row from public.issues where id = di.source_issue_id;
      live_issue_id := di.source_issue_id;
      new_v := i_row.version + 1;

      if di.deleted then
        if not i_row.is_deleted then
          perform public.log_field_change('issue', live_issue_id, 'is_deleted', 'false', 'true', new_v);
          update public.issues set is_deleted = true, version = new_v where id = live_issue_id;
        end if;
        continue; -- törölt tételnél a komponensei nem frissülnek
      end if;

      changed := false;   -- TARTALMI változás (cím/dátum/ár) — ez emeli a verziót
      lapszam_changed := di.lapszam is distinct from i_row.lapszam;
      if di.cim is distinct from i_row.cim then
        perform public.log_field_change('issue', live_issue_id, 'cim', i_row.cim, di.cim, new_v); changed := true;
      end if;
      if di.megjelenes is distinct from i_row.megjelenes then
        perform public.log_field_change('issue', live_issue_id, 'megjelenes', i_row.megjelenes::text, di.megjelenes::text, new_v); changed := true;
      end if;
      if di.eredeti_ar is distinct from i_row.eredeti_ar then
        perform public.log_field_change('issue', live_issue_id, 'eredeti_ar', i_row.eredeti_ar::text, di.eredeti_ar::text, new_v); changed := true;
      end if;
      -- A puszta lapszám-változás (átszámozás) CSENDES: a change_log rögzíti, de a
      -- verzió nem emelkedik, így a felhasználóknál nincs tételenkénti felkiáltójel
      -- (egy tömeges átszámozás ne árassza el őket). Tartalmi változás mellett a
      -- lapszám-diff a szokásos módon, az új verzióval jelenik meg.
      if lapszam_changed then
        perform public.log_field_change('issue', live_issue_id, 'lapszam', i_row.lapszam::text, di.lapszam::text,
                                        case when changed then new_v else i_row.version end);
      end if;
      if changed or lapszam_changed then
        update public.issues set lapszam=di.lapszam, cim=di.cim, megjelenes=di.megjelenes, eredeti_ar=di.eredeti_ar,
               version = case when changed then new_v else i_row.version end
          where id = live_issue_id;
      end if;
    else
      if di.deleted then
        continue; -- sosem publikált, törlésre jelölt új tétel — egyszerűen kimarad
      end if;
      insert into public.issues (series_id, lapszam, cim, megjelenes, eredeti_ar, version)
      values (live_series_id, di.lapszam, di.cim, di.megjelenes, di.eredeti_ar, 1)
      returning id into live_issue_id;
    end if;

    for dc in select * from public.draft_components where draft_issue_id = di.id loop
      if dc.source_component_id is not null then
        select * into c_row from public.components where id = dc.source_component_id;
        -- Törölt-jelölés (a Számoknál használt minta szerint): a személyes adatok (member_status,
        -- jegyzet, darabszám) megmaradnak, a komponens visszaállítható. CSENDES: a change_log
        -- rögzíti, de nincs verzióemelés / felkiáltójel. A fő elem nem törölhető (a draftban a
        -- törölt komponens sosem fő elem; a megszorítás a táblán is áll).
        if dc.deleted then
          if not c_row.is_deleted then
            perform public.log_field_change('component', dc.source_component_id, 'is_deleted', 'false', 'true', c_row.version);
            if c_row.is_main then
              perform public.log_field_change('component', dc.source_component_id, 'is_main', 'true', 'false', c_row.version);
            end if;
            update public.components set is_deleted = true, is_main = false where id = dc.source_component_id;
          end if;
          continue;
        elsif c_row.is_deleted then
          perform public.log_field_change('component', dc.source_component_id, 'is_deleted', 'true', 'false', c_row.version);
          update public.components set is_deleted = false where id = dc.source_component_id;
        end if;
        new_v := c_row.version + 1;
        changed := false;
        if dc.tipus is distinct from c_row.tipus then
          perform public.log_field_change('component', dc.source_component_id, 'tipus', c_row.tipus, dc.tipus, new_v); changed := true;
        end if;
        if dc.azonosito_tipus is distinct from c_row.azonosito_tipus then
          perform public.log_field_change('component', dc.source_component_id, 'azonosito_tipus', c_row.azonosito_tipus, dc.azonosito_tipus, new_v); changed := true;
        end if;
        if dc.azonosito is distinct from c_row.azonosito then
          perform public.log_field_change('component', dc.source_component_id, 'azonosito', c_row.azonosito, dc.azonosito, new_v); changed := true;
        end if;
        if dc.megnevezes is distinct from c_row.megnevezes then
          perform public.log_field_change('component', dc.source_component_id, 'megnevezes', c_row.megnevezes, dc.megnevezes, new_v); changed := true;
        end if;
        if dc.adatok is distinct from c_row.adatok then
          perform public.log_field_change('component', dc.source_component_id, 'adatok', c_row.adatok::text, dc.adatok::text, new_v); changed := true;
        end if;
        if changed then
          update public.components set tipus=dc.tipus, azonosito_tipus=dc.azonosito_tipus, azonosito=dc.azonosito,
            megnevezes=dc.megnevezes, adatok=dc.adatok, version=new_v
            where id = dc.source_component_id;
        end if;
        -- A fő elem váltása CSENDES: a change_log rögzíti, de a verzió nem emelkedik
        -- (nincs felkiáltójel). (A kizáró megszorítás halasztott, így a csere egy
        -- publikáláson belül sorrendfüggetlen.)
        if dc.is_main is distinct from c_row.is_main then
          perform public.log_field_change('component', dc.source_component_id, 'is_main',
                                          c_row.is_main::text, dc.is_main::text,
                                          case when changed then new_v else c_row.version end);
          update public.components set is_main = dc.is_main where id = dc.source_component_id;
        end if;
      elsif dc.deleted then
        continue;     -- sosem publikált komponens, törlésre jelölve: egyszerűen kimarad
      else
        insert into public.components (issue_id, tipus, azonosito_tipus, azonosito, megnevezes, adatok, version, is_main)
        values (live_issue_id, dc.tipus, dc.azonosito_tipus, dc.azonosito, dc.megnevezes, dc.adatok, 1, dc.is_main);
      end if;
    end loop;

    -- Egy Számnak mindig marad legalább egy nem törölt komponense (ha volt neki).
    if exists (select 1 from public.draft_components where draft_issue_id = di.id)
       and not exists (select 1 from public.components where issue_id = live_issue_id and not is_deleted) then
      raise exception 'A publikálás nem lehetséges: a(z) #% Számon minden komponens törölve lenne. Az élő sorozat nem változott. Teendő: „Visszaadás szerkesztésre”, és vond vissza a törlés-jelölést legalább egy komponensen.', di.lapszam;
    end if;

    -- Minden Számnak mindig legyen fő eleme: ha a draft nem jelölt, a tartalék szabály dolgozik.
    if not exists (select 1 from public.components where issue_id = live_issue_id and is_main) then
      update public.components set is_main = true where id = public.pick_main_component(live_issue_id);
    end if;

    perform public.seed_issue_seen_for_subscribers(live_issue_id);
  end loop;

  -- A lapszám-egyediség ellenőrzése halasztott (átszámozás/csere miatt), ezért
  -- az ütközés egyébként csak a commit-nál, nyers constraint-hibával derülne
  -- ki. Itt, a függvényen belül, még érthetően jelezzük.
  select string_agg(lapszam::text, ', ' order by lapszam) into dup_list
  from (
    select lapszam from public.issues
    where series_id = live_series_id and not is_deleted
    group by lapszam having count(*) > 1
  ) x;
  if dup_list is not null then
    raise exception 'A publikálás nem lehetséges: a(z) % lapszám több nem törölt Számnál is szerepelne a sorozatban. Ez jellemzően akkor fordul elő, ha egy élő Szám nincs benne a munkaanyagban (pl. „Szám törlése a draftból” után), egy új Szám pedig ugyanazt a lapszámot kapta. Az élő sorozat nem változott. Teendő: „Visszaadás szerkesztésre”, majd az ütköző Számok lapszámának javítása.', dup_list;
  end if;

  -- Egy Számon legfeljebb egy fő elem lehet (halasztott kizáró megszorítás: itt, a
  -- függvényen belül érthetően jelezzük, nem a commit-nál nyers hibával).
  select string_agg('#' || lapszam, ', ' order by lapszam) into main_list
  from (
    select i.lapszam from public.issues i
     where i.series_id = live_series_id and not i.is_deleted
       and (select count(*) from public.components c where c.issue_id = i.id and c.is_main) > 1
  ) x;
  if main_list is not null then
    raise exception 'A publikálás nem lehetséges: a(z) % Számon több fő elem (★) lenne. Ez akkor fordul elő, ha a munkaanyagban kijelölt fő elem mellett egy, a munkaanyagban nem szereplő élő komponens is fő elem. Az élő sorozat nem változott. Teendő: „Visszaadás szerkesztésre”, és a Számon jelöld ki újra a fő elemet.', main_list;
  end if;

  delete from public.draft_series where id = p_draft_id;
end;
$function$;
grant execute on function public.publish_draft_series(uuid) to authenticated;

-- ============================================================================
-- 10. draft_ready_warnings — a sorozatszámmal egyező azonosító nem duplikáció; meglévő komponensek mező-hiánya figyelmeztet
-- ============================================================================
CREATE OR REPLACE FUNCTION public.draft_ready_warnings(p_draft_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d    public.draft_series%rowtype;
  tmpl jsonb;
  res  jsonb := '[]'::jsonb;
  r    record;
  nev  text;
  lst  jsonb;
  sor_norm text[];
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod ehhez a művelethez.';
  end if;
  select * into d from public.draft_series where id = p_draft_id;
  if not found then raise exception 'A munkaanyag nem található.'; end if;
  tmpl := case when jsonb_typeof(d.component_template) = 'array' and jsonb_array_length(d.component_template) > 0
               then d.component_template else public.default_component_template(d.components) end;

  -- 1) AJÁNLOTT azonosító: hány ilyen típusú komponens azonosító nélkül (nem törölt Számokon)
  for r in
    select x->>'tipus' as tipus, count(dc.id) as n
      from jsonb_array_elements(tmpl) x
      join public.draft_components dc on dc.tipus = x->>'tipus' and not dc.deleted
      join public.draft_issues di on di.id = dc.draft_issue_id and di.draft_series_id = p_draft_id and not di.deleted
     where x->>'id_rule' = 'ajanlott' and coalesce(btrim(dc.azonosito), '') = ''
     group by 1 having count(dc.id) > 0
  loop
    nev := coalesce((select l.megjelenites from public.lists l where l.tipus = 'komponens' and l.ertek = r.tipus limit 1), r.tipus);
    res := res || jsonb_build_object('kod', 'azonosito_ajanlott',
             'szoveg', r.n || ' ' || nev || ' komponensnek még nincs azonosítója (ajánlott)', 'darab', r.n);
  end loop;

  -- 2) KÖTELEZŐ azonosító a MEGLÉVŐ (nem ebben a draftban hozzáadott) komponenseken: csak figyelmeztet
  for r in
    select x->>'tipus' as tipus, count(dc.id) as n
      from jsonb_array_elements(tmpl) x
      join public.draft_components dc on dc.tipus = x->>'tipus' and dc.source_component_id is not null and not dc.deleted
      join public.draft_issues di on di.id = dc.draft_issue_id and di.draft_series_id = p_draft_id and not di.deleted
     where x->>'id_rule' = 'kotelezo' and coalesce(btrim(dc.azonosito), '') = ''
     group by 1 having count(dc.id) > 0
  loop
    nev := coalesce((select l.megjelenites from public.lists l where l.tipus = 'komponens' and l.ertek = r.tipus limit 1), r.tipus);
    res := res || jsonb_build_object('kod', 'azonosito_kotelezo_meglevo',
             'szoveg', r.n || ' meglévő ' || nev || ' komponensen hiányzik a kötelező azonosító (a meglévőket nem blokkoljuk)', 'darab', r.n);
  end loop;

  -- 2/b) TÍPUSLEÍRÁS szerinti kötelező mező / azonosító-típus a MEGLÉVŐ, nem módosított komponenseken:
  --      csak figyelmeztet (az új és a módosított komponenseken a mark_draft_ready blokkol).
  for r in
    select f.tipus_nev, f.uzenet, count(*) as n
      from public.draft_type_field_issues(p_draft_id) f
     where not f.blokkol
     group by 1, 2 order by 1, 2
  loop
    res := res || jsonb_build_object('kod', 'tipus_mezo_meglevo',
             'szoveg', r.n || ' meglévő ' || r.tipus_nev || ' komponensen ' || r.uzenet || ' (a meglévőket nem blokkoljuk)', 'darab', r.n);
  end loop;

  -- A sorozat-szintű azonosítók (a draft „Sorozat-azonosítók” listája) normalizált értékei: az ezekkel
  -- egyező komponens-azonosító NEM duplikáció (a sorozatszám a sorozatot azonosítja, nem a Számot).
  select coalesce(array_agg(lower(regexp_replace(btrim(e->>'ertek'), '[\s-]+', '', 'g'))), '{}')
    into sor_norm
    from jsonb_array_elements(case when jsonb_typeof(d.azonositok) = 'array' then d.azonositok else '[]'::jsonb end) e;

  -- 3) DUPLIKÁLT azonosító a publikálás UTÁNI állapotban: azonos típus + azonos azonosító
  --    (üresek kihagyva; kis/nagybetű- és szóközfüggetlen). A draft komponensei + az élő sorozat
  --    azon komponensei, amelyeket a draft nem érint.
  with allc as (
    select dc.tipus, lower(regexp_replace(btrim(dc.azonosito), '\s+', '', 'g')) as norm, dc.azonosito as eredeti,
           '#' || di.lapszam as hely
      from public.draft_components dc
      join public.draft_issues di on di.id = dc.draft_issue_id and di.draft_series_id = p_draft_id and not di.deleted
     where coalesce(btrim(dc.azonosito), '') <> '' and not dc.deleted
    union all
    select c.tipus, lower(regexp_replace(btrim(c.azonosito), '\s+', '', 'g')), c.azonosito, '#' || i.lapszam || ' (élő)'
      from public.components c
      join public.issues i on i.id = c.issue_id and not i.is_deleted
     where d.source_series_id is not null and i.series_id = d.source_series_id
       and coalesce(btrim(c.azonosito), '') <> '' and not c.is_deleted
       and not exists (select 1 from public.draft_components x
                         join public.draft_issues xi on xi.id = x.draft_issue_id and xi.draft_series_id = p_draft_id
                        where x.source_component_id = c.id)
       and not exists (select 1 from public.draft_issues xi where xi.draft_series_id = p_draft_id
                          and xi.source_issue_id = i.id and xi.deleted)
  )
  select coalesce(jsonb_agg(jsonb_build_object('tipus', g.tipus, 'azonosito', g.eredeti, 'helyek', g.helyek) order by g.tipus, g.norm), '[]'::jsonb)
    into lst
    from (select tipus, norm, min(eredeti) as eredeti, jsonb_agg(hely order by hely) as helyek
            from allc
           where not (replace(norm, '-', '') = any(sor_norm))
           group by tipus, norm
          having count(*) > 1
             -- ÁTMENETI (az adatrendezésig): a kiadvány-családban (magazin, könyv) a 3 vagy több
             -- komponensen azonos érték sorozatszámnak számít (ISSN / sorozat-ISBN), nem duplikációnak.
             and not (count(*) >= 3 and tipus in (select t.tipus from public.component_type_defs t where t.csalad = 'kiadvany'))
           order by tipus, norm limit 10) g;
  if jsonb_array_length(lst) > 0 then
    res := res || jsonb_build_object('kod', 'azonosito_duplikalt',
             'szoveg', jsonb_array_length(lst) || ' azonosító kétszer vagy többször szerepel azonos típusú komponensen a sorozatban (legfeljebb 10 felsorolva)',
             'tetelek', lst);
  end if;

  return res;
end;
$function$;
grant execute on function public.draft_ready_warnings(uuid) to authenticated;

notify pgrst, 'reload schema';
