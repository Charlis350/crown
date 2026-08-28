const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const gamesPath = path.join(repoRoot, "data", "games.js");
const thumbsRoot = path.join(repoRoot, "assets", "thumbs");

function toAssetPath(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const output = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      output.push(...walk(fullPath));
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      output.push(fullPath);
    }
  }

  return output;
}

function loadGames() {
  const source = fs.readFileSync(gamesPath, "utf8");
  const sandbox = { window: {} };
  vm.runInNewContext(source, sandbox);
  return sandbox.window.CROWN_GAMES;
}

function saveGames(games) {
  const next = `window.CROWN_GAMES = ${JSON.stringify(games, null, 2)};\n`;
  fs.writeFileSync(gamesPath, next);
}

function candidateScore(gameSlug, titleWords, file) {
  const assetPath = toAssetPath(file);
  const normalizedPath = assetPath.replace(/\\/g, "/");
  const baseSlug = slugify(path.basename(file, path.extname(file)));

  if (normalizedPath.includes("/crown-covers/")) return -100;
  if (normalizedPath.includes("/generated/")) return -90;
  if (normalizedPath.includes("/title-covers")) return -80;
  if (baseSlug === gameSlug) return 1000;
  if (baseSlug.startsWith(`${gameSlug}-`)) return 900;
  if (baseSlug === `class6x-${gameSlug}` || baseSlug.startsWith(`class6x-${gameSlug}-`)) return 875;
  if (baseSlug === `pizzaedition-${gameSlug}` || baseSlug.startsWith(`pizzaedition-${gameSlug}-`)) return 860;
  if (baseSlug.includes(gameSlug) && gameSlug.length > 5) return 780;

  const fileWords = new Set(baseSlug.split("-").filter(Boolean));
  const titleWordList = [...titleWords].filter((word) => word.length > 1);
  const matchedWords = titleWordList.filter((word) => fileWords.has(word));
  if (!matchedWords.length) return -1;

  const coverage = matchedWords.length / Math.max(titleWordList.length, 1);
  let score = Math.round(coverage * 500);

  const preferredDirs = [
    "/embedded/",
    "/captures/",
    "/drive/",
    "/interstellar-icons/",
    "/class6x/",
    "/pizzaedition/",
    "/roblox-style/",
  ];
  const dirBoost = preferredDirs.findIndex((dir) => normalizedPath.includes(dir));
  if (dirBoost >= 0) score += 90 - dirBoost * 5;

  return coverage >= 0.67 ? score : -1;
}

