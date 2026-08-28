const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const reportFile = path.join(root, "data", "remote-removal-report.json");

function readGames() {
  const raw = fs.readFileSync(dataFile, "utf8");
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Could not find game array in data/games.js");
  return JSON.parse(raw.slice(start, end + 1));
}

function writeGames(games) {
  fs.writeFileSync(dataFile, `window.CROWN_GAMES = ${JSON.stringify(games, null, 2)};\n`, "utf8");
}

function normalizePath(value = "") {
  return String(value).replace(/\\/g, "/").replace(/^\/+/, "");
}

function isLocalHtmlGame(game) {
  if (!game || game.playable !== true || game.mobileReady === false || game.unsupportedReason) return false;
  if (game.embedType !== "html" || !game.embedPath) return false;
  const embedPath = normalizePath(game.embedPath);
  if (/^(?:https?:|data:|blob:|javascript:)/i.test(embedPath)) return false;
  return fs.existsSync(path.join(root, embedPath));
}

function main() {
  const games = readGames();
  const kept = [];
  const removed = [];

  for (const game of games) {
    if (isLocalHtmlGame(game)) {
      kept.push({
        ...game,
        playable: true,
        source: "crown",
        sourceNote: "Crown-local launch file",
      });
    } else {
      removed.push({
        id: game.id,
        title: game.title,
        source: game.source,
        embedType: game.embedType,
        embedUrl: game.embedUrl,
        embedPath: game.embedPath,
        reason: game.unsupportedReason || "remote iframe, hidden unsupported game, or missing local launch file",
      });
    }
  }

  kept.sort((a, b) => String(a.title).localeCompare(String(b.title), undefined, { sensitivity: "base" }));
  writeGames(kept);
  fs.writeFileSync(
    reportFile,
    JSON.stringify(
      {
        before: games.length,
        after: kept.length,
        removed: removed.length,
        removedBySource: removed.reduce((counts, game) => {
          const source = game.source || "unknown";
          counts[source] = (counts[source] || 0) + 1;
          return counts;
        }, {}),
        removedSamples: removed.slice(0, 80),
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Kept ${kept.length} Crown-local games. Removed ${removed.length} remote/missing entries.`);
  console.log(`Report: ${path.relative(root, reportFile)}`);
}

main();
