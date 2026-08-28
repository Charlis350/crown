const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const thumbDir = path.join(root, "assets", "thumbs", "classroom6x");
const generatedThumbDir = path.join(root, "assets", "thumbs", "generated");

const CLASSROOM_ROOT = "https://classroom-6x.io/";
const HOME_URL = new URL("/home/", CLASSROOM_ROOT).href;
const SITEMAP_URL = new URL("/sitemap.xml", CLASSROOM_ROOT).href;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CrownGamesImporter/3.0";

const CATEGORY_LABELS = {
  "2-player": "2 Player",
  "2d": "2D",
  "3d": "3D",
  action: "Action",
  adventure: "Adventure",
  arcade: "Arcade",
  ball: "Sports",
  baseball: "Sports",
  basketball: "Sports",
  bike: "Racing",
  brain: "Puzzle",
  car: "Racing",
  casual: "Casual",
  classic: "Classic",
  clicker: "Clicker",
  cooking: "Cooking",
  driving: "Driving",
  fighting: "Fighting",
  football: "Sports",
  gun: "Shooting",
  horror: "Horror",
  html5: "HTML5",
  idle: "Idle",
  io: ".io",
  logic: "Puzzle",
  management: "Management",
  minecraft: "Minecraft",
  multiplayer: "Multiplayer",
  physics: "Physics",
  pixel: "Pixel",
  plane: "Plane",
  platform: "Platform",
  puzzle: "Puzzle",
  racing: "Racing",
  ragdoll: "Ragdoll",
  running: "Running",
  shooting: "Shooting",
  simulation: "Simulation",
  soccer: "Sports",
  sports: "Sports",
  stickman: "Stickman",
  strategy: "Strategy",
  survival: "Survival",
  tank: "Tank",
  "tower-defense": "Strategy",
  truck: "Driving",
  tycoon: "Tycoon",
  war: "War",
  zombie: "Zombie",
};

const CATEGORY_PRIORITY = [
  "minecraft",
  "multiplayer",
  "2-player",
  "shooting",
  "action",
  "adventure",
  "racing",
  "car",
  "driving",
  "sports",
  "puzzle",
  "platform",
  "running",
  "clicker",
  "idle",
  "io",
  "stickman",
  "simulation",
  "strategy",
  "arcade",
  "classic",
  "html5",
  "casual",
  "unblocked-games-online",
];

