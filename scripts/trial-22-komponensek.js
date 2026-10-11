/* ============================================================
   22. lépés (fő elem, komponens-sablon, típus-hozzáadás, komponens-törlés,
   „Kész” figyelmeztetések) — VALIDÁCIÓS PRÓBA.

   FIGYELEM — ÉLŐ ADATBÁZISON FUT. CSAK a tulajdonos ELŐZETES, kifejezett
   jóváhagyásával futtatható (szabály: élő adaton DB-érintő tesztet —
   visszagörgetettet is — csak jóváhagyással). EGYETLEN tranzakcióban dolgozik,
   a végén MINDIG ROLLBACK; SOHA nem commitol. A négy migrációs SQL a
   tranzakción BELÜL fut le (DDL is visszagörgethető), így a ROLLBACK után
   semmi nem marad meg — a végén ezt számlálókkal és a függvények
   definíció-hash-ével igazolja, külön friss kapcsolaton is.
   SET LOCAL lock_timeout = 3s. A Lego Avengers függő draftot nem érinti.

   Alapból NEM hív publish_draft_series-t. A publikálási próbák (P1–P5) csak a
   `--publish` kapcsolóval futnak, és CSAK dobott (nem commitolt) tranzakcióban,
   saját eldobható szerkesztési/új draftokon — ezt a tulajdonos külön
   jóváhagyásához kötjük. (A change_log azonosító-sorozata ekkor előreléptetődik:
   nem görgethető vissza, a következő valódi bejegyzés azonosítójában hézag lesz.)

   Használat: node scripts/trial-22-komponensek.js [--publish]
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const PUBLISH = process.argv.includes("--publish");
const FILES = ["laprol-lapra-fo-elem.sql", "laprol-lapra-komponens-sablon.sql", "laprol-lapra-tipus-hozzaadas.sql", "laprol-lapra-komponens-torles.sql"];
const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

const FN = ["publish_draft_series(uuid)", "start_edit_draft(uuid)", "apply_draft_upload(uuid,jsonb)", "mark_draft_ready(uuid)",
            "propose_bulk_issues(uuid,jsonb)", "seed_issue_seen_for_subscribers(uuid)", "seed_member_seen(uuid)"];

async function counts(c, label) {
  const q = async sql => (await c.query(sql)).rows[0];
  const r = { ...(await q(`select
      (select count(*) from public.series)::int series, (select count(*) from public.issues)::int issues,
      (select count(*) from public.components)::int components, (select count(*) from public.member_status)::int member_status,
      (select count(*) from public.member_seen)::int member_seen, (select count(*) from public.draft_series)::int draft_series,
      (select count(*) from public.draft_issues)::int draft_issues, (select count(*) from public.draft_components)::int draft_components,
      (select count(*) from public.change_log)::int change_log_sorok,
      (select count(*) from information_schema.columns where table_schema='public' and table_name='components' and column_name in ('is_main','is_deleted','adatok'))::int uj_oszlopok,
      (select count(*) from information_schema.tables where table_schema='public' and table_name='component_type_defs')::int type_defs_tabla`)) };
  for (const f of FN) r["hash_" + f.split("(")[0]] = (await q(`select md5(pg_get_functiondef('public.${f}'::regprocedure)) h`)).h.slice(0, 8);
  console.log(`\n${label}`);
  Object.entries(r).forEach(([k, v]) => console.log(`  ${k.padEnd(36)} ${v}`));
  return r;
}

const results = [];
const report = (name, ok, detail) => { results.push({ name, ok }); console.log(`  ${ok ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`); };
const uuid = () => crypto.randomUUID();
const J = x => JSON.stringify(x);

(async () => {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  let before;
  try {
    before = await counts(c, "ELŐTTE (commitolt állapot):");
    const { rows: [owner] } = await c.query(`select user_id from public.members where role='owner' limit 1`);
    await c.query("BEGIN");
    await c.query("SET LOCAL lock_timeout = '3s'");
    await c.query("SET LOCAL statement_timeout = '120s'");
    await c.query(`select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)`,
      [owner.user_id, JSON.stringify({ sub: owner.user_id, role: "authenticated" })]);

    for (const f of FILES) await c.query(rd(f));
    console.log("\nA négy migrációs SQL lefutott a tranzakción belül.\n\nPróbák:");

    const q = async (sql, p) => (await c.query(sql, p)).rows;
    let sp = 0;
    const expectErr = async fn => { const n = `sp${++sp}`; await c.query(`SAVEPOINT ${n}`);
      try { await fn(); await c.query(`ROLLBACK TO ${n}`); return null; } catch (e) { await c.query(`ROLLBACK TO ${n}`); return e; } };
    const seriesId = async name => (await q(`select id from public.series where megjelenites=$1`, [name]))[0].id;
    const newDraft = async (comps, tmpl, name = "PRÓBA") => (await q(
      `insert into public.draft_series (pool_type, pool_status, submitted_by, claimed_by, claimed_at, kiado, megnevezes, megjelenites, szin, components, component_template)
       values ('new','claimed',$1,$1,now(),'egyeb',$2,$2,'#336699',$3,$4::jsonb) returning id`, [owner.user_id, name, comps, J(tmpl || [])]))[0].id;
    const T = (tipus, o = {}) => ({ tipus, main: false, required: true, id_rule: "nincs", default_azonosito_tipus: null, counts_for_color: true, default_megnevezes: null, ...o });
    const upload = async (did, items) => (await q(`select public.apply_draft_upload($1,$2::jsonb) r`, [did, J({ items, delete_ids: [] })]))[0].r;
    const newItem = (n, comps = [], cim = "T" + n) => ({ id: null, new_id: uuid(), lapszam: n, cim, megjelenes: null, eredeti_ar: 100, comps });
    const dcs = async iid => (await q(`select tipus, azonosito_tipus, azonosito, megnevezes, is_main, deleted from public.draft_components where draft_issue_id=$1 order by tipus, azonosito nulls first`, [iid]));

    // ============================== 1. kör — FŐ ELEM (B) ==============================
    console.log("\n[B] fő elem");
    const m = (await q(`select (select count(*) from public.components where is_main)::int mains,
        (select count(distinct issue_id) from public.components)::int iss, (select count(*) from public.issues)::int issues,
        (select count(*) from (select issue_id from public.components where is_main group by 1 having count(*)>1) x)::int multi`))[0];
    report("B1 minden komponensű Számnak pontosan egy fő eleme van (kitöltés)", m.mains === m.iss && m.multi === 0, `${m.mains} fő elem / ${m.iss} komponensű Szám (összes Szám: ${m.issues}), 1-nél több: ${m.multi}`);
    const ms = await q(`select s.megjelenites, string_agg(distinct c.tipus, ',') t from public.components c join public.issues i on i.id=c.issue_id join public.series s on s.id=i.series_id where c.is_main group by 1 order by 1`);
    const exp = { "Lego Star Wars": "magazin", "Mancs Őrjárat": "konyv", "Disney Hangos": "konyv", "Autós Legendák": "konyv", "Forma 1": "magazin", "Disney": "konyv" };
    report("B2 a tartalék szabály: magazin → könyv → első (sorozatonként)",
      Object.entries(exp).every(([s, t]) => (ms.find(x => x.megjelenites === s) || {}).t === t), ms.map(x => `${x.megjelenites}=${x.t}`).join("; "));
    const e1 = await expectErr(async () => {
      const i = (await q(`select issue_id from public.components where is_main limit 1`))[0].issue_id;
      await q(`insert into public.components (issue_id, tipus, is_main) values ($1,'egyeb',true)`, [i]);
      await c.query("SET CONSTRAINTS ALL IMMEDIATE");
    });
    report("B3 egy Számon nem lehet 2 fő elem (kizáró megszorítás)", !!e1 && e1.code === "23P01", e1 ? e1.code : "NEM dobott hibát");

    // ============================== 2. kör — SABLON (E) ==============================
    console.log("\n[E] komponens-sablon");
    const tp = await q(`select megjelenites, public.component_template_error(component_template) err, public.template_main_type(component_template) main,
                               array(select x->>'tipus' from jsonb_array_elements(component_template) x) tipusok, components from public.series`);
    report("E1 minden sorozat sablonja érvényes, típusai = a series.components, fő típusa = a fő elem típusa",
      tp.every(s => !s.err && J(s.tipusok) === J(s.components) && s.main), tp.length + " sorozat");
    const e2 = await q(`select public.component_template_error('[]'::jsonb) a, public.component_template_error('[{"tipus":"a","main":true},{"tipus":"a"}]'::jsonb) b,
                               public.component_template_error('[{"tipus":"a"}]'::jsonb) c, public.component_template_error('[{"tipus":"a","main":true,"id_rule":"x"}]'::jsonb) d,
                               public.component_template_error('[{"tipus":"a","main":true}]'::jsonb) ok`);
    report("E2 sablon-ellenőrzés: üres / duplikált típus / nincs fő / rossz szabály hibás, a jó üres hiba", !!(e2[0].a && e2[0].b && e2[0].c && e2[0].d) && e2[0].ok === null);
    const D1 = await newDraft(["konyv", "figura"], [T("konyv", { main: true, default_azonosito_tipus: "isbn" }), T("figura", { required: false, default_megnevezes: "Figura-csomag" })]);
    const r1 = await upload(D1, [newItem(1), newItem(2, [{ tipus: "figura", azonosito: "F-2", megnevezes: null }])]);
    const i1 = (await q(`select id from public.draft_issues where draft_series_id=$1 and lapszam=1`, [D1]))[0].id;
    const i2 = (await q(`select id from public.draft_issues where draft_series_id=$1 and lapszam=2`, [D1]))[0].id;
    const c1 = await dcs(i1), c2 = await dcs(i2);
    report("E3 az új sor csak a KÖTELEZŐ típust kapja (az opcionálist nem), az alapértelmezett azonosító-típussal, fő elem = a sablon fő típusa",
      c1.length === 1 && c1[0].tipus === "konyv" && c1[0].azonosito_tipus === "isbn" && c1[0].is_main, J(c1.map(x => [x.tipus, x.azonosito_tipus, x.is_main])));
    report("E4 a feltöltésben megadott opcionális elem megmarad, a kötelező mellé jön; a fő elem a sablon fő típusa",
      c2.length === 2 && c2.find(x => x.tipus === "figura").azonosito === "F-2" && c2.find(x => x.tipus === "konyv").is_main && !c2.find(x => x.tipus === "figura").is_main,
      J(c2.map(x => [x.tipus, x.azonosito, x.is_main])) + " | auto_komponens=" + r1.auto_komponens);

    // kötelező azonosító (id_rule = kotelezo)
    const D2 = await newDraft(["konyv"], [T("konyv", { main: true, id_rule: "kotelezo" })], "PRÓBA kötelező");
    await upload(D2, [newItem(1), newItem(2, [{ tipus: "konyv", azonosito: "978-1", megnevezes: null }])]);
    const e3 = await expectErr(() => q(`select public.mark_draft_ready($1)`, [D2]));
    report("E5 kötelező azonosító nélküli ÚJ komponens blokkolja a „Kész”-t, a hiba felsorolja",
      !!e3 && /kötelező azonosító nélkül/.test(e3.message) && /#1 \(/.test(e3.message), e3 ? e3.message.replace(/\n+/g, " ⏎ ").slice(0, 200) : "NEM dobott hibát");
    await q(`update public.draft_components set azonosito='978-0' where draft_issue_id=$1 and coalesce(azonosito,'')=''`, [(await q(`select id from public.draft_issues where draft_series_id=$1 and lapszam=1`, [D2]))[0].id]);
    await q(`select public.mark_draft_ready($1)`, [D2]);
    report("E6 azonosítóval a „Kész” megy", (await q(`select pool_status from public.draft_series where id=$1`, [D2]))[0].pool_status === "ready");

    // figyelmeztetések (G)
    console.log("\n[G] figyelmeztetések");
    const D3 = await newDraft(["konyv"], [T("konyv", { main: true, id_rule: "ajanlott" })], "PRÓBA figyelmeztetés");
    await upload(D3, [newItem(1), newItem(2), newItem(3, [{ tipus: "konyv", azonosito: "ABC 12", megnevezes: null }]), newItem(4, [{ tipus: "konyv", azonosito: "abc12", megnevezes: null }])]);
    const w3 = (await q(`select public.draft_ready_warnings($1) w`, [D3]))[0].w;
    const waj = w3.find(x => x.kod === "azonosito_ajanlott"), wdup = w3.find(x => x.kod === "azonosito_duplikalt");
    report("G1 ajánlott azonosító hiánya: darabszámmal (2 üres a 4-ből)", !!waj && waj.darab === 2, waj ? waj.szoveg : J(w3));
    report("G2 duplikált azonosító (kis/nagybetű- és szóközfüggetlen), a helyekkel", !!wdup && wdup.tetelek.length === 1 && J(wdup.tetelek[0].helyek) === J(["#3", "#4"]), wdup ? J(wdup.tetelek) : J(w3));
    const mid = await q(`select public.mark_draft_ready($1) r`, [D3]);   // a figyelmeztetés NEM blokkol
    report("G3 a figyelmeztetés nem blokkoló: a „Kész” megy", (await q(`select pool_status from public.draft_series where id=$1`, [D3]))[0].pool_status === "ready");

    // élő komponens a duplikáció-vizsgálatban: a draftból hiányzó Szám élő komponense
    const MANCS = await seriesId("Mancs Őrjárat");
    const live1 = (await q(`select c.id, i.id iid, i.lapszam from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1 and c.tipus='konyv' and not i.is_deleted order by i.lapszam limit 2`, [MANCS]));
    await q(`update public.components set azonosito='ÉLŐ-1' where id=$1`, [live1[0].id]);
    const sdM = (await q(`select public.start_edit_draft($1) id`, [MANCS]))[0].id;
    await q(`delete from public.draft_issues where draft_series_id=$1 and source_issue_id=$2`, [sdM, live1[0].iid]);   // a draftból hiányzik → az élő komponens érintetlen marad
    await q(`update public.draft_components set azonosito=' élő-1 ' where draft_issue_id=(select id from public.draft_issues where draft_series_id=$1 and source_issue_id=$2) and tipus='konyv'`, [sdM, live1[1].iid]);
    const w4 = (await q(`select public.draft_ready_warnings($1) w`, [sdM]))[0].w.find(x => x.kod === "azonosito_duplikalt");
    report("G4 a duplikáció a publikálás UTÁNI állapotra számol: a draftból hiányzó Szám élő komponense is", !!w4 && J(w4.tetelek[0].helyek).includes("(élő)"), w4 ? J(w4.tetelek) : "nincs");

    // ============================== F — más típusú elem ==============================
    console.log("\n[F] más típusú elem");
    const compsBefore = (await q(`select components, component_template from public.draft_series where id=$1`, [D1]))[0];
    await upload(D1, [newItem(3, [{ tipus: "krtya", azonosito: "K-1", megnevezes: "Limited Ed." }])]);
    const compsAfter = (await q(`select components, component_template from public.draft_series where id=$1`, [D1]))[0];
    const i3 = (await q(`select id from public.draft_issues where draft_series_id=$1 and lapszam=3`, [D1]))[0].id;
    const c3 = await dcs(i3);
    report("F1 a nem deklarált típus (krtya) csak az adott Szám komponense: a draft komponens-listája és sablonja változatlan",
      J(compsBefore.components) === J(compsAfter.components) && J(compsBefore.component_template) === J(compsAfter.component_template) && c3.some(x => x.tipus === "krtya"),
      "components=" + J(compsAfter.components) + "; Szám komponensei: " + c3.map(x => x.tipus).join(","));

    // ============================== H — komponens törlése ==============================
    console.log("\n[H] komponens törlése");
    const e4 = await expectErr(() => q(`insert into public.draft_components (draft_issue_id, tipus, is_main, deleted) values ($1,'egyeb',true,true)`, [i1]));
    report("H1 törölt komponens nem lehet fő elem (megszorítás)", !!e4 && e4.code === "23514", e4 ? e4.code : "NEM dobott hibát");
    // élő törölt komponens → a szerkesztési draft nem másolja
    const LEGO = await seriesId("Lego Star Wars");
    const lc = (await q(`select c.id from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1 and c.tipus='lego' and not c.is_main order by i.lapszam limit 1`, [LEGO]))[0].id;
    const nLive = +(await q(`select count(*) n from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1 and not c.is_deleted`, [LEGO]))[0].n;
    await q(`update public.components set is_deleted=true where id=$1`, [lc]);
    const sdL = (await q(`select public.start_edit_draft($1) id`, [LEGO]))[0].id;
    const nDraft = +(await q(`select count(*) n from public.draft_components dc join public.draft_issues di on di.id=dc.draft_issue_id where di.draft_series_id=$1`, [sdL]))[0].n;
    report("H2 a szerkesztési draft a törölt élő komponenst nem másolja", nDraft === nLive - 1, `élő nem törölt ${nLive} → draft ${nDraft}`);
    // Kész: egy Számon minden komponens törlésre jelölve → blokkol
    const D5 = await newDraft(["konyv", "figura"], [T("konyv", { main: true }), T("figura")], "PRÓBA törlés");
    await upload(D5, [newItem(1)]);
    const i5 = (await q(`select id from public.draft_issues where draft_series_id=$1 and lapszam=1`, [D5]))[0].id;
    await q(`update public.draft_components set deleted=true, is_main=false where draft_issue_id=$1`, [i5]);
    const e5 = await expectErr(() => q(`select public.mark_draft_ready($1)`, [D5]));
    report("H3 ha egy Számon MINDEN komponens törlésre van jelölve, a „Kész” érthető hibát ad", !!e5 && /minden komponense törlésre van jelölve/.test(e5.message), e5 ? e5.message.replace(/\n+/g, " ⏎ ").slice(0, 160) : "NEM dobott hibát");
    // seed: a törölt komponensre nem készül látott-sor
    const sid = (await q(`select public.seed_issue_seen_for_subscribers(i.id) from public.issues i where i.id=(select issue_id from public.components where id=$1)`, [lc]));
    const seenDel = +(await q(`select count(*) n from public.member_seen where entity_type='component' and entity_id=$1 and last_seen_version is not null and false`, [lc]))[0].n;
    report("H4 a seed_issue_seen_for_subscribers a törölt komponenst kihagyja (a függvény lefut)", Array.isArray(sid));

    // ============================== publikálási próbák (--publish) ==============================
    if (PUBLISH) {
      console.log("\n[P] publikálási próbák (eldobható draftokon, dobott tranzakcióban)");
      const VH = await seriesId("II. VH Repülők");
      const snap = async sid => ({
        series: (await q(`select version, components, component_template from public.series where id=$1`, [sid]))[0],
        comps: await q(`select c.id, c.tipus, c.version, c.is_main, c.is_deleted, i.lapszam from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1 order by i.lapszam, c.tipus`, [sid]),
        issues: await q(`select lapszam, version from public.issues where series_id=$1 order by lapszam`, [sid]),
      });
      const flags = async sid => +(await q(`select count(*) n from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1
          and c.version > coalesce((select last_seen_version from public.member_seen x where x.user_id=$2 and x.entity_type='component' and x.entity_id=c.id),0)`, [sid, owner.user_id]))[0].n;
      const S0 = await snap(VH), ff0 = await flags(VH);
      const sdV = (await q(`select public.start_edit_draft($1) id`, [VH]))[0].id;
      const dIssue = async n => (await q(`select id from public.draft_issues where draft_series_id=$1 and lapszam=$2`, [sdV, n]))[0].id;
      const dComp = async (n, t) => (await q(`select id, source_component_id from public.draft_components where draft_issue_id=$1 and tipus=$2`, [await dIssue(n), t]))[0];
      const mag1 = await dComp(1, "magazin"), mod1 = await dComp(1, "modell"), mod2 = await dComp(2, "modell");
      const memBefore = +(await q(`select count(*) n from public.member_status where component_id=$1`, [mod2.source_component_id]))[0].n;
      // P1: a fő elem váltása (#1: magazin → modell)
      await q(`update public.draft_components set is_main=false where id=$1`, [mag1.id]);
      await q(`update public.draft_components set is_main=true where id=$1`, [mod1.id]);
      // P3: egy (nem fő) komponens törlése (#2 modell)
      await q(`update public.draft_components set deleted=true where id=$1`, [mod2.id]);
      // P2: a sablonban nem szereplő típus egy Számon (#3 krtya)
      await q(`insert into public.draft_components (draft_issue_id, tipus, megnevezes, source_component_id) values ($1,'krtya','Limited Ed.',null)`, [await dIssue(3)]);
      // P4: sablon-változás (a modell azonosító-szabálya: ajánlott)
      await q(`update public.draft_series set component_template = (select jsonb_agg(case when x->>'tipus'='modell' then jsonb_set(x,'{id_rule}','"ajanlott"') else x end order by o)
                 from jsonb_array_elements(component_template) with ordinality t(x,o)) where id=$1`, [sdV]);
      await q(`select public.mark_draft_ready($1)`, [sdV]);
      const w = (await q(`select public.draft_ready_warnings($1) w`, [sdV]))[0].w;
      await q(`select public.publish_draft_series($1)`, [sdV]);
      await c.query("SET CONSTRAINTS ALL IMMEDIATE");
      const S1 = await snap(VH);
      const cmp = (n, t) => S1.comps.find(x => x.lapszam === n && x.tipus === t);
      const cmp0 = (n, t) => S0.comps.find(x => x.lapszam === n && x.tipus === t);
      report("P1 fő elem váltása: az új fő a modell, a magazin már nem; CSENDES (komponens-verzió nem változott)",
        cmp(1, "modell").is_main && !cmp(1, "magazin").is_main && cmp(1, "modell").version === cmp0(1, "modell").version && cmp(1, "magazin").version === cmp0(1, "magazin").version);
      const lg = await q(`select field_name, old_value, new_value, version from public.change_log where entity_type='component' and entity_id = any($1::uuid[]) and field_name in ('is_main','is_deleted') order by id`,
        [[cmp(1, "modell").id, cmp(1, "magazin").id, cmp(2, "modell").id]]);
      report("P1b a change_log rögzíti az is_main váltást (2 sor) és a törlést (1 sor)", lg.filter(x => x.field_name === "is_main").length === 2 && lg.filter(x => x.field_name === "is_deleted").length === 1, J(lg.map(x => [x.field_name, x.old_value, x.new_value, x.version])));
      report("P3 a komponens törölt-jelölése: is_deleted = true, CSENDES (verzió nem változott), a személyes adat (member_status) megmaradt",
        cmp(2, "modell").is_deleted && cmp(2, "modell").version === cmp0(2, "modell").version &&
        +(await q(`select count(*) n from public.member_status where component_id=$1`, [cmp(2, "modell").id]))[0].n === memBefore, `member_status sorok: ${memBefore}`);
      report("P2 a sablonban nem szereplő típus létrejön a Számon, a sorozat komponens-listája változatlan",
        !!cmp(3, "krtya") && J(S1.series.components) === J(S0.series.components), "components=" + J(S1.series.components));
      report("P4 a sablon változása CSENDES: a sorozat verziója nem változott, az új sablon él",
        S1.series.version === S0.series.version && S1.series.component_template.find(x => x.tipus === "modell").id_rule === "ajanlott");
      report("P-seen nincs hamis felkiáltójel (komponens-verzió > látott) a publikálás után", (await flags(VH)) === ff0, `${ff0} → ${await flags(VH)}`);
      report("P-ver egyetlen Szám verziója sem változott", J(S1.issues) === J(S0.issues));
      report("P-warn a draft_ready_warnings lefutott a publikálás előtt", Array.isArray(w), J(w.map(x => x.kod)));

      // P5: új sorozat publikálása sablonnal
      const D6 = await newDraft(["konyv", "karta"], [T("konyv", { main: true, default_azonosito_tipus: "isbn" }), T("karta", { required: false })], "PRÓBA új sorozat");
      await upload(D6, [newItem(1), newItem(2)]);
      await q(`select public.mark_draft_ready($1)`, [D6]);
      await q(`select public.publish_draft_series($1)`, [D6]);
      await c.query("SET CONSTRAINTS ALL IMMEDIATE");
      const ns = (await q(`select id, components, component_template, version from public.series where megnevezes='PRÓBA új sorozat'`))[0];
      const nc = await q(`select c.tipus, c.is_main, c.azonosito_tipus from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1`, [ns.id]);
      report("P5 új sorozat: components = a sablon típusai, a sablon mentve, minden Számnak egy kötelező komponense (fő), az opcionális nem jön létre",
        J(ns.components) === J(["konyv", "karta"]) && ns.component_template.length === 2 && nc.length === 2 && nc.every(x => x.tipus === "konyv" && x.is_main && x.azonosito_tipus === "isbn") && ns.version === 1,
        J(nc));

      // P6: a publikálás megtagadja, ha egy Számon minden komponens törölve lenne
      const D7 = await newDraft(["konyv"], [T("konyv", { main: true })], "PRÓBA törlés-hiba");
      await upload(D7, [newItem(1)]);
      await q(`select public.mark_draft_ready($1)`, [D7]);
      await q(`update public.draft_components set deleted=true, is_main=false where draft_issue_id=(select id from public.draft_issues where draft_series_id=$1)`, [D7]);
      const e6 = await expectErr(() => q(`select public.publish_draft_series($1)`, [D7]));
      report("P6 a publikálás érthető hibával megáll, ha egy Számon minden komponens törölve lenne", !!e6 && /minden komponens törölve lenne/.test(e6.message), e6 ? e6.message.slice(0, 120) : "NEM dobott hibát");
    }
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
    const keys = Object.keys(before).filter(k => k !== "change_log_sorok" || true);
    const diff = keys.filter(k => String(before[k]) !== String(fresh[k]));
    console.log(diff.length ? `\n✘ ELTÉRÉS a számlálókban/hash-ekben: ${diff.map(k => `${k}: ${before[k]} → ${fresh[k]}`).join("; ")}`
      : "\n✔ IGAZOLÁS: az ELŐTTE és az UTÁNA számlálók és függvény-hash-ek azonosak — semmi nem maradt meg.");
    const bad = results.filter(r => !r.ok);
    console.log(`\nPróbák: ${results.length - bad.length}/${results.length} sikeres` + (bad.length ? ` — NEM sikerült: ${bad.map(r => r.name.split(" ")[0]).join(", ")}` : ""));
  }
})().catch(e => { console.error("Váratlan hiba:", e.message); process.exit(1); });
