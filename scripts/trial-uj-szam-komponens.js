/* ============================================================
   Új Szám → komponens-alap (apply_draft_upload / propose_bulk_issues),
   a „Kész” védelem (mark_draft_ready) és az Autós Legendák adatjavítása —
   VALIDÁCIÓS PRÓBA.

   FIGYELEM — ÉLŐ ADATBÁZISON FUT. CSAK a tulajdonos ELŐZETES, kifejezett
   jóváhagyásával futtatható (szabály: élő adaton DB-érintő tesztet —
   visszagörgetettet is — csak jóváhagyással). EGYETLEN tranzakcióban
   dolgozik, a végén MINDIG ROLLBACK; ez a script SOHA nem commitol.
   A három migrációs SQL a tranzakción BELÜL jön létre/fut le (a PostgreSQL
   DDL tranzakciós), így a ROLLBACK után semmi nem marad meg — a végén ezt a
   számlálókkal is igazolja, külön, friss kapcsolaton is. A publikálást NEM
   hívja, így a change_log sorozata sem lép.

   Mit ellenőriz:
     T1  apply_draft_upload, ÚJ sorok, ÜRES komponens-cellákkal (a hiba esete):
         minden deklarált típusból létrejön egy üres példány
     T2  részben kitöltött / két azonos típusú példányos / nem deklarált típusú
         új sor — nincs duplikálás, az új típus a sorozat listájára kerül
     T3  a három út (kézi szerkesztő / beküldői RPC / Excel) AZONOS eredményt ad
     T4  mark_draft_ready: komponens nélküli új Szám → érthető hiba;
         komponensekkel → Kész; meglévő (élő párú) komponens nélküli Szám nem blokkol
     T5  az Autós Legendák adatjavítása: 60 komponens, 0 hiányzó member_seen,
         0 felkiáltójel; második futtatás megáll (előfeltétel-védelem)
   Használat: node scripts/trial-uj-szam-komponens.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const AUTO = "45d431fc-d769-4bd9-9639-42b9e4f01d02";   // Autós Legendák
const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const SQL_ALAP = rd("laprol-lapra-uj-szam-komponens-alap.sql");
const SQL_KESZ = rd("laprol-lapra-kesz-komponens-vedelem.sql");
const SQL_REPAIR = rd("laprol-lapra-autos-legendak-komponens-javitas.sql");

async function counts(c, label) {
  const q = async (sql, p) => (await c.query(sql, p)).rows[0];
  const seqName = (await q(`select pg_get_serial_sequence('public.change_log','id') as s`)).s;
  const seq = seqName ? (await q(`select last_value::text as v, is_called from ${seqName}`)) : null;
  const r = {
    draft_series:     +(await q(`select count(*) n from public.draft_series`)).n,
    draft_issues:     +(await q(`select count(*) n from public.draft_issues`)).n,
    draft_components: +(await q(`select count(*) n from public.draft_components`)).n,
    series:           +(await q(`select count(*) n from public.series`)).n,
    issues:           +(await q(`select count(*) n from public.issues`)).n,
    components:       +(await q(`select count(*) n from public.components`)).n,
    autos_szamok:     +(await q(`select count(*) n from public.issues where series_id=$1`, [AUTO])).n,
    autos_komponensek: +(await q(`select count(*) n from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1`, [AUTO])).n,
    member_seen_sorok: +(await q(`select count(*) n from public.member_seen`)).n,
    change_log_sorok: +(await q(`select count(*) n from public.change_log`)).n,
    change_log_max_id: +(await q(`select coalesce(max(id),0) n from public.change_log`)).n,
    fn_apply_hash:    (await q(`select md5(pg_get_functiondef('public.apply_draft_upload(uuid,jsonb)'::regprocedure)) h`)).h,
    fn_ready_hash:    (await q(`select md5(pg_get_functiondef('public.mark_draft_ready(uuid)'::regprocedure)) h`)).h,
    fn_propose_hash:  (await q(`select md5(pg_get_functiondef('public.propose_bulk_issues(uuid,jsonb)'::regprocedure)) h`)).h,
    change_log_sequence: seq ? `${seq.v} (is_called=${seq.is_called})` : "?",
  };
  console.log(`\n${label}`);
  Object.entries(r).forEach(([k, v]) => console.log(`  ${k.padEnd(26)} ${v}`));
  return r;
}

const results = [];
const report = (name, ok, detail) => {
  results.push({ name, ok });
  console.log(`  ${ok ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`);
};
const uuid = () => crypto.randomUUID();

(async () => {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  let before;
  try {
    before = await counts(c, "ELŐTTE (commitolt állapot):");
    const { rows: [owner] } = await c.query(`select user_id from public.members where role='owner' limit 1`);

    await c.query("BEGIN");
    await c.query(`select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)`,
      [owner.user_id, JSON.stringify({ sub: owner.user_id, role: "authenticated" })]);

    await c.query(SQL_ALAP);
    await c.query(SQL_KESZ);
    console.log("\nA migrációs SQL-ek lefutottak a tranzakción belül.\n\nPróbák:");

    let sp = 0;
    const expectErr = async fn => {
      const n = `sp${++sp}`;
      await c.query(`SAVEPOINT ${n}`);
      try { await fn(); await c.query(`ROLLBACK TO ${n}`); return null; }
      catch (e) { await c.query(`ROLLBACK TO ${n}`); return e; }
    };
    const newDraft = async (status, comps, name) => (await c.query(
      `insert into public.draft_series (pool_type, pool_status, submitted_by, claimed_by, claimed_at, kiado, megnevezes, megjelenites, szin, components)
       values ('new',$1,$2,$3,$4,'egyeb',$5,$5,'#336699',$6) returning id`,
      [status, owner.user_id, status === "incoming" ? null : owner.user_id, status === "incoming" ? null : new Date().toISOString(), name, comps])).rows[0].id;
    // egy Szám komponensei normalizált alakban: "tipus|azonosito|megnevezes|azonosito_tipus|source"
    const compsOf = async iid => (await c.query(
      `select tipus, azonosito, megnevezes, azonosito_tipus, source_component_id from public.draft_components where draft_issue_id=$1
        order by tipus, azonosito nulls first, megnevezes nulls first`, [iid])).rows
      .map(r => [r.tipus, r.azonosito, r.megnevezes, r.azonosito_tipus, r.source_component_id].join("|"));
    const issueByNum = async (did, n) => (await c.query(`select id from public.draft_issues where draft_series_id=$1 and lapszam=$2`, [did, n])).rows[0].id;
    const emptyKF = ["figura||||", "konyv||||"];

    // ---------- T1 + T2: Excel-út (apply_draft_upload) ----------
    const D = await newDraft("claimed", ["konyv", "figura"], "PRÓBA Excel-út");
    const ids = { n1: uuid(), n2: uuid(), n3: uuid(), n4: uuid() };
    const payload = { delete_ids: [], items: [
      { id: null, new_id: ids.n1, lapszam: 1, cim: "Üres cellák", megjelenes: null, eredeti_ar: 100, comps: [] },                                 // a hiba esete
      { id: null, new_id: ids.n2, lapszam: 2, cim: "Részben kitöltött", megjelenes: null, eredeti_ar: 100, comps: [{ tipus: "konyv", azonosito: "978-1", megnevezes: null }] },
      { id: null, new_id: ids.n3, lapszam: 3, cim: "Két példány", megjelenes: null, eredeti_ar: 100, comps: [{ tipus: "konyv", azonosito: "a", megnevezes: null }, { tipus: "konyv", azonosito: "b", megnevezes: null }] },
      { id: null, new_id: ids.n4, lapszam: 4, cim: "Új típus", megjelenes: null, eredeti_ar: 100, comps: [{ tipus: "egyeb", azonosito: "x", megnevezes: null }] },
    ] };
    const { rows: [{ r: res }] } = await c.query(`select public.apply_draft_upload($1,$2::jsonb) r`, [D, JSON.stringify(payload)]);
    console.log("  (apply_draft_upload visszatérés: " + JSON.stringify(res) + ")");
    const g1 = await compsOf(ids.n1), g2 = await compsOf(ids.n2), g3 = await compsOf(ids.n3), g4 = await compsOf(ids.n4);
    report("T1 üres komponens-cellás új sor: minden deklarált típusból üres példány",
      JSON.stringify(g1) === JSON.stringify(emptyKF), g1.join(" ; "));
    report("T2a részben kitöltött: a kitöltött + az üres másik típus, duplikálás nélkül",
      JSON.stringify(g2) === JSON.stringify(["figura||||", "konyv|978-1|||"]), g2.join(" ; "));
    report("T2b két azonos típusú példány: mindkettő megmarad + az üres másik típus (nincs extra üres konyv)",
      JSON.stringify(g3) === JSON.stringify(["figura||||", "konyv|a|||", "konyv|b|||"]), g3.join(" ; "));
    report("T2c nem deklarált típus: létrejön + a deklarált típusok üresen kiegészülnek",
      JSON.stringify(g4) === JSON.stringify(["egyeb|x|||", "figura||||", "konyv||||"]), g4.join(" ; "));
    const { rows: [dsr] } = await c.query(`select components from public.draft_series where id=$1`, [D]);
    report("T2d az új típus a sorozat komponens-listájára kerül, a sorrend megmarad",
      JSON.stringify(dsr.components) === JSON.stringify(["konyv", "figura", "egyeb"]), JSON.stringify(dsr.components));
    report("T2e a visszatérési JSON auto_komponens száma stimmel (2+1+1+2 = 6)", res.auto_komponens === 6, "auto_komponens=" + res.auto_komponens);

    // ---------- T3: a három út azonos eredményt ad ----------
    // kézi szerkesztő: a kliens (draft-items.js) minden deklarált típushoz üres példányt szúr be
    const M = await newDraft("claimed", ["konyv", "figura"], "PRÓBA kézi szerkesztő");
    const miid = uuid();
    await c.query(`insert into public.draft_issues (id, draft_series_id, lapszam, cim, eredeti_ar) values ($1,$2,1,'Kézi',100)`, [miid, M]);
    for (const t of ["konyv", "figura"]) {
      await c.query(`insert into public.draft_components (draft_issue_id, tipus, azonosito_tipus, azonosito, megnevezes, source_component_id) values ($1,$2,null,null,null,null)`, [miid, t]);
    }
    // beküldői RPC: (a) a kliens ma minden csoportot átad, (b) üres comps-szal is teljes legyen
    const P = await newDraft("incoming", ["konyv", "figura"], "PRÓBA beküldő");
    const { rows: [{ r: pr }] } = await c.query(`select public.propose_bulk_issues($1,$2::jsonb) r`, [P, JSON.stringify([
      { lapszam: 1, cim: "Teljes comps", megjelenes: null, eredeti_ar: 100, comps: [{ tipus: "konyv", azonosito: null, megnevezes: null }, { tipus: "figura", azonosito: null, megnevezes: null }] },
      { lapszam: 2, cim: "Üres comps", megjelenes: null, eredeti_ar: 100, comps: [] },
    ])]);
    const p1 = await compsOf(await issueByNum(P, 1)), p2 = await compsOf(await issueByNum(P, 2)), m1 = await compsOf(miid);
    const same = JSON.stringify(g1) === JSON.stringify(m1) && JSON.stringify(m1) === JSON.stringify(p1) && JSON.stringify(p1) === JSON.stringify(p2);
    report("T3 Excel-út (üres cellák) = kézi szerkesztő = beküldői RPC (teljes és üres comps) — azonos komponens-készlet",
      same, `Excel: ${g1.join(",")} | kézi: ${m1.join(",")} | beküldő: ${p1.join(",")} / ${p2.join(",")}`);

    // ---------- T4: mark_draft_ready ----------
    // a) komponensekkel rendelkező új Számok → Kész (a D draftban 1–4. Szám, mind van komponens)
    await c.query(`select public.mark_draft_ready($1)`, [D]);
    const { rows: [dst] } = await c.query(`select pool_status from public.draft_series where id=$1`, [D]);
    report("T4a minden új Számnak van komponense → „Kész” megy", dst.pool_status === "ready", "pool_status=" + dst.pool_status);

    // b) komponens nélküli új Szám → érthető hiba
    const G = await newDraft("claimed", ["konyv"], "PRÓBA komponens nélkül");
    for (const [n, cim] of [[5, "Lamborghini"], [6, "Bugatti"], [7, null]])
      await c.query(`insert into public.draft_issues (draft_series_id, lapszam, cim) values ($1,$2,$3)`, [G, n, cim]);
    const e4 = await expectErr(() => c.query(`select public.mark_draft_ready($1)`, [G]));
    report("T4b komponens nélküli új Szám(ok) → érthető hiba, felsorolja a Számokat",
      !!e4 && /3 új Számnak nincs egyetlen komponense sem/.test(e4.message) && /#5 „Lamborghini”/.test(e4.message) && /#7 „cím nélkül”/.test(e4.message),
      e4 ? e4.message.replace(/\n+/g, " ⏎ ") : "NEM dobott hibát");
    const { rows: [gst] } = await c.query(`select pool_status from public.draft_series where id=$1`, [G]);
    report("T4c a hibás draft nem lépett át „Kész”-be", gst.pool_status === "claimed", "pool_status=" + gst.pool_status);

    // d) a törlésre jelölt új Szám nem számít
    await c.query(`update public.draft_issues set deleted = true where draft_series_id=$1`, [G]);
    await c.query(`select public.mark_draft_ready($1)`, [G]);
    report("T4d a törlésre jelölt (komponens nélküli) új Szám nem blokkol", true);

    // e) meglévő (élő párú) komponens nélküli Számok nem blokkolnak: szerkesztési draft az Autósból
    const { rows: [{ sd }] } = await c.query(`select public.start_edit_draft($1) sd`, [AUTO]);
    const { rows: [cnt] } = await c.query(`select count(*)::int n, count(*) filter (where not exists (select 1 from public.draft_components dc where dc.draft_issue_id=di.id))::int nc
                                              from public.draft_issues di where di.draft_series_id=$1`, [sd]);
    await c.query(`select public.mark_draft_ready($1)`, [sd]);
    report("T4e meglévő (élő párú) komponens nélküli Számok nem blokkolnak (Autós szerkesztési draft)",
      cnt.n === 60 && cnt.nc === 60, `${cnt.n} Szám, ebből ${cnt.nc} komponens nélkül → Kész sikerült`);

    // ---------- T5: Autós Legendák adatjavítás ----------
    const bef = (await c.query(`select count(*)::int n from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1`, [AUTO])).rows[0].n;
    await c.query(SQL_REPAIR);
    const aft = (await c.query(`select count(*)::int n, count(*) filter (where c.tipus='konyv' and c.azonosito is null and c.megnevezes is null and c.azonosito_tipus is null and c.version=1 and c.db=1 and c.user_id=$2)::int pontos
                                  from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1`, [AUTO, owner.user_id])).rows[0];
    const perIssue = (await c.query(`select count(*)::int n from (select i.id from public.issues i left join public.components c on c.issue_id=i.id
                                       where i.series_id=$1 and not i.is_deleted group by i.id having count(c.id)=1) x`, [AUTO])).rows[0].n;
    report("T5a az adatjavítás: 0 → 60 komponens, mindegyik üres „konyv”, version=1, db=1, user_id = tulajdonos",
      bef === 0 && aft.n === 60 && aft.pontos === 60 && perIssue === 60, `előtte ${bef}, utána ${aft.n}, pontos ${aft.pontos}, Számonként 1: ${perIssue}`);
    const unseen = (await c.query(
      `select count(*)::int n from public.components c join public.issues i on i.id=c.issue_id
        where i.series_id=$1 and c.version > coalesce((select last_seen_version from public.member_seen x where x.user_id=$2 and x.entity_type='component' and x.entity_id=c.id),0)`,
      [AUTO, owner.user_id])).rows[0].n;
    report("T5b a tulajdonosnál 0 komponens-felkiáltójel (verzió > látott)", unseen === 0, "felkiáltójelet adó komponens: " + unseen);
    const e5 = await expectErr(() => c.query(SQL_REPAIR));
    report("T5c a második futtatás megáll (előfeltétel-védelem), nem duplikál", !!e5 && /nem az elvárt/.test(e5.message), e5 ? e5.message : "NEM dobott hibát");

    // ---------- a publikálás-szimuláció: a javított draft publikálható-e ----------
    // (nem hívjuk — a change_log sorozata ne lépjen; az T1–T4 az új Számok komponens-készletét igazolja)
  } catch (e) {
    console.log("\nHIBA a próba közben:", e.message);
    report("a próba végigfutott", false, e.message);
  } finally {
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
      : "\n✔ IGAZOLÁS: az ELŐTTE és az UTÁNA számlálók (draftok, Számok, komponensek, member_seen, change_log, a három függvény definíciója) azonosak — semmi nem maradt meg.");
    const bad = results.filter(r => !r.ok);
    console.log(`\nPróbák: ${results.length - bad.length}/${results.length} sikeres` + (bad.length ? ` — NEM sikerült: ${bad.map(r => r.name.split(" ")[0]).join(", ")}` : ""));
  }
})().catch(e => { console.error("Váratlan hiba:", e.message); process.exit(1); });
