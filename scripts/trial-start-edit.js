/* ============================================================
   start_edit_draft() + egyediségi index — VALIDÁCIÓS PRÓBA.

   FIGYELEM — ÉLŐ ADATBÁZISON FUT. CSAK a tulajdonos ELŐZETES, kifejezett
   jóváhagyásával futtatható (szabály: élő adaton DB-érintő tesztet —
   visszagörgetettet is — csak jóváhagyással). EGYETLEN tranzakcióban
   dolgozik, a végén MINDIG ROLLBACK; ez a script SOHA nem commitol.
   Az index és a függvény is a tranzakción BELÜL jön létre (a PostgreSQL
   DDL tranzakciós), így a ROLLBACK után egyik sem létezik — a végén ezt is
   ellenőrzi. Az egyetlen nem visszagörgethető mellékhatás a change_log
   azonosító-sorozatának előreléptetése, ha a publikálási próba is fut.

   Mit ellenőriz (a tranzakción belül):
     T1  a függvény létrehoz egy szerkesztési draftot a hívó lefoglalásával,
         és a draft_issues/draft_components PONTOSAN az élő NEM törölt
         Számok/komponensek másolata (mezőnként összevetve, forrás-ID-kkal)
     T2  második indítás ugyanarra a sorozatra → érthető hiba
     T3  a részleges egyedi index közvetlen beszúrásnál is véd (23505)
     T4  nem aktív (publikálatlan) sorozaton → érthető hiba
     T5  törlésre jelölt sorozaton → érthető hiba
     T6  nem létező sorozat / nem staff hívó → hiba
     T7  a másolt draft változtatás nélküli publikálása nem emel verziót
         és nem ír change_log sort
   Előtte és utána számlálók (a commitolt állapot), a végén külön, friss
   kapcsolaton is.

   Használat: node scripts/trial-start-edit.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const SERIES = "c38da324-ddca-48d4-8f44-be85496e41e0";   // Lego Star Wars Magazin (élő, aktív)
const SQL = fs.readFileSync(path.join(__dirname, "..", "laprol-lapra-start-edit-draft.sql"), "utf8");

async function counts(c, label) {
  const q = async (sql, p) => (await c.query(sql, p)).rows[0];
  const seqName = (await q(`select pg_get_serial_sequence('public.change_log','id') as s`)).s;
  const seq = seqName ? (await q(`select last_value::text as v, is_called from ${seqName}`)) : null;
  const r = {
    draft_series:     +(await q(`select count(*) n from public.draft_series`)).n,
    draft_series_edit: +(await q(`select count(*) n from public.draft_series where pool_type='edit'`)).n,
    draft_issues:     +(await q(`select count(*) n from public.draft_issues`)).n,
    draft_components: +(await q(`select count(*) n from public.draft_components`)).n,
    lego_szamok_osszes: +(await q(`select count(*) n from public.issues where series_id=$1`, [SERIES])).n,
    lego_szamok_aktiv:  +(await q(`select count(*) n from public.issues where series_id=$1 and not is_deleted`, [SERIES])).n,
    lego_komponensek:   +(await q(`select count(*) n from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1`, [SERIES])).n,
    lego_sorozat_verzio: (await q(`select version v from public.series where id=$1`, [SERIES])).v,
    lego_szam_verziok_osszeg: +(await q(`select coalesce(sum(version),0) n from public.issues where series_id=$1`, [SERIES])).n,
    change_log_sorok: +(await q(`select count(*) n from public.change_log`)).n,
    change_log_max_id: +(await q(`select coalesce(max(id),0) n from public.change_log`)).n,
    member_seen_sorok: +(await q(`select count(*) n from public.member_seen`)).n,
    index_letezik:    +(await q(`select count(*) n from pg_indexes where schemaname='public' and indexname='draft_series_one_edit_per_series'`)).n,
    fuggveny_letezik: +(await q(`select count(*) n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='start_edit_draft'`)).n,
    change_log_sequence: seq ? `${seq.v} (is_called=${seq.is_called})` : "?",
  };
  console.log(`\n${label}`);
  Object.entries(r).forEach(([k, v]) => console.log(`  ${k.padEnd(26)} ${v}`));
  return r;
}

const results = [];
function report(name, ok, detail) {
  results.push({ name, ok });
  console.log(`  ${ok ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`);
}

(async () => {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  let before;
  try {
    before = await counts(c, "ELŐTTE (commitolt állapot):");

    const { rows: [owner] } = await c.query(`select user_id from public.members where role='owner' limit 1`);
    const { rows: [pre] } = await c.query(
      `select count(*) n from (select 1 from public.draft_series where pool_type='edit' and source_series_id is not null
                                group by source_series_id having count(*)>1) x`);
    console.log(`\nElő-ellenőrzés: olyan élő sorozat, amelyhez ma több szerkesztési draft tartozik: ${pre.n} db`);

    await c.query("BEGIN");
    const asUser = uid => c.query(
      `select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)`,
      [uid, JSON.stringify({ sub: uid, role: "authenticated" })]);
    await asUser(owner.user_id);

    // A migráció SQL-je — a tranzakción belül (a ROLLBACK eltünteti)
    await c.query(SQL);
    console.log("\nA migráció SQL-je lefutott a tranzakción belül.\n\nPróbák:");

    let sp = 0;
    const expectErr = async (fn) => {
      const name = `sp${++sp}`;
      await c.query(`SAVEPOINT ${name}`);
      try { await fn(); await c.query(`ROLLBACK TO ${name}`); return null; }
      catch (e) { await c.query(`ROLLBACK TO ${name}`); return e; }
    };

    // --- T1: teljes másolat ---------------------------------------------------
    const { rows: [{ start_edit_draft: dId }] } = await c.query(`select public.start_edit_draft($1)`, [SERIES]);
    const { rows: [d] } = await c.query(`select * from public.draft_series where id=$1`, [dId]);
    report("T1a draft_series sor: edit/claimed, forrás = a Lego sorozat, hívó lefoglalta",
      d.pool_type === "edit" && d.pool_status === "claimed" && d.source_series_id === SERIES
        && d.claimed_by === owner.user_id && d.submitted_by === owner.user_id,
      `pool_type=${d.pool_type}, status=${d.pool_status}`);

    const { rows: [{ n: liveN }] } = await c.query(
      `select count(*) n from public.issues where series_id=$1 and not is_deleted`, [SERIES]);
    const { rows: [{ n: draftN }] } = await c.query(
      `select count(*) n from public.draft_issues where draft_series_id=$1`, [dId]);
    report("T1b draft_issues darabszám = élő NEM törölt Számok", +liveN === +draftN, `élő ${liveN}, draft ${draftN}`);

    const { rows: missing } = await c.query(
      `select i.id from public.issues i
        where i.series_id=$1 and not i.is_deleted
          and not exists (select 1 from public.draft_issues di
                           where di.draft_series_id=$2 and di.source_issue_id=i.id
                             and di.lapszam=i.lapszam and di.cim is not distinct from i.cim
                             and di.megjelenes is not distinct from i.megjelenes
                             and di.eredeti_ar is not distinct from i.eredeti_ar)`, [SERIES, dId]);
    const { rows: extra } = await c.query(
      `select di.id from public.draft_issues di
        where di.draft_series_id=$1
          and not exists (select 1 from public.issues i where i.id=di.source_issue_id and i.series_id=$2 and not i.is_deleted)`,
      [dId, SERIES]);
    report("T1c minden élő Szám mezőnként (lapszám/cím/dátum/ár) átmásolva, forrás-ID-vel, felesleg nélkül",
      missing.length === 0 && extra.length === 0, `hiányzik ${missing.length}, felesleges ${extra.length}`);

    const { rows: [{ n: liveC }] } = await c.query(
      `select count(*) n from public.components c join public.issues i on i.id=c.issue_id
        where i.series_id=$1 and not i.is_deleted`, [SERIES]);
    const { rows: [{ n: draftC }] } = await c.query(
      `select count(*) n from public.draft_components dc join public.draft_issues di on di.id=dc.draft_issue_id
        where di.draft_series_id=$1`, [dId]);
    const { rows: cMissing } = await c.query(
      `select c.id from public.components c join public.issues i on i.id=c.issue_id
        where i.series_id=$1 and not i.is_deleted
          and not exists (select 1 from public.draft_components dc
                            join public.draft_issues di on di.id=dc.draft_issue_id
                           where di.draft_series_id=$2 and dc.source_component_id=c.id
                             and di.source_issue_id=c.issue_id
                             and dc.tipus is not distinct from c.tipus
                             and dc.azonosito_tipus is not distinct from c.azonosito_tipus
                             and dc.azonosito is not distinct from c.azonosito
                             and dc.megnevezes is not distinct from c.megnevezes)`, [SERIES, dId]);
    report("T1d komponensek: darabszám és mezők egyeznek, a megfelelő draft-Számhoz kötve",
      +liveC === +draftC && cMissing.length === 0, `élő ${liveC}, draft ${draftC}, hiányzik ${cMissing.length}`);

    const { rows: [{ n: delN }] } = await c.query(
      `select count(*) n from public.issues where series_id=$1 and is_deleted`, [SERIES]);
    const { rows: [{ n: delCopied }] } = await c.query(
      `select count(*) n from public.draft_issues di join public.issues i on i.id=di.source_issue_id
        where di.draft_series_id=$1 and i.is_deleted`, [dId]);
    report("T1e a törölt (soft-delete) élő Számokat nem másolja", +delCopied === 0, `törölt élő Számok: ${delN}, ebből másolva: ${delCopied}`);

    // --- T2: második indítás -------------------------------------------------
    const e2 = await expectErr(() => c.query(`select public.start_edit_draft($1)`, [SERIES]));
    report("T2 második indítás ugyanarra a sorozatra → érthető hiba",
      !!e2 && /már van nyitott szerkesztési munkaanyag/.test(e2.message), e2 ? e2.message : "NEM dobott hibát");

    // --- T3: index közvetlen beszúrásnál ------------------------------------------
    const e3 = await expectErr(() => c.query(
      `insert into public.draft_series (pool_type, pool_status, source_series_id, submitted_by, kiado, megnevezes)
       values ('edit','claimed',$1,$2,'x','x')`, [SERIES, owner.user_id]));
    report("T3 a részleges egyedi index közvetlen beszúrásnál is véd (23505)",
      !!e3 && e3.code === "23505", e3 ? `${e3.code}: ${e3.message}` : "NEM dobott hibát");

    // --- T4: nem aktív sorozat -------------------------------------------------
    const { rows: lifecycles } = await c.query(`select lifecycle, count(*) n from public.series group by 1 order by 1`);
    console.log(`  (a sorozatok életciklus-állapotai: ${lifecycles.map(x => `${x.lifecycle}×${x.n}`).join(", ")})`);
    const { rows: [other] } = await c.query(
      `select id from public.series where id <> $1 and lifecycle = 'active' and force_delete_requested_at is null limit 1`, [SERIES]);
    if (other) {
      await c.query(`update public.series set lifecycle='unpublished' where id=$1`, [other.id]);   // tranzakción belül
      const e4 = await expectErr(() => c.query(`select public.start_edit_draft($1)`, [other.id]));
      report("T4 nem aktív (publikálatlan) sorozat → érthető hiba",
        !!e4 && /csak aktív \(publikált\) sorozaton/.test(e4.message), e4 ? e4.message : "NEM dobott hibát");
      await c.query(`update public.series set lifecycle='active', force_delete_requested_at = now() where id=$1`, [other.id]);
      const e5 = await expectErr(() => c.query(`select public.start_edit_draft($1)`, [other.id]));
      report("T5 törlésre jelölt sorozat → érthető hiba",
        !!e5 && /törlésre jelölt/.test(e5.message), e5 ? e5.message : "NEM dobott hibát");
    } else {
      report("T4/T5 kihagyva — nincs másik aktív sorozat", false, "nem volt kire kipróbálni");
    }

    // --- T6: nem létező sorozat, nem staff hívó ---------------------------------
    const e6a = await expectErr(() => c.query(`select public.start_edit_draft(gen_random_uuid())`));
    report("T6a nem létező sorozat → hiba", !!e6a && /nem található/.test(e6a.message), e6a ? e6a.message : "NEM dobott hibát");

    const { rows: [nonStaff] } = await c.query(
      `select user_id from public.members where role = 'user' limit 1`);
    const who = nonStaff ? nonStaff.user_id : "00000000-0000-0000-0000-000000000000";
    await asUser(who);
    const e6b = await expectErr(() => c.query(`select public.start_edit_draft($1)`, [SERIES]));
    report(`T6b ${nonStaff ? "nem staff tag" : "ismeretlen felhasználó"} → jogosultsági hiba`,
      !!e6b && /Nincs jogosultságod/.test(e6b.message), e6b ? e6b.message : "NEM dobott hibát");
    await asUser(owner.user_id);

    // --- T7: változtatás nélküli publikálás --------------------------------------
    const vBefore = (await c.query(
      `select coalesce(sum(version),0)::int s from public.issues where series_id=$1`, [SERIES])).rows[0].s;
    const sBefore = (await c.query(`select version from public.series where id=$1`, [SERIES])).rows[0].version;
    const maxlog = (await c.query(`select coalesce(max(id),0) m from public.change_log`)).rows[0].m;
    await c.query(`update public.draft_series set pool_status='ready', ready_at=now() where id=$1`, [dId]);
    await c.query(`select public.publish_draft_series($1)`, [dId]);
    await c.query(`set constraints all immediate`);
    const vAfter = (await c.query(
      `select coalesce(sum(version),0)::int s from public.issues where series_id=$1`, [SERIES])).rows[0].s;
    const sAfter = (await c.query(`select version from public.series where id=$1`, [SERIES])).rows[0].version;
    const newLogs = +(await c.query(`select count(*) n from public.change_log where id > $1`, [maxlog])).rows[0].n;
    report("T7 változtatás nélküli publikálás: nincs verzióemelés, nincs új change_log sor",
      vAfter === vBefore && sAfter === sBefore && newLogs === 0,
      `Számok verzió-összege ${vBefore} → ${vAfter}, sorozat v${sBefore} → v${sAfter}, új change_log: ${newLogs}`);
  } catch (e) {
    console.log("\nHIBA a próba közben:", e.message);
    report("a próba végigfutott", false, e.message);
  } finally {
    // MINDIG visszagörgetés. Ez a script soha nem commitol.
    try { await c.query("ROLLBACK"); } catch (_) {}
    console.log("\n── ROLLBACK megtörtént ──");
    await counts(c, "UTÁNA (ugyanazon a kapcsolaton, ROLLBACK után):");
    await c.end();

    const c2 = new Client({ connectionString: DATABASE_URL });
    await c2.connect();
    const fresh = await counts(c2, "UTÁNA (külön, friss kapcsolaton):");
    await c2.end();

    const keys = Object.keys(before).filter(k => k !== "change_log_sequence");
    const diff = keys.filter(k => String(before[k]) !== String(fresh[k]));
    console.log(diff.length
      ? `\n✘ ELTÉRÉS a számlálókban: ${diff.map(k => `${k}: ${before[k]} → ${fresh[k]}`).join("; ")}`
      : "\n✔ IGAZOLÁS: az ELŐTTE és az UTÁNA számlálók (draftok, Számok, komponensek, verziók, change_log, member_seen, index, függvény) azonosak — semmi nem maradt meg.");
    if (before.change_log_sequence !== fresh.change_log_sequence)
      console.log(`  (Megjegyzés: a change_log azonosító-sorozata nem görgethető vissza: ${before.change_log_sequence} → ${fresh.change_log_sequence}; a következő valódi bejegyzés azonosítójában hézag lesz, ez ártalmatlan.)`);

    const bad = results.filter(r => !r.ok);
    console.log(`\nPróbák: ${results.length - bad.length}/${results.length} sikeres`
      + (bad.length ? ` — NEM sikerült: ${bad.map(r => r.name.split(" ")[0]).join(", ")}` : ""));
  }
})().catch(e => { console.error("Váratlan hiba:", e.message); process.exit(1); });
