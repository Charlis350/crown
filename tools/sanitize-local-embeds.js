const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const embedsDir = path.join(root, "embeds");
const reportFile = path.join(root, "data", "embed-sanitize-report.json");
const dataFile = path.join(root, "data", "games.js");

const BLOCKED_SCRIPT_PATTERNS = [
  /googletagmanager\.com\/gtag\/js/i,
  /google-analytics\.com/i,
  /pagead2\.googlesyndication\.com/i,
  /static\.cloudflareinsights\.com\/beacon/i,
  /adsbygoogle/i,
];

const INLINE_BLOCK_PATTERNS = [
  /gtag\s*\(/i,
  /dataLayer/i,
  /adsbygoogle/i,
  /googletagmanager/i,
  /googlesyndication/i,
  /cloudflareinsights/i,
];

function walkHtmlFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      walkHtmlFiles(fullPath, files);
    } else if (item.isFile() && /\.html?$/i.test(item.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function removeBlockedScripts(html) {
  let removed = 0;
  const next = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) => {
    const blockedBySrc = BLOCKED_SCRIPT_PATTERNS.some((pattern) => pattern.test(tag));
    const blockedInline = !/\bsrc\s*=/i.test(tag) && INLINE_BLOCK_PATTERNS.some((pattern) => pattern.test(tag));
    if (blockedBySrc || blockedInline) {
      removed += 1;
      return "";
    }
    return tag;
  });

  return { html: next, removed };
}

function readGameTitleByEmbedPath() {
  const map = new Map();
  if (!fs.existsSync(dataFile)) return map;
  const raw = fs.readFileSync(dataFile, "utf8");
  const games = JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
  for (const game of games) {
    if (!game.embedPath || !game.title) continue;
    map.set(game.embedPath.replace(/\\/g, "/"), game.title);
  }
  return map;
}

function cleanMetaAndTitle(html, file, titleByEmbedPath) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const title = titleByEmbedPath.get(rel);
  let changed = 0;
  let next = html;

  if (title) {
    const pageTitle = `${title} - Crown Games`;
    if (/<title>[\s\S]*?<\/title>/i.test(next)) {
      next = next.replace(/<title>[\s\S]*?<\/title>/i, `<title>${pageTitle}</title>`);
    } else {
      next = next.replace(/<head\b[^>]*>/i, (tag) => `${tag}\n<title>${pageTitle}</title>`);
    }
    changed += next === html ? 0 : 1;
  }

  const beforeMeta = next;
  next = next
    .replace(/<meta\b[^>]*\bname=["']website["'][^>]*>\s*/gi, "")
    .replace(/<meta\b[^>]*\bcontent=["'][^"']*(?:unblocked|classroom6x|class6x|gitlab|ubg|911)[^"']*["'][^>]*>\s*/gi, "")
    .replace(/\bUnblocked Games(?:\s*\d+)?\b/gi, "Crown Games")
    .replace(/\bUnblocked\b/gi, "Crown")
    .replace(/\bclassroom6x\.gitlab\.io\b/gi, "Crown Games")
    .replace(/\bunblockedgames67\.gitlab\.io\b/gi, "Crown Games")
    .replace(/\bubgwtf\.gitlab\.io\b/gi, "Crown Games");
  if (next !== beforeMeta) changed += 1;

  return { html: next, changed };
}

function main() {
  const changed = [];
  let totalRemoved = 0;
  let totalCleaned = 0;
  const titleByEmbedPath = readGameTitleByEmbedPath();

  for (const file of walkHtmlFiles(embedsDir)) {
    const before = fs.readFileSync(file, "utf8");
    const result = removeBlockedScripts(before);
    const cleaned = cleanMetaAndTitle(result.html, file, titleByEmbedPath);
    if (!result.removed && !cleaned.changed) continue;
    fs.writeFileSync(file, cleaned.html, "utf8");
    totalRemoved += result.removed;
    totalCleaned += cleaned.changed;
    changed.push({
      file: path.relative(root, file).replace(/\\/g, "/"),
      scriptsRemoved: result.removed,
      metadataCleaned: cleaned.changed,
    });
  }

  fs.writeFileSync(
    reportFile,
    JSON.stringify(
      {
        filesChanged: changed.length,
        scriptsRemoved: totalRemoved,
        metadataCleaned: totalCleaned,
        changed,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Sanitized ${changed.length} embed files. Removed ${totalRemoved} ad/analytics scripts and cleaned ${totalCleaned} metadata blocks.`);
  console.log(`Report: ${path.relative(root, reportFile)}`);
}

main();
