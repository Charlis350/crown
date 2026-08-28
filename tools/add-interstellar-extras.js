const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "data", "games.js");

function loadGames() {
  const raw = fs
    .readFileSync(catalogPath, "utf8")
    .replace(/^\s*window\.CROWN_GAMES\s*=\s*/, "")
    .replace(/;\s*$/, "");
  return JSON.parse(raw);
}

function writeGames(games) {
  fs.writeFileSync(catalogPath, "window.CROWN_GAMES = " + JSON.stringify(games, null, 2) + ";\n");
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "game";
}

function key(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|game|games|html|probably|glitchy|chance|of|loading)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const extras = [
  {
    title: "Fireboy And Watergirl In The Forest Temple",
    category: "2 Player",
    embedUrl: "https://www.coolmathgames.com/sites/default/files/public_games/40034/",
  },
  {
    title: "Fireboy And Watergirl 2 In The Light Temple",
    category: "2 Player",
    embedUrl: "https://www.coolmathgames.com/sites/default/files/public_games/40210/",
  },
  {
    title: "Fireboy And Watergirl 4 In The Crystal Temple",
    category: "2 Player",
    embedUrl: "https://www.coolmathgames.com/sites/default/files/public_games/40212/",
  },
  {
    title: "Fireboy And Watergirl 5 Elements",
    category: "2 Player",
    embedUrl: "https://www.coolmathgames.com/sites/default/files/public_games/40218/",
  },
  {
    title: "Fireboy And Watergirl 6 Fairy Tales",
    category: "2 Player",
    embedUrl: "https://html5.gamedistribution.com/rvvASMiM/be3cff113c4e4f069b7614851825ffe9/index.html",
  },
  {
    title: "Johnny Upgrade",
    category: "Action",
    embedUrl: "https://lagged.com/api/play2/johnny-upgrade3/",
  },
  {
    title: "FNAF 2",
    category: "Horror",
    embedUrl: "https://sussygamedeveloper.github.io/FNAF2/",
  },
  {
    title: "FNAF 3",
    category: "Horror",
    embedUrl: "https://sussygamedeveloper.github.io/fnaf3/",
  },
  {
    title: "FNAF Web",
    category: "Horror",
    embedUrl: "https://wellsousaaa.github.io/Five-Nights-at-Freddys-Web/",
  },
  {
    title: "Riddle School 4",
    category: "Puzzle",
    embedUrl: "https://riddle-school-4.game-files.crazygames.com/ruffle/riddleschool4.html",
  },
  {
    title: "Riddle School 5",
    category: "Puzzle",
    embedUrl: "https://riddle-school-5.game-files.crazygames.com/ruffle/riddleschool5.html",
  },
  {
    title: "N-Gon",
    category: "Action",
    embedUrl: "https://landgreen.github.io/sidescroller/",
  },
  {
    title: "Survivor.io",
    category: "Action",
    embedUrl: "https://html5.gamedistribution.com/rvvASMiM/f1c451e586c04b4c8cba01b0c50d9090/index.html",
  },
  {
    title: "Bloxd.io",
    category: "Multiplayer",
    embedUrl: "https://bloxd.io/",
  },
  {
    title: "Evades",
    category: "Multiplayer",
    embedUrl: "https://evades.io/",
  },
  {
    title: "Bullet Force Multiplayer",
    category: "Shooting",
    embedUrl: "https://www.crazygames.com/game/bullet-force-multiplayer",
  },
  {
    title: "Cubes 2048",
    category: "Puzzle",
    embedUrl: "https://www.crazygames.com/game/cubes-2048-io",
  },
  {
    title: "DOOM",
    category: "Shooting",
    embedUrl: "https://archive.org/details/doom-play",
  },
  {
    title: "Run 3",
    category: "Skill",
    embedUrl: "https://www.coolmathgames.com/0-run-3/play",
  },
  {
    title: "Subway Surfers San Francisco",
    category: "Skill",
    embedUrl: "https://raw.githack.com/3kh0/3kh0-assets/main/subway-surfers/index.html",
  },
  {
    title: "Tiny Fishing",
    category: "Skill",
    embedUrl: "https://www.dob5.com/d/file/games/tiny-fishing/",
  },
  {
    title: "Fancade",
    category: "Games",
    embedUrl: "https://play.fancade.com/",
  },
  {
    title: "Gartic Phone",
    category: "Multiplayer",
    embedUrl: "https://garticphone.com/",
  },
];

const games = loadGames();
const existing = new Set(games.map((game) => key(game.title)));
let added = 0;
for (const item of extras) {
  if (existing.has(key(item.title))) continue;
  games.push({
    id: "crown-" + slugify(item.title),
    title: item.title,
    category: item.category,
    thumbnail: "",
    embedType: "iframe",
    embedUrl: item.embedUrl,
    playable: true,
    sourceHadEmbed: true,
    source: "crown",
    thumbnailSource: "crown",
  });
  existing.add(key(item.title));
  added++;
}

writeGames(games.sort((a, b) => String(a.title).localeCompare(String(b.title))));
console.log(JSON.stringify({ added, total: games.length }, null, 2));
