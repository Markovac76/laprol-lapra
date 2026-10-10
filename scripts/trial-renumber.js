/* ============================================================
   ÁTSZÁMOZÁS-PRÓBA (a 7. pont, "lapszám-csendesítés" élő ellenőrzése).

   FIGYELEM — ÉLŐ ADATBÁZISON FUT. CSAK a tulajdonos ELŐZETES, kifejezett
   jóváhagyásával futtatható (szabály: élő adaton DB-érintő tesztet —
   visszagörgetettet is — csak jóváhagyással). EGYETLEN tranzakcióban
   dolgozik, a végén MINDIG ROLLBACK; ez a script SOHA nem commitol.
   Az egyetlen nem visszagörgethető mellékhatás a change_log azonosító-
   sorozatának (sequence) előreléptetése: a következő valódi bejegyzés
   azonosítójában hézag lesz.

   Mit csinál (a tranzakción belül):
     1) a Lego Star Wars sorozatból szerkesztési draftot készít ugyanúgy,
        ahogy a "Szerkesztés indítása" (a draft_issues/draft_components a
        teljes élő állapot másolata),
     2) négy tételt módosít:
          • #39 — CSAK a lapszám (39 → 1039)
          • #40 — lapszám ÉS dátum (40 → 1040, megjelenés +1 nap)
          • #1 ↔ #2 — a lapszám felcserélése (csak lapszám, mindkettő)
     3) lefuttatja a publish_draft_series()-t,
     4) kiírja a Számok verzióját előtte/utána, az új change_log sorokat, azt,
        hogy a tulajdonosnál lenne-e felkiáltójel, és a change_log szabályait,
     5) ROLLBACK.
   Előtte és utána számlálók (az adatbázis tényleges, commitolt állapota),
   a végén külön, friss kapcsolaton is ellenőrizve.

   Használat: node scripts/trial-renumber.js
   ============================================================ */
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const SERIES = "c38da324-ddca-48d4-8f44-be85496e41e0";   // Lego Star Wars Magazin

async function counts(c, label) {
  const q = async (sql, p) => (await c.query(sql, p)).rows[0];
  const seqName = (await q(`select pg_get_serial_sequence('public.change_log','id') as s`)).s;
  const seq = seqName ? (await q(`select last_value::text as v, is_called from ${seqName}`)) : null;
  const r = {
    draft_series:     +(await q(`select count(*) n from public.draft_series`)).n,
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
    change_log_sequence: seq ? `${seq.v} (is_called=${seq.is_called})` : "?",
  };
  console.log(`\n${label}`);
  Object.entries(r).forEach(([k, v]) => console.log(`  ${k.padEnd(26)} ${v}`));
  return r;
}

