const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const outDir = path.join(root, "assets", "thumbs", "logos");

const weakSources = new Set(["generated", "capture", "embed", "none"]);
const palette = [
  ["#15120d", "#f4c430", "#1ba85b"],
  ["#111827", "#38bdf8", "#f97316"],
  ["#1f1235", "#f472b6", "#fde047"],
  ["#052e2b", "#34d399", "#fbbf24"],
  ["#2b1607", "#fb923c", "#ef4444"],
  ["#101828", "#a78bfa", "#22c55e"],
];

function readGames() {
  const raw = fs.readFileSync(dataFile, "utf8");
  return JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
}

function writeGames(games) {
  fs.writeFileSync(
    dataFile,
    "window.CROWN_GAMES = " + JSON.stringify(games, null, 2) + ";\n",
    "utf8"
  );
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function hash(value) {
  let result = 0;
  for (const char of String(value)) result = (result * 31 + char.charCodeAt(0)) >>> 0;
  return result;
}

function initials(title) {
  const words = String(title).match(/[a-z0-9]+/gi) || ["C"];
  return words
    .slice(0, 3)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    }[ch];
  });
}

function svg(game) {
  const [a, b, c] = palette[hash(game.id) % palette.length];
  const title = escapeXml(game.title);
  const mark = escapeXml(initials(game.title));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/>
      <stop offset=".58" stop-color="${b}"/>
      <stop offset="1" stop-color="${c}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#000" flood-opacity=".36"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="82" fill="url(#bg)"/>
  <circle cx="410" cy="86" r="116" fill="#fff" opacity=".16"/>
  <circle cx="86" cy="430" r="142" fill="#000" opacity=".18"/>
  <path d="M131 178h250l-37 174H168z" fill="#fff7d6" stroke="#15120d" stroke-width="18" filter="url(#shadow)"/>
  <path d="M171 178l31-64 54 47 54-47 31 64z" fill="#f4c430" stroke="#15120d" stroke-width="18" stroke-linejoin="round" filter="url(#shadow)"/>
  <text x="256" y="315" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="104" fill="#15120d">${mark}</text>
  <text x="256" y="438" text-anchor="middle" font-family="Trebuchet MS, Arial, sans-serif" font-size="31" font-weight="900" fill="#fff">${title}</text>
</svg>
`;
}

fs.mkdirSync(outDir, { recursive: true });
const games = readGames();
let changed = 0;

for (const game of games) {
  if (!weakSources.has(game.thumbnailSource || "none")) continue;
  const file = path.join(outDir, `${slug(game.id || game.title)}.svg`);
  fs.writeFileSync(file, svg(game), "utf8");
  game.thumbnail = path.relative(root, file).replace(/\\/g, "/");
  game.thumbnailSource = "crown-logo";
  changed += 1;
}

writeGames(games);
console.log(JSON.stringify({ changed, total: games.length }, null, 2));
