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
function isVisibleGame(game) {
  return Boolean(
    game.playable &&
    game.mobileReady !== false &&
    !game.unsupportedReason &&
    game.embedType === "html" &&
    game.embedPath
  );
}

function isRobloxStyleGame(game) {
  return /roblox|obby|minecraft|eagler|noob|block|parkour|monster school|herobrine|mine/i.test(
    [game.title, game.category, ...(game.tags || [])].join(" ")
  );
}

const playable = games.filter(isVisibleGame);
const hiddenIds = new Set();
games
  .filter((game) => game.mobileReady === false || game.unsupportedReason)
  .forEach((game) => hiddenIds.add(game.id));
games
  .filter(
  (game) =>
    game.playable &&
    !isVisibleGame(game) &&
    (game.embedPath || game.embedUrl),
  )
  .forEach((game) => hiddenIds.add(game.id));
const missingEmbedFiles = [];
const ruffleOrFlash = [];
const externalShells = [];
const missingThumbnails = [];

function fileExists(assetPath) {
  return fs.existsSync(path.join(root, assetPath));
}

function isValidImageFile(assetPath) {
  const file = path.join(root, assetPath);
  if (!fs.existsSync(file)) return false;
  const buffer = fs.readFileSync(file);
  if (buffer.length < 8) return false;
  const head = buffer.slice(0, 16).toString("hex");
  const textHead = buffer.slice(0, 128).toString("utf8").trim().toLowerCase();
  return (
    head.startsWith("ffd8ff") ||
    head.startsWith("89504e470d0a1a0a") ||
    head.startsWith("52494646") ||
    textHead.startsWith("<svg")
  );
}

function looksLikeRuffleOrFlash(html) {
  return /@ruffle-rs|RufflePlayer|\.swf\b|shockwave-flash|application\/x-shockwave-flash/i.test(html);
}

function looksLikeExternalShell(html) {
  const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const iframeMatch = bodyText.match(/<iframe[^>]+src=["'](https?:\/\/[^"']+)/i);
  const hasCanvas = /<canvas\b/i.test(bodyText);
  const hasLocalScript = /<script[^>]+src=["'](?!https?:\/\/)[^"']+/i.test(html);
  const shortShell = bodyText.length < 6000;
  return Boolean(iframeMatch && shortShell && !hasCanvas && !hasLocalScript);
}

for (const game of playable.filter((entry) => entry.embedType === "html" && entry.embedPath)) {
  if (!fileExists(game.embedPath)) {
    missingEmbedFiles.push({ title: game.title, embedPath: game.embedPath });
    continue;
  }

  const html = fs.readFileSync(path.join(root, game.embedPath), "utf8");
  if (looksLikeRuffleOrFlash(html)) {
    ruffleOrFlash.push({ title: game.title, embedPath: game.embedPath });
  }
  if (looksLikeExternalShell(html)) {
    externalShells.push({ title: game.title, embedPath: game.embedPath });
  }
}

for (const game of games) {
  const thumbnail = String(game.thumbnail || "");
  if (!thumbnail) {
    missingThumbnails.push({ title: game.title, reason: "empty" });
  } else if (!/^https?:|^data:/i.test(thumbnail) && !isValidImageFile(thumbnail)) {
    missingThumbnails.push({ title: game.title, thumbnail, reason: "missing or invalid local image" });
  }
}

console.log(
  JSON.stringify(
    {
      totalCatalogGames: games.length,
      visibleIpadReadyGames: playable.length,
      hiddenExternalOrUnsupportedGames: hiddenIds.size,
      missingEmbedFiles: missingEmbedFiles.length,
      ruffleOrFlashGames: ruffleOrFlash.length,
      externalShells: externalShells.length,
      missingThumbnails: missingThumbnails.length,
      samples: {
        missingEmbedFiles: missingEmbedFiles.slice(0, 20),
        ruffleOrFlash: ruffleOrFlash.slice(0, 20),
        externalShells: externalShells.slice(0, 20),
        missingThumbnails: missingThumbnails.slice(0, 20),
      },
    },
    null,
    2,
  ),
);
