const fs = require("fs");
const path = require("path");
const { execFile, execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const outputRoot = path.join(root, "embeds", "class6x-local");
const gitPath = "C:\\Users\\weswo\\AppData\\Local\\GitHubDesktop\\app-3.5.8\\resources\\app\\git\\cmd\\git.exe";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CrownGamesLocalizer/1.0";
const TEXT_EXTENSIONS = new Set([
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".xml",
  ".txt",
  ".svg",
  ".atlas",
  ".fnt",
]);

const POKI_STUB = `window.PokiSDK = window.PokiSDK || {
  init: function(){ return Promise.resolve(); },
  initWithVideoHB: function(){ return Promise.resolve(); },
  commercialBreak: function(){ return Promise.resolve(); },
  rewardedBreak: function(){ return Promise.resolve(false); },
  gameplayStart: function(){},
  gameplayStop: function(){},
  happyTime: function(){},
  setDebug: function(){},
  setDebugTouchOverlayController: function(){},
  captureError: function(){},
  customEvent: function(){},
  shareableURL: function(){ return Promise.resolve(location.href); }
};`;

function parseArgs(argv) {
  const args = {
    limit: 50,
    maxFiles: 90,
    maxBytes: 35 * 1024 * 1024,
    timeout: 12,
    hosts: new Set(["ubgwtf.gitlab.io"]),
  };
  for (const arg of argv) {
    if (arg.startsWith("--limit=")) args.limit = Number(arg.slice("--limit=".length));
    if (arg.startsWith("--max-files=")) args.maxFiles = Number(arg.slice("--max-files=".length));
    if (arg.startsWith("--timeout=")) args.timeout = Number(arg.slice("--timeout=".length));
    if (arg.startsWith("--host=")) args.hosts.add(arg.slice("--host=".length).toLowerCase());
    if (arg === "--all-hosts") args.hosts = null;
  }
  return args;
}

function readGames() {
  const raw = fs.readFileSync(dataFile, "utf8");
  return JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
}

function writeGames(games) {
  fs.writeFileSync(dataFile, `window.CROWN_GAMES = ${JSON.stringify(games, null, 2)};\n`, "utf8");
}

function previousGames() {
  const raw = execFileSync(gitPath, ["show", "ec01012:data/games.js"], {
    encoding: "utf8",
    maxBuffer: 80 * 1024 * 1024,
  });
  return JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeTitle(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCategory(entry) {
  const haystack = `${entry.title} ${(entry.tags || []).join(" ")} ${entry.category || ""}`.toLowerCase();
  if (/basket|soccer|football|sports|pool|golf|tennis|baseball/.test(haystack)) return "Sports";
  if (/car|race|racing|drive|drift|moto|truck|kart/.test(haystack)) return "Racing";
  if (/gun|shoot|sniper|zombie|combat|battle/.test(haystack)) return "Shooting";
  if (/puzzle|logic|mahjong|word|quiz|2048/.test(haystack)) return "Puzzle";
  if (/2 player|two player|multiplayer/.test(haystack)) return "2 Player";
  if (/clicker|idle/.test(haystack)) return "Clicker";
  if (/run|jump|platform|adventure|vex|obby/.test(haystack)) return "Adventure";
  return entry.category || "Games";
}

function curl(url, timeout = 12) {
  const args = [
    "--ssl-no-revoke",
    "--fail",
    "-L",
    "--compressed",
    "--connect-timeout",
    "6",
    "--max-time",
    String(timeout),
    "-sS",
    "-A",
    USER_AGENT,
  ];
  args.push(url);
  return new Promise((resolve, reject) => {
    execFile("curl.exe", args, { encoding: "buffer", maxBuffer: 80 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(String(stderr || error.message).trim()));
        return;
      }
      resolve(stdout);
    });
  });
}

function isTextUrl(urlString) {
  const ext = path.extname(new URL(urlString).pathname).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) || !ext;
}

function safeLocalRel(basePath, urlString) {
  const url = new URL(urlString);
  const cleanBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
  let pathname = url.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch (error) {
    pathname = pathname.replace(/%/g, "%25");
  }
  if (pathname === cleanBase || pathname.endsWith("/")) pathname += "index.html";
  if (pathname.startsWith(cleanBase)) {
    return pathname.slice(cleanBase.length).replace(/^\/+/, "") || "index.html";
  }
  return path.posix.join("__root__", pathname.replace(/^\/+/, ""));
}

