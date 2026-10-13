/* ============================================================
   33. lépés / (B) — create_live_issue — VALIDÁCIÓS PRÓBA a TESZT sorozaton.

   FIGYELEM — ÉLŐ ADATBÁZISON FUT. CSAK a tulajdonos ELŐZETES, kifejezett jóváhagyásával
   futtatható (a 34. lépésben jóváhagyva). EGYETLEN tranzakcióban dolgozik, a végén MINDIG ROLLBACK;
   SOHA nem commitol. A migráció (laprol-lapra-33-uj-szam-fuggveny.sql) a tranzakción BELÜL
   fut le, így a ROLLBACK után semmi nem marad meg — a végén ezt számlálókkal és a függvények
   hash-ével igazolja, külön friss kapcsolaton is. SET LOCAL lock_timeout = 3s.
   Csak a „TESZT” megjelenített nevű sorozatra ír (a tranzakción belül); más sorozathoz, a
   Lego Avengers munkaanyaghoz nem nyúl; nem publikál.

   Használat: node scripts/trial-33-uj-szam.js
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const SQL = fs.readFileSync(path.join(__dirname, "..", "laprol-lapra-33-uj-szam-fuggveny.sql"), "utf8");
const J = x => JSON.stringify(x);
const results = [];
const report = (name, ok, detail) => { results.push({ name, ok }); console.log(`  ${ok ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`); };

async function counts(c, label) {
  const r = (await c.query(`select
      (select count(*) from public.series)::int series, (select count(*) from public.issues)::int issues,
      (select count(*) from public.components)::int components, (select count(*) from public.member_status)::int member_status,
      (select count(*) from public.member_issue_data)::int member_issue_data, (select count(*) from public.member_seen)::int member_seen,
      (select count(*) from public.draft_series)::int draft_series, (select count(*) from public.change_log)::int change_log,
      (select coalesce(sum(version),0) from public.issues)::int ver_issues, (select coalesce(sum(version),0) from public.components)::int ver_components,
      (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public')::int fuggvenyek,
      (select md5(string_agg(p.proname || md5(pg_get_functiondef(p.oid)), ',' order by p.proname, p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f') fuggveny_hash`)).rows[0];
  console.log(`\n${label}`); Object.entries(r).forEach(([k, v]) => console.log(`  ${k.padEnd(22)} ${v}`));
  return r;
}

(async () => {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  let before;
  try {
    before = await counts(c, "ELŐTTE (commitolt állapot):");
    const owner = (await c.query(`select user_id from public.members where role='owner' limit 1`)).rows[0].user_id;
    const asUser = uid => c.query(`select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claims',$2,true)`, [uid, J({ sub: uid, role: "authenticated" })]);
    await c.query("BEGIN");
    await c.query("SET LOCAL lock_timeout = '3s'");
    await c.query("SET LOCAL statement_timeout = '60s'");
    await asUser(owner);
    await c.query(SQL);
    console.log("\nA migráció lefutott a tranzakción belül.\n\nPróbák:");

    const q = async (sql, p) => (await c.query(sql, p)).rows;
    let sp = 0;
    const expectErr = async fn => { const n = `sp${++sp}`; await c.query(`SAVEPOINT ${n}`);
      try { await fn(); await c.query(`ROLLBACK TO ${n}`); return null; } catch (e) { await c.query(`ROLLBACK TO ${n}`); return e; } };
    // 39. lépés: a TESZT sorozatot a tulajdonos törölte. Ha nincs meg, a próba a tranzakción BELÜL hoz létre
    // egy ugyanolyan próbasorozatot (mind a hét típus kötelező, fő elem a Magazin) — a ROLLBACK ezt is eltünteti.
    let T = (await q(`select id from public.series where megjelenites='TESZT'`))[0];
    if (!T) {
      const tt = ["magazin", "konyv", "lego", "krtya", "figura", "modell", "egyeb"];
      T = (await q(`insert into public.series (megnevezes, megjelenites, kiado, szin, components, component_template, lifecycle)
                    values ('TESZT szerkesztő-próba', 'TESZT', 'egyeb', '#336699', $1, $2::jsonb, 'active') returning id`,
        [tt, J(tt.map(t => ({ tipus: t, main: t === "magazin", required: true, id_rule: "nincs", default_azonosito_tipus: null, counts_for_color: true, default_megnevezes: null })))]))[0];
      console.log("(A TESZT sorozat nincs meg — a próba a tranzakción belül létrehozott próbasorozaton fut.)\n");
    }
    // 39. lépés: további, még nem éles SQL alkalmazása a tranzakción belül, a próbák ELŐTT (--with <fájl>).
    const wi = process.argv.indexOf("--with");
    if (wi > 0) { await c.query(fs.readFileSync(path.resolve(process.argv[wi + 1]), "utf8")); console.log(`(A tranzakción belül lefutott még: ${path.basename(process.argv[wi + 1])})\n`); }
    const call = (issue, personal = null, sid = T.id) => q(`select public.create_live_issue($1,$2::jsonb,$3::jsonb) r`, [sid, J(issue), personal == null ? null : J(personal)]).then(r => r[0].r);
    const full = (o = {}) => [{ tipus: "magazin", is_main: true }, { tipus: "konyv" }, { tipus: "lego", azonosito: "912399" },
      { tipus: "krtya", azonosito: "K77", megnevezes: "Próba", adatok: { gyujtemeny: "Gy", kiadas_eve: "2025", ismeretlen: "x" } },
      { tipus: "figura", megnevezes: "Figura neve" }, { tipus: "modell" }, { tipus: "egyeb" }].map(x => ({ ...x, ...(o[x.tipus] || {}) }));
    const otherBefore = (await q(`select count(*)::int n, coalesce(sum(i.version),0)::int v from public.issues i where i.series_id <> $1`, [T.id]))[0];

    // U1: a 32. lépésben a régi űrlappal felvitt hibás adatok — itt egyszerre, érthetően megáll
    const e1 = await expectErr(() => call({ lapszam: 61, cim: "Hibás", comps: full({ magazin: { azonosito: "9999-0000", is_main: true }, krtya: { azonosito: "K05", azonosito_tipus: "egyeb", megnevezes: "Régi úton", adatok: {} }, figura: { azonosito: "F05", azonosito_tipus: "vonalkod", megnevezes: null } }) }));
    report("U1 hibás új Szám (Kártya gyűjtemény nélkül és „Egyéb” típussal, Magazin azonosító típus nélkül, Figura név nélkül és azonosítóval): megáll, mind az öt hibát egyszerre felsorolja",
      !!e1 && /hiányzik: Gyűjtemény/.test(e1.message) && /az azonosító típusa csak Kártyakód lehet/.test(e1.message) && /Magazin: az azonosító típusa csak ISBN vagy ISSN lehet/.test(e1.message)
        && /Figura: hiányzik: Név/.test(e1.message) && /Figura: ennél a típusnál nincs külön azonosító/.test(e1.message) && (e1.message.match(/^• /gm) || []).length === 5,
      e1 ? e1.message.replace(/\n+/g, " ⏎ ") : "NEM dobott hibát");
    report("U1b a megállás után semmi nem maradt (nincs #61 Szám)", (await q(`select count(*)::int n from public.issues where series_id=$1 and lapszam=61`, [T.id]))[0].n === 0);

    // U2: helyes új Szám
    const seen0 = (await q(`select count(*)::int n from public.member_seen`))[0].n;
    const r2 = await call({ lapszam: 62, cim: "Helyes", megjelenes: "2026-01-15", eredeti_ar: 1990, comps: full({ magazin: { azonosito: "2222-4444", azonosito_tipus: "issn", is_main: true, status: "megvan", db: 2, jegyzet: "próba" } }) }, { fizetett_ar: 1500, beszerzesi_mennyiseg: 1 });
    await c.query("SET CONSTRAINTS ALL IMMEDIATE");
    const k2 = await q(`select tipus, azonosito_tipus, azonosito, megnevezes, adatok, is_main, version from public.components where issue_id=$1 order by created_at, tipus`, [r2.issue_id]);
    const by = Object.fromEntries(k2.map(x => [x.tipus, x]));
    report("U2 helyes új Szám: létrejött 7 elemmel, pontosan egy fő elem (a Magazin)", k2.length === 7 && k2.filter(x => x.is_main).length === 1 && by.magazin.is_main && r2.component_ids.length === 7, `fő: ${k2.filter(x => x.is_main).map(x => x.tipus)}`);
    report("U2b azonosító-típus a típus szerint: Lego és Kártya rögzített, Könyv alapértéke ISBN, Figura / Modell nincs", by.lego.azonosito_tipus === "lego_kd" && by.krtya.azonosito_tipus === "kartya_kod" && by.konyv.azonosito_tipus === "isbn" && by.figura.azonosito_tipus === null && by.modell.azonosito_tipus === null && by.magazin.azonosito_tipus === "issn");
    report("U2c a Kártya saját mezői az adatok-ba kerültek (az ismeretlen kulcs kimaradt, a Kiadás éve szám)", J(by.krtya.adatok) === J({ gyujtemeny: "Gy", kiadas_eve: 2025 }), J(by.krtya.adatok));
    const ms = await q(`select status, db, jegyzet from public.member_status where component_id = any($1::uuid[])`, [r2.component_ids]);
    const mi = await q(`select fizetett_ar, beszerzesi_mennyiseg, ar_auto from public.member_issue_data where issue_id=$1`, [r2.issue_id]);
    report("U2d a létrehozó személyes sorai: csak ahol megadta (1 státusz-sor, 1 beszerzési sor)", ms.length === 1 && ms[0].status === "megvan" && ms[0].db === 2 && mi.length === 1 && mi[0].fizetett_ar === 1500 && mi[0].ar_auto === false, J({ ms, mi }));
    const subs = (await q(`select count(*)::int n from public.member_series where series_id=$1 and is_selected`, [T.id]))[0].n;
    report("U2e a feliratkozók „látott” sorai létrejöttek (feliratkozónként 1 Szám + 7 elem)", (await q(`select count(*)::int n from public.member_seen`))[0].n - seen0 === subs * 8, `feliratkozó: ${subs}`);
    report("U2f nincs naplóbejegyzés és nincs verzióemelés (új Szám, 1-es verzió)", (await q(`select count(*)::int n from public.change_log`))[0].n === before.change_log && k2.every(x => x.version === 1));

    // U3–U6: további megállások
    const e3 = await expectErr(() => call({ lapszam: 62, cim: "Ismét", comps: full() }));
    report("U3 már létező lapszám: megáll", !!e3 && /#62 lapszám már szerepel/.test(e3.message), e3 ? e3.message.slice(0, 90) : "NEM dobott hibát");
    const e4 = await expectErr(() => call({ lapszam: 63, comps: full().filter(x => x.tipus !== "lego") }));
    report("U4 hiányzik a sablon kötelező típusa (Lego): megáll", !!e4 && /hiányzik a sorozat kötelező eleme: Lego/.test(e4.message), e4 ? e4.message.replace(/\n+/g, " ⏎ ").slice(0, 160) : "NEM dobott hibát");
    const e5 = await expectErr(() => call({ lapszam: 63, comps: full({ konyv: { is_main: true } }) }));
    report("U5 két fő elem: megáll", !!e5 && /pontosan egy fő elem/.test(e5.message), e5 ? e5.message.replace(/\n+/g, " ⏎ ").slice(0, 160) : "NEM dobott hibát");
    const r6 = await call({ lapszam: 64, comps: full().map(x => ({ ...x, is_main: false })) });
    await c.query("SET CONSTRAINTS ALL IMMEDIATE");
    report("U6 fő elem megadása nélkül a szokásos szabály jelöl (Magazin)", (await q(`select tipus from public.components where id=$1`, [r6.main_component_id]))[0].tipus === "magazin");
    const e7 = await expectErr(async () => { await asUser("00000000-0000-4000-8000-000000000000"); await call({ lapszam: 65, comps: full() }); });
    await asUser(owner);
    report("U7 nem staff felhasználó: megáll", !!e7 && /Nincs jogosultságod/.test(e7.message), e7 ? e7.message.slice(0, 60) : "NEM dobott hibát");
    const e8 = await expectErr(async () => { await c.query("SET LOCAL ROLE anon"); await call({ lapszam: 65, comps: full() }); });
    await c.query("RESET ROLE");
    report("U8 bejelentkezés nélküli hívó nem futtathatja a függvényt", !!e8 && /permission denied/.test(e8.message), e8 ? e8.message.slice(0, 70) : "NEM dobott hibát");

    // U10: jogosultság (\df+ megfelelője)
    const pr = (await q(`select p.prosecdef, p.proconfig::text as cfg, pg_get_userbyid(p.proowner) as tulajdonos,
        has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as authenticated,
        (select count(*)::int from aclexplode(p.proacl) a where a.grantee = 0) as public_jog, p.proacl::text as acl
      from pg_proc p where p.oid = 'public.create_live_issue(uuid,jsonb,jsonb)'::regprocedure`))[0];
    report("U10 jogosultság: SECURITY DEFINER, rögzített search_path, a PUBLIC és az anon nem hívhatja, az authenticated igen",
      pr.prosecdef === true && /search_path=public/.test(pr.cfg || "") && pr.anon === false && pr.authenticated === true && pr.public_jog === 0,
      `secdef=${pr.prosecdef} cfg=${pr.cfg} anon=${pr.anon} authenticated=${pr.authenticated} PUBLIC-jogok=${pr.public_jog} acl=${pr.acl}`);

    // U11: lapszám-ütközés a sorozat nyitott szerkesztési munkaanyagának ÚJ Számával
    const dEdit = (await q(`select public.start_edit_draft($1) id`, [T.id]))[0].id;
    await q(`insert into public.draft_issues (draft_series_id, lapszam, cim) values ($1, 70, 'Munkaanyagbeli új Szám')`, [dEdit]);
    const e11 = await expectErr(() => call({ lapszam: 70, comps: full() }));
    report("U11 a lapszám foglalt a sorozat nyitott szerkesztési munkaanyagában: megáll, és megnevezi a munkaanyagot",
      !!e11 && /#70 lapszámmal már van egy új, még nem publikált Szám \(„Munkaanyagbeli új Szám”\)/.test(e11.message) && /„Szerkesztés: TESZT szerkesztő-próba” \(állapota: Munkaanyag/.test(e11.message),
      e11 ? e11.message.replace(/\n+/g, " ⏎ ").slice(0, 300) : "NEM dobott hibát");
    await q(`delete from public.draft_series where id=$1`, [dEdit]);

    // U12: törölt (is_deleted) élő Szám lapszáma újra felvehető
    await q(`update public.issues set is_deleted = true where id=$1`, [r6.issue_id]);
    const r12 = await call({ lapszam: 64, cim: "A törölt helyén", comps: full() });
    await c.query("SET CONSTRAINTS ALL IMMEDIATE");
    report("U12 törölt élő Számmal azonos lapszám: az új Szám felvehető (a törölt sora megmarad)",
      !!r12.issue_id && (await q(`select count(*)::int n from public.issues where series_id=$1 and lapszam=64`, [T.id]))[0].n === 2);

    // U13: SZABÁLY-AZONOSSÁG — ugyanazokra a bemenetekre a create_live_issue és a munkaanyagok
    // „Kész” ellenőrzése (draft_type_field_issues) ugyanazt a hibalistát adja.
    const tmplT = (await q(`select component_template t from public.series where id=$1`, [T.id]))[0].t;
    const dCmp = (await q(`insert into public.draft_series (pool_type, pool_status, submitted_by, claimed_by, claimed_at, kiado, megnevezes, megjelenites, szin, components, component_template)
       values ('new','claimed',$1,$1,now(),'egyeb','PRÓBA azonosság','PRÓBA azonosság','#336699',$2,$3::jsonb) returning id`, [owner, tmplT.map(x => x.tipus), J(tmplT)]))[0].id;
    const cases = [
      ["Kártya gyűjtemény nélkül", { krtya: { adatok: {} } }],
      ["Kártya „Egyéb” azonosító-típussal", { krtya: { azonosito_tipus: "egyeb" } }],
      ["Kártya kód és név nélkül", { krtya: { azonosito: null, megnevezes: null } }],
      ["Magazin azonosító típus nélkül", { magazin: { azonosito: "1111-2222" } }],
      ["Magazin azonosító vonalkód típussal", { magazin: { azonosito: "1111-2222", azonosito_tipus: "vonalkod" } }],
      ["Magazin azonosító ISSN típussal (helyes)", { magazin: { azonosito: "1111-2222", azonosito_tipus: "issn" } }],
      ["Könyv azonosító típus nélkül (alap: ISBN, helyes)", { konyv: { azonosito: "978-963-12-0000-1" } }],
      ["Könyv azonosító Lego Kód típussal", { konyv: { azonosito: "978-963-12-0000-1", azonosito_tipus: "lego_kd" } }],
      ["Figura név nélkül", { figura: { megnevezes: null } }],
      ["Figura azonosítóval", { figura: { azonosito: "F1", azonosito_tipus: "vonalkod" } }],
      ["Modell azonosítóval", { modell: { azonosito: "M1" } }],
      ["Lego kód ISBN típussal", { lego: { azonosito_tipus: "isbn" } }],
      ["Egyéb bármilyen típussal (helyes)", { egyeb: { azonosito: "X1", azonosito_tipus: "vonalkod" } }],
      ["minden helyes", {}],
      ["több hiba egyszerre", { krtya: { adatok: {}, azonosito_tipus: "egyeb" }, figura: { megnevezes: null, azonosito: "F1" }, magazin: { azonosito: "1" } }],
    ];
    const clean = o => full(o).map(x => x.tipus === "krtya" ? { ...x, adatok: (o.krtya && o.krtya.adatok) || { gyujtemeny: "Gy" } } : x).map(x => ({ ...x, is_main: x.tipus === "magazin" }));
    const diffs = []; let lsz = 100;
    for (const [nev, o] of cases) {
      const comps = clean(o); lsz++;
      // (1) az élő út
      let live = [];
      const sp1 = `spc${lsz}`; await c.query(`SAVEPOINT ${sp1}`);
      try { await call({ lapszam: lsz, comps }); } catch (e) { live = (e.message.match(/^• .*$/gm) || []).map(x => x.slice(2)); }
      await c.query(`ROLLBACK TO ${sp1}`);
      // (2) a munkaanyag-út: ugyanazok az elemek egy új draft-Számon (az azonosító-típus alapértéke ugyanúgy, mint a feltöltésnél)
      const di = (await q(`insert into public.draft_issues (draft_series_id, lapszam, cim) values ($1,$2,'x') returning id`, [dCmp, lsz]))[0].id;
      for (const k of comps) await q(`insert into public.draft_components (draft_issue_id, tipus, azonosito_tipus, azonosito, megnevezes, adatok, is_main)
        values ($1,$2,coalesce($3, public.type_azonosito_tipus($2,$7::jsonb)),$4,$5,$6::jsonb,$8)`, [di, k.tipus, k.azonosito_tipus || null, k.azonosito || null, k.megnevezes || null, J(k.adatok || {}), J(tmplT), !!k.is_main]);
      const draft = (await q(`select f.tipus_nev || ': ' || f.uzenet as m from public.draft_type_field_issues($1) f where f.blokkol and f.lapszam=$2`, [dCmp, lsz])).map(x => x.m);
      const a = live.slice().sort(), b = draft.slice().sort();
      console.log(`      · ${nev}: ${a.length ? a.join(" | ") : "nincs hiba"}`);
      if (J(a) !== J(b)) diffs.push(`${nev}: élő út [${a.join(" | ")}] ≠ munkaanyag-út [${b.join(" | ")}]`);
    }
    report(`U13 szabály-azonosság: ${cases.length} bemenetre a create_live_issue és a draft_type_field_issues hibalistája szó szerint egyezik`, diffs.length === 0, diffs.join(" ;; "));
    await q(`delete from public.draft_series where id=$1`, [dCmp]);

    const otherAfter = (await q(`select count(*)::int n, coalesce(sum(i.version),0)::int v from public.issues i where i.series_id <> $1`, [T.id]))[0];
    report("U9 a többi sorozat Számai érintetlenek", J(otherBefore) === J(otherAfter), J(otherAfter));
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
    console.log(diff.length ? `\n✘ ELTÉRÉS: ${diff.map(k => `${k}: ${before[k]} → ${fresh[k]}`).join("; ")}` : "\n✔ IGAZOLÁS: az ELŐTTE és az UTÁNA számlálók és a függvény-hash azonos — semmi nem maradt meg.");
    const bad = results.filter(r => !r.ok);
    console.log(`\nPróbák: ${results.length - bad.length}/${results.length} sikeres` + (bad.length ? ` — NEM sikerült: ${bad.map(r => r.name.split(" ")[0]).join(", ")}` : ""));
  }
})().catch(e => { console.error("Váratlan hiba:", e.message); process.exit(1); });
