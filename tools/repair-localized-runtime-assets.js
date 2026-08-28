const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const localRoot = path.join(root, "embeds", "class6x-local");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) CrownGamesRuntimeRepair/1.0";
const TEXT_EXTENSIONS = new Set([".html", ".htm", ".js", ".mjs", ".css", ".json", ".xml", ".svg", ".txt"]);
const UNITY_KEYS = [
  "dataUrl",
  "asmCodeUrl",
  "asmMemoryUrl",
  "asmFrameworkUrl",
  "wasmCodeUrl",
  "wasmFrameworkUrl",
  "codeUrl",
  "frameworkUrl",
  "backgroundUrl",
  "symbolsUrl",
];
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
    games: new Set(),
    maxMbPerGame: 90,
    timeout: 45,
  };
  for (const arg of argv) {
    if (arg.startsWith("--game=")) args.games.add(arg.slice("--game=".length));
    if (arg.startsWith("--max-mb-per-game=")) args.maxMbPerGame = Number(arg.slice("--max-mb-per-game=".length));
    if (arg.startsWith("--timeout=")) args.timeout = Number(arg.slice("--timeout=".length));
  }
  return args;
}

function curl(url, timeout) {
  return execFileSync(
    "curl.exe",
    [
      "--ssl-no-revoke",
      "--fail",
      "-L",
      "--compressed",
      "--connect-timeout",
      "10",
      "--max-time",
      String(timeout),
      "-sS",
      "-A",
      USER_AGENT,
      url,
    ],
    { encoding: "buffer", maxBuffer: 120 * 1024 * 1024 },
  );
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, files);
    if (item.isFile()) files.push(full);
  }
  return files;
}

function fileSize(dir) {
  return walk(dir).reduce((sum, file) => sum + fs.statSync(file).size, 0);
}

