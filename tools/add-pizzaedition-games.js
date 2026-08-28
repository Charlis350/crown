const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const dataPath = path.join(root, "data", "games.js");
const coverDir = path.join(root, "assets", "thumbs", "pizzaedition");
const searchUrl = "https://pizzaedition.win/jsload/searchicons.js?v=7";
const pageBase = "https://pizzaedition.win";

const categoryMap = {
  Action: "Action",
  Adventure: "Adventure",
  Arcade: "Skill",
  Driving: "Racing",
  Horror: "Adventure",
  Idle: "Games",
  Multiplayer: "Multiplayer",
  Puzzle: "Puzzle",
  Racing: "Racing",
  Shooting: "Shooting",
  Simulation: "Games",
  Skill: "Skill",
  Sports: "Sports",
  "2 Player": "2 Player",
};

const palette = {
  Action: ["#ff4f75", "#f97316", "#ffd447"],
  Adventure: ["#24c6dc", "#514a9d", "#ffd447"],
  Games: ["#7c3aed", "#22c55e", "#ffd447"],
  Multiplayer: ["#38bdf8", "#7c3aed", "#ffd447"],
  Puzzle: ["#22c55e", "#0f766e", "#fde047"],
  Racing: ["#ef4444", "#f59e0b", "#38bdf8"],
  Shooting: ["#f43f5e", "#111827", "#facc15"],
  Skill: ["#8b5cf6", "#06b6d4", "#ffd447"],
  Sports: ["#22c55e", "#15803d", "#facc15"],
};

function parseGames(raw) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  return JSON.parse(raw.slice(start, end + 1));
}

function writeGames(games) {
  fs.writeFileSync(dataPath, "window.CROWN_GAMES = " + JSON.stringify(games, null, 2) + ";\n", "utf8");
}

function normalize(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function escapeXml(value = "") {
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

function shortTitle(title) {
  const clean = String(title).replace(/\s+/g, " ").trim();
  const parts = clean.split(" ");
  if (clean.length <= 18) return clean.toUpperCase();
  if (parts.length > 1) return parts.map((part) => part[0]).join("").slice(0, 5).toUpperCase();
  return clean.slice(0, 5).toUpperCase();
}

function coverSvg(title, category) {
  const [a, b, c] = palette[category] || palette.Games;
  const label = escapeXml(shortTitle(title));
  const full = escapeXml(title);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" role="img" aria-label="${full}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#080914"/>
      <stop offset=".48" stop-color="${a}"/>
      <stop offset="1" stop-color="${b}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#000" flood-opacity=".38"/>
    </filter>
  </defs>
  <rect width="640" height="360" rx="42" fill="url(#bg)"/>
  <circle cx="548" cy="54" r="112" fill="#fff" opacity=".13"/>
  <circle cx="66" cy="332" r="138" fill="#000" opacity=".18"/>
  <path d="M32 74c108 42 219 36 333-18s184-41 243 31v-119H32z" fill="#fff" opacity=".09"/>
  <g filter="url(#shadow)" transform="translate(0 -2)">
    <path d="M320 70l34 68 75 11-54 53 13 75-68-36-68 36 13-75-54-53 75-11z" fill="${c}" stroke="#090914" stroke-width="13" stroke-linejoin="round"/>
    <rect x="172" y="135" width="296" height="118" rx="18" fill="#fff8dc" stroke="#090914" stroke-width="10"/>
    <text x="320" y="212" text-anchor="middle" font-family="Impact, Arial Black, sans-serif" font-size="58" fill="#111827" letter-spacing="2">${label}</text>
  </g>
  <text x="320" y="312" text-anchor="middle" font-family="Trebuchet MS, Verdana, sans-serif" font-size="25" font-weight="900" fill="#fff" paint-order="stroke" stroke="#05060f" stroke-width="7" stroke-linejoin="round">${full}</text>
</svg>
`;
}

async function getText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 CrownGamesImporter/1.0" },
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, run));
  return output;
}

async function main() {
  fs.mkdirSync(coverDir, { recursive: true });
  const games = parseGames(fs.readFileSync(dataPath, "utf8"));
  const existing = new Set(games.map((game) => normalize(game.title)));
  const searchCode = await getText(searchUrl);
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(searchCode, sandbox, { timeout: 2000 });
  const pizzaGames = sandbox.window.SEARCH_GAMES || sandbox.SEARCH_GAMES || [];
  const missing = pizzaGames.filter((game) => !existing.has(normalize(game.name)));

  const imported = [];
  const failed = [];
  await mapLimit(missing, 8, async (game) => {
    const pageUrl = pageBase + game.url;
    try {
      const html = await getText(pageUrl);
      const iframe = /<iframe\b[\s\S]*?\bid=["']embed-frame["'][\s\S]*?\bsrc=["']([^"']+)["']/i.exec(html);
      if (!iframe) throw new Error("no embed iframe");
      const embedUrl = new URL(iframe[1], pageBase).toString();
      const slug = slugify(game.name);
      const category = (game.categories || []).map((item) => categoryMap[item]).find(Boolean) || "Games";
      const thumbnail = path.join("assets", "thumbs", "pizzaedition", slug + ".svg").replace(/\\/g, "/");
      fs.writeFileSync(path.join(root, thumbnail), coverSvg(game.name, category), "utf8");
      imported.push({
        id: "crown-" + slug,
        title: game.name,
        category,
        thumbnail,
        embedType: "iframe",
        embedUrl,
        playable: true,
        sourceHadEmbed: true,
        source: "crown",
        tags: [...new Set([category, ...(game.categories || []).map((item) => categoryMap[item] || item)])],
        thumbnailSource: "crown",
      });
    } catch (error) {
      failed.push({ title: game.name, url: pageUrl, error: error.message });
    }
  });

  imported.sort((a, b) => a.title.localeCompare(b.title));
  games.push(...imported);
  games.sort((a, b) => a.title.localeCompare(b.title));
  writeGames(games);
  console.log(JSON.stringify({ existingBefore: existing.size, pizzaCatalog: pizzaGames.length, added: imported.length, failed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
