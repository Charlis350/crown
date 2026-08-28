const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const embedsDir = path.join(root, "embeds");
const class6xThumbDir = path.join(root, "assets", "thumbs", "class6x");
const driveThumbDir = path.join(root, "assets", "thumbs", "drive");
const generatedThumbDir = path.join(root, "assets", "thumbs", "generated");

const CLASS6X_ROOT = "https://class6x.gitlab.io/";
const DRIVE_FOLDER =
  "https://drive.google.com/drive/folders/1ou3mI5xJVQv8Vt_MvwejPtf7zStSnU-s?usp=drive_link";
const DRIVE_FOLDER_ID = "1ou3mI5xJVQv8Vt_MvwejPtf7zStSnU-s";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CrownGamesImporter/2.0";

const CATEGORY_LABELS = {
  "2-player": "2 Player",
  "3d": "3D",
  adventure: "Adventure",
  car: "Racing",
  moto: "Racing",
  multiplayer: "Multiplayer",
  puzzle: "Puzzle",
  racing: "Racing",
  running: "Running",
  shooting: "Shooting",
  skill: "Skill",
  sports: "Sports",
  stickman: "Stickman",
  trending: "Trending",
  latest: "Latest",
  featured: "Featured",
};

const DRIVE_TITLE_ALIASES = {
  altsingle: "Alt Single",
  "bank-robbery": "Bank Robbery",
  cheeserolling: "Cheese Rolling",
  "cl-3": "CL 3",
  "cl-b": "CL B",
  cl1: "CL 1",
  cl1on1soccer: "1 On 1 Soccer",
  cl1v1lol: "1v1.lol",
  cl1v1tennis: "1v1 Tennis",
  cl2doom: "Doom",
  cl2dshooting: "2D Shooting",
  cl3dash: "3D Dash",
  cl3dasheditor: "3D Dash Editor",
  cl3dpinballspacecadet: "3D Pinball Space Cadet",
  cl3pandas: "3 Pandas",
  cl3pandasbrazil: "3 Pandas Brazil",
  cl3pandasfantasy: "3 Pandas Fantasy",
  cl3pandasjapan: "3 Pandas Japan",
  cl3pandasnight: "3 Pandas Night",
  cl3slices2: "3 Slices 2",
  cl4thandgoal: "4th and Goal",
};

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
  args.push(url);

  return new Promise((resolve, reject) => {
    execFile(
      "curl.exe",
      args,
      { encoding: options.output ? "utf8" : "buffer", maxBuffer: 25 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr && String(stderr).trim()) || error.message));
          return;
        }
        resolve(stdout);
      }
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
    "utf8"
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
    .replace(/\b(the|and|of|a)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function categorySlug(url) {
  return String(url).match(/\/category\/([^/?#]+)\.html/i)?.[1] || "";
}

function pageSlug(url) {
  return String(url)
    .replace(/[?#].*$/, "")
    .replace(/\/$/, "")
    .split("/")
    .pop()
    .replace(/\.html$/i, "");
}

function parseClass6xCards(html, categoryUrl = "") {
  const cards = [];
  let cursor = 0;
  const category = categorySlug(categoryUrl);

  while ((cursor = html.indexOf('class="game-link"', cursor)) !== -1) {
    const start = html.lastIndexOf("<a", cursor);
    const end = html.indexOf("</a>", cursor);
    if (start === -1 || end === -1) break;

    const segment = html.slice(start, end + 4);
    cursor = end + 4;

    const href = attr(segment, "href");
    const image = attr(segment, "src");
    const titleRaw = segment.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1] || "";
    const title = stripTags(titleRaw);
    if (!href || !title) continue;

    cards.push({
      title,
      slug: pageSlug(href),
      pageUrl: new URL(href, CLASS6X_ROOT).href,
      thumbnailUrl: image ? new URL(image, CLASS6X_ROOT).href : "",
      categories: category ? [category] : [],
    });
  }

  return cards;
}

function parseClass6xCategories(html) {
  const categoryUrls = new Set();
  for (const match of html.matchAll(/href=["'](\/category\/[^"']+?\.html)["']/gi)) {
    categoryUrls.add(new URL(match[1], CLASS6X_ROOT).href);
  }
  return [...categoryUrls];
}

function chooseCategory(slugs) {
  const priority = slugs.filter((slug) => !["trending", "latest", "featured"].includes(slug));
  const selected = priority[0] || slugs[0] || "featured";
  return CATEGORY_LABELS[selected] || titleCase(selected);
}

function titleCase(value) {
  return String(value)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function parseExactIframe(html) {
  const frames = [];
  for (const match of html.matchAll(/<iframe\b[^>]*>/gi)) {
    const tag = match[0];
    const src = attr(tag, "src");
    if (!src) continue;

    let score = 0;
    const lower = tag.toLowerCase();
    if (/class=["'][^"']*game-iframe/i.test(tag)) score += 120;
    if (/id=["']gameframe["']/i.test(tag)) score += 90;
    if (/class6x\.gitlab\.io/i.test(src)) score += 20;
    if (/pages\.dev|ubg|unblocked/i.test(src)) score += 12;
    if (/width=["']1["']|height=["']1["']|z-index:\s*-1/i.test(lower)) score -= 200;
    if (/display:\s*none|visibility:\s*hidden/i.test(lower)) score -= 100;
    if (/\.(?:png|jpe?g|gif|webp|css|js)(?:[?#].*)?$/i.test(src)) score -= 100;
    frames.push({ src, score });
  }

  frames.sort((a, b) => b.score - a.score);
  if (!frames.length || frames[0].score <= 0) return "";
  return new URL(frames[0].src, CLASS6X_ROOT).href;
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

function escapeXml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
  });
}

function generatedThumb(title, fileBase) {
  fs.mkdirSync(generatedThumbDir, { recursive: true });
  const file = `${fileBase}.svg`;
  const target = path.join(generatedThumbDir, file);
  const words = title.split(/\s+/).filter(Boolean);
  const initial = escapeXml((words[0]?.[0] || "C").toUpperCase());
  const line1 = escapeXml(words.slice(0, 2).join(" "));
  const line2 = escapeXml(words.slice(2, 5).join(" "));
  fs.writeFileSync(
    target,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#facc15"/><stop offset=".52" stop-color="#111827"/><stop offset="1" stop-color="#16a34a"/></linearGradient></defs>
<rect width="512" height="512" rx="58" fill="url(#g)"/>
<path d="M111 168h290l-46 56 48 169H109l48-169-46-56z" fill="#fff" opacity=".17"/>
<circle cx="407" cy="92" r="98" fill="#fff" opacity=".16"/>
<circle cx="89" cy="426" r="126" fill="#000" opacity=".18"/>
<text x="256" y="242" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="136" fill="#fff">${initial}</text>
<text x="256" y="328" text-anchor="middle" font-family="Trebuchet MS, Arial, sans-serif" font-size="38" font-weight="800" fill="#fff">${line1}</text>
<text x="256" y="376" text-anchor="middle" font-family="Trebuchet MS, Arial, sans-serif" font-size="30" font-weight="700" fill="#fff" opacity=".88">${line2}</text>
</svg>`,
    "utf8"
  );
  return `assets/thumbs/generated/${file}`;
}

async function saveImage(url, folder, relFolder, fileBase) {
  if (!url) return "";
  fs.mkdirSync(folder, { recursive: true });
  const ext = path.extname(new URL(url).pathname).replace(/[^a-z0-9.]/gi, "") || ".jpg";
  const target = path.join(folder, `${fileBase}${ext}`);
  try {
    if (!fs.existsSync(target) || fs.statSync(target).size < 512) {
      await curl(url, { output: target, timeout: 30 });
    }
    if (fs.existsSync(target) && fs.statSync(target).size > 512) {
      return `${relFolder}/${path.basename(target)}`.replace(/\\/g, "/");
    }
  } catch {
    fs.rmSync(target, { force: true });
  }
  return "";
}

function ensureHtmlDocument(source, title) {
  const shim = `<script>
window.CROWN_GAMES_EMBED = true;
window.maeExportApis_ = window.maeExportApis_ || function(){};
try {
  if (window.parent && !window.parent.maeExportApis_) window.parent.maeExportApis_ = function(){};
} catch (error) {}
</script>
<style>
html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #000; }
iframe, canvas, ruffle-player, #gameContainer, #unity-container, #unity-canvas { width: 100%; height: 100%; }
</style>`;

  let html = String(source).trim();
  if (!/<html[\s>]/i.test(html)) {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeXml(title)}</title>
${shim}
</head>
<body>
${html}
</body>
</html>`;
  }
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${shim}\n</head>`);
  return `${shim}\n${html}`;
}

function parseDriveItems(html) {
  const ids = [
    ...new Set(
      [...html.matchAll(/data-id=["']([^"']+)["']/g)]
        .map((match) => match[1])
        .filter((id) => /^[A-Za-z0-9_-]{20,}$/.test(id))
    ),
  ];

  return ids
    .map((id) => {
      const index = html.indexOf(`data-id="${id}"`);
      if (index === -1) return null;
      const slice = html.slice(Math.max(0, index - 1200), index + 9000);
      const text = stripTags(slice);
      const name =
        text.match(/(?:Download\s+)?([A-Za-z0-9][^|<>]*?\.html)\s+Shared\s+/i)?.[1] ||
        text.match(/([A-Za-z0-9][^|<>]*?\.html)\s+Shared\s+/i)?.[1] ||
        "";
      if (!name) return null;
      return { id, fileName: name.trim() };
    })
    .filter(Boolean);
}

function driveTitle(fileName) {
  const base = fileName.replace(/\.html$/i, "");
  const key = slugify(base).replace(/-/g, "");
  const dashed = slugify(base);
  if (DRIVE_TITLE_ALIASES[base.toLowerCase()]) return DRIVE_TITLE_ALIASES[base.toLowerCase()];
  if (DRIVE_TITLE_ALIASES[dashed]) return DRIVE_TITLE_ALIASES[dashed];
  if (DRIVE_TITLE_ALIASES[key]) return DRIVE_TITLE_ALIASES[key];

  return base
    .replace(/^cl(?=\d|[a-z])/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/(\d)([a-zA-Z])/g, "$1 $2")
    .replace(/([a-zA-Z])(\d)/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function importClass6x(games) {
  const stats = { categories: 0, cards: 0, uniqueCards: 0, added: 0, merged: 0, skipped: 0 };
  const home = await fetchText(CLASS6X_ROOT);
  const categoryUrls = parseClass6xCategories(home);
  stats.categories = categoryUrls.length;

  const byPage = new Map();
  for (const card of parseClass6xCards(home, `${CLASS6X_ROOT}category/featured.html`)) {
    byPage.set(card.pageUrl, card);
  }

  await mapLimit(categoryUrls, 6, async (url) => {
    const html = await fetchText(url);
    const cards = parseClass6xCards(html, url);
    stats.cards += cards.length;
    for (const card of cards) {
      const existing = byPage.get(card.pageUrl);
      if (existing) {
        existing.categories = [...new Set([...existing.categories, ...card.categories])];
      } else {
        byPage.set(card.pageUrl, card);
      }
    }
  });

  const cards = [...byPage.values()];
  stats.uniqueCards = cards.length;
  const existingByTitle = new Map(games.map((game) => [normalizeTitle(game.title), game]));

  await mapLimit(cards, 8, async (card) => {
    let embedUrl = "";
    try {
      embedUrl = parseExactIframe(await fetchText(card.pageUrl));
    } catch {
      stats.skipped += 1;
      return;
    }
    if (!embedUrl) {
      stats.skipped += 1;
      return;
    }

    const id = `class6x-${slugify(card.title || card.slug)}`;
    const thumb =
      (await saveImage(
        card.thumbnailUrl,
        class6xThumbDir,
        "assets/thumbs/class6x",
        slugify(id)
      )) || generatedThumb(card.title, slugify(id));

    const merged = existingByTitle.get(normalizeTitle(card.title));
    if (merged) {
      if (merged.source !== "class6x") {
        merged.embedType = "iframe";
        merged.embedUrl = embedUrl;
        delete merged.embedPath;
        merged.playable = true;
        merged.sourceHadEmbed = true;
        merged.source = "class6x";
        merged.originalPage = card.pageUrl;
        merged.class6xPage = card.pageUrl;
        merged.category = chooseCategory(card.categories);
        merged.thumbnail = thumb;
        merged.thumbnailSource = "class6x";
      } else if (merged.thumbnailSource === "generated") {
        merged.thumbnail = thumb;
        merged.thumbnailSource = "class6x";
      }
      stats.merged += 1;
      return;
    }

    const entry = {
      id,
      title: card.title,
      category: chooseCategory(card.categories),
      originalPage: card.pageUrl,
      thumbnail: thumb,
      embedType: "iframe",
      embedUrl,
      playable: true,
      sourceHadEmbed: true,
      source: "class6x",
      tags: card.categories.map((slug) => CATEGORY_LABELS[slug] || titleCase(slug)),
      thumbnailSource: thumb.includes("generated") ? "generated" : "class6x",
    };
    games.push(entry);
    existingByTitle.set(normalizeTitle(card.title), entry);
    stats.added += 1;
  });

  return stats;
}

async function importDrive(games) {
  const stats = { found: 0, added: 0, skipped: 0 };
  const folderHtml = await fetchText(DRIVE_FOLDER);
  const items = parseDriveItems(folderHtml);
  stats.found = items.length;
  const driveEmbedDir = path.join(embedsDir, "drive");
  fs.mkdirSync(driveEmbedDir, { recursive: true });

  const existingIds = new Set(games.map((game) => game.driveFileId).filter(Boolean));

  await mapLimit(items, 5, async (item) => {
    if (existingIds.has(item.id)) {
      stats.skipped += 1;
      return;
    }
    const title = driveTitle(item.fileName);
    const slug = slugify(`${title}-${item.id.slice(0, 8)}`);
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${item.id}`;
    const target = path.join(driveEmbedDir, `${slug}.html`);

    try {
      const source = await fetchText(downloadUrl);
      if (!source || source.length < 100 || /Google Drive - Virus scan warning/i.test(source)) {
        throw new Error("Drive file did not return usable HTML");
      }
      fs.writeFileSync(target, ensureHtmlDocument(source, title), "utf8");
    } catch {
      stats.skipped += 1;
      return;
    }

    const thumb =
      (await saveImage(
        `https://drive.google.com/thumbnail?id=${item.id}&sz=w512`,
        driveThumbDir,
        "assets/thumbs/drive",
        slug
      )) || generatedThumb(title, `drive-${slug}`);

    games.push({
      id: `drive-${slug}`,
      title,
      category: "Drive Imports",
      originalPage: `https://drive.google.com/file/d/${item.id}/view`,
      thumbnail: thumb,
      embedType: "html",
      embedPath: `embeds/drive/${slug}.html`,
      playable: true,
      sourceHadEmbed: true,
      source: "drive-folder",
      driveFolderId: DRIVE_FOLDER_ID,
      driveFileId: item.id,
      driveFileName: item.fileName,
      thumbnailSource: thumb.includes("generated") ? "generated" : "drive",
    });
    existingIds.add(item.id);
    stats.added += 1;
  });

  return stats;
}

function removeGoogleFallbacks(games) {
  const before = games.length;
  const kept = games.filter((game) => {
    const isGoogleSite = /sites\.google\.com\/lindberghschools\.ws\/crown-official/i.test(
      game.originalPage || ""
    );
    return !(isGoogleSite && !game.playable && !game.embedPath && !game.embedUrl);
  });
  return { games: kept, removed: before - kept.length };
}

function sortGames(games) {
  games.sort((a, b) => {
    const cat = String(a.category || "").localeCompare(String(b.category || ""));
    if (cat) return cat;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

async function main() {
  if (!embedsDir.startsWith(root + path.sep)) {
    throw new Error(`Refusing to write outside project: ${embedsDir}`);
  }

  fs.mkdirSync(class6xThumbDir, { recursive: true });
  fs.mkdirSync(driveThumbDir, { recursive: true });

  let games = readGames();
  for (const game of games) {
    if (!game.source) game.source = "google-site";
  }

  const class6x = await importClass6x(games);
  const drive = await importDrive(games);
  const pruned = removeGoogleFallbacks(games);
  games = pruned.games;
  sortGames(games);
  writeGames(games);

  console.log(
    JSON.stringify(
      {
        class6x,
        drive,
        removedGoogleFallbacks: pruned.removed,
        totalGames: games.length,
        playableGames: games.filter((game) => game.playable).length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