const manualOverrides = {
  "100-rooms-of-enemies": "assets/thumbs/interstellar-icons/100-rooms-of-enemies.webp",
  "60-second-burger-run": "assets/thumbs/interstellar-icons/60-sec-burger-run.webp",
  "99-nights-in-the-forest": "assets/thumbs/embedded/99-nights-in-the-forest-https-sites-google-com-lindberghschools-ws-crown-officia.png",
  "angry-birds": "assets/thumbs/embedded/angry-birds-https-sites-google-com-lindberghschools-ws-crown-official-angry-bird.png",
  "animal-crossing": "assets/thumbs/embedded/animal-crossing-https-sites-google-com-lindberghschools-ws-crown-official-animal-cros.png",
  "asteroids": "assets/thumbs/embedded/asteroids-https-sites-google-com-lindberghschools-ws-crown-official-asteroids.png",
  "baby-sniper-in-vietnam": "assets/thumbs/embedded/baby-sniper-in-vietnam-https-sites-google-com-lindberghschools-ws-crown-official.png",
  "baldie-caesoh": "assets/thumbs/captures/baldie-caesoh-https-sites-google-com-lindberghschools-ws-crown-official-baldie-ca.png",
  "baldy-s-basics": "assets/thumbs/interstellar-icons/five-nights-at-winston-s.webp",
  "ballon-tower-defense-4": "assets/thumbs/embedded/ballon-tower-defense-4-https-sites-google-com-lindberghschools-ws-crown-officia.png",
  "binding-of-isacc": "assets/thumbs/embedded/binding-of-isacc-https-sites-google-com-lindberghschools-ws-crown-official-bindin.png",
  "bloons-tower-defense-4": "assets/thumbs/embedded/bloons-tower-defense-4-https-sites-google-com-lindberghschools-ws-crown-officia.png",
  "bmx2": "assets/thumbs/embedded/bmx2-https-sites-google-com-lindberghschools-ws-crown-official-bmx2.png",
  "car-king-arena-best-car-game": "assets/thumbs/embedded/car-king-arena-best-car-game-https-sites-google-com-lindberghschools-ws-crown.png",
  "crazy-climber": "assets/thumbs/embedded/crazy-climber-https-sites-google-com-lindberghschools-ws-crown-official-crazy-cli.png",
  "curve-ball-v1": "assets/thumbs/embedded/curve-ball-v1-https-sites-google-com-lindberghschools-ws-crown-official-curve-ba.png",
  "diablo": "assets/thumbs/embedded/diablo-https-sites-google-com-lindberghschools-ws-crown-official-diablo.png",
  "dig-to-china": "assets/thumbs/embedded/dig-to-china-https-sites-google-com-lindberghschools-ws-crown-official-dig-to.png",
  "doom-64": "assets/thumbs/interstellar-icons/doom.webp",
  "edge-surf": "assets/thumbs/embedded/edge-surf-https-sites-google-com-lindberghschools-ws-crown-official-edge-surf.png",
  "fifa-2k": "assets/thumbs/embedded/fifa-2k-https-sites-google-com-lindberghschools-ws-crown-official-fifa-2k.png",
  "five-nights-at-freedy-s": "assets/thumbs/embedded/five-nights-at-freedys-https-sites-google-com-lindberghschools-ws-crown-offici.png",
  "fnaf": "assets/thumbs/interstellar-icons/fnaf-web.webp",
  "fnf": "assets/thumbs/interstellar-icons/friday-night-funkin.webp",
  "gorilla-tag": "assets/thumbs/embedded/gorilla-tag-https-sites-google-com-lindberghschools-ws-crown-official-gorilla.png",
  "gta": "assets/thumbs/embedded/gta-https-sites-google-com-lindberghschools-ws-crown-official-gta.png",
  "happy-wheels": "assets/thumbs/interstellar-icons/happy-wheels.webp",
  "hollow-knight": "assets/thumbs/embedded/hollow-knight-https-sites-google-com-lindberghschools-ws-crown-official-hollow.png",
  "idle-miner": "assets/thumbs/embedded/idle-miner-https-sites-google-com-lindberghschools-ws-crown-official-idle-miner.png",
  "kirby-64": "assets/thumbs/embedded/kirby-64-https-sites-google-com-lindberghschools-ws-crown-official-kirby-64.png",
  "kirby-adventure-remake-katam": "assets/thumbs/embedded/kirby-adventure-remakekatam-https-sites-google-com-lindberghschools-ws-crown.png",
  "kirby-squeak-squad": "assets/thumbs/embedded/kirby-squeak-squad-https-sites-google-com-lindberghschools-ws-crown-official.png",
  "koopas-revenge-2": "assets/thumbs/embedded/koopas-revenge-2-https-sites-google-com-lindberghschools-ws-crown-official-koo.png",
  "lego-batman-1": "assets/thumbs/logos/lego-batman-1.jpg",
  "lego-batman-2": "assets/thumbs/logos/lego-batman-2.jpg",
  "lego-indiana-jones": "assets/thumbs/logos/lego-indiana-jones.jpg",
  "lego-indiana-jones-2": "assets/thumbs/logos/lego-indiana-jones-2.jpg",
  "lego-ninjago": "assets/thumbs/logos/lego-ninjago.jpg",
  "lego-starwars": "assets/thumbs/logos/lego-starwars.jpg",
  "mario-party-ds": "assets/thumbs/embedded/mario-party-ds-https-sites-google-com-lindberghschools-ws-crown-official-mario.png",
  "melon-playground": "assets/thumbs/interstellar-icons/melon-playground.webp",
  "monkey-mart": "assets/thumbs/interstellar-icons/monkey-mart.webp",
  "my-friend-pedro": "assets/thumbs/embedded/my-friend-pedro-https-sites-google-com-lindberghschools-ws-crown-official-my.png",
  "omega-nugget-clicker": "assets/thumbs/embedded/omega-nugget-clicker-https-sites-google-com-lindberghschools-ws-crown-official.png",
  "plants-vs-zombies": "assets/thumbs/embedded/plants-vs-zombies-https-sites-google-com-lindberghschools-ws-crown-official.png",
  "pokemon-emerald": "assets/thumbs/logos/pokemon-emerald.jpg",
  "pokemon-randomizer": "assets/thumbs/logos/pokemon-randomizer.jpg",
  "quake-arena": "assets/thumbs/embedded/quake-arena-https-sites-google-com-lindberghschools-ws-crown-official-quake-are.png",
  "rainbow-tower": "assets/thumbs/interstellar-icons/rainbow-tower.webp",
  "rocket-league": "assets/thumbs/interstellar-icons/2d-rocket-league.webp",
  "russian-car-driver": "assets/thumbs/embedded/russian-car-driver-https-sites-google-com-lindberghschools-ws-crown-official.png",
  "skibidi-toilet-sim": "assets/thumbs/embedded/skibidi-toilet-sim-https-sites-google-com-lindberghschools-ws-crown-official.png",
  "slope": "assets/thumbs/interstellar-icons/slope.webp",
  "slow-roads": "assets/thumbs/embedded/slow-roads-https-sites-google-com-lindberghschools-ws-crown-official-slow-roads.png",
  "snow-rider-3d": "assets/thumbs/interstellar-icons/snow-rider-3d.webp",
  "sonic": "assets/thumbs/embedded/sonic-https-sites-google-com-lindberghschools-ws-crown-official-sonic.png",
  "subways-surfers-beijing": "assets/thumbs/embedded/subways-surfers-beijing-https-sites-google-com-lindberghschools-ws-crown-officia.png",
  "the-impossible-quiz-2": "assets/thumbs/interstellar-icons/the-impossible-quiz-book-2.webp",
  "ultimate-mortal-combat": "assets/thumbs/embedded/ultimate-mortal-combat-https-sites-google-com-lindberghschools-ws-crown-official.png",
};

