## `publish_draft_series`

### 2. szakasz (E+G) — az élő definícióhoz képest

```diff
  … boolean; dup_list text; lapszam_changed boolean; main_list text
+ ;
+ tmpl jsonb;
+ terr text;
+ tmpl_types text[]
  ; begin if not (public.is_staff() …
```
```diff
  … 'ready' then raise exception 'Ez a munkaanyag már nem „Publikálásra váró” állapotban van (közben visszaadták szerkesztésre?) — frissítsd a Karbantartás nézetet.'; end if;
+ tmpl := d.component_template;
+ if tmpl is null or jsonb_typeof(tmpl) <> 'array' or jsonb_array_length(tmpl) = 0 then
+ tmpl := public.default_component_template(d.components);
+ else
+ tmpl := public.sync_template_with_components(tmpl, d.components);
+ end if;
+ terr := public.component_template_error(tmpl);
+ if terr is not null then
+ raise exception 'A publikálás nem lehetséges: a komponens-sablon érvénytelen — %', terr;
+ end if;
+ select array_agg(x->>'tipus' order by o) into tmpl_types from jsonb_array_elements(tmpl) with ordinality as t(x, o);
+ d.components := tmpl_types;
+ d.component_template := tmpl;
  if d.pool_type = 'new' then insert into public …
```
```diff
  … , megnevezes, megjelenites, szin, kategoria, components
+ , component_template
  , sort_order, kod_szam, lifecycle, version) values …
```
```diff
  … .szin, d.kategoria, d.components
+ , d.component_template
  , (select count(*) from public. …
```
```diff
  … , components=d.components, version=new_v
+ where id = live_series_id;
+ end if;
+ if d.component_template is distinct from s_row.component_template then
+ perform public.log_field_change('series', live_series_id, 'component_template', s_row.component_template::text, d.component_template::text, case when changed then
+ new_v else
+ s_row.version end);
+ update public.series set component_template = d.component_template
  where id = live_series_id; end if; update public …
```
```diff
  … ; changed := true; end if; if
+ dc.adatok is distinct from c_row.adatok then
+ perform public.log_field_change('component', dc.source_component_id, 'adatok', c_row.adatok::text, dc.adatok::text, new_v);
+ changed := true;
+ end if;
+ if
  changed then update public.components set tipus=dc …
```
```diff
  … =dc.azonosito, megnevezes=dc.megnevezes
+ , adatok=dc.adatok
  , version=new_v where id = dc.source_component_id …
```
```diff
  … issue_id, tipus, azonosito_tipus, azonosito, megnevezes,
+ adatok,
  version, is_main) values (live_issue_id, dc. …
```
```diff
  … .azonosito_tipus, dc.azonosito, dc.megnevezes
+ , dc.adatok
  , 1, dc.is_main); end if …
```

### 4. szakasz (H) — a 3. szakasz utáni állapothoz képest

```diff
  … public.components where id = dc.source_component_id;
+ if dc.deleted then
+ if not c_row.is_deleted then
+ perform public.log_field_change('component', dc.source_component_id, 'is_deleted', 'false', 'true', c_row.version);
+ if c_row.is_main then
+ perform public.log_field_change('component', dc.source_component_id, 'is_main', 'true', 'false', c_row.version);
+ end if;
+ update public.components set is_deleted = true, is_main = false where id = dc.source_component_id;
+ end if;
+ continue;
+ elsif
+ c_row.is_deleted then
+ perform public.log_field_change('component', dc.source_component_id, 'is_deleted', 'true', 'false', c_row.version);
+ update public.components set is_deleted = false where id = dc.source_component_id;
+ end if;
  new_v := c_row.version + 1; changed …
```
```diff
  … where id = dc.source_component_id; end if;
+ elsif
+ dc.deleted then
+ continue;
  else insert into public.components (issue_id, tipus …
```
```diff
  … dc.is_main); end if; end loop
+ ;
+ if exists (select 1 from public.draft_components where draft_issue_id = di.id) and not exists (select 1 from public.components where issue_id = live_issue_id and not is_deleted) then
+ raise exception 'A publikálás nem lehetséges: a(z) #% Számon minden komponens törölve lenne. Az élő sorozat nem változott. Teendő: „Visszaadás szerkesztésre”, és vond vissza a törlés-jelölést legalább egy komponensen.', di.lapszam;
+ end if
  ; if not exists (select 1 from public. …
```

## `start_edit_draft`