(async () => {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  let before;
  try {
    before = await counts(c, "ELŐTTE (commitolt állapot):");
    const { rows: [owner] } = await c.query(`select user_id from public.members where role='owner' limit 1`);
    const { rows: [ser] } = await c.query(`select * from public.series where id=$1`, [SERIES]);
    const { rows: live } = await c.query(
      `select id, lapszam, cim, megjelenes, version from public.issues where series_id=$1 and not is_deleted order by lapszam`, [SERIES]);
    const byN = n => live.find(i => i.lapszam === n);
    const [i1, i2, i39, i40] = [byN(1), byN(2), byN(39), byN(40)];
    if (!i1 || !i2 || !i39 || !i40) throw new Error("A #1/#2/#39/#40 Szám nem mind létezik — a próba nem értelmes.");
    const maxlog = before.change_log_max_id;

    // seen: a tulajdonos "utoljára látott" verziója előtte
    const seenOf = async ids => Object.fromEntries((await c.query(
      `select entity_id, last_seen_version v from public.member_seen where user_id=$1 and entity_type='issue' and entity_id = any($2::uuid[])`,
      [owner.user_id, ids])).rows.map(r => [r.entity_id, r.v]));
    const seen = await seenOf([i1.id, i2.id, i39.id, i40.id]);

    await c.query("BEGIN");
    await c.query(`select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)`,
      [owner.user_id, JSON.stringify({ sub: owner.user_id, role: "authenticated" })]);

    // 1) szerkesztési draft (mint a "Szerkesztés indítása"), közvetlenül "ready" állapotban
    const { rows: [d] } = await c.query(
      `insert into public.draft_series (pool_type, pool_status, source_series_id, submitted_by, claimed_by, claimed_at,
         kiado, megnevezes, megjelenites, szin, kategoria, components, ready_at)
       values ('edit','ready',$1,$2,$2,now(),$3,$4,$5,$6,$7,$8,now()) returning id`,
      [SERIES, owner.user_id, ser.kiado, ser.megnevezes, ser.megjelenites, ser.szin, ser.kategoria, ser.components]);
    await c.query(
      `insert into public.draft_issues (draft_series_id, source_issue_id, lapszam, cim, megjelenes, eredeti_ar)
       select $1, id, lapszam, cim, megjelenes, eredeti_ar from public.issues where series_id=$2`, [d.id, SERIES]);
    await c.query(
      `insert into public.draft_components (draft_issue_id, source_component_id, tipus, azonosito_tipus, azonosito, megnevezes)
       select di.id, c.id, c.tipus, c.azonosito_tipus, c.azonosito, c.megnevezes
         from public.components c join public.draft_issues di on di.source_issue_id = c.issue_id
        where di.draft_series_id=$1`, [d.id]);

    // 2) módosítások a draftban
    const upd = (id, set, p=[]) => c.query(`update public.draft_issues set ${set} where draft_series_id=$1 and source_issue_id=$2`, [d.id, id, ...p]);
    await upd(i39.id, `lapszam = 1039`);                                           // csak lapszám
    await upd(i40.id, `lapszam = 1040, megjelenes = megjelenes + 1`);              // lapszám + dátum
    await upd(i1.id,  `lapszam = ${i2.lapszam}`);                                  // csere: #1 ↔ #2 (csak lapszám)
    await upd(i2.id,  `lapszam = ${i1.lapszam}`);

    // 3) publikálás (a halasztott ellenőrzéseket is kényszerítjük)
    try {
      await c.query(`select public.publish_draft_series($1)`, [d.id]);
      await c.query(`set constraints all immediate`);
      console.log("\n✔ A publikálás HIBA NÉLKÜL lefutott (a halasztott ellenőrzésekkel együtt).");
    } catch (e) {
      console.log("\n✘ A publikálás HIBÁVAL állt le:", e.message);
      throw e;
    }

    // 4) eredmények a tranzakción belül
    const after = (await c.query(`select id, lapszam, cim, megjelenes, version from public.issues where id = any($1::uuid[])`,
      [[i1.id, i2.id, i39.id, i40.id]])).rows;
    const A = Object.fromEntries(after.map(r => [r.id, r]));
    const rows = [
      ["#39 „2026. 5.szám” — csak lapszám", i39],
      ["#40 „2026. 6.szám” — lapszám + dátum", i40],
      ["#1 — csere #2-vel (csak lapszám)", i1],
      ["#2 — csere #1-gyel (csak lapszám)", i2],
    ];
    console.log("\nSzámok (a tranzakción belül, publikálás után):");
    rows.forEach(([name, b]) => {
      const a = A[b.id];
      const felkialt = a.version > (seen[b.id] ?? 0);
      console.log(`  ${name}`);
      console.log(`      lapszám ${b.lapszam} → ${a.lapszam} | verzió ${b.version} → ${a.version}${a.version === b.version ? " (NEM emelkedett)" : " (emelkedett)"}`
        + ` | tulajdonos utoljára látott: v${seen[b.id]} | felkiáltójel: ${felkialt ? "IGEN" : "nem"}`);
    });
    const { rows: logs } = await c.query(
      `select cl.id, cl.entity_type, cl.field_name, cl.old_value, cl.new_value, cl.version, cl.is_current, i.lapszam as szam_lapszam, i.version as szam_verzio
         from public.change_log cl left join public.issues i on i.id=cl.entity_id and cl.entity_type='issue'
        where cl.id > $1 order by cl.id`, [maxlog]);
    console.log(`\nÚj change_log sorok (${logs.length} db):`);
    logs.forEach(l => console.log(`  #${l.id} ${l.entity_type}.${l.field_name}: „${l.old_value}” → „${l.new_value}” | naplózott verzió=${l.version} | a Szám (most ${l.szam_lapszam}.) verziója=${l.szam_verzio} | is_current=${l.is_current}`));

    // ugyanazon a verzión több bejegyzés ugyanarra az entitás+mezőre?
    const { rows: dups } = await c.query(
      `select entity_id, field_name, version, count(*) n from public.change_log
        where entity_type='issue' and field_name='lapszam' group by 1,2,3 having count(*)>1`);
    console.log(`\nUgyanazon (entitás, mező, verzió) hármasra több naplósor: ${dups.length} db`
      + (dups.length ? " — pl. " + dups.slice(0,4).map(x => `${x.field_name}@v${x.version}×${x.n}`).join(", ") : ""));
    const { rows: cur } = await c.query(
      `select entity_id, field_name, count(*) filter (where is_current) cur from public.change_log
        where entity_type='issue' and entity_id = any($1::uuid[]) group by 1,2 having count(*) filter (where is_current) <> 1`,
      [[i1.id, i2.id, i39.id, i40.id]]);
    console.log(`Olyan (Szám, mező), ahol NEM pontosan egy sor is_current: ${cur.length} db`);

    // a change_log szabályai
    const { rows: cons } = await c.query(`select conname, contype, pg_get_constraintdef(oid) d from pg_constraint where conrelid='public.change_log'::regclass`);
    const { rows: idx } = await c.query(`select indexdef from pg_indexes where schemaname='public' and tablename='change_log'`);
    const { rows: trg } = await c.query(`select tgname from pg_trigger where tgrelid='public.change_log'::regclass and not tgisinternal`);
    console.log("\nchange_log szabályok:");
    console.log("  constraintek:", JSON.stringify(cons.map(x => `${x.conname} [${x.contype}] ${x.d}`)));
    console.log("  indexek:     ", JSON.stringify(idx.map(x => x.indexdef)));
    console.log("  triggerek:   ", JSON.stringify(trg.map(x => x.tgname)));

    const { rows: [mid2] } = await c.query(
      `select (select count(*) from public.issues where series_id=$1 and not is_deleted) aktiv,
              (select count(*) from public.draft_series) ds`, [SERIES]);
    console.log(`\nA tranzakción BELÜL: aktív Számok=${mid2.aktiv}, draft_series sorok=${mid2.ds} (a publikálás törölte a próba-draftot)`);
  } catch (e) {
    console.log("\nHIBA a próba közben:", e.message);
  } finally {
    // MINDIG visszagörgetés. Ez a script soha nem commitol.
    try { await c.query("ROLLBACK"); } catch (_) {}
    console.log("\n── ROLLBACK megtörtént ──");
    const afterSame = await counts(c, "UTÁNA (ugyanazon a kapcsolaton, ROLLBACK után):");
    await c.end();

    // független, friss kapcsolat — ne csak a saját munkamenetünk látványát lássuk
    const c2 = new Client({ connectionString: DATABASE_URL });
    await c2.connect();
    const fresh = await counts(c2, "UTÁNA (külön, friss kapcsolaton):");
    await c2.end();

    const keys = Object.keys(before).filter(k => k !== "change_log_sequence");
    const diff = keys.filter(k => String(before[k]) !== String(fresh[k]));
    console.log(diff.length
      ? `\n✘ ELTÉRÉS a számlálókban: ${diff.map(k => `${k}: ${before[k]} → ${fresh[k]}`).join("; ")}`
      : "\n✔ IGAZOLÁS: az ELŐTTE és az UTÁNA számlálók (draftok, Számok, komponensek, verziók, change_log, member_seen) azonosak — semmi nem maradt meg.");
    if (before.change_log_sequence !== fresh.change_log_sequence)
      console.log(`  (Megjegyzés: a change_log azonosító-sorozata nem görgethető vissza: ${before.change_log_sequence} → ${fresh.change_log_sequence}; a következő valódi bejegyzés azonosítójában hézag lesz, ez ártalmatlan.)`);
  }
})().catch(e => { console.error("Váratlan hiba:", e.message); process.exit(1); });
