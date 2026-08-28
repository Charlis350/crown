const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");

function readGames() {
  const raw = fs.readFileSync(dataFile, "utf8");
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  return JSON.parse(raw.slice(start, end + 1));
}

const games = readGames();

function isRobloxStyleGame(game) {
  return /roblox|obby|minecraft|eagler|noob|block|parkour|monster school|herobrine|mine/i.test(
    [game.title, game.category, ...(game.tags || [])].join(" ")
  );
}

function isVisibleGame(game) {
  return Boolean(
    game.playable &&
      game.mobileReady !== false &&
      !game.unsupportedReason &&
      game.embedType === "html" &&
      game.embedPath
  );
}

const robloxStyle = games.filter(isRobloxStyleGame);
const visible = robloxStyle.filter(isVisibleGame);
const hidden = robloxStyle.filter((game) => !isVisibleGame(game));

const hiddenByHost = hidden.reduce((counts, game) => {
  let host = "local-missing";
  if (game.embedUrl) {
    try {
      host = new URL(game.embedUrl).hostname.toLowerCase();
    } catch (error) {
      host = "local-or-invalid";
    }
  }
  counts[host] = (counts[host] || 0) + 1;
  return counts;
}, {});

console.log(
  JSON.stringify(
    {
      robloxStyleTotal: robloxStyle.length,
      visibleRobloxStyle: visible.length,
      hiddenRobloxStyle: hidden.length,
      hiddenByHost,
      hiddenTitles: hidden.map((game) => game.title),
    },
    null,
    2,
  ),
);
