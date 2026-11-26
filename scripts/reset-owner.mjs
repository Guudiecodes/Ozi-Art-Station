// Run: npm run reset-owner
// Clears the owner password so the next visit to /login lets you choose a new one. Your assets, orders and settings are not touched.
import fs from "fs"; import path from "path";
const f = path.join(process.cwd(), "data", "db.json");
if (!fs.existsSync(f)) { console.log("No data/db.json yet. Nothing to reset."); process.exit(0); }
const db = JSON.parse(fs.readFileSync(f, "utf8"));
for (const u of db.users) if (u.role === "admin") { u.hash = ""; u.salt = ""; }
db.sessions = [];
fs.writeFileSync(f, JSON.stringify(db));
console.log("Owner password cleared. Open /login to choose a new one.");