### 2. szakasz (E+G) — az élő definícióhoz képest

```diff
  … , megnevezes, megjelenites, szin, kategoria, components
+ , component_template
  ) values ('edit', 'claimed', p_series_id, auth …
```
```diff
  … .szin, s.kategoria, s.components
+ , s.component_template
  ) returning id into d_id; insert into public. …
```
```diff
  … , tipus, azonosito_tipus, azonosito, megnevezes, is_main
+ , adatok
  ) select di.id, c.id, …
```
```diff
  … .azonosito, c.megnevezes, c.is_main
+ , c.adatok
  from public.components c join public.draft_issues di …
```

### 4. szakasz (H) — a 3. szakasz utáni állapothoz képest

```diff
  … = c.issue_id where di.draft_series_id = d_id
+ and not c.is_deleted
  ; return d_id; end; …
```

## `apply_draft_upload`

### 2. szakasz (E+G) — az élő definícióhoz képest

```diff
  … insert into public.draft_components (draft_issue_id, tipus,
- azonosito, megnevezes, source_component_id) select iid, t.tipus, null, null, null from unnest(d.components) with ordinality as t(tipus, ord) where
+ azonosito_tipus, azonosito, megnevezes, source_component_id) select iid, x.t->>'tipus', nullif(x.t->>'default_azonosito_tipus',''), null, nullif(x.t->>'default_megnevezes',''), null from jsonb_array_elements( case when d.component_template is not null and jsonb_typeof(d.component_template)='array' and jsonb_array_length(d.component_template) > 0 then
+ d.component_template else
+ public.default_component_template(d.components) end ) with ordinality as x(t, ord) where coalesce((x.t->>'required')::boolean, true) and
  not exists (select 1 from public.draft_components dc …
```
```diff
  … dc.draft_issue_id = iid and dc.tipus =
- t.tipus) order by t
+ x.t->>'tipus') order by x
  .ord; get diagnostics n_k = row_count; n_cauto …
```

### 3. szakasz (F) — a 2. szakasz utáni állapothoz képest

```diff
  … text; iid uuid; cid uuid; conf jsonb
- ;
- new_types text[]
  ; is_new boolean; n_new int := 0; …
```
```diff
  … n_del := n_del + 1; end loop;
- select array_agg(distinct dc.tipus) into new_types from public.draft_components dc join public.draft_issues di on di.id = dc.draft_issue_id where di.draft_series_id = p_draft_id and not (dc.tipus = any(d.components));
- if new_types is not null then
- update public.draft_series set components = components || new_types where id = p_draft_id;
- end if;
  conf := public.draft_lapszam_conflicts(p_draft_id, '[]' …
```

### 4. szakasz (H) — a 3. szakasz utáni állapothoz képest

```diff
  … .tipus = x.t->>'tipus'
+ and not dc.deleted
  ) order by x.ord; get diagnostics n_k …
```

## `mark_draft_ready`

### 2. szakasz (E+G) — az élő definícióhoz képest

```diff
  … conf jsonb; n_missing int; lst text; n_main
+ int;
+ tmpl jsonb;
+ terr text;
+ n_azon
  int; begin if not (public.is_staff( …
```
```diff
  … .my_role() <> 'owner' then raise exception 'Csak a munkaanyagot lefoglaló admin vagy a tulajdonos állíthatja Kész-re.'
+ ;
+ end if;
+ tmpl := d.component_template;
+ if tmpl is null or jsonb_typeof(tmpl) <> 'array' or jsonb_array_length(tmpl) = 0 then
+ tmpl := public.default_component_template(d.components);
+ update public.draft_series set component_template = tmpl where id = p_draft_id;
+ end if;
+ terr := public.component_template_error(tmpl);
+ if terr is not null then
+ raise exception E'A munkaanyag nem állítható „Kész”-re: a komponens-sablon érvénytelen.\n\n%', terr
  ; end if; select count(*) into …
```
```diff
  … case when n_missing > 10 then ' … (és még ' || (n_missing
+ - 10) || ')' else
+ '' end;
+ end if;
+ select count(*) into n_azon from public.draft_components dc join public.draft_issues di on di.id = dc.draft_issue_id where di.draft_series_id = p_draft_id and not di.deleted and dc.source_component_id is null and coalesce(btrim(dc.azonosito), '') = '' and dc.tipus in (select x->>'tipus' from jsonb_array_elements(tmpl) x where x->>'id_rule' = 'kotelezo');
+ if n_azon > 0 then
+ select string_agg('#' || y.lapszam || ' (' || y.nev || ')', ', ' order by y.lapszam, y.nev) into lst from (select di.lapszam, coalesce((select l.megjelenites from public.lists l where l.tipus = 'komponens' and l.ertek = dc.tipus limit 1), dc.tipus) as nev from public.draft_components dc join public.draft_issues di on di.id = dc.draft_issue_id where di.draft_series_id = p_draft_id and not di.deleted and dc.source_component_id is null and coalesce(btrim(dc.azonosito), '') = '' and dc.tipus in (select x->>'tipus' from jsonb_array_elements(tmpl) x where x->>'id_rule' = 'kotelezo') order by di.lapszam limit 10) y;
+ raise exception E'A munkaanyag nem állítható „Kész”-re: % kötelező azonosító nélkül van.\n\n%\n\nTeendő: add meg az azonosítót az érintett komponenseken, vagy állítsd a sablonban „ajánlott”-ra az azonosító-szabályt.', n_azon || ' komponens', lst || case when n_azon > 10 then
+ ' … (és még ' || (n_azon
  - 10) || ')' else '' end; end …
```

