const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const generatedDir = path.join(root, "assets", "thumbs", "generated");

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function escapeXml(value) {
  return String(value).replace(/[&<>"]/g, (ch) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
  });
}

function fallbackSvg(game) {
  const initial = escapeXml((game.title.trim()[0] || "C").toUpperCase());
  const title = escapeXml(game.title);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="1" stop-color="#e32929"/></linearGradient></defs>
<rect width="512" height="512" rx="54" fill="url(#g)"/>
<circle cx="410" cy="90" r="96" fill="#fff" opacity=".15"/>
<circle cx="84" cy="420" r="124" fill="#000" opacity=".14"/>
<text x="256" y="235" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="132" fill="#fff">${initial}</text>
<text x="256" y="330" text-anchor="middle" font-family="Trebuchet MS, Arial, sans-serif" font-size="35" font-weight="800" fill="#fff">${title}</text>
<text x="256" y="384" text-anchor="middle" font-family="Trebuchet MS, Arial, sans-serif" font-size="24" font-weight="700" fill="#fff" opacity=".75">Crown Games</text>
</svg>`;
}

const raw = fs.readFileSync(dataFile, "utf8");
const games = JSON.parse(
  raw
    .replace(/^\s*window\.CROWN_GAMES\s*=\s*/, "")
    .replace(/;\s*$/, "")
);

fs.mkdirSync(generatedDir, { recursive: true });
let changed = 0;

for (const game of games) {
  if (!/^https?:\/\//i.test(game.thumbnail || "")) continue;
  const file = `${slugify(game.id || game.title)}.svg`;
  fs.writeFileSync(path.join(generatedDir, file), fallbackSvg(game), "utf8");
  game.thumbnail = `assets/thumbs/generated/${file}`;
  game.thumbnailSource = "generated";
  changed += 1;
}

fs.writeFileSync(
  dataFile,
  "window.CROWN_GAMES = " + JSON.stringify(games, null, 2) + ";\n",
  "utf8"
);
console.log(JSON.stringify({ changed }, null, 2));
