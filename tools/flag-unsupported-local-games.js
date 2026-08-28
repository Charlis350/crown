const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");

function readGames() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(dataFile, "utf8"), sandbox);
  return Array.isArray(sandbox.window.CROWN_GAMES) ? sandbox.window.CROWN_GAMES : [];
}

function writeGames(games) {
  fs.writeFileSync(dataFile, `window.CROWN_GAMES = ${JSON.stringify(games, null, 2)};\n`, "utf8");
}

function isExternalShell(html) {
  const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const iframeMatch = bodyText.match(/<iframe[^>]+src=["'](https?:\/\/[^"']+)/i);
  const hasCanvas = /<canvas\b/i.test(bodyText);
  const hasLocalScript = /<script[^>]+src=["'](?!https?:\/\/)[^"']+/i.test(html);
  return Boolean(iframeMatch && bodyText.length < 6000 && !hasCanvas && !hasLocalScript);
}

const games = readGames();
const flagged = [];
const unflagged = [];
const missing = [];

for (const game of games) {
  if (game.embedType !== "html" || !game.embedPath) continue;
  const file = path.join(root, game.embedPath);
  if (!fs.existsSync(file)) {
    game.mobileReady = false;
    game.playable = false;
    game.unsupportedReason = "missing local HTML";
    missing.push(game.title);
    continue;
  }

  const html = fs.readFileSync(file, "utf8");
  const reasons = [];
  if (isExternalShell(html)) reasons.push("external-only iframe shell");

  if (reasons.length) {
    game.mobileReady = false;
    game.playable = false;
    game.unsupportedReason = reasons.join("; ");
    flagged.push({ title: game.title, reason: game.unsupportedReason });
  } else if (game.unsupportedReason === "external-only iframe shell" || game.mobileReady === false && !game.requiresRuffle) {
    delete game.unsupportedReason;
    delete game.mobileReady;
    unflagged.push(game.title);
  }
}

writeGames(games);

console.log(
  JSON.stringify(
    {
      flagged: flagged.length,
      unflagged: unflagged.length,
      missing: missing.length,
      flaggedSamples: flagged.slice(0, 60),
      missingSamples: missing.slice(0, 20),
    },
    null,
    2,
  ),
);