### 4. szakasz (H) — a 3. szakasz utáni állapothoz képest

```diff
  … .draft_series_id = p_draft_id and not di.deleted and
+ not dc.deleted and
  dc.source_component_id is null and coalesce(btrim( …
```
```diff
  … .draft_series_id = p_draft_id and not di.deleted and
+ not dc.deleted and
  dc.source_component_id is null and coalesce(btrim( …
```
```diff
  … ) || ')' else '' end; end if;
+ select count(*) into n_missing from public.draft_issues di where di.draft_series_id = p_draft_id and not di.deleted and exists (select 1 from public.draft_components x where x.draft_issue_id = di.id) and not exists (select 1 from public.draft_components x where x.draft_issue_id = di.id and not x.deleted);
+ if n_missing > 0 then
+ select string_agg('#' || y.lapszam || ' „' || coalesce(nullif(btrim(y.cim), ''), 'cím nélkül') || '”', ', ' order by y.lapszam) into lst from (select di.lapszam, di.cim from public.draft_issues di where di.draft_series_id = p_draft_id and not di.deleted and exists (select 1 from public.draft_components x where x.draft_issue_id = di.id) and not exists (select 1 from public.draft_components x where x.draft_issue_id = di.id and not x.deleted) order by di.lapszam limit 10) y;
+ raise exception E'A munkaanyag nem állítható „Kész”-re: % minden komponense törlésre van jelölve.\n\n%\n\nTeendő: egy Számnak legalább egy komponensének megmaradnia — vond vissza a törlés-jelölést.', n_missing || ' Számon', lst;
+ end if;
  perform public.ensure_draft_main(di.id) from …
```
```diff
  … draft_components x where x.draft_issue_id = di.id
+ and not x.deleted
  ) and (select count(*) from public …
```
```diff
  … .draft_issue_id = di.id and x.is_main
+ and not x.deleted
  ) <> 1; if n_main > 0 then select …
```
```diff
  … draft_components x where x.draft_issue_id = di.id
+ and not x.deleted
  ) and (select count(*) from public …
```
```diff
  … .draft_issue_id = di.id and x.is_main
+ and not x.deleted
  ) <> 1 order by di.lapszam limit 10 …
```

## `pick_main_component`

### 2. szakasz (E+G) — az élő definícióhoz képest

```diff
  … series_id where c.issue_id = p_issue_id order by case
- c.tipus when 'magazin' then
- 0 when 'konyv' then
- 1 else
- 2
+ when c.tipus = public.template_main_type(s.component_template) then
+ 0 when c.tipus = 'magazin' then
+ 1 when c.tipus = 'konyv' then
+ 2 else
+ 3
  end, coalesce(array_position(s.components, …
```

### 4. szakasz (H) — a 3. szakasz utáni állapothoz képest

```diff
  … = i.series_id where c.issue_id = p_issue_id
+ and not c.is_deleted
  order by case when c.tipus = public. …
```

## `pick_main_draft_component`

### 2. szakasz (E+G) — az élő definícióhoz képest

```diff
  … source_component_id where dc.draft_issue_id = p_draft_issue_id order by case
- dc.tipus when 'magazin' then
- 0 when 'konyv' then
- 1 else
- 2
+ when dc.tipus = public.template_main_type(ds.component_template) then
+ 0 when dc.tipus = 'magazin' then
+ 1 when dc.tipus = 'konyv' then
+ 2 else
+ 3
  end, coalesce(array_position(ds.components, …
```

