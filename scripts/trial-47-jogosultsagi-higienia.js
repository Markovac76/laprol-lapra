/* ============================================================
   47. lépés — JOGOSULTSÁGI HIGIÉNIA — VISSZAGÖRGETETT PRÓBA.

   FIGYELEM — ÉLŐ ADATBÁZISON FUT. CSAK a tulajdonos ELŐZETES, kifejezett jóváhagyásával futtatható.
   EGYETLEN tranzakcióban dolgozik, a végén MINDIG ROLLBACK; SOHA nem commitol. A migráció
   (laprol-lapra-47-jogosultsagi-higienia.sql) a tranzakción BELÜL fut le. A végén külön, friss kapcsolaton
   igazolja: a számlálók, a 37 definíció-hash, a 37 függvény-ACL, a 18 tábla és a szekvencia jogai és az
   alapértelmezett jogok azonosak az előttivel. SET LOCAL lock_timeout = 3s.

   Meglévő sorozathoz, Számhoz, munkaanyaghoz és személyes sorhoz NEM nyúl: a tranzakción belül létrehozott
   próba-felhasználókon és próbasorozatokon dolgozik. TRUNCATE-et és a szekvencia léptetését NEM futtatja
   (az előbbi az élő táblát zárolná, az utóbbit a ROLLBACK nem vonná vissza) — ezeket a jog lekérdezésével ellenőrzi.

   Menete: (1) a 39. lépés 34 lépéses forgatókönyve (a trial-39-jogosultsag.js-ből betűre átvéve) és a
   közvetlen műveletek listája a szűkítés ELŐTT, mentési pontban, visszagörgetve; (2) a migráció;
   (3) ugyanez UTÁNA; (4) összevetés. A szerepkörök valódiak (SET LOCAL ROLE authenticated / anon).

   Használat: node scripts/trial-47-jogosultsagi-higienia.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const SQL = fs.readFileSync(path.join(__dirname, "..", "laprol-lapra-47-jogosultsagi-higienia.sql"), "utf8");
const J = x => JSON.stringify(x);
const results = [];
const report = (name, ok, detail) => { results.push({ name, ok }); console.log(`  ${ok ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`); };
const md5 = s => crypto.createHash("md5").update(s).digest("hex");

const STATE = `select
    (select count(*) from public.series)::int series, (select count(*) from public.issues)::int issues,
    (select count(*) from public.components)::int components, (select count(*) from public.member_status)::int member_status,
    (select count(*) from public.member_issue_data)::int member_issue_data, (select count(*) from public.member_seen)::int member_seen,
    (select count(*) from public.member_series)::int member_series, (select count(*) from public.members)::int members,
    (select count(*) from auth.users)::int auth_users,
    (select count(*) from public.draft_series)::int draft_series, (select count(*) from public.draft_issues)::int draft_issues,
    (select count(*) from public.draft_components)::int draft_components, (select count(*) from public.change_log)::int change_log,
    (select count(*) from public.image_proposals)::int image_proposals, (select count(*) from public.lists)::int lists,
    (select count(*) from public.counters)::int counters,
    (select next_series_no from public.global_counters where id = 1)::int kovetkezo_sorozatszam,
    (select last_value from public.change_log_id_seq)::bigint naplo_szekvencia,
    (select coalesce(sum(version),0) from public.series)::int ver_series, (select coalesce(sum(version),0) from public.issues)::int ver_issues,
    (select coalesce(sum(version),0) from public.components)::int ver_components,
    (select md5(string_agg(user_id::text || role || status || coalesce(display_name,''), ',' order by user_id)) from public.members) as members_ujjlenyomat,
    (select md5(string_agg(user_id::text || component_id::text || coalesce(status,'') || db::text || coalesce(jegyzet,''), ',' order by user_id, component_id)) from public.member_status) as member_status_ujjlenyomat`;
const FNS = `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as f, md5(pg_get_functiondef(p.oid)) as h, coalesce(p.proacl::text, '(alap)') as acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' order by 1`;
const TACL = `select c.relname as t, c.relkind as k, coalesce(c.relacl::text, '(alap)') as acl,
      coalesce((select string_agg(a.attname || '=' || a.attacl::text, ';' order by a.attnum) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and a.attacl is not null), '') as oszlop_acl
    from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','S','v','m','p','f') order by 1`;
const DACL = `select pg_get_userbyid(d.defaclrole) as szerep, coalesce(n.nspname, '*') as sema, d.defaclobjtype as tipus, d.defaclacl::text as acl
    from pg_default_acl d left join pg_namespace n on n.oid = d.defaclnamespace order by 1, 2, 3`;
const POL = `select schemaname, tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname in ('public','storage') order by 1,2,3`;

async function state(c, label) {
  const counts = (await c.query(STATE)).rows[0];
  const fns = (await c.query(FNS)).rows, tacl = (await c.query(TACL)).rows, dacl = (await c.query(DACL)).rows, pol = (await c.query(POL)).rows;
  const agg = { fuggvenyek: fns.length, definicio_hash_osszesen: md5(fns.map(f => f.f + f.h).join(",")), fuggveny_acl_osszesen: md5(fns.map(f => f.f + f.acl).join(",")),
    tablajogok_osszesen: md5(tacl.map(t => t.t + t.acl + t.oszlop_acl).join(",")), alapertelmezett_jogok: md5(J(dacl)), policy_ujjlenyomat: md5(J(pol)) };
  console.log(`\n${label}`); Object.entries({ ...counts, ...agg }).forEach(([k, v]) => console.log(`  ${k.padEnd(26)} ${v}`));
  return { counts, agg, fns, tacl };
}

(async () => {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  let before;
  try {
    before = await state(c, "ELŐTTE (commitolt állapot):");
    // Él-e már a szűkítés? (az anon már nem olvashatja a series táblát)
    const ELES = !(await c.query("select has_table_privilege('anon', 'public.series', 'SELECT') x")).rows[0].x;
    console.log(ELES ? "\nA szűkítés a futás elején MÁR ÉL — a próba az éles állapotot ellenőrzi (az „előtte” oldal is szűkített)." : "\nA szűkítés a futás elején még NEM él — a próba az előtte / utána különbséget ellenőrzi.");
    const owner = (await c.query(`select user_id from public.members where role='owner' limit 1`)).rows[0].user_id;
    await c.query("BEGIN");
    await c.query("SET LOCAL lock_timeout = '3s'");
    await c.query("SET LOCAL statement_timeout = '180s'");
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

    // ---- A 47. lépés saját ellenőrzése: KÖZVETLEN MŰVELETEK a többi táblán, szerepkörönként ----
    // A próba-adatot a tulajdonos (postgres) hozza létre a tranzakcióban; minden művelet saját mentési pontban fut,
    // és NEM marad meg (akkor sem, ha sikerül). A személyes műveleteket a PRÓBA-felhasználó végzi, nem a tulajdonos.
    const P = "47474747-4747-4947-8947-474747474747";   // sima próba-felhasználó
    const Zid = "00000000-0000-4000-8000-000000000000";
    async function direct() {
      const res = {};
      await c.query("RESET ROLE");
      await c.query(`select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)`, [owner, J({ sub: owner, role: "authenticated" })]);
      await q(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'proba-47@example.invalid')`, [P]);
      const TM = J(["magazin", "egyeb"].map(t => ({ tipus: t, main: t === "magazin", required: true, id_rule: "nincs", default_azonosito_tipus: null, counts_for_color: true, default_megnevezes: null })));
      const S = (await q(`insert into public.series (megnevezes, megjelenites, kiado, szin, components, component_template, lifecycle) values ('PRÓBA 47 jogok', 'PRÓBA 47', 'egyeb', '#336699', '{magazin,egyeb}', $1::jsonb, 'active') returning id`, [TM]))[0].id;
      const I = (await q(`insert into public.issues (series_id, lapszam, cim, eredeti_ar) values ($1, 1, 'Próba Szám', 1000) returning id`, [S]))[0].id;
      const I2 = (await q(`insert into public.issues (series_id, lapszam, cim) values ($1, 2, 'Második próba Szám') returning id`, [S]))[0].id;
      const K = (await q(`insert into public.components (issue_id, tipus, is_main) values ($1, 'magazin', true) returning id`, [I]))[0].id;
      const K2 = (await q(`insert into public.components (issue_id, tipus, is_main) values ($1, 'egyeb', false) returning id`, [I]))[0].id;
      await q(`insert into public.member_series (user_id, series_id, is_selected) values ($1, $2, true)`, [P, S]);
      await q(`insert into public.member_status (user_id, component_id, status, db) values ($1, $2, 'hianyzik', 1)`, [P, K]);
      await q(`insert into public.member_issue_data (user_id, issue_id, fizetett_ar, beszerzesi_mennyiseg, ar_auto) values ($1, $2, 500, 1, false)`, [P, I]);
      await q(`insert into public.member_seen (user_id, entity_type, entity_id, last_seen_version) values ($1, 'component', $2, 1)`, [P, K]);
      const D = (await q(`insert into public.draft_series (pool_type, pool_status, submitted_by, kiado, megnevezes, megjelenites, szin, components) values ('new','incoming',$1,'egyeb','PRÓBA 47 javaslat','PRÓBA 47 j','#336699','{magazin}') returning id`, [P]))[0].id;
      const DS = (await q(`insert into public.draft_series (pool_type, pool_status, submitted_by, claimed_by, claimed_at, kiado, megnevezes, megjelenites, szin, components, component_template)
          values ('new','claimed',$1,$1,now(),'egyeb','PRÓBA 47 munkaanyag','PRÓBA 47 m','#336699','{magazin,egyeb}',$2::jsonb) returning id`, [owner, TM]))[0].id;
      const DI = (await q(`insert into public.draft_issues (draft_series_id, lapszam, cim) values ($1, 1, 'Munkaanyag-Szám') returning id`, [DS]))[0].id;
      const DC = (await q(`insert into public.draft_components (draft_issue_id, tipus, is_main) values ($1, 'magazin', true) returning id`, [DI]))[0].id;
      const DC2 = (await q(`insert into public.draft_components (draft_issue_id, tipus, is_main) values ($1, 'egyeb', false) returning id`, [DI]))[0].id;
      const IP = (await q(`insert into public.image_proposals (component_id, proposed_by, entity_type) values ($1, $2, 'component') returning id`, [K, P]))[0].id;
      await c.query("SET CONSTRAINTS ALL IMMEDIATE");
      const UPS = (t, cols, key) => `insert into public.${t} (${cols.join(", ")}) values (${cols.map((_, i) => "$" + (i + 1)).join(", ")}) on conflict (${key}) do update set ${cols.map(x => `${x} = excluded.${x}`).join(", ")}`;
      // [kulcs, szerepkör, leírás, sql, paraméterek]  — MEGY: a kliens MAI műveletei, pontosan azokkal az oszlopokkal és visszakéréssel, ahogy a kód küldi
      const MEGY = [
        ["M01", "sima", "„megvan” jelölés, darabszám, jegyzet — personal.js: member_status .upsert (meglévő sor)", UPS("member_status", ["user_id", "component_id", "status", "db", "jegyzet"], "user_id, component_id"), [P, K, "megvan", 2, "próba"]],
        ["M02", "sima", "ugyanez új sorra — member_status .upsert (beszúrás)", UPS("member_status", ["user_id", "component_id", "status", "db", "jegyzet"], "user_id, component_id"), [P, K2, "megvan", 1, null]],
        ["M03", "sima", "saját jelölések törlése (leválasztás, törölt Szám nyugtázása) — member_status .delete", `delete from public.member_status where user_id = $1 and component_id = any($2::uuid[])`, [P, [K]]],
        ["M04", "sima", "fizetett ár, beszerzés — personal.js: member_issue_data .upsert (meglévő sor)", UPS("member_issue_data", ["user_id", "issue_id", "fizetett_ar", "beszerzesi_mennyiseg", "beszerzes_datuma", "forras", "ar_auto"], "user_id, issue_id"), [P, I, 900, 2, "2026-01-05", null, false]],
        ["M05", "sima", "ugyanez új sorra — member_issue_data .upsert (beszúrás)", UPS("member_issue_data", ["user_id", "issue_id", "fizetett_ar", "ar_auto"], "user_id, issue_id"), [P, I2, 700, true]],
        ["M06", "sima", "saját beszerzési adat törlése — member_issue_data .delete", `delete from public.member_issue_data where user_id = $1 and issue_id = $2`, [P, I]],
        ["M07", "sima", "felkiáltójel nyugtázása — changes.js: member_seen .upsert (meglévő sor)", UPS("member_seen", ["user_id", "entity_type", "entity_id", "last_seen_version"], "user_id, entity_type, entity_id"), [P, "component", K, 5]],
        ["M08", "sima", "ugyanez új sorra — member_seen .upsert (beszúrás)", UPS("member_seen", ["user_id", "entity_type", "entity_id", "last_seen_version"], "user_id, entity_type, entity_id"), [P, "issue", I, 1]],
        ["M09", "sima", "sorozat beválasztása — my-series.js: member_series .upsert", UPS("member_series", ["user_id", "series_id", "is_selected", "selected_at"], "user_id, series_id"), [P, S, true, "2026-10-14T08:00:00Z"]],
        ["M10", "sima", "sorozat leválasztása — member_series .update({is_selected, deselected_at})", `update public.member_series set is_selected = false, deselected_at = now() where user_id = $1 and series_id = $2`, [P, S]],
        ["M11", "sima", "új sorozat javaslása — series-proposal.js: draft_series .insert", `insert into public.draft_series (id, pool_type, pool_status, submitted_by, kiado, kategoria, megnevezes, megjelenites, szin, components, component_template, azonositok)
            values (gen_random_uuid(), 'new', 'incoming', $1, 'egyeb', null, 'PRÓBA 47 új javaslat', 'PRÓBA 47 u', '#336699', '{magazin}', $2::jsonb, '[]'::jsonb)`, [P, J([{ tipus: "magazin", main: true, required: true, id_rule: "nincs", default_azonosito_tipus: null, counts_for_color: true, default_megnevezes: null }])]],
        ["M12", "sima", "képjavaslat beküldése — component-images.js: image_proposals .insert().select().single()", `insert into public.image_proposals (entity_type, proposed_by, component_id) values ('component', $1, $2) returning *`, [P, K2]],
        ["M13", "sima", "saját képjavaslat törlése sikertelen feltöltés után — image_proposals .delete (szabály nincs rá: 0 sor)", `delete from public.image_proposals where id = $1`, [IP]],
        ["M14", "sima", "olvasás: sorozatok, Számok, komponensek, Listák, típusleírás, változásnapló, képjavaslatok", `select ((select count(*) from public.series) > 0 and (select count(*) from public.issues) > 0 and (select count(*) from public.components) > 0 and (select count(*) from public.lists) > 0
            and (select count(*) from public.component_type_defs) = 7 and (select count(*) from public.change_log) > 0 and (select count(*) from public.image_proposals) > 0)::int as n`, []],
        ["M15", "sima", "olvasás: a saját személyes sorai és a saját tag-sora (és csak azok)", `select ((select count(*) from public.member_status) = 1 and (select count(*) from public.member_issue_data) = 1 and (select count(*) from public.member_seen) = 1
            and (select count(*) from public.member_series) = 1 and (select count(*) from public.members) = 1 and (select count(*) from public.draft_series) = 0)::int as n`, []],
        ["M20", "staff", "javaslat átvétele — karbantartas.js: draft_series .update({pool_status, claimed_by, claimed_at}).eq(pool_status,'incoming')", `update public.draft_series set pool_status = 'claimed', claimed_by = $2, claimed_at = now() where id = $1 and pool_status = 'incoming'`, [D, owner]],
        ["M21", "staff", "foglalás elengedése — draft_series .update({pool_status:'incoming', claimed_by:null, claimed_at:null})", `update public.draft_series set pool_status = 'incoming', claimed_by = null, claimed_at = null where id = $1`, [DS]],
        ["M22", "staff", "sorozat-adatok mentése a munkaanyagban — draft_series .update({kiado, kategoria, megnevezes, megjelenites, szin, components, component_template, azonositok})",
          `update public.draft_series set kiado = 'egyeb', kategoria = null, megnevezes = 'PRÓBA 47 átírva', megjelenites = 'PRÓBA 47 á', szin = '#112233', components = '{magazin,egyeb}', component_template = $2::jsonb, azonositok = '[{"tipus":"issn","ertek":"1234-5678"}]'::jsonb where id = $1`, [DS, TM]],
        ["M23", "staff", "munkaanyag törlése — draft_series .delete", `delete from public.draft_series where id = $1`, [DS]],
        ["M24", "staff", "új Szám a munkaanyagban — draft-items.js: draft_issues .insert", `insert into public.draft_issues (id, draft_series_id, lapszam, cim, megjelenes, eredeti_ar) values (gen_random_uuid(), $1, 2, 'Új munkaanyag-Szám', '2026-02-01', 1500)`, [DS]],
        ["M25", "staff", "Szám mentése a munkaanyagban — draft_issues .update(masterPayload)", `update public.draft_issues set lapszam = 3, cim = 'Átírva', megjelenes = '2026-03-01', eredeti_ar = 1600 where id = $1`, [DI]],
        ["M26", "staff", "Szám törlésre jelölése — draft_issues .update({deleted})", `update public.draft_issues set deleted = true where id = $1`, [DI]],
        ["M27", "staff", "Szám törlése a munkaanyagból — draft_issues .delete", `delete from public.draft_issues where id = $1`, [DI]],
        ["M28", "staff", "Gyors Excel: Szám a szerkesztési munkaanyagba — excel.js: draft_issues .insert().select().single()", `insert into public.draft_issues (draft_series_id, source_issue_id, cim, megjelenes, eredeti_ar, lapszam) values ($1, null, 'Excelből', null, 990, 4) returning *`, [DS]],
        ["M29", "staff", "új elem a munkaanyagban — draft_components .insert().select().single()", `insert into public.draft_components (tipus, azonosito_tipus, azonosito, megnevezes, adatok, draft_issue_id, source_component_id) values ('egyeb', null, null, 'Új elem', '{}'::jsonb, $1, null) returning *`, [DI]],
        ["M30", "staff", "elem mentése — draft_components .update(cpayload)", `update public.draft_components set tipus = 'egyeb', azonosito_tipus = null, azonosito = 'X1', megnevezes = 'Átírva', adatok = '{}'::jsonb where id = $1`, [DC2]],
        ["M31", "staff", "fő elem átállítása — draft_components .update({is_main}) két lépésben", `with a as (update public.draft_components set is_main = false where draft_issue_id = $1 and id <> $2 and is_main = true returning 1) update public.draft_components set is_main = true where id = $2`, [DI, DC2]],
        ["M32", "staff", "elem törlésre jelölése — draft_components .update({deleted:true, is_main:false})", `update public.draft_components set deleted = true, is_main = false where id = $1`, [DC2]],
        ["M33", "staff", "elem törlése — draft_components .delete", `delete from public.draft_components where id = $1`, [DC2]],
        ["M34", "staff", "képjavaslat elfogadása — image_proposals .update({status:'approved', decided_at, decided_by})", `update public.image_proposals set status = 'approved', decided_at = now(), decided_by = $2 where id = $1`, [IP, owner]],
        ["M35", "staff", "képjavaslat elutasítása — image_proposals .update({status:'rejected', decided_at, decided_by})", `update public.image_proposals set status = 'rejected', decided_at = now(), decided_by = $2 where id = $1`, [IP, owner]],
        ["M36", "staff", "felhasználó letiltása — admin-users.js: members .update({status:'disabled'}).eq(user_id)", `update public.members set status = 'disabled' where user_id = $1`, [P]],
        ["M37", "staff", "felhasználó visszaengedése — members .update({status:'active'})", `update public.members set status = 'active' where user_id = $1`, [P]],
        ["M38", "staff", "admin jog adása (tulajdonos) — members .update({role:'admin'})", `update public.members set role = 'admin' where user_id = $1`, [P]],
        ["M39", "staff", "admin jog visszavonása — members .update({role:'user'})", `update public.members set role = 'user' where user_id = $1`, [P]],
        ["M40", "staff", "olvasás: minden tag, minden feliratkozás, a munkaanyagok (Karbantartás, Felhasználók)", `select ((select count(*) from public.members) >= 3 and (select count(*) from public.member_series) >= 1 and (select count(*) from public.draft_series) >= 2
            and (select count(*) from public.draft_issues) >= 1 and (select count(*) from public.draft_components) >= 2)::int as n`, []],
      ];
      // TILT: ezeknek a szűkítés UTÁN „permission denied” a helyes eredménye (a megadott szerepkörrel)
      const TILT = [
        ["T01", "staff", "tag-sor beszúrása (members insert)", `insert into public.members (user_id, role, status) values ($1, 'user', 'active')`, [Zid]],
        ["T02", "staff", "tag-sor törlése (members delete)", `delete from public.members where user_id = $1`, [P]],
        ["T03", "staff", "members.display_name módosítása", `update public.members set display_name = 'Átírva' where user_id = $1`, [P]],
        ["T04", "staff", "members.created_at módosítása", `update public.members set created_at = now() where user_id = $1`, [P]],
        ["T05", "staff", "megengedett + tiltott oszlop EGY utasításban (status + display_name)", `update public.members set status = 'disabled', display_name = 'X' where user_id = $1`, [P]],
        ["T06", "sima", "„látott” sor törlése (member_seen delete)", `delete from public.member_seen where user_id = $1`, [P]],
        ["T07", "sima", "feliratkozás törlése (member_series delete)", `delete from public.member_series where user_id = $1`, [P]],
        ["T08", "staff", "image_proposals.component_id módosítása", `update public.image_proposals set component_id = $2 where id = $1`, [IP, K2]],
        ["T09", "staff", "image_proposals.proposed_by módosítása", `update public.image_proposals set proposed_by = $2 where id = $1`, [IP, owner]],
        ["T10", "staff", "megengedett + tiltott oszlop EGY utasításban (status + created_at)", `update public.image_proposals set status = 'approved', created_at = now() where id = $1`, [IP]],
        ["T11", "staff", "a régi counters tábla olvasása", `select count(*)::int as n from public.counters`, []],
        ["T12", "sima", "a régi counters tábla írása", `insert into public.counters (user_id, next_series_no) values ($1, 1)`, [P]],
        ["T13", "staff", "a sorozat-sorszámláló olvasása (global_counters)", `select count(*)::int as n from public.global_counters`, []],
        ["T14", "staff", "az „életjel” tábla olvasása (system_heartbeat)", `select count(*)::int as n from public.system_heartbeat`, []],
        ["T15", "staff", "az „életjel” tábla írása (system_heartbeat)", `update public.system_heartbeat set pinged_at = now() where id = 1`, []],
        ["T16", "staff", "a típusleírás írása (component_type_defs)", `update public.component_type_defs set csalad = csalad where tipus = 'magazin'`, []],
        ["T17", "staff", "a belső alapvonal-függvény közvetlen hívása (seed_issue_seen_for_subscribers)", `select public.seed_issue_seen_for_subscribers($1)`, [I]],
      ];
      const fmt = r => r.ok ? "OK: " + r.v : `HIBA [${r.code}]: ${r.err.split("\n")[0].slice(0, 90)}`;
      const exec = (sql, p) => async () => { const r = await c.query(sql, p); return `${r.command} ${r.rowCount}` + (r.rows && r.rows[0] && r.rows[0].n !== undefined ? ` (n=${r.rows[0].n})` : ""); };
      const R = { staff: ["authenticated", owner], sima: ["authenticated", P], anon: ["anon", null] };
      for (const [k, szerep, , sql, p] of MEGY.concat(TILT)) {
        res[`${szerep}/${k}`] = fmt(await as(...R[szerep], exec(sql, p), false));          // a saját szerepkörével
        res[`anon/${k}`] = fmt(await as(...R.anon, exec(sql, p), false));                   // bejelentkezés nélkül
        if (szerep === "staff") res[`sima/${k}`] = fmt(await as(...R.sima, exec(sql, p), false));   // a staff-műveletek sima felhasználóval
      }
      await c.query("RESET ROLE");
      res.__adat = J((await q(`select (select count(*) from public.member_status where user_id=$1)::int ms, (select status || '/' || db from public.member_status where user_id=$1 and component_id=$2) ms1,
          (select count(*) from public.member_issue_data where user_id=$1)::int mi, (select count(*) from public.member_seen where user_id=$1)::int seen, (select is_selected from public.member_series where user_id=$1) sel,
          (select role || '/' || status from public.members where user_id=$1) tag, (select pool_status from public.draft_series where id=$3) d, (select pool_status || '/' || megnevezes from public.draft_series where id=$4) ds,
          (select count(*) from public.draft_issues where draft_series_id=$4)::int di, (select count(*) from public.draft_components where draft_issue_id=$5)::int dc, (select status from public.image_proposals where id=$6) ip,
          (select count(*) from public.image_proposals where proposed_by=$1)::int ipn`, [P, K, D, DS, DI, IP]))[0]);
      res.__M = MEGY.map(x => [x[0], x[1], x[2]]); res.__T = TILT.map(x => [x[0], x[1], x[2]]);
      return res;
    }

    // ---- 1. ELŐTTE (mentési pontban, visszagörgetve) ----
    const polBefore = md5(J((await c.query(POL)).rows));
    await c.query("SAVEPOINT elotte");
    const pre = await scenario();
    const preD = await direct();
    await c.query("ROLLBACK TO SAVEPOINT elotte");
    console.log("\nA forgatókönyv és a közvetlen műveletek a szűkítés ELŐTT lefutottak (mentési pontban, visszagörgetve).");

    // ---- 2. a migráció ----
    await c.query(SQL);
    console.log("A migráció lefutott a tranzakción belül (a záró önellenőrzése nem adott hibát).\n\nPróbák:");
    const mid = (await c.query(FNS)).rows;
    const SEED = "seed_issue_seen_for_subscribers(p_issue_id uuid)";
    report("K1 a migráció egyetlen függvény definícióját sem változtatja meg (37 hash azonos); a hívási jog pontosan egy függvénynél változik (seed_issue_seen_for_subscribers: az authenticated kikerül)",
      mid.length === 37 && mid.every((f, i) => before.fns[i].f === f.f && before.fns[i].h === f.h && (f.f === SEED ? f.acl === "{postgres=X/postgres,service_role=X/postgres}" : before.fns[i].acl === f.acl)),
      mid.find(f => f.f === SEED).acl);
    report("K2 a sorszintű szabályok (policy-k) változatlanok", md5(J((await c.query(POL)).rows)) === polBefore);
    const mx = (await c.query(`select c.relname t, r.r,
        coalesce((select string_agg(p, ',' order by o) from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) with ordinality x(p, o) where has_table_privilege(r.r, c.oid, p)), '') tabla,
        coalesce((select string_agg(a.attname, ',' order by a.attname) from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped and has_column_privilege(r.r, c.oid, a.attnum, 'UPDATE')), '') upd,
        (select count(*)::int from pg_attribute a where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) n
      from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join (values ('anon'), ('authenticated'), ('service_role')) r(r)
      where n.nspname = 'public' and c.relkind = 'r' order by 1, 2`)).rows;
    console.log("      jogok a migráció után (táblaszint | módosítható oszlopok):");
    mx.filter(m => m.r !== "service_role").forEach(m => console.log(`        ${m.t.padEnd(20)} ${m.r.padEnd(14)} ${(m.tabla || "–").padEnd(28)} | ${m.upd.split(",").filter(Boolean).length === m.n ? "minden oszlop" : (m.upd || "–")}`));
    report("K3 az anon egyik táblán sem kap semmit (18 tábla); a service_role mindent megtart", mx.filter(m => m.r === "anon").length === 18 && mx.every(m => m.r === "anon" ? (m.tabla === "" && m.upd === "") : m.r === "service_role" ? m.tabla === "SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN" : true));
    report("K4 az authenticated egyik táblán sem kap TRUNCATE, REFERENCES, TRIGGER, MAINTAIN jogot", mx.filter(m => m.r === "authenticated").every(m => !/TRUNCATE|REFERENCES|TRIGGER|MAINTAIN/.test(m.tabla)));
    const sq = (await c.query(`select has_sequence_privilege('anon','public.change_log_id_seq','USAGE') a, has_sequence_privilege('authenticated','public.change_log_id_seq','USAGE') b, has_sequence_privilege('service_role','public.change_log_id_seq','USAGE') s`)).rows[0];
    report("K5 a változásnapló szekvenciáját az anon és az authenticated nem használhatja (a service_role igen)", !sq.a && !sq.b && sq.s);
    // alapértelmezett jogok: próba-tábla és próba-szekvencia a tranzakcióban
    await c.query("SAVEPOINT dpr");
    await c.query("create table public.zz_jog_proba (id int primary key, x text)"); await c.query("create sequence public.zz_jog_proba_seq");
    const dp = (await c.query(`select (select coalesce(relacl::text,'(nincs külön ACL: csak a tulajdonos)') from pg_class where oid='public.zz_jog_proba'::regclass) t, (select coalesce(relacl::text,'(nincs külön ACL: csak a tulajdonos)') from pg_class where oid='public.zz_jog_proba_seq'::regclass) s,
        has_table_privilege('anon','public.zz_jog_proba','SELECT') a, has_table_privilege('authenticated','public.zz_jog_proba','SELECT') b, has_table_privilege('service_role','public.zz_jog_proba','INSERT') sv`)).rows[0];
    await c.query("ROLLBACK TO SAVEPOINT dpr");
    report("K6 alapértelmezett jogok: egy ÚJ tábla és szekvencia az anon és az authenticated szerepkörnek semmit nem ad (a service_role megkapja)", !dp.a && !dp.b && dp.sv && !/anon|authenticated/.test(dp.t + dp.s), `tábla: ${dp.t} | szekvencia: ${dp.s}`);

    // ---- 3. UTÁNA ----
    await c.query("SAVEPOINT utana");
    const post = await scenario();
    const postD = await direct();
    await c.query("ROLLBACK TO SAVEPOINT utana");

    const ML = postD.__M, TL = postD.__T;
    const den = v => /^HIBA \[42501\]: permission denied for (table|function|sequence)/.test(v || "");
    const wrote = v => /^OK: (INSERT|UPDATE|DELETE) [1-9]/.test(v || "") || /^OK: SELECT 1 \(n=[1-9]/.test(v || "");
    const SZ = { staff: "staff (tulajdonos)", sima: "sima felhasználó" };
    console.log("\n  A KLIENS MAI MŰVELETEI a saját szerepkörükkel — MŰKÖDNEK (ELŐTTE = UTÁNA):");
    ML.forEach(([k, sz, d]) => console.log(`    ${/^OK/.test(postD[sz + "/" + k]) && preD[sz + "/" + k] === postD[sz + "/" + k] ? "✔" : "✘"} ${k} [${sz}] ${d}\n        ${preD[sz + "/" + k] === postD[sz + "/" + k] ? postD[sz + "/" + k] : `ELŐTTE: ${preD[sz + "/" + k]}  →  UTÁNA: ${postD[sz + "/" + k]}`}`));
    const mok = ML.filter(([k, sz]) => /^OK/.test(postD[sz + "/" + k]) && preD[sz + "/" + k] === postD[sz + "/" + k]);
    report(`D1 a kliens ${ML.length} mai művelete (személyes mentés, feliratkozás, javaslat, képjavaslat, a munkaanyag szerkesztése, elbírálás, felhasználó-kezelés, olvasás) működik, és betűre ugyanazt adja, mint előtte`, mok.length === ML.length, `${mok.length}/${ML.length}`);
    report("D2 ezek közül az írások ténylegesen írtak is (nem csak hiba nélkül futottak) — kivétel a saját képjavaslat törlése, amelyre nincs szabály (0 sor, előtte is)", ML.filter(([k]) => k !== "M13").every(([k, sz]) => wrote(postD[sz + "/" + k])), `M13: ${postD["sima/M13"]}`);
    console.log("\n  TILTOTT közvetlen műveletek (ELŐTTE → UTÁNA):");
    TL.forEach(([k, sz, d]) => console.log(`    ${den(postD[sz + "/" + k]) ? "✔" : "✘"} ${k} [${sz}] ${d}\n        ${preD[sz + "/" + k]}  →  ${postD[sz + "/" + k]}`));
    report(`D3 a ${TL.length} tiltott közvetlen művelet mind „permission denied” (tag-sor beszúrása / törlése, tiltott oszlopok, „látott” és feliratkozás törlése, a nem használt táblák, a belső függvény)`, TL.every(([k, sz]) => den(postD[sz + "/" + k])), `${TL.filter(([k, sz]) => den(postD[sz + "/" + k])).length}/${TL.length}`);
    const all = ML.concat(TL);
    report(`D4 bejelentkezés nélkül (anon) mind a ${all.length} művelet „permission denied” — az olvasás is`, all.every(([k]) => den(postD["anon/" + k])), `${all.filter(([k]) => den(postD["anon/" + k])).length}/${all.length}`);
    if (!ELES) report("D5 bejelentkezés nélkül ELŐTTE sem írt semmit (a sorszintű szabály fogta meg), de OLVASNI tudott — ez szűnik meg", all.every(([k]) => !/^OK: (INSERT|UPDATE|DELETE) [1-9]/.test(preD["anon/" + k])) && /^OK: SELECT 1/.test(preD["anon/M14"]), `a nyilvános táblák olvasása előtte: ${preD["anon/M14"]}`);
    else report("D5 (éles állapot) bejelentkezés nélkül már a futás elején is minden „permission denied” volt", all.every(([k]) => den(preD["anon/" + k])));
    const st = all.filter(([, sz]) => sz === "staff");
    report(`D6 sima (nem staff) felhasználó a ${st.length} staff-művelet egyikével sem ír semmit — sem előtte, sem utána`, st.every(([k]) => !/^OK: (INSERT|UPDATE|DELETE) [1-9]/.test(preD["sima/" + k]) && !/^OK: (INSERT|UPDATE|DELETE) [1-9]/.test(postD["sima/" + k])),
      `utána: ${st.filter(([k]) => den(postD["sima/" + k])).length} permission denied, ${st.filter(([k]) => /^OK: (UPDATE|DELETE) 0/.test(postD["sima/" + k])).length} „0 sor” (RLS), ${st.filter(([k]) => /row-level security/.test(postD["sima/" + k])).length} RLS-hiba, ${st.filter(([k]) => /^OK: SELECT/.test(postD["sima/" + k])).length} olvasás`);
    report("D7 a próba-adat a műveletek után érintetlen (semmi nem maradt meg) — előtte és utána is", preD.__adat === postD.__adat, postD.__adat);

    // ---- a 39. lépés forgatókönyve ----
    const MUST_FAIL = ["02 ", "05 ", "18 ", "19 ", "20 ", "22 ", "27 ", "29 ", "31 ", "32 "];
    // VÁRT szigorodások (a szűkítés célja): a belső alapvonal-függvényt a staff sem hívhatja közvetlenül; bejelentkezés nélkül nincs olvasás.
    const VART = { "22 ": [/^OK$/, /^HIBA: permission denied for function seed_issue_seen_for_subscribers/], "31 ": [/^OK: olvasható$/, /^HIBA: permission denied for table series/], "32 ": [/^OK: \{/, /^HIBA: permission denied for table/] };
    console.log(`\n  A 39. lépés forgatókönyve (ELŐTTE = UTÁNA${ELES ? "" : ", három várt szigorodással"}):`);
    let same = 0, vart = 0, okSteps = 0; const names = Object.keys(pre);
    for (const n of names) {
      const eq = pre[n] === post[n]; if (eq) same++;
      const vk = Object.keys(VART).find(p => n.startsWith(p)), ve = !!vk && VART[vk][0].test(pre[n] || "") && VART[vk][1].test(post[n] || ""); if (ve) vart++;
      const mustFail = MUST_FAIL.some(p => n.startsWith(p)), good = mustFail ? /^HIBA/.test(post[n] || "") : /^OK/.test(post[n] || "");
      if (good) okSteps++;
      console.log(`    ${(eq || ve) && good ? "✔" : "✘"} ${n}\n        ${eq ? post[n] : `ELŐTTE: ${pre[n]}  →  UTÁNA: ${post[n]}${ve ? "   (várt szigorodás)" : ""}`}`);
    }
    report(ELES ? "F1 (éles állapot) a 39. lépés forgatókönyvének mind a 34 lépése előtte és utána betűre ugyanazt adja" : "F1 a 39. lépés forgatókönyvének 34 lépéséből 31 a szűkítés előtt és után betűre ugyanazt adja; három várt módon szigorodik: a 22. (a belső alapvonal-függvény közvetlen hívása), a 31. és a 32. (olvasás bejelentkezés nélkül)",
      names.length === 34 && Object.keys(post).length === 34 && (ELES ? same === 34 : (same === 31 && vart === 3)), `azonos: ${same}/34, várt változás: ${vart}`);
    report("F2 a 24 működő lépés sikeres (javaslat, sablon-feltöltés, „Kész”, publikálás, új Szám, szerkesztés indítása, Saját adatlap, képjavaslat, törlés indítása és véglegesítése), a 10 védelmi lépés hibát ad", okSteps === names.length, `${okSteps}/${names.length}`);
    const end = (await c.query(FNS)).rows;
    report("F3 a próbák után a függvények definíciója és hívási joga a migráció utáni állapotban maradt", end.every((f, i) => f.acl === mid[i].acl && f.h === mid[i].h));
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
    // A változásnapló sorszámosztója (szekvencia) az egyetlen, amit a ROLLBACK nem állít vissza: a forgatókönyv naplósorokat ír,
    // ezek visszagörgetődnek, de a kiosztott sorszámok nem térnek vissza. Adat nem változik, a naplóban sorszám-hézag marad.
    console.log(`\nMegjegyzés: a változásnapló sorszámosztója ${before.counts.naplo_szekvencia} → ${fresh.counts.naplo_szekvencia} (a visszagörgetés a kiosztott sorszámokat nem adja vissza; adat nem változott).`);
    const dc = Object.keys(before.counts).filter(k => k !== "naplo_szekvencia" && String(before.counts[k]) !== String(fresh.counts[k]));
    const da = Object.keys(before.agg).filter(k => String(before.agg[k]) !== String(fresh.agg[k]));
    console.log(dc.length || da.length
      ? `\n✘ ELTÉRÉS: számláló [${dc.map(k => `${k}: ${before.counts[k]} → ${fresh.counts[k]}`).join("; ")}] ujjlenyomat [${da.join(", ")}]`
      : "\n✔ IGAZOLÁS: az ELŐTTE és az UTÁNA számlálók, a 37 definíció-hash, a 37 függvény-ACL, a táblák és a szekvencia jogai, az alapértelmezett jogok és a szabályok azonosak — semmi nem maradt meg.");
    const bad = results.filter(r => !r.ok);
    console.log(`\nPróbák: ${results.length - bad.length}/${results.length} sikeres` + (bad.length ? ` — NEM sikerült: ${bad.map(r => r.name.split(" ")[0]).join(", ")}` : ""));
  }
})().catch(e => { console.error("Váratlan hiba:", e.message); process.exit(1); });
