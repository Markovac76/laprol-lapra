// Vercel build (vercel.json → buildCommand): megírja a config.js fájlt (nyilvános kulcs + verzió) és a verzio.json-t.
// Helyben NEM kell futtatni: a kézzel készített config.js-ben nincs APP_VERSION, és akkor a verzióellenőrzés kikapcsol.
// Semmit nem töröl, és a két fájlon kívül semmit nem ír.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const key = process.env.SUPABASE_ANON_KEY || "";
const base = `window.SUPABASE_URL="https://jwiujuxvymzxjpphrgip.supabase.co";window.SUPABASE_ANON_KEY=${JSON.stringify(key)};`;

// A verzió az APP FÁJLJAINAK TARTALOM-UJJLENYOMATA: a config.js alapja (a kulccsal), az index.html, a styles.css,
// a manifest.json és a js/ mappa minden .js fájlja — rendezett fájlnevekkel, egységes sorvéggel. Így ugyanarra a
// tartalomra mindig ugyanaz, egy dokumentáció-commit nem ad új verziót, egy kód- vagy kulcs-változás igen.
function jsFiles(dir){
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? jsFiles(path.join(dir, e.name)) : (e.name.endsWith(".js") ? [path.join(dir, e.name).split(path.sep).join("/")] : []));
}
const files = ["index.html", "styles.css", "manifest.json", ...jsFiles("js")].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const h = crypto.createHash("sha256");
h.update("config.js\n" + base + "\n");
for (const f of files) h.update(f + "\n" + fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n") + "\n");
const v = h.digest("hex").slice(0, 10);

// Mit tiltson a RÉGI kód: "torzs" (alap: a személyes mentés megy) vagy "minden" — a kiadas.json dönti el.
let tilt = "torzs";
try { if (JSON.parse(fs.readFileSync("kiadas.json", "utf8")).tilt === "minden") tilt = "minden"; } catch (_) {}

fs.writeFileSync("config.js", base + `window.APP_VERSION=${JSON.stringify(v)};`);
fs.writeFileSync("verzio.json", JSON.stringify({ v, tilt, epitve: new Date().toISOString() }));
console.log(`verzió: ${v} (${files.length + 1} fájl ujjlenyomata) | tiltás régi kódnál: ${tilt}`);