function curl(url, options = {}) {
  const args = [
    "--ssl-no-revoke",
    "-L",
    "--compressed",
    "--max-time",
    String(options.timeout || 45),
    "-sS",
    "-A",
    USER_AGENT,
  ];

  if (options.output) args.push("-o", options.output);
  if (options.referer) args.push("-e", options.referer);
  if (options.image) {
    args.push("-H", "Accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");
  }
  args.push(url);

  return new Promise((resolve, reject) => {
    execFile(
      "curl.exe",
      args,
      { encoding: options.output ? "utf8" : "buffer", maxBuffer: 30 * 1024 * 1024 },
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

async function fetchText(url) {
  const buffer = await curl(url);
  return Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer);
}

function readGames() {
  const raw = fs.readFileSync(dataFile, "utf8");
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1) throw new Error("Could not parse data/games.js");
  return JSON.parse(raw.slice(start, end + 1));
}

function writeGames(games) {
  fs.writeFileSync(
    dataFile,
    "window.CROWN_GAMES = " + JSON.stringify(games, null, 2) + ";\n",
    "utf8",
  );
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

function attr(source, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  return decodeEntities(source.match(pattern)?.[1] || "");
}

function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta\\b[^>]*(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta\\b[^>]*content=["'][^"']*["'][^>]*(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const tag = html.match(pattern)?.[0] || "";
    const value = attr(tag, "content");
    if (value) return value;
  }
  return "";
}

function stripTags(value) {
  return decodeEntities(String(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function normalizeTitle(value) {
  return decodeEntities(value)
    .toLowerCase()
    .replace(/\b(the|and|of|a|online|game|unblocked)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function titleCase(value) {
  return String(value)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function categorySlug(url) {
  return String(url).match(/\/category\/([^/?#]+)\//i)?.[1] || "";
}

function pageSlug(url) {
  return String(url).replace(/[?#].*$/, "").replace(/\/$/, "").split("/").pop();
}

function parseSitemap(xml) {
  const urls = [...xml.matchAll(/<loc>(https:\/\/classroom-6x\.io\/[^<]+)<\/loc>/g)].map(
    (match) => decodeEntities(match[1]),
  );
  return {
    categories: urls.filter((url) => /\/category\/[^/]+\/$/i.test(url)),
    games: urls.filter((url) => /\/game\/[^/]+\/$/i.test(url)),
  };
}

function parseCategoryCards(html, categoryUrl) {
  const category = categorySlug(categoryUrl);
  const cards = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']*\/game\/[^"']+)["'][^>]*>[\s\S]*?<div class=["'][^"']*list-game[^"']*["'][\s\S]*?<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    const segment = match[0];
    const href = decodeEntities(match[1]);
    const title = attr(segment, "title") || attr(segment, "alt");
    const img = segment.match(/<img\b[^>]*>/i)?.[0] || "";
    const thumb = attr(img, "data-src") || attr(img, "src");
    if (!href) continue;
    cards.push({
      pageUrl: new URL(href, CLASSROOM_ROOT).href,
      title: stripTags(title),
      thumbnailUrl: cleanThumbnailUrl(thumb),
      categories: category ? [category] : [],
    });
  }
  return cards;
}

function cleanThumbnailUrl(url) {
  if (!url || /thumb-placeholder/i.test(url)) return "";
  return new URL(url, CLASSROOM_ROOT).href;
}

function parseGamePage(html, url) {
  const title =
    decodeEntities(
      meta(html, "og:title").replace(/\s+-\s+(?:Classroom 6x|Free Online Games)\s*$/i, ""),
    ) ||
    stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "") ||
    titleCase(pageSlug(url));
  const thumbnailUrl = cleanThumbnailUrl(meta(html, "og:image") || meta(html, "twitter:image:src"));
  const iframe = parseExactIframe(html);
  return { title, thumbnailUrl, embedUrl: iframe };
}

function parseExactIframe(html) {
  const frames = [];
  for (const match of html.matchAll(/<iframe\b[^>]*>/gi)) {
    const tag = match[0];
    const src = attr(tag, "src");
    if (!src) continue;

    let score = 0;
    const lower = tag.toLowerCase();
    if (/class=["'][^"']*game-iframe/i.test(tag)) score += 140;
    if (/id=["']game-area["']/i.test(tag)) score += 100;
    if (/\/games\//i.test(src)) score += 40;
    if (/classroom-6x\.io/i.test(src)) score += 25;
    if (/youtube|googlesyndication|fundingchoices|googlefc/i.test(src)) score -= 250;
    if (/width=["']0["']|height=["']0["']|z-index:\s*-|left:\s*-1000|display:\s*none/i.test(lower)) {
      score -= 250;
    }
    if (/\.(?:png|jpe?g|gif|webp|css|js)(?:[?#].*)?$/i.test(src)) score -= 100;
    frames.push({ src, score });
  }

  frames.sort((a, b) => b.score - a.score);
  if (!frames.length || frames[0].score <= 0) return "";
  return new URL(frames[0].src, CLASSROOM_ROOT).href;
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return results;
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
    head.startsWith("47494638") ||
    textHead.startsWith("<svg")
  );
}

async function saveImage(url, fileBase, referer = CLASSROOM_ROOT) {
  if (!url) return "";
  fs.mkdirSync(thumbDir, { recursive: true });
  const extension = path.extname(new URL(url).pathname).match(/^\.(?:jpg|jpeg|png|webp|gif|svg)$/i)
    ? path.extname(new URL(url).pathname).toLowerCase()
    : ".jpg";
  const relative = `assets/thumbs/classroom6x/${fileBase}${extension}`;
  const output = path.join(root, relative);
  if (isValidImageFile(output)) return relative.replace(/\\/g, "/");

  try {
    await curl(url, { output, timeout: 45, referer, image: true });
    if (isValidImageFile(output)) return relative.replace(/\\/g, "/");
    fs.rmSync(output, { force: true });
  } catch (error) {
    fs.rmSync(output, { force: true });
  }
  return "";
}

function escapeXml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
  });
}

function generatedThumb(title, fileBase) {
  fs.mkdirSync(generatedThumbDir, { recursive: true });
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0].toUpperCase())
    .join("");
  const hue = [...title].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${hue},80%,58%)"/>` +
    `<stop offset="1" stop-color="hsl(${(hue + 90) % 360},88%,48%)"/>` +
    `</linearGradient></defs>` +
    `<rect width="512" height="512" rx="86" fill="#101423"/>` +
    `<rect x="22" y="22" width="468" height="468" rx="72" fill="url(#g)" opacity=".92"/>` +
    `<path d="M255 80l42 86 95 14-69 67 16 95-84-44-84 44 16-95-69-67 95-14z" fill="#ffe269" stroke="#15151f" stroke-width="16"/>` +
    `<rect x="116" y="240" width="280" height="118" rx="18" fill="#fff5c4" stroke="#15151f" stroke-width="14"/>` +
    `<text x="256" y="316" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="56" fill="#15151f">${escapeXml(initials)}</text>` +
    `<text x="256" y="424" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#fff" font-weight="700">${escapeXml(title.slice(0, 24))}</text>` +
    `</svg>`;
  const relative = `assets/thumbs/generated/${fileBase}.svg`;
  fs.writeFileSync(path.join(root, relative), svg, "utf8");
  return relative;
}

function chooseCategory(slugs) {
  const unique = [...new Set(slugs.filter(Boolean))];
  if (!unique.length) return "Games";
  const selected =
    CATEGORY_PRIORITY.find((slug) => unique.includes(slug)) ||
    unique.find((slug) => slug !== "unblocked-games-online") ||
    unique[0];
  return CATEGORY_LABELS[selected] || titleCase(selected);
}

function mergeTags(title, categorySlugs) {
  const tags = new Set(categorySlugs.map((slug) => titleCase(slug)).filter(Boolean));
  if (/roblox|obby|minecraft|eagler|noob|block|parkour|craft|mine/i.test(title)) {
    tags.add("Roblox-Style");
    tags.add("Minecraft");
  }
  tags.add("Classroom 6x");
  return [...tags].slice(0, 8);
}

function isOldClass6xGame(game) {
  return Boolean(
    game.source === "class6x" ||
      game.source === "classroom6x" ||
      game.class6xPage ||
      game.classroom6xPage ||
      /^https:\/\/class6x\.gitlab\.io\//i.test(game.embedUrl || ""),
  );
}

function sortGames(games) {
  const categoryOrder = new Map(
    [
      "Featured",
      "Games",
      "2 Player",
      "3D",
      "Action",
      "Adventure",
      "Minecraft",
      "Racing",
      "Driving",
      "Puzzle",
      "Shooting",
      "Sports",
      "Skill",
      "Multiplayer",
      "Arcade",
      "Classic",
      "Clicker",
      "Idle",
      "Platform",
      "Stickman",
      "Strategy",
      "Simulation",
      ".io",
      "Apps",
    ].map((category, index) => [category, index]),
  );
  return games.sort((a, b) => {
    const left = categoryOrder.get(a.category) ?? 999;
    const right = categoryOrder.get(b.category) ?? 999;
    if (left !== right) return left - right;
    return String(a.title).localeCompare(String(b.title));
  });
}

async function importClassroom6x() {
  const games = readGames();
  const oldCount = games.filter(isOldClass6xGame).length;
  const kept = games.filter((game) => !isOldClass6xGame(game));
  const existingKeys = new Set(kept.map((game) => normalizeTitle(game.title)));

  fs.mkdirSync(thumbDir, { recursive: true });
  fs.mkdirSync(generatedThumbDir, { recursive: true });

  const sitemap = parseSitemap(await fetchText(SITEMAP_URL));
  const categoryMap = new Map();
  const cardMeta = new Map();

  const categoryPages = [HOME_URL, ...sitemap.categories];
  await mapLimit(categoryPages, 8, async (url) => {
    try {
      const html = await fetchText(url);
      for (const card of parseCategoryCards(html, url)) {
        const existing = cardMeta.get(card.pageUrl) || {
          pageUrl: card.pageUrl,
          title: card.title,
          thumbnailUrl: card.thumbnailUrl,
          categories: [],
        };
        if (!existing.title && card.title) existing.title = card.title;
        if (!existing.thumbnailUrl && card.thumbnailUrl) existing.thumbnailUrl = card.thumbnailUrl;
        existing.categories.push(...card.categories);
        cardMeta.set(card.pageUrl, existing);

        const slugs = categoryMap.get(card.pageUrl) || [];
        slugs.push(...card.categories);
        categoryMap.set(card.pageUrl, slugs);
      }
    } catch (error) {
      console.warn(`Category skipped: ${url} (${error.message})`);
    }
  });

  const imported = [];
  const skipped = { duplicate: 0, noEmbed: 0, fetchFailed: 0 };

  await mapLimit(sitemap.games, 10, async (pageUrl, index) => {
    try {
      const html = await fetchText(pageUrl);
      const parsed = parseGamePage(html, pageUrl);
      const card = cardMeta.get(pageUrl) || {};
      const title = stripTags(parsed.title || card.title || titleCase(pageSlug(pageUrl)));
      const key = normalizeTitle(title);
      if (!key || existingKeys.has(key)) {
        skipped.duplicate += 1;
        return;
      }
      if (!parsed.embedUrl) {
        skipped.noEmbed += 1;
        return;
      }

      const id = `classroom6x-${slugify(title || pageSlug(pageUrl))}`;
      const categorySlugs = [...(categoryMap.get(pageUrl) || []), ...(card.categories || [])];
      const thumbUrl = parsed.thumbnailUrl || card.thumbnailUrl;
      const thumb =
        (await saveImage(thumbUrl, id, pageUrl)) || generatedThumb(title, `${id}-generated`);

      existingKeys.add(key);
      imported.push({
        id,
        title,
        category: chooseCategory(categorySlugs),
        thumbnail: thumb,
        embedType: "iframe",
        embedUrl: parsed.embedUrl,
        playable: true,
        source: "classroom6x",
        tags: mergeTags(title, categorySlugs),
        mobileReady: true,
        thumbnailSource: thumb.includes("/generated/") ? "generated" : "classroom6x",
        originalPage: pageUrl,
        classroom6xPage: pageUrl,
      });

      if ((index + 1) % 50 === 0) {
        console.log(`Imported ${imported.length}/${index + 1} scanned...`);
      }
    } catch (error) {
      skipped.fetchFailed += 1;
    }
  });

  const finalGames = sortGames([...kept, ...imported]);
  writeGames(finalGames);

  console.log(
    JSON.stringify(
      {
        removedOldClass6x: oldCount,
        importedClassroom6x: imported.length,
        skipped,
        total: finalGames.length,
      },
      null,
      2,
    ),
  );
}

importClassroom6x().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
