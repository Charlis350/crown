const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const thumbDir = path.join(root, "assets", "thumbs", "classrom6x");
const SOURCE_ROOT = "https://classrom6x.gitlab.io";
const SITEMAP_URL = `${SOURCE_ROOT}/sitemap.xml`;
const OLD_CLASSROOM_PREFIX = "https://classroom-6x.io/games/";
const USER_AGENT =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1 CrownGamesRepair/1.0";

const CATEGORY_LABELS = {
  "2-players": "2 Player",
  action: "Action",
  adventure: "Adventure",
  anime: "Anime",
  arcade: "Arcade",
  car: "Driving",
  features: "Featured",
  flash: "Classic",
  idle: "Clicker",
  io: ".io",
  latest: "New",
  multiplayer: "Multiplayer",
  papas: "Cooking",
  puzzle: "Puzzle",
  racing: "Racing",
  retro: "Retro",
  running: "Running",
  shooting: "Shooting",
  simulator: "Simulation",
  sports: "Sports",
  stickman: "Action",
};

function readGames() {
  const raw = fs.readFileSync(dataFile, "utf8");
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Could not parse data/games.js");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function writeGames(games) {
  fs.writeFileSync(dataFile, `window.CROWN_GAMES = ${JSON.stringify(games, null, 2)};\n`, "utf8");
}

function curl(url, options = {}) {
  const args = [
    "--ssl-no-revoke",
    "-L",
    "--compressed",
    "--max-time",
    String(options.timeout || 35),
    "-sS",
    "-A",
    USER_AGENT,
  ];

  if (options.output) args.push("-o", options.output);
  if (options.referer) args.push("-e", options.referer);
  if (options.image) {
    args.push("-H", "Accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");
  } else {
    args.push("-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  }
  args.push(url);

  return new Promise((resolve, reject) => {
    execFile(
      "curl.exe",
      args,
      { encoding: options.output ? "utf8" : "buffer", maxBuffer: 60 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr && String(stderr).trim()) || error.message));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

async function fetchText(url, referer) {
  const buffer = await curl(url, { referer });
  return Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer);
}

function decodeEntities(value = "") {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return String(value).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1] && entity[1].toLowerCase() === "x";
      const number = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : match;
    }
    return Object.prototype.hasOwnProperty.call(named, entity) ? named[entity] : match;
  });
}

