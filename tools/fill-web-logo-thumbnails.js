const fs = require("fs");
const https = require("https");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const gamesPath = path.join(repoRoot, "data", "games.js");
const outputDir = path.join(repoRoot, "assets", "thumbs", "web-logos");
const agent = new https.Agent({ rejectUnauthorized: false });

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function loadGames() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(gamesPath, "utf8"), sandbox);
  return sandbox.window.CROWN_GAMES;
}

function saveGames(games) {
  fs.writeFileSync(gamesPath, `window.CROWN_GAMES = ${JSON.stringify(games, null, 2)};\n`);
}

function isValidImageFile(assetPath) {
  const fullPath = path.join(repoRoot, assetPath);
  if (!fs.existsSync(fullPath)) return false;
  const buffer = fs.readFileSync(fullPath);
  if (buffer.length < 8) return false;
  const head = buffer.slice(0, 16).toString("hex");
  const textHead = buffer.slice(0, 64).toString("utf8").trim().toLowerCase();
  return (
    head.startsWith("ffd8ff") ||
    head.startsWith("89504e470d0a1a0a") ||
    head.startsWith("52494646") ||
    textHead.startsWith("<svg")
  );
}

function download(url, target) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        agent,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CrownGamesThumbnailImporter/1.0",
        },
      },
      (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          download(new URL(response.headers.location, url).href, target).then(resolve, reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const buffer = Buffer.concat(chunks);
          if (buffer.length < 5000) {
            reject(new Error(`thumbnail was too small (${buffer.length} bytes)`));
            return;
          }
          fs.writeFileSync(target, buffer);
          resolve(buffer.length);
        });
      },
    );

    request.setTimeout(20000, () => request.destroy(new Error("request timed out")));
    request.on("error", reject);
  });
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const games = loadGames();
  const unresolved = games.filter((game) => {
    const thumbnail = String(game.thumbnail || "");
    if (game.thumbnailSource === "crown" || thumbnail.includes("crown-covers")) return true;
    if (!thumbnail || /^https?:/i.test(thumbnail)) return false;
    return !isValidImageFile(thumbnail);
  });

  const results = [];
  for (const game of unresolved) {
    const fileName = `${slugify(game.title)}.jpg`;
    const filePath = path.join(outputDir, fileName);
    const assetPath = `assets/thumbs/web-logos/${fileName}`;

    if (!fs.existsSync(filePath)) {
      const query = `${game.title} game logo cover`;
      const url = `https://tse.mm.bing.net/th?q=${encodeURIComponent(query)}&w=512&h=512&c=7`;
      try {
        const bytes = await download(url, filePath);
        results.push({ title: game.title, status: "downloaded", bytes });
      } catch (error) {
        results.push({ title: game.title, status: "failed", error: error.message });
        continue;
      }
    } else {
      results.push({ title: game.title, status: "existing" });
    }

    game.thumbnail = assetPath;
    game.thumbnailSource = "web-logo-local";
  }

  saveGames(games);

  const stillUnresolved = games.filter((game) => {
    const thumbnail = String(game.thumbnail || "");
    if (game.thumbnailSource === "crown" || thumbnail.includes("crown-covers")) return true;
    if (!thumbnail || /^https?:/i.test(thumbnail)) return false;
    return !isValidImageFile(thumbnail);
  });

  console.log(
    JSON.stringify(
      {
        attempted: unresolved.length,
        failed: results.filter((result) => result.status === "failed").length,
        stillUnresolved: stillUnresolved.length,
        results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
