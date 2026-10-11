/* ============================================================
   Visszaellenőrzés két kódállapot között (CSAK OLVASÓ SELECT-ek, BEGIN READ ONLY):
   az ÖSSZES sorozatra, a megadott felhasználó (alapból a tulajdonos) adatán
     (a) a Számok színe (issueState),
     (b) a haladásjelzők (típusonként X/Y),
     (c) az Összeg-kártya értékei (eredeti / fizetett, darabszám, "nem ismert").
   A két állapotot git-ref-ek adják: a stats() és a state.js/totals.js a
   `git show <ref>:js/...` tartalomból töltődik, így a tényleges számítás fut.

   Használat:  node scripts/compare-before-after.js <régi-ref> [új-ref=HEAD] [user_id]
   Kimenet: soronként eltérés; a végén "NEM VÁLTOZIK SEMMI" vagy az eltérések.
   ============================================================ */
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Client } = require("pg");
const { DATABASE_URL } = require("../db.local.js");

const OLD = process.argv[2], NEW = process.argv[3] || "HEAD";
if (!OLD) { console.error("Használat: node scripts/compare-before-after.js <régi-ref> [új-ref] [user_id]"); process.exit(1); }
const repo = path.join(__dirname, "..");
const show = (ref, f) => execSync(`git show ${ref}:${f}`, { cwd: repo, encoding: "utf8", maxBuffer: 1 << 26 });

async function loadModules(ref) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cmp-"));
  fs.writeFileSync(path.join(dir, "state.mjs"), show(ref, "js/state.js"));
  let hasTotals = true;
  try { fs.writeFileSync(path.join(dir, "totals.mjs"), show(ref, "js/totals.js").replace('"./state.js"', '"./state.mjs"')); }
  catch (_) { hasTotals = false; }
  const st = await import("file:///" + path.join(dir, "state.mjs").replace(/\\/g, "/"));
  const tt = hasTotals ? await import("file:///" + path.join(dir, "totals.mjs").replace(/\\/g, "/")) : null;
  const data = show(ref, "js/data.js");
  const a = data.indexOf("export function stats(si){");
  const b = data.indexOf("\n}\n", a) + 3;
  const src = data.slice(a, b).replace("export function stats", "function stats");
  const factory = new Function("state", "isFutureDate", "issueState", "compsOfType", "computeTotals", "hasOwnedComponent", "allComps",
    src + "\nreturn stats;");
  return { st, tt, factory, ref };
}

(async () => {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  await c.query("BEGIN READ ONLY");
  const owner = process.argv[4] || (await c.query(`select user_id from public.members where role='owner' limit 1`)).rows[0].user_id;
  const series = (await c.query(`select id, megjelenites, megnevezes, components, sort_order from public.series order by sort_order`)).rows;
  const issues = (await c.query(`select i.id, i.series_id, i.lapszam, i.cim, i.megjelenes::text date, i.eredeti_ar, i.is_deleted,
      d.fizetett_ar, d.beszerzesi_mennyiseg besz from public.issues i left join public.member_issue_data d on d.issue_id=i.id and d.user_id=$1 order by i.series_id, i.lapszam`, [owner])).rows;
  const comps = (await c.query(`select c.id, c.issue_id, c.tipus, c.created_at, ms.status, ms.db from public.components c
      left join public.member_status ms on ms.component_id=c.id and ms.user_id=$1 order by c.created_at, c.id`, [owner])).rows;
  await c.query("ROLLBACK"); await c.end();

  const byIssue = {};
  comps.forEach(x => (byIssue[x.issue_id] = byIssue[x.issue_id] || []).push(x));
  const build = () => series.map(s => ({
    id: s.id, display: s.megjelenites, sorozat: s.megnevezes, components: s.components || [],
    items: issues.filter(i => i.series_id === s.id).map(i => {
      const o = { id: i.id, n: i.lapszam, name: i.cim, date: i.date, eredeti_ar: i.eredeti_ar, deleted: !!i.is_deleted,
        fizetett_ar: i.fizetett_ar == null ? null : i.fizetett_ar, besz_menny: i.besz == null ? 1 : i.besz, comps: {} };
      (byIssue[i.id] || []).forEach(x => (o.comps[x.tipus] = o.comps[x.tipus] || []).push({ id: x.id, tipus: x.tipus, status: x.status, db: x.db == null ? 1 : x.db }));
      return o;
    }),
  }));

  async function snapshot(ref) {
    const m = await loadModules(ref);
    const state = { SERIES: build() };
    const stats = m.factory(state, m.st.isFutureDate || ((d) => !!d && d > m.st.todayISO), m.st.issueState, m.st.compsOfType,
      m.tt ? m.tt.computeTotals : null, m.st.hasOwnedComponent, m.st.allComps);
    // régi kódállapotnál a todayISO export van; a stats() belső hivatkozásai a factory-paraméterekből jönnek
    return state.SERIES.map((s, si) => {
      const st = stats(si);
      return {
        sorozat: s.display,
        szinek: s.items.filter(i => !i.deleted).map(i => `${i.n}:${m.st.issueState(i, s) || "-"}`).join(","),
        haladas: Object.entries(st.perType).map(([t, p]) => `${t}=${p.owned}/${p.total}`).join(" "),
        osszeg: `E ${st.eredetiTotal} F ${st.fizetettTotal} | nem ismert E:${st.eredetiUnknown ? "i" : "n"} F:${st.fizetettUnknown ? "i" : "n"}`,
      };
    });
  }
  const A = await snapshot(OLD), B = await snapshot(NEW);
  let diffs = 0;
  console.log(`Összehasonlítás: ${OLD}  →  ${NEW}   (felhasználó: ${String(owner).slice(0, 8)}…)\n`);
  console.log("sorozat".padEnd(20) + "színek".padEnd(10) + "haladás".padEnd(10) + "összeg");
  A.forEach((a, i) => {
    const b = B[i];
    const cs = a.szinek === b.szinek, ch = a.haladas === b.haladas, co = a.osszeg === b.osszeg;
    console.log(a.sorozat.padEnd(20) + (cs ? "azonos" : "ELTÉR").padEnd(10) + (ch ? "azonos" : "ELTÉR").padEnd(10) + (co ? "azonos" : "ELTÉR"));
    if (!cs) { diffs++; console.log("   színek régi:", a.szinek, "\n   színek új:  ", b.szinek); }
    if (!ch) { diffs++; console.log("   haladás régi:", a.haladas, "\n   haladás új:  ", b.haladas); }
    if (!co) { diffs++; console.log("   összeg régi:", a.osszeg, "\n   összeg új:  ", b.osszeg); }
  });
  console.log(diffs ? `\n✘ ${diffs} eltérés.` : "\n✔ NEM VÁLTOZIK SEMMI: a Számok színe, a haladásjelzők és az Összeg-kártya értékei azonosak minden sorozatnál.");
})().catch(e => { console.error("Hiba:", e.message); process.exit(1); });
