const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const localRoot = path.join(root, "embeds", "class6x-local");
const textExts = new Set([".html", ".htm", ".js", ".mjs", ".css", ".json", ".xml", ".svg", ".txt"]);

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) walk(full, files);
    if (item.isFile()) files.push(full);
  }
  return files;
}

function isSkippable(value) {
  return (
    !value ||
    /^(?:data:|blob:|javascript:|mailto:|tel:|about:|#)/i.test(value) ||
    value.length > 240 ||
    /(?:function\s*\(|=>|typeof\s+|return\s+|const\s+|let\s+|var\s+|new\s+)/i.test(value) ||
    /[{}<>|]/.test(value)
  );
}

function refsFrom(text, file) {
  const refs = new Set();
  const ext = path.extname(file).toLowerCase();
  const patterns = [];
  if ([".html", ".htm", ".svg", ".xml"].includes(ext)) {
    patterns.push(/\b(?:src|href|data|poster)\s*=\s*["']([^"']+)["']/gi);
  }
  if ([".css", ".html", ".htm", ".svg"].includes(ext)) {
    patterns.push(/url\(\s*["']?([^"')]+)["']?\s*\)/gi);
    patterns.push(/@import\s+["']([^"']+)["']/gi);
  }
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1].trim();
      if (!isSkippable(value)) refs.add(value);
    }
  }
  return [...refs];
}

function gameRootFor(file) {
  const rel = path.relative(localRoot, file);
  return path.join(localRoot, rel.split(path.sep)[0]);
}

function localTarget(file, ref) {
  const clean = ref.split("#")[0].split("?")[0];
  if (/^https?:\/\//i.test(clean) || /^\/\//.test(clean)) return null;
  if (clean.startsWith("/")) return path.join(gameRootFor(file), clean.replace(/^\/+/, ""));
  return path.resolve(path.dirname(file), clean);
}

const missing = [];
const external = [];
let scannedTextFiles = 0;

for (const file of walk(localRoot)) {
  if (!textExts.has(path.extname(file).toLowerCase())) continue;
  scannedTextFiles += 1;
  const text = fs.readFileSync(file, "utf8");
  for (const ref of refsFrom(text, file)) {
    if (/^https?:\/\//i.test(ref) || /^\/\//.test(ref)) {
      external.push({ file: path.relative(root, file).replace(/\\/g, "/"), ref });
      continue;
    }
    const target = localTarget(file, ref);
    if (!target || fs.existsSync(target)) continue;
    missing.push({
      file: path.relative(root, file).replace(/\\/g, "/"),
      ref,
      expected: path.relative(root, target).replace(/\\/g, "/"),
    });
  }
}

console.log(
  JSON.stringify(
    {
      scannedTextFiles,
      missing: missing.length,
      external: external.length,
      missingSamples: missing.slice(0, 30),
      externalSamples: external.slice(0, 30),
    },
    null,
    2,
  ),
);
