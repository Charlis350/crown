const fs = require("fs");
const https = require("https");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const embedsDir = path.join(root, "embeds");

const assetOnlyPattern = /\.(?:js|css|png|jpe?g|gif|webp|wasm|data|mem)(?:[?#].*)?$/i;
const imagePattern = /\.(?:png|jpe?g|webp|gif|svg)(?:[?#].*)?$/i;
const agent = new https.Agent({ rejectUnauthorized: false });

function readGames() {
  const raw = fs.readFileSync(dataFile, "utf8");
  const json = raw
    .replace(/^\s*window\.CROWN_GAMES\s*=\s*/, "")
    .replace(/;\s*$/, "");
  return JSON.parse(json);
}

function writeGames(games) {
  fs.writeFileSync(
    dataFile,
    "window.CROWN_GAMES = " + JSON.stringify(games, null, 2) + ";\n",
    "utf8"
  );
}

function ensureUniqueIds(games) {
  const seen = new Map();
  for (const game of games) {
    const base = game.id || slugify(`${game.title}-${game.originalPage || ""}`);
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    game.id = count === 0 ? base : `${base}-${count + 1}`;
  }
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        agent,
        headers: {
          "accept-encoding": "gzip, deflate, br",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CrownGamesImporter/1.0",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          let body = Buffer.concat(chunks);
          try {
            if (res.headers["content-encoding"] === "gzip") {
              body = zlib.gunzipSync(body);
            } else if (res.headers["content-encoding"] === "deflate") {
              body = zlib.inflateSync(body);
            } else if (res.headers["content-encoding"] === "br") {
              body = zlib.brotliDecompressSync(body);
            }
          } catch {
            // If decoding fails, keep the original response so the caller can report it.
          }
          resolve(body.toString("utf8"));
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("Request timed out")));
  });
}

function decodeEntities(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1] && entity[1].toLowerCase() === "x";
      const number = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : match;
    }
    return Object.prototype.hasOwnProperty.call(named, entity) ? named[entity] : match;
  });
}

function extractDataCodes(html) {
  const matches = [];
  const rx =
    /data-code="([\s\S]*?)"(?=\s+(?:aria-|class=|data-|id=|jsaction=|jscontroller=|jsmodel=|jsname=|role=|style=|tabindex=)|>)/g;
  for (const match of html.matchAll(rx)) {
    const decoded = decodeEntities(match[1]).trim();
    if (decoded.length > 80) matches.push(decoded);
  }
  return matches.sort((a, b) => b.length - a.length);
}

function extractThumbnail(html, fallback) {
  const og = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
  const item = html.match(/<meta\s+itemprop="image"\s+content="([^"]+)"/i);
  return decodeEntities((og && og[1]) || (item && item[1]) || fallback || "");
}

