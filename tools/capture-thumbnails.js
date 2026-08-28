const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const captureDir = path.join(root, "assets", "thumbs", "captures");
const generatedDir = path.join(root, "assets", "thumbs", "generated");
const minimumUsefulPngBytes = 6000;

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

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

function findChrome() {
  return chromeCandidates.find((candidate) => fs.existsSync(candidate));
}

function fileUrl(localPath) {
  return new URL(`file://${path.resolve(localPath).replace(/\\/g, "/")}`).href;
}

function capture(chrome, url, outFile) {
  const result = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--disable-web-security",
      "--allow-file-access-from-files",
      "--hide-scrollbars",
      "--mute-audio",
      "--autoplay-policy=no-user-gesture-required",
      "--window-size=512,512",
      "--virtual-time-budget=3500",
      `--screenshot=${outFile}`,
      url,
    ],
    { encoding: "utf8", timeout: 15000 }
  );

  return (
    result.status === 0 &&
    fs.existsSync(outFile) &&
    fs.statSync(outFile).size >= minimumUsefulPngBytes
  );
}

function captureUrlFor(game) {
  if (game.embedType === "html" && game.embedPath) {
    return fileUrl(path.join(root, game.embedPath));
  }

  if (game.embedType === "iframe" && game.embedUrl && !game.embedUrl.includes("sites.google.com")) {
    return game.embedUrl;
  }

  return "";
}

function generatedThumbFor(game) {
  return `assets/thumbs/generated/${slugify(game.id || game.title)}.svg`;
}

function pruneWeakCaptures(games) {
  let pruned = 0;
  for (const game of games) {
    if (game.thumbnailSource !== "capture" || !game.thumbnail) continue;
    const localPath = path.join(root, game.thumbnail);
    if (!fs.existsSync(localPath) || fs.statSync(localPath).size < minimumUsefulPngBytes) {
      game.thumbnail = generatedThumbFor(game);
      game.thumbnailSource = "generated";
      pruned += 1;
    }
  }
  return pruned;
}

function main() {
  const chrome = findChrome();
  if (!chrome) {
    throw new Error("Chrome or Edge was not found, so screenshots cannot be captured.");
  }

  const games = readGames();
  if (process.argv.includes("--prune-only")) {
    const pruned = pruneWeakCaptures(games);
    writeGames(games);
    console.log(JSON.stringify({ pruned }, null, 2));
    return;
  }

  fs.rmSync(captureDir, { recursive: true, force: true });
  fs.mkdirSync(captureDir, { recursive: true });

  let captured = 0;
  let skipped = 0;

  for (const game of games) {
    if (game.thumbnailSource !== "generated" && game.thumbnailSource !== "capture") {
      skipped += 1;
      continue;
    }

    const url = captureUrlFor(game);
    if (!url) {
      skipped += 1;
      continue;
    }

    const file = `${slugify(game.id || game.title)}.png`;
    const outFile = path.join(captureDir, file);
    process.stdout.write(`capturing ${game.title}\n`);

    if (capture(chrome, url, outFile)) {
      game.thumbnail = `assets/thumbs/captures/${file}`;
      game.thumbnailSource = "capture";
      captured += 1;
    } else {
      game.thumbnail = generatedThumbFor(game);
      game.thumbnailSource = fs.existsSync(path.join(root, game.thumbnail)) ? "generated" : game.thumbnailSource;
      skipped += 1;
      try {
        fs.rmSync(outFile, { force: true });
      } catch {}
    }
  }

  writeGames(games);
  console.log(JSON.stringify({ captured, skipped }, null, 2));
}

main();