### 4. szakasz (H) — a 3. szakasz utáni állapothoz képest

```diff
  … = dc.source_component_id where dc.draft_issue_id = p_draft_issue_id
+ and not dc.deleted
  order by case when dc.tipus = public. …
```

## `ensure_draft_main`

### 4. szakasz (H) — a 3. szakasz utáni állapothoz képest

```diff
  … public.draft_components x where x.draft_issue_id = p_draft_issue_id
+ and not x.deleted
  ) and not exists (select 1 from public. …
```
```diff
  … where x.draft_issue_id = p_draft_issue_id and x.is_main
+ and not x.deleted
  ) then update public.draft_components set is_main = true …
```

## `seed_issue_seen_for_subscribers`

### 4. szakasz (H) — a 3. szakasz utáni állapothoz képest

```diff
  … .is_selected = true where c.issue_id = p_issue_id
+ and not c.is_deleted
  on conflict (user_id, entity_type, entity_id) do …
```

## `seed_member_seen`

### 4. szakasz (H) — a 3. szakasz utáni állapothoz képest

```diff
  … = c.issue_id where i.series_id = p_series_id
+ and not c.is_deleted
  on conflict (user_id, entity_type, entity_id) do …
```

## ÚJ függvények (a 2. szakaszban jönnek létre — nincs élő megfelelőjük, teljes szöveg)

### `template_main_type`
```sql
create or replace function public.template_main_type(t jsonb)
  returns text language sql immutable as $$
  select x->>'tipus'
    from jsonb_array_elements(case when jsonb_typeof(t) = 'array' then t else '[]'::jsonb end) x
   where coalesce((x->>'main')::boolean, false)
   limit 1
$$;
```

### `component_template_error`
```sql
create or replace function public.component_template_error(t jsonb)
  returns text language plpgsql immutable as $$
declare
  el jsonb; tp text; seen text[] := '{}'; mains int := 0;
begin
  if t is null or jsonb_typeof(t) <> 'array' then return 'a sablon nem lista'; end if;
  if jsonb_array_length(t) < 1 then return 'a sablonhoz legalább 1 komponens-típus kell'; end if;
  for el in select * from jsonb_array_elements(t) loop
    if jsonb_typeof(el) <> 'object' then return 'a sablon minden eleme objektum kell legyen'; end if;
    tp := el->>'tipus';
    if tp is null or btrim(tp) = '' then return 'a sablon egyik eleméből hiányzik a típus'; end if;
    if tp = any(seen) then return 'a(z) „' || tp || '” típus kétszer szerepel a sablonban'; end if;
    seen := seen || tp;
    if coalesce(el->>'id_rule', 'nincs') not in ('kotelezo', 'ajanlott', 'nincs') then
      return 'érvénytelen azonosító-szabály a(z) „' || tp || '” típusnál (kotelezo / ajanlott / nincs)';
    end if;
    if coalesce((el->>'main')::boolean, false) then mains := mains + 1; end if;
  end loop;
  if mains <> 1 then return 'a sablonban pontosan egy típus lehet fő elem (most: ' || mains || ')'; end if;
  return null;
end;
$$;
```

### `default_component_template`
```sql
create or replace function public.default_component_template(p_components text[])
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  main_t text; only_mag boolean; res jsonb;
begin
  if p_components is null or coalesce(array_length(p_components, 1), 0) = 0 then return '[]'::jsonb; end if;
  main_t := case when 'magazin' = any(p_components) then 'magazin'
                 when 'konyv'   = any(p_components) then 'konyv'
                 else p_components[1] end;
  only_mag := array_length(array_remove(p_components, 'magazin'), 1) is null;
  select jsonb_agg(jsonb_build_object(
           'tipus', t.tipus,
           'main', t.tipus = main_t,
           'required', true,
           'id_rule', 'nincs',
           'default_azonosito_tipus', d.default_azonosito_tipus,
           'counts_for_color', (t.tipus <> 'magazin' or only_mag),
           'default_megnevezes', null) order by t.ord)
    into res
    from unnest(p_components) with ordinality as t(tipus, ord)
    left join public.component_type_defs d on d.tipus = t.tipus;
  return coalesce(res, '[]'::jsonb);
end;
$$;
```