const games = loadGames();
const imageFiles = walk(thumbsRoot);
const imageRecords = imageFiles.map((file) => ({
  file,
  assetPath: toAssetPath(file),
}));

const missingManual = [];
let replaced = 0;

for (const game of games) {
  const currentThumb = game.thumbnail || "";
  if (game.thumbnailSource !== "crown" && !currentThumb.includes("crown-covers")) continue;

  const gameSlug = slugify(game.title);
  let nextThumbnail = manualOverrides[gameSlug];

  if (nextThumbnail) {
    const fullPath = path.join(repoRoot, nextThumbnail);
    if (!fs.existsSync(fullPath)) {
      missingManual.push(`${game.title}: ${nextThumbnail}`);
      nextThumbnail = "";
    }
  }

  if (!nextThumbnail) {
    const titleWords = new Set(gameSlug.split("-").filter(Boolean));
    let best = null;
    for (const record of imageRecords) {
      const score = candidateScore(gameSlug, titleWords, record.file);
      if (score < 0) continue;
      if (!best || score > best.score) best = { ...record, score };
    }
    if (best) nextThumbnail = best.assetPath;
  }

  if (nextThumbnail && nextThumbnail !== game.thumbnail) {
    game.thumbnail = nextThumbnail;
    game.thumbnailSource = "local-logo";
    replaced += 1;
  }
}

saveGames(games);

const unresolved = games
  .filter((game) => game.thumbnailSource === "crown" || String(game.thumbnail || "").includes("crown-covers"))
  .map((game) => game.title);

console.log(
  JSON.stringify(
    {
      replaced,
      unresolved: unresolved.length,
      missingManual,
      unresolvedTitles: unresolved,
    },
    null,
    2,
  ),
);
