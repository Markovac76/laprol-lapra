/* ============================================================
   42. lépés — (C3) ÍRÁSI JOGOK SZŰKÍTÉSE — VISSZAGÖRGETETT PRÓBA.

   FIGYELEM — ÉLŐ ADATBÁZISON FUT. CSAK a tulajdonos ELŐZETES, kifejezett jóváhagyásával futtatható.
   EGYETLEN tranzakcióban dolgozik, a végén MINDIG ROLLBACK; SOHA nem commitol. A migráció
   (laprol-lapra-42-irasi-jogok.sql) a tranzakción BELÜL fut le. A végén külön, friss kapcsolaton
   igazolja: a számlálók, a 37 definíció-hash, a 37 függvény-ACL és a hat tábla jogai azonosak az előttivel.
   SET LOCAL lock_timeout = 3s.

   Meglévő sorozathoz, Számhoz, munkaanyaghoz és személyes sorhoz NEM nyúl: a tranzakción belül
   létrehozott próba-felhasználókon és próbasorozatokon dolgozik. TRUNCATE-et NEM futtat (az élő táblát
   zárolná) — azt a jog lekérdezésével ellenőrzi.

   Menete: (1) a 39. lépés 34 lépéses forgatókönyve (a trial-39-jogosultsag.js-ből betűre átvéve) és a
   közvetlen írások listája a szűkítés ELŐTT, mentési pontban, visszagörgetve; (2) a migráció;
   (3) ugyanez UTÁNA; (4) összevetés. A szerepkörök valódiak (SET LOCAL ROLE authenticated / anon).

   Használat: node scripts/trial-42-irasi-jogok.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const SQL = fs.readFileSync(path.join(__dirname, "..", "laprol-lapra-42-irasi-jogok.sql"), "utf8");
const J = x => JSON.stringify(x);
const results = [];
const report = (name, ok, detail) => { results.push({ name, ok }); console.log(`  ${ok ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`); };
const TABLES = ["series", "issues", "components", "lists", "change_log", "global_counters"];

const STATE = `select
    (select count(*) from public.series)::int series, (select count(*) from public.issues)::int issues,
    (select count(*) from public.components)::int components, (select count(*) from public.member_status)::int member_status,
    (select count(*) from public.member_issue_data)::int member_issue_data, (select count(*) from public.member_seen)::int member_seen,
    (select count(*) from public.member_series)::int member_series, (select count(*) from public.members)::int members,
    (select count(*) from auth.users)::int auth_users,
    (select count(*) from public.draft_series)::int draft_series, (select count(*) from public.draft_issues)::int draft_issues,
    (select count(*) from public.draft_components)::int draft_components, (select count(*) from public.change_log)::int change_log,
    (select count(*) from public.image_proposals)::int image_proposals, (select count(*) from public.lists)::int lists,
    (select next_series_no from public.global_counters where id = 1)::int kovetkezo_sorozatszam,
    (select coalesce(sum(version),0) from public.series)::int ver_series, (select coalesce(sum(version),0) from public.issues)::int ver_issues,
    (select coalesce(sum(version),0) from public.components)::int ver_components,
    (select md5(string_agg(id::text || coalesce(kep_url,'') || upload_enabled::text || version::text || is_main::text || is_deleted::text, ',' order by id)) from public.components) as components_ujjlenyomat,
    (select md5(string_agg(id::text || coalesce(borito_url,'') || borito_upload_enabled::text || lifecycle || version::text, ',' order by id)) from public.series) as series_ujjlenyomat,
    (select md5(string_agg(id::text || tipus || ertek || megjelenites || sort_order::text, ',' order by id)) from public.lists) as lists_ujjlenyomat`;
const FNS = `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as f, md5(pg_get_functiondef(p.oid)) as h, coalesce(p.proacl::text, '(alap)') as acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' order by 1`;
const TACL = `select c.relname as t, coalesce(c.relacl::text, '(alap)') as acl,
      coalesce((select string_agg(a.attname || '=' || a.attacl::text, ';' order by a.attnum) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and a.attacl is not null), '') as oszlop_acl
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname = any($1) order by 1`;
const md5 = s => crypto.createHash("md5").update(s).digest("hex");

async function state(c, label) {
  const counts = (await c.query(STATE)).rows[0];
  const fns = (await c.query(FNS)).rows, tacl = (await c.query(TACL, [TABLES])).rows;
  console.log(`\n${label}`); Object.entries(counts).forEach(([k, v]) => console.log(`  ${k.padEnd(24)} ${v}`));
  console.log(`  ${"fuggvenyek".padEnd(24)} ${fns.length}`);
  console.log(`  ${"definicio_hash_osszesen".padEnd(24)} ${md5(fns.map(f => f.f + f.h).join(","))}`);
  console.log(`  ${"fuggveny_acl_osszesen".padEnd(24)} ${md5(fns.map(f => f.f + f.acl).join(","))}`);
  console.log(`  ${"tablajogok_osszesen".padEnd(24)} ${md5(tacl.map(t => t.t + t.acl + t.oszlop_acl).join(","))}`);
  return { counts, fns, tacl };
}

(async () => {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  let before;
  try {
    before = await state(c, "ELŐTTE (commitolt állapot):");
    // Él-e már a szűkítés? (az authenticated-nek az issues táblán már nincs táblaszintű UPDATE joga)
    const ELES = !(await c.query("select has_table_privilege('authenticated', 'public.issues', 'UPDATE') x")).rows[0].x;
    console.log(ELES ? "\nA szűkítés a futás elején MÁR ÉL — a próba az éles állapotot ellenőrzi (az „előtte” oldal is szűkített)." : "\nA szűkítés a futás elején még NEM él — a próba az előtte / utána különbséget ellenőrzi.");
    const owner = (await c.query(`select user_id from public.members where role='owner' limit 1`)).rows[0].user_id;
    // 48. lépés: él-e a 47-es jogosultsági higiénia? (az anon már nem olvashatja a series táblát). Ha igen: a 42-es migráció
    // önellenőrzése (anon: SELECT a hat táblán; authenticated: SELECT a global_counters-en) már nem teljesül, ezért NEM fut újra;
    // az anon semmit nem kap, a global_counters az authenticated-nek sem olvasható; a 22., 31., 32. lépés „permission denied”.
    const M47 = !(await c.query("select has_table_privilege('anon', 'public.series', 'SELECT') x")).rows[0].x;
    if (M47) console.log("A 47-es szűkítés MÁR ÉL: a 42-es migráció nem fut újra (az önellenőrzése a 47 előtti állapotot várja).");
    await c.query("BEGIN");
    await c.query("SET LOCAL lock_timeout = '3s'");
    await c.query("SET LOCAL statement_timeout = '120s'");
    const polBefore = md5(J((await c.query(`select schemaname, tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname in ('public','storage') order by 1,2,3`)).rows));
    // ======== a trial-39-jogosultsag.js-ből BETŰRE átvett rész: segédek + a 34 lépéses forgatókönyv ========
    const q = async (sql, p) => (await c.query(sql, p)).rows;
    let sp = 0;
    // Egy lépés a megadott szerepkörrel és felhasználóval, saját mentési pontban. Visszaad: {ok, v} vagy {ok:false, err, code}.
    const as = async (role, uid, fn, keep = true) => {
      const n = `s${++sp}`; await c.query(`SAVEPOINT ${n}`);
      try {
        await c.query(`select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role',$2,true), set_config('request.jwt.claims',$3,true)`,
          [uid || "", role || "", J(uid ? { sub: uid, role } : { role })]);
        if (role) await c.query(`SET LOCAL ROLE ${role}`);
        const v = await fn();
        await c.query("RESET ROLE");
        if (keep) await c.query(`RELEASE SAVEPOINT ${n}`); else await c.query(`ROLLBACK TO SAVEPOINT ${n}`);
        return { ok: true, v };
      } catch (e) {
        await c.query(`ROLLBACK TO SAVEPOINT ${n}`); await c.query("RESET ROLE");
        return { ok: false, err: e.message, code: e.code };
      }
    };
    const short = r => r.ok ? "OK" + (r.v === undefined || r.v === null ? "" : ": " + (typeof r.v === "string" ? r.v : J(r.v))) : "HIBA: " + r.err.split("\n")[0].slice(0, 110);

    const U = "39393939-3939-4939-8939-393939393939";     // a próba „sima” felhasználója (csak a tranzakcióban létezik)
    const D1 = "39000000-0000-4000-8000-000000000001";    // a javaslat (a kliens is maga generálja az azonosítót)
    const NAME = "PRÓBA 39 jogosultság";
    const T = (tipus, o = {}) => ({ tipus, main: false, required: true, id_rule: "nincs", default_azonosito_tipus: null, counts_for_color: true, default_megnevezes: null, ...o });

    // ---- A forgatókönyv: a kliens valódi útvonalai, a valódi szerepkörökkel ----
    async function scenario() {
      const out = {};
      const step = async (name, role, uid, fn) => { const r = await as(role, uid, fn); out[name] = short(r); return r; };
      const A = "authenticated";
      // 0. új felhasználó (az auth séma triggere → handle_new_user → members sor)
      await step("00 új felhasználó regisztrál → a trigger létrehozza a tag-sort (handle_new_user)", null, null, async () => {
        await q(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'proba-39@example.invalid')`, [U]);
        return (await q(`select role || '/' || status as r from public.members where user_id=$1`, [U]))[0].r; });
      // 1–3. sima felhasználó: javaslat beküldése (RLS + CHECK series_azonositok_error + triggerek), saját javaslat sablon-feltöltése
      await step("01 sima felhasználó: új sorozat javaslása sorozat-azonosítóval (RLS, CHECK, triggerek)", A, U, async () => {
        await q(`insert into public.draft_series (id, pool_type, pool_status, submitted_by, kiado, megnevezes, megjelenites, szin, components, component_template, azonositok)
                 values ($1,'new','incoming',$2,'egyeb',$3,'PRÓBA 39','#336699',$4,$5::jsonb,$6::jsonb)`,
          [D1, U, NAME, ["magazin", "figura"], J([T("magazin", { main: true }), T("figura")]), J([{ tipus: "issn", ertek: "1234-5678" }])]); });
      await step("02 sima felhasználó: hibás sorozat-azonosítóval a javaslat megáll (CHECK)", A, U, async () => {
        await q(`insert into public.draft_series (id, pool_type, pool_status, submitted_by, kiado, megnevezes, megjelenites, szin, components, azonositok)
                 values (gen_random_uuid(),'new','incoming',$1,'egyeb','PRÓBA 39 hibás','PRÓBA 39 h','#336699',$2,$3::jsonb)`, [U, ["magazin"], J([{ tipus: "issn", ertek: "12" }])]); });
      await step("03 sima felhasználó: saját javaslat sablon-feltöltése (propose_bulk_issues)", A, U, async () =>
        J((await q(`select public.propose_bulk_issues($1,$2::jsonb) r`, [D1, J([
          { lapszam: 1, cim: "Első", megjelenes: "2026-01-10", eredeti_ar: 1000, comps: [{ tipus: "magazin" }, { tipus: "figura", megnevezes: "Figura 1" }] },
          { lapszam: 2, cim: "Második", megjelenes: "2026-02-10", eredeti_ar: 1000, comps: [{ tipus: "magazin" }, { tipus: "figura", megnevezes: "Figura 2" }] }])]))[0].r));
      await step("04 sima felhasználó: a javaslatot a beküldés után már nem látja (RLS: is_staff)", A, U, async () => (await q(`select count(*)::int n from public.draft_series where id=$1`, [D1]))[0].n);
      await step("05 sima felhasználó: staff-függvényt nem futtathat (mark_draft_ready belső ellenőrzése)", A, U, async () => { await q(`select public.mark_draft_ready($1)`, [D1]); });
      // 6–12. staff: átvétel, feltöltés, ellenőrzések, Kész, visszaadás, Kész, publikálás
      await step("06 staff: a javaslat átvétele (RLS: draft_series update)", A, owner, async () =>
        (await q(`update public.draft_series set pool_status='claimed', claimed_by=$2, claimed_at=now() where id=$1 returning pool_status`, [D1, owner]))[0].pool_status);
      await step("07 staff: sablon-feltöltés a munkaanyagba (apply_draft_upload → ensure_draft_main, type_azonosito_tipus…)", A, owner, async () => {
        const r = (await q(`select public.apply_draft_upload($1,$2::jsonb) r`, [D1, J({ items: [{ id: null, new_id: "39000000-0000-4000-8000-0000000000a3", lapszam: 3, cim: "Harmadik", megjelenes: null, eredeti_ar: 1000,
          comps: [{ tipus: "figura", megnevezes: "Figura 3" }] }], delete_ids: [] })]))[0].r; return `új: ${r.uj}, új komponens: ${r.uj_komponens}, automatikus: ${r.auto_komponens}`; });
      await step("08 staff: lapszám-ütközés ellenőrzése (draft_lapszam_conflicts)", A, owner, async () => J((await q(`select public.draft_lapszam_conflicts($1,'[]'::jsonb) r`, [D1]))[0].r));
      await step("09 staff: „Kész” előtti figyelmeztetések (draft_ready_warnings → draft_type_field_issues)", A, owner, async () => J(((await q(`select public.draft_ready_warnings($1) r`, [D1]))[0].r || []).map(w => w.kod)));
      await step("10 staff: „Kész” (mark_draft_ready)", A, owner, async () => { await q(`select public.mark_draft_ready($1)`, [D1]); return (await q(`select pool_status from public.draft_series where id=$1`, [D1]))[0].pool_status; });
      await step("11 staff: visszaadás szerkesztésre, majd újra „Kész” (return_draft_to_edit)", A, owner, async () => { await q(`select public.return_draft_to_edit($1)`, [D1]); await q(`select public.mark_draft_ready($1)`, [D1]); return (await q(`select pool_status from public.draft_series where id=$1`, [D1]))[0].pool_status; });
      const pub = await step("12 staff: publikálás (publish_draft_series → next_series_no, pick_main_component, seed…)", A, owner, async () => {
        await q(`select public.publish_draft_series($1)`, [D1]); await q("SET CONSTRAINTS ALL IMMEDIATE");
        const s = (await q(`select id, azonositok::text az, (select count(*) from public.issues i where i.series_id=s.id)::int szam,
            (select count(*) from public.components k join public.issues i on i.id=k.issue_id where i.series_id=s.id)::int komp,
            (select count(*) from public.components k join public.issues i on i.id=k.issue_id where i.series_id=s.id and k.is_main)::int fo from public.series s where megnevezes=$1`, [NAME]))[0];
        return { id: s.id, t: `azonosító ${s.az}, ${s.szam} Szám, ${s.komp} komponens, ${s.fo} fő elem` }; });
      const L = pub.ok ? pub.v.id : null; if (pub.ok) out["12 staff: publikálás (publish_draft_series → next_series_no, pick_main_component, seed…)"] = "OK: " + pub.v.t;
      if (!L) return out;
      const ids = (await q(`select i.id as iid, (select k.id from public.components k where k.issue_id=i.id and k.tipus='figura' limit 1) as cid from public.issues i where i.series_id=$1 and i.lapszam=1`, [L]))[0];
      // 13–17. sima felhasználó: beválasztás, Saját adatlap, képjavaslat
      await step("13 sima felhasználó: sorozat beválasztása (RLS + protect_member_series) és alapvonal (seed_member_seen)", A, U, async () => {
        await q(`insert into public.member_series (user_id, series_id, is_selected) values ($1,$2,true)`, [U, L]); await q(`select public.seed_member_seen($1)`, [L]);
        return (await q(`select count(*)::int n from public.member_seen where user_id=$1`, [U]))[0].n + " látott sor"; });
      await step("14 sima felhasználó: Saját adatlap — státusz, darabszám, jegyzet (member_status)", A, U, async () =>
        J((await q(`insert into public.member_status (user_id, component_id, status, db, jegyzet) values ($1,$2,'megvan',2,'próba') returning status, db`, [U, ids.cid]))[0]));
      await step("15 sima felhasználó: Saját adatlap — fizetett ár (member_issue_data)", A, U, async () =>
        J((await q(`insert into public.member_issue_data (user_id, issue_id, fizetett_ar, beszerzesi_mennyiseg, ar_auto) values ($1,$2,900,1,false) returning fizetett_ar`, [U, ids.iid]))[0]));
      await step("16 sima felhasználó: képjavaslat komponensre (RLS: can_propose_image)", A, U, async () =>
        (await q(`insert into public.image_proposals (component_id, proposed_by, entity_type) values ($1,$2,'component') returning status`, [ids.cid, U]))[0].status);
      await step("17 sima felhasználó: képjavaslat sorozat-borítóra (RLS: can_propose_series_image)", A, U, async () =>
        (await q(`insert into public.image_proposals (series_id, proposed_by, entity_type) values ($1,$2,'series') returning status`, [L, U]))[0].status);
      await step("18 sima felhasználó: más felhasználó nevében nem írhat státuszt (RLS)", A, U, async () => {
        await q(`insert into public.member_status (user_id, component_id, status) values ($1,$2,'megvan')`, [owner, ids.cid]); });
      await step("19 sima felhasználó: törzsadatot nem írhat (RLS: is_staff)", A, U, async () => (await q(`update public.issues set cim='x' where id=$1 returning id`, [ids.iid])).length + " sor módosult");
      await step("20 sima felhasználó: új Számot nem vehet fel (create_live_issue belső ellenőrzése)", A, U, async () => {
        await q(`select public.create_live_issue($1,$2::jsonb,null)`, [L, J({ lapszam: 9, comps: [{ tipus: "magazin" }, { tipus: "figura", megnevezes: "X" }] })]); });
      // 21–25. staff: új Szám, alapvonal, szerkesztés és publikálás (log_field_change), publikálatlanná tétel, törlés
      const live = await step("21 staff: új Szám közvetlenül (create_live_issue → pick_main_component, seed…)", A, owner, async () => {
        const r = (await q(`select public.create_live_issue($1,$2::jsonb,null) r`, [L, J({ lapszam: 4, cim: "Negyedik", eredeti_ar: 1000, comps: [{ tipus: "magazin", azonosito: "2222-3333", azonosito_tipus: "issn" }, { tipus: "figura", megnevezes: "Figura 4" }] })]))[0].r;
        await q("SET CONSTRAINTS ALL IMMEDIATE");
        return { id: r.issue_id, t: `${r.component_ids.length} elem, fő elem: ${(await q(`select tipus from public.components where id=$1`, [r.main_component_id]))[0].tipus}` }; });
      if (live.ok) out["21 staff: új Szám közvetlenül (create_live_issue → pick_main_component, seed…)"] = "OK: " + live.v.t;
      await step("22 staff: a kliensből hívható alapvonal-függvény (seed_issue_seen_for_subscribers)", A, owner, async () => { await q(`select public.seed_issue_seen_for_subscribers($1)`, [live.ok ? live.v.id : ids.iid]); });
      await step("23 staff: szerkesztés indítása, cím és sorozat-azonosító módosítása, „Kész”, publikálás (log_field_change)", A, owner, async () => {
        const d2 = (await q(`select public.start_edit_draft($1) id`, [L]))[0].id;
        await q(`update public.draft_issues set cim='Első — javítva' where draft_series_id=$1 and lapszam=1`, [d2]);
        await q(`update public.draft_series set azonositok=$2::jsonb where id=$1`, [d2, J([{ tipus: "issn", ertek: "8765-4321" }])]);
        await q(`select public.mark_draft_ready($1)`, [d2]); await q(`select public.publish_draft_series($1)`, [d2]); await q("SET CONSTRAINTS ALL IMMEDIATE");
        const r = (await q(`select (select cim from public.issues where series_id=$1 and lapszam=1) cim, (select version from public.issues where series_id=$1 and lapszam=1) v,
            (select azonositok::text from public.series where id=$1) az,
            (select count(*)::int from public.change_log l where l.entity_id=$1 or l.entity_id in (select id from public.issues where series_id=$1)) naplo`, [L]))[0];
        return `cím: ${r.cim} (verzió ${r.v}), azonosító ${r.az}, naplósor: ${r.naplo}`; });
      await step("24 sima felhasználó: az új Számra alapvonalat kapott, a módosított Számon felkiáltójele van", A, U, async () =>
        (await q(`select count(*)::int n from public.member_seen where user_id=$1`, [U]))[0].n + " látott sor (10 + az új Szám 3 sora); " +
        (await q(`select count(*)::int n from public.issues i join public.member_seen m on m.entity_id=i.id and m.user_id=$2 where i.series_id=$1 and i.version > m.last_seen_version`, [L, U]))[0].n + " Szám változott");
      await step("25 staff: a sorozat publikálatlanná tétele (RLS: series update)", A, owner, async () => (await q(`update public.series set lifecycle='unpublished' where id=$1 returning lifecycle`, [L]))[0].lifecycle);
      await step("26 tulajdonos: törlés indítása (start_force_delete)", A, owner, async () => { await q(`select public.start_force_delete($1)`, [L]); return (await q(`select (force_delete_grace_end > now()) t from public.series where id=$1`, [L]))[0].t ? "türelmi idő fut" : "?"; });
      await step("27 sima felhasználó: törlésre jelölt sorozatot nem választhat újra (protect_member_series)", A, U, async () => {
        await q(`update public.member_series set is_selected=false, deselected_at=now() where user_id=$1 and series_id=$2`, [U, L]);
        await q(`update public.member_series set is_selected=true where user_id=$1 and series_id=$2`, [U, L]); });
      await step("28 sima felhasználó: leválasztás (RLS: member_series update)", A, U, async () => (await q(`update public.member_series set is_selected=false, deselected_at=now() where user_id=$1 and series_id=$2 returning is_selected`, [U, L]))[0].is_selected);
      await step("29 sima felhasználó: sorozatot nem törölhet (finalize_delete_series belső ellenőrzése)", A, U, async () => { await q(`select public.finalize_delete_series($1,$2)`, [L, NAME]); });
      await step("30 tulajdonos: végleges törlés (finalize_delete_series)", A, owner, async () => { await q(`select public.finalize_delete_series($1,$2)`, [L, NAME]); return (await q(`select count(*)::int n from public.series where id=$1`, [L]))[0].n + " sor maradt"; });
      // 31–33. bejelentkezés nélkül: az olvasás működik, a staff-táblák üresek, írni nem lehet
      await step("31 bejelentkezés nélkül: a nyilvános táblák olvashatók (series)", "anon", null, async () => ((await q(`select count(*)::int n from public.series`))[0].n > 0 ? "olvasható" : "üres"));
      await step("32 bejelentkezés nélkül: a munkaanyagok és a tagok nem látszanak (RLS: is_staff — nincs hiba, üres)", "anon", null, async () =>
        J((await q(`select (select count(*) from public.draft_series)::int munkaanyag, (select count(*) from public.members)::int tag, (select count(*) from public.member_series)::int feliratkozas`))[0]));
      await step("33 bejelentkezés nélkül: is_staff / is_active / my_role hívható, hamisat ad", "anon", null, async () => J((await q(`select public.is_staff() s, public.is_active() a, public.my_role() r`))[0]));
      return out;
    }

    // ======== az átvett rész vége ========

    // ---- A 42. lépés saját ellenőrzése: KÖZVETLEN ÍRÁSOK a hat táblára, szerepkörönként ----
    // A próba-adatot a tulajdonos (postgres) hozza létre a tranzakcióban; minden művelet saját mentési pontban fut,
    // és NEM marad meg (akkor sem, ha sikerül). Visszaad: {kulcs: "OK: UPDATE 1" | "HIBA [42501]: …"}.
    const P = "42424242-4242-4942-8942-424242424242";   // sima próba-felhasználó
    async function direct() {
      const res = {};
      await c.query("RESET ROLE");
      // a próba-adat a tulajdonos nevében jön létre (a user_id oszlopok alapértéke a bejelentkezett felhasználó)
      await c.query(`select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)`, [owner, J({ sub: owner, role: "authenticated" })]);
      await q(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'proba-42@example.invalid')`, [P]);
      const S = (await q(`insert into public.series (megnevezes, megjelenites, kiado, szin, components, component_template, lifecycle)
          values ('PRÓBA 42 jogok', 'PRÓBA 42', 'egyeb', '#336699', '{magazin,egyeb}', $1::jsonb, 'active') returning id`,
        [J(["magazin", "egyeb"].map(t => ({ tipus: t, main: t === "magazin", required: true, id_rule: "nincs", default_azonosito_tipus: null, counts_for_color: true, default_megnevezes: null })))]))[0].id;
      const I = (await q(`insert into public.issues (series_id, lapszam, cim, eredeti_ar) values ($1, 1, 'Próba Szám', 1000) returning id`, [S]))[0].id;
      const I2 = (await q(`insert into public.issues (series_id, lapszam, cim) values ($1, 2, 'Üres próba Szám') returning id`, [S]))[0].id;
      const K = (await q(`insert into public.components (issue_id, tipus, is_main) values ($1, 'magazin', true) returning id`, [I]))[0].id;
      const K2 = (await q(`insert into public.components (issue_id, tipus, is_main) values ($1, 'egyeb', false) returning id`, [I]))[0].id;
      const L = (await q(`insert into public.lists (tipus, ertek, megjelenites, sort_order) values ('forras', 'proba_42_sor', 'Próba 42 sor', 98) returning id`))[0].id;
      const G = (await q(`insert into public.change_log (entity_type, entity_id, field_name, old_value, new_value, version, is_current) values ('series', $1, 'proba', 'a', 'b', 1, true) returning id`, [S]))[0].id;
      await c.query("SET CONSTRAINTS ALL IMMEDIATE");
      const URL = "https://example.invalid/storage/v1/object/public/component-images/components/x/live.jpg?v=1";
      // [kulcs, leírás, sql, paraméterek]
      const TILTOTT = [
        ["T01", "Szám beszúrása (issues insert)", `insert into public.issues (series_id, lapszam, cim) values ($1, 3, 'Közvetlen')`, [S]],
        ["T02", "komponens beszúrása (components insert)", `insert into public.components (issue_id, tipus) values ($1, 'egyeb')`, [I]],
        ["T03", "komponens törlése (components delete)", `delete from public.components where id = $1`, [K2]],
        ["T04", "Szám törlése (issues delete)", `delete from public.issues where id = $1`, [I2]],
        ["T05", "issues.eredeti_ar módosítása", `update public.issues set eredeti_ar = 1 where id = $1`, [I]],
        ["T06", "issues.cim módosítása", `update public.issues set cim = 'Átírva' where id = $1`, [I]],
        ["T07", "issues.version módosítása", `update public.issues set version = 99 where id = $1`, [I]],
        ["T08", "issues.is_deleted módosítása", `update public.issues set is_deleted = true where id = $1`, [I2]],
        ["T09", "issues.lapszam módosítása", `update public.issues set lapszam = 77 where id = $1`, [I2]],
        ["T10", "components.is_main módosítása", `update public.components set is_main = false where id = $1`, [K]],
        ["T11", "components.azonosito módosítása", `update public.components set azonosito = 'X1' where id = $1`, [K]],
        ["T12", "components.version módosítása", `update public.components set version = 99 where id = $1`, [K]],
        ["T13", "components.megnevezes módosítása", `update public.components set megnevezes = 'Átírva' where id = $1`, [K]],
        ["T14", "components.tipus módosítása", `update public.components set tipus = 'konyv' where id = $1`, [K2]],
        ["T15", "components.adatok módosítása", `update public.components set adatok = '{"x":1}'::jsonb where id = $1`, [K2]],
        ["T16", "components.is_deleted módosítása", `update public.components set is_deleted = true where id = $1`, [K2]],
        ["T17", "components.azonosito_tipus módosítása", `update public.components set azonosito_tipus = 'egyeb' where id = $1`, [K2]],
        ["T18", "megengedett + tiltott oszlop EGY utasításban (kep_url + megnevezes)", `update public.components set kep_url = $2, megnevezes = 'Átírva' where id = $1`, [K, URL]],
        ["T19", "series.megnevezes módosítása", `update public.series set megnevezes = 'Átírva' where id = $1`, [S]],
        ["T20", "series.version módosítása", `update public.series set version = 99 where id = $1`, [S]],
        ["T21", "series.azonositok módosítása", `update public.series set azonositok = '[{"tipus":"issn","ertek":"1234-5678"}]'::jsonb where id = $1`, [S]],
        ["T22", "series.component_template módosítása", `update public.series set component_template = '[]'::jsonb where id = $1`, [S]],
        ["T23", "series.kiado módosítása", `update public.series set kiado = 'egyeb' where id = $1`, [S]],
        ["T24", "series.kod_szam módosítása", `update public.series set kod_szam = 999 where id = $1`, [S]],
        ["T25", "series.force_delete_requested_at módosítása", `update public.series set force_delete_requested_at = now() where id = $1`, [S]],
        ["T26", "megengedett + tiltott oszlop EGY utasításban (lifecycle + megjelenites)", `update public.series set lifecycle = 'unpublished', megjelenites = 'X' where id = $1`, [S]],
        ["T27", "sorozat beszúrása (series insert)", `insert into public.series (megnevezes, megjelenites) values ('Közvetlen sorozat', 'Közvetlen')`, []],
        ["T28", "sorozat törlése (series delete)", `delete from public.series where id = $1`, [S]],
        ["T29", "változásnapló beszúrása (change_log insert)", `insert into public.change_log (entity_type, entity_id, field_name, old_value, new_value, version, is_current) values ('series', $1, 'hamis', 'a', 'b', 1, true)`, [S]],
        ["T30", "változásnapló módosítása (change_log update)", `update public.change_log set is_current = false where id = $1`, [G]],
        ["T31", "változásnapló törlése (change_log delete)", `delete from public.change_log where id = $1`, [G]],
        ["T32", "sorozat-sorszámláló módosítása (global_counters update)", `update public.global_counters set next_series_no = next_series_no where id = 1`, []],
        ["T33", "Listák-sor törlése (lists delete)", `delete from public.lists where id = $1`, [L]],
        ["T34", "lists.ertek módosítása", `update public.lists set ertek = 'atirva' where id = $1`, [L]],
        ["T35", "lists.sort_order módosítása", `update public.lists set sort_order = 1 where id = $1`, [L]],
        ["T36", "lists.tipus módosítása", `update public.lists set tipus = 'kiado' where id = $1`, [L]],
      ];
      // A kliens MAI közvetlen írásai — pontosan azokkal az oszlopokkal és visszakéréssel, ahogy a kód küldi.
      const ENGEDETT = [
        ["E01", "kép feltöltése / cseréje, javaslat elfogadása — component-images.js: .update({kep_url}).eq(id)", `update public.components set kep_url = $2 where id = $1`, [K, URL]],
        ["E02", "kép törlése — .update({kep_url:null}).eq(id)", `update public.components set kep_url = null where id = $1`, [K]],
        ["E03", "feltöltés engedélyezése — .update({upload_enabled}).eq(id)", `update public.components set upload_enabled = true where id = $1`, [K]],
        ["E04", "borító feltöltése — .update({borito_url}).eq(id)", `update public.series set borito_url = $2 where id = $1`, [S, URL]],
        ["E05", "borító törlése — .update({borito_url:null}).eq(id)", `update public.series set borito_url = null where id = $1`, [S]],
        ["E06", "borító-feltöltés engedélyezése — .update({borito_upload_enabled}).eq(id)", `update public.series set borito_upload_enabled = true where id = $1`, [S]],
        ["E07", "publikálatlanná tétel — karbantartas.js: .update({lifecycle:'unpublished'}).eq(id)", `update public.series set lifecycle = 'unpublished' where id = $1`, [S]],
        ["E08", "újra aktívvá tétel — .update({lifecycle:'active'}).eq(id)", `update public.series set lifecycle = 'active' where id = $1`, [S]],
        ["E09", "Listák + — admin-forms.js: .insert({tipus, ertek, megjelenites, sort_order})", `insert into public.lists (tipus, ertek, megjelenites, sort_order) values ('forras', 'proba_42_uj', 'Próba 42 új', 99)`, []],
        ["E10", "Listák ✎ — .update({megjelenites}).eq(tipus).eq(ertek).select()", `update public.lists set megjelenites = 'Próba 42 átnevezve' where tipus = 'forras' and ertek = 'proba_42_sor' returning *`, []],
        // A PostgREST által generált utasítás két alakja (újabb: json_to_record a küldött oszlopokra; régebbi: json_populate_record a tábla sortípusára)
        ["E11", "kép — PostgREST-alak (json_to_record, RETURNING 1)", `with pgrst_source as (update public.components set kep_url = pgrst_body.kep_url from (select $2::json as json_data) pgrst_payload,
            lateral (select kep_url from json_to_record(pgrst_payload.json_data) as _(kep_url text)) pgrst_body where public.components.id = $1 returning 1) select count(*)::int as n from pgrst_source`, [K, J({ kep_url: URL })]],
        ["E12", "kép — PostgREST régebbi alakja (json_populate_record, RETURNING 1)", `with pgrst_source as (update public.components set kep_url = pgrst_body.kep_url
            from (select * from json_populate_record(null::public.components, $2::json)) pgrst_body where public.components.id = $1 returning 1) select count(*)::int as n from pgrst_source`, [K, J({ kep_url: URL })]],
        ["E13", "lifecycle — PostgREST-alak (json_to_record, RETURNING 1)", `with pgrst_source as (update public.series set lifecycle = pgrst_body.lifecycle from (select $2::json as json_data) pgrst_payload,
            lateral (select lifecycle from json_to_record(pgrst_payload.json_data) as _(lifecycle text)) pgrst_body where public.series.id = $1 returning 1) select count(*)::int as n from pgrst_source`, [S, J({ lifecycle: "unpublished" })]],
        ["E14", "Listák ✎ — PostgREST-alak (json_to_record, RETURNING a teljes sor)", `with pgrst_source as (update public.lists set megjelenites = pgrst_body.megjelenites from (select $1::json as json_data) pgrst_payload,
            lateral (select megjelenites from json_to_record(pgrst_payload.json_data) as _(megjelenites text)) pgrst_body where public.lists.tipus = 'forras' and public.lists.ertek = 'proba_42_sor' returning public.lists.*) select count(*)::int as n from pgrst_source`, [J({ megjelenites: "Próba 42 PostgREST" })]],
      ];
      const fmt = r => r.ok ? "OK: " + r.v : `HIBA [${r.code}]: ${r.err.split("\n")[0].slice(0, 90)}`;
      const exec = (sql, p) => async () => { const r = await c.query(sql, p); return `${r.command} ${r.rowCount}` + (r.rows && r.rows[0] && r.rows[0].n !== undefined ? ` (n=${r.rows[0].n})` : ""); };
      for (const [szerep, role, uid] of [["staff", "authenticated", owner], ["sima", "authenticated", P], ["anon", "anon", null]])
        for (const [k, , sql, p] of TILTOTT.concat(ENGEDETT)) res[`${szerep}/${k}`] = fmt(await as(role, uid, exec(sql, p), false));
      // a próba-adat érintetlen maradt? (egyik művelet sem maradhat meg)
      await c.query("RESET ROLE");
      res.__adat = J((await q(`select (select count(*) from public.issues where series_id=$1)::int szam, (select count(*) from public.components k join public.issues i on i.id=k.issue_id where i.series_id=$1)::int komp,
          (select coalesce(kep_url,'∅') || '/' || upload_enabled::text from public.components where id=$2) k, (select lifecycle || '/' || megnevezes || '/' || coalesce(borito_url,'∅') from public.series where id=$1) s,
          (select megjelenites from public.lists where id=$3) l, (select count(*) from public.lists where ertek like 'proba_42%')::int lsor, (select is_current from public.change_log where id=$4) g`, [S, K, L, G]))[0]);
      res.__leiras = Object.fromEntries(TILTOTT.concat(ENGEDETT).map(([k, d]) => [k, d]));
      res.__T = TILTOTT.map(x => x[0]); res.__E = ENGEDETT.map(x => x[0]);
      return res;
    }

    // ---- 1. ELŐTTE (mentési pontban, visszagörgetve) ----
    await c.query("SAVEPOINT elotte");
    const pre = await scenario();
    const preD = await direct();
    await c.query("ROLLBACK TO SAVEPOINT elotte");
    console.log("\nA forgatókönyv és a közvetlen írások a szűkítés ELŐTT lefutottak (mentési pontban, visszagörgetve).");

    // ---- 2. a migráció ----
    if (M47) console.log("A migráció NEM fut újra (a 47-es szűkítés él; a jogok a mostaniak).\n\nPróbák:");
    else { await c.query(SQL); console.log("A migráció lefutott a tranzakción belül (a záró önellenőrzése nem adott hibát).\n\nPróbák:"); }
    const mid = (await c.query(FNS)).rows;
    // 50. lépés: a 49-es migráció óta 38 függvény van — a darabszám a futás eleji állapotból jön.
    report(`K1 a migráció egyetlen függvény definícióját és hívási jogát sem változtatja meg (${before.fns.length} hash és ${before.fns.length} ACL azonos)`,
      mid.length === before.fns.length && mid.every((f, i) => before.fns[i].f === f.f && before.fns[i].h === f.h && before.fns[i].acl === f.acl));
    const polH = async () => md5(J((await c.query(`select schemaname, tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname in ('public','storage') order by 1,2,3`)).rows));
    report("K3 a sorszintű szabályok (policy-k) változatlanok", (await polH()) === polBefore);
    const mx = (await c.query(`select c.relname t, r.r,
        (select string_agg(p, ',' order by o) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) with ordinality x(p, o) where has_table_privilege(r.r, c.oid, p)) tabla,
        coalesce((select string_agg(a.attname, ',' order by a.attname) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped and has_column_privilege(r.r, c.oid, a.attnum, 'UPDATE')), '') upd
      from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join (values ('anon'), ('authenticated'), ('service_role')) r(r)
      where n.nspname = 'public' and c.relname = any($1) order by 1, 2`, [TABLES])).rows;
    console.log("      jogok a migráció után (táblaszint | módosítható oszlopok):");
    mx.forEach(m => console.log(`        ${m.t.padEnd(16)} ${m.r.padEnd(14)} ${(m.tabla || "–").padEnd(61)} | ${m.upd.split(",").filter(Boolean).length > 6 ? "minden oszlop" : (m.upd || "–")}`));
    const exp = { "components/authenticated": ["SELECT", "kep_url,upload_enabled"], "series/authenticated": ["SELECT", "borito_upload_enabled,borito_url,lifecycle"], "lists/authenticated": ["SELECT,INSERT", "megjelenites"],
      "issues/authenticated": ["SELECT", ""], "change_log/authenticated": ["SELECT", ""], "global_counters/authenticated": [M47 ? null : "SELECT", ""] };
    report(`K2 a jogok pontosan a vártak: az anon ${M47 ? "semmit nem kap (47. lépés)" : "mindenhol csak olvas"}; az authenticated a components 2, a series 3, a lists 1 oszlopát módosíthatja és a lists táblába beszúrhat${M47 ? ", a global_counters-t nem olvassa" : ""}; a service_role mindent megtart`,
      mx.every(m => m.r === "anon" ? (m.tabla === (M47 ? null : "SELECT") && m.upd === "") : m.r === "service_role" ? m.tabla === "SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN"
        : (exp[m.t + "/" + m.r] && m.tabla === exp[m.t + "/" + m.r][0] && m.upd === exp[m.t + "/" + m.r][1])));

    // ---- 3. UTÁNA ----
    await c.query("SAVEPOINT utana");
    const post = await scenario();
    const postD = await direct();
    await c.query("ROLLBACK TO SAVEPOINT utana");

    const TK = postD.__T, EK = postD.__E, DL = postD.__leiras;
    const den = v => /^HIBA \[42501\]: permission denied for table/.test(v);
    const wrote = v => /^OK: (INSERT|UPDATE|DELETE) [1-9]/.test(v) || /^OK: SELECT 1 \(n=[1-9]/.test(v);
    console.log("\n  KÖZVETLEN ÍRÁSOK staff (tulajdonos) nevében — TILTOTT lesz (ELŐTTE → UTÁNA):");
    TK.forEach(k => console.log(`    ${den(postD["staff/" + k]) ? "✔" : "✘"} ${k} ${DL[k]}\n        ${preD["staff/" + k]}  →  ${postD["staff/" + k]}`));
    report(`D1 staff nevében a ${TK.length} tiltott közvetlen írás mind „permission denied” (Szám / komponens / sorozat beszúrása és törlése, tiltott oszlopok, változásnapló, sorszámláló, Listák törlése)`, TK.every(k => den(postD["staff/" + k])), `${TK.filter(k => den(postD["staff/" + k])).length}/${TK.length}`);
    if (ELES) report("D2 (éles állapot) a tiltás a futás elején is élt: mind a 36 már „előtte” is „permission denied”", TK.every(k => den(preD["staff/" + k])), `${TK.filter(k => den(preD["staff/" + k])).length}/${TK.length}`);
    else report("D2 ugyanezek ELŐTTE egyike sem volt „permission denied” (ez volt a rés: a staff közvetlenül írhatott)", TK.every(k => !den(preD["staff/" + k])), `ebből ténylegesen írt volna: ${TK.filter(k => wrote(preD["staff/" + k])).length}`);
    console.log("\n  A KLIENS MAI KÖZVETLEN ÍRÁSAI staff nevében — MŰKÖDNEK (ELŐTTE = UTÁNA):");
    EK.forEach(k => console.log(`    ${wrote(postD["staff/" + k]) && preD["staff/" + k] === postD["staff/" + k] ? "✔" : "✘"} ${k} ${DL[k]}\n        ${postD["staff/" + k]}`));
    report(`D3 staff nevében a kliens ${EK.length} mai közvetlen írása működik, és betűre ugyanazt adja, mint előtte (kép, feltöltés engedélyezése, borító, lifecycle, Listák + és ✎; a PostgREST-alakú utasítások is)`,
      EK.every(k => wrote(postD["staff/" + k]) && preD["staff/" + k] === postD["staff/" + k]), `${EK.filter(k => wrote(postD["staff/" + k]) && preD["staff/" + k] === postD["staff/" + k]).length}/${EK.length}`);
    const all = TK.concat(EK);
    report(`D4 sima (nem staff) felhasználó a ${all.length} művelet egyikével sem ír semmit — sem előtte, sem utána`, all.every(k => !wrote(preD["sima/" + k]) && !wrote(postD["sima/" + k])),
      `utána: ${all.filter(k => den(postD["sima/" + k])).length} permission denied, ${all.filter(k => /^OK: (UPDATE|DELETE|SELECT) [01]( \(n=0\))?$/.test(postD["sima/" + k]) && !wrote(postD["sima/" + k])).length} „0 sor” (RLS), ${all.filter(k => /row-level security/.test(postD["sima/" + k])).length} RLS-hiba`);
    report(`D5 bejelentkezés nélkül (anon) mind a ${all.length} művelet „permission denied” — a megengedett oszlopokra is`, all.every(k => den(postD["anon/" + k])), `${all.filter(k => den(postD["anon/" + k])).length}/${all.length}`);
    report("D6 bejelentkezés nélkül ELŐTTE sem írt semmit (akkor a sorszintű szabály fogta meg)", all.every(k => !wrote(preD["anon/" + k])));
    report("D7 a próba-adat a műveletek után érintetlen (semmi nem maradt meg) — előtte és utána is", preD.__adat === postD.__adat && /"szam":2,"komp":2/.test(postD.__adat) && /"lsor":1/.test(postD.__adat), postD.__adat);

    const MUST_FAIL = ["02 ", "05 ", "18 ", "19 ", "20 ", "27 ", "29 "];
    if (M47) MUST_FAIL.push("22 ", "31 ", "32 ");   // 48. lépés: a 47-es szűkítés után ezek is védelmek
    // A 19. lépés maga egy közvetlen törzsadat-írás (sima felhasználó: update issues set cim …) — ez VÁRT MÓDON szigorodik:
    // előtte a sorszintű szabály miatt „0 sor módosult”, utána a táblajog hiánya miatt „permission denied”. Írás egyik esetben sincs.
    const VART = { "19 ": [/^OK: 0 sor módosult$/, /^HIBA: permission denied for table issues/] };
    console.log("\n  A 39. lépés forgatókönyve (ELŐTTE = UTÁNA, a 19. lépés várt szigorodásával):");
    let same = 0, vart = 0, okSteps = 0; const names = Object.keys(pre);
    for (const n of names) {
      const eq = pre[n] === post[n]; if (eq) same++;
      const vk = Object.keys(VART).find(p => n.startsWith(p)), ve = !!vk && VART[vk][0].test(pre[n] || "") && VART[vk][1].test(post[n] || ""); if (ve) vart++;
      const mustFail = MUST_FAIL.some(p => n.startsWith(p)), good = mustFail ? /^HIBA/.test(post[n] || "") : /^OK/.test(post[n] || "");
      if (good) okSteps++;
      console.log(`    ${(eq || ve) && good ? "✔" : "✘"} ${n}\n        ${eq ? post[n] : `ELŐTTE: ${pre[n]}  →  UTÁNA: ${post[n]}${ve ? "   (várt szigorodás)" : ""}`}`);
    }
    report(`F1 a 39. lépés forgatókönyvének 34 lépéséből 33 a szűkítés előtt és után betűre ugyanazt adja; a 19. lépés (sima felhasználó közvetlen törzsadat-írása) várt módon szigorodik: „0 sor módosult” → „permission denied”`,
      names.length === 34 && Object.keys(post).length === 34 && (ELES ? same === 34 : (same === 33 && vart === 1)), `azonos: ${same}/34, várt változás: ${vart}${ELES ? " (éles állapot: a 19. lépés már előtte is „permission denied”, ezért mind a 34 azonos)" : ""}`);
    report(`F2 a ${34 - MUST_FAIL.length} működő lépés sikeres (javaslat, sablon-feltöltés, „Kész”, publikálás, új Szám, szerkesztés indítása, Saját adatlap, képjavaslat, törlés indítása és véglegesítése), a ${MUST_FAIL.length} védelmi lépés hibát ad`, okSteps === names.length, `${okSteps}/${names.length}`);
    const end = (await c.query(FNS)).rows;
    report("F3 a próbák után a függvények definíciója és hívási joga változatlan", end.every((f, i) => f.acl === mid[i].acl && f.h === mid[i].h));
  } catch (e) {
    console.log("\nHIBA a próba közben:", e.message);
    report("a próba végigfutott", false, e.message);
  } finally {
    try { await c.query("ROLLBACK"); } catch (_) {}
    console.log("\n── ROLLBACK megtörtént ──");
    await c.end();
    const c2 = new Client({ connectionString: DATABASE_URL });
    await c2.connect();
    const fresh = await state(c2, "UTÁNA (külön, friss kapcsolaton):");
    await c2.end();
    const dc = Object.keys(before.counts).filter(k => String(before.counts[k]) !== String(fresh.counts[k]));
    const dh = fresh.fns.filter((f, i) => !before.fns[i] || before.fns[i].f !== f.f || before.fns[i].h !== f.h || before.fns[i].acl !== f.acl).map(f => f.f);
    const dt = fresh.tacl.filter((t, i) => !before.tacl[i] || before.tacl[i].acl !== t.acl || before.tacl[i].oszlop_acl !== t.oszlop_acl).map(t => t.t);
    console.log(dc.length || dh.length || dt.length || fresh.fns.length !== before.fns.length
      ? `\n✘ ELTÉRÉS: számláló [${dc.map(k => `${k}: ${before.counts[k]} → ${fresh.counts[k]}`).join("; ")}] függvény [${dh.join(", ")}] táblajog [${dt.join(", ")}]`
      : "\n✔ IGAZOLÁS: az ELŐTTE és az UTÁNA számlálók, a 37 definíció-hash, a 37 függvény-ACL és a hat tábla jogai azonosak — semmi nem maradt meg.");
    const bad = results.filter(r => !r.ok);
    console.log(`\nPróbák: ${results.length - bad.length}/${results.length} sikeres` + (bad.length ? ` — NEM sikerült: ${bad.map(r => r.name.split(" ")[0]).join(", ")}` : ""));
  }
})().catch(e => { console.error("Váratlan hiba:", e.message); process.exit(1); });