function extractEmbedThumbnail(code) {
  const candidates = [];
  const baseUrls = [...code.matchAll(/https?:\/\/[^\s"'<>]+\//g)].map((match) =>
    decodeEntities(match[0])
  );

  function push(raw, weight = 0) {
    if (!raw) return;
    let url = decodeEntities(raw).trim();
    if (!url || url.startsWith("data:")) return;
    if (url.includes("googletagmanager") || url.includes("google-analytics")) return;
    if (/social_icons|discord|facebook|instagram|twitter|analytics/i.test(url)) return;

    if (!/^https?:\/\//i.test(url)) {
      const base = baseUrls.find((item) => /^https?:\/\//i.test(item));
      if (!base) return;
      try {
        url = new URL(url, base).href;
      } catch {
        return;
      }
    }

    if (!imagePattern.test(url)) return;
    const lower = url.toLowerCase();
    let score = weight;
    if (/og[_-]?image|cover|thumbnail|thumb|preview|poster|title|logo|icon/.test(lower)) score += 20;
    if (/loading|load_bar|progress|spinner|discord|facebook|instagram|twitter/.test(lower)) score -= 20;
    if (/apple-touch-icon|favicon/.test(lower)) score += 8;
    if (/\.(jpg|jpeg|webp)(?:[?#]|$)/.test(lower)) score += 2;
    candidates.push({ url, score });
  }

  const metaImage = code.match(/<meta\s+(?:property|name)=["'](?:og:image|twitter:image)["']\s+content=["']([^"']+)["']/i);
  const icon = code.match(/<link\s+[^>]*rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*href=["']([^"']+)["']/i);
  const poster = code.match(/\sposter=["']([^"']+)["']/i);
  push(metaImage && metaImage[1], 40);
  push(icon && icon[1], 32);
  push(poster && poster[1], 35);

  for (const match of code.matchAll(/https?:\/\/[^\s"'<>]+?\.(?:png|jpe?g|webp|gif|svg)(?:\?[^\s"'<>]*)?/gi)) {
    push(match[0], 10);
  }

  for (const match of code.matchAll(/(?:src|href|poster)=["']([^"']+?\.(?:png|jpe?g|webp|gif|svg)(?:\?[^"']*)?)["']/gi)) {
    push(match[1], 6);
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url || "";
}

function isGoogleSiteShellImage(url) {
  return /lh3\.googleusercontent\.com\/sitesv\//i.test(url || "");
}

function ensureHtmlDocument(source, title) {
  let html = source.replace(/^\s*<Module>\s*/i, "").trim();
  const shim = `<script>
window.CROWN_GAMES_EMBED = true;
window.maeExportApis_ = window.maeExportApis_ || function(){};
try {
  if (window.parent && !window.parent.maeExportApis_) {
    window.parent.maeExportApis_ = function(){};
  }
} catch (error) {}
</script>
<style>
html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: #000;
}
iframe, canvas, ruffle-player, #gameContainer, #unity-container, #unity-canvas {
  width: 100%;
  height: 100%;
}
</style>`;

  if (!/<html[\s>]/i.test(html)) {
    html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeText(title)}</title>
${shim}
</head>
<body>
${html}
</body>
</html>`;
  } else if (/<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${shim}\n</head>`);
  } else {
    html = shim + "\n" + html;
  }

  return html;
}

function escapeText(value) {
  return String(value).replace(/[&<>"]/g, (ch) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
  });
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function pageUrlFor(game) {
  if (!game.originalPage) return "";
  return game.originalPage.includes("?")
    ? game.originalPage
    : `${game.originalPage}?authuser=4`;
}

function isProbablyBadIframeUrl(url) {
  if (!url) return true;
  if (assetOnlyPattern.test(url)) return true;
  if (/\/(?:Build|TemplateData)(?:[/?#]|$)/i.test(url)) return true;
  return false;
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return results;
}

async function main() {
  const games = readGames();
  ensureUniqueIds(games);

  if (!embedsDir.startsWith(root + path.sep)) {
    throw new Error(`Refusing to write outside project: ${embedsDir}`);
  }
  fs.rmSync(embedsDir, { recursive: true, force: true });
  fs.mkdirSync(embedsDir, { recursive: true });

  const stats = {
    total: games.length,
    htmlEmbeds: 0,
    keptDirect: 0,
    pageFallback: 0,
    fetchFailed: 0,
  };

  await mapLimit(games, 8, async (game, index) => {
    const pageUrl = pageUrlFor(game);
    if (!pageUrl) return;

    try {
      const html = await fetchText(pageUrl);
      game.thumbnail = extractThumbnail(html, game.thumbnail);
      const dataCodes = extractDataCodes(html);

      if (dataCodes.length > 0) {
        const embedThumbnail = extractEmbedThumbnail(dataCodes[0]);
        if (embedThumbnail) game.thumbnail = embedThumbnail;
        const embedFile = `${game.id}.html`;
        const embedPath = path.join(embedsDir, embedFile);
        fs.writeFileSync(embedPath, ensureHtmlDocument(dataCodes[0], game.title), "utf8");
        game.embedType = "html";
        game.embedPath = `embeds/${embedFile}`;
        delete game.embedUrl;
        game.playable = true;
        game.sourceHadEmbed = true;
        stats.htmlEmbeds += 1;
      } else if (game.embedUrl && !isProbablyBadIframeUrl(game.embedUrl)) {
        game.playable = true;
        game.sourceHadEmbed = true;
        stats.keptDirect += 1;
      } else {
        delete game.embedPath;
        if (game.embedType !== "swf") delete game.embedUrl;
        if (game.embedType !== "swf") game.embedType = "page";
        game.playable = game.embedType === "swf" && Boolean(game.embedUrl);
        game.sourceHadEmbed = game.playable;
        stats.pageFallback += game.playable ? 0 : 1;
      }
    } catch (error) {
      console.warn(`Failed ${index + 1}/${games.length}: ${game.title} - ${error.message}`);
      stats.fetchFailed += 1;
    }
  });

  writeGames(games);
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
