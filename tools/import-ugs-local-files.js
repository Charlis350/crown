const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const documentsDir = path.resolve(root, "..", "..");
const dataFile = path.join(root, "data", "games.js");
const defaultListFile = path.join(root, "data", "ugs-files.txt");
const outputDir = path.join(root, "embeds", "ugs");
const reportFile = path.join(root, "data", "ugs-import-report.json");

const defaultSourceRoots = [
  path.join(root, "ugs-files"),
  path.join(root, "UGS Files"),
  path.join(root, "embeds", "ugs-source"),
  path.join(root, "embeds", "ugs"),
  path.join(documentsDir, "UGS Files"),
  path.join(documentsDir, "UGS"),
  path.join(documentsDir, "WWMD"),
  path.join(documentsDir, "GitHub", "UGS Files"),
];

function parseArgs(argv) {
  const args = {
    listFile: defaultListFile,
    sourceRoots: [],
    dryRun: false,
    includeRuffle: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--include-ruffle") {
      args.includeRuffle = true;
    } else if (arg.startsWith("--list=")) {
      args.listFile = path.resolve(arg.slice("--list=".length));
    } else if (arg === "--list") {
      args.listFile = path.resolve(argv[++index]);
    } else if (arg.startsWith("--source=")) {
      args.sourceRoots.push(path.resolve(arg.slice("--source=".length)));
    } else if (arg === "--source") {
      args.sourceRoots.push(path.resolve(argv[++index]));
    } else if (!arg.startsWith("--") && args.listFile === defaultListFile) {
      args.listFile = path.resolve(arg);
    } else if (!arg.startsWith("--")) {
      args.sourceRoots.push(path.resolve(arg));
    }
  }

  args.sourceRoots = [...args.sourceRoots, ...defaultSourceRoots]
    .map((sourceRoot) => path.resolve(sourceRoot))
    .filter((sourceRoot, index, list) => list.indexOf(sourceRoot) === index);

  return args;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 88);
}

function normalizeTitle(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readGames() {
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(dataFile, "utf8"), sandbox);
  return Array.isArray(sandbox.window.CROWN_GAMES) ? sandbox.window.CROWN_GAMES : [];
}

function writeGames(games) {
  fs.writeFileSync(dataFile, `window.CROWN_GAMES = ${JSON.stringify(games, null, 2)};\n`, "utf8");
}

function parseUgsList(text) {
  const entries = [];
  let section = "UGS Files";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^~+$/.test(line) || /^copyright\b/i.test(line) || /^r\.i\.p\./i.test(line)) continue;
    if (/^(important note|p\.s:|emulated games|ugs files)$/i.test(line)) {
      section = line.replace(/:$/, "");
      continue;
    }
    if (!/\.html\b/i.test(line)) {
      if (/^[a-z0-9 .&'’+-]+(?:games|files|[a-z])$/i.test(line) && line.length < 80) {
        section = line.replace(/:$/, "");
      }
      continue;
    }

    const colonMatch = line.match(/^(.+?):\s*([^:]+?\.html)\b/i);
    const looseMatch = line.match(/^(.+?)\s+([^\s:]+\.html)\b/i);
    const match = colonMatch || looseMatch;
    if (!match) continue;

    const title = match[1].trim().replace(/\s+/g, " ");
    const fileName = path.basename(match[2].trim());
    if (!title || !fileName.toLowerCase().endsWith(".html")) continue;

    entries.push({
      title,
      fileName,
      section,
    });
  }

  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${normalizeTitle(entry.title)}|${entry.fileName.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function walkHtmlFiles(sourceRoot, index) {
  if (!fs.existsSync(sourceRoot)) return;
  const stack = [sourceRoot];
  while (stack.length) {
    const dir = stack.pop();
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (!/^(node_modules|\.git|assets\/thumbs)$/i.test(item.name)) stack.push(fullPath);
      } else if (item.isFile() && /\.html?$/i.test(item.name)) {
        const key = item.name.toLowerCase();
        if (!index.has(key)) index.set(key, fullPath);
      }
    }
  }
}

