const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const thumbDir = path.join(root, "assets", "thumbs", "embedded");
const agent = new https.Agent({ rejectUnauthorized: false });

function readGames() {
  const raw = fs.readFileSync(dataFile, "utf8");
  return JSON.parse(
    raw
      .replace(/^\s*window\.CROWN_GAMES\s*=\s*/, "")
      .replace(/;\s*$/, "")
  );
}

function writeGames(games) {
  fs.writeFileSync(
    dataFile,
    "window.CROWN_GAMES = " + JSON.stringify(games, null, 2) + ";\n",
    "utf8"
  );
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = String(url).startsWith("http://") ? http : https;
    const req = client.get(
      url,
      {
        agent: client === https ? agent : undefined,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CrownGamesThumbnailLocalizer/1.0",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("error", reject);
    req.setTimeout(20000, () => req.destroy(new Error("Request timed out")));
  });
}

async function main() {
  const games = readGames();
  fs.mkdirSync(thumbDir, { recursive: true });
  let localized = 0;

  for (const game of games) {
    if (!/^https?:\/\//i.test(game.thumbnail || "")) continue;
    const ext = path.extname(new URL(game.thumbnail).pathname).replace(/[^a-z0-9.]/gi, "") || ".jpg";
    const file = `${slugify(game.id || game.title)}${ext}`;
    const target = path.join(thumbDir, file);
    try {
      const bytes = await fetchBuffer(game.thumbnail);
      if (bytes.length < 256) continue;
      fs.writeFileSync(target, bytes);
      game.thumbnail = `assets/thumbs/embedded/${file}`;
      localized += 1;
    } catch {}
  }

  writeGames(games);
  console.log(JSON.stringify({ localized }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
