const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");
const outDir = path.join(root, "assets", "thumbs", "title-logos");

const palettes = [
  ["#12071f", "#7c3aed", "#22d3ee"],
  ["#190b0b", "#ef4444", "#facc15"],
  ["#07171f", "#0ea5e9", "#84cc16"],
  ["#1d1206", "#f97316", "#fde047"],
  ["#071a11", "#22c55e", "#38bdf8"],
  ["#1f1020", "#ec4899", "#fbbf24"],
  ["#09090b", "#64748b", "#ffffff"],
];

function readGames() {
  const raw = fs.readFileSync(dataFile, "utf8");
  return JSON.parse(raw.slice(raw.indexOf("["), raw.lastIndexOf("]") + 1));
}

function writeGames(games) {
  fs.writeFileSync(dataFile, `window.CROWN_GAMES = ${JSON.stringify(games, null, 2)};\n`, "utf8");
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
  for (const char of String(value)) result = (result * 33 + char.charCodeAt(0)) >>> 0;
  return result;
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

function shortLabel(title) {
  const words = String(title).match(/[a-z0-9]+/gi) || ["Crown"];
  if (words.length <= 2) return words.join(" ").toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function iconFor(title) {
  const text = String(title).toLowerCase();
  if (/soccer|goal|tennis|pinball/.test(text)) return "ball";
  if (/shoot|robbery|1v1|doom/.test(text)) return "bolt";
  if (/panda|cow/.test(text)) return "paw";
  if (/cheese|cookie|slice/.test(text)) return "circle";
  if (/dash|rolling/.test(text)) return "speed";
  return "crown";
}

function iconSvg(type) {
  if (type === "ball") {
    return '<circle cx="256" cy="189" r="78" fill="#fff7d6" stroke="#111827" stroke-width="16"/><path d="M204 153l52-28 52 28-20 58h-64z" fill="#111827" opacity=".92"/><path d="M179 214c48 32 106 32 154 0" fill="none" stroke="#111827" stroke-width="14" stroke-linecap="round"/>';
  }
  if (type === "bolt") {
    return '<path d="M286 78 156 262h82l-25 172 145-212h-86z" fill="#fff7d6" stroke="#111827" stroke-width="18" stroke-linejoin="round"/>';
  }
  if (type === "paw") {
    return '<circle cx="256" cy="245" r="74" fill="#fff7d6" stroke="#111827" stroke-width="16"/><circle cx="169" cy="174" r="34" fill="#fff7d6" stroke="#111827" stroke-width="14"/><circle cx="226" cy="137" r="34" fill="#fff7d6" stroke="#111827" stroke-width="14"/><circle cx="286" cy="137" r="34" fill="#fff7d6" stroke="#111827" stroke-width="14"/><circle cx="343" cy="174" r="34" fill="#fff7d6" stroke="#111827" stroke-width="14"/>';
  }
  if (type === "circle") {
    return '<circle cx="256" cy="198" r="96" fill="#fff7d6" stroke="#111827" stroke-width="18"/><circle cx="224" cy="169" r="16" fill="#111827"/><circle cx="284" cy="203" r="14" fill="#111827"/><circle cx="245" cy="240" r="12" fill="#111827"/>';
  }
  if (type === "speed") {
    return '<path d="M129 250c67-106 196-111 254-6" fill="none" stroke="#fff7d6" stroke-width="30" stroke-linecap="round"/><path d="M256 257 356 150" stroke="#111827" stroke-width="22" stroke-linecap="round"/><circle cx="256" cy="257" r="30" fill="#fff7d6" stroke="#111827" stroke-width="14"/><path d="M126 312h260" stroke="#111827" stroke-width="18" stroke-linecap="round" opacity=".75"/>';
  }
  return '<path d="M132 194h248l-37 154H169z" fill="#fff7d6" stroke="#111827" stroke-width="18"/><path d="m170 194 31-66 55 47 55-47 31 66z" fill="#facc15" stroke="#111827" stroke-width="18" stroke-linejoin="round"/>';
}

function titleLines(title) {
  const words = String(title).split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 18 && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function logoSvg(game) {
  const [a, b, c] = palettes[hash(game.id || game.title) % palettes.length];
  const label = escapeXml(shortLabel(game.title));
  const lines = titleLines(game.title);
  const title = lines
    .map((line, index) => {
      const y = 376 + index * 37 - (lines.length - 1) * 18;
      return `<text x="256" y="${y}" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="32" fill="#ffffff" stroke="#111827" stroke-width="4" paint-order="stroke">${escapeXml(line)}</text>`;
    })
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/>
      <stop offset=".55" stop-color="${b}"/>
      <stop offset="1" stop-color="${c}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="15" stdDeviation="11" flood-color="#000" flood-opacity=".38"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="78" fill="url(#bg)"/>
  <path d="M-20 416C85 321 154 384 249 310c92-71 152-29 283-126v348H-20z" fill="#000" opacity=".24"/>
  <g filter="url(#shadow)">${iconSvg(iconFor(game.title))}</g>
  <text x="256" y="286" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="${label.length > 5 ? 54 : 68}" fill="#111827" stroke="#fff7d6" stroke-width="8" paint-order="stroke">${label}</text>
  ${title}
</svg>
`;
}

fs.mkdirSync(outDir, { recursive: true });

const games = readGames();
const changed = [];

for (const game of games) {
  if (!String(game.thumbnail || "").startsWith("assets/thumbs/drive/")) continue;

  const file = path.join(outDir, `${slug(game.id || game.title)}.svg`);
  fs.writeFileSync(file, logoSvg(game), "utf8");
  game.thumbnail = path.relative(root, file).replace(/\\/g, "/");
  game.thumbnailSource = "crown-title-logo";
  changed.push(game.title);
}

writeGames(games);
console.log(JSON.stringify({ changed: changed.length, titles: changed }, null, 2));
