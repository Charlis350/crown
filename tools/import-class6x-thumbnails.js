const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const thumbDir = path.join(root, "assets", "thumbs");
const generatedDir = path.join(thumbDir, "generated");
const sourceUrl = "https://class6x.gitlab.io/";
const agent = new https.Agent({ rejectUnauthorized: false });

const aliases = new Map(
  Object.entries({
    "1v1lol": "1v1lol",
    "1v1soccer": "1v1soccer",
    "8ballclassic": "8ballpool",
    "basketballstars": "basketballstars",
    "basketballstars": "basketballstars",
    "ballontowerdefense4": "bloonstowerdefense4",
    "baldybasics": "baldisbasics",
    "dodge miner": "dogeminer",
    "dodgeminer": "dogeminer",
    "getawayshootout": "getawayshootout",
    "google dino": "chromedino",
    "googledino": "chromedino",
    "ovo": "ovo",
    "papasfreezeria": "papasfreezeria",
    "subwayssurfersbeijing": "subwaysurfersbeijing",
    "trigger ralley": "triggerrally",
    "triggerralley": "triggerrally",
    "wolfenstien": "wolfenstein3d",
    "wolfenstein": "wolfenstein3d",
  })
);

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = String(url).startsWith("http://") ? http : https;
    const req = client.get(
      url,
      {
        agent: client === https ? agent : undefined,
        headers: {
          "accept-encoding": "gzip, deflate, br",
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CrownGamesThumbImporter/1.0",
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          let body = Buffer.concat(chunks);
          try {
            if (res.headers["content-encoding"] === "gzip") body = zlib.gunzipSync(body);
            else if (res.headers["content-encoding"] === "deflate") body = zlib.inflateSync(body);
            else if (res.headers["content-encoding"] === "br") body = zlib.brotliDecompressSync(body);
          } catch {}
          resolve(body);
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(30000, () => req.destroy(new Error("Request timed out")));
  });
}

async function fetchText(url) {
  return (await fetchBuffer(url)).toString("utf8");
}

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

