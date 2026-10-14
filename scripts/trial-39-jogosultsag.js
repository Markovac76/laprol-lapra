/* ============================================================
   39. lépés — JOGOSULTSÁG-SZIGORÍTÁS — VISSZAGÖRGETETT PRÓBA.

   FIGYELEM — ÉLŐ ADATBÁZISON FUT. CSAK a tulajdonos ELŐZETES, kifejezett jóváhagyásával futtatható.
   EGYETLEN tranzakcióban dolgozik, a végén MINDIG ROLLBACK; SOHA nem commitol. A migráció
   (laprol-lapra-39-jogosultsag-szigoritas.sql) a tranzakción BELÜL fut le. A végén külön, friss
   kapcsolaton igazolja: a számlálók, mind a 37 definíció-hash és az ACL-ek azonosak az előttivel.
   SET LOCAL lock_timeout = 3s.

   Meglévő sorozathoz, Számhoz, munkaanyaghoz és személyes sorhoz NEM nyúl: a tranzakción belül
   létrehoz egy próba-felhasználót és egy „PRÓBA 39” sorozatot, és csak azokon dolgozik.

   Menete: ugyanazt a forgatókönyvet (a kliens útvonalai: javaslat, sablon-feltöltés, „Kész”,
   publikálás, új Szám, Saját adatlap, képjavaslat, törlés) lefuttatja a szigorítás ELŐTT (mentési
   pontban, visszagörgetve) és UTÁN, a valódi szerepkörökkel (SET LOCAL ROLE authenticated / anon),
   és összeveti a kettőt. Utána: anon → minden érintett függvény „permission denied”;
   authenticated → a belső segédek „permission denied”.

   Használat: node scripts/trial-39-jogosultsag.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const SQL = fs.readFileSync(path.join(__dirname, "..", "laprol-lapra-39-jogosultsag-szigoritas.sql"), "utf8");
const J = x => JSON.stringify(x);
const results = [];
const report = (name, ok, detail) => { results.push({ name, ok }); console.log(`  ${ok ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`); };

// A három csoport (a migráció fejlécével egyezően). [hívás dummy paraméterekkel]
const Z = "'00000000-0000-4000-8000-000000000000'::uuid";
const GROUP_A = {   // PUBLIC + anon megvonva, authenticated marad
  "start_edit_draft(p_series_id uuid)": `public.start_edit_draft(${Z})`,
  "apply_draft_upload(p_draft_id uuid, p_payload jsonb)": `public.apply_draft_upload(${Z}, '{}'::jsonb)`,
  "draft_lapszam_conflicts(p_draft_id uuid, p_changes jsonb)": `public.draft_lapszam_conflicts(${Z}, '[]'::jsonb)`,
  "draft_ready_warnings(p_draft_id uuid)": `public.draft_ready_warnings(${Z})`,
  "mark_draft_ready(p_draft_id uuid)": `public.mark_draft_ready(${Z})`,
  "return_draft_to_edit(p_draft_id uuid)": `public.return_draft_to_edit(${Z})`,
  "publish_draft_series(p_draft_id uuid)": `public.publish_draft_series(${Z})`,
  "start_force_delete(p_series_id uuid)": `public.start_force_delete(${Z})`,
  "finalize_delete_series(p_series_id uuid, p_confirm_name text)": `public.finalize_delete_series(${Z}, 'x')`,
  "propose_bulk_issues(p_draft_id uuid, p_rows jsonb)": `public.propose_bulk_issues(${Z}, '[]'::jsonb)`,
  "seed_member_seen(p_series_id uuid)": `public.seed_member_seen(${Z})`,
  "seed_issue_seen_for_subscribers(p_issue_id uuid)": `public.seed_issue_seen_for_subscribers(${Z})`,
  "can_propose_image(p_component_id uuid)": `public.can_propose_image(${Z})`,
  "can_propose_series_image(p_series_id uuid)": `public.can_propose_series_image(${Z})`,
  "series_azonositok_error(a jsonb)": `public.series_azonositok_error('[]'::jsonb)`,
};
const GROUP_B = {   // PUBLIC + anon + authenticated megvonva
  "log_field_change(p_entity_type text, p_entity_id uuid, p_field text, p_old text, p_new text, p_version integer)": `public.log_field_change('series', ${Z}, 'proba', 'a', 'b', 1)`,
  "next_series_no()": `public.next_series_no()`,
  "ensure_draft_main(p_draft_issue_id uuid)": `public.ensure_draft_main(${Z})`,
  "pick_main_component(p_issue_id uuid)": `public.pick_main_component(${Z})`,
  "pick_main_draft_component(p_draft_issue_id uuid)": `public.pick_main_draft_component(${Z})`,
  "default_component_template(p_components text[])": `public.default_component_template(array['magazin'])`,
  "sync_template_with_components(t jsonb, p_components text[])": `public.sync_template_with_components('[]'::jsonb, array['magazin'])`,
  "component_template_error(t jsonb)": `public.component_template_error('[]'::jsonb)`,
  "draft_conflicts_text(p_conf jsonb)": `public.draft_conflicts_text('[]'::jsonb)`,
  "draft_type_field_issues(p_draft_id uuid)": `(select count(*) from public.draft_type_field_issues(${Z}))`,
  "template_main_type(t jsonb)": `public.template_main_type('[]'::jsonb)`,
  "type_azonosito_tipus(p_tipus text, p_tmpl jsonb)": `public.type_azonosito_tipus('lego', '[]'::jsonb)`,
  "component_type_fields_error(f jsonb)": `public.component_type_fields_error('[]'::jsonb)`,
};
const GROUP_C = ["is_staff()", "is_active()", "my_role()", "handle_new_user()", "protect_members()", "protect_member_series()", "check_pool_limit()", "block_edit_during_force_delete()"];
const ACL_A = "{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}";
const ACL_B = "{postgres=X/postgres,service_role=X/postgres}";

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
    (select coalesce(sum(version),0) from public.components)::int ver_components`;
const FNS = `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as f, md5(pg_get_functiondef(p.oid)) as h, coalesce(p.proacl::text, '(alap)') as acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' order by 1`;

async function state(c, label) {
  const counts = (await c.query(STATE)).rows[0];
  const fns = (await c.query(FNS)).rows;
  console.log(`\n${label}`); Object.entries(counts).forEach(([k, v]) => console.log(`  ${k.padEnd(24)} ${v}`));
  console.log(`  ${"fuggvenyek".padEnd(24)} ${fns.length}`);
  console.log(`  ${"definicio_hash_osszesen".padEnd(24)} ${require("crypto").createHash("md5").update(fns.map(f => f.f + f.h).join(",")).digest("hex")}`);
  console.log(`  ${"acl_osszesen".padEnd(24)} ${require("crypto").createHash("md5").update(fns.map(f => f.f + f.acl).join(",")).digest("hex")}`);
  return { counts, fns };
}

(async () => {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  let before;
  try {
    before = await state(c, "ELŐTTE (commitolt állapot):");
    const owner = (await c.query(`select user_id from public.members where role='owner' limit 1`)).rows[0].user_id;
    // 48. lépés: él-e a 47-es jogosultsági higiénia? (az anon már nem olvashatja a series táblát). Ha igen: a
    // seed_issue_seen_for_subscribers a B csoportba került; a 39-es migráció önellenőrzése (authenticated: 24 függvény)
    // már nem teljesül, ezért a migráció NEM fut újra; a 22., 31., 32. lépés előtte és utána is „permission denied”.
    const M47 = !(await c.query("select has_table_privilege('anon', 'public.series', 'SELECT') x")).rows[0].x;
    if (M47) { const k = "seed_issue_seen_for_subscribers(p_issue_id uuid)"; GROUP_B[k] = GROUP_A[k]; delete GROUP_A[k]; }
    const nA = Object.keys(GROUP_A).length, nB = Object.keys(GROUP_B).length;
    console.log(M47 ? "\nA 47-es szűkítés MÁR ÉL: a B csoport 14, az A 14 függvény; a 39-es migráció nem fut újra (az önellenőrzése a 47 előtti állapotot várja)." : "\nA 47-es szűkítés még nem él.");
    await c.query("BEGIN");
    await c.query("SET LOCAL lock_timeout = '3s'");
    await c.query("SET LOCAL statement_timeout = '120s'");
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

    // ---- 1. a forgatókönyv a szigorítás ELŐTT (mentési pontban, visszagörgetve) ----
    await c.query("SAVEPOINT elotte");
    const pre = await scenario();
    await c.query("ROLLBACK TO SAVEPOINT elotte");
    console.log("\nA forgatókönyv a szigorítás ELŐTT lefutott (mentési pontban, visszagörgetve).");

    // ---- 2. a migráció ----
    if (M47) console.log("A migráció NEM fut újra (a 47-es szűkítés él; a jogok a mostaniak).\n\nPróbák:");
    else { await c.query(SQL); console.log("A migráció lefutott a tranzakción belül.\n\nPróbák:"); }
    const mid = (await c.query(FNS)).rows;
    const byF = Object.fromEntries(mid.map(f => [f.f, f])), b0 = Object.fromEntries(before.fns.map(f => [f.f, f]));
    report("J1 a migráció egyetlen függvény definícióját sem változtatja meg (mind a 37 hash azonos), új és megszűnt függvény nincs",
      mid.length === 37 && before.fns.length === 37 && mid.every(f => b0[f.f] && b0[f.f].h === f.h), `${mid.filter(f => b0[f.f] && b0[f.f].h === f.h).length}/37 azonos`);
    report(`J2 A csoport (${nA}): az ACL pontosan postgres + authenticated + service_role`, Object.keys(GROUP_A).every(f => byF[f] && byF[f].acl === ACL_A), Object.keys(GROUP_A).filter(f => !byF[f] || byF[f].acl !== ACL_A).join(", ") || ACL_A);
    report(`J3 B csoport (${nB}): az ACL pontosan postgres + service_role`, Object.keys(GROUP_B).every(f => byF[f] && byF[f].acl === ACL_B), Object.keys(GROUP_B).filter(f => !byF[f] || byF[f].acl !== ACL_B).join(", ") || ACL_B);
    report("J4 C csoport (8) és a create_live_issue: az ACL betűre a régi", GROUP_C.concat(["create_live_issue(p_series_id uuid, p_issue jsonb, p_personal jsonb)"]).every(f => byF[f] && byF[f].acl === b0[f].acl),
      "változatlan: " + GROUP_C.length + " + 1");
    report("J5 a három csoport és a create_live_issue együtt mind a 37 függvényt lefedi", new Set([...Object.keys(GROUP_A), ...Object.keys(GROUP_B), ...GROUP_C, "create_live_issue(p_series_id uuid, p_issue jsonb, p_personal jsonb)"].filter(f => byF[f])).size === 37);

    // ---- 3. bejelentkezés nélkül: minden érintett függvény „permission denied” ----
    const denied = async (role, uid, group) => { const bad = [];
      for (const [f, call] of Object.entries(group)) { const r = await as(role, uid, () => q(`select ${call}`), false);
        if (r.ok || r.code !== "42501" || !/permission denied for function/.test(r.err)) bad.push(`${f}: ${short(r)}`); }
      return bad; };
    const a1 = await denied("anon", null, GROUP_A), a2 = await denied("anon", null, GROUP_B);
    report(`N1 bejelentkezés nélkül (anon) az A csoport mind a ${nA} függvénye: permission denied`, a1.length === 0, a1.join(" ;; ") || `${nA}/${nA}`);
    report(`N2 bejelentkezés nélkül (anon) a B csoport mind a ${nB} függvénye: permission denied`, a2.length === 0, a2.join(" ;; ") || `${nB}/${nB}`);
    const a3 = await as("anon", null, () => q(`select public.create_live_issue(${Z}, '{}'::jsonb, null)`), false);
    report("N3 bejelentkezés nélkül a create_live_issue továbbra is: permission denied", !a3.ok && a3.code === "42501", short(a3));
    // ---- 4. bejelentkezve: a belső segédek zárva (sima felhasználónak és staffnak is) ----
    await as(null, null, async () => { await q(`insert into auth.users (id, instance_id, aud, role, email) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'proba-39b@example.invalid')`, ["39393939-3939-4939-8939-3939393939bb"]); });
    const b1 = await denied("authenticated", "39393939-3939-4939-8939-3939393939bb", GROUP_B), b2 = await denied("authenticated", owner, GROUP_B);
    report(`B1 bejelentkezett sima felhasználó a B csoport ${nB} belső segédjét nem hívhatja: permission denied`, b1.length === 0, b1.join(" ;; ") || `${nB}/${nB}`);
    report(`B2 bejelentkezett staff (tulajdonos) sem hívhatja közvetlenül a B csoport ${nB} belső segédjét`, b2.length === 0, b2.join(" ;; ") || `${nB}/${nB}`);
    const chg0 = (await q(`select count(*)::int n, (select next_series_no from public.global_counters where id=1) k from public.change_log`))[0];
    report("B3 a zárt hívások semmit nem írtak (a változásnapló és a sorozat-sorszámláló változatlan)", chg0.n === before.counts.change_log && chg0.k === before.counts.kovetkezo_sorozatszam, J(chg0));

    // ---- 5. a forgatókönyv a szigorítás UTÁN — ugyanazt kell adnia ----
    await c.query("SAVEPOINT utana");
    const post = await scenario();
    await c.query("ROLLBACK TO SAVEPOINT utana");
    const MUST_FAIL = ["02 ", "05 ", "18 ", "20 ", "27 ", "29 "];   // ezeknek ELŐTTE és UTÁNA is hibát kell adniuk (védelmek)
    // 48. lépés: a 47-es szűkítés után a 22. (a belső függvény közvetlen hívása) és a 31., 32. (bejelentkezés nélküli olvasás) is védelem
    if (M47) MUST_FAIL.push("22 ", "31 ", "32 ");
    console.log("\n  A forgatókönyv lépései (ELŐTTE = UTÁNA):");
    let same = 0, okSteps = 0; const names = Object.keys(pre);
    for (const n of names) {
      const eq = pre[n] === post[n]; if (eq) same++;
      // 43. lépés: a 19. lépés (sima felhasználó közvetlen törzsadat-írása) a (C3) írási-jog szűkítés ELŐTT „0 sor módosult”
      // (a sorszintű szabály fogta meg), UTÁNA „permission denied” (a táblajog hiánya). Mindkettő azt jelenti: nem írt.
      const nemIr = n.startsWith("19 ");
      const mustFail = MUST_FAIL.some(p => n.startsWith(p)), good = nemIr ? /^OK: 0 sor módosult$|^HIBA: permission denied for table issues/.test(post[n] || "") : mustFail ? /^HIBA/.test(post[n] || "") : /^OK/.test(post[n] || "");
      if (good) okSteps++;
      console.log(`    ${eq && good ? "✔" : "✘"} ${n}\n        ${eq ? post[n] : `ELŐTTE: ${pre[n]}  |  UTÁNA: ${post[n]}`}`);
    }
    report(`F1 a forgatókönyv ${names.length} lépése a szigorítás előtt és után betűre ugyanazt adja`, same === names.length && names.length === Object.keys(post).length && names.length === 34, `${same}/${names.length}`);
    report(`F2 a ${33 - MUST_FAIL.length} működő lépés sikeres, a ${MUST_FAIL.length} védelmi lépés (hibás adat, jogosulatlan hívás${M47 ? ", a belső függvény, a bejelentkezés nélküli olvasás" : ""}) hibát ad, a 19. lépés (közvetlen törzsadat-írás) nem ír — előtte és utána is`, okSteps === names.length, `${okSteps}/${names.length}`);
    const end = (await c.query(FNS)).rows;
    report("F3 a forgatókönyv után az ACL-ek a szigorított állapotban maradtak, a definíciók változatlanok", end.every((f, i) => f.acl === mid[i].acl && f.h === mid[i].h));
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
    const dh = fresh.fns.filter((f, i) => !before.fns[i] || before.fns[i].f !== f.f || before.fns[i].h !== f.h).map(f => f.f);
    const da = fresh.fns.filter((f, i) => !before.fns[i] || before.fns[i].acl !== f.acl).map(f => f.f);
    console.log(dc.length || dh.length || da.length || fresh.fns.length !== before.fns.length
      ? `\n✘ ELTÉRÉS: számláló [${dc.map(k => `${k}: ${before.counts[k]} → ${fresh.counts[k]}`).join("; ")}] hash [${dh.join(", ")}] ACL [${da.join(", ")}]`
      : "\n✔ IGAZOLÁS: az ELŐTTE és az UTÁNA számlálók, mind a 37 definíció-hash és mind a 37 ACL azonos — semmi nem maradt meg.");
    const bad = results.filter(r => !r.ok);
    console.log(`\nPróbák: ${results.length - bad.length}/${results.length} sikeres` + (bad.length ? ` — NEM sikerült: ${bad.map(r => r.name.split(" ")[0]).join(", ")}` : ""));
  }
})().catch(e => { console.error("Váratlan hiba:", e.message); process.exit(1); });