function toFilePath(gameDir, relPath) {
  const normalized = relPath.replace(/\?.*$/, "").replace(/#/g, "");
  const parts = normalized
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[<>:"|?*\x00-\x1f]/g, "_").slice(0, 120));
  return path.join(gameDir, ...parts);
}

function relativeWebPath(fromRel, toRel) {
  let rel = path.posix.relative(path.posix.dirname(fromRel), toRel);
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return rel;
}

function isSkippableUrl(value) {
  return (
    !value ||
    /^(?:data:|blob:|javascript:|mailto:|tel:|about:)/i.test(value) ||
    /(?:googletagmanager|google-analytics|googlesyndication|doubleclick|cloudflareinsights|adsbygoogle)/i.test(value)
  );
}

function looksLikeCodeInsteadOfAsset(value) {
  return (
    value.length > 240 ||
    /(?:function\s*\(|=>|typeof\s+|return\s+|const\s+|let\s+|var\s+|new\s+|\\\^)/i.test(value) ||
    /[{}<>|]/.test(value)
  );
}

function sanitizeText(text) {
  return String(text)
    .replace(/<script\b[^>]*\bsrc=["'][^"']*(?:googletagmanager|google-analytics|googlesyndication|doubleclick|cloudflareinsights|cloak\.js)[^"']*["'][^>]*>\s*<\/script>/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?(?:gtag\(|dataLayer|adsbygoogle|googlesyndication|cloudflareinsights)[\s\S]*?<\/script>/gi, "");
}

function discoverResources(text, currentUrl, baseUrl) {
  const found = new Set();
  const source = sanitizeText(text);
  const attrPattern = /\b(?:src|href|data|poster)\s*=\s*["']([^"']+)["']/gi;
  const urlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  const importPattern = /@import\s+["']([^"']+)["']/gi;
  const quotedPattern = /["']([^"']+\.(?:js|mjs|css|json|png|jpe?g|webp|gif|svg|mp3|ogg|wav|m4a|ttf|woff2?|wasm|data|unityweb|mem|swf|xml|txt|atlas|fnt|bin|pak|glb|gltf)(?:\?[^"']*)?)["']/gi;

  for (const pattern of [attrPattern, urlPattern, importPattern, quotedPattern]) {
    for (const match of source.matchAll(pattern)) {
      const raw = match[1].trim();
      if (isSkippableUrl(raw) || looksLikeCodeInsteadOfAsset(raw)) continue;
      for (const anchor of [currentUrl, baseUrl]) {
        try {
          found.add(new URL(raw, anchor).href);
        } catch (error) {}
      }
    }
  }
  return [...found];
}

function shouldStub(urlString) {
  return /poki[^/]*sdk|sdk\.poki|poki-sdk/i.test(urlString);
}

async function mirrorGame(entry, args) {
  const startUrl = new URL(entry.embedUrl);
  const basePath = startUrl.pathname.endsWith("/")
    ? startUrl.pathname
    : startUrl.pathname.replace(/[^/]+$/, "");
  const baseUrl = new URL(basePath, startUrl.origin).href;
  const slug = slugify(entry.title || entry.id);
  const gameDir = path.join(outputRoot, slug);
  const queue = [startUrl.href];
  const seen = new Set();
  const textFiles = new Map();
  const localByUrl = new Map();
  let bytes = 0;
  let firstHtml = "";

  fs.rmSync(gameDir, { recursive: true, force: true });
  fs.mkdirSync(gameDir, { recursive: true });

  while (queue.length && seen.size < args.maxFiles && bytes < args.maxBytes) {
    const remote = queue.shift();
    if (seen.has(remote) || isSkippableUrl(remote)) continue;
    let remoteUrl;
    try {
      remoteUrl = new URL(remote);
    } catch (error) {
      continue;
    }
    if (remoteUrl.origin !== startUrl.origin) continue;
    if (remoteUrl.href !== startUrl.href && !remoteUrl.pathname.startsWith(basePath)) continue;

    seen.add(remote);
    const localRel = remoteUrl.href === startUrl.href ? "index.html" : safeLocalRel(basePath, remote);
    localByUrl.set(remoteUrl.href, localRel);
    const filePath = toFilePath(gameDir, localRel);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    try {
      if (shouldStub(remote)) {
        fs.writeFileSync(filePath, POKI_STUB, "utf8");
        textFiles.set(remoteUrl.href, { rel: localRel, text: POKI_STUB });
        continue;
      }

      const body = await curl(remoteUrl.href, args.timeout);
      const buffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
      bytes += buffer.length;

      if (isTextUrl(remoteUrl.href)) {
        const text = sanitizeText(buffer.toString("utf8"));
        if (/^\s*(?:PS\s+)?404\s+Not Found/i.test(text)) continue;
        if (remoteUrl.href === startUrl.href) firstHtml = text;
        textFiles.set(remoteUrl.href, { rel: localRel, text });
        for (const resource of discoverResources(text, remoteUrl.href, baseUrl)) {
          const resourceUrl = new URL(resource);
          if (resourceUrl.origin !== startUrl.origin) continue;
          if (!resourceUrl.pathname.startsWith(basePath)) continue;
          if (!seen.has(resourceUrl.href) && queue.length + seen.size < args.maxFiles) queue.push(resourceUrl.href);
        }
      } else {
        fs.writeFileSync(filePath, buffer);
      }
    } catch (error) {
      // Missing optional assets are common in scraped game packs. Keep going and let the smoke audit decide.
    }
  }

  if (
    !firstHtml ||
    /<iframe\b[^>]+src=["']https?:\/\//i.test(firstHtml) ||
    /This game is unavailable|Game Loader|Connecting to game server/i.test(firstHtml)
  ) {
    fs.rmSync(gameDir, { recursive: true, force: true });
    return { added: false, reason: "external iframe shell or empty html" };
  }

  for (const [remote, record] of textFiles) {
    let next = record.text;
    for (const [remoteAsset, targetRel] of localByUrl) {
      const remoteAssetUrl = new URL(remoteAsset);
      const replacement = relativeWebPath(record.rel, targetRel);
      next = next.split(remoteAsset).join(replacement);
      if (remoteAssetUrl.pathname.length > 1 && !remoteAssetUrl.pathname.endsWith("/")) {
        next = next.split(remoteAssetUrl.pathname).join(replacement);
      }
    }
    if (record.rel === "index.html") {
      next = next.replace(/<\/head>/i, `<style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:#000;}canvas,iframe,#game,#gameContainer,#container{max-width:100%;max-height:100%;}</style></head>`);
    }
    fs.writeFileSync(toFilePath(gameDir, record.rel), next, "utf8");
  }

  return {
    added: true,
    embedPath: path.relative(root, path.join(gameDir, "index.html")).replace(/\\/g, "/"),
    files: seen.size,
    bytes,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const current = readGames();
  const existingTitles = new Set(current.map((game) => normalizeTitle(game.title)));
  const old = previousGames()
    .filter((game) => game.source === "classrom6x" && game.embedUrl)
    .filter((game) => !existingTitles.has(normalizeTitle(game.title)))
    .filter((game) => {
      try {
        const host = new URL(game.embedUrl).hostname.toLowerCase();
        return !args.hosts || args.hosts.has(host);
      } catch (error) {
        return false;
      }
    });

  const added = [];
  const skipped = [];
  for (const entry of old) {
    if (added.length >= args.limit) break;
    const result = await mirrorGame(entry, args);
    if (!result.added) {
      skipped.push({ title: entry.title, reason: result.reason });
      continue;
    }
    current.push({
      id: `class6x-local-${slugify(entry.title)}`,
      title: entry.title,
      category: titleCategory(entry),
      thumbnail: entry.thumbnail,
      embedType: "html",
      embedPath: result.embedPath,
      playable: true,
      source: "crown",
      sourceNote: "Crown-local launch file",
      thumbnailSource: entry.thumbnailSource || "class6x-local",
      tags: [...new Set(["Crown Local", titleCategory(entry), ...(entry.tags || []).filter((tag) => !/classroom|class6x/i.test(tag))])],
      originalSource: "static mirror",
    });
    existingTitles.add(normalizeTitle(entry.title));
    added.push({ title: entry.title, files: result.files, bytes: result.bytes });
    writeGames(current.sort((a, b) => String(a.title).localeCompare(String(b.title), undefined, { sensitivity: "base" })));
    console.log(`Added ${entry.title} (${result.files} files)`);
  }

  current.sort((a, b) => String(a.title).localeCompare(String(b.title), undefined, { sensitivity: "base" }));
  writeGames(current);
  console.log(JSON.stringify({ added: added.length, skipped: skipped.length, addedSamples: added.slice(0, 20), skippedSamples: skipped.slice(0, 20) }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
