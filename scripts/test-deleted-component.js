/* ============================================================
   Törölt komponens — visszaellenőrző teszteset a compare-before-after.js mellé
   (CSAK OLVASÓ SELECT-ek, BEGIN READ ONLY; a "törlés" a MEMÓRIÁBAN történik,
   tesztadaton — az éles adatot nem módosítja).

   Az ÖSSZES sorozatra, a megadott felhasználó (alapból a tulajdonos) adatán:
     1) a változatlan adatokon a modell azonos a "nincs törölt komponens" állapottal;
     2) sorozatonként egy (nem fő) komponens memóriabeli törölt-jelölése után:
          a) a komponens SEHOL nincs a modellben (sorok, panel, gombok, számlálók…);
          b) minden MÁS sorozat Számainak színe, haladásjelzői és összege azonos;
          c) az érintett sorozatban a változás csak a várt: a komponens-darabszám
             pontosan eggyel kevesebb, a többi Szám színe/összege azonos, kivéve ahol
             a törölt volt a Szám egyetlen színt/összeget meghatározó eleme.

   Használat: node scripts/test-deleted-component.js [user_id]
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");
const url = f => "file:///" + path.join(__dirname, "..", "js", f).replace(/\\/g, "/");

(async () => {
  const { buildSeriesModel } = await import(url("model.js"));
  const st = await import(url("state.js"));
  const { computeTotals } = await import(url("totals.js"));
  const dataSrc = fs.readFileSync(path.join(__dirname, "..", "js", "data.js"), "utf8");
  const a = dataSrc.indexOf("export function stats(si){"), b = dataSrc.indexOf("\n}\n", a) + 3;
  const statsFor = state => new Function("state", "isFutureDate", "issueState", "compsOfType", "computeTotals",
    dataSrc.slice(a, b).replace("export function stats", "function stats") + "\nreturn stats;")(state, st.isFutureDate, st.issueState, st.compsOfType, computeTotals);

  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  await c.query("BEGIN READ ONLY");
  const owner = process.argv[2] || (await c.query(`select user_id from public.members where role='owner' limit 1`)).rows[0].user_id;
  const series = (await c.query(`select * from public.series order by sort_order`)).rows;
  const issues = (await c.query(`select id, series_id, lapszam, cim, megjelenes::text as megjelenes, eredeti_ar, version, is_deleted from public.issues`)).rows;
  const comps = (await c.query(`select c.*, to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS') as created_at_txt from public.components c order by c.created_at, c.id`)).rows
    .map(r => ({ ...r, created_at: r.created_at_txt }));
  const ms = (await c.query(`select * from public.member_status where user_id=$1`, [owner])).rows;
  const mi = (await c.query(`select * from public.member_issue_data where user_id=$1`, [owner])).rows;
  await c.query("ROLLBACK"); await c.end();

  const myStatus = {}; ms.forEach(r => { myStatus[r.component_id] = { status: r.status, db: r.db == null ? 1 : r.db, jegyzet: r.jegyzet }; });
  const myIssue = {}; mi.forEach(r => { myIssue[r.issue_id] = { fizetett_ar: r.fizetett_ar, besz_menny: r.beszerzesi_mennyiseg == null ? 1 : r.beszerzesi_mennyiseg }; });
  const selectedIds = new Set(series.map(s => s.id));
  const model = rows => buildSeriesModel({ series, issues, comps: rows, myStatus, myIssue, selectedIds });
  const snap = rows => {
    const state = { SERIES: model(rows) };
    const stats = statsFor(state);
    return state.SERIES.map((s, si) => {
      const ss = stats(si);
      return {
        id: s.id, name: s.display, ncomp: s.items.reduce((n, i) => n + Object.values(i.comps).flat().length, 0),
        ids: new Set(s.items.flatMap(i => Object.values(i.comps).flat().map(x => x.id))),
        colors: s.items.filter(i => !i.deleted).map(i => `${i.n}:${st.issueState(i, s) || "-"}`),
        progress: Object.entries(ss.perType).map(([t, p]) => `${t}=${p.owned}/${p.total}`).join(" "),
        total: `E${ss.eredetiTotal} F${ss.fizetettTotal}`,
      };
    });
  };

  let fails = 0;
  const check = (name, ok, detail) => { if(!ok) fails++; console.log(`  ${ok ? "✔" : "✘"} ${name}${detail ? " — " + detail : ""}`); };

  const base = snap(comps);
  check("1) a változatlan adatokon (nincs törölt komponens) a modell azonos önmagával / a komponens-darabszám a táblával",
    base.reduce((n, s) => n + s.ncomp, 0) === comps.filter(x => issues.find(i => i.id === x.issue_id && series.find(s => s.id === i.series_id))).length,
    `${base.reduce((n, s) => n + s.ncomp, 0)} komponens a modellben`);

  console.log("\n2) sorozatonként egy memóriabeli törölt-jelölés:");
  for (const s of series) {
    const sIssues = new Set(issues.filter(i => i.series_id === s.id && !i.is_deleted).map(i => i.id));
    const cand = comps.filter(x => sIssues.has(x.issue_id) && !x.is_main);
    if (!cand.length) { console.log(`  – ${s.megjelenites}: nincs nem fő komponens, kihagyva`); continue; }
    const victim = cand.find(x => myStatus[x.id] && myStatus[x.id].status === "megvan") || cand[0];
    const after = snap(comps.map(x => x.id === victim.id ? { ...x, is_deleted: true } : x));
    const iss = issues.find(i => i.id === victim.issue_id);
    const mine = after.find(x => x.id === s.id), was = base.find(x => x.id === s.id);
    const others = after.filter(x => x.id !== s.id).every(x => { const b0 = base.find(y => y.id === x.id); return JSON.stringify([x.colors, x.progress, x.total, [...x.ids]]) === JSON.stringify([b0.colors, b0.progress, b0.total, [...b0.ids]]); });
    const colorDiff = mine.colors.filter((v, i) => v !== was.colors[i]);
    check(`${s.megjelenites}: #${iss.lapszam} ${victim.tipus} (${(myStatus[victim.id] || {}).status || "jelöletlen"}) törlése`,
      !mine.ids.has(victim.id) && mine.ncomp === was.ncomp - 1 && others,
      `komponens ${was.ncomp}→${mine.ncomp}; más sorozatok azonosak: ${others ? "igen" : "NEM"}; haladás ${was.progress === mine.progress ? "azonos" : was.progress + " → " + mine.progress}; összeg ${was.total === mine.total ? "azonos" : was.total + " → " + mine.total}; színváltozás: ${colorDiff.length ? colorDiff.join(",") : "nincs"}`);
  }
  console.log(fails ? `\n✘ ${fails} hiba.` : "\n✔ A törölt komponens minden vizsgált helyről eltűnik, a többi adat változatlan.");
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error("Hiba:", e.message); process.exit(1); });
