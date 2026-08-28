const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const USER_AGENT =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 CrownGamesValidator/1.0";

function readGames() {
  const raw = fs.readFileSync(dataFile, "utf8");
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) throw new Error("Could not parse data/games.js");
  return JSON.parse(raw.slice(start, end + 1));
}

function writeGames(games) {
  fs.writeFileSync(dataFile, `window.CROWN_GAMES = ${JSON.stringify(games, null, 2)};\n`, "utf8");
}

function checkUrl(url) {
  const args = [
    "--ssl-no-revoke",
    "-L",
    "--compressed",
    "--max-time",
    "20",
    "-sS",
    "-A",
    USER_AGENT,
    "-D",
    "-",
    "-o",
    "NUL",
    url,
  ];

  return new Promise((resolve) => {
    execFile("curl.exe", args, { encoding: "utf8", maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      const headers = String(stdout || "");
      const statusMatches = [...headers.matchAll(/^HTTP\/\S+\s+(\d+)/gim)];
      const status = statusMatches.length ? Number(statusMatches[statusMatches.length - 1][1]) : 0;
      const xFrame = [...headers.matchAll(/^x-frame-options:\s*(.+)$/gim)].map((match) => match[1].trim()).pop() || "";
      const location = [...headers.matchAll(/^location:\s*(.+)$/gim)].map((match) => match[1].trim()).pop() || "";
      const ok =
        !error &&
        status >= 200 &&
        status < 400 &&
        !/sameorigin|deny/i.test(xFrame) &&
        !/users\/sign_in|projects\.gitlab\.io\/auth/i.test(location);

      resolve({
        ok,
        status,
        xFrame,
        location,
        error: error ? (stderr && String(stderr).trim()) || error.message : "",
      });
    });
  });
}

async function mapLimit(items, limit, worker) {
  let index = 0;
  let completed = 0;
  async function run() {
    while (index < items.length) {
      const current = index++;
      await worker(items[current], current);
      completed += 1;
      if (completed % 50 === 0 || completed === items.length) {
        console.log(`Validated ${completed}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

async function main() {
  const games = readGames();
  const targets = games.filter((game) => game.source === "classrom6x" && game.embedUrl);
  const brokenIds = new Set();
  const broken = [];

  await mapLimit(targets, 16, async (game) => {
    const result = await checkUrl(game.embedUrl);
    if (!result.ok) {
      brokenIds.add(game.id);
      broken.push({
        id: game.id,
        title: game.title,
        status: result.status,
        xFrame: result.xFrame,
        location: result.location,
        url: game.embedUrl,
      });
    }
  });

  const finalGames = games.filter((game) => !brokenIds.has(game.id));
  writeGames(finalGames);

  console.log(
    JSON.stringify(
      {
        checked: targets.length,
        removedBroken: broken.length,
        remaining: finalGames.length,
        samples: broken.slice(0, 30),
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