### `sync_template_with_components`
```sql
create or replace function public.sync_template_with_components(t jsonb, p_components text[])
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  kept jsonb; added jsonb; res jsonb; have text[]; main_t text;
begin
  if p_components is null or coalesce(array_length(p_components, 1), 0) = 0 then return t; end if;
  select coalesce(jsonb_agg(x order by o), '[]'::jsonb), coalesce(array_agg(x->>'tipus'), '{}')
    into kept, have
    from jsonb_array_elements(t) with ordinality as e(x, o)
   where (x->>'tipus') = any(p_components);
  if (select count(*) from jsonb_array_elements(t)) = jsonb_array_length(kept)
     and not exists (select 1 from unnest(p_components) c where c <> all(have)) then
    return t;                                                  
  end if;
  select coalesce(jsonb_agg(x order by o), '[]'::jsonb)
    into added
    from jsonb_array_elements(public.default_component_template(p_components)) with ordinality as e(x, o)
   where (x->>'tipus') <> all(have);
  res := kept || (select coalesce(jsonb_agg(jsonb_set(x, '{main}', 'false'::jsonb)), '[]'::jsonb) from jsonb_array_elements(added) x);
  if public.template_main_type(res) is null and jsonb_array_length(res) > 0 then
    main_t := case when exists (select 1 from jsonb_array_elements(res) x where x->>'tipus' = 'magazin') then 'magazin'
                   when exists (select 1 from jsonb_array_elements(res) x where x->>'tipus' = 'konyv') then 'konyv'
                   else res->0->>'tipus' end;
    select jsonb_agg(jsonb_set(x, '{main}', to_jsonb((x->>'tipus') = main_t)) order by o)
      into res from jsonb_array_elements(res) with ordinality as e(x, o);
  end if;
  return res;
end;
$$;
```

### `draft_ready_warnings`
```sql
create or replace function public.draft_ready_warnings(p_draft_id uuid)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  d    public.draft_series%rowtype;
  tmpl jsonb;
  res  jsonb := '[]'::jsonb;
  r    record;
  nev  text;
  lst  jsonb;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod ehhez a művelethez.';
  end if;
  select * into d from public.draft_series where id = p_draft_id;
  if not found then raise exception 'A munkaanyag nem található.'; end if;
  tmpl := case when jsonb_typeof(d.component_template) = 'array' and jsonb_array_length(d.component_template) > 0
               then d.component_template else public.default_component_template(d.components) end;

  
  for r in
    select x->>'tipus' as tipus, count(dc.id) as n
      from jsonb_array_elements(tmpl) x
      join public.draft_components dc on dc.tipus = x->>'tipus'
      join public.draft_issues di on di.id = dc.draft_issue_id and di.draft_series_id = p_draft_id and not di.deleted
     where x->>'id_rule' = 'ajanlott' and coalesce(btrim(dc.azonosito), '') = ''
     group by 1 having count(dc.id) > 0
  loop
    nev := coalesce((select l.megjelenites from public.lists l where l.tipus = 'komponens' and l.ertek = r.tipus limit 1), r.tipus);
    res := res || jsonb_build_object('kod', 'azonosito_ajanlott',
             'szoveg', r.n || ' ' || nev || ' komponensnek még nincs azonosítója (ajánlott)', 'darab', r.n);
  end loop;

  
  for r in
    select x->>'tipus' as tipus, count(dc.id) as n
      from jsonb_array_elements(tmpl) x
      join public.draft_components dc on dc.tipus = x->>'tipus' and dc.source_component_id is not null
      join public.draft_issues di on di.id = dc.draft_issue_id and di.draft_series_id = p_draft_id and not di.deleted
     where x->>'id_rule' = 'kotelezo' and coalesce(btrim(dc.azonosito), '') = ''
     group by 1 having count(dc.id) > 0
  loop
    nev := coalesce((select l.megjelenites from public.lists l where l.tipus = 'komponens' and l.ertek = r.tipus limit 1), r.tipus);
    res := res || jsonb_build_object('kod', 'azonosito_kotelezo_meglevo',
             'szoveg', r.n || ' meglévő ' || nev || ' komponensen hiányzik a kötelező azonosító (a meglévőket nem blokkoljuk)', 'darab', r.n);
  end loop;

  
  
  
  with allc as (
    select dc.tipus, lower(regexp_replace(btrim(dc.azonosito), '\s+', '', 'g')) as norm, dc.azonosito as eredeti,
           '#' || di.lapszam as hely
      from public.draft_components dc
      join public.draft_issues di on di.id = dc.draft_issue_id and di.draft_series_id = p_draft_id and not di.deleted
     where coalesce(btrim(dc.azonosito), '') <> ''
    union all
    select c.tipus, lower(regexp_replace(btrim(c.azonosito), '\s+', '', 'g')), c.azonosito, '#' || i.lapszam || ' (élő)'
      from public.components c
      join public.issues i on i.id = c.issue_id and not i.is_deleted
     where d.source_series_id is not null and i.series_id = d.source_series_id
       and coalesce(btrim(c.azonosito), '') <> ''
       and not exists (select 1 from public.draft_components x
                         join public.draft_issues xi on xi.id = x.draft_issue_id and xi.draft_series_id = p_draft_id
                        where x.source_component_id = c.id)
       and not exists (select 1 from public.draft_issues xi where xi.draft_series_id = p_draft_id
                          and xi.source_issue_id = i.id and xi.deleted)
  )
  select coalesce(jsonb_agg(jsonb_build_object('tipus', g.tipus, 'azonosito', g.eredeti, 'helyek', g.helyek) order by g.tipus, g.norm), '[]'::jsonb)
    into lst
    from (select tipus, norm, min(eredeti) as eredeti, jsonb_agg(hely order by hely) as helyek
            from allc group by tipus, norm having count(*) > 1 order by tipus, norm limit 10) g;
  if jsonb_array_length(lst) > 0 then
    res := res || jsonb_build_object('kod', 'azonosito_duplikalt',
             'szoveg', jsonb_array_length(lst) || ' azonosító kétszer vagy többször szerepel azonos típusú komponensen a sorozatban (legfeljebb 10 felsorolva)',
             'tetelek', lst);
  end if;

  return res;
end;
$$;
```

