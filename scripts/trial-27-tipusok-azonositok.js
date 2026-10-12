/* ============================================================
   27. lépés (típusleírás, sorozat-szintű azonosítók, adatrendezés) — VALIDÁCIÓS PRÓBA.

   FIGYELEM — ÉLŐ ADATBÁZISON FUT. CSAK a tulajdonos ELŐZETES, kifejezett
   jóváhagyásával futtatható (a 22. lépés mintája szerint előre jóváhagyva).
   EGYETLEN tranzakcióban dolgozik, a végén MINDIG ROLLBACK; SOHA nem commitol.
   Az S1 (szerkezet) és az S2 (adatrendezés) SQL a tranzakción BELÜL fut le (a DDL is
   visszagörgethető), így a ROLLBACK után semmi nem marad meg — a végén ezt
   számlálókkal és a függvények definíció-hash-ével igazolja, külön friss kapcsolaton is.
   SET LOCAL lock_timeout = 3s. A Lego Avengers függő draftot nem érinti. A próbához
   létrehozott szerkesztési és új draftok a tranzakcióval együtt eltűnnek.
   A publikálási próbák (P1–P5, a tulajdonos külön jóváhagyásával — 29. lépés) a
   publish_draft_series-t CSAK ebben a dobott (nem commitolt) tranzakcióban hívják, saját
   eldobható draftokon, mentési pontok között; élesben semmi nem publikálódik.
   (A change_log azonosító-sorozata előrelép: az nem görgethető vissza, a következő valódi
   bejegyzés azonosítójában hézag lesz — adat nem marad.)

   Az S2 előtt és után az ÖSSZES sorozatra összeveti a Számok színét, a haladásjelzőket
   (típusonként X/Y) és az Összeg-kártya értékeit — várt: nem változik semmi, kivéve a
   Disney Hangos „modell” haladásjelzőjének CÍMKÉJÉT („figura” lesz, az érték marad).

   Használat: node scripts/trial-27-tipusok-azonositok.js [--csak-s1]
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const ONLY_S1 = process.argv.includes("--csak-s1");
const S1 = "laprol-lapra-27-s1-szerkezet.sql", S2 = "laprol-lapra-27-s2-adatrendezes.sql";
const rd = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const url = f => "file:///" + path.join(__dirname, "..", "js", f).replace(/\\/g, "/");

const FN = ["publish_draft_series(uuid)", "start_edit_draft(uuid)", "apply_draft_upload(uuid,jsonb)", "mark_draft_ready(uuid)",
            "propose_bulk_issues(uuid,jsonb)", "draft_ready_warnings(uuid)", "seed_issue_seen_for_subscribers(uuid)", "seed_member_seen(uuid)",
            "log_field_change(text,uuid,text,text,text,integer)", "default_component_template(text[])"];

async function counts(c, label) {
  const q = async sql => (await c.query(sql)).rows[0];
  const r = { ...(await q(`select
      (select count(*) from public.series)::int series, (select count(*) from public.issues)::int issues,
      (select count(*) from public.components)::int components, (select count(*) from public.member_status)::int member_status,
      (select count(*) from public.member_issue_data)::int member_issue_data, (select count(*) from public.member_seen)::int member_seen,
      (select count(*) from public.draft_series)::int draft_series, (select count(*) from public.draft_issues)::int draft_issues,
      (select count(*) from public.draft_components)::int draft_components, (select count(*) from public.change_log)::int change_log_sorok,
      (select count(*) from public.lists)::int lists,
      (select coalesce(sum(version),0) from public.series)::int ver_series, (select coalesce(sum(version),0) from public.issues)::int ver_issues,
      (select coalesce(sum(version),0) from public.components)::int ver_components,
      (select count(*) from public.components where coalesce(btrim(azonosito),'')<>'')::int komponens_azonositoval,
      (select md5(string_agg(tipus || fields::text || coalesce(default_azonosito_tipus,''), '|' order by tipus)) from public.component_type_defs) tipusleiras_hash,
      (select count(*) from information_schema.columns where table_schema='public' and column_name='azonositok')::int azonositok_oszlop,
      (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')::int fuggvenyek`)) };
  for (const f of FN) r["hash_" + f.split("(")[0]] = (await q(`select md5(pg_get_functiondef('public.${f}'::regprocedure)) h`)).h.slice(0, 8);
  console.log(`\n${label}`);
  Object.entries(r).forEach(([k, v]) => console.log(`  ${k.padEnd(36)} ${v}`));
  return r;
}

const results = [];
const report = (name, ok, detail) => { results.push({ name, ok }); console.log(`  ${ok ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`); };
const uuid = () => crypto.randomUUID();
const J = x => JSON.stringify(x);
const AZ = (tipus, ertek) => ({ ertek, tipus });   // a jsonb kulcs-sorrendjében (az összevetéshez)

(async () => {
  // Az app saját számítása (szín, haladás, összeg) — ugyanaz a kód, mint a böngészőben.
  const { buildSeriesModel } = await import(url("model.js"));
  const st = await import(url("state.js"));
  const { computeTotals } = await import(url("totals.js"));
  const dataSrc = fs.readFileSync(path.join(__dirname, "..", "js", "data.js"), "utf8");
  const a = dataSrc.indexOf("export function stats(si){"), b = dataSrc.indexOf("\n}\n", a) + 3;
  const statsFor = state => new Function("state", "isFutureDate", "issueState", "compsOfType", "computeTotals",
    dataSrc.slice(a, b).replace("export function stats", "function stats") + "\nreturn stats;")(state, st.isFutureDate, st.issueState, st.compsOfType, computeTotals);

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

    const q = async (sql, p) => (await c.query(sql, p)).rows;
    let sp = 0;
    const expectErr = async fn => { const n = `sp${++sp}`; await c.query(`SAVEPOINT ${n}`);
      try { await fn(); await c.query(`ROLLBACK TO ${n}`); return null; } catch (e) { await c.query(`ROLLBACK TO ${n}`); return e; } };
    const seriesId = async name => (await q(`select id from public.series where megjelenites=$1`, [name]))[0].id;
    const T = (tipus, o = {}) => ({ tipus, main: false, required: true, id_rule: "nincs", default_azonosito_tipus: null, counts_for_color: true, default_megnevezes: null, ...o });
    const newDraft = async (comps, tmpl, name = "PRÓBA") => (await q(
      `insert into public.draft_series (pool_type, pool_status, submitted_by, claimed_by, claimed_at, kiado, megnevezes, megjelenites, szin, components, component_template)
       values ('new','claimed',$1,$1,now(),'egyeb',$2,$2,'#336699',$3,$4::jsonb) returning id`, [owner.user_id, name, comps, J(tmpl || [])]))[0].id;
    const upload = async (did, items, extra = {}) => (await q(`select public.apply_draft_upload($1,$2::jsonb) r`, [did, J({ items, delete_ids: [], ...extra })]))[0].r;
    const newItem = (n, comps = [], cim = "T" + n) => ({ id: null, new_id: uuid(), lapszam: n, cim, megjelenes: null, eredeti_ar: 100, comps });
    const warnings = async did => (await q(`select public.draft_ready_warnings($1) w`, [did]))[0].w;
    const snapshot = async () => {
      const series = await q(`select * from public.series order by sort_order, id`);   // stabil sorrend (a sort_order nem egyedi)
      const issues = await q(`select id, series_id, lapszam, cim, megjelenes::text as megjelenes, eredeti_ar, version, is_deleted from public.issues`);
      const comps = (await q(`select c.*, to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS') as created_at_txt from public.components c order by c.created_at, c.id`))
        .map(r => ({ ...r, created_at: r.created_at_txt }));
      const ms = await q(`select * from public.member_status where user_id=$1`, [owner.user_id]);
      const mi = await q(`select * from public.member_issue_data where user_id=$1`, [owner.user_id]);
      const myStatus = {}; ms.forEach(r => { myStatus[r.component_id] = { status: r.status, db: r.db == null ? 1 : r.db, jegyzet: r.jegyzet }; });
      const myIssue = {}; mi.forEach(r => { myIssue[r.issue_id] = { fizetett_ar: r.fizetett_ar, besz_menny: r.beszerzesi_mennyiseg == null ? 1 : r.beszerzesi_mennyiseg }; });
      const state = { SERIES: buildSeriesModel({ series, issues, comps, myStatus, myIssue, selectedIds: new Set(series.map(s => s.id)) }) };
      const stats = statsFor(state);
      return state.SERIES.map((s, si) => { const ss = stats(si); return {
        name: s.display,
        colors: s.items.filter(i => !i.deleted).map(i => `${i.n}:${st.issueState(i, s) || "-"}`).join(","),
        progress: Object.entries(ss.perType).map(([t, p]) => `${t}=${p.owned}/${p.total}`).join(" "),
        total: `E${ss.eredetiTotal}/${ss.eredetiCount}/${ss.eredetiUnknown} F${ss.fizetettTotal}/${ss.fizetettCount}/${ss.fizetettUnknown}`,
      }; });
    };

    const snap0 = await snapshot();                       // a változtatás előtti állapot (még a DDL előtt)
    await c.query(rd(S1));
    console.log("\nAz S1 (szerkezet) SQL lefutott a tranzakción belül.\n\n[S1] próbák:");

    // ---- 1. típusleírás
    const td = Object.fromEntries((await q(`select * from public.component_type_defs`)).map(r => [r.tipus, r]));
    report("T1 a típusleírás 7 típusa megkapta a szabályt (lego / kártya fix, magazin / könyv választható ISBN-ISSN, figura / modell nincs, egyéb szabad)",
      td.lego.azonosito_mod === "fix" && td.lego.azonosito_tipusok[0] === "lego_kd" && td.krtya.azonosito_mod === "fix" && td.krtya.azonosito_tipusok[0] === "kartya_kod"
      && td.magazin.azonosito_mod === "valaszthato" && td.konyv.azonosito_mod === "valaszthato" && td.konyv.default_azonosito_tipus === "isbn" && td.magazin.default_azonosito_tipus === null
      && td.magazin.csalad === "kiadvany" && td.konyv.csalad === "kiadvany" && td.figura.azonosito_mod === "nincs" && td.modell.azonosito_mod === "nincs" && td.egyeb.azonosito_mod === "szabad");
    const kf = td.krtya.fields.filter(f => !["kep", "db", "jegyzet"].includes(f.key));
    report("T2 a Kártya hét mezője a megadott sorrendben, kötelező: Gyűjtemény, Kód, Név",
      J(kf.map(f => f.label)) === J(["Gyártó", "Gyűjtemény", "Széria", "Kiadás éve", "Sorozatváltozat", "Kód", "Név"])
      && J(kf.filter(f => f.szint === "kotelezo").map(f => f.key)) === J(["gyujtemeny", "azonosito", "megnevezes"]), J(kf.map(f => f.key)));
    const e1 = await expectErr(() => q(`update public.component_type_defs set fields = fields || '[{"key":"ar","kind":"egesz","label":"Ár"}]'::jsonb where tipus='krtya'`));
    report("T3 ár továbbra sem lehet mező (CHECK)", !!e1 && /no_price/.test(e1.message), e1 ? e1.message.slice(0, 90) : "NEM dobott hibát");
    const e2 = await expectErr(() => q(`update public.component_type_defs set azonosito_tipusok = '{}' where tipus='lego'`));
    report("T4 fix típus azonosító-típus nélkül nem menthető (CHECK)", !!e2, e2 ? e2.message.slice(0, 90) : "NEM dobott hibát");
    const e3 = await expectErr(async () => { await c.query("SET LOCAL ROLE authenticated"); await q(`update public.component_type_defs set csalad = null where tipus='konyv'`); });
    await c.query("RESET ROLE");
    report("T5 az app szerepköre nem írhatja a típusleírást (jog megvonva)", !!e3 && /permission denied/.test(e3.message), e3 ? e3.message.slice(0, 90) : "NEM dobott hibát");
    report("T6 a „Kártyakód” azonosító-típus bekerült a Listákba",
      (await q(`select count(*)::int n from public.lists where tipus='azonosito' and ertek='kartya_kod' and megjelenites='Kártyakód'`))[0].n === 1);

    // ---- 2. sorozat-szintű azonosítók: ellenőrző függvény és megszorítás
    const azErr = async v => (await q(`select public.series_azonositok_error($1::jsonb) e`, [J(v)]))[0].e;
    const okCases = [[], [{ tipus: "issn", ertek: "3103-4152" }], [{ tipus: "isbn", ertek: "978-88-334-2749-2" }, { tipus: "issn", ertek: "2568-2474" }], [{ tipus: "isbn", ertek: "963123456X" }]];
    const badCases = [[{ tipus: "issn", ertek: "1" }, { tipus: "issn", ertek: "2" }, { tipus: "issn", ertek: "3" }], [{ tipus: "vonalkod", ertek: "123" }], [{ tipus: "issn", ertek: "" }],
      [{ tipus: "issn", ertek: "12345" }], [{ tipus: "isbn", ertek: "978-88-334" }], [{ tipus: "issn", ertek: "3103-4152" }, { tipus: "issn", ertek: "31034152" }], { tipus: "issn" }, [{ tipus: "issn", ertek: "3103-4152", x: 1 }]];
    const okR = [], badR = [];
    for (const v of okCases) okR.push(await azErr(v));
    for (const v of badCases) badR.push(await azErr(v));
    report("A1 a sorozat-azonosítók ellenőrzése: az érvényes listák átmennek, a hibásak (3 elem, más típus, üres, rossz ISSN / ISBN, kétszer ugyanaz, rossz forma) érthető hibát adnak",
      okR.every(x => x === null) && badR.every(x => typeof x === "string" && x.length > 5), badR.map(x => x && x.slice(0, 28)).join(" | "));
    const LM = await seriesId("Lego Marvel");
    const e4 = await expectErr(() => q(`update public.series set azonositok='[{"tipus":"issn","ertek":"rossz"}]' where id=$1`, [LM]));
    report("A2 a series tábla megszorítása elutasítja a hibás sorozat-azonosítót", !!e4 && /azonositok_check/.test(e4.message), e4 ? e4.message.slice(0, 90) : "NEM dobott hibát");
    report("A3 minden élő sorozat és draft sorozat-azonosítója üres lista az S1 után",
      (await q(`select (select count(*) from public.series where azonositok <> '[]')::int + (select count(*) from public.draft_series where azonositok <> '[]')::int n`))[0].n === 0);

    // ---- 3. start_edit_draft másolja; a Kész ellenőrzi
    await q(`update public.series set azonositok='[{"tipus":"issn","ertek":"3053-5611"}]' where id=$1`, [LM]);
    const dLM = (await q(`select public.start_edit_draft($1) id`, [LM]))[0].id;
    const dLMrow = (await q(`select azonositok from public.draft_series where id=$1`, [dLM]))[0];
    report("E1 a szerkesztési draft megkapja a sorozat azonosítóit (start_edit_draft)", J(dLMrow.azonositok) === J([AZ("issn", "3053-5611")]), J(dLMrow.azonositok));
    const wLM = await warnings(dLM);
    report("E2 a sorozatszámmal egyező komponens-azonosító nem duplikáció; a nem módosított meglévő komponensek nem blokkolnak",
      !wLM.some(w => w.kod === "azonosito_duplikalt"), J(wLM.map(w => w.kod)));
    await q(`select public.mark_draft_ready($1)`, [dLM]);
    report("E3 a változatlan szerkesztési draft „Kész”-re állítható (a meglévő adat nem akadály)",
      (await q(`select pool_status from public.draft_series where id=$1`, [dLM]))[0].pool_status === "ready");
    await q(`delete from public.draft_series where id=$1`, [dLM]);
    await q(`update public.series set azonositok='[]' where id=$1`, [LM]);

    // ---- 4. típus szerinti kötelező mezők: új komponens blokkol, meglévő csak figyelmeztet
    const D1 = await newDraft(["magazin", "krtya"], [T("magazin", { main: true }), T("krtya", { required: false })], "PRÓBA kártya");
    const i1 = newItem(1, [{ tipus: "krtya", azonosito: "LE01", megnevezes: "Próba Kártya", adatok: { gyujtemeny: "Próba gyűjtemény", kiadas_eve: 2025, szeria: null } }]);
    const i2 = newItem(2, [{ tipus: "krtya", megnevezes: "Név van, kód nincs" }]);
    const up = await upload(D1, [i1, i2], { sorozat_azonositok: [{ tipus: "issn", ertek: "1234-5678" }] });
    const k1 = (await q(`select azonosito_tipus, azonosito, megnevezes, adatok from public.draft_components where draft_issue_id=$1 and tipus='krtya'`, [i1.new_id]))[0];
    report("K1 feltöltés: a Kártya fix azonosító-típust kap, a típus mezői az adatok-ba kerülnek (üres érték nélkül)",
      k1.azonosito_tipus === "kartya_kod" && k1.azonosito === "LE01" && J(k1.adatok) === J({ gyujtemeny: "Próba gyűjtemény", kiadas_eve: 2025 }), J(k1));
    report("K2 feltöltés: a sorozat-azonosító a draftra kerül", up.sorozat_azonositok === 1
      && J((await q(`select azonositok from public.draft_series where id=$1`, [D1]))[0].azonositok) === J([AZ("issn", "1234-5678")]), J(up));
    const e5 = await expectErr(() => upload(D1, [], { sorozat_azonositok: [{ tipus: "issn", ertek: "nem jó" }] }));
    report("K3 feltöltés: hibás sorozat-azonosítóval érthető hiba, a draft nem változik", !!e5 && /sorozat-azonosítók érvénytelenek/.test(e5.message), e5 ? e5.message.slice(0, 100) : "NEM dobott hibát");
    const fi = await q(`select lapszam, tipus, kod, uzenet, blokkol from public.draft_type_field_issues($1) order by lapszam, uzenet`, [D1]);
    report("K4 az új kártya hiányzó kötelező mezői (Gyűjtemény, Kód) blokkoló hiányként jelennek meg, a kitöltött kártyán nincs hiány",
      fi.length === 2 && fi.every(f => f.lapszam === 2 && f.blokkol) && J(fi.map(f => f.uzenet)) === J(["hiányzik: Gyűjtemény", "hiányzik: Kód"]), J(fi.map(f => `#${f.lapszam} ${f.uzenet}`)));
    const e6 = await expectErr(() => q(`select public.mark_draft_ready($1)`, [D1]));
    report("K5 a „Kész” megáll az új kártya hiányzó kötelező mezőinél, érthető szöveggel", !!e6 && /hiányzik: Gyűjtemény/.test(e6.message) && /#2 /.test(e6.message), e6 ? e6.message.replace(/\n+/g, " ⏎ ").slice(0, 230) : "NEM dobott hibát");
    await q(`update public.draft_components set azonosito='LE02', adatok='{"gyujtemeny":"Próba"}' where draft_issue_id=$1 and tipus='krtya'`, [i2.new_id]);
    await q(`update public.draft_components set azonosito_tipus='egyeb' where draft_issue_id=$1 and tipus='krtya'`, [i1.new_id]);
    const e7 = await expectErr(() => q(`select public.mark_draft_ready($1)`, [D1]));
    report("K6 a „Kész” megáll, ha a kártya azonosító-típusa nem a fix típus", !!e7 && /csak Kártyakód lehet/.test(e7.message), e7 ? e7.message.replace(/\n+/g, " ⏎ ").slice(0, 200) : "NEM dobott hibát");
    await q(`update public.draft_components set azonosito_tipus='kartya_kod' where draft_issue_id=$1 and tipus='krtya'`, [i1.new_id]);
    await q(`select public.mark_draft_ready($1)`, [D1]);
    report("K7 kitöltve a draft „Kész”-re állítható", (await q(`select pool_status from public.draft_series where id=$1`, [D1]))[0].pool_status === "ready");

    const D2 = await newDraft(["konyv", "figura"], [T("konyv", { main: true }), T("figura")], "PRÓBA figura");
    const f1 = newItem(1); await upload(D2, [f1]);
    const e8 = await expectErr(() => q(`select public.mark_draft_ready($1)`, [D2]));
    report("F1 új figura név nélkül: a „Kész” megáll (a név kötelező)", !!e8 && /Figura — hiányzik: Név/.test(e8.message), e8 ? e8.message.replace(/\n+/g, " ⏎ ").slice(0, 200) : "NEM dobott hibát");
    const kv = (await q(`select azonosito_tipus from public.draft_components where draft_issue_id=$1 and tipus='konyv'`, [f1.new_id]))[0];
    report("F2 az új könyv alap azonosító-típusa ISBN (típusleírás), a figuráé nincs", kv.azonosito_tipus === "isbn"
      && (await q(`select azonosito_tipus from public.draft_components where draft_issue_id=$1 and tipus='figura'`, [f1.new_id]))[0].azonosito_tipus === null);
    await q(`update public.draft_components set azonosito='1234-5678', azonosito_tipus='vonalkod' where draft_issue_id=$1 and tipus='konyv'`, [f1.new_id]);
    await q(`update public.draft_components set megnevezes='Chase' where draft_issue_id=$1 and tipus='figura'`, [f1.new_id]);
    const e9 = await expectErr(() => q(`select public.mark_draft_ready($1)`, [D2]));
    report("F3 könyvön az azonosító-típus csak ISBN vagy ISSN lehet", !!e9 && /csak ISBN vagy ISSN lehet/.test(e9.message), e9 ? e9.message.replace(/\n+/g, " ⏎ ").slice(0, 200) : "NEM dobott hibát");
    await q(`update public.draft_components set azonosito_tipus='issn' where draft_issue_id=$1 and tipus='konyv'`, [f1.new_id]);
    await q(`select public.mark_draft_ready($1)`, [D2]);
    report("F4 ISSN-nel és névvel a draft „Kész”-re állítható", true);

    const MO = await seriesId("Mancs Őrjárat");
    const dMO = (await q(`select public.start_edit_draft($1) id`, [MO]))[0].id;
    const wMO = await warnings(dMO);
    const nNevNelkul = (await q(`select count(*)::int n from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1 and c.tipus='figura' and not c.is_deleted and not i.is_deleted and coalesce(btrim(c.megnevezes),'')=''`, [MO]))[0].n;
    const wm = wMO.find(w => w.kod === "tipus_mezo_meglevo");
    report("M1 meglévő, név nélküli figurák (Mancs Őrjárat): csak figyelmeztetés, a pontos darabszámmal", !!wm && wm.darab === nNevNelkul && nNevNelkul > 0, wm ? wm.szoveg : J(wMO));
    await q(`select public.mark_draft_ready($1)`, [dMO]);
    report("M2 a változatlan Mancs Őrjárat draft „Kész”-re állítható (a meglévő hiány nem blokkol)", true);
    await q(`select public.return_draft_to_edit($1)`, [dMO]);
    const egyFig = (await q(`select dc.id from public.draft_components dc join public.draft_issues di on di.id=dc.draft_issue_id where di.draft_series_id=$1 and dc.tipus='figura' and coalesce(btrim(dc.megnevezes),'')='' limit 1`, [dMO]))[0].id;
    await q(`update public.draft_components set adatok='{"megjegyzes":"módosítva"}' where id=$1`, [egyFig]);
    const e10 = await expectErr(() => q(`select public.mark_draft_ready($1)`, [dMO]));
    report("M3 ha egy név nélküli meglévő figura ebben a draftban MÓDOSUL, a „Kész” azon az egyen megáll", !!e10 && /1 új vagy módosított komponens/.test(e10.message), e10 ? e10.message.replace(/\n+/g, " ⏎ ").slice(0, 160) : "NEM dobott hibát");
    await q(`delete from public.draft_series where id=$1`, [dMO]);

    // ---- 5. duplikáció-figyelmeztetés az S1 és az S2 közötti állapotban + idő
    for (const [nev, label] of [["Lego Star Wars", "D1"], ["Volkswagen model", "D2"], ["Disney Hangos", "D3"], ["Disney", "D4"]]) {
      const sid = await seriesId(nev);
      const did = (await q(`select public.start_edit_draft($1) id`, [sid]))[0].id;
      const w = await warnings(did);
      report(`${label} ${nev}: az S1 és az S2 között sincs felesleges duplikáció-riasztás a sorozatszámra`, !w.some(x => x.kod === "azonosito_duplikalt"), J(w.map(x => `${x.kod}:${x.darab || (x.tetelek || []).length}`)));
      if (nev === "Lego Star Wars") {
        const two = await q(`select dc.id from public.draft_components dc join public.draft_issues di on di.id=dc.draft_issue_id where di.draft_series_id=$1 and dc.tipus='lego' order by di.lapszam limit 2`, [did]);
        await q(`update public.draft_components set azonosito='912345', azonosito_tipus='lego_kd' where id = any($1)`, [two.map(x => x.id)]);
        const w2 = await warnings(did);
        const dup = w2.find(x => x.kod === "azonosito_duplikalt");
        report("D5 a valódi duplikáció (két Lego ugyanazzal a kóddal) továbbra is figyelmeztetést ad", !!dup && dup.tetelek.length === 1 && dup.tetelek[0].azonosito === "912345", dup ? J(dup.tetelek) : J(w2.map(x => x.kod)));
      }
      await q(`delete from public.draft_series where id=$1`, [did]);
    }
    const FF = await seriesId("Fast & Furious");
    const dFF = (await q(`select public.start_edit_draft($1) id`, [FF]))[0].id;
    const t0 = process.hrtime.bigint();
    for (let k = 0; k < 5; k++) await warnings(dFF);
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 5;
    report("D6 a draft_ready_warnings ideje a 110 Számos sorozaton (5 futás átlaga, hálózati úttal együtt)", ms < 400, ms.toFixed(0) + " ms");
    const ex = (await q(`explain (analyze, format json) select public.draft_ready_warnings($1)`, [dFF]))[0]["QUERY PLAN"][0]["Execution Time"];
    report("D7 a draft_ready_warnings szerver-oldali futásideje (EXPLAIN ANALYZE)", ex < 150, ex.toFixed(1) + " ms (korábban ≈28 ms)");
    await q(`delete from public.draft_series where id=$1`, [dFF]);

    // ---- 6. új-sorozat javaslat útvonala (propose_bulk_issues): a típus szerinti azonosító-típus
    const D3 = (await q(`insert into public.draft_series (pool_type, pool_status, submitted_by, kiado, megnevezes, megjelenites, szin, components)
       values ('new','incoming',$1,'egyeb','PRÓBA javaslat','PRÓBA javaslat','#336699',$2) returning id, azonositok`, [owner.user_id, ["magazin", "lego"]]))[0];
    await q(`select public.propose_bulk_issues($1,$2::jsonb)`, [D3.id, J([{ lapszam: 1, cim: "J1", megjelenes: "", eredeti_ar: 100, comps: [{ tipus: "lego", azonosito: "912399", megnevezes: "X" }, { tipus: "magazin" }] }])]);
    const pj = await q(`select dc.tipus, dc.azonosito_tipus from public.draft_components dc join public.draft_issues di on di.id=dc.draft_issue_id where di.draft_series_id=$1 order by 1`, [D3.id]);
    report("J1 új-sorozat javaslat: a draft sorozat-azonosítója üres listával indul, a Lego fix azonosító-típust kap, a magazin nem kap alapértéket",
      J(D3.azonositok) === "[]" && J(pj) === J([{ tipus: "lego", azonosito_tipus: "lego_kd" }, { tipus: "magazin", azonosito_tipus: null }]), J(pj));
    await q(`delete from public.draft_series where id = any($1)`, [[D1, D2, D3.id]]);

    const snap1 = await snapshot();
    const dif1 = snap0.map((s, i) => J(s) === J(snap1[i]) ? null : s.name).filter(Boolean);
    report("V1 az S1 után a Számok színe, a haladásjelzők és az Összeg-kártya minden sorozatnál azonos", dif1.length === 0 && snap0.length === snap1.length, dif1.length ? "ELTÉR: " + dif1.join(", ") : `${snap0.length} sorozat`);

    // ============================== publikálási próbák (P1–P5) ==============================
    // A publish_draft_series új sorai (sorozat-azonosító). Mindegyik próba saját mentési pontban
    // fut, és oda görög vissza — az S2 próbák érintetlen állapotból indulnak; a végén minden ROLLBACK.
    console.log("\n[P] publikálási próbák (dobott tranzakcióban):");
    {
      const LMs = await seriesId("Lego Marvel");
      const meas = async sid => (await q(`select
          (select row_to_json(x) from (select azonositok, version, kiado from public.series where id=$1) x) s,
          (select coalesce(sum(version),0) from public.issues where series_id=$1)::int vi,
          (select coalesce(sum(c.version),0) from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1)::int vc,
          (select coalesce(sum(version),0) from public.issues)::int vi_all, (select coalesce(sum(version),0) from public.components)::int vc_all,
          (select count(*) from public.member_seen)::int seen,
          (select md5(string_agg(user_id::text || entity_type || entity_id::text || last_seen_version::text, ',' order by user_id, entity_type, entity_id)) from public.member_seen) seenh,
          (select coalesce(max(id),0) from public.change_log)::bigint cl`, [sid]))[0];
      const logSince = async id => q(`select entity_type, field_name, old_value, new_value, version from public.change_log where id > $1 order by id`, [id]);
      const inSp = async fn => { const n = `sp${++sp}`; await c.query(`SAVEPOINT ${n}`); try { await fn(); } finally { await c.query(`ROLLBACK TO ${n}`); } };
      const UJ = [AZ("issn", "3053-5611")];

      await inSp(async () => {   // P1: csak a sorozat-azonosító változik
        const m0 = await meas(LMs);
        const did = (await q(`select public.start_edit_draft($1) id`, [LMs]))[0].id;
        await q(`update public.draft_series set azonositok=$2::jsonb where id=$1`, [did, J(UJ)]);
        await q(`select public.mark_draft_ready($1)`, [did]);
        await q(`select public.publish_draft_series($1)`, [did]);
        await c.query("SET CONSTRAINTS ALL IMMEDIATE");
        const m1 = await meas(LMs), lg = await logSince(m0.cl);
        report("P1 szerkesztés, csak a sorozat-azonosító változik: az élő sorozat megkapja, a sorozat verziója nem változik (nincs felkiáltójel)",
          J(m1.s.azonositok) === J(UJ) && m1.s.version === m0.s.version, `azonositok=${J(m1.s.azonositok)}, verzió ${m0.s.version} → ${m1.s.version}`);
        report("P1b a change_log-ban pontosan egy új bejegyzés van: series / azonositok, a régi és az új értékkel, a változatlan verzióval",
          lg.length === 1 && lg[0].entity_type === "series" && lg[0].field_name === "azonositok" && J(JSON.parse(lg[0].old_value)) === "[]" && J(JSON.parse(lg[0].new_value)) === J(UJ) && lg[0].version === m0.s.version, J(lg));
        report("P1c a Számok és a komponensek verzióösszege és a member_seen sorai változatlanok",
          m1.vi === m0.vi && m1.vc === m0.vc && m1.vi_all === m0.vi_all && m1.vc_all === m0.vc_all && m1.seen === m0.seen && m1.seenh === m0.seenh, `member_seen ${m0.seen} → ${m1.seen}`);
        report("P1d a draft a publikálás után megszűnt", (await q(`select count(*)::int n from public.draft_series where id=$1`, [did]))[0].n === 0);
      });

      await inSp(async () => {   // P2: nincs változás
        const m0 = await meas(LMs);
        const did = (await q(`select public.start_edit_draft($1) id`, [LMs]))[0].id;
        await q(`select public.mark_draft_ready($1)`, [did]);
        await q(`select public.publish_draft_series($1)`, [did]);
        await c.query("SET CONSTRAINTS ALL IMMEDIATE");
        const m1 = await meas(LMs), lg = await logSince(m0.cl);
        report("P2 szerkesztés változtatás nélkül: nincs új change_log bejegyzés, a sorozat, a verziók és a member_seen változatlanok",
          lg.length === 0 && J(m1.s) === J(m0.s) && m1.vi_all === m0.vi_all && m1.vc_all === m0.vc_all && m1.seen === m0.seen && m1.seenh === m0.seenh, `új bejegyzés: ${lg.length}`);
      });

      await inSp(async () => {   // P3: a sorozat-azonosító ÉS a kiadó is változik
        const m0 = await meas(LMs);
        const masKiado = (await q(`select ertek from public.lists where tipus='kiado' and ertek is distinct from $1 order by sort_order limit 1`, [m0.s.kiado]))[0].ertek;
        const did = (await q(`select public.start_edit_draft($1) id`, [LMs]))[0].id;
        await q(`update public.draft_series set azonositok=$2::jsonb, kiado=$3 where id=$1`, [did, J(UJ), masKiado]);
        await q(`select public.mark_draft_ready($1)`, [did]);
        await q(`select public.publish_draft_series($1)`, [did]);
        await c.query("SET CONSTRAINTS ALL IMMEDIATE");
        const m1 = await meas(LMs), lg = await logSince(m0.cl);
        const la = lg.find(x => x.field_name === "azonositok"), lk = lg.find(x => x.field_name === "kiado");
        report("P3 a sorozat-azonosító és a kiadó együtt változik: a sorozat verziója eggyel nő (a kiadó miatt), és az azonositok bejegyzés ezzel az új verzióval kerül a naplóba",
          m1.s.version === m0.s.version + 1 && m1.s.kiado === masKiado && J(m1.s.azonositok) === J(UJ) && lg.length === 2 && !!la && !!lk && la.version === m1.s.version && lk.version === m1.s.version,
          `verzió ${m0.s.version} → ${m1.s.version}; napló: ${lg.map(x => `${x.field_name}@${x.version}`).join(", ")}`);
      });

      await inSp(async () => {   // P4: új sorozat
        const AZ4 = [AZ("isbn", "978-963-12-3456-7")];
        const D = await newDraft(["konyv"], [T("konyv", { main: true })], "PRÓBA új 27");   // a megjelenített név legfeljebb 16 karakter
        await q(`update public.draft_series set azonositok=$2::jsonb where id=$1`, [D, J(AZ4)]);
        await upload(D, [newItem(1)]);
        await q(`select public.mark_draft_ready($1)`, [D]);
        await q(`select public.publish_draft_series($1)`, [D]);
        await c.query("SET CONSTRAINTS ALL IMMEDIATE");
        const ns = (await q(`select id, azonositok, version from public.series where megnevezes='PRÓBA új 27'`))[0];
        const nk = await q(`select c.tipus from public.components c join public.issues i on i.id=c.issue_id where i.series_id=$1`, [ns.id]);
        report("P4 új sorozat publikálása: az élő sorozat azonositok értéke a drafté, a verzió 1, az 1 Szám 1 komponenssel létrejött",
          !!ns && J(ns.azonositok) === J(AZ4) && ns.version === 1 && nk.length === 1 && nk[0].tipus === "konyv", ns ? `azonositok=${J(ns.azonositok)}, verzió=${ns.version}` : "nincs sorozat");
      });

      const e13 = await expectErr(async () => {   // P5: hibás sorozat-azonosító
        const did = (await q(`select public.start_edit_draft($1) id`, [LMs]))[0].id;
        await q(`update public.draft_series set azonositok='[{"tipus":"issn","ertek":"rossz"}]' where id=$1`, [did]);
      });
      report("P5 hibás sorozat-azonosító már a draft mentésénél megáll (a tábla megszorítása), így a publikálásig el sem jut", !!e13 && /draft_series_azonositok_check/.test(e13.message), e13 ? e13.message.slice(0, 120) : "NEM dobott hibát");
    }

    // ============================== S2 — adatrendezés ==============================
    if (!ONLY_S1) {
      console.log("\n[S2] próbák:");
      const DI = await seriesId("Disney");
      const dDI = (await q(`select public.start_edit_draft($1) id`, [DI]))[0].id;
      const e11 = await expectErr(() => c.query(rd(S2)));
      report("R1 az S2 megáll, ha egy érintett sorozaton függő szerkesztési draft van — semmi nem változik", !!e11 && /függő szerkesztési munkaanyag/.test(e11.message), e11 ? e11.message.slice(0, 110) : "NEM dobott hibát");
      await q(`delete from public.draft_series where id=$1`, [dDI]);

      const pre = (await q(`select (select count(*) from public.change_log)::int cl, (select sum(version) from public.components)::int vc, (select sum(version) from public.series)::int vs,
        (select count(*) from public.member_status)::int ms, (select md5(string_agg(component_id::text || coalesce(status,'') || coalesce(db::text,''), ',' order by component_id, user_id)) from public.member_status) msh,
        (select count(*) from public.member_seen)::int seen`))[0];
      await c.query(rd(S2));
      const post = (await q(`select (select count(*) from public.change_log)::int cl, (select sum(version) from public.components)::int vc, (select sum(version) from public.series)::int vs,
        (select count(*) from public.member_status)::int ms, (select md5(string_agg(component_id::text || coalesce(status,'') || coalesce(db::text,''), ',' order by component_id, user_id)) from public.member_status) msh,
        (select count(*) from public.member_seen)::int seen`))[0];
      const sz = Object.fromEntries((await q(`select megjelenites, azonositok, components, component_template from public.series`)).map(r => [r.megjelenites, r]));
      report("R2 az öt sorozat megkapta a sorozatszámát", J(sz["Disney"].azonositok) === J([AZ("issn", "3103-4152")]) && J(sz["Volkswagen model"].azonositok) === J([AZ("isbn", "978-88-334-2749-2")])
        && J(sz["Disney Hangos"].azonositok) === J([AZ("isbn", "978-88-334-2840-6")]) && J(sz["Lego Star Wars"].azonositok) === J([AZ("issn", "2568-2474")])
        && J(sz["Lego Marvel"].azonositok) === J([AZ("issn", "3053-5611")]) && Object.values(sz).filter(r => r.azonositok.length).length === 5,
        Object.values(sz).filter(r => r.azonositok.length).map(r => `${r.megjelenites}: ${r.azonositok.map(a => a.tipus.toUpperCase() + " " + a.ertek).join(", ")}`).join(" | "));
      const rem = await q(`select s.megjelenites, c.tipus, c.azonosito, c.azonosito_tipus from public.components c join public.issues i on i.id=c.issue_id join public.series s on s.id=i.series_id
        where coalesce(btrim(c.azonosito),'')<>'' and c.tipus in ('magazin','konyv','krtya') order by 1,2`);
      report("R3 a 155 komponens azonosítója kiürült; a magazinokon / könyveken csak a Disney Hangos eltérő ISBN-je maradt, a kártyán a kód",
        before.komponens_azonositoval - (await q(`select count(*)::int n from public.components where coalesce(btrim(azonosito),'')<>''`))[0].n === 155
        && J(rem) === J([{ megjelenites: "Disney Hangos", tipus: "konyv", azonosito: "978-88-334-2839-0", azonosito_tipus: "isbn" }, { megjelenites: "Lego Star Wars", tipus: "krtya", azonosito: "LE19", azonosito_tipus: "kartya_kod" }]), J(rem));
      const dh = await q(`select c.tipus, count(*)::int n from public.components c join public.issues i on i.id=c.issue_id join public.series s on s.id=i.series_id where s.megjelenites='Disney Hangos' group by 1 order by 1`);
      report("R4 Disney Hangos: 82 figura (modell nincs), a komponens-lista és a sablon is átírva", J(dh) === J([{ tipus: "figura", n: 82 }, { tipus: "konyv", n: 82 }])
        && J(sz["Disney Hangos"].components) === J(["konyv", "figura"]) && J(sz["Disney Hangos"].component_template.map(x => x.tipus)) === J(["konyv", "figura"]), J(dh));
      report("R5 Listák: a kártya megjelenített neve „Kártya”, a kulcs maradt", (await q(`select megjelenites from public.lists where tipus='komponens' and ertek='krtya'`))[0].megjelenites === "Kártya");
      report("R6 CSENDES: egyetlen sorozat / komponens verziója sem változott (nincs felkiáltójel), a member_seen sorai változatlanok", pre.vc === post.vc && pre.vs === post.vs && pre.seen === post.seen);
      report("R7 a személyes adatok (member_status) sorai és tartalma változatlan", pre.ms === post.ms && pre.msh === post.msh);
      report("R8 a change_log rögzítette: 5 sorozatszám + 155 azonosító + 35 azonosító-típus + 82 típus + 2 (lista, sablon) + 1 kártya = 280 bejegyzés", post.cl - pre.cl === 280, String(post.cl - pre.cl));
      const snap2 = await snapshot();
      const relabel = s => s.name === "Disney Hangos" ? { ...s, progress: s.progress.replace("modell=", "figura=") } : s;
      const dif = snap1.map(relabel).map((s, i) => J(s) === J(snap2[i]) ? null : s.name).filter(Boolean);
      report("V2 az S2 után a Számok színe, a haladásjelzők értéke és az Összeg-kártya minden sorozatnál azonos (csak a Disney Hangos „modell” címkéje lett „figura”)",
        dif.length === 0 && snap2.find(s => s.name === "Disney Hangos").progress.includes("figura=") && !snap2.find(s => s.name === "Disney Hangos").progress.includes("modell="),
        dif.length ? "ELTÉR: " + dif.join(", ") : snap2.find(s => s.name === "Disney Hangos").progress);
      const dDH = (await q(`select public.start_edit_draft($1) id`, [await seriesId("Disney Hangos")]))[0].id;
      const wDH = await warnings(dDH);
      report("R9 az S2 után a Disney Hangos draftján: nincs duplikáció-riasztás; a 82 név nélküli figura csak figyelmeztetés", !wDH.some(w => w.kod === "azonosito_duplikalt")
        && (wDH.find(w => w.kod === "tipus_mezo_meglevo") || {}).darab === 82, J(wDH.map(w => `${w.kod}:${w.darab || ""}`)));
      await q(`select public.mark_draft_ready($1)`, [dDH]);
      report("R10 az S2 utáni változatlan draft „Kész”-re állítható", true);
      const e12 = await expectErr(() => c.query(rd(S2)));
      report("R11 az S2 másodszor nem fut le (a feltételek már nem állnak) — nincs dupla alkalmazás", !!e12, e12 ? e12.message.slice(0, 110) : "NEM dobott hibát");
    }
  } catch (e) {
    console.log("\nHIBA a próba közben:", e.message);
    report("a próba végigfutott", false, e.message);
  } finally {
    try { await c.query("ROLLBACK"); } catch (_) {}
    console.log("\n── ROLLBACK megtörtént ──");
    await c.end();
    const c2 = new Client({ connectionString: DATABASE_URL });
    await c2.connect();
    const fresh = await counts(c2, "UTÁNA (külön, friss kapcsolaton):");
    await c2.end();
    const diff = Object.keys(before || {}).filter(k => String(before[k]) !== String(fresh[k]));
    console.log(diff.length ? `\n✘ ELTÉRÉS a számlálókban/hash-ekben: ${diff.map(k => `${k}: ${before[k]} → ${fresh[k]}`).join("; ")}`
      : "\n✔ IGAZOLÁS: az ELŐTTE és az UTÁNA számlálók és függvény-hash-ek azonosak — semmi nem maradt meg.");
    const bad = results.filter(r => !r.ok);
    console.log(`\nPróbák: ${results.length - bad.length}/${results.length} sikeres` + (bad.length ? ` — NEM sikerült: ${bad.map(r => r.name.split(" ")[0]).join(", ")}` : ""));
  }
})().catch(e => { console.error("Váratlan hiba:", e.message); process.exit(1); });