function stripTags(value = "") {
  return decodeEntities(String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function meta(html, property) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if (attr(tag, "property") === property || attr(tag, "name") === property) {
      return attr(tag, "content");
    }
  }
  return "";
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function normalizeTitle(value) {
  return decodeEntities(value)
    .toLowerCase()
    .replace(/\b(the|and|of|a|online|game|unblocked|classroom|6x)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function pageSlug(url) {
  return String(url).replace(/[?#].*$/, "").replace(/\.html$/, "").replace(/\/$/, "").split("/").pop();
}

function titleCase(value) {
  return String(value)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function parseSitemap(xml) {
  return [...xml.matchAll(/<loc>(https:\/\/classrom6x\.gitlab\.io\/game\/[^<]+)<\/loc>/g)].map((match) =>
    decodeEntities(match[1]),
  );
}

function parseGamePage(html, pageUrl) {
  if (/<title>\s*404\b/i.test(html) || /<h1>\s*404\s*<\/h1>/i.test(html)) return null;

  let iframeUrl = "";
  let bestScore = -Infinity;
  for (const match of html.matchAll(/<iframe\b[^>]*>/gi)) {
    const tag = match[0];
    const src = attr(tag, "src");
    if (!src) continue;
    let score = 0;
    if (/game-iframe|gameFrame/i.test(tag)) score += 120;
    if (/ubgwtf\.gitlab\.io|game-files|html5|gamedistribution|scratch|turbowarp/i.test(src)) score += 40;
    if (/googlesyndication|doubleclick|youtube|googlefc|wgplayer/i.test(src)) score -= 250;
    if (/display:\s*none|width=["']0|height=["']0/i.test(tag)) score -= 120;
    if (score > bestScore) {
      bestScore = score;
      iframeUrl = new URL(src, pageUrl).href;
    }
  }

  if (!iframeUrl || bestScore < 0) return null;

  const title =
    stripTags(html.match(/<h1\b[^>]*class=["'][^"']*single-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "") ||
    stripTags((html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+-\s+ClassRoom 6x\s*$/i, "")) ||
    titleCase(pageSlug(pageUrl));

  const thumbnail =
    attr(html.match(/<div\b[^>]*class=["'][^"']*header-left[^"']*["'][\s\S]*?<img\b[^>]*>/i)?.[0] || "", "src") ||
    meta(html, "og:image") ||
    `/assets/thumb/${pageSlug(pageUrl)}.webp`;

  const categories = [...html.matchAll(/href=["']\/category\/([^"']+)\.html["']/gi)].map((match) => match[1]);

  return {
    title,
    category: chooseCategory(categories),
    iframeUrl,
    pageUrl,
    slug: pageSlug(pageUrl),
    thumbnailUrl: new URL(thumbnail, SOURCE_ROOT).href,
    tags: mergeTags(title, categories),
  };
}

function chooseCategory(slugs) {
  for (const slug of slugs) {
    const label = CATEGORY_LABELS[slug];
    if (label) return label;
  }
  return "Games";
}

function mergeTags(title, slugs) {
  const tags = new Set(
    slugs
      .map((slug) => CATEGORY_LABELS[slug] || titleCase(slug))
      .filter(Boolean)
      .slice(0, 8),
  );
  if (/minecraft|block|mine|craft/i.test(title)) tags.add("Minecraft");
  if (/roblox|obby|parkour|noob/i.test(title)) tags.add("Roblox-Style");
  return [...tags];
}

function extensionFromUrl(url) {
  const clean = String(url).replace(/[?#].*$/, "");
  const ext = path.extname(clean).toLowerCase();
  return [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"].includes(ext) ? ext : ".webp";
}

function isValidImageFile(file) {
  if (!fs.existsSync(file)) return false;
  const buffer = fs.readFileSync(file);
  if (buffer.length < 8) return false;
  const head = buffer.slice(0, 16).toString("hex");
  const textHead = buffer.slice(0, 128).toString("utf8").trim().toLowerCase();
  return (
    head.startsWith("ffd8ff") ||
    head.startsWith("89504e470d0a1a0a") ||
    head.startsWith("52494646") ||
    textHead.startsWith("<svg")
  );
}

async function saveThumbnail(thumbnailUrl, id, referer) {
  if (!thumbnailUrl) return "";
  fs.mkdirSync(thumbDir, { recursive: true });
  const relative = `assets/thumbs/classrom6x/${id}${extensionFromUrl(thumbnailUrl)}`;
  const absolute = path.join(root, relative);
  if (isValidImageFile(absolute)) return relative;

  try {
    await curl(thumbnailUrl, { output: absolute, image: true, referer, timeout: 30 });
    if (isValidImageFile(absolute)) return relative;
  } catch (error) {
    fs.rmSync(absolute, { force: true });
  }
  return "";
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
        console.log(`Scanned ${completed}/${items.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}

function isOldClassroomGame(game) {
  return (
    game.source === "classroom6x" ||
    game.classroom6xPage ||
    String(game.embedUrl || "").startsWith(OLD_CLASSROOM_PREFIX)
  );
}

function isDirectOldClassroomIframe(game) {
  return String(game.embedUrl || "").startsWith(OLD_CLASSROOM_PREFIX);
}

function sortGames(games) {
  return games.sort((a, b) => {
    const category = String(a.category || "").localeCompare(String(b.category || ""));
    if (category) return category;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

async function main() {
  const games = readGames();
  const sitemapPages = parseSitemap(await fetchText(SITEMAP_URL, SOURCE_ROOT));
  const parsedByKey = new Map();
  const parsedBySlug = new Map();
  const failedPages = [];

  await mapLimit(sitemapPages, 10, async (pageUrl) => {
    try {
      const html = await fetchText(pageUrl, SOURCE_ROOT);
      const parsed = parseGamePage(html, pageUrl);
      if (!parsed) return;
      parsedByKey.set(normalizeTitle(parsed.title), parsed);
      parsedBySlug.set(parsed.slug, parsed);
    } catch (error) {
      failedPages.push({ pageUrl, error: error.message });
    }
  });

  let updated = 0;
  let removedBroken = 0;
  const kept = [];
  const existingKeys = new Set();

  for (const game of games) {
    const slug = slugify(game.title || game.id);
    const parsed = parsedByKey.get(normalizeTitle(game.title || "")) || parsedBySlug.get(slug);

    if (isOldClassroomGame(game)) {
      if (!parsed) {
        removedBroken += 1;
        continue;
      }

      game.embedType = "iframe";
      game.embedUrl = parsed.iframeUrl;
      game.playable = true;
      game.mobileReady = true;
      game.source = "classrom6x";
      game.originalPage = parsed.pageUrl;
      game.classrom6xPage = parsed.pageUrl;
      delete game.classroom6xPage;
      delete game.classroom6xMirror;
      delete game.embedPath;
      delete game.unsupportedReason;
      if (!game.category || game.category === "Games") game.category = parsed.category;
      game.tags = [...new Set([...(game.tags || []), ...parsed.tags])].slice(0, 12);
      const thumb = await saveThumbnail(parsed.thumbnailUrl, game.id, parsed.pageUrl);
      if (thumb) {
        game.thumbnail = thumb;
        game.thumbnailSource = "classrom6x-local";
      }
      updated += 1;
    }

    kept.push(game);
    existingKeys.add(normalizeTitle(game.title || ""));
  }

  const imported = [];
  for (const parsed of parsedByKey.values()) {
    const key = normalizeTitle(parsed.title);
    if (!key || existingKeys.has(key)) continue;

    const id = `classrom6x-${slugify(parsed.title)}`;
    const thumb = await saveThumbnail(parsed.thumbnailUrl, id, parsed.pageUrl);
    imported.push({
      id,
      title: parsed.title,
      category: parsed.category,
      thumbnail: thumb || parsed.thumbnailUrl,
      embedType: "iframe",
      embedUrl: parsed.iframeUrl,
      playable: true,
      source: "classrom6x",
      tags: parsed.tags,
      mobileReady: true,
      thumbnailSource: thumb ? "classrom6x-local" : "classrom6x-remote",
      originalPage: parsed.pageUrl,
      classrom6xPage: parsed.pageUrl,
    });
    existingKeys.add(key);
  }

  const finalGames = sortGames(
    [...kept, ...imported].filter((game) => !isDirectOldClassroomIframe(game)),
  );
  writeGames(finalGames);

  console.log(
    JSON.stringify(
      {
        scannedPages: sitemapPages.length,
        usablePages: parsedByKey.size,
        updatedClassroomEntries: updated,
        importedNewEntries: imported.length,
        removedBrokenClassroomEntries: removedBroken,
        failedPages: failedPages.length,
        total: finalGames.length,
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