function decodeEntities(value) {
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

function normalize(value) {
  const cleaned = decodeEntities(value)
    .toLowerCase()
    .replace(/\b(the|and|of)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
  return aliases.get(cleaned) || cleaned;
}

function slugFromUrl(url) {
  const clean = String(url || "").replace(/[?#].*$/, "");
  return clean.slice(clean.lastIndexOf("/") + 1).replace(/\.[a-z0-9]+$/i, "");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function parseClass6x(html) {
  const entries = [];
  const cardPattern =
    /<a\s+class="game-link"\s+href="([^"]+)"[\s\S]*?<img[^>]+src="([^"]+)"[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  for (const match of html.matchAll(cardPattern)) {
    const href = decodeEntities(match[1]);
    const image = new URL(decodeEntities(match[2]), sourceUrl).href;
    const title = decodeEntities(match[3].replace(/<[^>]*>/g, " ")).trim();
    const slug = slugFromUrl(href);
    entries.push({
      title,
      image,
      slug,
      keys: new Set([normalize(title), normalize(slug)]),
    });
  }
  return entries;
}

function findMatch(game, class6xEntries) {
  const pageSlug = slugFromUrl(game.originalPage);
  const keys = [
    normalize(game.title),
    normalize(pageSlug),
    normalize(game.title.replace(/\bv\s*/gi, "v")),
  ];

  for (const key of keys) {
    const exact = class6xEntries.find((entry) => entry.keys.has(key));
    if (exact) return exact;
  }

  const compactTitle = normalize(game.title);
  return class6xEntries.find((entry) => {
    if (compactTitle.length < 5) return false;
    for (const key of entry.keys) {
      if (key.length >= 5 && (key.includes(compactTitle) || compactTitle.includes(key))) {
        return true;
      }
    }
    return false;
  });
}

function isBadGoogleShellThumbnail(url) {
  return !url || /lh3\.googleusercontent\.com\/sitesv\//i.test(url);
}

function svgFallback(game) {
  const colors = [
    ["#fcd34d", "#f97316"],
    ["#60a5fa", "#2563eb"],
    ["#34d399", "#047857"],
    ["#f472b6", "#be185d"],
    ["#a78bfa", "#6d28d9"],
    ["#fb7185", "#b91c1c"],
    ["#38bdf8", "#0f766e"],
  ];
  const hash = [...game.title].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const pair = colors[hash % colors.length];
  const words = game.title.split(/\s+/).filter(Boolean);
  const line1 = words.slice(0, 2).join(" ");
  const line2 = words.slice(2, 5).join(" ");
  const initial = words[0]?.[0]?.toUpperCase() || "C";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${pair[0]}"/>
<stop offset="1" stop-color="${pair[1]}"/>
</linearGradient>
<filter id="s" x="-20%" y="-20%" width="140%" height="140%">
<feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000" flood-opacity=".35"/>
</filter>
</defs>
<rect width="512" height="512" rx="54" fill="url(#g)"/>
<circle cx="418" cy="82" r="96" fill="#fff" opacity=".18"/>
<circle cx="78" cy="422" r="120" fill="#000" opacity=".12"/>
<path d="M142 154h228l-34 46 36 158H140l36-158-34-46z" fill="#fff" opacity=".18"/>
<text x="256" y="242" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="134" fill="#fff" filter="url(#s)">${escapeXml(initial)}</text>
<text x="256" y="330" text-anchor="middle" font-family="Trebuchet MS, Arial, sans-serif" font-size="38" font-weight="800" fill="#fff">${escapeXml(line1)}</text>
<text x="256" y="378" text-anchor="middle" font-family="Trebuchet MS, Arial, sans-serif" font-size="30" font-weight="700" fill="#fff" opacity=".92">${escapeXml(line2)}</text>
</svg>`;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
  });
}

async function saveRemoteThumb(url, game) {
  const ext = path.extname(new URL(url).pathname).replace(/[^a-z0-9.]/gi, "").toLowerCase() || ".jpg";
  const file = `${slugify(game.id || game.title)}${ext}`;
  const target = path.join(thumbDir, file);
  const rel = `assets/thumbs/${file}`;
  if (!fs.existsSync(target)) {
    const bytes = await fetchBuffer(url);
    if (bytes.length > 256) fs.writeFileSync(target, bytes);
  }
  return rel;
}

function saveGeneratedThumb(game) {
  const file = `${slugify(game.id || game.title)}.svg`;
  const target = path.join(generatedDir, file);
  fs.writeFileSync(target, svgFallback(game), "utf8");
  return `assets/thumbs/generated/${file}`;
}

async function main() {
  const games = readGames();
  fs.rmSync(thumbDir, { recursive: true, force: true });
  fs.mkdirSync(generatedDir, { recursive: true });

  const class6xEntries = parseClass6x(await fetchText(sourceUrl));
  const stats = {
    total: games.length,
    class6x: 0,
    keptEmbed: 0,
    generated: 0,
  };

  for (const game of games) {
    const match = findMatch(game, class6xEntries);
    if (match) {
      game.thumbnail = await saveRemoteThumb(match.image, game);
      game.thumbnailSource = "class6x";
      stats.class6x += 1;
    } else if (!isBadGoogleShellThumbnail(game.thumbnail)) {
      try {
        game.thumbnail = await saveRemoteThumb(game.thumbnail, game);
        game.thumbnailSource = "embed";
        stats.keptEmbed += 1;
      } catch {
        game.thumbnail = saveGeneratedThumb(game);
        game.thumbnailSource = "generated";
        stats.generated += 1;
      }
    } else {
      game.thumbnail = saveGeneratedThumb(game);
      game.thumbnailSource = "generated";
      stats.generated += 1;
    }
  }

  writeGames(games);
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
