/* ============================================================
   49. lépés — LISTÁK TÖRLÉSE + A SAJÁT KÉPJAVASLAT TÖRLÉSE — VISSZAGÖRGETETT PRÓBA.

   FIGYELEM — ÉLŐ ADATBÁZISON FUT. CSAK a tulajdonos ELŐZETES, kifejezett jóváhagyásával futtatható.
   EGYETLEN tranzakcióban dolgozik, a végén MINDIG ROLLBACK; SOHA nem commitol. A migráció
   (laprol-lapra-49-lista-torles.sql) a tranzakción BELÜL fut le. A végén külön, friss kapcsolaton igazolja: a számlálók,
   a Listák ujjlenyomata, a definíció-hash-ek, a függvény-ACL-ek, a táblajogok és a szabályok azonosak az előttivel.
   SET LOCAL lock_timeout = 3s.

   Meglévő sorozathoz, Számhoz, munkaanyaghoz és személyes sorhoz NEM ír: a tranzakción belül létrehozott próba-
   felhasználókon, próbasorozaton és próba-lista-értékeken dolgozik. A valódi lista-értékekre a törlést mentési pontban
   hívja, és azonnal visszagörgeti (csak az eredményt jegyzi fel: törölhető volna / megáll, milyen üzenettel).

   Menete: (1) a 39. lépés 34 lépéses forgatókönyve (a trial-39-jogosultsag.js-ből betűre átvéve) és a képjavaslat-
   takarítás a változás ELŐTT, mentési pontban; (2) a migráció; (3) a Listák törlésének és a képjavaslat-szabálynak a
   próbái; (4) a forgatókönyv UTÁNA; (5) összevetés. A szerepkörök valódiak (SET LOCAL ROLE authenticated / anon).

   Használat: node scripts/trial-49-lista-torles.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const SQL = fs.readFileSync(path.join(__dirname, "..", "laprol-lapra-49-lista-torles.sql"), "utf8");
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
    (select md5(string_agg(tipus || '|' || ertek || '|' || coalesce(megjelenites,'') || '|' || sort_order, ',' order by tipus, ertek)) from public.lists) as lists_ujjlenyomat,
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
  return { counts, agg, fns, tacl, pol };
}

(async () => {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  let before;
  try {
    before = await state(c, "ELŐTTE (commitolt állapot):");
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

    // ---- Próba-adat (a tulajdonos nevében, a tranzakcióban; a mentési ponttal együtt eltűnik) ----
    const PA = "49494949-4949-4949-8949-494949494901";   // sima próba-felhasználó (a képjavaslat beküldője)
    const PB = "49494949-4949-4949-8949-494949494902";   // másik sima próba-felhasználó
    const asOwnerClaims = () => c.query(`select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)`, [owner, J({ sub: owner, role: "authenticated" })]);
    async function adat() {
      await c.query("RESET ROLE"); await asOwnerClaims();
      for (const [id, em] of [[PA, "proba-49a@example.invalid"], [PB, "proba-49b@example.invalid"]])
        await q(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2)`, [id, em]);
      const L = (tipus, ertek, nev) => q(`insert into public.lists (tipus, ertek, megjelenites, sort_order) values ($1, $2, $3, 990)`, [tipus, ertek, nev]);
      for (const [t, e, nv] of [["kiado", "proba_49_kiado", "Próba 49 kiadó"], ["kategoria", "proba_49_kat", "Próba 49 kategória"], ["komponens", "proba_49_tipus", "Próba 49 típus"],
        ["azonosito", "proba_49_az", "Próba 49 azonosító"], ["forras", "proba_49_forras", "Próba 49 forrás"],
        ["kiado", "proba_49_kiado2", "Próba 49 kiadó (sorozatban)"], ["kiado", "proba_49_kiado3", "Próba 49 kiadó (munkaanyagban)"], ["kategoria", "proba_49_kat2", "Próba 49 kategória (sorozatban)"],
        ["komponens", "proba_49_tipus2", "Próba 49 típus (használt)"], ["azonosito", "proba_49_az2", "Próba 49 azonosító (használt)"], ["forras", "proba_49_forras2", "Próba 49 forrás (használt)"]]) await L(t, e, nv);
      const TM = J([{ tipus: "magazin", main: true, required: true, id_rule: "nincs", default_azonosito_tipus: null, counts_for_color: true, default_megnevezes: null },
                    { tipus: "egyeb", main: false, required: false, id_rule: "nincs", default_azonosito_tipus: null, counts_for_color: true, default_megnevezes: null },
                    { tipus: "proba_49_tipus2", main: false, required: false, id_rule: "nincs", default_azonosito_tipus: null, counts_for_color: true, default_megnevezes: null }]);
      const S = (await q(`insert into public.series (megnevezes, megjelenites, kiado, kategoria, szin, components, component_template, lifecycle)
          values ('PRÓBA 49 lista', 'PRÓBA 49', 'proba_49_kiado2', 'proba_49_kat2', '#336699', '{magazin,egyeb,proba_49_tipus2}', $1::jsonb, 'active') returning id`, [TM]))[0].id;
      const I = (await q(`insert into public.issues (series_id, lapszam, cim) values ($1, 1, 'Próba 49 Szám') returning id`, [S]))[0].id;
      const K = (await q(`insert into public.components (issue_id, tipus, is_main) values ($1, 'magazin', true) returning id`, [I]))[0].id;
      await q(`insert into public.components (issue_id, tipus, is_main, azonosito_tipus, azonosito) values ($1, 'egyeb', false, 'proba_49_az2', 'X49')`, [I]);
      await q(`insert into public.components (issue_id, tipus, is_main) values ($1, 'proba_49_tipus2', false)`, [I]);
      await q(`insert into public.member_series (user_id, series_id, is_selected) values ($1, $3, true), ($2, $3, true)`, [PA, PB, S]);
      await q(`insert into public.member_issue_data (user_id, issue_id, forras, ar_auto) values ($1, $2, 'proba_49_forras2', false)`, [PA, I]);
      await q(`insert into public.draft_series (pool_type, pool_status, submitted_by, kiado, megnevezes, megjelenites, szin, components) values ('new','incoming',$1,'proba_49_kiado3','PRÓBA 49 javaslat','PRÓBA 49 j','#336699','{magazin}')`, [PB]);
      // komponensenként egyszerre csak EGY függő javaslat lehet (image_proposals_one_pending) — ezért külön elemek
      const I2 = (await q(`insert into public.issues (series_id, lapszam, cim) values ($1, 2, 'Próba 49 Szám 2') returning id`, [S]))[0].id;
      const K2 = (await q(`insert into public.components (issue_id, tipus, is_main) values ($1, 'magazin', true) returning id`, [I2]))[0].id;
      const I3 = (await q(`insert into public.issues (series_id, lapszam, cim) values ($1, 3, 'Próba 49 Szám 3') returning id`, [S]))[0].id;
      const K3 = (await q(`insert into public.components (issue_id, tipus, is_main) values ($1, 'magazin', true) returning id`, [I3]))[0].id;
      const ip = async (comp, by, st) => (await q(`insert into public.image_proposals (component_id, proposed_by, entity_type, status) values ($1, $2, 'component', $3) returning id`, [comp, by, st]))[0].id;
      const IP = { sajatFuggo: await ip(K, PA, "pending"), masikFuggo: await ip(K2, PB, "pending"), sajatElfogadott: await ip(K, PA, "approved"), sajatElutasitott: await ip(K, PA, "rejected") };
      return { S, I, K, K3, IP };
    }
    const fmt = r => r.ok ? "OK: " + (typeof r.v === "string" ? r.v : J(r.v)) : `HIBA [${r.code}]: ${r.err.split("\n")[0].slice(0, 260)}`;
    const delRows = (sql, p) => async () => { const r = await c.query(sql, p); return `${r.command} ${r.rowCount}`; };
    // a kliens képjavaslat-útja (proposeImage): beszúrás visszakéréssel, majd a takarító törlés — mindkettő a beküldő nevében
    const kliensTakaritas = K => async () => {
      const ins = await c.query(`insert into public.image_proposals (entity_type, proposed_by, component_id) values ('component', $1, $2) returning *`, [PA, K]);
      const del = await c.query(`delete from public.image_proposals where id = $1`, [ins.rows[0].id]);
      const left = (await c.query(`select count(*)::int n from public.image_proposals where id = $1`, [ins.rows[0].id])).rows[0].n;
      return `beszúrás ${ins.rowCount}, törlés ${del.rowCount}, bent maradt ${left}`;
    };

    // ---- 1. ELŐTTE (mentési pontban, visszagörgetve) ----
    const polBefore = (await c.query(POL)).rows;
    await c.query("SAVEPOINT elotte");
    const pre = await scenario();
    const preA = await adat();
    const preB = fmt(await as("authenticated", PA, kliensTakaritas(preA.K3), false));
    const preF = fmt(await as("authenticated", owner, async () => (await c.query(`select public.delete_list_value('kiado', 'proba_49_kiado')`)).rows, false));
    await c.query("ROLLBACK TO SAVEPOINT elotte");
    console.log("\nA forgatókönyv és a képjavaslat-takarítás a változás ELŐTT lefutott (mentési pontban, visszagörgetve).");
    console.log(`  előtte — a kliens takarító törlése a saját függő javaslatára: ${preB}`);
    console.log(`  előtte — delete_list_value: ${preF}`);

    // ---- 2. a migráció ----
    // 50. lépés: éles mód — ha a 49-es migráció már él, nem fut újra (a create function hibát adna); a próbák a mostani állapotot nézik.
    const NEW = "delete_list_value(p_tipus text, p_ertek text)";
    const M49 = before.fns.some(f => f.f === NEW);
    if (M49) console.log("A 49-es migráció MÁR ÉL — nem fut újra; a próba az éles állapotot ellenőrzi.\n\nPróbák:");
    else { await c.query(SQL); console.log("A migráció lefutott a tranzakción belül (a záró önellenőrzése nem adott hibát).\n\nPróbák:"); }
    const mid = (await c.query(FNS)).rows;
    const old = mid.filter(f => f.f !== NEW), b0 = Object.fromEntries(before.fns.map(f => [f.f, f]));
    report("K1 38 függvény; a régi 37 definíciója és hívási joga betűre változatlan", mid.length === 38 && old.length === 37 && old.every(f => b0[f.f] && b0[f.f].h === f.h && b0[f.f].acl === f.acl), `${old.filter(f => b0[f.f] && b0[f.f].h === f.h && b0[f.f].acl === f.acl).length}/37 azonos`);
    const nf = mid.find(f => f.f === NEW);
    const nfm = (await c.query(`select prosecdef, proconfig::text cfg, has_function_privilege('anon', oid, 'execute') a, has_function_privilege('authenticated', oid, 'execute') b, has_function_privilege('service_role', oid, 'execute') s from pg_proc where oid = 'public.delete_list_value(text,text)'::regprocedure`)).rows[0];
    report("K2 az új függvény: SECURITY DEFINER, rögzített search_path, az authenticated hívhatja, az anon és a PUBLIC nem", !!nf && nf.acl === "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}" && nfm.prosecdef && nfm.cfg === "{search_path=public}" && !nfm.a && nfm.b && nfm.s, `${nf && nf.acl} | ${nfm.cfg} | definíció-hash ${nf && nf.h}`);
    const cnt = (await c.query(`select count(*) filter (where has_function_privilege('authenticated', oid, 'execute'))::int au, count(*) filter (where has_function_privilege('anon', oid, 'execute'))::int an from pg_proc where pronamespace = 'public'::regnamespace and prokind = 'f'`)).rows[0];
    report("K3 a bejelentkezett 24, a bejelentkezés nélküli 8 függvényt hívhat (előtte 23 / 8)", cnt.au === 24 && cnt.an === 8, J(cnt));
    const polMid = (await c.query(POL)).rows, NEWPOL = "image_proposals delete own pending";
    const np = polMid.find(p => p.policyname === NEWPOL);
    report("K4 a szabályok: pontosan egy új (a saját függő képjavaslat törlése), a többi betűre a régi", polMid.length === polBefore.length + (M49 ? 0 : 1) && J(polMid.filter(p => p.policyname !== NEWPOL)) === J(polBefore.filter(p => p.policyname !== NEWPOL))
      && np && np.cmd === "DELETE" && np.roles === "{authenticated}" && np.qual === "((proposed_by = auth.uid()) AND (status = 'pending'::text))" && np.with_check === null, np && `${np.cmd} | ${np.roles} | ${np.qual}`);
    const tm = md5((await c.query(TACL)).rows.map(t => t.t + t.acl + t.oszlop_acl).join(","));
    report("K5 a tábla- és oszlopjogok változatlanok (a lists táblán továbbra sincs közvetlen törlési jog)", tm === before.agg.tablajogok_osszesen);

    // ---- 3. UTÁNA: a próbák ----
    await c.query("SAVEPOINT utana");
    const post = await scenario();
    const AD = await adat();
    const L0 = (await q(`select count(*)::int n from public.lists`))[0].n;
    const del = (t, e) => async () => { const r = (await c.query(`select public.delete_list_value(p_tipus := $1, p_ertek := $2) as v`, [t, e])).rows[0].v;
      const left = (await c.query(`select count(*)::int n from public.lists where tipus = $1 and ertek = $2`, [t, e])).rows[0].n; return `${J(r)} — utána a listában: ${left}`; };
    const call = (role, uid, t, e) => as(role, uid, del(t, e), false).then(fmt);
    console.log("\n  A) Listák törlése:");
    const LT = [];   // [kulcs, leírás, eredmény, elvárt regex]
    const t1 = async (k, d, role, uid, t, e, re) => { const v = await call(role, uid, t, e); LT.push([k, d, v, re]); console.log(`    ${re.test(v) ? "✔" : "✘"} ${k} ${d}\n        ${v}`); };
    const OKDEL = /^OK: \{"nev":"[^"]+","ertek":"[^"]+","tipus":"[^"]+","torolve":true\} — utána a listában: 0$/;
    await t1("L01", "staff: használatlan kiadó törlése", "authenticated", owner, "kiado", "proba_49_kiado", OKDEL);
    await t1("L02", "staff: használatlan kategória törlése", "authenticated", owner, "kategoria", "proba_49_kat", OKDEL);
    await t1("L03", "staff: használatlan komponens-típus (típusleírás nélkül) törlése", "authenticated", owner, "komponens", "proba_49_tipus", OKDEL);
    await t1("L04", "staff: használatlan azonosító-típus törlése", "authenticated", owner, "azonosito", "proba_49_az", OKDEL);
    await t1("L05", "staff: használatlan beszerzési forrás törlése", "authenticated", owner, "forras", "proba_49_forras", OKDEL);
    await t1("L06", "staff: sorozatnál használt kiadó — megáll", "authenticated", owner, "kiado", "proba_49_kiado2", /^HIBA \[P0001\]: Ez a kiadó még használatban van: 1 sorozatnál \(PRÓBA 49 lista\)\. Előbb azokat módosítsd\.$/);
    await t1("L07", "staff: munkaanyagban használt kiadó — megáll", "authenticated", owner, "kiado", "proba_49_kiado3", /^HIBA \[P0001\]: Ez a kiadó még használatban van: 1 munkaanyagban\. Előbb azokat módosítsd\.$/);
    await t1("L08", "staff: sorozatnál használt kategória — megáll", "authenticated", owner, "kategoria", "proba_49_kat2", /^HIBA \[P0001\]: Ez a kategória még használatban van: 1 sorozatnál \(PRÓBA 49 lista\)\. Előbb azokat módosítsd\.$/);
    await t1("L09", "staff: elemnél és sablonban használt komponens-típus — megáll", "authenticated", owner, "komponens", "proba_49_tipus2", /^HIBA \[P0001\]: Ez a komponens-típus még használatban van: 1 elemnél \(1 sorozatban\); 1 sorozat sablonjában\. Előbb azokat módosítsd\.$/);
    await t1("L10", "staff: elemnél használt azonosító-típus — megáll", "authenticated", owner, "azonosito", "proba_49_az2", /^HIBA \[P0001\]: Ez az azonosító-típus még használatban van: 1 elemnél \(1 sorozatban\)\. Előbb azokat módosítsd\.$/);
    await t1("L11", "staff: beszerzési adatnál használt forrás — megáll (név nélkül, csak a felhasználók száma)", "authenticated", owner, "forras", "proba_49_forras2", /^HIBA \[P0001\]: Ez a beszerzési forrás még használatban van: 1 felhasználó beszerzési adatánál\. Előbb azokat módosítsd\.$/);
    await t1("L12", "staff: valódi, három sorozatnál használt kiadó (de_agostini) — megáll, a sorozatok nevével", "authenticated", owner, "kiado", "de_agostini", /^HIBA \[P0001\]: Ez a kiadó még használatban van: 3 sorozatnál \(.+\)\. Előbb azokat módosítsd\.$/);
    await t1("L13", "staff: „Egyéb” (kiadó) — védett", "authenticated", owner, "kiado", "egyeb", /^HIBA \[P0001\]: Az „.+” a lista tartalék értéke .*nem törölhető\.$/);
    await t1("L14", "staff: „Magazin” komponens-típus — védett (típusleírás)", "authenticated", owner, "komponens", "magazin", /^HIBA \[P0001\]: A\(z\) „.+” komponens-típushoz típusleírás tartozik .*nem törölhető\.$/);
    await t1("L15", "staff: „Kártya” komponens-típus — védett (típusleírás)", "authenticated", owner, "komponens", "krtya", /^HIBA \[P0001\]: A\(z\) „.+” komponens-típushoz típusleírás tartozik/);
    for (const [k, e] of [["L16", "isbn"], ["L17", "issn"], ["L18", "lego_kd"], ["L19", "kartya_kod"]])
      await t1(k, `staff: „${e}” azonosító-típus — védett`, "authenticated", owner, "azonosito", e, /^HIBA \[P0001\]: A\(z\) „.+” azonosító-típusra a rendszer szabályai hivatkoznak/);
    await t1("L20", "staff: nem létező érték", "authenticated", owner, "kiado", "nincs_ilyen_49", /^HIBA \[P0001\]: Ez a lista-elem már nem található — frissítsd az oldalt\.$/);
    await t1("L21", "staff: ismeretlen lista", "authenticated", owner, "szin", "proba", /^HIBA \[P0001\]: Ismeretlen lista: „szin”\.$/);
    await t1("L22", "sima felhasználó: használatlan érték törlése — nincs jog", "authenticated", PA, "kiado", "proba_49_kiado", /^HIBA \[P0001\]: Nincs jogosultságod lista-elemet törölni\.$/);
    // a tulajdonos nevében (a protect_members trigger csak a tulajdonosnak engedi a szerepváltást)
    const lett = await as(null, owner, async () => { await q(`update public.members set role = 'admin', status = 'disabled' where user_id = $1`, [PB]); return (await q(`select role || '/' || status x from public.members where user_id = $1`, [PB]))[0].x; });
    console.log(`        (a második próba-felhasználó: ${fmt(lett)})`);
    await t1("L23", "letiltott admin: törlés — nincs jog", "authenticated", PB, "kiado", "proba_49_kiado", /^HIBA \[P0001\]: Nincs jogosultságod lista-elemet törölni\.$/);
    await t1("L24", "bejelentkezés nélkül (anon): a függvény nem hívható", "anon", null, "kiado", "proba_49_kiado", /^HIBA \[42501\]: permission denied for function delete_list_value$/);
    const dd = async (k, d, role, uid) => { const v = fmt(await as(role, uid, delRows(`delete from public.lists where tipus = 'kiado' and ertek = 'proba_49_kiado'`), false)); const re = /^HIBA \[42501\]: permission denied for table lists$/; LT.push([k, d, v, re]); console.log(`    ${re.test(v) ? "✔" : "✘"} ${k} ${d}\n        ${v}`); };
    await dd("L25", "staff: közvetlen DELETE FROM lists — továbbra is tiltott", "authenticated", owner);
    await dd("L26", "bejelentkezés nélkül: közvetlen DELETE FROM lists", "anon", null);
    const L1 = (await q(`select count(*)::int n from public.lists`))[0].n;
    report(`L az A) próbák mind a várt eredményt adták (${LT.length})`, LT.every(([, , v, re]) => re.test(v)), `${LT.filter(([, , v, re]) => re.test(v)).length}/${LT.length}`);
    report("L27 a megállt törlések semmit nem töröltek (a lista sorainak száma a próbák után ugyanannyi)", L0 === L1, `${L0} → ${L1}`);

    // a valódi lista-értékek: melyik volna törölhető ma (mindegyik mentési pontban, azonnal visszagörgetve)
    const real = (await q(`select tipus, ertek, coalesce(megjelenites, ertek) nev from public.lists where ertek not like 'proba_49%' order by tipus, sort_order, ertek`));
    console.log("\n  A mai valódi lista-értékek — mit adna a törlés (mindegyik visszagörgetve):");
    const realRes = [];
    for (const r of real) { const v = await call("authenticated", owner, r.tipus, r.ertek); realRes.push([r, v]); console.log(`    ${r.tipus.padEnd(10)} ${r.ertek.padEnd(16)} ${/^OK/.test(v) ? "TÖRÖLHETŐ VOLNA" : v.replace(/^HIBA \[P0001\]: /, "")}`); }
    const realLeft = (await q(`select count(*)::int n from public.lists where ertek not like 'proba_49%'`))[0].n;
    report("L28 a valódi értékek mindegyike megvan a próbák után (egyik sem törlődött)", realLeft === real.length, `${realLeft}/${real.length}`);

    console.log("\n  B) A saját képjavaslat törlése:");
    const BT = [];
    const t2 = async (k, d, role, uid, fn, re) => { const v = fmt(await as(role, uid, fn, false)); BT.push([k, d, v, re]); console.log(`    ${re.test(v) ? "✔" : "✘"} ${k} ${d}\n        ${v}`); };
    const D = id => delRows(`delete from public.image_proposals where id = $1`, [id]);
    await t2("B01", "a beküldő: a saját FÜGGŐ javaslata törlése", "authenticated", PA, D(AD.IP.sajatFuggo), /^OK: DELETE 1$/);
    await t2("B02", "a beküldő: MÁSIK felhasználó függő javaslata", "authenticated", PA, D(AD.IP.masikFuggo), /^OK: DELETE 0$/);
    await t2("B03", "a beküldő: a saját, már ELFOGADOTT javaslata", "authenticated", PA, D(AD.IP.sajatElfogadott), /^OK: DELETE 0$/);
    await t2("B04", "a beküldő: a saját, már ELUTASÍTOTT javaslata", "authenticated", PA, D(AD.IP.sajatElutasitott), /^OK: DELETE 0$/);
    await t2("B05", "staff (tulajdonos): más függő javaslata — törlési jog nincs (mint eddig)", "authenticated", owner, D(AD.IP.masikFuggo), /^OK: DELETE 0$/);
    await t2("B06", "bejelentkezés nélkül (anon)", "anon", null, D(AD.IP.sajatFuggo), /^HIBA \[42501\]: permission denied for table image_proposals$/);
    await t2("B07", "a kliens teljes útja (proposeImage): beszúrás visszakéréssel, majd a takarító törlés", "authenticated", PA, kliensTakaritas(AD.K3), /^OK: beszúrás 1, törlés 1, bent maradt 0$/);
    await t2("B08", "a beküldő nem írhatja át a saját javaslata állapotát (a törléshez sem tudja „függővé” tenni)", "authenticated", PA, delRows(`update public.image_proposals set status = 'pending' where id = $1`, [AD.IP.sajatElfogadott]), /^OK: UPDATE 0$/);
    report(`B az B) próbák mind a várt eredményt adták (${BT.length}); előtte a kliens takarító törlése: ${preB}`, BT.every(([, , v, re]) => re.test(v)) && (M49 ? /törlés 1, bent maradt 0$/ : /törlés 0, bent maradt 1$/).test(preB), `${BT.filter(([, , v, re]) => re.test(v)).length}/${BT.length}`);
    await c.query("ROLLBACK TO SAVEPOINT utana");

    // ---- 4. a 39. lépés forgatókönyve: előtte = utána ----
    const MUST_FAIL = ["02 ", "05 ", "18 ", "19 ", "20 ", "22 ", "27 ", "29 ", "31 ", "32 "];
    console.log("\n  A 39. lépés forgatókönyve (ELŐTTE = UTÁNA):");
    let same = 0, okSteps = 0; const names = Object.keys(pre);
    for (const n of names) {
      const eq = pre[n] === post[n]; if (eq) same++;
      const good = MUST_FAIL.some(p => n.startsWith(p)) ? /^HIBA/.test(post[n] || "") : /^OK/.test(post[n] || ""); if (good) okSteps++;
      console.log(`    ${eq && good ? "✔" : "✘"} ${n}\n        ${eq ? post[n] : `ELŐTTE: ${pre[n]}  →  UTÁNA: ${post[n]}`}`);
    }
    report("F1 a 34 lépéses forgatókönyv a változás előtt és után betűre ugyanazt adja", names.length === 34 && same === 34, `${same}/34`);
    report("F2 a 24 működő lépés sikeres, a 10 védelmi lépés hibát ad", okSteps === 34, `${okSteps}/34`);
    console.log("\n  A 38 függvény definíció-hash-e a migráció után (md5(pg_get_functiondef)):");
    mid.forEach(f => console.log(`    ${f.f === NEW ? "ÚJ " : "    "}${f.f.padEnd(70)} ${f.h}`));
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
    console.log(`\nMegjegyzés: a változásnapló sorszámosztója ${before.counts.naplo_szekvencia} → ${fresh.counts.naplo_szekvencia} (a visszagörgetés a kiosztott sorszámokat nem adja vissza; adat nem változott).`);
    const dc = Object.keys(before.counts).filter(k => k !== "naplo_szekvencia" && String(before.counts[k]) !== String(fresh.counts[k]));
    const da = Object.keys(before.agg).filter(k => String(before.agg[k]) !== String(fresh.agg[k]));
    console.log(dc.length || da.length
      ? `\n✘ ELTÉRÉS: számláló [${dc.map(k => `${k}: ${before.counts[k]} → ${fresh.counts[k]}`).join("; ")}] ujjlenyomat [${da.join(", ")}]`
      : "\n✔ IGAZOLÁS: az ELŐTTE és az UTÁNA számlálók, a Listák ujjlenyomata, a 37 definíció-hash, a 37 függvény-ACL, a táblajogok, az alapértelmezett jogok és a szabályok azonosak — semmi nem maradt meg.");
    const bad = results.filter(r => !r.ok);
    console.log(`\nPróbák: ${results.length - bad.length}/${results.length} sikeres` + (bad.length ? ` — NEM sikerült: ${bad.map(r => r.name.split(" ")[0]).join(", ")}` : ""));
  }
})().catch(e => { console.error("Váratlan hiba:", e.message); process.exit(1); });
