const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");

function readGames() {
  const raw = fs.readFileSync(dataFile, "utf8");
  return JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
}

function writeGames(games) {
  fs.writeFileSync(
    dataFile,
    "window.CROWN_GAMES = " + JSON.stringify(games, null, 2) + ";\n",
    "utf8"
  );
}

function normalizeTitle(value) {
  return String(value)
    .toLowerCase()
    .replace(/\b(the|and|of|a)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function isPlayable(game) {
  return Boolean(game.playable && (game.embedPath || game.embedUrl));
}

function isGoogleSiteUrl(value) {
  return /sites\.google\.com\/lindberghschools\.ws\/crown-official/i.test(value || "");
}

const blockedGameIds = new Set([
  "class6x-peppa-pig-basketball",
]);

const blockedGameTitles = new Set([
  "peppa pig: basketball",
]);

function isBlockedGame(game) {
  return (
    blockedGameIds.has(String(game.id || "")) ||
    blockedGameTitles.has(String(game.title || "").toLowerCase())
  );
}

function normalizeCategory(game) {
  if (game.category === "Drive Imports") game.category = "Bonus Games";
  return game;
}

function score(game) {
  let value = 0;
  if (game.source === "class6x") value += 1000;
  if (game.source === "drive-folder") value += 700;
  if (game.source === "google-site") value += 300;
  if (game.thumbnailSource && game.thumbnailSource !== "generated") value += 40;
  if (game.embedType === "iframe") value += 30;
  if (game.embedPath) value += 20;
  if (isPlayable(game)) value += 100;
  if (isGoogleSiteUrl(game.embedUrl)) value -= 1000;
  if (game.category === "Sites") value -= 1000;
  return value;
}

const before = readGames();
const filtered = before
  .filter((game) => {
    if (!isPlayable(game)) return false;
    if (game.category === "Sites") return false;
    if (isGoogleSiteUrl(game.embedUrl)) return false;
    if (isBlockedGame(game)) return false;
    return true;
  })
  .map(normalizeCategory);

const byTitle = new Map();
for (const game of filtered) {
  const key = normalizeTitle(game.title);
  const current = byTitle.get(key);
  if (!current || score(game) > score(current)) byTitle.set(key, game);
}

const games = [...byTitle.values()].sort((a, b) => {
  const cat = String(a.category || "").localeCompare(String(b.category || ""));
  if (cat) return cat;
  return String(a.title || "").localeCompare(String(b.title || ""));
});

writeGames(games);
console.log(
  JSON.stringify(
    {
      before: before.length,
      removedUnplayableOrOffsite: before.length - filtered.length,
      removedDuplicateTitles: filtered.length - games.length,
      after: games.length,
      class6x: games.filter((game) => game.source === "class6x").length,
      drive: games.filter((game) => game.source === "drive-folder").length,
      googleSite: games.filter((game) => game.source === "google-site").length,
    },
    null,
    2
  )
);
