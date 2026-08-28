const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const interstellarRoot =
  process.env.INTERSTELLAR_ROOT || path.join(process.env.TEMP || process.env.TMP || "", "Interstellar");
const interstellarStatic = path.join(interstellarRoot, "static");
const appJsonPath = path.join(interstellarStatic, "assets", "json", "a.json");
const gameJsonPath = path.join(interstellarStatic, "assets", "json", "g.json");
const appIconDir = path.join(repoRoot, "assets", "interstellar-app-icons");
const gameIconDir = path.join(repoRoot, "assets", "thumbs", "interstellar-icons");
const catalogPath = path.join(repoRoot, "apps", "catalog.js");
const gamesPath = path.join(repoRoot, "data", "games.js");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function normalize(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(the|game|games|online|play)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function titleCaseCategory(category) {
  const map = {
    "2p": "2 Player",
    "2d": "2D",
    action: "Action",
    adventure: "Adventure",
    ai: "AI",
    all: "All",
    android: "Android",
    arcade: "Arcade",
    cloud: "Cloud",
    emu: "Emulator",
    game: "Game Sites",
    mail: "Mail",
    media: "Media",
    message: "Message",
    puzzle: "Puzzle",
    racing: "Racing",
    shooter: "Shooting",
    shooting: "Shooting",
    social: "Social",
    sports: "Sports",
    stream: "Streaming",
    tool: "Tools",
  };
  const key = String(category || "").toLowerCase();
  return map[key] || String(category || "Games").replace(/\b\w/g, (char) => char.toUpperCase());
}

function localMediaPath(image, outDir, prefix) {
  if (!image || /^https?:/i.test(image)) return "";
  const cleanImage = image.replace(/^\/+/, "");
  const sourcePath = path.join(interstellarStatic, cleanImage);
  if (!fs.existsSync(sourcePath)) return "";
  fs.mkdirSync(outDir, { recursive: true });
  const ext = path.extname(sourcePath) || ".webp";
  const fileName = `${slug(prefix)}${ext}`;
  const outPath = path.join(outDir, fileName);
  fs.copyFileSync(sourcePath, outPath);
  return path.relative(repoRoot, outPath).replace(/\\/g, "/");
}

function fallbackLogo(outDir, title) {
  fs.mkdirSync(outDir, { recursive: true });
  const letters = String(title)
    .replace(/[^a-z0-9 ]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "C";
  const fileName = `${slug(title)}.svg`;
  const outPath = path.join(outDir, fileName);
  const safeTitle = String(title).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[char]);
  fs.writeFileSync(
    outPath,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${safeTitle}"><rect width="256" height="256" rx="38" fill="#2f2f2f"/><circle cx="196" cy="58" r="34" fill="#8b5cf6" opacity=".9"/><circle cx="62" cy="200" r="52" fill="#ffd447" opacity=".9"/><text x="128" y="143" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="72" font-weight="900" fill="#fff">${letters}</text><text x="128" y="190" text-anchor="middle" font-family="Arial, sans-serif" font-size="19" font-weight="800" fill="#d7d2e4">${safeTitle.slice(0, 20)}</text></svg>\n`
  );
  return path.relative(repoRoot, outPath).replace(/\\/g, "/");
}

function readGames() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(gamesPath, "utf8"), sandbox);
  return sandbox.window.CROWN_GAMES || [];
}

function writeGames(games) {
  fs.writeFileSync(gamesPath, `window.CROWN_GAMES = ${JSON.stringify(games, null, 2)};\n`);
}

function appUrl(app) {
  if (app.link) return app.link;
  if (Array.isArray(app.links) && app.links.length) return app.links[0].url;
  return "";
}

function appDescription(app) {
  const categories = (app.categories || [])
    .filter((category) => category !== "all")
    .map(titleCaseCategory);
  const label = categories.length ? categories.slice(0, 2).join(" / ") : "App";
  return `WIP ${label} launcher.`;
}

function convertApps() {
  const sourceApps = readJson(appJsonPath);
  const blocked = new Set(["! Interstellar FAQ/Docs", "! [NEW] Request An App"]);
  const apps = sourceApps
    .filter((app) => !blocked.has(app.name))
    .map((app) => {
      const cleanTitle = app.name.replace(/^!\s*/, "");
      const id = app.custom === "true" ? "create" : slug(cleanTitle);
      const logo = localMediaPath(app.image, appIconDir, cleanTitle) || fallbackLogo(appIconDir, cleanTitle);
      const converted = {
        id,
        title: cleanTitle,
        description:
          app.custom === "true"
            ? "Build a local Crown app card on this device."
            : appDescription(app),
        icon: cleanTitle.slice(0, 2).toUpperCase(),
        colors: ["#2f2f2f", "#555555"],
        status: app.custom === "true" ? "Ready" : "WIP",
        logo,
      };
      if (app.custom === "true") {
        converted.localTool = "create";
      } else {
        converted.url = appUrl(app);
        converted.categories = (app.categories || []).filter((category) => category !== "all").map(titleCaseCategory);
      }
      return converted;
    });

  fs.writeFileSync(catalogPath, `window.CROWN_APPS = ${JSON.stringify(apps, null, 2)};\n`);
  return apps;
}

function convertGames() {
  const interstellarGames = readJson(gameJsonPath)
    .filter((game) => game.name && game.link && game.image)
    .filter((game) => !/^!/.test(game.name));
  const games = readGames();
  const byKey = new Map(games.map((game, index) => [normalize(game.title), { game, index }]));
  const byId = new Set(games.map((game) => game.id));
  let updatedIcons = 0;
  let addedGames = 0;

  for (const source of interstellarGames) {
    const key = normalize(source.name);
    const thumbnail = localMediaPath(source.image, gameIconDir, source.name);
    if (!thumbnail) continue;
    const match = byKey.get(key);
    if (match) {
      if (match.game.thumbnail !== thumbnail) {
        match.game.thumbnail = thumbnail;
        match.game.thumbnailSource = "interstellar-local";
        updatedIcons++;
      }
      if (!match.game.embedPath && source.link && /^https?:/i.test(source.link)) {
        match.game.embedType = "iframe";
        match.game.embedUrl = source.link;
      }
      continue;
    }

    const idBase = `crown-${slug(source.name)}`;
    let id = idBase;
    let suffix = 2;
    while (byId.has(id)) id = `${idBase}-${suffix++}`;
    byId.add(id);

    const categories = (source.categories || []).filter((category) => category !== "all").map(titleCaseCategory);
    const category = categories[0] || "Games";
    games.push({
      id,
      title: source.name,
      category,
      thumbnail,
      embedType: "iframe",
      embedUrl: source.link,
      playable: true,
      source: "crown",
      thumbnailSource: "interstellar-local",
      tags: categories,
    });
    byKey.set(key, { game: games[games.length - 1], index: games.length - 1 });
    addedGames++;
  }

  games.sort((a, b) => a.title.localeCompare(b.title));
  writeGames(games);
  return { updatedIcons, addedGames, totalGames: games.length };
}

if (!fs.existsSync(appJsonPath) || !fs.existsSync(gameJsonPath)) {
  throw new Error(`Interstellar source was not found at ${interstellarRoot}`);
}

const apps = convertApps();
const gameStats = convertGames();
console.log(JSON.stringify({ apps: apps.length, ...gameStats }, null, 2));
