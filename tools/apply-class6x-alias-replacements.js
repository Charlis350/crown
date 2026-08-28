const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dataFile = path.join(root, "data", "games.js");

const replacements = [
  ["8 ball classic", "8 Ball Pool"],
  ["Google Dino", "Dinosaur Game"],
  ["Duck Life 3", "Duck Life 3 Evolution"],
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

function sameTitle(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

const games = readGames();
let changed = 0;

for (const [crownTitle, class6xTitle] of replacements) {
  const crown = games.find((game) => sameTitle(game.title, crownTitle));
  const class6x = games.find((game) => sameTitle(game.title, class6xTitle) && game.source === "class6x");
  if (!crown || !class6x) continue;

  crown.category = class6x.category;
  crown.embedType = class6x.embedType;
  crown.embedUrl = class6x.embedUrl;
  delete crown.embedPath;
  crown.originalPage = class6x.originalPage;
  crown.class6xPage = class6x.originalPage;
  crown.thumbnail = class6x.thumbnail;
  crown.thumbnailSource = class6x.thumbnailSource;
  crown.source = "class6x";
  crown.sourceHadEmbed = true;
  crown.playable = true;
  crown.tags = class6x.tags;
  class6x.__remove = true;
  changed += 1;
}

const output = games
  .filter((game) => !game.__remove)
  .sort((a, b) => {
    const cat = String(a.category || "").localeCompare(String(b.category || ""));
    if (cat) return cat;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });

writeGames(output);
console.log(JSON.stringify({ changed, total: output.length }, null, 2));
