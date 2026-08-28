const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const localRoot = path.join(root, "embeds", "class6x-local");
const keys = [
  "dataUrl",
  "asmCodeUrl",
  "asmMemoryUrl",
  "asmFrameworkUrl",
  "wasmCodeUrl",
  "wasmFrameworkUrl",
  "codeUrl",
  "frameworkUrl",
  "backgroundUrl",
];

const missing = [];

function cleanRef(value) {
  return String(value || "").replace(/\\\//g, "/").split("?")[0].split("#")[0];
}

function add(slug, type, ref) {
  missing.push({ slug, type, ref });
}

for (const entry of fs.readdirSync(localRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const slug = entry.name;
  const gameDir = path.join(localRoot, slug);
  const indexFile = path.join(gameDir, "index.html");
  if (!fs.existsSync(indexFile)) continue;
  const html = fs.readFileSync(indexFile, "utf8");

  const unityMatch = html.match(/unityWebglBuildUrl\s*:\s*["']([^"']+)["']/i);
  if (unityMatch) {
    const jsonFile = path.join(gameDir, cleanRef(unityMatch[1]));
    if (!fs.existsSync(jsonFile)) {
      add(slug, "unity json", unityMatch[1]);
    } else {
      try {
        const json = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
        for (const key of keys) {
          if (typeof json[key] !== "string" || !json[key]) continue;
          if (/^https?:\/\//i.test(json[key])) {
            add(slug, `external ${key}`, json[key]);
          } else {
            const target = path.join(path.dirname(jsonFile), cleanRef(json[key]));
            if (!fs.existsSync(target)) add(slug, key, json[key]);
          }
        }
      } catch (error) {
        add(slug, "invalid unity json", unityMatch[1]);
      }
    }
  }

  for (const match of html.matchAll(/IceStone\.downloadAsync\(\s*["']([^"']+)/gi)) {
    const target = path.join(gameDir, cleanRef(match[1]));
    if (!fs.existsSync(target)) add(slug, "IceStone", match[1]);
  }

  if (/startAwayJSPlayer|fleeing_the_complex/i.test(html)) {
    for (const ref of ["assets/fleeing_the_complex.swf", "js/AVM1Player.js"]) {
      if (!fs.existsSync(path.join(gameDir, ref))) add(slug, "AwayFL", ref);
    }
  }

  const buildUrl = /(?:const|var|let)\s+buildUrl\s*=\s*["']Build["']/i.test(html);
  if (buildUrl) {
    for (const ref of [
      "Build/DrunkenBoxing2020.loader.js",
      "Build/DrunkenBoxing2020.data.unityweb",
      "Build/DrunkenBoxing2020.framework.js.unityweb",
      "Build/DrunkenBoxing2020.wasm.unityweb",
      "Build/DrunkenBoxing2020.jpg",
    ]) {
      if (html.includes(path.basename(ref)) && !fs.existsSync(path.join(gameDir, ref))) add(slug, "buildUrl", ref);
    }
  }
}

console.log(JSON.stringify({ missing: missing.length, samples: missing }, null, 2));
