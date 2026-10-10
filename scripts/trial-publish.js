/* ============================================================
   PRÓBA-PUBLIKÁLÁS — a publish_draft_series() lefuttatása egy draftra,
   amit a script MINDIG visszagörget (ROLLBACK). Soha nem commitol, tehát
   az élő adat és a draft érintetlen marad. Arra jó, hogy ellenőrizzük,
   fennakadás nélkül publikálható-e egy munkaanyag, és hogy mi változna.

   A hívó (staff) azonosságát a tranzakción belül a tulajdonos JWT-
   claimjének beállításával szimuláljuk (auth.uid()), ugyanúgy, ahogy a
   Supabase kliens hívása látná.

   Használat: node scripts/trial-publish.js <draft_series uuid>
   ============================================================ */
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const draftId = process.argv[2];
if (!/^[0-9a-f-]{36}$/i.test(draftId || "")) {
  console.error("Használat: node scripts/trial-publish.js <draft_series uuid>");
  process.exit(1);
}

async function snapshot(c, seriesId) {
  const q = async (sql, p) => (await c.query(sql, p)).rows[0];
  return {
    aktivSzamok: +(await q(`select count(*) n from public.issues where series_id=$1 and not is_deleted`, [seriesId])).n,
    torolt: +(await q(`select count(*) n from public.issues where series_id=$1 and is_deleted`, [seriesId])).n,
    komponensek: +(await q(`select count(*) n from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1`, [seriesId])).n,
    changeLog: +(await q(`select count(*) n from public.change_log`)).n,
    sorozatVerzio: (await q(`select version v from public.series where id=$1`, [seriesId])).v,
  };
}

