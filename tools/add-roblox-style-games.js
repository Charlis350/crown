const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const thumbDir = path.join(root, "assets", "thumbs", "roblox-style");

const pages = [
  "https://gamexgames.com/game/natural-disaster-survival-obby",
  "https://gamexgames.com/game/obby%3A-gym-simulator%2C-escape",
  "https://gamexgames.com/game/italian-brainrot-obby-parkour",
  "https://gamexgames.com/game/tung-tung-sahur%3A-obby-challenge",
  "https://gamexgames.com/game/barry-prison-hide-and-seek",
  "https://gamexgames.com/game/last-to-leave-circle-obby",
  "https://gamexgames.com/game/block-parkour-trials",
  "https://gamexgames.com/game/obby-halloween-danger-skate",
  "https://gamexgames.com/game/obby-tower-parkour-climb",
  "https://gamexgames.com/game/obby-modes-online-mini-games",
  "https://gamexgames.com/game/obby-parkour-ultimate",
  "https://gamexgames.com/game/noob-miner:-escape-from-prison",
  "https://gamexgames.com/game/noob-vs-pro-challenge",
  "https://gamexgames.com/game/kogama-parkour-25-levels",
  "https://gamexgames.com/game/only-up-3d-parkour-go-ascend",
  "https://gamexgames.com/game/noob-vs-pro-challenge-samsung",
  "https://gamexgames.com/game/monster-school-challenge-2",
  "https://gamexgames.com/game/stickman-vs-huggy-wuggy",
  "https://gamexgames.com/game/noob-shooter:-gun-battle-3d",
  "https://gamexgames.com/game/noob-in-geometry-dash",
  "https://gamexgames.com/game/building-mods-for-minecraft",
  "https://gamexgames.com/game/parkour-block-5",
  "https://gamexgames.com/game/parkour-block-6",
  "https://gamexgames.com/game/cross-the-road",
  "https://gamexgames.com/game/egg-wars",
  "https://gamexgames.com/game/noob-fuse",
  "https://gamexgames.com/game/noob-huggy",
  "https://gamexgames.com/game/noob-vs-pro-3",
  "https://gamexgames.com/game/crazy-motorcycle",
  "https://gamexgames.com/game/mine-2d-survival-herobrine",
  "https://gamexgames.com/game/parkour-world-2",
  "https://gamexgames.com/game/monster-school-challenge-3",
  "https://gamexgames.com/game/battle-royale-noob-vs-pro",
  "https://gamexgames.com/game/noob-vs-pro-4-lucky-block",
  "https://gamexgames.com/game/noob-vs-1000-zombies",
  "https://gamexgames.com/game/mr-noob-vs-zombies",
  "https://gamexgames.com/game/trap-craft-samsung",
  "https://gamexgames.com/game/herobrine-vs-monster-school",
  "https://gamexgames.com/game/monster-school-vs-siren-head",
  "https://gamexgames.com/game/noob-vs-hacker-diver-suit",
  "https://gamexgames.com/game/red-stickman-vs-monster-school",
  "https://gamexgames.com/game/impostor-vs-noob",
  "https://gamexgames.com/game/pixel-craft-hide-and-seek",
  "https://gamexgames.com/game/math-obby",
  "https://gamexgames.com/game/obby-on-a-bike",
  "https://gamexgames.com/game/color-race-obby",
  "https://gamexgames.com/game/fun-obby-extreme",
  "https://gamexgames.com/game/obby-blox-parkour",
  "https://gamexgames.com/game/obby-3d-sprunki-parkour",
  "https://gamexgames.com/game/parkour-block-7",
  "https://gamexgames.com/game/noob%3A-zombie-prison-escape",
  "https://gamexgames.com/game/obby-prison%3A-craft-escape",
  "https://gamexgames.com/game/jailbreak-%3A-escape-from-prison",
  "https://gamexgames.com/game/only-up",
  "https://gamexgames.com/game/hot-knockout-dudes",
  "https://gamexgames.com/game/square-world-3d",
  "https://gamexgames.com/game/math-wall-simulator",
  "https://gamexgames.com/game/br-br-patapim%3A-obby-challenge",
  "https://www.freegames.com/game/Obby-Tower",
  "https://www.freegames.com/game/Obby-The-Squid-Jump-Rope",
  "https://www.freegames.com/game/Obby-Snake-Io",
  "https://www.freegames.com/game/Don-T-Wake-The-Brainrots",
  "https://www.freegames.com/game/The-Exit-8-Roblox",
  "https://www.freegames.com/game/Obby-Dragon-Training",
  "https://www.freegames.com/game/Grow-A-Obby-Garden",
  "https://www.freegames.com/game/Roblox-Obby-Escape-The-School",
  "https://www.freegames.com/game/Knockout",
  "https://www.freegames.com/game/Jigsaw-Puzzle-Tung-Tung-Sahur-Obby-Run",
  "https://www.cargames.com/Escape-Evil-Granny-Obby",
  "https://www.mafa.com/game/Jigsaw-Puzzle-Obby-Parkour",
];

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

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function htmlDecode(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanTitle(value, fallback) {
  return htmlDecode(value || fallback)
    .replace(/\s*(?:-|\\|)\s*(Gamex Games|FreeGames|Play Online.*|Game Unblocked.*|Roblox Obby Game.*)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extract(pattern, html) {
  const match = html.match(pattern);
  return match ? htmlDecode(match[1]) : "";
}

function extFromUrl(url) {
  const clean = String(url).split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return ".png";
  if (clean.endsWith(".webp")) return ".webp";
  return ".jpg";
}

function fetchText(url) {
  return execFileSync(
    "curl.exe",
    [
      "-k",
      "-L",
      "--silent",
      "--show-error",
      "--max-time",
      "15",
      "-A",
      "Mozilla/5.0 CrownGamesBot/1.0",
      url,
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
}

function download(url, file) {
  const buffer = execFileSync(
    "curl.exe",
    [
      "-k",
      "-L",
      "--silent",
      "--show-error",
      "--max-time",
      "25",
      "-A",
      "Mozilla/5.0 CrownGamesBot/1.0",
      "-e",
      new URL(url).origin + "/",
      url,
    ],
    { maxBuffer: 20 * 1024 * 1024 }
  );
  fs.writeFileSync(file, buffer);
}

function parseGame(pageUrl, html) {
  const iframe = extract(/<iframe[^>]+src=["']([^"']+)/i, html);
  if (!iframe) return null;
  const title =
    extract(/<h1[^>]*>\s*([^<]+)/i, html) ||
    extract(/<title>\s*([^<]+)/i, html) ||
    pageUrl.split("/").pop();
  const image =
    extract(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i, html) ||
    extract(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i, html);
  return {
    pageUrl,
    title: cleanTitle(title, pageUrl),
    iframe,
    image,
  };
}

fs.mkdirSync(thumbDir, { recursive: true });

(async () => {
  const games = readGames();
  const existingTitles = new Set(games.map((game) => String(game.title).toLowerCase()));
  const existingEmbeds = new Set(games.map((game) => String(game.embedUrl || game.embedPath || "")));
  const added = [];
  const skipped = [];

  for (const pageUrl of pages) {
    try {
      const parsed = parseGame(pageUrl, fetchText(pageUrl));
      if (!parsed) {
        skipped.push({ pageUrl, reason: "no iframe" });
        continue;
      }
      if (existingTitles.has(parsed.title.toLowerCase()) || existingEmbeds.has(parsed.iframe)) {
        skipped.push({ pageUrl, title: parsed.title, reason: "duplicate" });
        continue;
      }

      const id = `crown-roblox-style-${slug(parsed.title)}`;
      let thumbnail = "assets/crown-logo.svg";
      let thumbnailSource = "crown-logo";
      if (parsed.image) {
        const imageFile = path.join(thumbDir, `${slug(parsed.title)}${extFromUrl(parsed.image)}`);
        download(parsed.image, imageFile);
        thumbnail = path.relative(root, imageFile).replace(/\\/g, "/");
        thumbnailSource = "roblox-style";
      }

      games.push({
        id,
        title: parsed.title,
        category: "Roblox-Style",
        originalPage: parsed.pageUrl,
        thumbnail,
        playable: true,
        embedType: "iframe",
        embedUrl: parsed.iframe,
        sourceHadEmbed: true,
        source: "crown",
        thumbnailSource,
        tags: ["roblox-style", "obby", "blocky", "parkour", "crown"],
      });
      existingTitles.add(parsed.title.toLowerCase());
      existingEmbeds.add(parsed.iframe);
      added.push(parsed.title);
    } catch (error) {
      skipped.push({ pageUrl, reason: error.message });
    }
  }

  games.sort((a, b) => {
    const cat = String(a.category || "").localeCompare(String(b.category || ""));
    if (cat) return cat;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });

  writeGames(games);
  console.log(JSON.stringify({ added: added.length, added, skipped }, null, 2));
})();