function cleanName(value) {
  return path.basename(String(value).split("?")[0].split("#")[0]).replace(/[<>:"|?*\x00-\x1f]/g, "_");
}

function remoteBaseFor(slug) {
  return `https://ubgwtf.gitlab.io/${slug}/`;
}

function isPokiSdk(urlOrPath) {
  const lower = String(urlOrPath).toLowerCase();
  return /(?:^|\/)(?:poki-?sdk|sdk\.poki|poki-sdk-core)[^/]*\.js(?:$|\?)/.test(lower);
}

function isText(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function fetchTo(remoteUrl, localPath, state) {
  const shouldReplaceExisting =
    fs.existsSync(localPath) &&
    path.extname(localPath).toLowerCase() === ".json" &&
    /PokiSDK\s*=/.test(fs.readFileSync(localPath, "utf8"));
  if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0 && !shouldReplaceExisting) return false;
  if (fileSize(state.gameDir) > state.maxBytes) throw new Error("game reached size budget");
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  if (isPokiSdk(remoteUrl) || isPokiSdk(localPath)) {
    fs.writeFileSync(localPath, POKI_STUB, "utf8");
    state.added.push(path.relative(root, localPath).replace(/\\/g, "/"));
    return true;
  }
  const body = curl(remoteUrl, state.timeout);
  if (!body.length) throw new Error("empty response");
  fs.writeFileSync(localPath, body);
  state.added.push(path.relative(root, localPath).replace(/\\/g, "/"));
  return true;
}

function textReplace(file, replacements) {
  if (!fs.existsSync(file) || !isText(file)) return false;
  let text = fs.readFileSync(file, "utf8");
  let next = text;
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  next = next
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>\s*/gi, "")
    .replace(/<script\b[^>]*\bsrc=["'][^"']*(?:googletagmanager|google-analytics|googlesyndication|doubleclick|cloudflareinsights)[^"']*["'][^>]*>\s*<\/script>/gi, "");
  if (next === text) return false;
  fs.writeFileSync(file, next, "utf8");
  return true;
}

function extractString(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].replace(/\\\//g, "/") : "";
}

function refsFromUnityJson(jsonFile, remoteJsonUrl, state) {
  if (!fs.existsSync(jsonFile)) return [];
  let raw = fs.readFileSync(jsonFile, "utf8");
  if (/PokiSDK\s*=/.test(raw)) return [];
  let json;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    return [];
  }

  const replacements = [];
  const refs = [];
  for (const key of UNITY_KEYS) {
    const value = json[key];
    if (!value || typeof value !== "string") continue;
    const remote = new URL(value, remoteJsonUrl).href;
    const fileName = cleanName(value);
    const local = path.join(path.dirname(jsonFile), fileName);
    refs.push({ remote, local });
    if (/^https?:\/\//i.test(value)) {
      json[key] = fileName;
      replacements.push([value, fileName]);
    }
  }

  if (json.cachedDecompressedFileSizes && typeof json.cachedDecompressedFileSizes === "object") {
    for (const fileName of Object.keys(json.cachedDecompressedFileSizes)) {
      refs.push({
        remote: new URL(fileName, remoteJsonUrl).href,
        local: path.join(path.dirname(jsonFile), cleanName(fileName)),
      });
    }
  }

  if (replacements.length) {
    fs.writeFileSync(jsonFile, JSON.stringify(json, null, 2), "utf8");
  }
  return refs;
}

function candidateRefs(slug, gameDir, indexText) {
  const remoteBase = remoteBaseFor(slug);
  const refs = [];
  const push = (value, from = remoteBase, localBase = gameDir) => {
    if (!value || /^data:|^blob:|^javascript:|^mailto:|^tel:|^about:/i.test(value)) return;
    const clean = value.replace(/\\\//g, "/");
    const remote = new URL(clean, from).href;
    const localRel = clean.replace(/^\/+/, "").split("?")[0].split("#")[0];
    refs.push({ remote, local: path.join(localBase, ...localRel.split("/").filter(Boolean)) });
  };

  const unityJson = extractString(indexText, /unityWebglBuildUrl\s*:\s*["']([^"']+)["']/i);
  if (unityJson) push(unityJson);

  const unityLoader = extractString(indexText, /unityWebglLoaderUrl\s*:\s*["']([^"']+)["']/i);
  if (unityLoader) push(unityLoader);

  const buildUrl = extractString(indexText, /(?:const|var|let)\s+buildUrl\s*=\s*["']([^"']+)["']/i);
  if (buildUrl) {
    for (const match of indexText.matchAll(/buildUrl\s*\+\s*["']\/([^"']+\.(?:js|json|jpg|png|data|unityweb|wasm)(?:\?[^"']*)?)["']/gi)) {
      push(`${buildUrl}/${match[1]}`);
    }
    for (const match of indexText.matchAll(/\b(?:dataUrl|frameworkUrl|codeUrl|backgroundUrl)\s*:\s*buildUrl\s*\+\s*["']\/([^"']+)["']/gi)) {
      push(`${buildUrl}/${match[1]}`);
    }
  }

  for (const match of indexText.matchAll(/IceStone\.downloadAsync\(\s*["']([^"']+)["']/gi)) {
    push(match[1]);
  }

  for (const match of indexText.matchAll(/\bswf\s*:\s*["']([^"']+\.swf(?:\?[^"']*)?)["']/gi)) {
    push(match[1]);
  }

  for (const match of indexText.matchAll(/\bpath\s*:\s*["']([^"']+\.(?:js|mjs|swf|json|png|jpg|jpeg|webp|gif)(?:\?[^"']*)?)["']/gi)) {
    push(match[1]);
  }

  return refs;
}

function ensureRuntime(slug, args) {
  const gameDir = path.join(localRoot, slug);
  const indexFile = path.join(gameDir, "index.html");
  if (!fs.existsSync(indexFile)) return { slug, skipped: "missing index" };
  const indexText = fs.readFileSync(indexFile, "utf8");
  const state = {
    gameDir,
    maxBytes: args.maxMbPerGame * 1024 * 1024,
    timeout: args.timeout,
    added: [],
    missing: [],
    rewrites: 0,
  };

  const queue = candidateRefs(slug, gameDir, indexText);
  const seen = new Set();
  for (let i = 0; i < queue.length && i < 90; i += 1) {
    const ref = queue[i];
    if (!ref.remote || seen.has(ref.remote)) continue;
    seen.add(ref.remote);
    try {
      fetchTo(ref.remote, ref.local, state);
      if (path.extname(ref.local).toLowerCase() === ".json") {
        const remoteJson = ref.remote.split("?")[0];
        queue.push(...refsFromUnityJson(ref.local, remoteJson, state));
      }
    } catch (error) {
      state.missing.push({ remote: ref.remote, local: path.relative(root, ref.local).replace(/\\/g, "/"), error: error.message });
    }
  }

  const replacements = [];
  for (const file of walk(gameDir)) {
    if (!isText(file)) continue;
    let text = fs.readFileSync(file, "utf8");
    text = text.replace(/src=["']\/(poki-sdk[^"']+\.js)["']/gi, 'src="patch/poki-sdk.js"');
    text = text.replace(/src=["']https?:\/\/[^"']*poki[^"']*sdk[^"']*["']/gi, 'src="patch/poki-sdk.js"');
    text = text.replace(/url\(["']?https?:\/\/a\.poki\.com\/images\/thumb_anim_2x\.gif["']?\)/gi, "none");
    text = text.replace(/https?:\/\/a\.poki\.com\/images\/thumb_anim_2x\.gif/gi, "");
    text = text.replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>\s*/gi, "");
    fs.writeFileSync(file, text, "utf8");
  }
  const pokiStub = path.join(gameDir, "patch", "poki-sdk.js");
  if (!fs.existsSync(pokiStub)) {
    fs.mkdirSync(path.dirname(pokiStub), { recursive: true });
    fs.writeFileSync(pokiStub, POKI_STUB, "utf8");
  }

  return {
    slug,
    added: state.added.length,
    missing: state.missing.length,
    missingSamples: state.missing.slice(0, 8),
    sizeMb: Number((fileSize(gameDir) / 1024 / 1024).toFixed(2)),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const slugs = fs
    .readdirSync(localRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((slug) => !args.games.size || args.games.has(slug));
  const results = [];
  for (const slug of slugs) {
    results.push(ensureRuntime(slug, args));
    console.log(JSON.stringify(results[results.length - 1]));
  }
  fs.writeFileSync(
    path.join(root, "data", "localized-runtime-repair-report.json"),
    JSON.stringify({ results }, null, 2),
    "utf8",
  );
}

main();