### `draft_ready_warnings` — 4. szakasz (H) — a 2. szakasz szövegéhez képest

```diff
  … on dc.tipus = x->>'tipus'
+ and not dc.deleted
  join public.draft_issues di on di.id = …
```
```diff
  … >>'tipus' and dc.source_component_id is not null
+ and not dc.deleted
  join public.draft_issues di on di.id = …
```
```diff
  … (dc.azonosito), '') <> ''
+ and not dc.deleted
  union all select c.tipus, lower(regexp_replace …
```
```diff
  … (c.azonosito), '') <> ''
+ and not c.is_deleted
  and not exists (select 1 from public.draft_components …
```

## DDL — táblák, oszlopok, megszorítások, indexek (szakaszonként)

**1. szakasz (ÉLESÍTVE):**
```sql
alter table public.components       add column is_main boolean not null default false;
alter table public.draft_components add column is_main boolean not null default false;
alter table public.components       add constraint components_one_main_per_issue
  exclude using btree (issue_id with =) where (is_main) deferrable initially deferred;
alter table public.draft_components add constraint draft_components_one_main_per_issue
  exclude using btree (draft_issue_id with =) where (is_main) deferrable initially deferred;
```

**2. szakasz (E+G):**
```sql
create table public.component_type_defs (
  tipus text primary key, fields jsonb not null default '[]'::jsonb, default_azonosito_tipus text,
  created_at timestamptz not null default now(),
  constraint component_type_defs_no_price check (not (fields @> '[{"key":"ar"}]'::jsonb or fields @> '[{"key":"price"}]'::jsonb
         or fields @> '[{"key":"fizetett_ar"}]'::jsonb or fields @> '[{"key":"eredeti_ar"}]'::jsonb)));
alter table public.component_type_defs enable row level security;   -- olvasás: mindenki; írási policy NINCS
alter table public.components       add column adatok jsonb not null default '{}'::jsonb;
alter table public.draft_components add column adatok jsonb not null default '{}'::jsonb;
alter table public.series           add column component_template jsonb not null default '[]'::jsonb;
alter table public.draft_series     add column component_template jsonb not null default '[]'::jsonb;
create index draft_components_draft_issue_idx on public.draft_components (draft_issue_id);
create index draft_issues_draft_series_idx    on public.draft_issues (draft_series_id);
create index draft_components_source_idx      on public.draft_components (source_component_id);
```

**4. szakasz (H):**
```sql
alter table public.components       add column is_deleted boolean not null default false;
alter table public.draft_components add column deleted    boolean not null default false;
alter table public.components       add constraint components_main_not_deleted       check (not (is_main and is_deleted));
alter table public.draft_components add constraint draft_components_main_not_deleted check (not (is_main and deleted));
```
