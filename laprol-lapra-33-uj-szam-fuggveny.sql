-- ============================================================================
-- 33. lépés / (B) — ÚJ SZÁM FELVÉTELE ÉLŐ SOROZATRA EGYETLEN TRANZAKCIÓBAN: create_live_issue
--
-- JÓVÁHAGYÁSRA VÁR — a tulajdonos kifejezett jóváhagyása nélkül NEM futtatható.
-- ÉLESBEN MÉG NEM FUTOTT. Visszagörgetett próbán (scripts/trial-33-uj-szam.js, a TESZT sorozaton,
-- egy tranzakció, a végén ROLLBACK) lefutott: 19/19 ellenőrzés sikeres.
-- Futtatás: node scripts/run-migration.js laprol-lapra-33-uj-szam-fuggveny.sql 33-uj-szam-fuggveny
--
-- Mit ad: EGY új függvényt. Táblát, oszlopot, megszorítást, jogot, meglévő függvényt és adatot NEM módosít.
--
-- Miért: a „Gyors szerkesztés → + Új tétel” űrlap (és a Gyors Excel új sorai) ma több külön kérésben,
-- közvetlenül írnak az élő issues / components táblába — a típusleírás szabályai (27. lépés) nélkül,
-- fő elem nélkül, és ha félúton hiba van, komponens nélküli vagy csonka Szám maradhat. Ez a függvény
-- ugyanazt végzi egyetlen tranzakcióban, a típusleírás szerinti ellenőrzéssel:
--   • kötelező mezők (component_type_defs.fields, szint = 'kotelezo') — a TELJES új Számra blokkol;
--   • azonosító-típus a típus szabálya szerint (fix / választható / nincs / szabad);
--   • a sorozat sablonjának kötelező típusai mind szerepelnek;
--   • pontosan egy fő elem (★): a megadott, ennek hiányában a szokásos szabály (pick_main_component);
--   • a mostani mellékhatások változatlanul: a létrehozó személyes sorai (member_issue_data,
--     member_status) és a feliratkozók „látott” sorai (seed_issue_seen_for_subscribers).
-- A szabályok ugyanazok, mint a munkaanyagoknál a „Kész” előtt (draft_type_field_issues).
--
-- Bemenet:
--   p_series_id  az élő sorozat
--   p_issue      {"lapszam": 5, "cim": "…", "megjelenes": "2026-01-15", "eredeti_ar": 1990,
--                 "comps": [ {"tipus": "krtya", "azonosito_tipus": null, "azonosito": "K05",
--                             "megnevezes": "…", "adatok": {"gyujtemeny": "…"}, "is_main": false,
--                             "status": null, "db": 1, "jegyzet": null}, … ]}
--                A komponens "status" / "db" / "jegyzet" kulcsa a LÉTREHOZÓ személyes adata: ha
--                bármelyik kulcs szerepel, member_status sor készül (ahogy ma az űrlapnál).
--   p_personal   a létrehozó beszerzési adata: {"fizetett_ar", "beszerzesi_mennyiseg",
--                "beszerzes_datuma", "forras"} — vagy NULL (ekkor nem készül member_issue_data sor).
-- Kimenet: {"issue_id": …, "component_ids": […], "main_component_id": …}
-- ============================================================================

