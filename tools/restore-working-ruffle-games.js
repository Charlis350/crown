const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFileSync } = require("child_process");

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

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function findSwfUrls(html) {
  return [
    ...new Set(
      [...html.matchAll(/(?:src|value|data)\s*=\s*["']([^"']+?\.swf(?:\?[^"']*)?)["']/gi)]
        .map((match) => decodeHtml(match[1]).trim())
        .filter(Boolean),
    ),
  ];
}

function httpWorks(url) {
  try {
    const output = execFileSync(
      "curl.exe",
      [
        "--ssl-no-revoke",
        "-L",
        "--silent",
        "--show-error",
        "--max-time",
        "20",
        "--range",
        "0-0",
        "--output",
        "NUL",
        "--write-out",
        "%{http_code}",
        url,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return /^(200|206)$/u.test(output.trim());
  } catch {
    return false;
  }
}

function localWorks(url, embedPath) {
  const clean = url.split(/[?#]/)[0];
  const target = path.resolve(path.dirname(path.join(root, embedPath)), clean);
  return target.startsWith(root) && fs.existsSync(target) && fs.statSync(target).size > 512;
}

function swfWorks(url, embedPath) {
  if (/^https?:\/\//i.test(url)) return httpWorks(url);
  return localWorks(url, embedPath);
}

const games = readGames();
const restored = [];
const keptDisabled = [];

for (const game of games) {
  if (game.embedType !== "html" || !game.embedPath) continue;
  const file = path.join(root, game.embedPath);
  if (!fs.existsSync(file)) continue;

  const html = fs.readFileSync(file, "utf8");
  const hasRuffle = /@ruffle-rs|RufflePlayer|\.swf\b|shockwave-flash|application\/x-shockwave-flash/i.test(html);
  if (!hasRuffle) continue;

  const urls = findSwfUrls(html);
  const works = urls.some((url) => swfWorks(url, game.embedPath));

  if (works) {
    game.playable = true;
    game.requiresRuffle = true;
    delete game.mobileReady;
    delete game.unsupportedReason;
    restored.push({ title: game.title, swf: urls[0] || "" });
  } else {
    game.playable = false;
    game.mobileReady = false;
    game.requiresRuffle = true;
    game.unsupportedReason = urls.length ? "Flash file did not respond" : "Flash file missing";
    keptDisabled.push({ title: game.title, swfCount: urls.length });
  }
}

writeGames(games);

console.log(
  JSON.stringify(
    {
      restored: restored.length,
      keptDisabled: keptDisabled.length,
      restoredSamples: restored.slice(0, 40),
      keptDisabledSamples: keptDisabled.slice(0, 40),
    },
    null,
    2,
  ),
);