(async () => {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  let committed = false;
  try {
    const { rows: [d] } = await c.query(
      `select id, pool_type, pool_status, source_series_id, megnevezes from public.draft_series where id=$1`, [draftId]);
    if (!d) { console.error("A draft nem található."); return; }
    console.log(`Draft: „${d.megnevezes}” (${d.pool_type}, állapot: ${d.pool_status})`);
    if (!d.source_series_id) { console.log("Új sorozat javaslat — a próba-publikálás összehasonlítása csak szerkesztési draftnál értelmes."); }
    const seriesId = d.source_series_id;
    const { rows: [owner] } = await c.query(`select user_id from public.members where role='owner' limit 1`);

    await c.query("BEGIN");
    // Szimulált hívó: a tulajdonos. (A függvény SECURITY DEFINER, az auth.uid() a claimből jön.)
    await c.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`,
      [owner.user_id, JSON.stringify({ sub: owner.user_id, role: "authenticated" })]);

    const before = seriesId ? await snapshot(c, seriesId) : null;
    if (before) console.log("ELŐTTE :", JSON.stringify(before));
    const issuesOf = async () => (await c.query(
      `select id, lapszam, cim, version, is_deleted from public.issues where series_id=$1 order by lapszam, cim`, [seriesId])).rows;
    const issuesBefore = seriesId ? await issuesOf() : [];
    const { rows: [{ maxlog }] } = await c.query(`select coalesce(max(id),0) as maxlog from public.change_log`);

    // A függvény pool_status='ready'-t vár. Ha a draft még "Munkaanyag", a próbához
    // a tranzakción belül ideiglenesen "ready"-re állítjuk (a ROLLBACK úgyis visszaállít).
    if (d.pool_status !== "ready") {
      await c.query(`update public.draft_series set pool_status='ready' where id=$1`, [draftId]);
      console.log(`(a próbához a tranzakción belül "ready"-re állítva — az állapot: ${d.pool_status}; ROLLBACK visszaállítja)`);
    }

    try {
      await c.query(`select public.publish_draft_series($1)`, [draftId]);
      // A halasztott constraint-ek commit-nál ellenőrződnének — itt kényszerítjük, hogy a
      // próba azt is lefedje, amit az éles commit lefedne.
      await c.query(`set constraints all immediate`);
      console.log("\n✔ A próba-publikálás HIBA NÉLKÜL lefutott (a halasztott ellenőrzések is).");
      if (seriesId) {
        const after = await snapshot(c, seriesId);
        console.log("UTÁNA  :", JSON.stringify(after));
        const { rows: ch } = await c.query(
          `select entity_type, field_name, count(*) n from public.change_log
            where version > 0 and id > (select coalesce(max(id),0) - $1 from public.change_log)
            group by 1,2 order by 3 desc`, [after.changeLog - before.changeLog]);
        console.log("Új change_log bejegyzések (mező szerint):", JSON.stringify(ch));

        // --- Számok verziója előtte → utána (csak az érintettek) ---
        const issuesAfter = await issuesOf();
        const prevById = new Map(issuesBefore.map(i => [i.id, i]));
        console.log("\nMeglévő Számok (a publikálás előtt is léteztek):");
        issuesAfter.filter(i => prevById.has(i.id)).forEach(i => {
          const p = prevById.get(i.id);
          console.log(`  „${i.cim}”: lapszám ${p.lapszam} → ${i.lapszam} | verzió ${p.version} → ${i.version}${i.version===p.version?"  (NEM emelkedett)":"  (emelkedett)"}`);
        });
        console.log(`Új Számok: ${issuesAfter.filter(i => !prevById.has(i.id)).length} db`);

        // --- az ÚJONNAN naplózott change_log sorok a meglévő Számokra ---
        const { rows: logs } = await c.query(
          `select cl.id, cl.entity_type, cl.field_name, cl.old_value, cl.new_value, cl.version, cl.is_current, i.cim, i.version as szam_verzio
             from public.change_log cl left join public.issues i on i.id = cl.entity_id and cl.entity_type='issue'
            where cl.id > $1 and cl.entity_id = any($2::uuid[]) order by cl.id`,
          [maxlog, issuesBefore.map(i => i.id)]);
        console.log("\nÚj change_log sorok a meglévő Számokra:");
        logs.forEach(l => console.log(`  #${l.id} ${l.entity_type}.${l.field_name}: „${l.old_value}” → „${l.new_value}” | naplózott verzió=${l.version} | a Szám verziója=${l.szam_verzio} | is_current=${l.is_current}`));
        if (!logs.length) console.log("  (nincs)");

        // --- ütközik-e a naplózás ugyanannál a verziónál valamilyen szabállyal? ---
        const { rows: cons } = await c.query(
          `select conname, contype, pg_get_constraintdef(oid) d from pg_constraint where conrelid='public.change_log'::regclass`);
        const { rows: idx } = await c.query(
          `select indexname, indexdef from pg_indexes where schemaname='public' and tablename='change_log'`);
        const { rows: trg } = await c.query(
          `select tgname from pg_trigger where tgrelid='public.change_log'::regclass and not tgisinternal`);
        console.log("\nchange_log szabályok — constraintek:", JSON.stringify(cons.map(x => `${x.conname} [${x.contype}] ${x.d}`)));
        console.log("change_log indexek:", JSON.stringify(idx.map(x => x.indexdef)));
        console.log("change_log triggerek:", JSON.stringify(trg.map(x => x.tgname)));
        const sameVer = logs.filter(l => l.version === l.szam_verzio && l.field_name === "lapszam");
        console.log(`Ugyanazon a verzión (a Szám verziója nem emelkedett) naplózott lapszám-sor: ${sameVer.length} db — a beszúrás HIBA NÉLKÜL lefutott, tehát egyik szabállyal sem ütközött.`);
      }
    } catch (e) {
      console.log("\n✘ A próba-publikálás HIBÁVAL állt le (éles publikálásnál is ez történne):");
      console.log("  ", e.message);
    }
  } finally {
    // MINDIG visszagörgetés. Ez a script soha nem commitol.
    try { await c.query("ROLLBACK"); } catch (_) {}
    if (!committed) {
      const { rows: [still] } = await c.query(`select pool_status from public.draft_series where id=$1`, [draftId]);
      console.log(`\nROLLBACK megtörtént — a draft megvan, állapota: ${still ? still.pool_status : "(nincs!)"}.`);
    }
    await c.end();
  }
})().catch(e => { console.error("Váratlan hiba:", e.message); process.exit(1); });