function buildFileIndex(sourceRoots) {
  const index = new Map();
  for (const sourceRoot of sourceRoots) {
    walkHtmlFiles(sourceRoot, index);
  }
  return index;
}

function htmlLooksUnsupported(html) {
  return /@ruffle-rs|RufflePlayer|\.swf\b|shockwave-flash|application\/x-shockwave-flash/i.test(html);
}

function htmlLooksLikeExternalShell(html) {
  const bodyText = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const iframeMatch = bodyText.match(/<iframe[^>]+src=["'](https?:\/\/[^"']+)/i);
  const hasCanvas = /<canvas\b/i.test(bodyText);
  const hasLocalScript = /<script[^>]+src=["'](?!https?:\/\/)[^"']+/i.test(html);
  return Boolean(iframeMatch && bodyText.length < 6000 && !hasCanvas && !hasLocalScript);
}

function inferCategory(entry) {
  const haystack = `${entry.title} ${entry.fileName} ${entry.section}`.toLowerCase();
  if (/n64|gba|nds|nes|snes|sega|jaguar|lynx|atari|neo geo|pokemon|mario kart|zelda|kirby|sonic/.test(haystack)) {
    return "Emulator";
  }
  if (/minecraft|eagler|blockcraft|shadow_client/.test(haystack)) return "Minecraft";
  if (/roblox|obby|noob|parkour|monster school|blocky|robby|lucky blocks/.test(haystack)) return "Roblox-Style";
  if (/clicker|idle|cookie|miner/.test(haystack)) return "Clicker";
  if (/basket|soccer|football|fifa|pool|golf|tennis|baseball|sports|volley/.test(haystack)) return "Sports";
  if (/car|racing|race|drive|drift|moto|rider|truck|kart|road/.test(haystack)) return "Racing";
  if (/gun|shooter|sniper|doom|combat|war|battle|zombie/.test(haystack)) return "Shooting";
  if (/puzzle|2048|wordle|sudoku|riddle|chess|checkers|solitaire|quiz/.test(haystack)) return "Puzzle";
  if (/tower defense|strategy|warfare|takeover|bloons|btd/.test(haystack)) return "Strategy";
  if (/adventure|escape|run|jump|vex|ovo|mario|sonic|celeste|duck life/.test(haystack)) return "Adventure";
  if (/2 player|two player|12 mini battles|random/.test(haystack)) return "2 Player";
  return "Games";
}

function findReusableThumbnail(games, title) {
  const normalized = normalizeTitle(title);
  const exact = games.find((game) => normalizeTitle(game.title) === normalized && game.thumbnail);
  if (exact) return { thumbnail: exact.thumbnail, thumbnailSource: exact.thumbnailSource || "reused-local" };
  const partial = games.find((game) => {
    const other = normalizeTitle(game.title);
    return other && normalized && (other.includes(normalized) || normalized.includes(other)) && game.thumbnail;
  });
  if (partial) return { thumbnail: partial.thumbnail, thumbnailSource: partial.thumbnailSource || "reused-local" };
  return { thumbnail: "assets/crown-logo.svg", thumbnailSource: "crown" };
}

function tagsFor(entry, category) {
  const tags = new Set(["UGS", category, entry.section].filter(Boolean));
  const haystack = `${entry.title} ${entry.fileName}`.toLowerCase();
  if (/minecraft|eagler|blockcraft/.test(haystack)) tags.add("Minecraft");
  if (/roblox|obby|noob|parkour|blocky/.test(haystack)) tags.add("Roblox-Style");
  if (/pokemon|n64|gba|nds|nes|snes|sega|atari/.test(`${entry.section} ${haystack}`.toLowerCase())) tags.add("Emulator");
  return [...tags];
}

function safeOutputName(entry, usedNames) {
  const base = slugify(`${entry.title}-${entry.fileName.replace(/\.html?$/i, "")}`) || slugify(entry.fileName);
  let name = `${base}.html`;
  let count = 2;
  while (usedNames.has(name.toLowerCase())) {
    name = `${base}-${count}.html`;
    count += 1;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.listFile)) {
    console.log(
      JSON.stringify(
        {
          imported: 0,
          reason: "UGS list file not found",
          nextStep: `Save the pasted UGS list as ${path.relative(root, args.listFile)} or pass --list "C:\\path\\to\\list.txt".`,
        },
        null,
        2,
      ),
    );
    return;
  }

  const sourceRootsFound = args.sourceRoots.filter((sourceRoot) => fs.existsSync(sourceRoot));
  const entries = parseUgsList(fs.readFileSync(args.listFile, "utf8"));
  const fileIndex = buildFileIndex(sourceRootsFound);
  const games = readGames();
  const existingIds = new Set(games.map((game) => game.id));
  const existingLocalFiles = new Set(games.map((game) => String(game.embedPath || "").toLowerCase()));
  const usedOutputNames = new Set();
  const imported = [];
  const skipped = [];

  fs.mkdirSync(outputDir, { recursive: true });

  for (const entry of entries) {
    const sourceFile = fileIndex.get(entry.fileName.toLowerCase());
    if (!sourceFile) {
      skipped.push({ title: entry.title, fileName: entry.fileName, reason: "source html missing" });
      continue;
    }

    const html = fs.readFileSync(sourceFile, "utf8");
    if (!args.includeRuffle && htmlLooksUnsupported(html)) {
      skipped.push({ title: entry.title, fileName: entry.fileName, reason: "ruffle or flash content skipped" });
      continue;
    }
    if (htmlLooksLikeExternalShell(html)) {
      skipped.push({ title: entry.title, fileName: entry.fileName, reason: "external-only iframe shell skipped" });
      continue;
    }

    const category = inferCategory(entry);
    const idBase = `ugs-${slugify(entry.title)}`;
    let id = idBase;
    let idSuffix = 2;
    while (existingIds.has(id)) {
      id = `${idBase}-${idSuffix}`;
      idSuffix += 1;
    }

    const outputName = safeOutputName(entry, usedOutputNames);
    const outputPath = path.join(outputDir, outputName);
    const embedPath = path.relative(root, outputPath).replace(/\\/g, "/");
    if (existingLocalFiles.has(embedPath.toLowerCase())) {
      skipped.push({ title: entry.title, fileName: entry.fileName, reason: "already imported" });
      continue;
    }

    const thumbnail = findReusableThumbnail(games, entry.title);
    if (!args.dryRun) {
      fs.copyFileSync(sourceFile, outputPath);
      games.push({
        id,
        title: entry.title,
        category,
        thumbnail: thumbnail.thumbnail,
        embedType: "html",
        embedPath,
        playable: true,
        sourceHadEmbed: true,
        source: "ugs-local",
        ugsSection: entry.section,
        ugsFileName: entry.fileName,
        thumbnailSource: thumbnail.thumbnailSource,
        tags: tagsFor(entry, category),
      });
      existingIds.add(id);
      existingLocalFiles.add(embedPath.toLowerCase());
    }

    imported.push({ title: entry.title, fileName: entry.fileName, category, embedPath });
  }

  if (!args.dryRun && imported.length) {
    games.sort((a, b) => {
      const categoryCompare = String(a.category || "").localeCompare(String(b.category || ""));
      if (categoryCompare) return categoryCompare;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
    writeGames(games);
  }

  const report = {
    dryRun: args.dryRun,
    listFile: args.listFile,
    sourceRootsFound,
    parsedEntries: entries.length,
    matchedFiles: imported.length + skipped.filter((item) => item.reason !== "source html missing").length,
    imported: imported.length,
    skipped: skipped.length,
    importedSamples: imported.slice(0, 40),
    skippedSamples: skipped.slice(0, 80),
  };

  if (!args.dryRun) fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main();
