const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const localDir = path.join(root, "embeds", "class6x-local");

const raw = fs.readFileSync(dataFile, "utf8");
const games = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
const next = games.filter((game) => !String(game.id || "").startsWith("class6x-local-"));

fs.writeFileSync(dataFile, `window.CROWN_GAMES = ${JSON.stringify(next, null, 2)};\n`, "utf8");
fs.rmSync(localDir, { recursive: true, force: true });

console.log(`Removed ${games.length - next.length} localized Class6x test entries.`);