create or replace function public.create_live_issue(p_series_id uuid, p_issue jsonb, p_personal jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s          public.series%rowtype;
  tmpl       jsonb;
  comps      jsonb;
  cp         jsonb;
  td         public.component_type_defs%rowtype;
  f          jsonb;
  v_lapszam  int;
  v_tipus    text;
  v_nev      text;
  v_az       text;
  v_at       text;
  v_megn     text;
  v_adatok   jsonb;
  v_val      text;
  v_key      text;
  v_errs     text[] := '{}';
  v_idx      int := 0;
  v_mains    int := 0;
  v_main_idx int := null;
  v_issue_id uuid;
  v_cid      uuid;
  v_ids      uuid[] := '{}';
  v_main_id  uuid;
  v_rows     jsonb := '[]'::jsonb;   -- az ellenőrzött, beszúrásra kész komponensek
  r          record;
begin
  if not (public.is_staff() and public.is_active()) then
    raise exception 'Nincs jogosultságod új Számot felvenni.';
  end if;

  select * into s from public.series where id = p_series_id for update;
  if not found then raise exception 'A sorozat nem található.'; end if;
  if s.lifecycle <> 'active' then
    raise exception 'Új Szám csak aktív (publikált) sorozatra vehető fel.';
  end if;
  if s.force_delete_requested_at is not null then
    raise exception 'Ez a sorozat törlésre jelölt — a türelmi idő alatt nem bővíthető.';
  end if;

  if p_issue is null or jsonb_typeof(p_issue) <> 'object' then
    raise exception 'Hibás bemenet: a Szám adatai hiányoznak.';
  end if;
  if coalesce(p_issue->>'lapszam', '') !~ '^-?[0-9]+$' then
    raise exception 'A lapszám kötelező, és egész szám kell legyen.';
  end if;
  v_lapszam := (p_issue->>'lapszam')::int;

  -- Lapszám-ütközés az ÉLŐ, NEM TÖRÖLT Számokkal. (A törölt — is_deleted — Szám lapszáma szabad:
  -- az élő tábla egyediségi szabálya és a publikálás is így kezeli; a törölt Szám sora megmarad,
  -- amíg a felhasználók nyugtázzák, de a lapszámát új Szám megkaphatja.)
  if exists (select 1 from public.issues i where i.series_id = p_series_id and i.lapszam = v_lapszam and not i.is_deleted) then
    raise exception 'A(z) #% lapszám már szerepel ebben a sorozatban (%). Válassz másik lapszámot.', v_lapszam,
      (select '„' || coalesce(nullif(btrim(i.cim), ''), 'cím nélkül') || '”' from public.issues i
        where i.series_id = p_series_id and i.lapszam = v_lapszam and not i.is_deleted limit 1);
  end if;
  -- Lapszám-ütközés a sorozat nyitott szerkesztési munkaanyagának ÚJ (még nem élő) Számaival: a
  -- munkaanyag későbbi publikálása ütközne ezzel a Számmal. Megmondjuk, melyik munkaanyagról van szó.
  select d.megnevezes, d.pool_status, coalesce(nullif(btrim(di.cim), ''), 'cím nélkül') as cim,
         coalesce((select m.display_name from public.members m where m.user_id = d.claimed_by), '') as ki
    into r
    from public.draft_issues di join public.draft_series d on d.id = di.draft_series_id
   where d.source_series_id = p_series_id and di.source_issue_id is null and not di.deleted and di.lapszam = v_lapszam
   limit 1;
  if found then
    raise exception E'A(z) #% lapszámmal már van egy új, még nem publikált Szám („%”) a sorozat szerkesztési munkaanyagában.\n\nMunkaanyag: Karbantartás › Munka sorozatok › „Szerkesztés: %” (állapota: %).\n\nHa itt is felvennéd ugyanezt a lapszámot, a munkaanyag publikálása ütközne. Teendő: publikáld előbb a munkaanyagot, vagy ott adj másik lapszámot az új Számnak, vagy itt válassz másik lapszámot.',
      v_lapszam, r.cim, r.megnevezes,
      case r.pool_status when 'ready' then 'Publikálásra váró' when 'claimed' then 'Munkaanyag' else 'Beérkezett' end
        || case when r.ki <> '' then ', ' || r.ki || ' dolgozik rajta' else '' end;
  end if;

  comps := coalesce(p_issue->'comps', '[]'::jsonb);
  if jsonb_typeof(comps) <> 'array' or jsonb_array_length(comps) = 0 then
    raise exception 'Egy Számnak legalább egy eleme (komponense) kell legyen.';
  end if;

  tmpl := case when jsonb_typeof(s.component_template) = 'array' and jsonb_array_length(s.component_template) > 0
               then s.component_template else public.default_component_template(s.components) end;

  -- ---- elemenkénti ellenőrzés és előkészítés (a hibákat összegyűjtjük, egyszerre jelezzük) ----
  for cp in select * from jsonb_array_elements(comps) loop
    v_idx := v_idx + 1;
    v_tipus := nullif(btrim(coalesce(cp->>'tipus', '')), '');
    if v_tipus is null then
      v_errs := v_errs || format('%s. elem: hiányzik a típus', v_idx);
      continue;
    end if;
    select l.megjelenites into v_nev from public.lists l where l.tipus = 'komponens' and l.ertek = v_tipus limit 1;
    if v_nev is null then
      v_errs := v_errs || format('%s. elem: ismeretlen típus („%s”)', v_idx, v_tipus);
      continue;
    end if;

    v_az   := nullif(btrim(coalesce(cp->>'azonosito', '')), '');
    v_at   := nullif(btrim(coalesce(cp->>'azonosito_tipus', '')), '');
    v_megn := nullif(btrim(coalesce(cp->>'megnevezes', '')), '');
    v_adatok := '{}'::jsonb;

    select * into td from public.component_type_defs t where t.tipus = v_tipus;
    if found then
      -- a típus saját mezői (adatok): csak a típusleírásban szereplő kulcsok, az üres érték kimarad
      for f in select * from jsonb_array_elements(td.fields) loop
        v_key := f->>'key';
        if v_key in ('azonosito_tipus', 'azonosito', 'megnevezes', 'kep', 'db', 'jegyzet') or coalesce((f->>'szemelyes')::boolean, false) then
          v_val := case v_key when 'azonosito' then v_az when 'megnevezes' then v_megn else null end;
        else
          v_val := nullif(btrim(coalesce(cp->'adatok'->>v_key, '')), '');
          if v_val is not null then
            if f->>'kind' = 'egesz' and v_val ~ '^-?[0-9]+$' then
              v_adatok := v_adatok || jsonb_build_object(v_key, v_val::bigint);
            else
              v_adatok := v_adatok || jsonb_build_object(v_key, v_val);
            end if;
          end if;
        end if;
        if f->>'szint' = 'kotelezo' and v_key not in ('azonosito_tipus', 'kep', 'db', 'jegyzet') and v_val is null then
          v_errs := v_errs || format('%s: hiányzik: %s', v_nev, f->>'label');
        end if;
      end loop;

      -- azonosító-típus a típus szabálya szerint
      if td.azonosito_mod = 'nincs' then
        if v_az is not null then
          v_errs := v_errs || format('%s: ennél a típusnál nincs külön azonosító (a név azonosít)', v_nev);
        end if;
        v_at := null;
      elsif td.azonosito_mod in ('fix', 'valaszthato') then
        -- ha a hívó nem ad típust: a típus szerinti (fix típusnál a rögzített; egyébként a sablon,
        -- majd a típusleírás alapértéke) — ugyanaz, mint a munkaanyagoknál (type_azonosito_tipus)
        if v_at is null then v_at := public.type_azonosito_tipus(v_tipus, tmpl); end if;
        -- a szabály és a szöveg szó szerint a draft_type_field_issues-é: kitöltött azonosító mellett
        -- az azonosító-típus csak a megengedett(ek egyike) lehet
        if v_az is not null and not coalesce(v_at = any(td.azonosito_tipusok), false) then
          v_errs := v_errs || format('%s: az azonosító típusa csak %s lehet', v_nev,
            (select string_agg(coalesce((select l.megjelenites from public.lists l where l.tipus = 'azonosito' and l.ertek = a.t limit 1), a.t), ' vagy ' order by a.o)
               from unnest(td.azonosito_tipusok) with ordinality a(t, o)));
        end if;
        -- üres azonosító mellett a nem megengedett típus nem kerül be (a szabály üres azonosítónál nem vizsgál)
        if v_az is null and v_at is not null and not (v_at = any(td.azonosito_tipusok)) then
          v_at := public.type_azonosito_tipus(v_tipus, tmpl);
          if v_at is not null and not (v_at = any(td.azonosito_tipusok)) then v_at := null; end if;
        end if;
      end if;
    else
      -- típusleírás nélküli (a Listákban később felvett) típus: nincs szabály, a megadott adatok kerülnek be
      if jsonb_typeof(cp->'adatok') = 'object' then v_adatok := jsonb_strip_nulls(cp->'adatok'); end if;
    end if;
    if v_at is not null and not exists (select 1 from public.lists l where l.tipus = 'azonosito' and l.ertek = v_at) then
      v_errs := v_errs || format('%s: ismeretlen azonosító-típus („%s”)', v_nev, v_at);
    end if;

    -- a létrehozó személyes adata az elemen (ha a hívó megadja)
    if cp ? 'status' and nullif(cp->>'status', '') is not null and (cp->>'status') not in ('megvan', 'hianyzik', 'nemkell') then
      v_errs := v_errs || format('%s: ismeretlen státusz („%s”)', v_nev, cp->>'status');
    end if;
    if cp ? 'db' and nullif(cp->>'db', '') is not null and (cp->>'db') !~ '^[0-9]+$' then
      v_errs := v_errs || format('%s: a darabszám nem negatív egész szám kell legyen', v_nev);
    end if;

    if coalesce((cp->>'is_main')::boolean, false) then
      v_mains := v_mains + 1; v_main_idx := v_idx;
    end if;

    v_rows := v_rows || jsonb_build_object('idx', v_idx, 'tipus', v_tipus, 'azonosito_tipus', v_at, 'azonosito', v_az,
                                          'megnevezes', v_megn, 'adatok', v_adatok, 'src', cp);
  end loop;

  -- a sorozat sablonjának KÖTELEZŐ típusai mind szerepeljenek az új Számon
  for r in
    select x->>'tipus' as tipus
      from jsonb_array_elements(tmpl) x
     where coalesce((x->>'required')::boolean, true)
       and not exists (select 1 from jsonb_array_elements(v_rows) y where y->>'tipus' = x->>'tipus')
  loop
    v_errs := v_errs || format('hiányzik a sorozat kötelező eleme: %s',
      coalesce((select l.megjelenites from public.lists l where l.tipus = 'komponens' and l.ertek = r.tipus limit 1), r.tipus));
  end loop;

  if v_mains > 1 then
    v_errs := v_errs || 'egy Számon pontosan egy fő elem (★) lehet'::text;
  end if;

  if cardinality(v_errs) > 0 then
    raise exception E'Az új Szám nem vehető fel, mert az adatai hiányosak vagy nem felelnek meg az elemek típusának:\n\n%\n\nPótold a hiányzó adatokat, és próbáld újra. Semmi nem került mentésre.',
      (select string_agg('• ' || e, E'\n') from unnest(v_errs) e);
  end if;

  -- ---- beszúrás: a Szám, az elemei, a fő elem — egy tranzakcióban ----
  insert into public.issues (series_id, lapszam, cim, megjelenes, eredeti_ar, version)
  values (p_series_id, v_lapszam, nullif(btrim(coalesce(p_issue->>'cim', '')), ''),
          nullif(p_issue->>'megjelenes', '')::date, nullif(p_issue->>'eredeti_ar', '')::int, 1)
  returning id into v_issue_id;

  for cp in select * from jsonb_array_elements(v_rows) loop
    insert into public.components (issue_id, tipus, azonosito_tipus, azonosito, megnevezes, adatok, version, is_main)
    values (v_issue_id, cp->>'tipus', cp->>'azonosito_tipus', cp->>'azonosito', cp->>'megnevezes', cp->'adatok', 1, false)
    returning id into v_cid;
    v_ids := v_ids || v_cid;
    if (cp->>'idx')::int = v_main_idx then v_main_id := v_cid; end if;

    -- a létrehozó személyes sora az elemen: csak ha a hívó megadott státuszt / darabszámot / jegyzetet
    if (cp->'src') ? 'status' or (cp->'src') ? 'db' or (cp->'src') ? 'jegyzet' then
      insert into public.member_status (user_id, component_id, status, db, jegyzet)
      values (auth.uid(), v_cid, nullif(cp->'src'->>'status', ''),
              coalesce(nullif(cp->'src'->>'db', '')::int, 1), nullif(btrim(coalesce(cp->'src'->>'jegyzet', '')), ''))
      on conflict (user_id, component_id) do update
        set status = excluded.status, db = excluded.db, jegyzet = excluded.jegyzet;
    end if;
  end loop;

  -- fő elem: a megadott; ennek hiányában a szokásos szabály (a sablon fő típusa, magazin, könyv, első)
  if v_main_id is null then v_main_id := public.pick_main_component(v_issue_id); end if;
  update public.components set is_main = true where id = v_main_id;

  -- a létrehozó beszerzési adata a Számon (ha a hívó megadja)
  if p_personal is not null and jsonb_typeof(p_personal) = 'object' then
    insert into public.member_issue_data (user_id, issue_id, fizetett_ar, beszerzesi_mennyiseg, beszerzes_datuma, forras, ar_auto)
    values (auth.uid(), v_issue_id, nullif(p_personal->>'fizetett_ar', '')::int,
            greatest(1, coalesce(nullif(p_personal->>'beszerzesi_mennyiseg', '')::int, 1)),
            nullif(p_personal->>'beszerzes_datuma', '')::date, nullif(p_personal->>'forras', ''), false)
    on conflict (user_id, issue_id) do update
      set fizetett_ar = excluded.fizetett_ar, beszerzesi_mennyiseg = excluded.beszerzesi_mennyiseg,
          beszerzes_datuma = excluded.beszerzes_datuma, forras = excluded.forras, ar_auto = false;
  end if;

  -- a feliratkozók „látott” sorai az új Számra és elemeire (ne legyen hamis felkiáltójel)
  perform public.seed_issue_seen_for_subscribers(v_issue_id);

  return jsonb_build_object('issue_id', v_issue_id, 'component_ids', to_jsonb(v_ids), 'main_component_id', v_main_id);
end;
$$;

revoke all on function public.create_live_issue(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_live_issue(uuid, jsonb, jsonb) to authenticated;

notify pgrst, 'reload schema';
